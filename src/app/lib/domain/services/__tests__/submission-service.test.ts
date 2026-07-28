import { describe, it, expect, vi } from "vitest";
import {
  getMaxUploads, computeOdevYuzdeleri, combineOdevYuzdesi,
  retract, updateSubmissionStatus, gradeSubmission, gradeManually,
  ODEV_TUR_AGIRLIK, type OdevYuzdeleriResult,
} from "../submission-service";
import { ForbiddenError, ValidationError } from "../../errors";
import type { Actor, Grant } from "../../access/types";
import type { Assignment } from "../../core/assignment";
import type { Submission } from "../../core/submission";
import type { Group } from "../../core/group";
import type { AssignmentRepo } from "../../repo/assignment-repo";
import type { SubmissionRepo } from "../../repo/submission-repo";
import type { SubmissionFileRepo } from "../../repo/submission-file-repo";
import type { GroupRepo } from "../../repo/group-repo";
import type { PersonRepo } from "../../repo/person-repo";
import type { ActivityLogRepo } from "../../repo/activity-log-repo";
import type { Person } from "../../core/person";

const TENANT = "tenant-1";
const GROUP_ID = "group-1";
const TRAINER_UID = "trainer-1";

function makeActor(grants: Grant[], overrides: Partial<Actor> = {}): Actor {
  return { type: "human", uid: "user-1", tenantId: TENANT, grants, ...overrides };
}
function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: GROUP_ID, tenantId: TENANT, code: "GRP-1", trainerId: TRAINER_UID,
    type: "standart", status: "active", schedule: { startDate: "2026-01-01", days: [1], sessionHours: 3 },
    createdAt: "2026-01-01T00:00:00.000Z", createdBy: "system", ...overrides,
  } as Group;
}
function makeSub(overrides: Partial<Submission> = {}): Submission {
  return {
    id: "sub-1", tenantId: TENANT, assignmentId: "a1", groupId: GROUP_ID, personId: "p1",
    status: "submitted", iteration: 1, isLate: false, submittedAt: "2026-07-01T00:00:00.000Z",
    lastSubmittedAt: "2026-07-01T00:00:00.000Z", createdAt: "2026-07-01T00:00:00.000Z", createdBy: "p1",
    ...overrides,
  } as Submission;
}
function makeAssignment2(overrides: Partial<Assignment> = {}): Assignment {
  return {
    id: "a1", tenantId: TENANT, groupId: GROUP_ID, title: "Ödev", status: "published",
    maxPuan: 100, createdAt: "2026-01-01T00:00:00.000Z", createdBy: TRAINER_UID, ...overrides,
  } as Assignment;
}

describe("submission-service :: getMaxUploads", () => {
  it("completed durumunda 0 (kilitli) döner", () => {
    expect(getMaxUploads("completed")).toBe(0);
  });
  it("revision durumunda 8 (5 temel + 3 revizyon) döner", () => {
    expect(getMaxUploads("revision")).toBe(8);
  });
  it("diğer durumlarda (submitted/null) 5 döner", () => {
    expect(getMaxUploads(null)).toBe(5);
    expect(getMaxUploads("submitted")).toBe(5);
  });
});

describe("submission-service :: combineOdevYuzdesi", () => {
  it("her iki kategori de boşsa (veri yok) null döner", () => {
    const result: OdevYuzdeleriResult = { normal: { totalMaxPuan: 0, earnedByPerson: {} }, proje: { totalMaxPuan: 0, earnedByPerson: {} } };
    expect(combineOdevYuzdesi(result, "p1")).toBeNull();
  });

  it("sadece normal kategori varsa (bugünkü GERÇEK durum — proje hesaba hiç girmiyor) doğrudan normal yüzdesi döner, ağırlık uygulanmaz", () => {
    const result: OdevYuzdeleriResult = {
      normal: { totalMaxPuan: 200, earnedByPerson: { p1: 150 } },
      proje: { totalMaxPuan: 0, earnedByPerson: {} },
    };
    // 150/200 = %75 — ODEV_TUR_AGIRLIK.normal (30) ile ÇARPILMAZ, tek kategori kendi başına %100 ağırlıklı.
    expect(combineOdevYuzdesi(result, "p1")).toBe(75);
  });

  it("sadece proje kategorisi varsa doğrudan proje yüzdesi döner", () => {
    const result: OdevYuzdeleriResult = {
      normal: { totalMaxPuan: 0, earnedByPerson: {} },
      proje: { totalMaxPuan: 100, earnedByPerson: { p1: 90 } },
    };
    expect(combineOdevYuzdesi(result, "p1")).toBe(90);
  });

  it("her iki kategori de doluysa normal(%30)+proje(%70) ağırlıklı ortalama alınır", () => {
    expect(ODEV_TUR_AGIRLIK).toEqual({ normal: 30, proje: 70 });
    const result: OdevYuzdeleriResult = {
      normal: { totalMaxPuan: 100, earnedByPerson: { p1: 100 } }, // %100
      proje: { totalMaxPuan: 100, earnedByPerson: { p1: 50 } },   // %50
    };
    // 1.00*30 + 0.50*70 = 30 + 35 = 65
    expect(combineOdevYuzdesi(result, "p1")).toBe(65);
  });

  it("kişinin hiç puanı yoksa (earnedByPerson'da yok) 0 puan varsayılır", () => {
    const result: OdevYuzdeleriResult = { normal: { totalMaxPuan: 100, earnedByPerson: {} }, proje: { totalMaxPuan: 0, earnedByPerson: {} } };
    expect(combineOdevYuzdesi(result, "hic-teslim-etmedi")).toBe(0);
  });
});

describe("submission-service :: computeOdevYuzdeleri", () => {
  function makeAssignment(overrides: Partial<Assignment> = {}): Assignment {
    return {
      id: "a1", tenantId: TENANT, groupId: GROUP_ID, title: "Ödev", status: "published",
      maxPuan: 100, createdAt: "2026-01-01T00:00:00.000Z", createdBy: "trainer-1",
      ...overrides,
    } as Assignment;
  }
  function makeSubmission(overrides: Partial<Submission> = {}): Submission {
    return {
      id: "s1", tenantId: TENANT, assignmentId: "a1", personId: "p1",
      status: "completed", createdAt: "2026-01-01T00:00:00.000Z", createdBy: "p1",
      ...overrides,
    } as Submission;
  }

  function makeDeps(assignments: Assignment[], submissions: Submission[]) {
    const assignmentRepo: Pick<AssignmentRepo, "list"> = {
      list: async () => assignments,
    };
    const submissionRepo: Pick<SubmissionRepo, "listByGroup"> = {
      listByGroup: async () => submissions,
    };
    return { assignments: assignmentRepo as AssignmentRepo, submissions: submissionRepo as SubmissionRepo };
  }

  it("draft durumundaki ödevler payda/paya HİÇ dahil edilmez", async () => {
    const deps = makeDeps(
      [makeAssignment({ id: "a1", status: "draft", maxPuan: 100 })],
      [makeSubmission({ assignmentId: "a1", personId: "p1", grade: 80 })],
    );
    const result = await computeOdevYuzdeleri(TENANT, GROUP_ID, deps);
    expect(result.normal.totalMaxPuan).toBe(0);
    expect(result.normal.earnedByPerson.p1).toBeUndefined();
  });

  it("kind=proje olan ödevler bilinçli olarak HİÇ hesaba girmez (2026-07-17 kararı)", async () => {
    const deps = makeDeps(
      [makeAssignment({ id: "a1", status: "published", kind: "proje", maxPuan: 100 })],
      [makeSubmission({ assignmentId: "a1", personId: "p1", grade: 90 })],
    );
    const result = await computeOdevYuzdeleri(TENANT, GROUP_ID, deps);
    expect(result.proje.totalMaxPuan).toBe(0);
    expect(result.normal.totalMaxPuan).toBe(0);
  });

  it("published/closed/archived hepsi payda'ya dahil olur, SADECE draft hariç", async () => {
    const deps = makeDeps(
      [
        makeAssignment({ id: "a1", status: "published", maxPuan: 100 }),
        makeAssignment({ id: "a2", status: "closed", maxPuan: 50 }),
        makeAssignment({ id: "a3", status: "archived", maxPuan: 50 }),
      ],
      [],
    );
    const result = await computeOdevYuzdeleri(TENANT, GROUP_ID, deps);
    expect(result.normal.totalMaxPuan).toBe(200);
  });

  it("notu olmayan (grade=null/undefined) teslimler paya dahil edilmez", async () => {
    const deps = makeDeps(
      [makeAssignment({ id: "a1", status: "published", maxPuan: 100 })],
      [makeSubmission({ assignmentId: "a1", personId: "p1", grade: undefined })],
    );
    const result = await computeOdevYuzdeleri(TENANT, GROUP_ID, deps);
    expect(result.normal.earnedByPerson.p1).toBeUndefined();
  });

  it("birden fazla ödevin notları AYNI kişi için toplanır", async () => {
    const deps = makeDeps(
      [
        makeAssignment({ id: "a1", status: "published", maxPuan: 100 }),
        makeAssignment({ id: "a2", status: "published", maxPuan: 100 }),
      ],
      [
        makeSubmission({ assignmentId: "a1", personId: "p1", grade: 80 }),
        makeSubmission({ assignmentId: "a2", personId: "p1", grade: 60 }),
      ],
    );
    const result = await computeOdevYuzdeleri(TENANT, GROUP_ID, deps);
    expect(result.normal.totalMaxPuan).toBe(200);
    expect(result.normal.earnedByPerson.p1).toBe(140);
    expect(combineOdevYuzdesi(result, "p1")).toBe(70); // 140/200 = %70
  });
});

describe("submission-service :: retract", () => {
  function makeDeps(sub: Submission | null, assignment: Assignment | null, person: Person | null, activeFiles: ReturnType<typeof makeSub>[] = []) {
    const submissions = new Map<string, Submission>(sub ? [[sub.id, sub]] : []);
    const submissionRepo = {
      getById: async (id: string, tenantId: string) => { const s = submissions.get(id); return s && s.tenantId === tenantId ? s : null; },
      save: async (s: Submission) => { submissions.set(s.id, s); },
    } as unknown as SubmissionRepo;
    const assignmentRepo = { getById: async () => assignment } as unknown as AssignmentRepo;
    const personRepo = { getById: async () => person } as unknown as PersonRepo;
    const deletedPaths: string[] = [];
    const savedFiles: unknown[] = [];
    const submissionFileRepo = {
      listActiveBySubmission: async () => activeFiles,
      save: async (f: unknown) => { savedFiles.push(f); },
    } as unknown as SubmissionFileRepo;
    const storage = { deleteObject: async (path: string) => { deletedPaths.push(path); } };
    const drive = { deleteFromDrive: async () => {} };
    return { submissions, submissionRepo, assignmentRepo, personRepo, submissionFileRepo, storage, drive, deletedPaths, savedFiles };
  }

  it("teslim bulunamazsa ValidationError fırlatır", async () => {
    const d = makeDeps(null, null, null);
    await expect(
      retract({ requesterUid: "p1-auth", tenantId: TENANT, submissionId: "yok" }, { persons: d.personRepo, assignments: d.assignmentRepo, submissions: d.submissionRepo, submissionFiles: d.submissionFileRepo, drive: d.drive as never, storage: d.storage as never }),
    ).rejects.toThrow(ValidationError);
  });

  it("başkasının teslimini geri çekmeye çalışırsa ForbiddenError fırlatır (sahiplik kontrolü)", async () => {
    const sub = makeSub({ personId: "p1" });
    const person: Person = { id: "p1", tenantId: TENANT, firstName: "A", lastName: "B", status: "active", consentKVKK: true, authUid: "gercek-sahibi", createdAt: "2026-01-01T00:00:00.000Z", createdBy: "system" };
    const d = makeDeps(sub, makeAssignment2(), person);
    await expect(
      retract({ requesterUid: "baskasi", tenantId: TENANT, submissionId: sub.id }, { persons: d.personRepo, assignments: d.assignmentRepo, submissions: d.submissionRepo, submissionFiles: d.submissionFileRepo, drive: d.drive as never, storage: d.storage as never }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("notlandırılmış (grade dolu) teslim geri çekilemez", async () => {
    const sub = makeSub({ personId: "p1", grade: 80 });
    const person: Person = { id: "p1", tenantId: TENANT, firstName: "A", lastName: "B", status: "active", consentKVKK: true, authUid: "sahibi", createdAt: "2026-01-01T00:00:00.000Z", createdBy: "system" };
    const d = makeDeps(sub, makeAssignment2(), person);
    await expect(
      retract({ requesterUid: "sahibi", tenantId: TENANT, submissionId: sub.id }, { persons: d.personRepo, assignments: d.assignmentRepo, submissions: d.submissionRepo, submissionFiles: d.submissionFileRepo, drive: d.drive as never, storage: d.storage as never }),
    ).rejects.toThrow(ValidationError);
  });

  it("completed/retracted gibi geri-çekilemez durumlarda ValidationError fırlatır", async () => {
    const sub = makeSub({ personId: "p1", status: "completed" });
    const person: Person = { id: "p1", tenantId: TENANT, firstName: "A", lastName: "B", status: "active", consentKVKK: true, authUid: "sahibi", createdAt: "2026-01-01T00:00:00.000Z", createdBy: "system" };
    const d = makeDeps(sub, makeAssignment2(), person);
    await expect(
      retract({ requesterUid: "sahibi", tenantId: TENANT, submissionId: sub.id }, { persons: d.personRepo, assignments: d.assignmentRepo, submissions: d.submissionRepo, submissionFiles: d.submissionFileRepo, drive: d.drive as never, storage: d.storage as never }),
    ).rejects.toThrow(ValidationError);
  });

  it("son teslim tarihi geçtiyse geri çekilemez", async () => {
    const sub = makeSub({ personId: "p1", status: "submitted" });
    const assignment = makeAssignment2({ dueDate: "2020-01-01T00:00:00.000Z" });
    const person: Person = { id: "p1", tenantId: TENANT, firstName: "A", lastName: "B", status: "active", consentKVKK: true, authUid: "sahibi", createdAt: "2026-01-01T00:00:00.000Z", createdBy: "system" };
    const d = makeDeps(sub, assignment, person);
    await expect(
      retract({ requesterUid: "sahibi", tenantId: TENANT, submissionId: sub.id }, { persons: d.personRepo, assignments: d.assignmentRepo, submissions: d.submissionRepo, submissionFiles: d.submissionFileRepo, drive: d.drive as never, storage: d.storage as never }),
    ).rejects.toThrow(ValidationError);
  });

  it("başarılı geri çekmede aktif dosyalar soft-delete edilir + storage'dan silinir", async () => {
    const sub = makeSub({ personId: "p1", status: "submitted" });
    const person: Person = { id: "p1", tenantId: TENANT, firstName: "A", lastName: "B", status: "active", consentKVKK: true, authUid: "sahibi", createdAt: "2026-01-01T00:00:00.000Z", createdBy: "system" };
    const activeFile = { id: "f1", tenantId: TENANT, submissionId: sub.id, storagePath: "path/to/file.pdf", deleted: false } as unknown as ReturnType<typeof makeSub>;
    const d = makeDeps(sub, makeAssignment2(), person, [activeFile]);
    await retract({ requesterUid: "sahibi", tenantId: TENANT, submissionId: sub.id }, { persons: d.personRepo, assignments: d.assignmentRepo, submissions: d.submissionRepo, submissionFiles: d.submissionFileRepo, drive: d.drive as never, storage: d.storage as never });
    expect(d.deletedPaths).toEqual(["path/to/file.pdf"]);
    expect(d.submissions.get(sub.id)?.status).toBe("retracted");
  });
});

describe("submission-service :: updateSubmissionStatus", () => {
  function makeDeps(sub: Submission, group: Group, person: Person | null, assignment: Assignment | null) {
    const submissions = new Map<string, Submission>([[sub.id, sub]]);
    const submissionRepo = {
      getById: async (id: string) => submissions.get(id) ?? null,
      save: async (s: Submission) => { submissions.set(s.id, s); },
    } as unknown as SubmissionRepo;
    const groupRepo = { getById: async () => group } as unknown as GroupRepo;
    const personRepo = { getById: async () => person } as unknown as PersonRepo;
    const assignmentRepo = { getById: async () => assignment } as unknown as AssignmentRepo;
    const notify = vi.fn(async () => {});
    return { submissions, submissionRepo, groupRepo, personRepo, assignmentRepo, notify };
  }

  it("geçersiz durum (draft/pending gibi olmayan) ValidationError fırlatır", async () => {
    const sub = makeSub({ status: "submitted" });
    const d = makeDeps(sub, makeGroup(), null, null);
    const actor = makeActor([{ capability: "submission.status.write", scope: "org" }]);
    await expect(
      updateSubmissionStatus(actor, sub.id, "retracted" as never, { submissions: d.submissionRepo, groups: d.groupRepo, persons: d.personRepo, assignments: d.assignmentRepo, notify: d.notify }),
    ).rejects.toThrow(ValidationError);
  });

  it("başka eğitmenin grubunda (assigned scope) ForbiddenError fırlatır", async () => {
    const sub = makeSub({ status: "submitted" });
    const d = makeDeps(sub, makeGroup(), null, null);
    const actor = makeActor([{ capability: "submission.status.write", scope: "assigned" }], { uid: "baska", trainerId: "baska" });
    await expect(
      updateSubmissionStatus(actor, sub.id, "reviewing", { submissions: d.submissionRepo, groups: d.groupRepo, persons: d.personRepo, assignments: d.assignmentRepo, notify: d.notify }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("'revision' durumuna geçince öğrenciye 'Revize İstendi' bildirimi gider", async () => {
    const sub = makeSub({ status: "submitted" });
    const person: Person = { id: "p1", tenantId: TENANT, firstName: "A", lastName: "B", status: "active", consentKVKK: true, authUid: "student-auth", createdAt: "2026-01-01T00:00:00.000Z", createdBy: "system" };
    const d = makeDeps(sub, makeGroup(), person, makeAssignment2());
    const actor = makeActor([{ capability: "submission.status.write", scope: "org" }]);
    await updateSubmissionStatus(actor, sub.id, "revision", { submissions: d.submissionRepo, groups: d.groupRepo, persons: d.personRepo, assignments: d.assignmentRepo, notify: d.notify });
    expect(d.notify).toHaveBeenCalledOnce();
    expect(d.notify).toHaveBeenCalledWith("student-auth", expect.objectContaining({ title: "Revize İstendi" }));
  });

  it("'completed' durumuna geçince '🎉 Onaylandı' bildirimi gider", async () => {
    const sub = makeSub({ status: "reviewing" });
    const person: Person = { id: "p1", tenantId: TENANT, firstName: "A", lastName: "B", status: "active", consentKVKK: true, authUid: "student-auth", createdAt: "2026-01-01T00:00:00.000Z", createdBy: "system" };
    const d = makeDeps(sub, makeGroup(), person, makeAssignment2());
    const actor = makeActor([{ capability: "submission.status.write", scope: "org" }]);
    await updateSubmissionStatus(actor, sub.id, "completed", { submissions: d.submissionRepo, groups: d.groupRepo, persons: d.personRepo, assignments: d.assignmentRepo, notify: d.notify });
    expect(d.notify).toHaveBeenCalledWith("student-auth", expect.objectContaining({ title: "Ödeviniz Onaylandı! 🎉" }));
  });

  it("'submitted'/'reviewing' gibi ARA durumlara geçişte HİÇ bildirim gitmez", async () => {
    const sub = makeSub({ status: "submitted" });
    const person: Person = { id: "p1", tenantId: TENANT, firstName: "A", lastName: "B", status: "active", consentKVKK: true, authUid: "student-auth", createdAt: "2026-01-01T00:00:00.000Z", createdBy: "system" };
    const d = makeDeps(sub, makeGroup(), person, makeAssignment2());
    const actor = makeActor([{ capability: "submission.status.write", scope: "org" }]);
    await updateSubmissionStatus(actor, sub.id, "reviewing", { submissions: d.submissionRepo, groups: d.groupRepo, persons: d.personRepo, assignments: d.assignmentRepo, notify: d.notify });
    expect(d.notify).not.toHaveBeenCalled();
  });

  it("öğrencinin authUid'i yoksa (henüz hesap aktive etmemiş) bildirim SESSİZCE atlanır, hata fırlatmaz", async () => {
    const sub = makeSub({ status: "submitted" });
    const person: Person = { id: "p1", tenantId: TENANT, firstName: "A", lastName: "B", status: "active", consentKVKK: true, createdAt: "2026-01-01T00:00:00.000Z", createdBy: "system" };
    const d = makeDeps(sub, makeGroup(), person, makeAssignment2());
    const actor = makeActor([{ capability: "submission.status.write", scope: "org" }]);
    const updated = await updateSubmissionStatus(actor, sub.id, "completed", { submissions: d.submissionRepo, groups: d.groupRepo, persons: d.personRepo, assignments: d.assignmentRepo, notify: d.notify });
    expect(updated.status).toBe("completed");
    expect(d.notify).not.toHaveBeenCalled();
  });
});

describe("submission-service :: gradeSubmission", () => {
  function makeDeps(sub: Submission, assignment: Assignment | null, group: Group) {
    const submissions = new Map<string, Submission>([[sub.id, sub]]);
    const submissionRepo = {
      getById: async (id: string) => submissions.get(id) ?? null,
      save: async (s: Submission) => { submissions.set(s.id, s); },
    } as unknown as SubmissionRepo;
    const assignmentRepo = { getById: async () => assignment } as unknown as AssignmentRepo;
    const groupRepo = { getById: async () => group } as unknown as GroupRepo;
    const activityLog: unknown[] = [];
    const activityLogRepo = { create: async (e: unknown) => { activityLog.push(e); } } as unknown as ActivityLogRepo;
    return { submissions, submissionRepo, assignmentRepo, groupRepo, activityLog, activityLogRepo };
  }

  it("assignment.maxPuan'ı AŞAN not ValidationError fırlatır (varsayılan 100 değil, ödevin kendi max'ı)", async () => {
    const sub = makeSub();
    const assignment = makeAssignment2({ maxPuan: 50 });
    const d = makeDeps(sub, assignment, makeGroup());
    const actor = makeActor([{ capability: "submission.grade", scope: "org" }]);
    await expect(
      gradeSubmission(actor, sub.id, 60, { submissions: d.submissionRepo, groups: d.groupRepo, assignments: d.assignmentRepo, activityLog: d.activityLogRepo }),
    ).rejects.toThrow(ValidationError);
    // Ama 50 (sınırda) kabul edilmeli
    await gradeSubmission(actor, sub.id, 50, { submissions: d.submissionRepo, groups: d.groupRepo, assignments: d.assignmentRepo, activityLog: d.activityLogRepo });
    expect(d.submissions.get(sub.id)?.grade).toBe(50);
  });

  it("negatif not ValidationError fırlatır", async () => {
    const sub = makeSub();
    const d = makeDeps(sub, makeAssignment2(), makeGroup());
    const actor = makeActor([{ capability: "submission.grade", scope: "org" }]);
    await expect(
      gradeSubmission(actor, sub.id, -5, { submissions: d.submissionRepo, groups: d.groupRepo, assignments: d.assignmentRepo, activityLog: d.activityLogRepo }),
    ).rejects.toThrow(ValidationError);
  });

  it("başarılı notlandırma sonrası tek bir 'grade.given' aktivite logu üretir", async () => {
    const sub = makeSub();
    const d = makeDeps(sub, makeAssignment2(), makeGroup());
    const actor = makeActor([{ capability: "submission.grade", scope: "org" }]);
    await gradeSubmission(actor, sub.id, 88, { submissions: d.submissionRepo, groups: d.groupRepo, assignments: d.assignmentRepo, activityLog: d.activityLogRepo });
    expect(d.activityLog).toHaveLength(1);
  });
});

describe("submission-service :: gradeManually", () => {
  function makeDeps(existing: Submission | null, assignment: Assignment | null, group: Group) {
    const submissions = new Map<string, Submission>(existing ? [[existing.id, existing]] : []);
    const submissionRepo = {
      findByAssignmentAndPerson: async (assignmentId: string, personId: string) =>
        [...submissions.values()].find((s) => s.assignmentId === assignmentId && s.personId === personId) ?? null,
      save: async (s: Submission) => { submissions.set(s.id, s); },
    } as unknown as SubmissionRepo;
    const assignmentRepo = { getById: async () => assignment } as unknown as AssignmentRepo;
    const groupRepo = { getById: async () => group } as unknown as GroupRepo;
    const activityLogRepo = { create: async () => {} } as unknown as ActivityLogRepo;
    return { submissions, submissionRepo, assignmentRepo, groupRepo, activityLogRepo };
  }

  it("dijital teslim izi YOKSA yeni bir 'completed' Submission açar, note alanı işaretlenir", async () => {
    const d = makeDeps(null, makeAssignment2(), makeGroup());
    const actor = makeActor([{ capability: "submission.grade", scope: "org" }]);
    const result = await gradeManually(actor, { assignmentId: "a1", personId: "p1", groupId: GROUP_ID, isLate: false, grade: 75 }, { submissions: d.submissionRepo, groups: d.groupRepo, assignments: d.assignmentRepo, activityLog: d.activityLogRepo });
    expect(result.status).toBe("completed");
    expect(result.grade).toBe(75);
    expect(result.note).toContain("elle işaretlendi");
  });

  it("GERÇEK teslim zaten varsa üzerine yazar, YENİ doküman açmaz", async () => {
    const existing = makeSub({ id: "sub-existing", assignmentId: "a1", personId: "p1", status: "submitted" });
    const d = makeDeps(existing, makeAssignment2(), makeGroup());
    const actor = makeActor([{ capability: "submission.grade", scope: "org" }]);
    await gradeManually(actor, { assignmentId: "a1", personId: "p1", groupId: GROUP_ID, isLate: false, grade: 90 }, { submissions: d.submissionRepo, groups: d.groupRepo, assignments: d.assignmentRepo, activityLog: d.activityLogRepo });
    expect(d.submissions.size).toBe(1);
    expect(d.submissions.get("sub-existing")?.grade).toBe(90);
  });
});
