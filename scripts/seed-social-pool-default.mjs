// Canlıdaki (lottery_configs/socialMedia + templates/assignmentType:"sosyal_medya") verisini
// FlexOS'a taşır: (1) flexos_social_pools/{tenantId}_default — org varsayılan havuz
// (eğitmenlerin "Kütüphaneme Ekle" dediğinde tohumlanacağı kaynak), (2)
// flexos_assignment_templates — TEK global katalog girdisi (scope:"global",
// gamifiedType:"sosyal").
//
// `seed-book-pool-default.mjs`/`seed-collage-pool-default.mjs` ile birebir aynı desen.
// Canlı sisteme HİÇ YAZMAZ — sadece okur. Sadece FlexOS'un yeni koleksiyonlarına yazar.
//
// Kullanım:
//   node scripts/seed-social-pool-default.mjs            (dry-run, sadece plan yazdırır)
//   node scripts/seed-social-pool-default.mjs --commit    (gerçekten yazar)
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

  const poolSnap = await db.collection("lottery_configs").doc("socialMedia").get();
  if (!poolSnap.exists) {
    console.log("Canlıda lottery_configs/socialMedia bulunamadı — havuz tohumu atlanıyor.");
  }
  const poolData = poolSnap.exists ? poolSnap.data() : null;

  const rawSectors = Array.isArray(poolData?.sectors) ? poolData.sectors : [];
  const sectors = rawSectors
    .filter((s) => s.id && s.name)
    .map((s) => ({ id: s.id, name: s.name, subSectors: Array.isArray(s.subSectors) ? s.subSectors.filter(Boolean) : [] }));

  const rawBrands = Array.isArray(poolData?.brands) ? poolData.brands : [];
  const brands = rawBrands
    .filter((b) => b.id && b.brandName)
    .map((b) => ({
      id: b.id,
      brandName: b.brandName,
      brandRule: b.brandRule ?? "",
      mainSector: b.mainSector ?? "",
      subSector: b.subSector ?? "",
      purposes: Array.isArray(b.purposes) ? b.purposes.filter(Boolean) : [],
    }));

  // NOT: canlıdaki formats öğelerinde `id` alanı YOK (SocialMediaPoolPanel.tsx client-side
  // normalizasyonda genId() ile üretiyor) — burada da aynı şekilde sentetik id üretilir.
  const rawFormats = Array.isArray(poolData?.formats) ? poolData.formats : [];
  const formats = rawFormats
    .filter((f) => f.dim)
    .map((f, i) => ({ id: f.id ?? `fmt-${i}-${Math.random().toString(36).slice(2, 8)}`, dim: f.dim ?? "", type: f.type ?? "", platform: f.platform ?? "" }));

  const globalPurposes = Array.isArray(poolData?.globalPurposes) ? poolData.globalPurposes.filter(Boolean) : [];
  const sharedRule = poolData?.sharedRule ?? "";

  console.log(`Havuz: ${sectors.length} sektör, ${brands.length} marka, ${formats.length} format, ${globalPurposes.length} ortak amaç`);

  const templatesSnap = await db.collection("templates").where("assignmentType", "==", "sosyal_medya").get();
  let sourceTemplate = null;
  templatesSnap.forEach((doc) => { if (!sourceTemplate) sourceTemplate = { id: doc.id, ...doc.data() }; });

  // NOT: canlıdaki template.branch aslında ŞUBE adı, ders branşı DEĞİL — `seed-collage-pool-
  // default.mjs`/`seed-book-pool-default.mjs`'teki gerekçeyle aynı: gerçek disiplin
  // "Grafik Tasarım" olarak hardcode ediliyor.
  const templateDoc = {
    id: db.collection("flexos_assignment_templates").doc().id,
    tenantId: TENANT_ID,
    scope: "global",
    branch: "Grafik Tasarım",
    gamifiedType: "sosyal",
    title: sourceTemplate?.name ?? "Reklam Tasarımı",
    description: sourceTemplate?.description ?? "Marka/sektör havuzundan çekilişle atanan sosyal medya reklam tasarımı ödevi.",
    icon: "camera",
    kind: "normal",
    maxPuan: 100,
    attachments: [],
    visible: false,
    createdAt: new Date().toISOString(),
    createdBy: "seed-script",
  };

  console.log(`\nGlobal katalog girdisi: title="${templateDoc.title}" branch="${templateDoc.branch ?? "(yok)"}"`);
  console.log(`\nDRY-RUN plan:`);
  console.log(`  flexos_social_pools/${TENANT_ID}_default → ${sectors.length} sektör / ${brands.length} marka / ${formats.length} format`);
  console.log(`  flexos_assignment_templates/${templateDoc.id} → global Reklam Tasarımı katalog girdisi`);

  if (!COMMIT) {
    console.log("\nDRY-RUN bitti. Gerçekten yazmak için: node scripts/seed-social-pool-default.mjs --commit");
    return;
  }

  const batch = db.batch();
  batch.set(db.collection("flexos_social_pools").doc(`${TENANT_ID}_default`), {
    id: `${TENANT_ID}_default`,
    tenantId: TENANT_ID,
    brands,
    sectors,
    formats,
    globalPurposes,
    sharedRule,
    updatedAt: new Date().toISOString(),
    updatedBy: "seed-script",
  });
  batch.set(db.collection("flexos_assignment_templates").doc(templateDoc.id), templateDoc);
  await batch.commit();
  console.log(`\n✅ Havuz varsayılanı + global katalog girdisi yazıldı.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
