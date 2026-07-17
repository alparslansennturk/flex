import { can, widestScope } from "../access/can";
import type { Actor } from "../access/types";
import type { EntityId, ISODateTime } from "../base";
import type { Assignment, AssignmentAttachment, AssignmentKind, AssignmentStatus, GamifiedAssignmentType } from "../core/assignment";
import type { AssignmentTemplate } from "../core/assignment-template";
import { ForbiddenError, ValidationError } from "../errors";
import type { AssignmentRepo } from "../repo/assignment-repo";
import type { AssignmentTemplateRepo } from "../repo/assignment-template-repo";
import type { GroupRepo } from "../repo/group-repo";
import type { ActivityLogRepo } from "../repo/activity-log-repo";

function nowISO(): ISODateTime {
  return new Date().toISOString();
}

function activityId(): string {
  return `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export interface AssignmentDeps {
  groups: GroupRepo;
  /** `templateId` verilirse `gamifiedType`'ı kopyalamak için opsiyonel — sağlanmazsa kopyalama atlanır. */
  templates?: AssignmentTemplateRepo;
  /** Ana Sayfa "En Son Aktiviteler" paneli için — sağlanmazsa log atlanır (ör. test'ler). */
  activityLog?: ActivityLogRepo;
}

export interface AssignTaskInput {
  groupId: EntityId;
  templateId?: EntityId;
  title: string;
  subtitle?: string;
  description: string;
  dueDate?: ISODateTime;
  status?: AssignmentStatus; // varsayılan "draft"
  maxPuan?: number; // varsayılan 100 — "özel" ödevler 200/300 gibi ağırlıklı olabilir
  kind?: AssignmentKind; // varsayılan "normal" — Ödev Notu iç ağırlıklandırması (bkz. submission-service.ts)
  icon?: string;
  attachments?: AssignmentAttachment[];
  targetPersonIds?: EntityId[];
}

const VALID_KINDS: AssignmentKind[] = ["normal", "proje"];

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
  if (input.maxPuan != null && (!Number.isFinite(input.maxPuan) || input.maxPuan <= 0)) {
    throw new ValidationError("Ödev puanı pozitif olmalı.");
  }
  if (input.kind != null && !VALID_KINDS.includes(input.kind)) {
    throw new ValidationError("Geçersiz ödev türü.");
  }

  // Şablondan oluşturuluyorsa gamifiedType kopyalanır — doluysa bu ödev normal teslim
  // yerine çekiliş ekranına yönlendirir (2026-07-07 kararı).
  let gamifiedType: GamifiedAssignmentType | undefined;
  if (input.templateId && deps.templates) {
    const template = await deps.templates.getById(input.templateId, actor.tenantId);
    gamifiedType = template?.gamifiedType;
  }

  const assignment: Assignment = {
    id: repo.nextId(),
    tenantId: actor.tenantId,
    groupId: input.groupId,
    templateId: input.templateId,
    trainerId: group.trainerId || actor.uid,
    title,
    subtitle: input.subtitle?.trim() || undefined,
    description,
    dueDate: input.dueDate,
    status: input.status ?? "draft",
    maxPuan: input.maxPuan ?? 100,
    kind: input.kind ?? "normal",
    gamifiedType,
    icon: input.icon,
    attachments: input.attachments ?? [],
    targetPersonIds: input.targetPersonIds,
    createdAt: nowISO(),
    createdBy: actor.uid,
  };

  await repo.save(assignment);

  if (deps.activityLog && assignment.status === "published") {
    await deps.activityLog.create({
      id: activityId(),
      tenantId: actor.tenantId,
      trainerId: assignment.trainerId,
      groupId: assignment.groupId,
      type: "assignment.published",
      title: "Ödev Verildi",
      description: assignment.title,
      createdAt: assignment.createdAt,
    });
  }

  return assignment;
}

export interface UpdateAssignmentInput {
  title?: string;
  subtitle?: string;
  description?: string;
  dueDate?: ISODateTime;
  status?: AssignmentStatus;
  maxPuan?: number;
  kind?: AssignmentKind;
  icon?: string;
  attachments?: AssignmentAttachment[];
  targetPersonIds?: EntityId[];
}

/** Ödev güncelle — gated (`assignment.edit`). Sadece gönderilen alanlar değişir. */
export async function updateAssignment(
  actor: Actor,
  id: string,
  input: UpdateAssignmentInput,
  repo: AssignmentRepo,
  /** 2026-07-18: sessizce oluşturulmuş taslağın PATCH ile "Ödevi Başlat"a geçmesi de
   * (bkz. `[id]/route.ts`) POST'taki AYNI "Ödev Verildi" aktivite logunu yazsın diye. */
  deps?: { activityLog?: ActivityLogRepo },
): Promise<Assignment> {
  const existing = await repo.getById(id, actor.tenantId);
  if (!existing) throw new ValidationError("Ödev bulunamadı.");

  if (!can(actor, "assignment.edit", { groupId: existing.groupId, ownerUid: existing.trainerId })) {
    throw new ForbiddenError("assignment.edit");
  }

  const wasPublished = existing.status === "published";
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
  if (input.subtitle !== undefined) updated.subtitle = input.subtitle.trim() || undefined;
  if (input.icon !== undefined) updated.icon = input.icon;
  if (input.dueDate !== undefined) updated.dueDate = input.dueDate;
  if (input.status !== undefined) updated.status = input.status;
  if (input.maxPuan !== undefined) {
    if (!Number.isFinite(input.maxPuan) || input.maxPuan <= 0) throw new ValidationError("Ödev puanı pozitif olmalı.");
    updated.maxPuan = input.maxPuan;
  }
  if (input.kind !== undefined) {
    if (!VALID_KINDS.includes(input.kind)) throw new ValidationError("Geçersiz ödev türü.");
    updated.kind = input.kind;
  }
  if (input.attachments !== undefined) updated.attachments = input.attachments;
  if (input.targetPersonIds !== undefined) updated.targetPersonIds = input.targetPersonIds;

  updated.updatedAt = nowISO();
  updated.updatedBy = actor.uid;
  await repo.save(updated);

  if (deps?.activityLog && !wasPublished && updated.status === "published") {
    await deps.activityLog.create({
      id: activityId(),
      tenantId: actor.tenantId,
      trainerId: updated.trainerId,
      groupId: updated.groupId,
      type: "assignment.published",
      title: "Ödev Verildi",
      description: updated.title,
      createdAt: updated.updatedAt,
    });
  }

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

// ── Şablon (kütüphane) — İKİ KAPSAM, AYNI capability farklı scope (2026-07-06) ──
// `template.manage` **self** scope (eğitmen, her modda — EGITMEN_CORE) → KİŞİSEL şablon
// (kendi kütüphanesi, sadece kendisi görür). **org** scope (Op/Admin) → GLOBAL şablon
// (tenant genelinde herkese açık) — kullanıcı kararı: global kütüphane ileride admine
// özel daraltılacak, henüz YAPILMADI (bu turun kapsamı dışında, "sonra yapacağız").

const VALID_GAMIFIED_TYPES: GamifiedAssignmentType[] = ["kolaj", "kitap", "sosyal"];

export interface CreateTemplateInput {
  branch?: string;
  title: string;
  subtitle?: string;
  description: string;
  icon?: string;
  kind?: AssignmentKind;
  maxPuan?: number;
  attachments?: AssignmentAttachment[];
  /** Yalnız org scope (global şablon) — Global Kütüphane katalog girdisi işaretler. */
  gamifiedType?: GamifiedAssignmentType;
}

/**
 * Şablon oluştur — gated (`template.manage`). Aktörün en geniş scope'una göre
 * kişisel (`self`) veya global (`org`) şablon üretir.
 */
export async function createTemplate(
  actor: Actor,
  input: CreateTemplateInput,
  repo: AssignmentTemplateRepo,
): Promise<AssignmentTemplate> {
  const scope = widestScope(actor, "template.manage");
  if (!scope) throw new ForbiddenError("template.manage");

  const title = input.title?.trim();
  const description = input.description?.trim();
  if (!title) throw new ValidationError("Şablon başlığı zorunludur.");
  if (!description) throw new ValidationError("Şablon açıklaması zorunludur.");
  if (input.kind != null && !VALID_KINDS.includes(input.kind)) {
    throw new ValidationError("Geçersiz ödev türü.");
  }
  if (input.maxPuan != null && (!Number.isFinite(input.maxPuan) || input.maxPuan <= 0)) {
    throw new ValidationError("Ödev puanı pozitif olmalı.");
  }
  if (input.gamifiedType != null && !VALID_GAMIFIED_TYPES.includes(input.gamifiedType)) {
    throw new ValidationError("Geçersiz oyunlaştırılmış tür.");
  }

  const isGlobal = scope === "org";
  if (input.gamifiedType != null && !isGlobal) {
    throw new ValidationError("Oyunlaştırılmış tür yalnız global şablonda ayarlanabilir.");
  }

  const template: AssignmentTemplate = {
    id: repo.nextId(),
    tenantId: actor.tenantId,
    scope: isGlobal ? "global" : "personal",
    trainerId: isGlobal ? undefined : actor.uid,
    branch: input.branch?.trim() || undefined,
    title,
    subtitle: input.subtitle?.trim() || undefined,
    description,
    icon: input.icon,
    kind: input.kind ?? "normal",
    maxPuan: input.maxPuan ?? 100,
    gamifiedType: input.gamifiedType,
    attachments: input.attachments ?? [],
    visible: false, // Şablon Yönetimi'nden manuel onaylanana kadar Ana Sayfa'da görünmez
    createdAt: nowISO(),
    createdBy: actor.uid,
  };

  await repo.save(template);
  return template;
}

/**
 * Şablon listesi — okuma `assignment.read` ile serbest. Kişisel (`scope==="personal"`)
 * şablonlar SADECE sahibine görünür; global (veya scope'suz eski kayıt) herkese açık.
 */
export async function listTemplates(actor: Actor, repo: AssignmentTemplateRepo): Promise<AssignmentTemplate[]> {
  if (!can(actor, "assignment.read")) throw new ForbiddenError("assignment.read");
  const all = await repo.list(actor.tenantId);
  return all.filter((t) => t.scope !== "personal" || t.trainerId === actor.uid);
}

/**
 * Şablon sahiplik kontrolü — kişisel şablonu SADECE sahibi eğitmen (self scope),
 * global şablonu SADECE org scope (Op/Admin) düzenleyebilir/silebilir. Kişisel şablona
 * org-scope aktör bile erişemez (kullanıcı kararı: "sadece kendisi görür/yönetir").
 */
function assertTemplateOwnership(actor: Actor, template: AssignmentTemplate): void {
  const scope = widestScope(actor, "template.manage");
  if (!scope) throw new ForbiddenError("template.manage");
  const isOwnPersonal = template.scope === "personal" && template.trainerId === actor.uid;
  const isGlobalAndOrg = template.scope !== "personal" && scope === "org";
  if (!isOwnPersonal && !isGlobalAndOrg) throw new ForbiddenError("template.manage");
}

export interface UpdateTemplateInput {
  title?: string;
  subtitle?: string;
  description?: string;
  branch?: string;
  icon?: string;
  kind?: AssignmentKind;
  maxPuan?: number;
  visible?: boolean;
  /** Yalnız global şablonda + org scope aktörle ayarlanabilir (admin "Global Kütüphane'ye ekle"). */
  gamifiedType?: GamifiedAssignmentType | null;
}

/** Şablon güncelle — gated (`template.manage`, sahiplik kontrolü). */
export async function updateTemplate(
  actor: Actor,
  id: string,
  input: UpdateTemplateInput,
  repo: AssignmentTemplateRepo,
): Promise<AssignmentTemplate> {
  const existing = await repo.getById(id, actor.tenantId);
  if (!existing) throw new ValidationError("Şablon bulunamadı.");
  assertTemplateOwnership(actor, existing);

  const updated: AssignmentTemplate = { ...existing };
  if (input.title !== undefined) {
    const t = input.title.trim();
    if (!t) throw new ValidationError("Şablon başlığı boş olamaz.");
    updated.title = t;
  }
  if (input.subtitle !== undefined) updated.subtitle = input.subtitle.trim() || undefined;
  if (input.description !== undefined) {
    const d = input.description.trim();
    if (!d) throw new ValidationError("Şablon açıklaması boş olamaz.");
    updated.description = d;
  }
  if (input.branch !== undefined) updated.branch = input.branch.trim() || undefined;
  if (input.icon !== undefined) updated.icon = input.icon;
  if (input.kind !== undefined) {
    if (!VALID_KINDS.includes(input.kind)) throw new ValidationError("Geçersiz ödev türü.");
    updated.kind = input.kind;
  }
  if (input.maxPuan !== undefined) {
    if (!Number.isFinite(input.maxPuan) || input.maxPuan <= 0) throw new ValidationError("Ödev puanı pozitif olmalı.");
    updated.maxPuan = input.maxPuan;
  }
  if (input.visible !== undefined) updated.visible = input.visible;
  if (input.gamifiedType !== undefined) {
    if (input.gamifiedType != null) {
      if (!VALID_GAMIFIED_TYPES.includes(input.gamifiedType)) throw new ValidationError("Geçersiz oyunlaştırılmış tür.");
      if (existing.scope === "personal" || widestScope(actor, "template.manage") !== "org") {
        throw new ValidationError("Oyunlaştırılmış tür yalnız global şablonda, org yetkisiyle ayarlanabilir.");
      }
    }
    updated.gamifiedType = input.gamifiedType ?? undefined;
  }

  updated.updatedAt = nowISO();
  updated.updatedBy = actor.uid;
  await repo.save(updated);
  return updated;
}

/** Şablon sil — gated (`template.manage`, sahiplik kontrolü). */
export async function deleteTemplate(actor: Actor, id: string, repo: AssignmentTemplateRepo): Promise<void> {
  const existing = await repo.getById(id, actor.tenantId);
  if (!existing) throw new ValidationError("Şablon bulunamadı.");
  assertTemplateOwnership(actor, existing);
  await repo.delete(id, actor.tenantId);
}
