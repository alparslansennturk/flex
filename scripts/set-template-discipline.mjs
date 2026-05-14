/**
 * set-template-discipline.mjs
 * discipline alanı olmayan tüm şablonlara grafik tasarım branch ID'si atar.
 * scope (personal/global/gamified) kesinlikle değiştirilmez.
 *
 * Kullanım:
 *   node scripts/set-template-discipline.mjs --dry-run   (sadece listeler, yazmaz)
 *   node scripts/set-template-discipline.mjs             (Firestore'a yazar)
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
  // 1. Grafik tasarım branch ID'sini bul
  const branchSnap = await db.collection("branches").get();
  const grafikBranch = branchSnap.docs.find(d =>
    d.data().name?.toLowerCase().includes("grafik")
  );

  if (!grafikBranch) {
    console.error("HATA: 'grafik' içeren bir branş bulunamadı. branches koleksiyonunu kontrol et.");
    process.exit(1);
  }

  const grafikId = grafikBranch.id;
  console.log(`✓ Grafik branş: "${grafikBranch.data().name}" → ID: ${grafikId}\n`);

  // 2. discipline olmayan şablonları güncelle
  const snap = await db.collection("templates").get();
  let updated = 0, skipped = 0;

  for (const d of snap.docs) {
    const data = d.data();

    if (data.discipline) {
      console.log(`[ATLA] ${data.name} (${data.scope ?? "scope yok"}) — discipline zaten: ${data.discipline}`);
      skipped++;
      continue;
    }

    const tag = isDryRun ? "[DRY]" : "[YAZ]";
    console.log(`${tag} ${data.name} (scope: ${data.scope ?? "—"}) → discipline: ${grafikId}`);

    if (!isDryRun) {
      await d.ref.update({ discipline: grafikId });
    }
    updated++;
  }

  console.log(`\nTamamlandı: ${updated} güncellendi, ${skipped} atlandı.`);
  if (isDryRun) console.log("(--dry-run moduydu, hiçbir şey yazılmadı)");
}

main().catch(console.error);
