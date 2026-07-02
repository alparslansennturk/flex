/**
 * Admin Kişisel Görünüm Anahtarı (Core/Full) — PIN backend assertion'ları.
 * npx jiti scripts/assert-view-access.ts
 */
import { resolvePackages } from "../src/app/lib/domain/access/packages";
import type { Actor } from "../src/app/lib/domain/access/types";
import type { ViewPin } from "../src/app/lib/domain/core/view-pin";
import type { ViewPinRepo } from "../src/app/lib/domain/repo/view-pin-repo";
import { getViewAccessStatus, setViewPin, verifyViewPin } from "../src/app/lib/domain/services/view-access-service";
import { ForbiddenError, ValidationError } from "../src/app/lib/domain/errors";

const TENANT = "test-tenant";

// NOT (2026-07-02): `view.toggle` artık admin PAKETİNDE değil — sadece
// `auth-actor.ts`'teki VIEW_TOGGLE_OWNER_EMAIL'e özel tekil grant (extraGrants).
// Burada gerçek owner'ı simüle etmek için grant'i elle ekliyoruz.
function makeActor(pkg: "admin" | "egitmen", asViewToggleOwner = false): Actor {
  const grants = resolvePackages([pkg]);
  if (asViewToggleOwner) grants.push({ capability: "view.toggle", scope: "org" });
  return { type: "human", uid: `user-${pkg}`, tenantId: TENANT, grants };
}

function makeViewPinRepo(): ViewPinRepo {
  const map = new Map<string, ViewPin>();
  return {
    async get(uid) { return map.get(uid) ?? null; },
    async save(pin) { map.set(pin.uid, { ...pin }); },
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

async function main() {
  console.log("\n=== Admin Kişisel Görünüm Anahtarı — PIN Assertions ===\n");

  const admin = makeActor("admin", true); // owner simülasyonu — tekil grant eklendi
  const plainAdmin = makeActor("admin"); // sıradan admin — view.toggle grant'i YOK
  const egitmen = makeActor("egitmen");

  // ── capability gating ──
  await assertRejects(
    "Eğitmen (view.toggle yok) status okuyamaz — ForbiddenError",
    () => getViewAccessStatus(egitmen, makeViewPinRepo()),
    ForbiddenError,
  );
  await assertRejects(
    "Sıradan admin (paket-seviyeli view.toggle artık yok) status okuyamaz — ForbiddenError",
    () => getViewAccessStatus(plainAdmin, makeViewPinRepo()),
    ForbiddenError,
  );
  await assertRejects(
    "Eğitmen PIN doğrulayamaz — ForbiddenError",
    () => verifyViewPin(egitmen, "1234", makeViewPinRepo()),
    ForbiddenError,
  );
  await assertRejects(
    "Eğitmen PIN kuramaz — ForbiddenError",
    () => setViewPin(egitmen, { newPin: "1234" }, makeViewPinRepo()),
    ForbiddenError,
  );

  // ── ilk kurulum (seed) ──
  {
    const repo = makeViewPinRepo();
    const status0 = await getViewAccessStatus(admin, repo);
    assert("Admin — PIN kurulmadan önce hasPin=false", status0.hasPin === false);

    await setViewPin(admin, { newPin: "1234" }, repo);
    const status1 = await getViewAccessStatus(admin, repo);
    assert("Admin — ilk PIN kurulumundan sonra hasPin=true", status1.hasPin === true);
  }

  // ── validasyon ──
  await assertRejects(
    "3 haneli PIN reddedilir",
    () => setViewPin(admin, { newPin: "123" }, makeViewPinRepo()),
    ValidationError,
  );
  await assertRejects(
    "Harf içeren PIN reddedilir",
    () => setViewPin(admin, { newPin: "12ab" }, makeViewPinRepo()),
    ValidationError,
  );

  // ── doğrulama (verify) ──
  {
    const repo = makeViewPinRepo();
    const noPinResult = await verifyViewPin(admin, "1234", repo);
    assert("PIN kurulmadan verify — ok=false, reason=no_pin", noPinResult.ok === false && noPinResult.reason === "no_pin");

    await setViewPin(admin, { newPin: "4242" }, repo);
    const wrong = await verifyViewPin(admin, "0000", repo);
    assert("Yanlış PIN — ok=false, reason=wrong", wrong.ok === false && wrong.reason === "wrong");

    const right = await verifyViewPin(admin, "4242", repo);
    assert("Doğru PIN — ok=true", right.ok === true);
  }

  // ── PIN değişimi eski PIN istemez (owner zaten auth+capability ile buraya geldi) ──
  {
    const repo = makeViewPinRepo();
    await setViewPin(admin, { newPin: "1111" }, repo);

    // "Unuttum" senaryosu: eski PIN bilinmeden direkt yeni PIN kaydedilir.
    await setViewPin(admin, { newPin: "2222" }, repo);
    const afterChange = await verifyViewPin(admin, "2222", repo);
    assert("Eski PIN bilinmeden yeni PIN kaydedilir + doğrulanır", afterChange.ok === true);
    const oldStillWorks = await verifyViewPin(admin, "1111", repo);
    assert("Eski PIN artık çalışmaz", oldStillWorks.ok === false);
  }

  // ── iki farklı owner birbirinin PIN'ini görmez/etkilemez ──
  {
    const repo = makeViewPinRepo();
    const owner1: Actor = { ...admin, uid: "owner-1" };
    const owner2: Actor = { ...admin, uid: "owner-2" };
    await setViewPin(owner1, { newPin: "1234" }, repo);
    const owner2Status = await getViewAccessStatus(owner2, repo);
    assert("owner-2'nin kendi PIN'i yok (owner-1'den etkilenmez)", owner2Status.hasPin === false);
    const owner2VerifyOwner1Pin = await verifyViewPin(owner2, "1234", repo);
    assert("owner-2, owner-1'in PIN'iyle doğrulanamaz (no_pin)", owner2VerifyOwner1Pin.ok === false && owner2VerifyOwner1Pin.reason === "no_pin");
  }

  console.log(`\n=== Sonuç: ${passed} geçti, ${failed} başarısız ===\n`);
  if (failed > 0) process.exit(1);
}

main();
