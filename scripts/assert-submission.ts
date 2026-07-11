/**
 * Ödev Teslimi (Submission/UploadSession + Drive) domain — Faz 2 backend assertion'ları.
 * Gerçek Drive network çağrısı YAPILMAZ — fake `DriveDeps` enjekte edilir.
 * npx jiti scripts/assert-submission.ts
 */
import { resolvePackages } from "../src/app/lib/domain/access/packages";
import type { Actor } from "../src/app/lib/domain/access/types";
import type { Assignment } from "../src/app/lib/domain/core/assignment";
import type { Enrollment } from "../src/app/lib/domain/core/enrollment";
import type { Group } from "../src/app/lib/domain/core/group";
import type { Person } from "../src/app/lib/domain/core/person";
import type { Submission, SubmissionFile, UploadSession } from "../src/app/lib/domain/core/submission";
import type { AssignmentRepo } from "../src/app/lib/domain/repo/assignment-repo";
import type { DriveDeps } from "../src/app/lib/domain/repo/drive-deps";
import type { EnrollmentRepo } from "../src/app/lib/domain/repo/enrollment-repo";
import type { GroupRepo } from "../src/app/lib/domain/repo/group-repo";
import type { PersonRepo } from "../src/app/lib/domain/repo/person-repo";
import type { SubmissionFileRepo } from "../src/app/lib/domain/repo/submission-file-repo";
import type { SubmissionRepo } from "../src/app/lib/domain/repo/submission-repo";
import type { TrainerRepo } from "../src/app/lib/domain/repo/trainer-repo";
import type { UploadSessionRepo } from "../src/app/lib/domain/repo/upload-session-repo";
import {
  initUpload,
  completeUpload,
  deleteFile,
  retract,
  updateSubmissionStatus,
  gradeSubmission,
  computeOdevYuzdeleri,
  combineOdevYuzdesi,
  type SubmissionDeps,
} from "../src/app/lib/domain/services/submission-service";
import { ForbiddenError, ValidationError } from "../src/app/lib/domain/errors";

const TENANT = "test-tenant";
const OTHER_TENANT = "other-tenant";

function makeActor(pkg: "egitmen" | "operasyon" | "admin", uid: string, tenantId = TENANT): Actor {
  return { type: "human", uid, tenantId, grants: resolvePackages([pkg]) };
}

let idCounter = 0;
function nextId(prefix: string) {
  return () => `${prefix}-${++idCounter}`;
}

function makeGroupRepo(seed: Group[]): GroupRepo {
  const map = new Map<string, Group>(seed.map((g) => [g.id, g]));
  return {
    nextId: nextId("group"),
    async save(g) { map.set(g.id, { ...g }); },
    async getById(id, tenantId) { const g = map.get(id); return g && g.tenantId === tenantId ? g : null; },
    async list(tenantId, trainerId) {
      return Array.from(map.values()).filter((g) => g.tenantId === tenantId && (!trainerId || g.trainerId === trainerId));
    },
    async delete(id) { map.delete(id); },
  };
}

function makeTrainerRepo(): TrainerRepo {
  return {
    nextId: nextId("trainer"),
    async save() {},
    async getById() { return null; }, // testlerde eğitmen adı önemsiz — klasör yolu ölçülmüyor
    async list() { return []; },
    async delete() {},
    async findByAuthUid() { return null; },
  };
}

function makeAssignmentRepo(seed: Assignment[]): AssignmentRepo {
  const map = new Map<string, Assignment>(seed.map((a) => [a.id, a]));
  return {
    nextId: nextId("assignment"),
    async save(a) { map.set(a.id, { ...a }); },
    async getById(id, tenantId) { const a = map.get(id); return a && a.tenantId === tenantId ? a : null; },
    async list(tenantId, groupId) {
      return Array.from(map.values()).filter((a) => a.tenantId === tenantId && (!groupId || a.groupId === groupId));
    },
    async delete(id) { map.delete(id); },
  };
}

function makePersonRepo(seed: Person[]): PersonRepo {
  const map = new Map<string, Person>(seed.map((p) => [p.id, p]));
  return {
    nextId: nextId("person"),
    async save(p) { map.set(p.id, { ...p }); },
    async getById(id, tenantId) { const p = map.get(id); return p && p.tenantId === tenantId ? p : null; },
    async getByIds(ids, tenantId) { return ids.map((id) => map.get(id)).filter((p): p is Person => !!p && p.tenantId === tenantId); },
    async findByIdNo() { return null; },
    async findByAuthUid(authUid, tenantId) {
      return Array.from(map.values()).find((p) => p.tenantId === tenantId && p.authUid === authUid) ?? null;
    },
    async list(tenantId) { return Array.from(map.values()).filter((p) => p.tenantId === tenantId); },
    async update(id, tenantId, data) { const p = map.get(id); if (p && p.tenantId === tenantId) map.set(id, { ...p, ...data }); },
    async clearAuthUid(id, tenantId) { const p = map.get(id); if (p && p.tenantId === tenantId) map.set(id, { ...p, authUid: undefined }); },
    async delete(id, tenantId) { const p = map.get(id); if (p && p.tenantId === tenantId) map.delete(id); },
  };
}

function makeEnrollmentRepo(seed: Enrollment[]): EnrollmentRepo {
  const map = new Map<string, Enrollment>(seed.map((e) => [e.id, e]));
  return {
    nextId: nextId("enrollment"),
    async save(e) { map.set(e.id, { ...e }); },
    async getById(id, tenantId) { const e = map.get(id); return e && e.tenantId === tenantId ? e : null; },
    async findActive(personId, groupId, tenantId) {
      return Array.from(map.values()).find((e) => e.tenantId === tenantId && e.personId === personId && e.groupId === groupId && e.status === "active") ?? null;
    },
    async list(tenantId) { return Array.from(map.values()).filter((e) => e.tenantId === tenantId); },
    async listByGroup(groupId, tenantId) { return Array.from(map.values()).filter((e) => e.tenantId === tenantId && e.groupId === groupId); },
    async listBySale(saleId, tenantId) { return Array.from(map.values()).filter((e) => e.tenantId === tenantId && e.saleId === saleId); },
    async listByPerson(personId, tenantId) { return Array.from(map.values()).filter((e) => e.tenantId === tenantId && e.personId === personId); },
    async delete(id, tenantId) { const e = map.get(id); if (e && e.tenantId === tenantId) map.delete(id); },
  };
}

function makeSubmissionRepo(): SubmissionRepo {
  const map = new Map<string, Submission>();
  return {
    nextId: nextId("submission"),
    async save(s) { map.set(s.id, { ...s }); },
    async getById(id, tenantId) { const s = map.get(id); return s && s.tenantId === tenantId ? s : null; },
    async findByAssignmentAndPerson(assignmentId, personId, tenantId) {
      return Array.from(map.values()).find((s) => s.tenantId === tenantId && s.assignmentId === assignmentId && s.personId === personId) ?? null;
    },
    async listByAssignment(assignmentId, tenantId) { return Array.from(map.values()).filter((s) => s.tenantId === tenantId && s.assignmentId === assignmentId); },
    async listByGroup(groupId, tenantId) { return Array.from(map.values()).filter((s) => s.tenantId === tenantId && s.groupId === groupId); },
  };
}

function makeSubmissionFileRepo(): SubmissionFileRepo {
  const map = new Map<string, SubmissionFile>();
  return {
    nextId: nextId("file"),
    async save(f) { map.set(f.id, { ...f }); },
    async getById(id, tenantId) { const f = map.get(id); return f && f.tenantId === tenantId ? f : null; },
    async listActiveBySubmission(submissionId, tenantId) {
      return Array.from(map.values()).filter((f) => f.tenantId === tenantId && f.submissionId === submissionId && !f.deleted);
    },
    async getLatest(submissionId, tenantId) {
      return Array.from(map.values()).find((f) => f.tenantId === tenantId && f.submissionId === submissionId && f.isLatest) ?? null;
    },
  };
}

function makeUploadSessionRepo(): UploadSessionRepo {
  const map = new Map<string, UploadSession>();
  return {
    nextId: nextId("session"),
    async save(s) { map.set(s.id, { ...s }); },
    async getById(id, tenantId) { const s = map.get(id); return s && s.tenantId === tenantId ? s : null; },
  };
}

let driveDeleteCalls = 0;
function makeFakeDrive(): DriveDeps {
  return {
    async ensureFolderPath(segments) { return `folder-${segments.join("/")}`; },
    async initResumableSession(actualFileName) { return `https://fake-drive.example/session/${actualFileName}`; },
    async setPublicReadPermission() { /* no-op */ },
    async findFileByActualName(actualFileName) { return { id: `drive-${actualFileName}` }; },
    async deleteFromDrive() { driveDeleteCalls++; },
  };
}

function fakeGroup(id: string, trainerId: string, code = id): Group {
  return {
    id, tenantId: TENANT, code, status: "active", type: "standart", trainerId,
    schedule: { startDate: "2026-01-01", days: [1, 3], sessionHours: 3 },
    createdAt: new Date().toISOString(), createdBy: "seed",
  };
}

function fakeAssignment(id: string, groupId: string, trainerId: string, dueDate?: string): Assignment {
  return {
    id, tenantId: TENANT, groupId, trainerId, title: "Kitap Kapağı Tasarımı", description: "Kapak tasarla.",
    dueDate, status: "published", attachments: [],
    createdAt: new Date().toISOString(), createdBy: trainerId,
  };
}

function fakePerson(id: string, authUid: string): Person {
  return {
    id, tenantId: TENANT, firstName: "Ada", lastName: "Öğrenci", authUid,
    status: "active", consentKVKK: true,
    createdAt: new Date().toISOString(), createdBy: "seed",
  };
}

function fakeEnrollment(id: string, personId: string, groupId: string): Enrollment {
  return {
    id, tenantId: TENANT, personId, groupId, status: "active",
    createdAt: new Date().toISOString(), createdBy: "seed",
  };
}

let passed = 0;
let failed = 0;
function assert(label: string, ok: boolean) {
  if (ok) { passed++; console.log(`  ✅ ${label}`); }
  else { failed++; console.log(`  ❌ ${label}`); }
}
async function assertRejects(label: string, fn: () => Promise<unknown>, errType: typeof ForbiddenError | typeof ValidationError) {
  try {
    await fn();
    assert(label, false);
  } catch (e) {
    assert(label, e instanceof errType);
  }
}

function makeDeps(overrides: {
  groups?: Group[]; assignments?: Assignment[]; persons?: Person[]; enrollments?: Enrollment[];
}): SubmissionDeps {
  return {
    groups: makeGroupRepo(overrides.groups ?? []),
    assignments: makeAssignmentRepo(overrides.assignments ?? []),
    persons: makePersonRepo(overrides.persons ?? []),
    enrollments: makeEnrollmentRepo(overrides.enrollments ?? []),
    submissions: makeSubmissionRepo(),
    submissionFiles: makeSubmissionFileRepo(),
    uploadSessions: makeUploadSessionRepo(),
    trainers: makeTrainerRepo(),
    drive: makeFakeDrive(),
    notify: async () => {},
  };
}

async function main() {
  console.log("\n=== Ödev Teslimi (Submission/UploadSession) — Faz 2 Assertions ===\n");

  const trainerA = makeActor("egitmen", "trainer-a");
  const trainerB = makeActor("egitmen", "trainer-b");
  const operasyon = makeActor("operasyon", "op-1");
  const admin = makeActor("admin", "admin-1");

  const groupA = fakeGroup("group-a", "trainer-a");
  const assignmentA = fakeAssignment("assignment-a", "group-a", "trainer-a");
  const student = fakePerson("person-1", "student-uid-1");
  const enrollment = fakeEnrollment("enr-1", "person-1", "group-a");

  // ── initUpload ──
  {
    const deps = makeDeps({ groups: [groupA], assignments: [assignmentA], persons: [student], enrollments: [enrollment] });
    const result = await initUpload(
      { requesterUid: "student-uid-1", tenantId: TENANT, personId: "person-1", assignmentId: "assignment-a", fileName: "kapak.pdf", fileSize: 1024, mimeType: "application/pdf" },
      deps,
    );
    assert("initUpload: sahibi öğrenci başlatabilir", result.session.uploaderUid === "student-uid-1" && result.currentUploads === 0 && result.maxUploads === 5);
  }

  await assertRejects(
    "initUpload: başka öğrencinin kimliğiyle başlatılamaz — ForbiddenError",
    () => initUpload(
      { requesterUid: "wrong-uid", tenantId: TENANT, personId: "person-1", assignmentId: "assignment-a", fileName: "kapak.pdf", fileSize: 1024, mimeType: "application/pdf" },
      makeDeps({ groups: [groupA], assignments: [assignmentA], persons: [student], enrollments: [enrollment] }),
    ),
    ForbiddenError,
  );

  await assertRejects(
    "initUpload: gruba kayıtlı olmayan kişi — ValidationError",
    () => initUpload(
      { requesterUid: "student-uid-1", tenantId: TENANT, personId: "person-1", assignmentId: "assignment-a", fileName: "kapak.pdf", fileSize: 1024, mimeType: "application/pdf" },
      makeDeps({ groups: [groupA], assignments: [assignmentA], persons: [student], enrollments: [] }),
    ),
    ValidationError,
  );

  await assertRejects(
    "initUpload: dosya boyutu limiti aşıyor — ValidationError",
    () => initUpload(
      { requesterUid: "student-uid-1", tenantId: TENANT, personId: "person-1", assignmentId: "assignment-a", fileName: "kapak.pdf", fileSize: 300 * 1024 * 1024, mimeType: "application/pdf" },
      makeDeps({ groups: [groupA], assignments: [assignmentA], persons: [student], enrollments: [enrollment] }),
    ),
    ValidationError,
  );

  await assertRejects(
    "initUpload: izin verilmeyen MIME türü — ValidationError",
    () => initUpload(
      { requesterUid: "student-uid-1", tenantId: TENANT, personId: "person-1", assignmentId: "assignment-a", fileName: "virus.exe", fileSize: 1024, mimeType: "application/x-msdownload" },
      makeDeps({ groups: [groupA], assignments: [assignmentA], persons: [student], enrollments: [enrollment] }),
    ),
    ValidationError,
  );

  // ── completeUpload: submission + file oluşur, iterasyon artar ──
  {
    const deps = makeDeps({ groups: [groupA], assignments: [assignmentA], persons: [student], enrollments: [enrollment] });
    const { session } = await initUpload(
      { requesterUid: "student-uid-1", tenantId: TENANT, personId: "person-1", assignmentId: "assignment-a", fileName: "kapak.pdf", fileSize: 1024, mimeType: "application/pdf" },
      deps,
    );
    const submission = await completeUpload({ requesterUid: "student-uid-1", tenantId: TENANT, uploadId: session.id }, deps);
    assert("completeUpload: ilk yüklemede submission oluşur (submitted, iterasyon 1)", submission.status === "submitted" && submission.iteration === 1);

    const files = await deps.submissionFiles.listActiveBySubmission(submission.id, TENANT);
    assert("completeUpload: SubmissionFile yazılır, isLatest=true", files.length === 1 && files[0].isLatest);

    // ── revizyon sonrası ikinci yükleme → iterasyon artar, status submitted'a döner ──
    await updateSubmissionStatus(trainerA, submission.id, "revision", deps);
    const { session: session2 } = await initUpload(
      { requesterUid: "student-uid-1", tenantId: TENANT, personId: "person-1", assignmentId: "assignment-a", fileName: "kapak-v2.pdf", fileSize: 1024, mimeType: "application/pdf" },
      deps,
    );
    const resubmitted = await completeUpload({ requesterUid: "student-uid-1", tenantId: TENANT, uploadId: session2.id }, deps);
    assert("completeUpload: revizyon sonrası iterasyon artar + status submitted'a döner", resubmitted.iteration === 2 && resubmitted.status === "submitted");

    const activeFiles = await deps.submissionFiles.listActiveBySubmission(submission.id, TENANT);
    assert("completeUpload: eski dosya isLatest=false olur, yenisi isLatest=true", activeFiles.length === 2 && activeFiles.filter((f) => f.isLatest).length === 1);

    // ── deleteFile ──
    const latest = activeFiles.find((f) => f.isLatest)!;
    await deleteFile({ requesterUid: "student-uid-1", tenantId: TENANT, submissionId: submission.id, fileId: latest.id }, deps);
    const afterDelete = await deps.submissionFiles.listActiveBySubmission(submission.id, TENANT);
    assert("deleteFile: silinen dosya aktif listeden çıkar, önceki versiyon isLatest olur", afterDelete.length === 1 && afterDelete[0].isLatest && driveDeleteCalls >= 1);

    // ── gradeSubmission + status.write yetki kontrolü ──
    await assertRejects(
      "gradeSubmission: başka eğitmen notlandıramaz — ForbiddenError",
      () => gradeSubmission(trainerB, submission.id, 90, deps),
      ForbiddenError,
    );
    const graded = await gradeSubmission(trainerA, submission.id, 95, deps);
    assert("gradeSubmission: sahibi eğitmen notlandırabilir", graded.grade === 95 && graded.gradedBy === "trainer-a");

    const completed = await updateSubmissionStatus(trainerA, submission.id, "completed", deps);
    assert("updateSubmissionStatus: eğitmen kendi grubunu completed'a çekebilir", completed.status === "completed");

    await assertRejects(
      "initUpload: completed submission'da yükleme hakkı kalmaz — ValidationError",
      () => initUpload(
        { requesterUid: "student-uid-1", tenantId: TENANT, personId: "person-1", assignmentId: "assignment-a", fileName: "gec.pdf", fileSize: 1024, mimeType: "application/pdf" },
        deps,
      ),
      ValidationError,
    );
  }

  // ── org-scope (Operasyon/Admin) herhangi bir grubun teslimini notlandırabilir/durum değiştirebilir ──
  {
    const deps = makeDeps({ groups: [groupA], assignments: [assignmentA], persons: [student], enrollments: [enrollment] });
    const { session } = await initUpload(
      { requesterUid: "student-uid-1", tenantId: TENANT, personId: "person-1", assignmentId: "assignment-a", fileName: "kapak.pdf", fileSize: 1024, mimeType: "application/pdf" },
      deps,
    );
    const submission = await completeUpload({ requesterUid: "student-uid-1", tenantId: TENANT, uploadId: session.id }, deps);

    const viaOp = await updateSubmissionStatus(operasyon, submission.id, "reviewing", deps);
    assert("updateSubmissionStatus: Operasyon (org-scope) her gruba müdahale edebilir", viaOp.status === "reviewing");
    const gradedByAdmin = await gradeSubmission(admin, submission.id, 80, deps);
    assert("gradeSubmission: Admin (org-scope) her grubu notlandırabilir", gradedByAdmin.grade === 80);
  }

  await assertRejects("gradeSubmission: 0-100 aralığı dışı — ValidationError", async () => {
    const deps = makeDeps({ groups: [groupA] });
    const fakeSub: Submission = {
      id: "sub-x", tenantId: TENANT, assignmentId: "assignment-a", groupId: "group-a", personId: "person-1",
      status: "submitted", iteration: 1, isLate: false, submittedAt: new Date().toISOString(), lastSubmittedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(), createdBy: "seed",
    };
    await deps.submissions.save(fakeSub);
    return gradeSubmission(trainerA, "sub-x", 150, deps);
  }, ValidationError);

  // ── retract ──
  {
    const deps = makeDeps({ groups: [groupA], assignments: [assignmentA], persons: [student], enrollments: [enrollment] });
    const { session } = await initUpload(
      { requesterUid: "student-uid-1", tenantId: TENANT, personId: "person-1", assignmentId: "assignment-a", fileName: "kapak.pdf", fileSize: 1024, mimeType: "application/pdf" },
      deps,
    );
    const submission = await completeUpload({ requesterUid: "student-uid-1", tenantId: TENANT, uploadId: session.id }, deps);

    await retract({ requesterUid: "student-uid-1", tenantId: TENANT, submissionId: submission.id }, deps);
    const afterRetract = await deps.submissions.getById(submission.id, TENANT);
    assert("retract: status retracted olur, retractedAt dolar", afterRetract?.status === "retracted" && !!afterRetract?.retractedAt);

    const filesAfterRetract = await deps.submissionFiles.listActiveBySubmission(submission.id, TENANT);
    assert("retract: aktif dosyalar soft-delete edilir", filesAfterRetract.length === 0);

    // yeniden yükleme döngüsü normal başlar (retracted → submitted)
    const { session: session2 } = await initUpload(
      { requesterUid: "student-uid-1", tenantId: TENANT, personId: "person-1", assignmentId: "assignment-a", fileName: "kapak-yeni.pdf", fileSize: 1024, mimeType: "application/pdf" },
      deps,
    );
    const resubmitted = await completeUpload({ requesterUid: "student-uid-1", tenantId: TENANT, uploadId: session2.id }, deps);
    assert("retract sonrası yeniden yükleme: status submitted'a döner", resubmitted.status === "submitted");
  }

  await assertRejects(
    "retract: notlandırılmış teslim geri çekilemez — ValidationError",
    async () => {
      const deps = makeDeps({ groups: [groupA], assignments: [assignmentA], persons: [student], enrollments: [enrollment] });
      const { session } = await initUpload(
        { requesterUid: "student-uid-1", tenantId: TENANT, personId: "person-1", assignmentId: "assignment-a", fileName: "kapak.pdf", fileSize: 1024, mimeType: "application/pdf" },
        deps,
      );
      const submission = await completeUpload({ requesterUid: "student-uid-1", tenantId: TENANT, uploadId: session.id }, deps);
      await gradeSubmission(trainerA, submission.id, 70, deps);
      return retract({ requesterUid: "student-uid-1", tenantId: TENANT, submissionId: submission.id }, deps);
    },
    ValidationError,
  );

  await assertRejects(
    "retract: son teslim tarihi geçmiş ödevde geri çekilemez — ValidationError",
    async () => {
      const pastAssignment = fakeAssignment("assignment-past", "group-a", "trainer-a", "2020-01-01T00:00:00.000Z");
      const deps = makeDeps({ groups: [groupA], assignments: [pastAssignment], persons: [student], enrollments: [enrollment] });
      const { session } = await initUpload(
        { requesterUid: "student-uid-1", tenantId: TENANT, personId: "person-1", assignmentId: "assignment-past", fileName: "kapak.pdf", fileSize: 1024, mimeType: "application/pdf" },
        deps,
      );
      const submission = await completeUpload({ requesterUid: "student-uid-1", tenantId: TENANT, uploadId: session.id }, deps);
      return retract({ requesterUid: "student-uid-1", tenantId: TENANT, submissionId: submission.id }, deps);
    },
    ValidationError,
  );

  // ── tenant izolasyonu ──
  {
    const deps = makeDeps({ groups: [groupA], assignments: [assignmentA], persons: [student], enrollments: [enrollment] });
    const { session } = await initUpload(
      { requesterUid: "student-uid-1", tenantId: TENANT, personId: "person-1", assignmentId: "assignment-a", fileName: "kapak.pdf", fileSize: 1024, mimeType: "application/pdf" },
      deps,
    );
    const submission = await completeUpload({ requesterUid: "student-uid-1", tenantId: TENANT, uploadId: session.id }, deps);
    const crossTenant = await deps.submissions.getById(submission.id, OTHER_TENANT);
    assert("Tenant izolasyonu: farklı tenant'tan getById → null", crossTenant === null);
  }

  // ── maxPuan'a göre notlandırma sınırı (2026-07-06 kararı: ödevler farklı ağırlıkta) ──
  await assertRejects("gradeSubmission: 200 puanlık ödevde 250 girilemez — ValidationError", async () => {
    const heavyAssignment: Assignment = { ...assignmentA, id: "assignment-heavy", maxPuan: 200 };
    const deps = makeDeps({ groups: [groupA], assignments: [heavyAssignment], persons: [student], enrollments: [enrollment] });
    const { session } = await initUpload(
      { requesterUid: "student-uid-1", tenantId: TENANT, personId: "person-1", assignmentId: "assignment-heavy", fileName: "kapak.pdf", fileSize: 1024, mimeType: "application/pdf" },
      deps,
    );
    const submission = await completeUpload({ requesterUid: "student-uid-1", tenantId: TENANT, uploadId: session.id }, deps);
    return gradeSubmission(trainerA, submission.id, 250, deps);
  }, ValidationError);

  {
    const heavyAssignment: Assignment = { ...assignmentA, id: "assignment-heavy2", maxPuan: 200 };
    const deps = makeDeps({ groups: [groupA], assignments: [heavyAssignment], persons: [student], enrollments: [enrollment] });
    const { session } = await initUpload(
      { requesterUid: "student-uid-1", tenantId: TENANT, personId: "person-1", assignmentId: "assignment-heavy2", fileName: "kapak.pdf", fileSize: 1024, mimeType: "application/pdf" },
      deps,
    );
    const submission = await completeUpload({ requesterUid: "student-uid-1", tenantId: TENANT, uploadId: session.id }, deps);
    const graded = await gradeSubmission(trainerA, submission.id, 180, deps);
    assert("gradeSubmission: 200 puanlık ödevde 180 girilebilir", graded.grade === 180);
  }

  // ── computeOdevYuzdeleri — Ödev Notu ANLIK hesaplama (manuel giriş YOK) ──
  {
    const assignment100 = fakeAssignment("hw-100", "group-odev", "trainer-a");
    assignment100.maxPuan = 100;
    const assignment200: Assignment = { ...assignment100, id: "hw-200", maxPuan: 200 };
    const groupOdev = fakeGroup("group-odev", "trainer-a");
    const deps = makeDeps({ groups: [groupOdev], assignments: [assignment100, assignment200], persons: [student], enrollments: [fakeEnrollment("enr-odev", "person-1", "group-odev")] });

    const { session: s1 } = await initUpload({ requesterUid: "student-uid-1", tenantId: TENANT, personId: "person-1", assignmentId: "hw-100", fileName: "a.pdf", fileSize: 1, mimeType: "application/pdf" }, deps);
    const sub1 = await completeUpload({ requesterUid: "student-uid-1", tenantId: TENANT, uploadId: s1.id }, deps);
    await gradeSubmission(trainerA, sub1.id, 50, deps);

    const { session: s2 } = await initUpload({ requesterUid: "student-uid-1", tenantId: TENANT, personId: "person-1", assignmentId: "hw-200", fileName: "b.pdf", fileSize: 1, mimeType: "application/pdf" }, deps);
    const sub2 = await completeUpload({ requesterUid: "student-uid-1", tenantId: TENANT, uploadId: s2.id }, deps);
    await gradeSubmission(trainerA, sub2.id, 150, deps);

    const result = await computeOdevYuzdeleri(TENANT, "group-odev", deps);
    assert("computeOdevYuzdeleri: normal kategori toplam maxPuan = 300 (100+200, kind belirtilmemiş → normal)", result.normal.totalMaxPuan === 300);
    assert("computeOdevYuzdeleri: normal kategori kazanılan toplam = 200 (50+150)", result.normal.earnedByPerson["person-1"] === 200);
    assert("computeOdevYuzdeleri: proje kategorisi boş", result.proje.totalMaxPuan === 0);
    const percent = combineOdevYuzdesi(result, "person-1");
    assert("combineOdevYuzdesi: sadece normal varsa %100 ağırlığı alır (200/300=%67)", percent === 67);
  }

  // ── computeOdevYuzdeleri — grupta hiç yayınlanmış ödev yoksa her iki kategori de boş (veri yok) ──
  {
    const groupBos = fakeGroup("group-bos", "trainer-a");
    const deps = makeDeps({ groups: [groupBos], assignments: [], persons: [], enrollments: [] });
    const result = await computeOdevYuzdeleri(TENANT, "group-bos", deps);
    assert("computeOdevYuzdeleri: ödev yoksa normal.totalMaxPuan=0", result.normal.totalMaxPuan === 0);
    assert("computeOdevYuzdeleri: ödev yoksa proje.totalMaxPuan=0", result.proje.totalMaxPuan === 0);
    assert("combineOdevYuzdesi: hiç ödev yoksa null (veri yok)", combineOdevYuzdesi(result, "person-1") === null);
  }

  // ── computeOdevYuzdeleri — notlanmamış/taslak ödev paydaya girmez ──
  {
    const published = fakeAssignment("hw-pub", "group-karisik", "trainer-a");
    const draft: Assignment = { ...published, id: "hw-draft", status: "draft", maxPuan: 500 };
    const groupKarisik = fakeGroup("group-karisik", "trainer-a");
    const deps = makeDeps({ groups: [groupKarisik], assignments: [published, draft], persons: [student], enrollments: [fakeEnrollment("enr-karisik", "person-1", "group-karisik")] });
    const result = await computeOdevYuzdeleri(TENANT, "group-karisik", deps);
    assert("computeOdevYuzdeleri: taslak ödev paydaya girmez (sadece published'ın 100'ü)", result.normal.totalMaxPuan === 100);
  }

  // ── Ödev Notu İÇ ağırlıklandırması — normal %30 + proje %70 (2026-07-06 kararı) ──
  {
    const normalOdev = fakeAssignment("hw-normal", "group-agirlik", "trainer-a");
    normalOdev.maxPuan = 100;
    normalOdev.kind = "normal";
    const projeOdev: Assignment = { ...normalOdev, id: "hw-proje", maxPuan: 100, kind: "proje" };
    const groupAgirlik = fakeGroup("group-agirlik", "trainer-a");
    const deps = makeDeps({ groups: [groupAgirlik], assignments: [normalOdev, projeOdev], persons: [student], enrollments: [fakeEnrollment("enr-agirlik", "person-1", "group-agirlik")] });

    const { session: sN } = await initUpload({ requesterUid: "student-uid-1", tenantId: TENANT, personId: "person-1", assignmentId: "hw-normal", fileName: "n.pdf", fileSize: 1, mimeType: "application/pdf" }, deps);
    const subN = await completeUpload({ requesterUid: "student-uid-1", tenantId: TENANT, uploadId: sN.id }, deps);
    await gradeSubmission(trainerA, subN.id, 100, deps); // normal: %100

    const { session: sP } = await initUpload({ requesterUid: "student-uid-1", tenantId: TENANT, personId: "person-1", assignmentId: "hw-proje", fileName: "p.pdf", fileSize: 1, mimeType: "application/pdf" }, deps);
    const subP = await completeUpload({ requesterUid: "student-uid-1", tenantId: TENANT, uploadId: sP.id }, deps);
    await gradeSubmission(trainerA, subP.id, 50, deps); // proje: %50

    const result = await computeOdevYuzdeleri(TENANT, "group-agirlik", deps);
    const percent = combineOdevYuzdesi(result, "person-1");
    // normal %100 × 0.30 + proje %50 × 0.70 = 30 + 35 = 65
    assert("combineOdevYuzdesi: normal %100 + proje %50 → ağırlıklı %65", percent === 65);
  }

  // ── Ödev Notu İÇ ağırlıklandırması — proje kategorisi hiç yoksa ağırlık tamamen normale kayar ──
  {
    const normalOdev = fakeAssignment("hw-solo-normal", "group-tekkategori", "trainer-a");
    normalOdev.maxPuan = 100;
    normalOdev.kind = "normal";
    const groupTek = fakeGroup("group-tekkategori", "trainer-a");
    const deps = makeDeps({ groups: [groupTek], assignments: [normalOdev], persons: [student], enrollments: [fakeEnrollment("enr-tek", "person-1", "group-tekkategori")] });

    const { session } = await initUpload({ requesterUid: "student-uid-1", tenantId: TENANT, personId: "person-1", assignmentId: "hw-solo-normal", fileName: "s.pdf", fileSize: 1, mimeType: "application/pdf" }, deps);
    const sub = await completeUpload({ requesterUid: "student-uid-1", tenantId: TENANT, uploadId: session.id }, deps);
    await gradeSubmission(trainerA, sub.id, 80, deps);

    const result = await computeOdevYuzdeleri(TENANT, "group-tekkategori", deps);
    const percent = combineOdevYuzdesi(result, "person-1");
    assert("combineOdevYuzdesi: proje yoksa ağırlık tamamen normale kayar (%80 direkt)", percent === 80);
  }

  console.log(`\n=== Sonuç: ${passed} geçti, ${failed} başarısız ===\n`);
  if (failed > 0) process.exit(1);
}

main();
