// Canlıdaki (lottery_configs/collage + templates/gamified-kolaj) verisini FlexOS'a
// taşır: (1) flexos_collage_pools/{tenantId}_default — org varsayılan havuz (eğitmenlerin
// "Kütüphaneme Ekle" dediğinde tohumlanacağı kaynak), (2) flexos_assignment_templates —
// TEK global katalog girdisi (scope:"global", gamifiedType:"kolaj", branch:"Grafik Tasarım").
//
// Canlı sisteme HİÇ YAZMAZ — sadece okur. Sadece FlexOS'un yeni koleksiyonlarına yazar.
//
// Kullanım:
//   node scripts/seed-collage-pool-default.mjs            (dry-run, sadece plan yazdırır)
//   node scripts/seed-collage-pool-default.mjs --commit    (gerçekten yazar)
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
const VALID_CATEGORIES = ["Gök", "Yer", "Obje 1", "Obje 2"];

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

  const poolSnap = await db.collection("lottery_configs").doc("collage").get();
  if (!poolSnap.exists) {
    console.log("Canlıda lottery_configs/collage bulunamadı — havuz tohumu atlanıyor.");
  }
  const poolData = poolSnap.exists ? poolSnap.data() : null;
  const rawItems = Array.isArray(poolData?.items) ? poolData.items : [];
  const items = rawItems
    .filter((it) => VALID_CATEGORIES.includes(it.category))
    .map((it) => ({ id: it.id, name: it.name, category: it.category, color: it.color ?? "#e5e7eb", emoji: it.emoji ?? "" }));

  console.log(`Havuz öğe sayısı (kategori bazlı): ${VALID_CATEGORIES.map((c) => `${c}=${items.filter((i) => i.category === c).length}`).join(", ")}`);

  const templatesSnap = await db.collection("templates").where("assignmentType", "==", "kolaj").get();
  let sourceTemplate = null;
  templatesSnap.forEach((doc) => { if (!sourceTemplate) sourceTemplate = { id: doc.id, ...doc.data() }; });

  const templateDoc = {
    id: db.collection("flexos_assignment_templates").doc().id,
    tenantId: TENANT_ID,
    scope: "global",
    branch: "Grafik Tasarım",
    gamifiedType: "kolaj",
    title: sourceTemplate?.name ?? "Kolaj Bahçesi",
    description: sourceTemplate?.description ?? "Gök, Yer ve Obje kategorilerinden rastgele materyal çekilişi.",
    icon: "layout",
    kind: "normal",
    maxPuan: 100,
    attachments: [],
    visible: false,
    createdAt: new Date().toISOString(),
    createdBy: "seed-script",
  };

  console.log(`\nGlobal katalog girdisi: title="${templateDoc.title}" branch="${templateDoc.branch}"`);
  console.log(`\nDRY-RUN plan:`);
  console.log(`  flexos_collage_pools/${TENANT_ID}_default → ${items.length} öğe`);
  console.log(`  flexos_assignment_templates/${templateDoc.id} → global Kolaj Bahçesi katalog girdisi`);

  if (!COMMIT) {
    console.log("\nDRY-RUN bitti. Gerçekten yazmak için: node scripts/seed-collage-pool-default.mjs --commit");
    return;
  }

  const batch = db.batch();
  batch.set(db.collection("flexos_collage_pools").doc(`${TENANT_ID}_default`), {
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
