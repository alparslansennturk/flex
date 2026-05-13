/**
 * set-student-discipline.mjs
 * Mevcut öğrencilere groupId → groups.discipline üzerinden discipline alanı ekler.
 *
 * Kullanım:
 *   node scripts/set-student-discipline.mjs --dry-run
 *   node scripts/set-student-discipline.mjs
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
  // Tüm grupları önce çek (groupId → discipline map)
  const groupsSnap = await db.collection("groups").get();
  const groupMap = {};
  for (const d of groupsSnap.docs) {
    groupMap[d.id] = d.data().discipline || null;
  }

  const studentsSnap = await db.collection("students").get();
  let updated = 0, skipped = 0, noGroup = 0;

  for (const d of studentsSnap.docs) {
    const data = d.data();

    if (data.discipline) {
      skipped++;
      continue;
    }

    const discipline = groupMap[data.groupId] || null;
    if (!discipline) {
      console.log(`[GRUP YOK] ${d.id} — ${data.name} ${data.lastName} (groupId: ${data.groupId})`);
      noGroup++;
      continue;
    }

    console.log(`${isDryRun ? "[DRY]" : "[YAZ]"} ${d.id} — ${data.name} ${data.lastName} → discipline: ${discipline}`);

    if (!isDryRun) {
      await d.ref.update({ discipline });
    }
    updated++;
  }

  console.log(`\nTamamlandı: ${updated} güncellendi, ${skipped} atlandı (zaten var), ${noGroup} grup bulunamadı.`);
}

main().catch(console.error);
