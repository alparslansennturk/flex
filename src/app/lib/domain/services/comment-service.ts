import { can } from "../access/can";
import type { Actor } from "../access/types";
import type { EntityId, ISODateTime } from "../base";
import type { Comment } from "../core/comment";
import { ForbiddenError, ValidationError } from "../errors";
import type { AssignmentRepo } from "../repo/assignment-repo";
import type { ChatRepo } from "../repo/chat-repo";
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
  chats: ChatRepo;
  trainers: TrainerRepo;
  notify: (uid: string, input: NotifyInput) => Promise<void>;
}

/** Grubun atanmış eğitmeninden (`group.trainerId` → `Trainer.authUid`) ve `Person.authUid`'den
 *  chat kimliklerini çözer — YAZANIN uid'i DEĞİL (aksi halde eğitmen ilk mesajı atarsa
 *  `studentUid` boş kalır, öğrenci kendi chat'ini asla okuyamazdı). Gerçek hesaplar yoksa null. */
async function resolveChatUids(
  deps: Pick<CommentDeps, "groups" | "trainers" | "persons">,
  tenantId: string,
  groupId: EntityId,
  personId: EntityId,
): Promise<{ trainerUid: string; studentUid: string } | null> {
  const [group, person] = await Promise.all([
    deps.groups.getById(groupId, tenantId),
    deps.persons.getById(personId, tenantId),
  ]);
  const trainer = group?.trainerId ? await deps.trainers.getById(group.trainerId, tenantId) : null;
  if (!trainer?.authUid || !person?.authUid) return null;
  return { trainerUid: trainer.authUid, studentUid: person.authUid };
}

/**
 * 1:1 thread mesajını `chats/{chatId}/messages`'a da yazar — client bunu DOĞRUDAN
 * `onSnapshot` ile okur (anlık, polling YOK, bkz. chat-repo.ts). `deps.comments`'e yazma
 * da KORUNDU (geriye dönük uyumluluk + mevcut testler) — bilinçli çift-yazma.
 */
async function mirrorToChat(
  deps: Pick<CommentDeps, "groups" | "trainers" | "persons" | "chats">,
  tenantId: string,
  assignmentId: EntityId,
  groupId: EntityId,
  personId: EntityId,
  msg: { text: string; authorUid: string; authorType: "trainer" | "student"; authorName: string },
): Promise<void> {
  const uids = await resolveChatUids(deps, tenantId, groupId, personId);
  if (!uids) return; // gerçek hesaplar yoksa chat dokümanı anlamsız — sessizce atla
  const chatId = deps.chats.chatIdFor(assignmentId, personId);
  await deps.chats.ensureChat(chatId, { assignmentId, personId, ...uids });
  await deps.chats.addMessage(chatId, msg);
}

/**
 * SADECE `chats/{chatId}` dokümanını garanti eder (mesaj YOK) — client hiç mesaj
 * atılmamışken bile `onSnapshot` ile dinleyebilsin diye (rules `get()` ile parent
 * dokümanın VAR olmasını + trainerUid/studentUid alanlarını gerektiriyor; doküman
 * hiç yoksa `get().data` erişimi rules'ta hataya düşüp "Missing or insufficient
 * permissions" ile sonuçlanıyordu — 2026-07-13 bug fix). Sayfa mount olduğunda,
 * ilk mesajdan ÖNCE çağrılmalı.
 */
export async function ensureThreadChatForStaff(
  actor: Actor,
  assignmentId: EntityId,
  personId: EntityId,
  deps: Pick<CommentDeps, "assignments" | "groups" | "trainers" | "persons" | "chats">,
): Promise<void> {
  if (!can(actor, "assignment.read")) throw new ForbiddenError("assignment.read");
  const assignment = await deps.assignments.getById(assignmentId, actor.tenantId);
  if (!assignment) throw new ValidationError("Ödev bulunamadı.");
  const uids = await resolveChatUids(deps, actor.tenantId, assignment.groupId, personId);
  // 2026-07-13 bug fix: eskiden burada sessizce `return` edilip route 200 dönüyordu —
  // chat dokümanı HİÇ oluşmadan client "başarılı" sanıp onSnapshot'a geçiyor, sonra
  // "Missing or insufficient permissions" alıyordu. Artık NEDEN görünür.
  if (!uids) throw new ValidationError("Chat kurulamadı: grubun eğitmeninin veya öğrencinin gerçek hesabı (authUid) yok.");
  const chatId = deps.chats.chatIdFor(assignmentId, personId);
  await deps.chats.ensureChat(chatId, { assignmentId, personId, ...uids });
}

/** `ensureThreadChatForStaff`'ın öğrenci karşılığı — sahiplik + kayıt kontrolü ile. */
export async function ensureThreadChatForStudent(
  requesterUid: string,
  tenantId: string,
  personId: EntityId,
  assignmentId: EntityId,
  deps: Pick<CommentDeps, "assignments" | "groups" | "trainers" | "persons" | "enrollments" | "chats">,
): Promise<void> {
  await requireOwnedPerson(personId, requesterUid, deps, tenantId);
  const assignment = await deps.assignments.getById(assignmentId, tenantId);
  if (!assignment) throw new ValidationError("Ödev bulunamadı.");
  await requireEnrolled(personId, assignment.groupId, deps, tenantId);
  const uids = await resolveChatUids(deps, tenantId, assignment.groupId, personId);
  if (!uids) throw new ValidationError("Chat kurulamadı: grubun eğitmeninin veya öğrencinin gerçek hesabı (authUid) yok.");
  const chatId = deps.chats.chatIdFor(assignmentId, personId);
  await deps.chats.ensureChat(chatId, { assignmentId, personId, ...uids });
}

/**
 * `Trainer.id` (eğitmen kadrosu docId) auth uid DEĞİL (bkz. `Actor.trainerId` yorumu,
 * access/types.ts) — 2026-07-11 düzeltmesi öncesi burada `actor.uid` ile `getById`
 * çağrılıyordu, hiçbir zaman eşleşmiyordu, isim hep "Eğitim Ekibi"ne düşüyordu.
 * Bulunamazsa genel etiket.
 */
async function staffDisplayName(actor: Actor, deps: Pick<CommentDeps, "trainers">): Promise<string> {
  if (!actor.trainerId) return "Eğitim Ekibi";
  const trainer = await deps.trainers.getById(actor.trainerId, actor.tenantId);
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

/** Genel duyuru — gruptaki TÜM aktif öğrencilere bildirim gider. Öğrenci YAZAMAZ.
 *  `chats` gerekmez — o SADECE 1:1 thread için (bkz. mirrorToChat). */
export async function postGeneralComment(
  actor: Actor,
  assignmentId: EntityId,
  text: string,
  deps: Omit<CommentDeps, "chats">,
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
  await mirrorToChat(deps, actor.tenantId, assignmentId, assignment.groupId, personId, {
    text: trimmed, authorUid: actor.uid, authorType: "trainer", authorName: comment.authorName,
  });

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
  await mirrorToChat(deps, tenantId, assignmentId, assignment.groupId, personId, {
    text: trimmed, authorUid: requesterUid, authorType: "student", authorName: comment.authorName,
  });

  const group = await deps.groups.getById(assignment.groupId, tenantId);
  // `notify()` gerçek Firebase auth uid ister — `group.trainerId` eğitmen kadrosu
  // docId'si (bkz. can.ts ownerMatches yorumu), doğrudan uid DEĞİL. 2026-07-11 düzeltmesi
  // öncesi bu satır `group.trainerId`'yi doğrudan uid gibi kullanıyordu, bildirim hiçbir
  // zaman gerçek eğitmenin (kendi uid'iyle giriş yapan) hesabına düşmüyordu.
  const trainerForNotify = group?.trainerId ? await deps.trainers.getById(group.trainerId, tenantId) : null;
  if (trainerForNotify?.authUid) {
    await deps.notify(trainerForNotify.authUid, {
      type: "message",
      entityId: assignmentId,
      senderId: requesterUid,
      title: `${comment.authorName} yorum yazdı`,
      preview: trimmed.slice(0, 100),
      // Eskiden hep sabit `/flexos/egitmen-anasayfa` (homepage) — eğitmen bildirime tıklayınca
      // yorumu ASLA göremiyordu, kendi elleriyle doğru gruba/ödeve/öğrenciye gitmesi
      // gerekiyordu (2026-07-13 bug). Artık doğrudan Teslim Detayı'na + ?personId ile o
      // öğrencinin thread'i otomatik açılır (bkz. teslim/[groupId]/[assignmentId]/page.tsx).
      actionUrl: `/flexos/odevler/teslim/${assignment.groupId}/${assignmentId}?personId=${personId}`,
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

// ── `chats/{chatId}/messages` — 1:1 thread'in YENİ (onSnapshot ile okunan) mesajları.
// `editOwnComment`/`deleteOwnComment`'ten AYRI: farklı id uzayı (`chatId`+`messageId`),
// eski `comments` koleksiyonundaki genel duyurulara dokunmaz.

/** Kendi chat mesajını düzenle — sahiplik ONLY, rol farketmez. */
export async function editChatMessage(
  requesterUid: string,
  chatId: string,
  messageId: string,
  text: string,
  deps: Pick<CommentDeps, "chats">,
): Promise<void> {
  const existing = await deps.chats.getMessage(chatId, messageId);
  if (!existing) throw new ValidationError("Mesaj bulunamadı.");
  if (existing.authorUid !== requesterUid) throw new ForbiddenError("chat.own");
  const trimmed = text.trim();
  if (!trimmed) throw new ValidationError("Mesaj boş olamaz.");
  await deps.chats.updateMessage(chatId, messageId, trimmed);
}

/** Kendi chat mesajını sil — sahiplik ONLY, rol farketmez. */
export async function deleteChatMessage(
  requesterUid: string,
  chatId: string,
  messageId: string,
  deps: Pick<CommentDeps, "chats">,
): Promise<void> {
  const existing = await deps.chats.getMessage(chatId, messageId);
  if (!existing) throw new ValidationError("Mesaj bulunamadı.");
  if (existing.authorUid !== requesterUid) throw new ForbiddenError("chat.own");
  await deps.chats.deleteMessage(chatId, messageId);
}
