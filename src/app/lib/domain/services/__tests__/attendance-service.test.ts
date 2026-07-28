import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { startLesson, saveAttendance, deleteAttendance, isWithinEditWindow, type AttendanceDeps } from "../attendance-service";
import { ForbiddenError, ValidationError } from "../../errors";
import type { Actor, Grant } from "../../access/types";
import type { Group } from "../../core/group";
import type { Attendance } from "../../core/attendance";
import type { AttendanceRepo } from "../../repo/attendance-repo";
import type { GroupRepo } from "../../repo/group-repo";
import type { ActivityLogRepo } from "../../repo/activity-log-repo";
import type { ActivityLogEntry } from "../../core/activity-log";

const TENANT = "tenant-1";
const GROUP_ID = "group-1";
const TRAINER_UID = "trainer-1";

function makeActor(grants: Grant[], overrides: Partial<Actor> = {}): Actor {
  return { type: "human", uid: "user-1", tenantId: TENANT, grants, ...overrides };
}

// Salı=1, Perşembe=3 (isoWeekday: 0=Pazartesi..6=Pazar) — 2026-07-14 gerçek bir Salı.
function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: GROUP_ID, tenantId: TENANT, code: "GRP-1", trainerId: TRAINER_UID,
    type: "standart", status: "active",
    schedule: { startDate: "2026-01-01", days: [1, 3], sessionHours: 3, startTime: "19:00" },
    createdAt: "2026-01-01T00:00:00.000Z", createdBy: "system",
    ...overrides,
  } as Group;
}

function makeRepos(group: Group = makeGroup()) {
  const groups = new Map<string, Group>([[group.id, group]]);
  const attendance = new Map<string, Attendance>();
  const activityLog: ActivityLogEntry[] = [];

  const attendanceRepo: AttendanceRepo = {
    save: async (r) => { attendance.set(r.id, r); },
    getById: async (id, tenantId) => {
      const r = attendance.get(id);
      return r && r.tenantId === tenantId ? r : null;
    },
    getByGroupAndDate: async (groupId, date, tenantId) =>
      [...attendance.values()].find((r) => r.tenantId === tenantId && r.groupId === groupId && r.date === date) ?? null,
    listByGroup: async (groupId, tenantId) => [...attendance.values()].filter((r) => r.tenantId === tenantId && r.groupId === groupId),
    list: async (tenantId) => [...attendance.values()].filter((r) => r.tenantId === tenantId),
    delete: async (id) => { attendance.delete(id); },
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

  return { groups, attendance, activityLog, attendanceRepo, groupRepo, activityLogRepo };
}

const TRAINER_GRANTS: Grant[] = [{ capability: "attendance.write", scope: "assigned" }];
const ORG_GRANTS: Grant[] = [{ capability: "attendance.write", scope: "org" }];

describe("attendance-service :: startLesson", () => {
  let repos: ReturnType<typeof makeRepos>;
  let deps: AttendanceDeps;

  beforeEach(() => {
    // 2026-07-14 gerçek bir SALI (isoWeekday=1) — grubun ders günlerinden biri, saat 19:05
    // (ders saati 19:00, 15dk erken-engel penceresinin İÇİNDE — dersi başlatmaya izin verilmeli).
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-14T16:05:00.000Z")); // UTC 16:05 = İstanbul (UTC+3) 19:05
    repos = makeRepos();
    deps = { groups: repos.groupRepo, attendance: repos.attendanceRepo, activityLog: repos.activityLogRepo };
  });

  afterEach(() => { vi.useRealTimers(); });

  it("geçersiz tarih formatı için ValidationError fırlatır", async () => {
    const actor = makeActor(ORG_GRANTS);
    await expect(startLesson(actor, { groupId: GROUP_ID, date: "14-07-2026" }, deps)).rejects.toThrow(ValidationError);
  });

  it("grup bulunamazsa ValidationError fırlatır", async () => {
    const actor = makeActor(ORG_GRANTS);
    await expect(startLesson(actor, { groupId: "yok", date: "2026-07-14" }, deps)).rejects.toThrow(ValidationError);
  });

  it("yetkisiz aktör için ForbiddenError fırlatır", async () => {
    const actor = makeActor([], { uid: "baska", trainerId: "baska" });
    await expect(startLesson(actor, { groupId: GROUP_ID, date: "2026-07-14" }, deps)).rejects.toThrow(ForbiddenError);
  });

  it("GERÇEK BUG regresyon testi — grubun ders günü olan Salı (isoWeekday=1) kabul edilir", async () => {
    // Bu test eskiden JS Date.getDay() (0=Pazar) ile schedule.days (0=Pazartesi) karıştırılırsa
    // kırılırdı — 2026-07-13'te düzeltilen gerçek prod bug'ının regresyonunu yakalar.
    const actor = makeActor(ORG_GRANTS);
    const result = await startLesson(actor, { groupId: GROUP_ID, date: "2026-07-14" }, deps);
    expect(result.groupId).toBe(GROUP_ID);
  });

  it("grubun ders günü OLMAYAN bir tarih (Çarşamba) reddedilir", async () => {
    const actor = makeActor(ORG_GRANTS);
    // 2026-07-15 bir Çarşamba (isoWeekday=2) — grup sadece Salı(1)/Perşembe(3) işliyor.
    await expect(startLesson(actor, { groupId: GROUP_ID, date: "2026-07-15" }, deps)).rejects.toThrow(ValidationError);
  });

  it("grup başlangıcından ÖNCEKİ tarih reddedilir", async () => {
    const group = makeGroup({ schedule: { startDate: "2026-08-01", days: [1, 3], sessionHours: 3, startTime: "19:00" } });
    repos = makeRepos(group);
    deps = { groups: repos.groupRepo, attendance: repos.attendanceRepo, activityLog: repos.activityLogRepo };
    const actor = makeActor(ORG_GRANTS);
    await expect(startLesson(actor, { groupId: GROUP_ID, date: "2026-07-14" }, deps)).rejects.toThrow(ValidationError);
  });

  it("program tamamlandıktan (endDate) SONRAKİ tarih reddedilir", async () => {
    const group = makeGroup({ schedule: { startDate: "2026-01-01", days: [1, 3], sessionHours: 3, startTime: "19:00", endDate: "2026-06-01" } });
    repos = makeRepos(group);
    deps = { groups: repos.groupRepo, attendance: repos.attendanceRepo, activityLog: repos.activityLogRepo };
    const actor = makeActor(ORG_GRANTS);
    await expect(startLesson(actor, { groupId: GROUP_ID, date: "2026-07-14" }, deps)).rejects.toThrow(ValidationError);
  });

  it("ders saatinden 15dk'dan FAZLA erken başlatma reddedilir (bugünün dersi)", async () => {
    vi.setSystemTime(new Date("2026-07-14T15:44:00.000Z")); // İstanbul 18:44 — 19:00'dan 16dk önce
    const actor = makeActor(ORG_GRANTS);
    await expect(startLesson(actor, { groupId: GROUP_ID, date: "2026-07-14" }, deps)).rejects.toThrow(ValidationError);
  });

  it("ders saatinden TAM 15dk önce başlatmaya izin verilir (pencerenin sınırı)", async () => {
    vi.setSystemTime(new Date("2026-07-14T15:45:00.000Z")); // İstanbul 18:45 — tam 15dk önce
    const actor = makeActor(ORG_GRANTS);
    const result = await startLesson(actor, { groupId: GROUP_ID, date: "2026-07-14" }, deps);
    expect(result.date).toBe("2026-07-14");
  });

  it("15dk erken-engel kuralı SADECE bugünün tarihi için geçerli — geçmiş tarihe (Yoklama Gir) uygulanmaz", async () => {
    // Sistem saati aynı gün 19:05'te ama GEÇMİŞ bir ders günü (2026-07-07, aynı hafta günü) giriliyor.
    const actor = makeActor(ORG_GRANTS);
    const result = await startLesson(actor, { groupId: GROUP_ID, date: "2026-07-07" }, deps);
    expect(result.date).toBe("2026-07-07");
  });

  it("aynı grup+tarih için ikinci kez başlatma ValidationError fırlatır (üzerine yazmaz)", async () => {
    const actor = makeActor(ORG_GRANTS);
    await startLesson(actor, { groupId: GROUP_ID, date: "2026-07-14" }, deps);
    await expect(startLesson(actor, { groupId: GROUP_ID, date: "2026-07-14" }, deps)).rejects.toThrow(ValidationError);
  });

  it("başarılı başlatma boş entries + attendanceClosed=false ile kayıt açar ve aktivite logu üretir", async () => {
    const actor = makeActor(ORG_GRANTS);
    const result = await startLesson(actor, { groupId: GROUP_ID, date: "2026-07-14" }, deps);
    expect(result.entries).toEqual({});
    expect(result.attendanceClosed).toBe(false);
    expect(result.sessionHours).toBe(3);
    expect(repos.activityLog).toHaveLength(1);
    expect(repos.activityLog[0].type).toBe("attendance.started");
  });
});

describe("attendance-service :: saveAttendance", () => {
  let repos: ReturnType<typeof makeRepos>;
  let deps: AttendanceDeps;

  function makeStarted(overrides: Partial<Attendance> = {}): Attendance {
    return {
      id: `${GROUP_ID}_2026-07-14`, tenantId: TENANT, groupId: GROUP_ID, date: "2026-07-14", month: "2026-07",
      trainerId: TRAINER_UID, sessionHours: 3, entries: {}, attendanceClosed: false,
      createdAt: "2026-07-14T16:00:00.000Z", createdBy: "user-1",
      ...overrides,
    };
  }

  beforeEach(() => {
    repos = makeRepos();
    deps = { groups: repos.groupRepo, attendance: repos.attendanceRepo, activityLog: repos.activityLogRepo };
  });

  it("grup bulunamazsa ValidationError fırlatır", async () => {
    const actor = makeActor(ORG_GRANTS);
    await expect(saveAttendance(actor, { groupId: "yok", date: "2026-07-14", entries: {} }, deps)).rejects.toThrow(ValidationError);
  });

  it("yetkisiz aktör için ForbiddenError fırlatır", async () => {
    const actor = makeActor([], { uid: "baska", trainerId: "baska" });
    await expect(saveAttendance(actor, { groupId: GROUP_ID, date: "2026-07-14", entries: {} }, deps)).rejects.toThrow(ForbiddenError);
  });

  it("dersi başlatmadan kaydetmeye çalışırsa ValidationError fırlatır", async () => {
    const actor = makeActor(ORG_GRANTS);
    await expect(saveAttendance(actor, { groupId: GROUP_ID, date: "2026-07-14", entries: {} }, deps)).rejects.toThrow(ValidationError);
  });

  it("negatif saat girilirse ValidationError fırlatır", async () => {
    repos.attendance.set(`${GROUP_ID}_2026-07-14`, makeStarted());
    const actor = makeActor(ORG_GRANTS);
    await expect(
      saveAttendance(actor, { groupId: GROUP_ID, date: "2026-07-14", entries: { "p1": { hours: -1 } } }, deps),
    ).rejects.toThrow(ValidationError);
  });

  it("KAPATILMIŞ kaydı eğitmen (assigned) 3 GÜN DIŞINDA düzenleyemez", async () => {
    repos.attendance.set(`${GROUP_ID}_2026-07-14`, makeStarted({ attendanceClosed: true, closedAt: "2026-07-14T20:00:00.000Z" }));
    // isWithinEditWindow ders tarihinden (2026-07-14) hesaplanır — gerçek "şimdi" bu testte
    // çok ileride olduğu için (bu dosya hangi tarihte çalışırsa çalışsın, 2026-07-14 + 3 gün
    // her zaman geçmişte kalacak kadar eski bir sabit tarih kullanıyoruz).
    const actor = makeActor(TRAINER_GRANTS, { uid: TRAINER_UID, trainerId: TRAINER_UID });
    await expect(
      saveAttendance(actor, { groupId: GROUP_ID, date: "2026-07-14", entries: {} }, deps),
    ).rejects.toThrow(ValidationError);
  });

  it("KAPATILMIŞ kaydı ORG-SCOPE (Op/Admin) HER ZAMAN düzenleyebilir (3 gün bypass)", async () => {
    repos.attendance.set(`${GROUP_ID}_2026-07-14`, makeStarted({ attendanceClosed: true, closedAt: "2026-07-14T20:00:00.000Z" }));
    const actor = makeActor(ORG_GRANTS);
    const result = await saveAttendance(actor, { groupId: GROUP_ID, date: "2026-07-14", entries: { "p1": { hours: 3 } } }, deps);
    expect(result.entries.p1.hours).toBe(3);
  });

  it("açık kayıtta 'Dersi Bitir' (close=true) → attendance.ended logu üretir", async () => {
    repos.attendance.set(`${GROUP_ID}_2026-07-14`, makeStarted());
    const actor = makeActor(ORG_GRANTS);
    const result = await saveAttendance(actor, { groupId: GROUP_ID, date: "2026-07-14", entries: { "p1": { hours: 3 } }, close: true }, deps);
    expect(result.attendanceClosed).toBe(true);
    expect(result.closedAt).toBeTruthy();
    expect(repos.activityLog).toHaveLength(1);
    expect(repos.activityLog[0].type).toBe("attendance.ended");
  });

  it("kapanmamış kaydı sade kaydetme (close=undefined) HİÇ aktivite logu üretmez (spam önleme)", async () => {
    repos.attendance.set(`${GROUP_ID}_2026-07-14`, makeStarted());
    const actor = makeActor(ORG_GRANTS);
    await saveAttendance(actor, { groupId: GROUP_ID, date: "2026-07-14", entries: { "p1": { hours: 2 } } }, deps);
    expect(repos.activityLog).toHaveLength(0);
  });

  it("zaten kapalı kaydı düzenleme (Op'un güncellemesi) → attendance.updated logu üretir", async () => {
    repos.attendance.set(`${GROUP_ID}_2026-07-14`, makeStarted({ attendanceClosed: true, closedAt: "2026-07-14T20:00:00.000Z" }));
    const actor = makeActor(ORG_GRANTS);
    await saveAttendance(actor, { groupId: GROUP_ID, date: "2026-07-14", entries: { "p1": { hours: 3 } } }, deps);
    expect(repos.activityLog).toHaveLength(1);
    expect(repos.activityLog[0].type).toBe("attendance.updated");
  });

  it("Op'un 'yeniden aç' aksiyonu (close=false) closedAt'i temizler", async () => {
    repos.attendance.set(`${GROUP_ID}_2026-07-14`, makeStarted({ attendanceClosed: true, closedAt: "2026-07-14T20:00:00.000Z" }));
    const actor = makeActor(ORG_GRANTS);
    const result = await saveAttendance(actor, { groupId: GROUP_ID, date: "2026-07-14", entries: {}, close: false }, deps);
    expect(result.attendanceClosed).toBe(false);
    expect(result.closedAt).toBeUndefined();
  });
});

describe("attendance-service :: deleteAttendance", () => {
  let repos: ReturnType<typeof makeRepos>;

  beforeEach(() => { repos = makeRepos(); });

  it("kayıt yoksa sessizce no-op (hata fırlatmaz)", async () => {
    const actor = makeActor(ORG_GRANTS);
    await expect(
      deleteAttendance(actor, { groupId: GROUP_ID, date: "2026-07-14" }, { groups: repos.groupRepo, attendance: repos.attendanceRepo }),
    ).resolves.toBeUndefined();
  });

  it("KAPATILMAMIŞ kayıt silinebilir", async () => {
    repos.attendance.set(`${GROUP_ID}_2026-07-14`, {
      id: `${GROUP_ID}_2026-07-14`, tenantId: TENANT, groupId: GROUP_ID, date: "2026-07-14", month: "2026-07",
      sessionHours: 3, entries: {}, attendanceClosed: false, createdAt: "2026-07-14T16:00:00.000Z", createdBy: "user-1",
    });
    const actor = makeActor(ORG_GRANTS);
    await deleteAttendance(actor, { groupId: GROUP_ID, date: "2026-07-14" }, { groups: repos.groupRepo, attendance: repos.attendanceRepo });
    expect(repos.attendance.size).toBe(0);
  });

  it("KAPATILMIŞ kayıt SİLİNEMEZ (ValidationError)", async () => {
    repos.attendance.set(`${GROUP_ID}_2026-07-14`, {
      id: `${GROUP_ID}_2026-07-14`, tenantId: TENANT, groupId: GROUP_ID, date: "2026-07-14", month: "2026-07",
      sessionHours: 3, entries: {}, attendanceClosed: true, createdAt: "2026-07-14T16:00:00.000Z", createdBy: "user-1",
    });
    const actor = makeActor(ORG_GRANTS);
    await expect(
      deleteAttendance(actor, { groupId: GROUP_ID, date: "2026-07-14" }, { groups: repos.groupRepo, attendance: repos.attendanceRepo }),
    ).rejects.toThrow(ValidationError);
    expect(repos.attendance.size).toBe(1);
  });
});

describe("attendance-service :: isWithinEditWindow", () => {
  afterEach(() => { vi.useRealTimers(); });

  it("3 günden yeni tarih için true döner", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T12:00:00.000Z"));
    expect(isWithinEditWindow("2026-07-14")).toBe(true);
  });

  it("3 günden eski tarih için false döner", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-20T12:00:00.000Z"));
    expect(isWithinEditWindow("2026-07-14")).toBe(false);
  });
});
