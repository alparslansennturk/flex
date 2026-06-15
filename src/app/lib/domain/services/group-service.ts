import { can } from "../access/can";
import type { Actor } from "../access/types";
import type { EntityId, ISODateTime } from "../base";
import type { Group, GroupSchedule, GroupStatus, GroupType } from "../core/group";
import { ForbiddenError, ValidationError } from "../errors";
import type { GroupRepo } from "../repo/group-repo";

export interface CreateGroupInput {
  code: string;
  type: GroupType;
  schedule: GroupSchedule;
  trackId?: EntityId; // grubun işlediği Track (Temel Photoshop)
  educationId?: EntityId; // bağlı eğitim (Grafik-1)
  branch?: string; // branş (Grafik Tasarım)
  trainerId?: string; // verilmezse oluşturan aktör (standalone eğitmen kendi grubunu kurar)
  branchOfficeId?: EntityId;
  capacity?: number;
  status?: GroupStatus; // verilmezse "planned"
}

const VALID_TYPES: GroupType[] = ["standart", "ozel_ders", "kurumsal"];

function nowISO(): ISODateTime {
  return new Date().toISOString();
}

/**
 * Grup oluşturma — gated (`group.create`).
 * Eğitmen (geniş paket) kendi grubunu kurabilir; trainerId verilmezse aktörün kendisi.
 */
export async function createGroup(
  actor: Actor,
  input: CreateGroupInput,
  repo: GroupRepo,
): Promise<Group> {
  if (!can(actor, "group.create")) {
    throw new ForbiddenError("group.create");
  }

  const code = input.code?.trim();
  if (!code) throw new ValidationError("Grup kodu zorunludur.");
  if (!VALID_TYPES.includes(input.type)) throw new ValidationError("Geçersiz grup tipi.");

  const s = input.schedule;
  if (!s || !s.startDate) throw new ValidationError("Başlangıç tarihi zorunludur.");
  if (!Array.isArray(s.days) || s.days.length === 0) {
    throw new ValidationError("En az bir ders günü seçilmelidir.");
  }
  if (!(s.sessionHours > 0)) throw new ValidationError("Seans saati 0'dan büyük olmalıdır.");

  const ts = nowISO();
  const group: Group = {
    id: repo.nextId(),
    tenantId: actor.tenantId,
    code,
    trackId: input.trackId,
    educationId: input.educationId,
    branch: input.branch,
    status: input.status ?? "planned",
    type: input.type,
    trainerId: input.trainerId ?? actor.uid,
    branchOfficeId: input.branchOfficeId,
    schedule: {
      startDate: s.startDate,
      days: s.days,
      sessionHours: s.sessionHours,
      endDate: s.endDate,
    },
    capacity: input.capacity,
    createdAt: ts,
    createdBy: actor.uid,
  };

  await repo.save(group);
  return group;
}
