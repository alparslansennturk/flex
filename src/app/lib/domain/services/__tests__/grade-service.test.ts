import { describe, it, expect, beforeEach } from "vitest";
import { saveGrades, getGradesByGroup, type GradeDeps } from "../grade-service";
import { ForbiddenError, ValidationError } from "../../errors";
import type { Actor, Grant } from "../../access/types";
import type { Group } from "../../core/group";
import type { Grade } from "../../education/grade";
import type { GradeRepo } from "../../repo/grade-repo";
import type { GroupRepo } from "../../repo/group-repo";
import type { ActivityLogRepo } from "../../repo/activity-log-repo";
import type { ActivityLogEntry } from "../../core/activity-log";

const TENANT = "tenant-1";
const GROUP_ID = "group-1";
const TRAINER_UID = "trainer-1";

function makeActor(grants: Grant[], overrides: Partial<Actor> = {}): Actor {
  return { type: "human", uid: "user-1", tenantId: TENANT, grants, ...overrides };
}

function makeGroup(): Group {
  return {
    id: GROUP_ID, tenantId: TENANT, code: "GRP-1", trainerId: TRAINER_UID,
    type: "standart", status: "active",
    schedule: { startDate: "2026-01-01", days: [1, 3], sessionHours: 3 },
    createdAt: "2026-01-01T00:00:00.000Z", createdBy: "system",
  } as Group;
}

function makeRepos() {
  const groups = new Map<string, Group>([[GROUP_ID, makeGroup()]]);
  const grades = new Map<string, Grade>();
  const activityLog: ActivityLogEntry[] = [];

  const gradeRepo: GradeRepo = {
    save: async (g) => { grades.set(g.id, g); },
    getById: async (enrollmentId, tenantId) => {
      const g = grades.get(enrollmentId);
      return g && g.tenantId === tenantId ? g : null;
    },
    listByGroup: async (groupId, tenantId) => [...grades.values()].filter((g) => g.tenantId === tenantId && g.groupId === groupId),
  };

  const groupRepo: GroupRepo = {
    nextId: () => `group-${Math.random()}`,
    save: async (g) => { groups.set(g.id, g); },
    getById: async (id, tenantId) => {
      const g = groups.get(id);
      return g && g.tenantId === tenantId ? g : null;
    },
    list: async (tenantId) => [...groups.values()].filter((g) => g.tenantId === tenantId),
    delete: async (id) => { groups.delete(id); },
  };

  const activityLogRepo: ActivityLogRepo = {
    create: async (entry) => { activityLog.push(entry); },
    listRecentForTrainer: async () => [],
  };

  return { groups, grades, activityLog, gradeRepo, groupRepo, activityLogRepo };
}

// Eğitmen — SADECE kendi grubunda (assigned scope)
const TRAINER_GRANTS: Grant[] = [
  { capability: "grade.write", scope: "assigned" },
  { capability: "grade.read", scope: "assigned" },
];
// Admin/yetkili — org scope (kilidi de override edebilir)
const ADMIN_GRANTS: Grant[] = [
  { capability: "grade.write", scope: "org" },
  { capability: "grade.read", scope: "org" },
];

describe("grade-service :: saveGrades", () => {
  let repos: ReturnType<typeof makeRepos>;
  let deps: GradeDeps;

  beforeEach(() => {
    repos = makeRepos();
    deps = { grades: repos.gradeRepo, groups: repos.groupRepo, activityLog: repos.activityLogRepo };
  });

  it("groupId boşsa ValidationError fırlatır", async () => {
    const actor = makeActor(ADMIN_GRANTS);
    await expect(saveGrades(actor, { groupId: "", entries: [] }, deps)).rejects.toThrow(ValidationError);
  });

  it("grup bulunamazsa ValidationError fırlatır", async () => {
    const actor = makeActor(ADMIN_GRANTS);
    await expect(
      saveGrades(actor, { groupId: "yok", entries: [{ enrollmentId: "e1", personId: "p1", projectGrade: 80 }] }, deps),
    ).rejects.toThrow(ValidationError);
  });

  it("başka eğitmenin grubuna assigned-scope aktör yazamaz (ForbiddenError)", async () => {
    const actor = makeActor(TRAINER_GRANTS, { uid: "baska-egitmen", trainerId: "baska-egitmen" });
    await expect(
      saveGrades(actor, { groupId: GROUP_ID, entries: [{ enrollmentId: "e1", personId: "p1", projectGrade: 80 }] }, deps),
    ).rejects.toThrow(ForbiddenError);
  });

  it("kendi grubuna eğitmen (assigned scope, trainerId eşleşiyor) not girebilir", async () => {
    const actor = makeActor(TRAINER_GRANTS, { uid: TRAINER_UID, trainerId: TRAINER_UID });
    const result = await saveGrades(actor, { groupId: GROUP_ID, entries: [{ enrollmentId: "e1", personId: "p1", projectGrade: 85 }] }, deps);
    expect(result).toHaveLength(1);
    expect(result[0].projectGrade).toBe(85);
  });

  it("boş entries ValidationError fırlatır", async () => {
    const actor = makeActor(ADMIN_GRANTS);
    await expect(saveGrades(actor, { groupId: GROUP_ID, entries: [] }, deps)).rejects.toThrow(ValidationError);
  });

  it("0-100 aralığı dışındaki not ValidationError fırlatır", async () => {
    const actor = makeActor(ADMIN_GRANTS);
    await expect(
      saveGrades(actor, { groupId: GROUP_ID, entries: [{ enrollmentId: "e1", personId: "p1", projectGrade: 101 }] }, deps),
    ).rejects.toThrow(ValidationError);
    await expect(
      saveGrades(actor, { groupId: GROUP_ID, entries: [{ enrollmentId: "e1", personId: "p1", projectGrade: -1 }] }, deps),
    ).rejects.toThrow(ValidationError);
  });

  it("KİLİTLİ notu eğitmen (assigned) SESSİZCE atlar, roster'ın geri kalanını engellemez", async () => {
    repos.grades.set("e1", {
      id: "e1", tenantId: TENANT, enrollmentId: "e1", personId: "p1", groupId: GROUP_ID,
      projectGrade: 70, locked: true, lockedAt: "2026-07-01T00:00:00.000Z", lockedBy: "admin-1",
      createdAt: "2026-06-01T00:00:00.000Z", createdBy: "admin-1",
    });

    const actor = makeActor(TRAINER_GRANTS, { uid: TRAINER_UID, trainerId: TRAINER_UID });
    const result = await saveGrades(
      actor,
      {
        groupId: GROUP_ID,
        entries: [
          { enrollmentId: "e1", personId: "p1", projectGrade: 95 }, // kilitli — atlanmalı
          { enrollmentId: "e2", personId: "p2", projectGrade: 60 }, // kilitli değil — kaydedilmeli
        ],
      },
      deps,
    );
    // Sadece kilitli OLMAYAN kayıt sonuçta döner
    expect(result).toHaveLength(1);
    expect(result[0].enrollmentId).toBe("e2");
    // Kilitli kayıt DEĞİŞMEMİŞ olmalı
    expect(repos.grades.get("e1")?.projectGrade).toBe(70);
  });

  it("KİLİTLİ notu ADMIN (org scope) override edebilir", async () => {
    repos.grades.set("e1", {
      id: "e1", tenantId: TENANT, enrollmentId: "e1", personId: "p1", groupId: GROUP_ID,
      projectGrade: 70, locked: true, lockedAt: "2026-07-01T00:00:00.000Z", lockedBy: "admin-1",
      createdAt: "2026-06-01T00:00:00.000Z", createdBy: "admin-1",
    });

    const actor = makeActor(ADMIN_GRANTS);
    const result = await saveGrades(actor, { groupId: GROUP_ID, entries: [{ enrollmentId: "e1", personId: "p1", projectGrade: 95 }] }, deps);
    expect(result).toHaveLength(1);
    expect(repos.grades.get("e1")?.projectGrade).toBe(95);
  });

  it("aynı değer tekrar gönderilirse aktivite logu OLUŞTURMAZ (changedCount=0)", async () => {
    repos.grades.set("e1", {
      id: "e1", tenantId: TENANT, enrollmentId: "e1", personId: "p1", groupId: GROUP_ID,
      projectGrade: 80, createdAt: "2026-06-01T00:00:00.000Z", createdBy: "user-1",
    });
    const actor = makeActor(ADMIN_GRANTS);
    await saveGrades(actor, { groupId: GROUP_ID, entries: [{ enrollmentId: "e1", personId: "p1", projectGrade: 80 }] }, deps);
    expect(repos.activityLog).toHaveLength(0);
  });

  it("gerçekten değişen not için TEK özet aktivite logu oluşturur (kişi başına değil)", async () => {
    const actor = makeActor(ADMIN_GRANTS);
    await saveGrades(
      actor,
      {
        groupId: GROUP_ID,
        entries: [
          { enrollmentId: "e1", personId: "p1", projectGrade: 90 },
          { enrollmentId: "e2", personId: "p2", projectGrade: 85 },
        ],
      },
      deps,
    );
    expect(repos.activityLog).toHaveLength(1);
    expect(repos.activityLog[0].description).toContain("2 öğrenciye");
  });
});

describe("grade-service :: getGradesByGroup", () => {
  let repos: ReturnType<typeof makeRepos>;

  beforeEach(() => { repos = makeRepos(); });

  it("yetkisiz aktör için ForbiddenError fırlatır", async () => {
    const actor = makeActor([], { uid: "baska", trainerId: "baska" });
    await expect(getGradesByGroup(actor, GROUP_ID, { grades: repos.gradeRepo, groups: repos.groupRepo })).rejects.toThrow(ForbiddenError);
  });

  it("kendi grubunu okuyabilen eğitmen doğru listeyi alır", async () => {
    repos.grades.set("e1", {
      id: "e1", tenantId: TENANT, enrollmentId: "e1", personId: "p1", groupId: GROUP_ID,
      projectGrade: 88, createdAt: "2026-06-01T00:00:00.000Z", createdBy: "user-1",
    });
    const actor = makeActor(TRAINER_GRANTS, { uid: TRAINER_UID, trainerId: TRAINER_UID });
    const result = await getGradesByGroup(actor, GROUP_ID, { grades: repos.gradeRepo, groups: repos.groupRepo });
    expect(result).toHaveLength(1);
    expect(result[0].projectGrade).toBe(88);
  });
});
