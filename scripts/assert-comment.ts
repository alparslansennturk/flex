/**
 * Ödev Yorumu (Comment: genel duyuru + 1:1 thread) domain — Faz 3 assertion'ları.
 * npx jiti scripts/assert-comment.ts
 */
import { resolvePackages } from "../src/app/lib/domain/access/packages";
import type { Actor } from "../src/app/lib/domain/access/types";
import type { Assignment } from "../src/app/lib/domain/core/assignment";
import type { Comment } from "../src/app/lib/domain/core/comment";
import type { Enrollment } from "../src/app/lib/domain/core/enrollment";
import type { Group } from "../src/app/lib/domain/core/group";
import type { Person } from "../src/app/lib/domain/core/person";
import type { Trainer } from "../src/app/lib/domain/core/trainer";
import type { AssignmentRepo } from "../src/app/lib/domain/repo/assignment-repo";
import type { CommentRepo } from "../src/app/lib/domain/repo/comment-repo";
import type { EnrollmentRepo } from "../src/app/lib/domain/repo/enrollment-repo";
import type { GroupRepo } from "../src/app/lib/domain/repo/group-repo";
import type { PersonRepo } from "../src/app/lib/domain/repo/person-repo";
import type { TrainerRepo } from "../src/app/lib/domain/repo/trainer-repo";
import {
  postGeneralComment, postThreadCommentAsStaff, listGeneralCommentsForStaff, listThreadCommentsForStaff,
  listGeneralCommentsForStudent, listThreadCommentsForStudent, postThreadCommentAsStudent,
  listAnnouncementsForStudent, editOwnComment, deleteOwnComment,
  type CommentDeps,
} from "../src/app/lib/domain/services/comment-service";
import { ForbiddenError, ValidationError } from "../src/app/lib/domain/errors";

const TENANT = "test-tenant";
const OTHER_TENANT = "other-tenant";

function makeActor(pkg: "egitmen" | "operasyon" | "admin", uid: string, tenantId = TENANT, trainerId?: string): Actor {
  return { type: "human", uid, tenantId, grants: resolvePackages([pkg]), trainerId };
}

let idCounter = 0;
function nextId(prefix: string) { return () => `${prefix}-${++idCounter}`; }

function makeGroupRepo(seed: Group[]): GroupRepo {
  const map = new Map<string, Group>(seed.map((g) => [g.id, g]));
  return {
    nextId: nextId("group"),
    async save(g) { map.set(g.id, { ...g }); },
    async getById(id, tid) { const g = map.get(id); return g && g.tenantId === tid ? g : null; },
    async list(tid, trainerId) { return Array.from(map.values()).filter((g) => g.tenantId === tid && (!trainerId || g.trainerId === trainerId)); },
    async delete(id) { map.delete(id); },
  };
}

function makeAssignmentRepo(seed: Assignment[]): AssignmentRepo {
  const map = new Map<string, Assignment>(seed.map((a) => [a.id, a]));
  return {
    nextId: nextId("assignment"),
    async save(a) { map.set(a.id, { ...a }); },
    async getById(id, tid) { const a = map.get(id); return a && a.tenantId === tid ? a : null; },
    async list(tid, groupId) { return Array.from(map.values()).filter((a) => a.tenantId === tid && (!groupId || a.groupId === groupId)); },
    async listByTrainerIds(trainerIds, tid) { return Array.from(map.values()).filter((a) => a.tenantId === tid && trainerIds.includes(a.trainerId ?? "")); },
    async delete(id) { map.delete(id); },
  };
}

function makePersonRepo(seed: Person[]): PersonRepo {
  const map = new Map<string, Person>(seed.map((p) => [p.id, p]));
  return {
    nextId: nextId("person"),
    async save(p) { map.set(p.id, { ...p }); },
    async getById(id, tid) { const p = map.get(id); return p && p.tenantId === tid ? p : null; },
    async getByIds(ids, tid) { return ids.map((id) => map.get(id)).filter((p): p is Person => !!p && p.tenantId === tid); },
    async findByIdNo() { return null; },
    async findByAuthUid(authUid, tid) { return Array.from(map.values()).find((p) => p.tenantId === tid && p.authUid === authUid) ?? null; },
    async list(tid) { return Array.from(map.values()).filter((p) => p.tenantId === tid); },
    async update(id, tid, data) { const p = map.get(id); if (p && p.tenantId === tid) map.set(id, { ...p, ...data }); },
    async clearAuthUid(id, tid) { const p = map.get(id); if (p && p.tenantId === tid) map.set(id, { ...p, authUid: undefined }); },
    async delete(id, tid) { const p = map.get(id); if (p && p.tenantId === tid) map.delete(id); },
  };
}

function makeEnrollmentRepo(seed: Enrollment[]): EnrollmentRepo {
  const map = new Map<string, Enrollment>(seed.map((e) => [e.id, e]));
  return {
    nextId: nextId("enrollment"),
    async save(e) { map.set(e.id, { ...e }); },
    async getById(id, tid) { const e = map.get(id); return e && e.tenantId === tid ? e : null; },
    async findActive(personId, groupId, tid) {
      return Array.from(map.values()).find((e) => e.tenantId === tid && e.personId === personId && e.groupId === groupId && e.status === "active") ?? null;
    },
    async list(tid) { return Array.from(map.values()).filter((e) => e.tenantId === tid); },
    async listByGroup(groupId, tid) { return Array.from(map.values()).filter((e) => e.tenantId === tid && e.groupId === groupId); },
    async listByGroupIds(groupIds, tid) { return Array.from(map.values()).filter((e) => e.tenantId === tid && groupIds.includes(e.groupId ?? "")); },
    async listBySale(saleId, tid) { return Array.from(map.values()).filter((e) => e.tenantId === tid && e.saleId === saleId); },
    async listByPerson(personId, tid) { return Array.from(map.values()).filter((e) => e.tenantId === tid && e.personId === personId); },
    async delete(id, tid) { const e = map.get(id); if (e && e.tenantId === tid) map.delete(id); },
  };
}

function makeTrainerRepo(seed: Trainer[]): TrainerRepo {
  const map = new Map<string, Trainer>(seed.map((t) => [t.id, t]));
  return {
    nextId: nextId("trainer"),
    async save(t) { map.set(t.id, { ...t }); },
    async getById(id, tid) { const t = map.get(id); return t && t.tenantId === tid ? t : null; },
    async list(tid) { return Array.from(map.values()).filter((t) => t.tenantId === tid); },
    async delete(id) { map.delete(id); },
    async findByAuthUid(authUid, tid) { return Array.from(map.values()).find((t) => t.tenantId === tid && t.authUid === authUid) ?? null; },
  };
}

function makeCommentRepo(): CommentRepo {
  const map = new Map<string, Comment>();
  return {
    nextId: nextId("comment"),
    async save(c) { map.set(c.id, { ...c }); },
    async getById(id, tid) { const c = map.get(id); return c && c.tenantId === tid ? c : null; },
    async listGeneral(assignmentId, tid) {
      return Array.from(map.values()).filter((c) => c.tenantId === tid && c.assignmentId === assignmentId && !c.personId && !c.deleted);
    },
    async listThread(assignmentId, personId, tid) {
      return Array.from(map.values()).filter((c) => c.tenantId === tid && c.assignmentId === assignmentId && c.personId === personId && !c.deleted);
    },
    async listGeneralForAssignments(assignmentIds, tid) {
      return Array.from(map.values()).filter((c) => c.tenantId === tid && assignmentIds.includes(c.assignmentId) && !c.personId && !c.deleted);
    },
    async delete(id) { map.delete(id); },
  };
}

const notifyCalls: { uid: string; title: string }[] = [];
async function fakeNotify(uid: string, input: { title: string }) { notifyCalls.push({ uid, title: input.title }); }

function fakeGroup(id: string, trainerId: string, code = id): Group {
  return { id, tenantId: TENANT, code, status: "active", type: "standart", trainerId, schedule: { startDate: "2026-01-01", days: [1, 3], sessionHours: 3 }, createdAt: new Date().toISOString(), createdBy: "seed" };
}
function fakeAssignment(id: string, groupId: string, trainerId: string): Assignment {
  return { id, tenantId: TENANT, groupId, trainerId, title: "Kitap Kapağı", description: "Kapak tasarla.", status: "published", attachments: [], createdAt: new Date().toISOString(), createdBy: trainerId };
}
function fakePerson(id: string, authUid: string): Person {
  return { id, tenantId: TENANT, firstName: "Ada", lastName: "Öğrenci", authUid, status: "active", consentKVKK: true, createdAt: new Date().toISOString(), createdBy: "seed" };
}
function fakeEnrollment(id: string, personId: string, groupId: string): Enrollment {
  return { id, tenantId: TENANT, personId, groupId, status: "active", createdAt: new Date().toISOString(), createdBy: "seed" };
}
function fakeTrainer(id: string, name: string, authUid?: string): Trainer {
  return { id, tenantId: TENANT, name, email: `${id}@test.com`, branchOffices: [], status: "aktif", competencies: {}, createdAt: new Date().toISOString(), createdBy: "seed", authUid };
}

let passed = 0, failed = 0;
function assert(label: string, ok: boolean) { if (ok) { passed++; console.log(`  ✅ ${label}`); } else { failed++; console.log(`  ❌ ${label}`); } }
async function assertRejects(label: string, fn: () => Promise<unknown>, errType: typeof ForbiddenError | typeof ValidationError) {
  try { await fn(); assert(label, false); } catch (e) { assert(label, e instanceof errType); }
}

function makeDeps(overrides: { groups?: Group[]; assignments?: Assignment[]; persons?: Person[]; enrollments?: Enrollment[]; trainers?: Trainer[] }): CommentDeps {
  return {
    groups: makeGroupRepo(overrides.groups ?? []),
    assignments: makeAssignmentRepo(overrides.assignments ?? []),
    persons: makePersonRepo(overrides.persons ?? []),
    enrollments: makeEnrollmentRepo(overrides.enrollments ?? []),
    comments: makeCommentRepo(),
    trainers: makeTrainerRepo(overrides.trainers ?? []),
    notify: fakeNotify,
  };
}

async function main() {
  console.log("\n=== Ödev Yorumu (Comment) — Faz 3 Assertions ===\n");

  // `trainer-a` (actor.uid, Firebase auth uid) KASITLI OLARAK `trainer-doc-a` (eğitmen
  // kadrosu docId) DEĞİL — ikisi ayrı kimlik uzayı (bkz. can.ts ownerMatches yorumu,
  // 2026-07-11 düzeltmesi). Actor.trainerId ile çözülüyor, Group/Assignment.trainerId
  // hep docId taşıyor.
  const trainerA = makeActor("egitmen", "trainer-a", TENANT, "trainer-doc-a");
  const trainerB = makeActor("egitmen", "trainer-b", TENANT, "trainer-doc-b");
  const operasyon = makeActor("operasyon", "op-1");

  const groupA = fakeGroup("group-a", "trainer-doc-a");
  const assignmentA = fakeAssignment("assignment-a", "group-a", "trainer-doc-a");
  const student = fakePerson("person-1", "student-uid-1");
  const enrollment = fakeEnrollment("enr-1", "person-1", "group-a");
  const trainerRecord = fakeTrainer("trainer-doc-a", "Ayşe Hoca", "trainer-a");

  // ── postGeneralComment (staff) ──
  {
    notifyCalls.length = 0;
    const deps = makeDeps({ groups: [groupA], assignments: [assignmentA], persons: [student], enrollments: [enrollment], trainers: [trainerRecord] });
    const c = await postGeneralComment(trainerA, "assignment-a", "Herkese duyuru!", deps);
    assert("postGeneralComment: sahibi eğitmen yazabilir, isim trainer.name'den gelir", c.authorType === "trainer" && c.authorName === "Ayşe Hoca");
    assert("postGeneralComment: aktif öğrenciye bildirim gider", notifyCalls.some((n) => n.uid === "student-uid-1"));
  }

  await assertRejects(
    "postGeneralComment: başka eğitmen yazamaz — ForbiddenError",
    () => postGeneralComment(trainerB, "assignment-a", "X", makeDeps({ groups: [groupA], assignments: [assignmentA] })),
    ForbiddenError,
  );
  await assertRejects(
    "postGeneralComment: boş metin — ValidationError",
    () => postGeneralComment(trainerA, "assignment-a", "   ", makeDeps({ groups: [groupA], assignments: [assignmentA] })),
    ValidationError,
  );

  // ── postThreadCommentAsStaff ──
  {
    notifyCalls.length = 0;
    const deps = makeDeps({ groups: [groupA], assignments: [assignmentA], persons: [student], trainers: [trainerRecord] });
    const c = await postThreadCommentAsStaff(trainerA, "assignment-a", "person-1", "Kapak güzel olmuş, revize istiyorum.", deps);
    assert("postThreadCommentAsStaff: sahibi eğitmen yazabilir", c.personId === "person-1" && c.authorType === "trainer");
    assert("postThreadCommentAsStaff: öğrenciye bildirim gider", notifyCalls.some((n) => n.uid === "student-uid-1"));
  }
  await assertRejects(
    "postThreadCommentAsStaff: başka eğitmen yazamaz — ForbiddenError",
    () => postThreadCommentAsStaff(trainerB, "assignment-a", "person-1", "X", makeDeps({ groups: [groupA], assignments: [assignmentA] })),
    ForbiddenError,
  );

  // ── Öğrenci: listeleme + thread yazma ──
  {
    const deps = makeDeps({ groups: [groupA], assignments: [assignmentA], persons: [student], enrollments: [enrollment], trainers: [trainerRecord] });
    await postGeneralComment(trainerA, "assignment-a", "Duyuru metni", deps);

    const general = await listGeneralCommentsForStudent("student-uid-1", TENANT, "person-1", "assignment-a", deps);
    assert("listGeneralCommentsForStudent: kayıtlı öğrenci genel duyuruyu görür", general.length === 1);

    notifyCalls.length = 0;
    const threadComment = await postThreadCommentAsStudent("student-uid-1", TENANT, "person-1", "assignment-a", "Merhaba, sorum var.", deps);
    assert("postThreadCommentAsStudent: kendi kimliğiyle yazabilir", threadComment.authorType === "student");
    assert("postThreadCommentAsStudent: eğitmene (group.trainerId) bildirim gider", notifyCalls.some((n) => n.uid === "trainer-a"));

    const thread = await listThreadCommentsForStudent("student-uid-1", TENANT, "person-1", "assignment-a", deps);
    assert("listThreadCommentsForStudent: kendi thread'ini görür", thread.length === 1);
  }

  await assertRejects(
    "listGeneralCommentsForStudent: başka öğrencinin kimliğiyle okunamaz — ForbiddenError",
    () => listGeneralCommentsForStudent("wrong-uid", TENANT, "person-1", "assignment-a", makeDeps({ groups: [groupA], assignments: [assignmentA], persons: [student], enrollments: [enrollment] })),
    ForbiddenError,
  );
  await assertRejects(
    "postThreadCommentAsStudent: gruba kayıtlı olmayan kişi — ValidationError",
    () => postThreadCommentAsStudent("student-uid-1", TENANT, "person-1", "assignment-a", "X", makeDeps({ groups: [groupA], assignments: [assignmentA], persons: [student], enrollments: [] })),
    ValidationError,
  );

  // ── listAnnouncementsForStudent — birden fazla assignment ──
  {
    const groupB = fakeGroup("group-b", "trainer-a", "GRP-B");
    const assignmentB = fakeAssignment("assignment-b", "group-b", "trainer-a");
    const enrollmentB = fakeEnrollment("enr-2", "person-1", "group-b");
    const deps = makeDeps({
      groups: [groupA, groupB], assignments: [assignmentA, assignmentB],
      persons: [student], enrollments: [enrollment, enrollmentB], trainers: [trainerRecord],
    });
    await postGeneralComment(trainerA, "assignment-a", "A duyurusu", deps);
    await postGeneralComment(trainerA, "assignment-b", "B duyurusu", deps);

    const anns = await listAnnouncementsForStudent("student-uid-1", TENANT, "person-1", deps);
    assert("listAnnouncementsForStudent: iki farklı gruptaki duyurular birleşir", anns.length === 2);
  }

  // ── editOwnComment / deleteOwnComment — rol farketmez, sadece sahiplik ──
  {
    const deps = makeDeps({ groups: [groupA], assignments: [assignmentA], persons: [student], enrollments: [enrollment], trainers: [trainerRecord] });
    const studentComment = await postThreadCommentAsStudent("student-uid-1", TENANT, "person-1", "assignment-a", "İlk mesaj", deps);

    await assertRejects(
      "editOwnComment: başkası düzenleyemez — ForbiddenError",
      () => editOwnComment("trainer-a", TENANT, studentComment.id, "Hacklendi", deps),
      ForbiddenError,
    );

    const edited = await editOwnComment("student-uid-1", TENANT, studentComment.id, "Düzeltilmiş mesaj", deps);
    assert("editOwnComment: sahibi düzenleyebilir, editedAt dolar", edited.text === "Düzeltilmiş mesaj" && !!edited.editedAt);

    await deleteOwnComment("student-uid-1", TENANT, studentComment.id, deps);
    const afterDelete = await deps.comments.getById(studentComment.id, TENANT);
    assert("deleteOwnComment: sahibi silebilir, kayıt kalıcı silinir", afterDelete === null);
  }

  // ── listGeneralCommentsForStaff / listThreadCommentsForStaff — assignment.read ile serbest ──
  {
    const deps = makeDeps({ groups: [groupA], assignments: [assignmentA], persons: [student], enrollments: [enrollment], trainers: [trainerRecord] });
    await postGeneralComment(trainerA, "assignment-a", "Genel", deps);
    await postThreadCommentAsStaff(trainerA, "assignment-a", "person-1", "Özel", deps);

    const general = await listGeneralCommentsForStaff(operasyon, "assignment-a", deps);
    assert("listGeneralCommentsForStaff: Operasyon (org-scope) okuyabilir", general.length === 1);
    const thread = await listThreadCommentsForStaff(operasyon, "assignment-a", "person-1", deps);
    assert("listThreadCommentsForStaff: Operasyon (org-scope) okuyabilir", thread.length === 1);
  }

  // ── tenant izolasyonu ──
  {
    const deps = makeDeps({ groups: [groupA], assignments: [assignmentA], persons: [student], enrollments: [enrollment], trainers: [trainerRecord] });
    const c = await postGeneralComment(trainerA, "assignment-a", "Tenant test", deps);
    const crossTenant = await deps.comments.getById(c.id, OTHER_TENANT);
    assert("Tenant izolasyonu: farklı tenant'tan getById → null", crossTenant === null);
  }

  console.log(`\n=== Sonuç: ${passed} geçti, ${failed} başarısız ===\n`);
  if (failed > 0) process.exit(1);
}

main();
