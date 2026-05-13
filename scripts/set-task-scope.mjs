/**
 * set-task-scope.mjs
 * templates koleksiyonundaki tüm şablonlara scope alanı ekler.
 *   gamified → assignmentType: kolaj | kitap | sosyal_medya
 *   global   → diğer tüm şablonlar
 *
 * Kullanım:
 *   node scripts/set-task-scope.mjs --dry-run   (sadece listeler)
 *   node scripts/set-task-scope.mjs             (yazar)
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { resolve } from "path";

const isDryRun = process.argv.includes("--dry-run");
const serviceAccount = JSON.parse(readFileSync(resolve("service-account.json"), "utf8"));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const GAMIFIED_TYPES = ["kolaj", "kitap", "sosyal_medya"];

async function main() {
  const snap = await db.collection("templates").get();
  let updated = 0, skipped = 0;

  for (const d of snap.docs) {
    const data = d.data();

    if (data.scope) {
      console.log(`[ATLA] ${d.id} — ${data.name} (scope zaten: ${data.scope})`);
      skipped++;
      continue;
    }

    const scope = GAMIFIED_TYPES.includes(data.assignmentType) ? "gamified" : "global";
    console.log(`${isDryRun ? "[DRY]" : "[YAZ]"} ${d.id} — ${data.name} → scope: ${scope}`);

    if (!isDryRun) {
      await d.ref.update({ scope });
    }
    updated++;
  }

  console.log(`\nTamamlandı: ${updated} güncellendi, ${skipped} atlandı.`);
}

main().catch(console.error);
