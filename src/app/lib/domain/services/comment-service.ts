import { can } from "../access/can";
import type { Actor } from "../access/types";
import type { EntityId, ISODateTime } from "../base";
import type { Comment } from "../core/comment";
import { ForbiddenError, ValidationError } from "../errors";
import type { AssignmentRepo } from "../repo/assignment-repo";
import type { CommentRepo } from "../repo/comment-repo";
import type { EnrollmentRepo } from "../repo/enrollment-repo";
import type { GroupRepo } from "../repo/group-repo";
import type { PersonRepo } from "../repo/person-repo";
import type { TrainerRepo } from "../repo/trainer-repo";

function nowISO(): ISODateTime {
  return new Date().toISOString();
}

export interface NotifyInput {
  type: "message" | "announcement" | "assignment" | "system";
  entityId: string;
  senderId: string;
  title: string;
  preview: string;
  actionUrl: string;
}

export interface CommentDeps {
  assignments: AssignmentRepo;
  groups: GroupRepo;
  persons: PersonRepo;
  enrollments: EnrollmentRepo;
  comments: CommentRepo;
  trainers: TrainerRepo;
  notify: (uid: string, input: NotifyInput) => Promise<void>;
}

/** Trainer.id === Group.trainerId === auth uid (proje konvansiyonu) — bulunamazsa genel etiket. */
async function staffDisplayName(actor: Actor, deps: Pick<CommentDeps, "trainers">): Promise<string> {
  const trainer = await deps.trainers.getById(actor.uid, actor.tenantId);
  return trainer?.name ?? "Eğitim Ekibi";
}

async function requireOwnedPerson(
  personId: EntityId,
  requesterUid: string,
  deps: Pick<CommentDeps, "persons">,
  tenantId: string,
) {
  const person = await deps.persons.getById(personId, tenantId);
  if (!person) throw new ValidationError("Kişi bulunamadı.");
  if (person.authUid !== requesterUid) throw new ForbiddenError("comment.own");
  return person;
}

async function requireEnrolled(
  personId: EntityId,
  groupId: EntityId,
  deps: Pick<CommentDeps, "enrollments">,
  tenantId: string,
) {
  const enrollment = await deps.enrollments.findActive(personId, groupId, tenantId);
  if (!enrollment) throw new ValidationError("Bu gruba kayıtlı değilsiniz.");
}

async function requireStaffCommentScope(actor: Actor, groupId: EntityId, deps: Pick<CommentDeps, "groups">) {
  const group = await deps.groups.getById(groupId, actor.tenantId);
  if (!group) throw new ValidationError("Grup bulunamadı.");
  if (!can(actor, "assignment.comment.write", { groupId, ownerUid: group.trainerId })) {
    throw new ForbiddenError("assignment.comment.write");
  }
  return group;
}

function actionUrlFor(assignmentId: string, personId?: string) {
  return personId ? `/flexos/student/${personId}/${assignmentId}` : `/flexos/egitmen-anasayfa`;
}

// ── Eğitmen/Operasyon — yazma (capability-gated) ──

/** Genel duyuru — gruptaki TÜM aktif öğrencilere bildirim gider. Öğrenci YAZAMAZ. */
export async function postGeneralComment(
  actor: Actor,
  assignmentId: EntityId,
  text: string,
  deps: CommentDeps,
): Promise<Comment> {
  const assignment = await deps.assignments.getById(assignmentId, actor.tenantId);
  if (!assignment) throw new ValidationError("Ödev bulunamadı.");
  const trimmed = text.trim();
  if (!trimmed) throw new ValidationError("Yorum boş olamaz.");

  await requireStaffCommentScope(actor, assignment.groupId, deps);

  const comment: Comment = {
    id: deps.comments.nextId(),
    tenantId: actor.tenantId,
    assignmentId,
    groupId: assignment.groupId,
    authorUid: actor.uid,
    authorType: "trainer",
    authorName: await staffDisplayName(actor, deps),
    text: trimmed,
    createdAt: nowISO(),
    createdBy: actor.uid,
  };
  await deps.comments.save(comment);

  const enrollments = await deps.enrollments.listByGroup(assignment.groupId, actor.tenantId);
  const activePersons = await deps.persons.getByIds(
    enrollments.filter((e) => e.status === "active").map((e) => e.personId),
    actor.tenantId,
  );
  await Promise.all(
    activePersons
      .filter((p) => p.authUid)
      .map((p) =>
        deps.notify(p.authUid!, {
          type: "announcement",
          entityId: assignmentId,
          senderId: actor.uid,
          title: `Yeni duyuru: ${assignment.title}`,
          preview: trimmed.slice(0, 100),
          actionUrl: actionUrlFor(assignmentId, p.id),
        }),
      ),
  );

  return comment;
}

/** Eğitmen/Op'un bir öğrenciyle 1:1 thread'ine yazması — gated. */
export async function postThreadCommentAsStaff(
  actor: Actor,
  assignmentId: EntityId,
  personId: EntityId,
  text: string,
  deps: CommentDeps,
): Promise<Comment> {
  const assignment = await deps.assignments.getById(assignmentId, actor.tenantId);
  if (!assignment) throw new ValidationError("Ödev bulunamadı.");
  const trimmed = text.trim();
  if (!trimmed) throw new ValidationError("Yorum boş olamaz.");

  await requireStaffCommentScope(actor, assignment.groupId, deps);

  const comment: Comment = {
    id: deps.comments.nextId(),
    tenantId: actor.tenantId,
    assignmentId,
    groupId: assignment.groupId,
    personId,
    authorUid: actor.uid,
    authorType: "trainer",
    authorName: await staffDisplayName(actor, deps),
    text: trimmed,
    createdAt: nowISO(),
    createdBy: actor.uid,
  };
  await deps.comments.save(comment);

  const person = await deps.persons.getById(personId, actor.tenantId);
  if (person?.authUid) {
    await deps.notify(person.authUid, {
      type: "message",
      entityId: assignmentId,
      senderId: actor.uid,
      title: `Eğitmenden yeni mesaj: ${assignment.title}`,
      preview: trimmed.slice(0, 100),
      actionUrl: actionUrlFor(assignmentId, personId),
    });
  }

  return comment;
}

export async function listGeneralCommentsForStaff(
  actor: Actor,
  assignmentId: EntityId,
  deps: Pick<CommentDeps, "comments">,
): Promise<Comment[]> {
  if (!can(actor, "assignment.read")) throw new ForbiddenError("assignment.read");
  return deps.comments.listGeneral(assignmentId, actor.tenantId);
}

export async function listThreadCommentsForStaff(
  actor: Actor,
  assignmentId: EntityId,
  personId: EntityId,
  deps: Pick<CommentDeps, "comments">,
): Promise<Comment[]> {
  if (!can(actor, "assignment.read")) throw new ForbiddenError("assignment.read");
  return deps.comments.listThread(assignmentId, personId, actor.tenantId);
}

// ── Öğrenci — sahiplik-gated, capability sistemi DIŞINDA (Faz 2/3 deseniyle aynı) ──

export async function listGeneralCommentsForStudent(
  requesterUid: string,
  tenantId: string,
  personId: EntityId,
  assignmentId: EntityId,
  deps: Pick<CommentDeps, "persons" | "assignments" | "enrollments" | "comments">,
): Promise<Comment[]> {
  await requireOwnedPerson(personId, requesterUid, deps, tenantId);
  const assignment = await deps.assignments.getById(assignmentId, tenantId);
  if (!assignment) throw new ValidationError("Ödev bulunamadı.");
  await requireEnrolled(personId, assignment.groupId, deps, tenantId);
  return deps.comments.listGeneral(assignmentId, tenantId);
}

export async function listThreadCommentsForStudent(
  requesterUid: string,
  tenantId: string,
  personId: EntityId,
  assignmentId: EntityId,
  deps: Pick<CommentDeps, "persons" | "assignments" | "enrollments" | "comments">,
): Promise<Comment[]> {
  await requireOwnedPerson(personId, requesterUid, deps, tenantId);
  const assignment = await deps.assignments.getById(assignmentId, tenantId);
  if (!assignment) throw new ValidationError("Ödev bulunamadı.");
  await requireEnrolled(personId, assignment.groupId, deps, tenantId);
  return deps.comments.listThread(assignmentId, personId, tenantId);
}

export async function postThreadCommentAsStudent(
  requesterUid: string,
  tenantId: string,
  personId: EntityId,
  assignmentId: EntityId,
  text: string,
  deps: CommentDeps,
): Promise<Comment> {
  const person = await requireOwnedPerson(personId, requesterUid, deps, tenantId);
  const assignment = await deps.assignments.getById(assignmentId, tenantId);
  if (!assignment) throw new ValidationError("Ödev bulunamadı.");
  await requireEnrolled(personId, assignment.groupId, deps, tenantId);

  const trimmed = text.trim();
  if (!trimmed) throw new ValidationError("Yorum boş olamaz.");

  const comment: Comment = {
    id: deps.comments.nextId(),
    tenantId,
    assignmentId,
    groupId: assignment.groupId,
    personId,
    authorUid: requesterUid,
    authorType: "student",
    authorName: `${person.firstName} ${person.lastName}`.trim(),
    text: trimmed,
    createdAt: nowISO(),
    createdBy: requesterUid,
  };
  await deps.comments.save(comment);

  const group = await deps.groups.getById(assignment.groupId, tenantId);
  if (group?.trainerId) {
    await deps.notify(group.trainerId, {
      type: "message",
      entityId: assignmentId,
      senderId: requesterUid,
      title: `${comment.authorName} yorum yazdı`,
      preview: trimmed.slice(0, 100),
      actionUrl: `/flexos/egitmen-anasayfa`,
    });
  }

  return comment;
}

/** Öğrenci dashboard'unda "Duyurular" — kişinin aktif olduğu tüm gruplardaki genel yorumlar. */
export async function listAnnouncementsForStudent(
  requesterUid: string,
  tenantId: string,
  personId: EntityId,
  deps: Pick<CommentDeps, "persons" | "enrollments" | "assignments" | "comments">,
): Promise<Comment[]> {
  await requireOwnedPerson(personId, requesterUid, deps, tenantId);

  const enrollments = await deps.enrollments.listByPerson(personId, tenantId);
  const groupIds = [...new Set(enrollments.filter((e) => e.status === "active").map((e) => e.groupId).filter((id): id is string => !!id))];
  if (groupIds.length === 0) return [];

  const assignmentLists = await Promise.all(groupIds.map((gid) => deps.assignments.list(tenantId, gid)));
  const assignmentIds = assignmentLists.flat().map((a) => a.id);
  if (assignmentIds.length === 0) return [];

  return deps.comments.listGeneralForAssignments(assignmentIds, tenantId);
}

// ── Ortak — sahiplik ONLY (öğrenci VEYA eğitmen, kendi yazdığı yorum) ──

/** Kendi yorumunu düzenle — rol farketmez, sadece `authorUid === requesterUid`. */
export async function editOwnComment(
  requesterUid: string,
  tenantId: string,
  commentId: EntityId,
  text: string,
  deps: Pick<CommentDeps, "comments">,
): Promise<Comment> {
  const existing = await deps.comments.getById(commentId, tenantId);
  if (!existing) throw new ValidationError("Yorum bulunamadı.");
  if (existing.authorUid !== requesterUid) throw new ForbiddenError("comment.own");

  const trimmed = text.trim();
  if (!trimmed) throw new ValidationError("Yorum boş olamaz.");

  const updated: Comment = { ...existing, text: trimmed, editedAt: nowISO() };
  await deps.comments.save(updated);
  return updated;
}

/** Kendi yorumunu sil — rol farketmez, sadece `authorUid === requesterUid`. */
export async function deleteOwnComment(
  requesterUid: string,
  tenantId: string,
  commentId: EntityId,
  deps: Pick<CommentDeps, "comments">,
): Promise<void> {
  const existing = await deps.comments.getById(commentId, tenantId);
  if (!existing) throw new ValidationError("Yorum bulunamadı.");
  if (existing.authorUid !== requesterUid) throw new ForbiddenError("comment.own");
  await deps.comments.delete(commentId, tenantId);
}
