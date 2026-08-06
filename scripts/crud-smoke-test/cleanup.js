/**
 * FlexOS — `run.js`'in ürettiği manifest.json'u okuyup TÜM test kayıtlarını admin SDK
 * ile KESİN siler (API'de hard-delete olmayan yerler: satış zinciri, sertifika notu,
 * aktivite-merkezi case+activity+prospect person, eğitmenin otomatik açtığı
 * flexos_users+Auth hesabı+aktivasyon kodu). Sonda tüm ilgili koleksiyonlarda TEST_
 * etiketi kalmadığını doğrular.
 *
 * Kullanım: node scripts/crud-smoke-test/cleanup.js
 */
"use strict";
const fs = require("fs");
const path = require("path");

function loadEnvLocal(p) {
  const txt = fs.readFileSync(p, "utf8");
  for (const line of txt.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnvLocal(path.resolve(__dirname, "../../.env.local"));

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

const app = initializeApp({
  credential: cert({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replaceAll(/\\n/g, "\n"),
  }),
});
const db = getFirestore(app);
const auth = getAuth(app);

const manifestPath = path.resolve(__dirname, "manifest.json");
if (!fs.existsSync(manifestPath)) {
  console.error("manifest.json yok — önce `node scripts/crud-smoke-test/run.js` çalıştırılmalı.");
  process.exit(1);
}
const { manifest, TEST_EMAIL_TRAINER, TEST_EMAIL_USER, TEST_TAG } = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

const report = [];
function log(what, ok, detail) {
  report.push({ what, ok, detail: detail || "" });
  console.log(`${ok ? "🗑️ " : "⚠️ "} ${what}${detail ? " — " + detail : ""}`);
}

async function safeDeleteDoc(collection, id, label) {
  if (!id) return;
  try {
    const ref = db.collection(collection).doc(id);
    const snap = await ref.get();
    if (!snap.exists) { log(label, true, `zaten yok (${collection}/${id})`); return; }
    await ref.delete();
    log(label, true, `silindi (${collection}/${id})`);
  } catch (e) { log(label, false, `${collection}/${id}: ${e.message}`); }
}

async function deleteWhere(collection, field, value, label) {
  if (!value) return;
  try {
    const snap = await db.collection(collection).where(field, "==", value).get();
    for (const d of snap.docs) await d.ref.delete();
    log(label, true, `${snap.size} kayıt silindi`);
  } catch (e) { log(label, false, e.message); }
}

async function main() {
  console.log(`\n=== Temizlik — ${TEST_TAG} ===\n`);

  await safeDeleteDoc("persons", manifest.personId, "Person (TEST öğrenci — satış)");
  await safeDeleteDoc("enrollments", manifest.testEnrollmentId, "Enrollment");
  await safeDeleteDoc("flexos_sales", manifest.saleId, "Sale");
  await deleteWhere("flexos_payments", "saleId", manifest.saleId, "Payments (saleId eşleşen)");

  await safeDeleteDoc("flexos_submissions", manifest.submissionId, "Submission (manuel not)");
  await safeDeleteDoc("flexos_grades", manifest.testEnrollmentId, "Grade (Sertifika Notu, doc id = enrollmentId)");

  await safeDeleteDoc("flexos_cases", manifest.caseId, "Case");
  await deleteWhere("flexos_activities", "caseId", manifest.caseId, "Activities (caseId eşleşen)");

  // Cases POST'u personId verilmezse kendi "prospect" Person'ını yaratır — manifest'te
  // ID'si yok, TEST_TAG ile ("Aday" soyadıyla) bulunup silinir.
  await deleteWhere("persons", "firstName", TEST_TAG, "Prospect person (Aktivite Merkezi testinden)");

  // Eğitmenin provisionTrainerLogin yan etkisi — trainer DELETE bunu temizlemez.
  if (TEST_EMAIL_TRAINER) {
    try {
      const usnap = await db.collection("flexos_users").where("email", "==", TEST_EMAIL_TRAINER).get();
      for (const d of usnap.docs) {
        const u = d.data();
        if (u.authUid) {
          try { await auth.deleteUser(u.authUid); log("Trainer Auth hesabı", true, u.authUid); }
          catch (e) { log("Trainer Auth hesabı", false, e.message); }
        }
        await d.ref.delete();
        log("Trainer flexos_users dokümanı", true, d.id);
      }
      if (usnap.empty) log("Trainer flexos_users dokümanı", true, "bulunamadı (zaten yok)");
    } catch (e) { log("Trainer flexos_users temizliği", false, e.message); }

    try {
      const au = await auth.getUserByEmail(TEST_EMAIL_TRAINER);
      await auth.deleteUser(au.uid);
      log("Trainer Auth hesabı (ek kontrol)", true, au.uid);
    } catch (e) {
      if (e.code === "auth/user-not-found") log("Trainer Auth hesabı (ek kontrol)", true, "yok");
      else log("Trainer Auth hesabı (ek kontrol)", false, e.message);
    }

    await deleteWhere("flexos_codes", "email", TEST_EMAIL_TRAINER, "Trainer flexos_codes");
  }

  // Kullanıcılar testi zaten kendi DELETE'ini API üzerinden yaptı (Firestore+Auth) — burada
  // sadece kalıntı kontrolü (flexos_codes silinmemiş olabilir, deleteFlexosUser onu temizlemiyor).
  if (TEST_EMAIL_USER) {
    await deleteWhere("flexos_codes", "email", TEST_EMAIL_USER, "Kullanıcı testi flexos_codes (varsa)");
    try {
      const au = await auth.getUserByEmail(TEST_EMAIL_USER);
      await auth.deleteUser(au.uid);
      log("Kullanıcı testi Auth hesabı (ek kontrol)", true, au.uid);
    } catch (e) {
      if (e.code === "auth/user-not-found") log("Kullanıcı testi Auth hesabı (ek kontrol)", true, "yok");
      else log("Kullanıcı testi Auth hesabı (ek kontrol)", false, e.message);
    }
  }

  // Activity log — TEST grubu/eğitmen/case/ödev ile ilişkili kayıtlar (varsa).
  // Bunlar zaten null olabilir (API DELETE başarılıysa) — results.json'daki orijinal
  // Create id'lerini de ayrıca kontrol ediyoruz.
  const idsByField = { groupId: new Set(), trainerId: new Set(), caseId: new Set(), assignmentId: new Set() };
  if (manifest.caseId) idsByField.caseId.add(manifest.caseId);
  try {
    const resultsPath = path.resolve(__dirname, "results.json");
    const results = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
    const grab = (mod, op, field, set) => {
      const hit = results.find((r) => r.module === mod && r.op === op && r.ok && r.detail.includes("id="));
      if (hit) set.add(hit.detail.match(/id=([^\s)]+)/)?.[1]);
    };
    grab("Gruplar", "Create", "groupId", idsByField.groupId);
    grab("Eğitmenler", "Create", "trainerId", idsByField.trainerId);
  } catch { /* results.json yoksa/okunamazsa kritik değil, atla */ }

  for (const [field, ids] of Object.entries(idsByField)) {
    for (const id of ids) {
      if (!id) continue;
      try {
        const snap = await db.collection("flexos_activity_log").where(field, "==", id).get();
        if (!snap.empty) {
          for (const d of snap.docs) await d.ref.delete();
          log(`Activity log (${field}=${id})`, true, `${snap.size} kayıt silindi`);
        }
      } catch { /* alan yoksa/index yoksa sessizce geç */ }
    }
  }

  // ============================================================
  // DOĞRULAMA — tüm dokunulan koleksiyonlarda TEST_ etiketi kaldı mı?
  // ============================================================
  console.log("\n=== DOĞRULAMA (kalıntı taraması) ===");
  const collections = [
    "persons", "enrollments", "flexos_sales", "flexos_payments", "flexos_groups",
    "flexos_trainers", "flexos_users", "flexos_cases", "flexos_activities",
    "flexos_assignments", "flexos_assignment_templates", "flexos_grades",
    "flexos_submissions", "flexos_attendance", "flexos_codes",
  ];
  let totalFound = 0;
  for (const coll of collections) {
    const snap = await db.collection(coll).get();
    const hits = snap.docs.filter((d) => JSON.stringify(d.data()).includes(TEST_TAG));
    if (hits.length > 0) {
      totalFound += hits.length;
      console.log(`⚠️  ${coll}: ${hits.length} kayıt hâlâ "${TEST_TAG}" içeriyor`);
      hits.forEach((h) => console.log("    ", h.id));
    } else {
      console.log(`✅ ${coll}: temiz`);
    }
  }
  for (const email of [TEST_EMAIL_TRAINER, TEST_EMAIL_USER].filter(Boolean)) {
    try { await auth.getUserByEmail(email); console.log(`⚠️  Auth hesabı hâlâ var: ${email}`); totalFound++; }
    catch { console.log(`✅ Auth hesabı yok: ${email}`); }
  }

  fs.writeFileSync(path.resolve(__dirname, "cleanup-report.json"), JSON.stringify(report, null, 2));
  const fail = report.filter((r) => !r.ok);
  console.log(`\n=== TEMİZLİK ÖZETİ === Toplam: ${report.length}, Başarılı: ${report.length - fail.length}, Başarısız: ${fail.length}`);
  if (fail.length) fail.forEach((f) => console.log(`  - ${f.what}: ${f.detail}`));
  console.log(`\n=== SONUÇ: ${totalFound === 0 ? "TAMAMEN TEMİZ ✅" : `${totalFound} kalıntı bulundu ⚠️ — manuel kontrol gerekir`} ===`);
}

main().then(() => process.exit(0)).catch((e) => { console.error("FATAL:", e); process.exit(1); });
