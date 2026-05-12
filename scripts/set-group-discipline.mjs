/**
 * set-group-discipline.mjs
 * Mevcut tüm gruplara discipline alanı ekler.
 *
 * Kullanım:
 *   node scripts/set-group-discipline.mjs --dry-run   (sadece listeler, yazmaz)
 *   node scripts/set-group-discipline.mjs             (yazar)
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { resolve } from "path";

const isDryRun = process.argv.includes("--dry-run");
const serviceAccount = JSON.parse(readFileSync(resolve("service-account.json"), "utf8"));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function main() {
  // "Tasarım" adlı branşı bul
  const branchSnap = await db.collection("branches").get();
  const designBranch = branchSnap.docs.find(d => {
    const n = (d.data().name || "").toLowerCase();
    return n.includes("tasarım") || n.includes("tasarim") || n.includes("design") || n.includes("grafik");
  });

  if (!designBranch) {
    console.error("Tasarım branşı bulunamadı. Önce Branşlar sekmesinden ekleyin.");
    process.exit(1);
  }

  console.log(`Tasarım branş ID: ${designBranch.id} (${designBranch.data().name})`);

  const groupsSnap = await db.collection("groups").get();
  let updated = 0, skipped = 0;

  for (const d of groupsSnap.docs) {
    const data = d.data();
    if (data.discipline) { skipped++; continue; }

    console.log(`${isDryRun ? "[DRY]" : "[YAZ]"} ${d.id} — ${data.code || "?"}`);
    if (!isDryRun) {
      await d.ref.update({ discipline: designBranch.id });
    }
    updated++;
  }

  console.log(`\nTamamlandı: ${updated} güncellendi, ${skipped} atlandı (zaten discipline var).`);
}

main().catch(console.error);
