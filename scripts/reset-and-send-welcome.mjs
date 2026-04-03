/**
 * reset-and-send-welcome.mjs
 *
 * Çalıştırma:
 *   node --env-file=.env.local scripts/reset-and-send-welcome.mjs
 *
 * Ne yapar:
 *   1. Firestore'da welcomeEmailSent: true olan tüm öğrencileri bulk olarak sıfırlar.
 *   2. /api/admin/send-welcome-all endpoint'ini çağırır → sıfırlanan herkese mail gider.
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// ─── Config ──────────────────────────────────────────────────────────────────

const SITE_URL    = "https://flex-one-iota.vercel.app";
const ADMIN_SECRET = process.env.ADMIN_SECRET;

const required = [
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "ADMIN_SECRET",
];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`[hata] Eksik env var: ${key}`);
    process.exit(1);
  }
}

// ─── Firebase Admin ───────────────────────────────────────────────────────────

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId:   process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}

const db = getFirestore();

// ─── Adım 1: welcomeEmailSent flag'ini sıfırla ───────────────────────────────

async function resetFlags() {
  const snap = await db
    .collection("students")
    .where("welcomeEmailSent", "==", true)
    .get();

  if (snap.empty) {
    console.log("[1/2] welcomeEmailSent: true olan kayıt yok, sıfırlama atlandı.");
    return 0;
  }

  // Firestore batch limiti 500 — gerekirse parçala
  const chunks = [];
  for (let i = 0; i < snap.docs.length; i += 500) {
    chunks.push(snap.docs.slice(i, i + 500));
  }

  let total = 0;
  for (const chunk of chunks) {
    const batch = db.batch();
    for (const doc of chunk) {
      batch.update(doc.ref, { welcomeEmailSent: FieldValue.delete() });
    }
    await batch.commit();
    total += chunk.length;
  }

  console.log(`[1/2] ${total} kayıtta welcomeEmailSent flag'i silindi.`);
  return total;
}

// ─── Adım 2: Endpoint'i çağır ────────────────────────────────────────────────

async function sendWelcomeAll() {
  console.log("[2/2] /api/admin/send-welcome-all çağrılıyor...");

  const res = await fetch(`${SITE_URL}/api/admin/send-welcome-all`, {
    method: "POST",
    headers: { "x-admin-secret": ADMIN_SECRET },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[hata] Endpoint ${res.status} döndü:`, text);
    process.exit(1);
  }

  const data = await res.json();
  console.log("[2/2] Sonuç:", data);
  return data;
}

// ─── Ana akış ─────────────────────────────────────────────────────────────────

(async () => {
  console.log("=== reset-and-send-welcome başlatılıyor ===\n");

  await resetFlags();
  const result = await sendWelcomeAll();

  console.log("\n=== Tamamlandı ===");
  console.log(`  Gönderilen : ${result.sent}`);
  console.log(`  Atlanan    : ${result.skipped}  (email yok)`);
  console.log(`  Başarısız  : ${result.failed}`);

  if (result.errors?.length) {
    console.log("  Hatalar:");
    result.errors.forEach(e => console.log("   -", e));
  }
})();
