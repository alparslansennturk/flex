/**
 * standaloneMode switch assertion'ları — jiti ile çalıştırılır.
 * npx jiti scripts/assert-standalone-mode.ts
 */
import { resolvePackages } from "../src/app/lib/domain/access/packages";
import { buildActor } from "../src/app/lib/domain/access/actor";
import { can } from "../src/app/lib/domain/access/can";
import { getSettings, updateSettings } from "../src/app/lib/domain/services/settings-service";
import { createGroup } from "../src/app/lib/domain/services/group-service";
import { createEnrollment, assignToGroup } from "../src/app/lib/domain/services/enrollment-service";
import type { Actor } from "../src/app/lib/domain/access/types";
import type { FlexosSettings } from "../src/app/lib/domain/core/settings";
import type { SettingsRepo } from "../src/app/lib/domain/repo/settings-repo";
import type { Group } from "../src/app/lib/domain/core/group";
import type { Person } from "../src/app/lib/domain/core/person";
import type { Enrollment } from "../src/app/lib/domain/core/enrollment";
import type { GroupRepo } from "../src/app/lib/domain/repo/group-repo";
import type { PersonRepo } from "../src/app/lib/domain/repo/person-repo";
import type { EnrollmentRepo } from "../src/app/lib/domain/repo/enrollment-repo";
import { ForbiddenError } from "../src/app/lib/domain/errors";

const TENANT = "test-tenant";

function makeActor(pkg: "admin" | "egitmen"): Actor {
  return { type: "human", uid: `user-${pkg}`, tenantId: TENANT, grants: resolvePackages([pkg]) };
}

function makeSettingsRepo(initial?: FlexosSettings): SettingsRepo {
  let stored = initial ?? null;
  return {
    async get(tenantId) {
      if (!stored || stored.tenantId !== tenantId) return null;
      return stored;
    },
    async save(settings) {
      stored = { ...settings };
    },
  };
}

let idCounter = 0;
function nextId() { return `test-${++idCounter}`; }

function makeGroupRepo(groups: Group[] = []): GroupRepo {
  const map = new Map(groups.map((g) => [g.id, g]));
  return {
    nextId,
    async save(g) { map.set(g.id, { ...g }); },
    async getById(id, tid) { const g = map.get(id); return g && g.tenantId === tid ? g : null; },
    async list(tid) { return [...map.values()].filter((g) => g.tenantId === tid); },
    async delete(id) { map.delete(id); },
  };
}

function makePersonRepo(persons: Person[] = []): PersonRepo {
  const map = new Map(persons.map((p) => [p.id, p]));
  return {
    nextId,
    async save(p) { map.set(p.id, { ...p }); },
    async getById(id, tid) { const p = map.get(id); return p && p.tenantId === tid ? p : null; },
    async getByIds(ids, tid) { return ids.map((id) => map.get(id)).filter((p): p is Person => !!p && p.tenantId === tid); },
    async findByIdNo() { return null; },
    async findByAuthUid() { return null; },
    async list(tid) { return [...map.values()].filter((p) => p.tenantId === tid); },
    async update(id, tid, data) { const p = map.get(id); if (p && p.tenantId === tid) map.set(id, { ...p, ...data }); },
  };
}

function makeEnrollmentRepo(enrollments: Enrollment[] = []): EnrollmentRepo {
  const map = new Map(enrollments.map((e) => [e.id, e]));
  return {
    nextId,
    async save(e) { map.set(e.id, { ...e }); },
    async getById(id, tid) { const e = map.get(id); return e && e.tenantId === tid ? e : null; },
    async findActive(pid, gid, tid) {
      return [...map.values()].find((e) => e.tenantId === tid && e.personId === pid && e.groupId === gid && e.status === "active") ?? null;
    },
    async list(tid) { return [...map.values()].filter((e) => e.tenantId === tid); },
    async listByGroup(gid, tid) { return [...map.values()].filter((e) => e.tenantId === tid && e.groupId === gid); },
    async listBySale(sid, tid) { return [...map.values()].filter((e) => e.tenantId === tid && e.saleId === sid); },
  };
}

let passed = 0;
let failed = 0;
function assert(label: string, ok: boolean) {
  if (ok) { passed++; console.log(`  ✅ ${label}`); }
  else { failed++; console.error(`  ❌ ${label}`); }
}

async function run() {
  console.log("\n=== standaloneMode Switch Assertions ===\n");

  // 1. resolvePackages varsayılan (opts yok) — eğitmen grup+kişi yaratabilir (geriye dönük uyumlu)
  {
    const grants = resolvePackages(["egitmen"]);
    const caps = grants.map((g) => g.capability);
    assert("Varsayılan resolvePackages — group.create VAR", caps.includes("group.create"));
    assert("Varsayılan resolvePackages — person.create VAR", caps.includes("person.create"));
  }

  // 2. standaloneMode: true — eğitmen grup+kişi yaratabilir
  {
    const grants = resolvePackages(["egitmen"], { standaloneMode: true });
    const caps = grants.map((g) => g.capability);
    assert("standaloneMode true — group.create VAR", caps.includes("group.create"));
    assert("standaloneMode true — person.create VAR", caps.includes("person.create"));
    assert("standaloneMode true — group.assign_student VAR", caps.includes("group.assign_student"));
  }

  // 3. standaloneMode: false — eğitmen grup+kişi YARATAMAZ ama okuyabilir/not girebilir
  {
    const grants = resolvePackages(["egitmen"], { standaloneMode: false });
    const caps = grants.map((g) => g.capability);
    assert("standaloneMode false — group.create YOK", !caps.includes("group.create"));
    assert("standaloneMode false — person.create YOK", !caps.includes("person.create"));
    assert("standaloneMode false — group.assign_student YOK", !caps.includes("group.assign_student"));
    assert("standaloneMode false — group.read KALDI", caps.includes("group.read"));
    assert("standaloneMode false — grade.write KALDI", caps.includes("grade.write"));
    assert("standaloneMode false — enrollment.read KALDI", caps.includes("enrollment.read"));
  }

  // 4. standaloneMode diğer paketleri etkilemez (admin değişmez)
  {
    const adminFalse = resolvePackages(["admin"], { standaloneMode: false }).length;
    const adminDefault = resolvePackages(["admin"]).length;
    assert("standaloneMode admin paketini etkilemiyor", adminFalse === adminDefault);
  }

  // 5. buildActor → can() entegre testi
  {
    const actorIntegrated = buildActor({ uid: "u1", tenantId: TENANT, packages: ["egitmen"], standaloneMode: false, groupIds: ["g1"] });
    const actorStandalone = buildActor({ uid: "u2", tenantId: TENANT, packages: ["egitmen"], standaloneMode: true, groupIds: ["g1"] });
    assert("Entegre modda eğitmen group.create YAPAMAZ", !can(actorIntegrated, "group.create", { groupId: "g1" }));
    assert("Standalone modda eğitmen group.create YAPABİLİR", can(actorStandalone, "group.create", { groupId: "g1" }));
    assert("Entegre modda eğitmen grade.write YAPABİLİR", can(actorIntegrated, "grade.write", { groupId: "g1" }));
  }

  // 6. settings-service — admin okuyup/yazabilir, eğitmen yazamaz
  {
    const repo = makeSettingsRepo();
    const def = await getSettings(makeActor("admin"), repo);
    assert("Ayar yoksa varsayılan standaloneMode=false", def.standaloneMode === false);

    const updated = await updateSettings(makeActor("admin"), { standaloneMode: true }, repo);
    assert("Admin switch'i açabilir", updated.standaloneMode === true);

    const reread = await getSettings(makeActor("admin"), repo);
    assert("Kaydedilen değer geri okunuyor", reread.standaloneMode === true);

    try {
      await updateSettings(makeActor("egitmen"), { standaloneMode: false }, repo);
      assert("Eğitmen switch değiştiremez (ForbiddenError)", false);
    } catch (e) {
      assert("Eğitmen switch değiştiremez (ForbiddenError)", e instanceof ForbiddenError);
    }
  }

  // 7. Standalone eğitmen — kendi grubunu açar, kendi öğrencisini ekler/atar (ownerUid eşleşmesi,
  //    `groupIds` claim'i hiç YOK — actor.groupIds undefined)
  {
    const trainer = buildActor({ uid: "trainer-1", tenantId: TENANT, packages: ["egitmen"], standaloneMode: true });
    const groupRepo = makeGroupRepo();
    const personRepo = makePersonRepo();
    const enrollmentRepo = makeEnrollmentRepo();

    const group = await createGroup(trainer, {
      code: "G-STANDALONE-1",
      type: "standart",
      schedule: { startDate: "2026-09-01", days: [1], sessionHours: 3 },
    }, { groups: groupRepo });
    assert("Standalone eğitmen grup açabilir", !!group.id);
    assert("Yeni grubun trainerId'si oluşturan eğitmen", group.trainerId === "trainer-1");

    const person: Person = {
      id: personRepo.nextId(), tenantId: TENANT, firstName: "Test", lastName: "Öğrenci",
      status: "active", consentKVKK: false, createdAt: new Date().toISOString(), createdBy: "trainer-1",
    };
    await personRepo.save(person);

    const enrollment = await createEnrollment(trainer, { personId: person.id, groupId: group.id }, {
      enrollments: enrollmentRepo, persons: personRepo, groups: groupRepo,
    });
    assert("Standalone eğitmen kendi grubuna kayıt açabilir (groupIds claim'i olmadan)", enrollment.status === "active");

    // Başka eğitmenin grubuna SADECE ownerUid eşleşmiyorsa erişemez
    const otherTrainer = buildActor({ uid: "trainer-2", tenantId: TENANT, packages: ["egitmen"], standaloneMode: true });
    try {
      await createEnrollment(otherTrainer, { personId: person.id, groupId: group.id }, {
        enrollments: enrollmentRepo, persons: personRepo, groups: groupRepo,
      });
      assert("Başka eğitmen yabancı gruba kayıt açamaz (ForbiddenError)", false);
    } catch (e) {
      assert("Başka eğitmen yabancı gruba kayıt açamaz (ForbiddenError)", e instanceof ForbiddenError);
    }

    // assignToGroup — grupsuz (havuzdaki) bir kayıt → eğitmenin kendi grubuna atanır
    const person2: Person = { ...person, id: personRepo.nextId() };
    await personRepo.save(person2);
    const ungroupedId = enrollmentRepo.nextId();
    const ungrouped: Enrollment = {
      id: ungroupedId, tenantId: TENANT, personId: person2.id, status: "active",
      createdAt: new Date().toISOString(), createdBy: "trainer-1",
    };
    await enrollmentRepo.save(ungrouped);
    const assigned = await assignToGroup(trainer, { enrollmentId: ungroupedId, groupId: group.id }, {
      enrollments: enrollmentRepo, groups: groupRepo,
    });
    assert("Standalone eğitmen kendi grubuna atama yapabilir", assigned.groupId === group.id);
  }

  console.log(`\n=== Sonuç: ${passed} geçti, ${failed} başarısız ===\n`);
  if (failed > 0) process.exit(1);
}

run();
