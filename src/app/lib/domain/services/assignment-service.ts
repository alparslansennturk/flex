import { can } from "../access/can";
import type { Actor } from "../access/types";
import type { EntityId, ISODateTime } from "../base";
import type { Assignment, AssignmentAttachment, AssignmentStatus } from "../core/assignment";
import type { AssignmentTemplate } from "../core/assignment-template";
import { ForbiddenError, ValidationError } from "../errors";
import type { AssignmentRepo } from "../repo/assignment-repo";
import type { AssignmentTemplateRepo } from "../repo/assignment-template-repo";
import type { GroupRepo } from "../repo/group-repo";

function nowISO(): ISODateTime {
  return new Date().toISOString();
}

export interface AssignmentDeps {
  groups: GroupRepo;
}

export interface AssignTaskInput {
  groupId: EntityId;
  templateId?: EntityId;
  title: string;
  description: string;
  dueDate?: ISODateTime;
  status?: AssignmentStatus; // varsayılan "draft"
  attachments?: AssignmentAttachment[];
  targetPersonIds?: EntityId[];
}

/**
 * Ödev oluştur/ata — gated (`assignment.create`). Canlıdaki `AssignmentLibrary.tsx`
 * + `DesignParkour.tsx`'in İKİ ayrı `addDoc` çağrısı yerine TEK kaynak.
 * Assigned-scope aktör (eğitmen) SADECE kendi grubuna ödev atayabilir.
 */
export async function assignTask(
  actor: Actor,
  input: AssignTaskInput,
  repo: AssignmentRepo,
  deps: AssignmentDeps,
): Promise<Assignment> {
  const group = await deps.groups.getById(input.groupId, actor.tenantId);
  if (!group) throw new ValidationError("Grup bulunamadı.");

  if (!can(actor, "assignment.create", { groupId: input.groupId, ownerUid: group.trainerId })) {
    throw new ForbiddenError("assignment.create");
  }

  const title = input.title?.trim();
  const description = input.description?.trim();
  if (!title) throw new ValidationError("Ödev başlığı zorunludur.");
  if (!description) throw new ValidationError("Ödev açıklaması zorunludur.");

  const assignment: Assignment = {
    id: repo.nextId(),
    tenantId: actor.tenantId,
    groupId: input.groupId,
    templateId: input.templateId,
    trainerId: group.trainerId || actor.uid,
    title,
    description,
    dueDate: input.dueDate,
    status: input.status ?? "draft",
    attachments: input.attachments ?? [],
    targetPersonIds: input.targetPersonIds,
    createdAt: nowISO(),
    createdBy: actor.uid,
  };

  await repo.save(assignment);
  return assignment;
}

export interface UpdateAssignmentInput {
  title?: string;
  description?: string;
  dueDate?: ISODateTime;
  status?: AssignmentStatus;
  attachments?: AssignmentAttachment[];
  targetPersonIds?: EntityId[];
}

/** Ödev güncelle — gated (`assignment.edit`). Sadece gönderilen alanlar değişir. */
export async function updateAssignment(
  actor: Actor,
  id: string,
  input: UpdateAssignmentInput,
  repo: AssignmentRepo,
): Promise<Assignment> {
  const existing = await repo.getById(id, actor.tenantId);
  if (!existing) throw new ValidationError("Ödev bulunamadı.");

  if (!can(actor, "assignment.edit", { groupId: existing.groupId, ownerUid: existing.trainerId })) {
    throw new ForbiddenError("assignment.edit");
  }

  const updated: Assignment = { ...existing };
  if (input.title !== undefined) {
    const t = input.title.trim();
    if (!t) throw new ValidationError("Ödev başlığı boş olamaz.");
    updated.title = t;
  }
  if (input.description !== undefined) {
    const d = input.description.trim();
    if (!d) throw new ValidationError("Ödev açıklaması boş olamaz.");
    updated.description = d;
  }
  if (input.dueDate !== undefined) updated.dueDate = input.dueDate;
  if (input.status !== undefined) updated.status = input.status;
  if (input.attachments !== undefined) updated.attachments = input.attachments;
  if (input.targetPersonIds !== undefined) updated.targetPersonIds = input.targetPersonIds;

  updated.updatedAt = nowISO();
  updated.updatedBy = actor.uid;
  await repo.save(updated);
  return updated;
}

/** Ödev sil — gated (`assignment.delete`). */
export async function deleteAssignment(actor: Actor, id: string, repo: AssignmentRepo): Promise<void> {
  const existing = await repo.getById(id, actor.tenantId);
  if (!existing) throw new ValidationError("Ödev bulunamadı.");

  if (!can(actor, "assignment.delete", { groupId: existing.groupId, ownerUid: existing.trainerId })) {
    throw new ForbiddenError("assignment.delete");
  }

  await repo.delete(id, actor.tenantId);
}

// ── Şablon (kütüphane) — küratörlük sadece Operasyon/Admin (`template.manage`) ──

export interface CreateTemplateInput {
  branch?: string;
  title: string;
  description: string;
  attachments?: AssignmentAttachment[];
}

/** Şablon oluştur — gated (`template.manage`). Eğitmen şablon OLUŞTURAMAZ, sadece okur. */
export async function createTemplate(
  actor: Actor,
  input: CreateTemplateInput,
  repo: AssignmentTemplateRepo,
): Promise<AssignmentTemplate> {
  if (!can(actor, "template.manage")) throw new ForbiddenError("template.manage");

  const title = input.title?.trim();
  const description = input.description?.trim();
  if (!title) throw new ValidationError("Şablon başlığı zorunludur.");
  if (!description) throw new ValidationError("Şablon açıklaması zorunludur.");

  const template: AssignmentTemplate = {
    id: repo.nextId(),
    tenantId: actor.tenantId,
    branch: input.branch?.trim() || undefined,
    title,
    description,
    attachments: input.attachments ?? [],
    createdAt: nowISO(),
    createdBy: actor.uid,
  };

  await repo.save(template);
  return template;
}

/** Şablon listesi — okuma `assignment.read` ile serbest (eğitmen kütüphaneyi görebilir, düzenleyemez). */
export async function listTemplates(actor: Actor, repo: AssignmentTemplateRepo): Promise<AssignmentTemplate[]> {
  if (!can(actor, "assignment.read")) throw new ForbiddenError("assignment.read");
  return repo.list(actor.tenantId);
}
