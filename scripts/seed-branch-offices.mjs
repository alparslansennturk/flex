/**
 * seed-branch-offices.mjs
 * `flexos_branch_offices` koleksiyonunu GERÇEK 3 şubeyle doldurur: Kadıköy, Şirinevler,
 * Pendik (eski src/app/lib/branch-offices.ts'teki 5'lik sabit listede fazladan duran
 * Ümraniye/Beşiktaş SAHTEYDİ, buraya eklenmiyor — 2026-07-22 kullanıcı teyidi).
 *
 * Stabil id'ler ("kadikoy", "sirinevler", "pendik") KASITLI olarak eski sabit dosyayla
 * AYNI — mevcut Group.branchOfficeId kayıtları bu id'leri kullanıyor, idempotent seed
 * ile geriye dönük kırılmaz.
 *
 * Kullanım: node scripts/seed-branch-offices.mjs
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { resolve } from "path";

const serviceAccount = JSON.parse(readFileSync(resolve("service-account.json"), "utf8"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const TENANT_ID = "default";
const now = new Date().toISOString();

const OFFICES = [
  { id: "kadikoy", name: "Kadıköy", order: 0 },
  { id: "sirinevler", name: "Şirinevler", order: 1 },
  { id: "pendik", name: "Pendik", order: 2 },
];

async function main() {
  for (const o of OFFICES) {
    const ref = db.collection("flexos_branch_offices").doc(o.id);
    const snap = await ref.get();
    if (snap.exists) {
      console.log(`— zaten var: ${o.name} (${o.id})`);
      continue;
    }
    await ref.set({
      id: o.id,
      tenantId: TENANT_ID,
      name: o.name,
      order: o.order,
      createdAt: now,
      createdBy: "seed-script",
    });
    console.log(`✓ eklendi: ${o.name} (${o.id})`);
  }
  console.log("Bitti.");
}

main().catch((e) => { console.error(e); process.exit(1); });
