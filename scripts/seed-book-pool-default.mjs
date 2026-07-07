// Canlıdaki (lottery_configs/book + templates/assignmentType:"kitap") verisini FlexOS'a
// taşır: (1) flexos_book_pools/{tenantId}_default — org varsayılan havuz (eğitmenlerin
// "Kütüphaneme Ekle" dediğinde tohumlanacağı kaynak), (2) flexos_assignment_templates —
// TEK global katalog girdisi (scope:"global", gamifiedType:"kitap").
//
// `seed-collage-pool-default.mjs` ile birebir aynı desen. Canlı sisteme HİÇ YAZMAZ —
// sadece okur. Sadece FlexOS'un yeni koleksiyonlarına yazar.
//
// Kullanım:
//   node scripts/seed-book-pool-default.mjs            (dry-run, sadece plan yazdırır)
//   node scripts/seed-book-pool-default.mjs --commit    (gerçekten yazar)
import { readFileSync } from "fs";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const envRaw = readFileSync(".env.local", "utf8");
for (const line of envRaw.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let val = trimmed.slice(eq + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  process.env[key] = val;
}

const COMMIT = process.argv.includes("--commit");
const TENANT_ID = "default";

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}
const db = getFirestore();

async function main() {
  console.log(`Mod: ${COMMIT ? "COMMIT (gerçekten yazılacak)" : "DRY-RUN (sadece önizleme)"}\n`);

  const poolSnap = await db.collection("lottery_configs").doc("book").get();
  if (!poolSnap.exists) {
    console.log("Canlıda lottery_configs/book bulunamadı — havuz tohumu atlanıyor.");
  }
  const poolData = poolSnap.exists ? poolSnap.data() : null;
  const rawItems = Array.isArray(poolData?.items) ? poolData.items : [];

  // Duplicate id'li kitapları temizle (canlıdaki BookGameScreen.tsx'teki aynı savunma).
  const seen = new Set();
  const items = rawItems
    .filter((it) => it.id && !seen.has(it.id) && seen.add(it.id))
    .map((it) => ({
      id: it.id,
      bookId: it.bookId ?? "",
      title: it.title ?? "",
      author: it.author ?? "",
      genre: it.genre ?? "",
      subGenre: it.subGenre ?? "",
      isbn: it.isbn ?? "",
      publisher: it.publisher ?? "",
      pageCount: it.pageCount ?? "",
      dimensions: it.dimensions ?? "",
      backCover: it.backCover ?? "",
    }))
    .filter((it) => it.title.trim() && it.author.trim());

  console.log(`Havuz öğe sayısı: ${items.length} kitap (canlıda ${rawItems.length} ham kayıt)`);

  const templatesSnap = await db.collection("templates").where("assignmentType", "==", "kitap").get();
  let sourceTemplate = null;
  templatesSnap.forEach((doc) => { if (!sourceTemplate) sourceTemplate = { id: doc.id, ...doc.data() }; });

  // NOT: canlıdaki template.branch aslında ŞUBE adı ("Kadıköy Şb"), ders branşı DEĞİL —
  // `seed-collage-pool-default.mjs`'teki gerekçeyle aynı: gerçek disiplin "Grafik Tasarım"
  // (canlıdaki module:"GRAFIK_2" bunu doğruluyor), o yüzden hardcode ediliyor.
  const templateDoc = {
    id: db.collection("flexos_assignment_templates").doc().id,
    tenantId: TENANT_ID,
    scope: "global",
    branch: "Grafik Tasarım",
    gamifiedType: "kitap",
    title: sourceTemplate?.name ?? "Kitap Dünyası",
    description: sourceTemplate?.description ?? "Kitap havuzundan çekilişle atanan kitap kapağı ödevi.",
    icon: "book",
    kind: "normal",
    maxPuan: 100,
    attachments: [],
    visible: false,
    createdAt: new Date().toISOString(),
    createdBy: "seed-script",
  };

  console.log(`\nGlobal katalog girdisi: title="${templateDoc.title}" branch="${templateDoc.branch ?? "(yok)"}"`);
  console.log(`\nDRY-RUN plan:`);
  console.log(`  flexos_book_pools/${TENANT_ID}_default → ${items.length} kitap`);
  console.log(`  flexos_assignment_templates/${templateDoc.id} → global Kitap Dünyası katalog girdisi`);

  if (!COMMIT) {
    console.log("\nDRY-RUN bitti. Gerçekten yazmak için: node scripts/seed-book-pool-default.mjs --commit");
    return;
  }

  const batch = db.batch();
  batch.set(db.collection("flexos_book_pools").doc(`${TENANT_ID}_default`), {
    id: `${TENANT_ID}_default`,
    tenantId: TENANT_ID,
    items,
    updatedAt: new Date().toISOString(),
    updatedBy: "seed-script",
  });
  batch.set(db.collection("flexos_assignment_templates").doc(templateDoc.id), templateDoc);
  await batch.commit();
  console.log(`\n✅ Havuz varsayılanı + global katalog girdisi yazıldı.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
