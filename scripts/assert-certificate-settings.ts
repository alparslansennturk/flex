/**
 * CertificateSettings (certificate-settings-service.ts) assertion'ları — jiti ile çalıştırılır.
 * npx jiti scripts/assert-certificate-settings.ts
 */
import { getCertificateSettings, updateCertificateSettings } from "../src/app/lib/domain/services/certificate-settings-service";
import type { Actor } from "../src/app/lib/domain/access/types";
import type { CertificateSettings } from "../src/app/lib/domain/education/certificate-settings";
import type { CertificateSettingsRepo } from "../src/app/lib/domain/repo/certificate-settings-repo";
import { ForbiddenError, ValidationError } from "../src/app/lib/domain/errors";
import { resolvePackages } from "../src/app/lib/domain/access/packages";

const TENANT = "test-tenant";

function makeActor(
  pkg: "admin" | "satis" | "operasyon" | "egitmen" | "finans",
  opts?: { standaloneMode?: boolean; uid?: string },
): Actor {
  return {
    type: "human",
    uid: opts?.uid ?? `user-${pkg}`,
    tenantId: TENANT,
    grants: resolvePackages([pkg], { standaloneMode: opts?.standaloneMode }),
  };
}

function makeRepo(initial: CertificateSettings[] = []): CertificateSettingsRepo {
  const map = new Map(initial.map((s) => [s.trainerId ? `${s.tenantId}_${s.trainerId}` : s.tenantId, s]));
  return {
    async get(tid) {
      const s = map.get(tid);
      if (!s || s.tenantId !== tid || s.trainerId) return null;
      return s;
    },
    async getByTrainer(tid, trainerId) {
      const s = map.get(`${tid}_${trainerId}`);
      if (!s || s.tenantId !== tid || s.trainerId !== trainerId) return null;
      return s;
    },
    async save(s) {
      const id = s.trainerId ? `${s.tenantId}_${s.trainerId}` : s.tenantId;
      map.set(id, { ...s });
    },
  };
}

let passed = 0;
let failed = 0;
function assert(label: string, ok: boolean) {
  if (ok) { passed++; console.log(`  ✅ ${label}`); }
  else { failed++; console.error(`  ❌ ${label}`); }
}

async function run() {
  console.log("\n=== CertificateSettings Assertions ===\n");

  // 1. Hiç kayıt yokken varsayılan döner (proje: açık %70, sınav: kapalı %100)
  {
    const settings = await getCertificateSettings(makeActor("egitmen"), makeRepo());
    assert("Varsayılan — proje odevAktif true", settings.project.odevAktif === true);
    assert("Varsayılan — proje sertifikaPct 70", settings.project.sertifikaPct === 70);
    assert("Varsayılan — sınav odevAktif FALSE", settings.exam.odevAktif === false);
    assert("Varsayılan — sınav sertifikaPct 100", settings.exam.sertifikaPct === 100);
  }

  // 2. Admin güncelleyebilir (tenant varsayılanı, trainerId YOK) — proje+sınav birlikte
  {
    const repo = makeRepo();
    const result = await updateCertificateSettings(
      makeActor("admin"),
      { project: { odevAktif: false, sertifikaPct: 100 }, exam: { odevAktif: true, sertifikaPct: 80 } },
      repo,
    );
    assert("Admin güncelleyebilir — proje", result.project.odevAktif === false && result.project.sertifikaPct === 100);
    assert("Admin güncelleyebilir — sınav (default'un tersine açılabilir)", result.exam.odevAktif === true && result.exam.sertifikaPct === 80);
    assert("Admin yazımı — trainerId YOK (tenant varsayılanı)", result.trainerId === undefined);
    assert("updatedAt dolu", !!result.updatedAt);
  }

  // 3. Operasyon güncelleyebilir (tenant varsayılanı)
  {
    const repo = makeRepo();
    const result = await updateCertificateSettings(
      makeActor("operasyon"),
      { project: { odevAktif: true, sertifikaPct: 60 }, exam: { odevAktif: false, sertifikaPct: 100 } },
      repo,
    );
    assert("Operasyon güncelleyebilir", result.project.sertifikaPct === 60);
  }

  // 4. Eğitmen — FULL (entegre) modda güncelleyemez (standaloneMode:false → self-scope grant düşer)
  {
    try {
      await updateCertificateSettings(
        makeActor("egitmen", { standaloneMode: false }),
        { project: { odevAktif: true, sertifikaPct: 50 }, exam: { odevAktif: false, sertifikaPct: 100 } },
        makeRepo(),
      );
      assert("Eğitmen Full modda güncelleyemez (ForbiddenError)", false);
    } catch (e) {
      assert("Eğitmen Full modda güncelleyemez (ForbiddenError)", e instanceof ForbiddenError);
    }
  }

  // 5. Eğitmen — standalone/Core modda KENDİ override'ını yazabilir
  {
    const repo = makeRepo();
    const actor = makeActor("egitmen", { standaloneMode: true, uid: "trainer-1" });
    const result = await updateCertificateSettings(
      actor,
      { project: { odevAktif: false, sertifikaPct: 100 }, exam: { odevAktif: true, sertifikaPct: 90 } },
      repo,
    );
    assert("Eğitmen standalone modda kendi override'ını yazabilir", result.project.sertifikaPct === 100);
    assert("Eğitmen — sınav bazlı için ödevi kendi isteğiyle AÇABİLİR", result.exam.odevAktif === true);
    assert("Eğitmen yazımı — trainerId KENDİ uid'i", result.trainerId === "trainer-1");
  }

  // 6. Satış güncelleyemez (hiçbir scope'ta yetkisi yok)
  {
    try {
      await updateCertificateSettings(
        makeActor("satis"),
        { project: { odevAktif: true, sertifikaPct: 50 }, exam: { odevAktif: false, sertifikaPct: 100 } },
        makeRepo(),
      );
      assert("Satış güncelleyemez (ForbiddenError)", false);
    } catch (e) {
      assert("Satış güncelleyemez (ForbiddenError)", e instanceof ForbiddenError);
    }
  }

  // 7. Aralık dışı sertifikaPct (proje) → ValidationError
  {
    try {
      await updateCertificateSettings(
        makeActor("admin"),
        { project: { odevAktif: true, sertifikaPct: 150 }, exam: { odevAktif: false, sertifikaPct: 100 } },
        makeRepo(),
      );
      assert("Aralık dışı proje sertifikaPct → ValidationError", false);
    } catch (e) {
      assert("Aralık dışı proje sertifikaPct → ValidationError", e instanceof ValidationError);
    }
  }

  // 7b. Aralık dışı sertifikaPct (sınav) → ValidationError
  {
    try {
      await updateCertificateSettings(
        makeActor("admin"),
        { project: { odevAktif: true, sertifikaPct: 70 }, exam: { odevAktif: true, sertifikaPct: -10 } },
        makeRepo(),
      );
      assert("Aralık dışı sınav sertifikaPct → ValidationError", false);
    } catch (e) {
      assert("Aralık dışı sınav sertifikaPct → ValidationError", e instanceof ValidationError);
    }
  }

  // 8. Eğitmen kendi kuralını vermemişse tenant varsayılanına düşer (asıl kullanıcı senaryosu)
  {
    const repo = makeRepo();
    await updateCertificateSettings(
      makeActor("admin"),
      { project: { odevAktif: false, sertifikaPct: 100 }, exam: { odevAktif: true, sertifikaPct: 90 } },
      repo,
    );
    const trainerRead = await getCertificateSettings(makeActor("egitmen", { standaloneMode: true, uid: "trainer-2" }), repo);
    assert("Kuralsız eğitmen tenant varsayılanını görür — proje", trainerRead.project.odevAktif === false && trainerRead.project.sertifikaPct === 100);
    assert("Kuralsız eğitmen tenant varsayılanını görür — sınav", trainerRead.exam.odevAktif === true && trainerRead.exam.sertifikaPct === 90);
  }

  // 9. Eğitmen kendi kuralını verdikten sonra ONU görür (tenant varsayılanı DEĞİL)
  {
    const repo = makeRepo();
    await updateCertificateSettings(
      makeActor("admin"),
      { project: { odevAktif: false, sertifikaPct: 100 }, exam: { odevAktif: false, sertifikaPct: 100 } },
      repo,
    );
    const actor = makeActor("egitmen", { standaloneMode: true, uid: "trainer-3" });
    await updateCertificateSettings(actor, { project: { odevAktif: true, sertifikaPct: 50 }, exam: { odevAktif: false, sertifikaPct: 100 } }, repo);
    const readBack = await getCertificateSettings(actor, repo);
    assert("Kendi kuralı olan eğitmen KENDİ ayarını görür (tenant değil)", readBack.project.odevAktif === true && readBack.project.sertifikaPct === 50);
  }

  // 10. Bir eğitmenin kendi override'ı BAŞKA eğitmeni/tenant'ı ETKİLEMEZ
  {
    const repo = makeRepo();
    await updateCertificateSettings(
      makeActor("admin"),
      { project: { odevAktif: true, sertifikaPct: 70 }, exam: { odevAktif: false, sertifikaPct: 100 } },
      repo,
    );
    await updateCertificateSettings(
      makeActor("egitmen", { standaloneMode: true, uid: "trainer-4" }),
      { project: { odevAktif: false, sertifikaPct: 100 }, exam: { odevAktif: true, sertifikaPct: 90 } },
      repo,
    );
    const tenantRead = await getCertificateSettings(makeActor("admin"), repo);
    const otherTrainerRead = await getCertificateSettings(makeActor("egitmen", { standaloneMode: true, uid: "trainer-5" }), repo);
    assert("Admin — kendi tenant varsayılanını görmeye devam eder (eğitmen etkilemez)", tenantRead.project.sertifikaPct === 70);
    assert("Başka eğitmen — kuralsız, tenant varsayılanını görür", otherTrainerRead.project.sertifikaPct === 70 && otherTrainerRead.exam.odevAktif === false);
  }

  console.log(`\n=== Sonuç: ${passed} geçti, ${failed} başarısız ===\n`);
  if (failed > 0) process.exit(1);
}

run();
