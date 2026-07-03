/**
 * seed-flexos-dashboard-demo.mjs
 * Satış Dashboard'u (src/app/flexos/satislar/dashboard) test etmek için demo veri üretir:
 *   - 8 branş + 8 eğitim (Yazılım/Grafik Tasarım/.../Robotik ve Kodlama) — "Satış Dağılımı"
 *     donut'unda ilk 6 ayrı dilim, kalan 2 tek "Diğer" diliminde (hover'da popup ile detay)
 *   - Bu ay tarihli ~50 aktif satış (branşlara dağıtılmış) → donut + En Son Satışlar havuzu dolsun
 *   - Bugün için 7 randevu (Case+Activity+Appointment üçlüsüyle, gerçek domain akışına uygun —
 *     büyük ekranda 5'i, küçük ekranda 4'ü görünür kalıyor, geri kalanı scroll'da)
 *     → "Bugünkü Randevular" + "Canlı Aktivite Akışı" dolsun
 *
 * Yalnız YENİ FlexOS koleksiyonlarına yazar (flexos_branches / flexos_educations / persons /
 * flexos_sales / flexos_cases / flexos_activities / flexos_appointments). Canlı students/groups'a
 * DOKUNMAZ.
 *
 * Kullanım:
 *   node scripts/seed-flexos-dashboard-demo.mjs                    # oluştur (8 branş)
 *   node scripts/seed-flexos-dashboard-demo.mjs --clean             # önce eski seed kaydını sil
 *   node scripts/seed-flexos-dashboard-demo.mjs --clean --n=1       # sadece 1 branş (donut büyüme testi)
 *   node scripts/seed-flexos-dashboard-demo.mjs --clean --n=2       # sadece 2 branş
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { resolve } from "path";

const serviceAccount = JSON.parse(readFileSync(resolve("service-account.json"), "utf8"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const SEED_TAG = "seed:flexos-dashboard-demo";
const clean = process.argv.includes("--clean");
// --n=<sayı> ile sadece ilk N branşı seed'le (donut'un 1-2-3 branşlı davranışını test etmek için).
const nArg = process.argv.find((a) => a.startsWith("--n="));
const branchLimit = nArg ? parseInt(nArg.slice(4), 10) : null;

const nowTs = new Date().toISOString();
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
// Dashboard'un "bu ay" filtresi gerçek takvim ayına bakar — ayın kaçıncı günü olursak olalım
// tarih HER ZAMAN bu ayın 1'i ile bugün arasında kalmalı (geçen aya taşarsa donut'tan düşer).
const daysIntoMonth = new Date().getDate() - 1; // bugün ayın 1'iyse 0, 3'üyse 2 gün geriye gidilebilir
const randomDayThisMonth = () => -Math.floor(Math.random() * (daysIntoMonth + 1));
const todayAt = (h, m) => { const d = new Date(); d.setHours(h, m, 0, 0); return d.toISOString(); };

async function detectTenant() {
  const snap = await db.collection("persons").limit(1).get();
  if (!snap.empty) return snap.docs[0].data().tenantId || "default";
  return "default";
}

async function removeOldSeed() {
  const cols = [
    "flexos_branches", "flexos_educations", "persons", "flexos_sales",
    "flexos_cases", "flexos_activities", "flexos_appointments",
  ];
  for (const col of cols) {
    const snap = await db.collection(col).where("seedTag", "==", SEED_TAG).get();
    for (const d of snap.docs) await d.ref.delete();
    if (snap.size) console.log(`  silindi: ${col} (${snap.size})`);
  }
}

const FIRST_NAMES = ["Mert", "Zeynep", "Emre", "Selin", "Burak", "Naz", "Ali", "Buse", "Tolga", "Elif", "Kaan", "İrem", "Deniz", "Pelin", "Barış"];
const LAST_NAMES = ["Yılmaz", "Kaya", "Çelik", "Arslan", "Şen", "Güler", "Demir", "Kara", "Öztürk", "Doğan", "Polat", "Aydın", "Şahin", "Ateş", "Koç"];
function randomName(i) {
  return `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[(i * 3 + 1) % LAST_NAMES.length]}`;
}

async function main() {
  const tenantId = await detectTenant();
  console.log(`Kiracı: ${tenantId}`);

  if (clean) { console.log("Eski seed temizleniyor…"); await removeOldSeed(); }

  const base = { tenantId, seedTag: SEED_TAG, createdAt: nowTs, createdBy: "seed-script" };

  // ── 8 branş + 8 eğitim (donut'ta ilk 6 ayrı gösterilir, kalan 2 "Diğer"ye toplanır) ──
  const ALL_BRANCHES = [
    { name: "Yazılım", education: "Full-Stack Web Bootcamp", listPrice: 45000, count: 15 },              // %30
    { name: "Grafik Tasarım", education: "UI/UX Tasarım Kursu", listPrice: 22000, count: 10 },            // %20
    { name: "Dijital Pazarlama", education: "Dijital Pazarlama Uzmanlığı", listPrice: 18000, count: 8 },  // %16
    { name: "Sistem Uzmanlığı", education: "Ağ ve Sistem Yönetimi", listPrice: 26000, count: 6 },         // %12
    { name: "Fotoğrafçılık", education: "Profesyonel Fotoğrafçılık Kursu", listPrice: 15000, count: 5 },  // %10
    { name: "Muhasebe ve Finans", education: "Muhasebe ve Finans Eğitimi", listPrice: 20000, count: 3 },  // %6
    { name: "İngilizce", education: "İngilizce Yoğunlaştırılmış Kurs", listPrice: 12000, count: 2 },      // %4  → "Diğer"
    { name: "Robotik ve Kodlama", education: "Çocuklar için Robotik ve Kodlama", listPrice: 9000, count: 1 }, // %2 → "Diğer"
  ];
  const BRANCHES = branchLimit ? ALL_BRANCHES.slice(0, branchLimit) : ALL_BRANCHES;

  let saleCount = 0;
  let nameIdx = 0;
  for (const b of BRANCHES) {
    const branchRef = db.collection("flexos_branches").doc();
    await branchRef.set({ id: branchRef.id, ...base, name: b.name });

    const eduRef = db.collection("flexos_educations").doc();
    await eduRef.set({
      id: eduRef.id, ...base, name: b.education, branchId: branchRef.id,
      audience: "individual", structure: "single", listPrice: b.listPrice, onSale: true,
    });

    for (let i = 0; i < b.count; i++) {
      const personRef = db.collection("persons").doc();
      const [firstName, lastName] = randomName(nameIdx++).split(" ");
      await personRef.set({
        id: personRef.id, ...base, firstName, lastName,
        status: "active", consentKVKK: false,
      });

      const saleRef = db.collection("flexos_sales").doc();
      const dayOffset = randomDayThisMonth();
      const priceJitter = Math.round(b.listPrice * (0.85 + Math.random() * 0.25));
      await saleRef.set({
        id: saleRef.id, ...base,
        type: "new_sale", status: "active", customerType: "individual",
        personId: personRef.id, educationId: eduRef.id,
        soldPrice: priceJitter, date: addDays(dayOffset),
      });
      saleCount++;
    }
  }

  // ── Bugün için 7 randevu (Case + Activity + Appointment) — büyük ekranda 5, küçük ekranda
  // 4 tanesi görünür kalıyor (APPT_VISIBLE_ROWS_WIDE/NARROW, satış dashboard), geri kalanı
  // scroll ile görülür; 7 tane bu iki senaryoyu da test edecek kadar (5'ten fazla) ──
  const RANDEVULAR = [
    { h: 10, m: 0, konu: "Yazılım eğitimi tanışma görüşmesi" },
    { h: 11, m: 30, konu: "UI/UX bilgilendirme" },
    { h: 13, m: 30, konu: "Dijital Pazarlama değerlendirme" },
    { h: 15, m: 0, konu: "Grafik tasarım kayıt görüşmesi" },
    { h: 16, m: 30, konu: "Bootcamp son karar görüşmesi" },
    { h: 17, m: 30, konu: "Fotoğrafçılık kurs bilgilendirme" },
    { h: 18, m: 30, konu: "Muhasebe eğitimi değerlendirme" },
  ];

  let apptCount = 0;
  for (const r of RANDEVULAR) {
    const personRef = db.collection("persons").doc();
    const [firstName, lastName] = randomName(nameIdx++).split(" ");
    await personRef.set({
      id: personRef.id, ...base, firstName, lastName,
      status: "prospect", consentKVKK: false,
    });

    const caseRef = db.collection("flexos_cases").doc();
    await caseRef.set({
      id: caseRef.id, ...base,
      personId: personRef.id, channel: "telefon", type: "satis_oncesi",
      status: "randevu_olusturuldu", activityCount: 1, lastActivityAt: nowTs,
    });

    const activityRef = db.collection("flexos_activities").doc();
    await activityRef.set({
      id: activityRef.id, ...base,
      caseId: caseRef.id, personId: personRef.id, type: "randevu",
      note: r.konu, nextActionType: "randevu", nextActionDate: todayAt(r.h, r.m),
    });

    const apptRef = db.collection("flexos_appointments").doc();
    await apptRef.set({
      id: apptRef.id, ...base,
      personId: personRef.id, caseId: caseRef.id, activityId: activityRef.id,
      scheduledAt: todayAt(r.h, r.m), note: r.konu, status: "bekliyor",
    });

    await activityRef.update({ appointmentId: apptRef.id });
    apptCount++;
  }

  console.log("\n✅ Seed tamam:");
  console.log(`   ${saleCount} aktif satış (${BRANCHES.length} branş: ${BRANCHES.map((b) => b.name).join(", ")})`);
  console.log(`   ${apptCount} bugünkü randevu (+ ${apptCount} case/activity)`);
  console.log("   → /flexos/satislar/dashboard sayfasını yenile.");
  console.log("   Temizlemek için: node scripts/seed-flexos-dashboard-demo.mjs --clean\n");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
