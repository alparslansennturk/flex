/**
 * generate-tokens.mjs — k6 yük testi için gerçek Firebase ID token'ları üretir.
 *
 * GÜVENLİK — SADECE `flexos-loadtest` staging projesine bağlanır, ASLA prod'a
 * (`flexos-10ac4`) dokunmaz. `service-account-staging.json` zorunlu (repo kökünde,
 * `.gitignore`'da korunuyor) — dosya yoksa VEYA `project_id` beklenenden farklıysa
 * script hiçbir şey yapmadan durur (seed-loadtest.mjs'teki AYNI güvenlik deseni).
 *
 * Ne yapar:
 *   1. `scripts/seed-loadtest.mjs`'in seed ettiği deterministik kayıtlardan (eğitmen,
 *      genel müdür, öğrenci) bir örneklem seçer.
 *   2. Bu uid'ler için Firebase Auth hesabı yoksa oluşturur (custom token/idToken
 *      üretimi var olmayan hesapta da çalışır ama withAuth sonrası Firestore tarafı
 *      `authUid` eşleşmesi bekliyor — hesap zaten var, seed onu OLUŞTURMAZ).
 *   3. Eğitmen hesaplarına `{role:"instructor"}` custom claim'i basar — production'da
 *      `api/flexos/trainers/route.ts`'in yaptığı İLE BİREBİR AYNI (bu claim olmadan
 *      `packagesForCaller` eğitmeni "egitmen" paketine düşürmez, attendance/connect
 *      403 döner). Genel müdür/öğrenci için claim GEREKMİYOR — ofis rolü yetkisi
 *      doğrudan Firestore `flexos_users.roles`'tan çözülüyor (`auth-actor.ts`).
 *   4. `createCustomToken` + Identity Toolkit REST `signInWithCustomToken` ile GERÇEK
 *      idToken'a çevirir (k6 sadece HTTP konuşur, firebase-admin/istemci SDK'sı yok).
 *   5. Sonucu `scripts/k6/.tokens.json`'a yazar (gitignore'da — canlı token içerir).
 *
 * Kullanım: node scripts/k6/generate-tokens.mjs [--trainers=10] [--students=20]
 * ID token ömrü 1 saat — k6 testini üretimden hemen sonra çalıştır.
 */

import { writeFileSync, existsSync, readFileSync } from "fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const EXPECTED_PROJECT_ID = "flexos-loadtest";
const SA_PATH = "service-account-staging.json";
const ENV_PATH = ".env.staging.local";
const OUT_PATH = "scripts/k6/.tokens.json";

const args = process.argv.slice(2);
const argNum = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? parseInt(a.split("=")[1], 10) : def;
};
const N_TRAINERS = argNum("trainers", 10);
const N_STUDENTS = argNum("students", 20);
const N_ATTENDANCE_TARGETS = argNum("attendance-targets", 20);
const BASE_URL = (args.find((x) => x.startsWith("--base-url=")) ?? "").split("=")[1] || "https://flexos-loadtest.vercel.app";

if (!existsSync(SA_PATH)) {
  console.error(`"${SA_PATH}" bulunamadı. FLEXOS.md/LOAD_TEST.md'ye bak.`);
  process.exit(1);
}
const sa = JSON.parse(readFileSync(SA_PATH, "utf8"));
if (sa.project_id !== EXPECTED_PROJECT_ID) {
  console.error(`GÜVENLİK: service-account-staging.json'ın project_id'si "${sa.project_id}", beklenen "${EXPECTED_PROJECT_ID}". Durduruldu.`);
  process.exit(1);
}
if (!existsSync(ENV_PATH)) {
  console.error(`"${ENV_PATH}" bulunamadı.`);
  process.exit(1);
}
const envText = readFileSync(ENV_PATH, "utf8");
const apiKeyMatch = envText.match(/^NEXT_PUBLIC_FIREBASE_API_KEY=(.+)$/m);
if (!apiKeyMatch) {
  console.error(`NEXT_PUBLIC_FIREBASE_API_KEY bulunamadı (${ENV_PATH}).`);
  process.exit(1);
}
const WEB_API_KEY = apiKeyMatch[1].trim();
const bypassMatch = envText.match(/^VERCEL_AUTOMATION_BYPASS_SECRET=(.+)$/m);
const BYPASS_SECRET = bypassMatch ? bypassMatch[1].trim() : "";

initializeApp({ credential: cert(sa) });
const auth = getAuth();
const db = getFirestore();

async function ensureAuthUser(uid) {
  try {
    await auth.getUser(uid);
  } catch {
    await auth.createUser({ uid });
  }
}

async function mintIdToken(uid) {
  await ensureAuthUser(uid);
  const customToken = await auth.createCustomToken(uid);
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${WEB_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`signInWithCustomToken (${uid}) başarısız: ${JSON.stringify(json)}`);
  }
  return json.idToken;
}

async function main() {
  console.log(`→ ${EXPECTED_PROJECT_ID} staging projesine bağlanıldı.`);

  // ── Eğitmenler ──────────────────────────────────────────────────────────
  const trainersSnap = await db.collection("flexos_trainers").limit(N_TRAINERS).get();
  if (trainersSnap.empty) {
    console.error("flexos_trainers boş — önce `npm run seed` çalıştır.");
    process.exit(1);
  }
  const trainers = [];
  for (const doc of trainersSnap.docs) {
    const t = doc.data();
    const groupSnap = await db.collection("flexos_groups").where("trainerId", "==", doc.id).limit(1).get();
    if (groupSnap.empty) continue;
    const group = groupSnap.docs[0];
    await ensureAuthUser(t.authUid);
    await auth.setCustomUserClaims(t.authUid, { role: "instructor" });
    const idToken = await mintIdToken(t.authUid);
    trainers.push({
      uid: t.authUid,
      idToken,
      groupId: group.id,
      conversationId: `seed-conv-class-${group.id}`,
    });
  }
  console.log(`✓ Eğitmen token'ı: ${trainers.length}`);

  // ── Admin (org-scope, attendance.write bypass) ──────────────────────────
  // `role:"admin"` custom claim = `with-auth.ts::isAdmin` — Firestore RoleDef
  // zincirine (role.manage vb.) hiç bağımlı değil, production'da gerçek sistem
  // admini için kullanılan AYNI yol. flexos_users'taki ilk kayıt uid'i kullanılır
  // (hangi ofis rolüne sahip olduğu önemsiz — claim zaten isAdmin yapıyor).
  const staffSnap = await db.collection("flexos_users").limit(1).get();
  if (staffSnap.empty) {
    console.error("flexos_users boş — önce `npm run seed` çalıştır.");
    process.exit(1);
  }
  const adminUid = staffSnap.docs[0].data().authUid;
  await ensureAuthUser(adminUid);
  await auth.setCustomUserClaims(adminUid, { role: "admin" });
  const adminIdToken = await mintIdToken(adminUid);
  console.log(`✓ Admin token'ı: ${adminUid}`);

  // Bir kerelik: RoleDef'ler flexos-loadtest'te hiç tohumlanmamış (production'da
  // Kullanıcı Ayarları ilk açıldığında otomatik olur) — `attendance.write` gibi
  // Firestore-office-rolü tabanlı capability'lerin gerçek trafik için (trainer
  // hesapları office rolü taşımasa da) doğru çözülmesi için tetikliyoruz.
  if (BASE_URL && BYPASS_SECRET) {
    const res = await fetch(`${BASE_URL}/api/flexos/role-defs`, {
      headers: { Authorization: `Bearer ${adminIdToken}`, "x-vercel-protection-bypass": BYPASS_SECRET },
    });
    console.log(res.ok ? "✓ RoleDef tohumlama tetiklendi." : `⚠ RoleDef tohumlama başarısız: ${res.status}`);
  } else {
    console.log("⚠ BASE_URL/BYPASS_SECRET verilmedi — RoleDef tohumlama atlandı (gerekirse elle tetikle).");
  }

  // ── Yoklama PATCH hedefleri (var olan kapalı kayıtlar, org-scope her zaman düzenleyebilir) ──
  const attSnap = await db.collection("flexos_attendance").limit(N_ATTENDANCE_TARGETS).get();
  const attendanceTargets = attSnap.docs.map((d) => ({ groupId: d.data().groupId, date: d.data().date }));
  console.log(`✓ Yoklama PATCH hedefi: ${attendanceTargets.length}`);

  // ── Öğrenciler ──────────────────────────────────────────────────────────
  const personsSnap = await db.collection("persons").limit(N_STUDENTS).get();
  const students = [];
  for (const doc of personsSnap.docs) {
    const p = doc.data();
    const idToken = await mintIdToken(p.authUid);
    students.push({ uid: p.authUid, idToken, personId: doc.id });
  }
  console.log(`✓ Öğrenci token'ı: ${students.length}`);

  const out = {
    generatedAt: new Date().toISOString(),
    expiresInMinutes: 60,
    baseUrl: BASE_URL,
    protectionBypass: BYPASS_SECRET,
    admin: { uid: adminUid, idToken: adminIdToken },
    trainers,
    students,
    attendanceTargets,
  };
  writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(`\n=== ${OUT_PATH} yazıldı (${trainers.length} eğitmen, ${students.length} öğrenci, 1 admin) ===`);
  console.log("NOT: idToken'lar 1 saat geçerli — k6 testini kısa süre içinde çalıştır.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
