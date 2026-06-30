import { can } from "../access/can";
import type { Actor } from "../access/types";
import type { EntityId, ISODateTime } from "../base";
import type { Case, CaseChannel, CaseOutcome, CaseStatus, CaseType } from "../crm/case";
import type { Activity, ActivityType } from "../crm/activity";
import type { Appointment } from "../crm/appointment";
import { ForbiddenError, ValidationError } from "../errors";
import type { CaseRepo } from "../repo/case-repo";
import type { ActivityRepo } from "../repo/activity-repo";
import type { AppointmentRepo } from "../repo/appointment-repo";

// ── Kapalı statüler ──
const CLOSED_STATUSES: CaseStatus[] = ["kazanildi", "tamamlandi", "vazgecti"];
function isClosed(status: CaseStatus): boolean {
  return CLOSED_STATUSES.includes(status);
}

function nowISO(): ISODateTime {
  return new Date().toISOString();
}

// ─────────────────────────────────────────────
// createCase — yeni talep (dedup: açık talep varsa hata)
// ─────────────────────────────────────────────

export interface CreateCaseInput {
  personId: EntityId;
  channel: CaseChannel;
  type: CaseType;
  note?: string;               // ilk aktivite notu
  assignedToUid?: string;
  assignedToName?: string;
}

export interface CreateCaseDeps {
  cases: CaseRepo;
  activities: ActivityRepo;
}

export interface CreateCaseResult {
  case: Case;
  activity: Activity;
}

export async function createCase(
  actor: Actor,
  input: CreateCaseInput,
  deps: CreateCaseDeps,
): Promise<CreateCaseResult> {
  if (!can(actor, "case.create")) throw new ForbiddenError("case.create");

  if (!input.personId) throw new ValidationError("Kişi zorunludur.");
  if (!input.channel) throw new ValidationError("Kanal zorunludur.");
  if (!input.type) throw new ValidationError("Tür zorunludur.");

  // Dedup: aynı kişinin açık talebi varsa yeni talep AÇILMAZ
  const openCases = await deps.cases.listOpenByPerson(input.personId, actor.tenantId);
  if (openCases.length > 0) {
    throw new ValidationError(
      "Bu kişinin zaten açık bir talebi var. Yeni aktivite eklemek için mevcut talebi kullanın.",
    );
  }

  const ts = nowISO();

  const newCase: Case = {
    id: deps.cases.nextId(),
    tenantId: actor.tenantId,
    personId: input.personId,
    channel: input.channel,
    type: input.type,
    status: "yeni",
    assignedToUid: input.assignedToUid,
    assignedToName: input.assignedToName,
    activityCount: 1,
    lastActivityAt: ts,
    createdAt: ts,
    createdBy: actor.uid,
  };

  // İlk aktivite
  const firstActivity: Activity = {
    id: deps.activities.nextId(),
    tenantId: actor.tenantId,
    caseId: newCase.id,
    personId: input.personId,
    type: "not",
    note: input.note,
    createdAt: ts,
    createdBy: actor.uid,
  };

  await deps.cases.save(newCase);
  await deps.activities.save(firstActivity);

  return { case: newCase, activity: firstActivity };
}

// ─────────────────────────────────────────────
// addActivity — mevcut talebe aktivite ekle
// ─────────────────────────────────────────────

export interface AddActivityInput {
  caseId: EntityId;
  type: ActivityType;
  note?: string;
  nextActionType?: ActivityType;
  nextActionDate?: ISODateTime;
  /** Randevu oluşturulacaksa tarih/atanan (appointment.create yetkisi gerekir). */
  appointment?: {
    scheduledAt: ISODateTime;
    assignedToUid?: string;
    note?: string;
  };
  /** Talebi kapat (outcome zorunlu). */
  closeCase?: {
    status: "kazanildi" | "tamamlandi" | "vazgecti";
    outcome: CaseOutcome;
  };
}

export interface AddActivityDeps {
  cases: CaseRepo;
  activities: ActivityRepo;
  appointments?: AppointmentRepo;
}

export interface AddActivityResult {
  activity: Activity;
  appointment?: Appointment;
  updatedCase: Case;
}

export async function addActivity(
  actor: Actor,
  input: AddActivityInput,
  deps: AddActivityDeps,
): Promise<AddActivityResult> {
  if (!can(actor, "activity.create")) throw new ForbiddenError("activity.create");

  const existingCase = await deps.cases.getById(input.caseId, actor.tenantId);
  if (!existingCase) throw new ValidationError("Talep bulunamadı.");
  if (isClosed(existingCase.status)) throw new ValidationError("Kapalı talebe aktivite eklenemez.");

  if (input.appointment && !can(actor, "appointment.create")) {
    throw new ForbiddenError("appointment.create");
  }
  if (input.closeCase && !can(actor, "case.edit")) {
    throw new ForbiddenError("case.edit");
  }

  const ts = nowISO();

  let appointment: Appointment | undefined;

  const activity: Activity = {
    id: deps.activities.nextId(),
    tenantId: actor.tenantId,
    caseId: existingCase.id,
    personId: existingCase.personId,
    type: input.type,
    note: input.note,
    nextActionType: input.nextActionType,
    nextActionDate: input.nextActionDate,
    createdAt: ts,
    createdBy: actor.uid,
  };

  // Randevu oluştur
  if (input.appointment && deps.appointments) {
    appointment = {
      id: deps.appointments.nextId(),
      tenantId: actor.tenantId,
      personId: existingCase.personId,
      caseId: existingCase.id,
      activityId: activity.id,
      scheduledAt: input.appointment.scheduledAt,
      assignedToUid: input.appointment.assignedToUid,
      note: input.appointment.note,
      status: "bekliyor",
      createdAt: ts,
      createdBy: actor.uid,
    };
    activity.appointmentId = appointment.id;
  }

  // Talep güncelle
  const updatedCase: Case = {
    ...existingCase,
    activityCount: existingCase.activityCount + 1,
    lastActivityAt: ts,
    updatedAt: ts,
    updatedBy: actor.uid,
  };

  if (appointment) updatedCase.status = "randevu_olusturuldu";

  if (input.closeCase) {
    updatedCase.status = input.closeCase.status;
    updatedCase.outcome = input.closeCase.outcome;
  }

  await deps.activities.save(activity);
  if (appointment) await deps.appointments!.save(appointment);
  await deps.cases.save(updatedCase);

  return { activity, appointment, updatedCase };
}

// ─────────────────────────────────────────────
// updateCaseStatus — statü/sorumlu güncelle
// ─────────────────────────────────────────────

export interface UpdateCaseInput {
  status?: CaseStatus;
  assignedToUid?: string;
  assignedToName?: string;
  uiDurum?: string;
  uiSonrakiTip?: string;
  outcome?: CaseOutcome;
}

export async function updateCase(
  actor: Actor,
  caseId: EntityId,
  input: UpdateCaseInput,
  caseRepo: CaseRepo,
): Promise<Case> {
  if (!can(actor, "case.edit")) throw new ForbiddenError("case.edit");

  const existing = await caseRepo.getById(caseId, actor.tenantId);
  if (!existing) throw new ValidationError("Talep bulunamadı.");

  const ts = nowISO();
  const updated: Case = {
    ...existing,
    ...(input.status !== undefined && { status: input.status }),
    ...(input.assignedToUid !== undefined && { assignedToUid: input.assignedToUid }),
    ...(input.assignedToName !== undefined && { assignedToName: input.assignedToName }),
    ...(input.uiDurum !== undefined && { uiDurum: input.uiDurum }),
    ...(input.uiSonrakiTip !== undefined && { uiSonrakiTip: input.uiSonrakiTip }),
    ...(input.outcome !== undefined && { outcome: input.outcome }),
    updatedAt: ts,
    updatedBy: actor.uid,
  };

  await caseRepo.save(updated);
  return updated;
}
