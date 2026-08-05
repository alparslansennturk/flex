/**
 * generate-tokens-system.mjs — "Connect hariç tam sistem" k6 testi için gerçek
 * Firebase ID token'ları üretir (2026-08-05, kullanıcı isteği).
 *
 * `generate-tokens.mjs`'ten (Connect testi) AYRI tutuldu — persona seti tamamen
 * farklı (5 ofis rolü + eğitmen + öğrenci, Connect'e özgü conversationId yok, ama
 * grup/teslim/satış hedefleri var). Aynı güvenlik/claim desenleri kullanılıyor:
 *   - Eğitmen: `{role:"instructor"}` custom claim (packagesForCaller → "egitmen"
 *     paketi, assigned-scope attendance/grade capability'leri BUNSUZ çözülmez).
 *   - Ofis rolleri (genel_mudur/egitim_koordinatoru/ogrenci_isleri/satis_temsilcisi):
 *     claim GEREKMİYOR — Firestore `flexos_users.roles` + `flexos_role_defs`
 *     (önceki oturumda tohumlandı) üzerinden `resolveFlexosUserGrants` çözüyor.
 *   - Öğrenci: claim gerekmiyor, sadece personId eşleşmesi yeterli.
 *
 * `seed-loadtest.mjs --profile=system` İLE ÇALIŞTIRILMIŞ olmalı (roleCounts:
 * genel_mudur=3, satis_temsilcisi=3, ogrenci_isleri=3, egitmen=8, egitim_koordinatoru=3).
 *
 * Kullanım: node scripts/k6/generate-tokens-system.mjs
 * ID token ömrü 1 saat.
 */

import { writeFileSync, existsSync, readFileSync } from "fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const EXPECTED_PROJECT_ID = "flexos-loadtest";
const SA_PATH = "service-account-staging.json";
const ENV_PATH = ".env.staging.local";
const OUT_PATH = "scripts/k6/.tokens-system.json";

const args = process.argv.slice(2);
const argNum = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? parseInt(a.split("=")[1], 10) : def;
};
const N_STUDENTS = argNum("students", 40);
const BASE_URL = (args.find((x) => x.startsWith("--base-url=")) ?? "").split("=")[1] || "https://flexos-loadtest.vercel.app";

if (!existsSync(SA_PATH)) {
  console.error(`"${SA_PATH}" bulunamadı. LOAD_TEST.md'ye bak.`);
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
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: customToken, returnSecureToken: true }) },
  );
  const json = await res.json();
  if (!res.ok) throw new Error(`signInWithCustomToken (${uid}) başarısız: ${JSON.stringify(json)}`);
  return json.idToken;
}

async function tokensForRole(role, label) {
  const snap = await db.collection("flexos_users").where("roles", "array-contains", role).get();
  if (snap.empty) {
    console.error(`flexos_users içinde "${role}" rolü yok — seed'i --profile=system ile çalıştırdın mı?`);
    process.exit(1);
  }
  const out = [];
  for (const doc of snap.docs) {
    const u = doc.data();
    const idToken = await mintIdToken(u.authUid);
    out.push({ uid: u.authUid, idToken });
  }
  console.log(`✓ ${label} token'ı: ${out.length}`);
  return out;
}

async function main() {
  console.log(`→ ${EXPECTED_PROJECT_ID} staging projesine bağlanıldı (system profili).`);

  // ── Eğitmenler — grup + o gruba ait teslim (submission) örneklemi ──────
  const trainersSnap = await db.collection("flexos_trainers").get();
  if (trainersSnap.empty) {
    console.error("flexos_trainers boş — önce `npm run seed -- --profile=system` çalıştır.");
    process.exit(1);
  }
  const trainers = [];
  for (const doc of trainersSnap.docs) {
    const t = doc.data();
    const groupSnap = await db.collection("flexos_groups").where("trainerId", "==", doc.id).limit(1).get();
    if (groupSnap.empty) continue;
    const groupId = groupSnap.docs[0].id;

    const enrollSnap = await db.collection("enrollments").where("groupId", "==", groupId).limit(1).get();
    const studentPersonId = enrollSnap.empty ? null : enrollSnap.docs[0].data().personId;

    const subSnap = await db.collection("flexos_submissions").where("groupId", "==", groupId).where("status", "==", "submitted").get();
    const submissionIds = subSnap.docs.map((d) => d.id);

    await ensureAuthUser(t.authUid);
    await auth.setCustomUserClaims(t.authUid, { role: "instructor" });
    const idToken = await mintIdToken(t.authUid);
    trainers.push({ uid: t.authUid, idToken, groupId, studentPersonId, submissionIds });
  }
  console.log(`✓ Eğitmen token'ı: ${trainers.length} (toplam teslim hedefi: ${trainers.reduce((s, t) => s + t.submissionIds.length, 0)})`);

  // ── Ofis rolleri — claim gerekmiyor, Firestore rolü yeterli ────────────
  const genelMudur = await tokensForRole("genel_mudur", "Genel Müdür (admin)");
  const egitimKoordinatoru = await tokensForRole("egitim_koordinatoru", "Eğitim Koordinatörü (sınıf/rapor)");
  const ogrenciIsleri = await tokensForRole("ogrenci_isleri", "Öğrenci İşleri (kişi/not)");
  const satisTemsilcisi = await tokensForRole("satis_temsilcisi", "Satış Temsilcisi");

  // Bir kerelik RoleDef tohumlama tetikleyici (önceki oturumda zaten yapıldı ama
  // idempotent — zararsız, güvenlik ağı).
  if (BASE_URL && BYPASS_SECRET && genelMudur.length > 0) {
    const res = await fetch(`${BASE_URL}/api/flexos/role-defs`, {
      headers: { Authorization: `Bearer ${genelMudur[0].idToken}`, "x-vercel-protection-bypass": BYPASS_SECRET },
    });
    console.log(res.ok ? "✓ RoleDef tohumlama doğrulandı." : `⚠ RoleDef tohumlama başarısız: ${res.status}`);
  }

  // ── Öğrenciler ──────────────────────────────────────────────────────────
  // `sales_create` senaryosuyla önceki k6 koşumlarının eklediği sahte öğrencilerin
  // `authUid`'i YOK (gerçek satış akışı öğrenciye otomatik hesap açmıyor) — bunları
  // atlıyoruz, sadece seed-loadtest.mjs'in ürettiği (authUid'li) kayıtları alıyoruz.
  const personsSnap = await db.collection("persons").limit(N_STUDENTS * 3).get();
  const students = [];
  for (const doc of personsSnap.docs) {
    if (students.length >= N_STUDENTS) break;
    const p = doc.data();
    if (!p.authUid) continue;
    const idToken = await mintIdToken(p.authUid);
    students.push({ uid: p.authUid, idToken, personId: doc.id });
  }
  console.log(`✓ Öğrenci token'ı: ${students.length}`);

  const out = {
    generatedAt: new Date().toISOString(),
    expiresInMinutes: 60,
    baseUrl: BASE_URL,
    protectionBypass: BYPASS_SECRET,
    trainers,
    genelMudur,
    egitimKoordinatoru,
    ogrenciIsleri,
    satisTemsilcisi,
    students,
  };
  writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(`\n=== ${OUT_PATH} yazıldı ===`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
