/**
 * send-welcome-group541.mjs
 *
 * Çalıştırma:
 *   node --env-file=.env.local scripts/send-welcome-group541.mjs
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://flex-one-iota.vercel.app";

const TARGET_NAMES = [
  "Firdevs Çalış",
  "Ferhat Gün",
  "İpek Akel",
  "Dilara Umut",
  "Zehra Uçan",
  "Betül Yılmaz",
  "Emirhan Ekşi",
];

const required = [
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
];
for (const key of required) {
  if (!process.env[key]) { console.error(`[hata] Eksik env var: ${key}`); process.exit(1); }
}

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

function normalize(str) {
  return (str ?? "").trim().toLowerCase()
    .replace(/İ/g, "i").replace(/I/g, "ı")
    .replace(/Ş/g, "ş").replace(/Ğ/g, "ğ")
    .replace(/Ü/g, "ü").replace(/Ö/g, "ö").replace(/Ç/g, "ç");
}

(async () => {
  console.log("=== Grup 541 — Welcome Mail Gönderimi ===\n");

  // 1. Grubu bul
  const groupSnap = await db.collection("groups")
    .where("code", "==", "Grup 541")
    .limit(1)
    .get();

  let groupId   = null;
  let groupCode = "Grup 541";

  if (!groupSnap.empty) {
    groupId   = groupSnap.docs[0].id;
    groupCode = groupSnap.docs[0].data().code ?? "541";
    console.log(`Grup bulundu: ${groupId} (code: ${groupCode})`);
  } else {
    console.warn("Grup 541 bulunamadı — groupId olmadan devam ediliyor.");
  }

  // 2. Öğrencileri bul (groupId veya groupCode ile)
  let studentDocs = [];
  if (groupId) {
    const snap = await db.collection("students").where("groupId", "==", groupId).get();
    studentDocs = snap.docs;
  }
  if (!studentDocs.length) {
    const snap = await db.collection("students").where("groupCode", "==", "Grup 541").get();
    studentDocs = snap.docs;
  }
  if (!studentDocs.length) {
    // Tüm öğrencileri çek, isimle eşleştir (grupId henüz atanmamış olabilir)
    const snap = await db.collection("students").get();
    studentDocs = snap.docs;
    console.warn("Grup filtresi çalışmadı — tüm öğrenciler içinde aranıyor.\n");
  }

  console.log(`Grup 541'de toplam ${studentDocs.length} öğrenci bulundu.\n`);

  // 3. Hedef öğrencileri eşleştir
  const normalizedTargets = TARGET_NAMES.map(n => ({ original: n, norm: normalize(n) }));
  const matched   = [];
  const unmatched = [...normalizedTargets];

  for (const doc of studentDocs) {
    const d    = doc.data();
    const full = `${d.name ?? ""} ${d.lastName ?? ""}`.trim();
    const norm = normalize(full);

    const idx = unmatched.findIndex(t => norm === t.norm || norm.includes(t.norm) || t.norm.includes(norm));
    if (idx !== -1) {
      matched.push({ studentDocId: doc.id, name: full, email: d.email, groupId, groupCode });
      unmatched.splice(idx, 1);
    }
  }

  if (unmatched.length) {
    console.warn("Eşleşemeyen isimler:");
    unmatched.forEach(u => console.warn("  ✗", u.original));
    console.warn("");
  }

  console.log(`Eşleşen: ${matched.length} / ${TARGET_NAMES.length}\n`);

  // 4. Her öğrenci için /api/welcome çağır
  let ok = 0; let fail = 0;
  for (const s of matched) {
    if (!s.email) {
      console.warn(`  [ATLA] ${s.name} — email yok`);
      fail++;
      continue;
    }

    process.stdout.write(`  ${s.name} (${s.email}) ... `);

    try {
      const res = await fetch(`${SITE_URL}/api/welcome`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          email:        s.email,
          name:         s.name,
          groupCode:    s.groupCode,
          groupId:      s.groupId,
          studentDocId: s.studentDocId,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        console.log("✓ gönderildi");
        ok++;
      } else {
        console.log(`✗ HATA: ${data.error ?? res.status}`);
        fail++;
      }
    } catch (e) {
      console.log(`✗ istek hatası: ${e.message}`);
      fail++;
    }

    // Rate limit için kısa bekleme
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n=== Tamamlandı: ${ok} başarılı, ${fail} başarısız ===`);
})();
