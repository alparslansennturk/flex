/**
 * send-welcome-group550.mjs
 *
 * Çalıştırma (önce listele):
 *   node --env-file=.env.local scripts/send-welcome-group550.mjs
 *
 * Onaydan sonra gönder:
 *   node --env-file=.env.local scripts/send-welcome-group550.mjs --send
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const SITE_URL  = process.env.NEXT_PUBLIC_APP_URL ?? "https://flex-one-iota.vercel.app";
const DRY_RUN   = !process.argv.includes("--send");
const GROUP_CODE = "Grup 550";

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

(async () => {
  console.log(`=== ${GROUP_CODE} — Welcome Mail ${DRY_RUN ? "(DRY RUN — sadece listele)" : "GÖNDERİMİ"} ===\n`);

  // 1. Grubu bul
  const groupSnap = await db.collection("groups")
    .where("code", "==", GROUP_CODE)
    .limit(1)
    .get();

  let groupId   = null;
  let groupCode = GROUP_CODE;

  if (!groupSnap.empty) {
    groupId   = groupSnap.docs[0].id;
    groupCode = groupSnap.docs[0].data().code ?? GROUP_CODE;
    console.log(`Grup bulundu: ${groupId} (code: ${groupCode})\n`);
  } else {
    console.warn(`[uyarı] "${GROUP_CODE}" bulunamadı — groupCode ile aranıyor.\n`);
  }

  // 2. Öğrencileri çek
  let studentDocs = [];

  if (groupId) {
    const snap = await db.collection("students").where("groupId", "==", groupId).get();
    studentDocs = snap.docs.filter(d => d.data().status !== "passive");
  }
  if (!studentDocs.length) {
    const snap = await db.collection("students").where("groupCode", "==", GROUP_CODE).get();
    studentDocs = snap.docs.filter(d => d.data().status !== "passive");
  }

  if (!studentDocs.length) {
    console.error(`[hata] ${GROUP_CODE} için öğrenci bulunamadı.`);
    process.exit(1);
  }

  // 3. Listele
  console.log(`Toplam ${studentDocs.length} öğrenci:\n`);
  const students = studentDocs.map((doc, i) => {
    const d    = doc.data();
    const name = `${d.name ?? ""} ${d.lastName ?? ""}`.trim();
    const email = d.email ?? "(email yok)";
    const sent  = d.welcomeEmailSent ? " [daha önce gönderildi]" : "";
    console.log(`  ${String(i + 1).padStart(2, " ")}. ${name.padEnd(30, " ")} ${email}${sent}`);
    return { studentDocId: doc.id, name, email: d.email, groupId, groupCode };
  });

  if (DRY_RUN) {
    console.log(`\n[DRY RUN] Mail gönderilmedi.`);
    console.log(`Göndermek için: node --env-file=.env.local scripts/send-welcome-group550.mjs --send\n`);
    process.exit(0);
  }

  // 4. Gönder
  console.log("\nGönderim başlıyor...\n");
  let ok = 0; let fail = 0;

  for (const s of students) {
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

    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n=== Tamamlandı: ${ok} başarılı, ${fail} başarısız ===`);
})();
