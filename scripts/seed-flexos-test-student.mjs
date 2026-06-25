/**
 * seed-flexos-test-student.mjs
 * FlexOS Öğrenci Havuzu / detay drawer'ı test etmek için ZENGİN bir test öğrencisi üretir:
 *   - 2 satış (2 ayrı eğitim) → drawer'da "Satın aldığı eğitimler" selector AKTİF olur
 *   - 1. satış: peşin + 4 senet taksiti (biri gecikmiş, biri yaklaşan, ikisi planlı) + VELİ
 *   - 2. satış: tek peşin (tamamlandı)
 *   - 2 enrollment (grupsuz → havuzda "Grupsuz")
 *
 * Yalnız YENİ FlexOS koleksiyonlarına yazar (persons / flexos_sales / enrollments /
 * flexos_payments). Canlı students/groups'a DOKUNMAZ.
 *
 * Kullanım:
 *   node scripts/seed-flexos-test-student.mjs            # oluştur
 *   node scripts/seed-flexos-test-student.mjs --clean    # önce eski seed kaydını sil
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { resolve } from "path";

const serviceAccount = JSON.parse(readFileSync(resolve("service-account.json"), "utf8"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const SEED_TAG = "seed:flexos-test-student";
const clean = process.argv.includes("--clean");

const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
const nowTs = new Date().toISOString();

async function detectTenant() {
  const snap = await db.collection("persons").limit(1).get();
  if (!snap.empty) return snap.docs[0].data().tenantId || "default";
  return "default";
}

async function pickEducations(tenantId) {
  const snap = await db.collection("flexos_educations").where("tenantId", "==", tenantId).limit(5).get();
  const eds = snap.docs.map((d) => ({ id: d.id, name: d.data().name }));
  const branchId = snap.docs[0]?.data().branchId; // isim/branş join'i çalışsın diye mevcut branşı paylaş
  // 2'den az gerçek eğitim varsa: ad join'i çalışsın diye GERÇEK (seedTag'li) eğitim dokümanı oluştur
  while (eds.length < 2) {
    const ref = db.collection("flexos_educations").doc();
    const name = `Web Tasarım Kursu (test)`;
    await ref.set({ id: ref.id, tenantId, seedTag: SEED_TAG, name, branchId: branchId ?? null, audience: "individual", structure: "single", listPrice: 8000, onSale: true, createdAt: nowTs, createdBy: "seed-script" });
    eds.push({ id: ref.id, name });
  }
  return eds.slice(0, 2);
}

async function removeOldSeed() {
  for (const col of ["persons", "flexos_sales", "enrollments", "flexos_payments", "flexos_educations"]) {
    const snap = await db.collection(col).where("seedTag", "==", SEED_TAG).get();
    for (const d of snap.docs) await d.ref.delete();
    if (snap.size) console.log(`  silindi: ${col} (${snap.size})`);
  }
}

async function main() {
  const tenantId = await detectTenant();
  console.log(`Kiracı: ${tenantId}`);

  if (clean) { console.log("Eski seed temizleniyor…"); await removeOldSeed(); }

  const [edu1, edu2] = await pickEducations(tenantId);
  console.log(`Eğitimler: "${edu1.name}" + "${edu2.name}"`);

  const base = { tenantId, seedTag: SEED_TAG, createdAt: nowTs, createdBy: "seed-script" };

  // ── Person ──
  const personRef = db.collection("persons").doc();
  const personId = personRef.id;
  await personRef.set({
    id: personId, ...base,
    firstName: "Zeynep", lastName: "Test (FlexOS)",
    birthDate: "2009-04-12", gender: "female",
    pii: { idType: "tc", idNo: "12345678901", phone: "5324182271", email: "zeynep.test@example.com", address: "Caferağa Mah. Moda Cad. No:12, Kadıköy / İstanbul" },
    status: "active", consentKVKK: false,
  });

  // ── Sale 1 (velili, peşin + senet) ──
  const sale1Ref = db.collection("flexos_sales").doc();
  const sale1Id = sale1Ref.id;
  await sale1Ref.set({
    id: sale1Id, ...base,
    type: "new_sale", status: "active", customerType: "individual",
    personId, educationId: edu1.id, soldPrice: 12000,
    guardian: { name: "Ayşe Test", idNo: "98765432109" },
    date: addDays(-40),
  });
  // Sale 1 ödemeleri: 4000 peşin (ödendi) + 4×2000 senet (gecikmiş / yaklaşan / planlı ×2)
  const pay1 = [
    { method: "cash", amount: 4000, paidAt: addDays(-40) },
    { method: "senet", amount: 2000, installmentNo: 1, installmentTotal: 4, dueDate: addDays(-5) },   // GECİKTİ
    { method: "senet", amount: 2000, installmentNo: 2, installmentTotal: 4, dueDate: addDays(3) },    // YAKLAŞIYOR
    { method: "senet", amount: 2000, installmentNo: 3, installmentTotal: 4, dueDate: addDays(33) },   // PLANLANDI
    { method: "senet", amount: 2000, installmentNo: 4, installmentTotal: 4, dueDate: addDays(63) },   // PLANLANDI
  ];

  // ── Sale 2 (velisiz, tek peşin = tamamlandı) ──
  const sale2Ref = db.collection("flexos_sales").doc();
  const sale2Id = sale2Ref.id;
  await sale2Ref.set({
    id: sale2Id, ...base,
    type: "new_sale", status: "active", customerType: "individual",
    personId, educationId: edu2.id, soldPrice: 8000,
    date: addDays(-10),
  });
  const pay2 = [{ method: "cash", amount: 8000, paidAt: addDays(-10) }];

  // ── Payment dokümanları ──
  let pcount = 0;
  for (const [saleId, lines] of [[sale1Id, pay1], [sale2Id, pay2]]) {
    for (const l of lines) {
      const ref = db.collection("flexos_payments").doc();
      await ref.set({ id: ref.id, ...base, saleId, personId, ...l });
      pcount++;
    }
  }

  // ── Enrollment'lar (grupsuz → havuzda "Grupsuz", Gruba Ata aktif) ──
  for (const [educationId, saleId] of [[edu1.id, sale1Id], [edu2.id, sale2Id]]) {
    const ref = db.collection("enrollments").doc();
    await ref.set({ id: ref.id, ...base, personId, educationId, status: "active", saleId });
  }

  console.log("\n✅ Seed tamam:");
  console.log(`   Öğrenci: Zeynep Test (FlexOS)  ·  id=${personId}`);
  console.log(`   2 satış (${edu1.name} + ${edu2.name}), ${pcount} ödeme satırı, 2 enrollment (grupsuz)`);
  console.log("   → Öğrenci Havuzu'nda açıp Ödeme & Satış sekmesinde selector'ı test et.");
  console.log("   Temizlemek için: node scripts/seed-flexos-test-student.mjs --clean (tekrar çalıştırmadan)\n");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
