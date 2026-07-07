// Canlıdaki (templates koleksiyonu) kendi NORMAL şablonlarımı FlexOS'un
// flexos_assignment_templates koleksiyonuna kişisel (personal, trainerId=ben)
// şablon olarak taşır. Oyunlaştırılmış (scope==="gamified") olanlar HARİÇ.
//
// Canlı sisteme HİÇ YAZMAZ — sadece okur. Sadece FlexOS'un yeni koleksiyonuna yazar.
//
// Kullanım:
//   node scripts/migrate-my-templates.mjs            (dry-run, sadece plan yazdırır)
//   node scripts/migrate-my-templates.mjs --commit    (gerçekten yazar)
import { readFileSync } from "fs";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

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

const EMAIL = "alparslan.sennturk@gmail.com";
const COMMIT = process.argv.includes("--commit");
const TENANT_ID = "default";

// canlı discipline-id -> FlexOS branş adı (Branş Havuzu'nda mevcut olanlar)
const DISCIPLINE_TO_FLEXOS_BRANCH = {
  JR8cHEmax16d19BqgVki: "Grafik Tasarım", // "Grafik-1"
  // MpCQ2Uuz2uQ6xZQwkz3C ("Web Tasarım") kullanıcı kararı: branşsız bırak
};

// canlı lucide ikon adı -> FlexOS ASSIGNMENT_ICON_KEYS whitelist'i (yaklaşık eşleme, kozmetik)
const ICON_MAP = {
  Brush: "palette",
  Images: "image",
  Palette: "palette",
  Monitor: "layout",
  Award: "palette",
  Triangle: "palette",
  Briefcase: "target",
  Zap: "target",
  Package: "book",
  Grid3X3: "layout",
  Sparkles: "lightbulb",
};

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
const auth = getAuth();

function toIso(ts) {
  if (ts instanceof Timestamp) return ts.toDate().toISOString();
  return new Date().toISOString();
}

async function main() {
  const authUser = await auth.getUserByEmail(EMAIL);
  const uid = authUser.uid;
  console.log(`Kullanıcı: ${EMAIL} → uid=${uid}`);
  console.log(`Mod: ${COMMIT ? "COMMIT (gerçekten yazılacak)" : "DRY-RUN (sadece önizleme)"}\n`);

  // Kullanıcı kararı: "benim şablonlarım" createdBy ile sınırlı değil — canlıdaki
  // TÜM templates koleksiyonu (studio geneli, tek tenant) "bana ait" sayılıyor.
  // Sadece scope==="gamified" olanlar (3 adet: Reklam Tasarımı, Kolaj Bahçesi,
  // Kitap Dünyası) bu turda hariç tutulup ayrı bırakılıyor.
  const snap = await db.collection("templates").get();

  const plans = [];
  const gamifiedSkipped = [];
  snap.forEach((doc) => {
    const d = doc.data();
    if (d.scope === "gamified") { gamifiedSkipped.push(d.name); return; }

    const branch = d.discipline ? DISCIPLINE_TO_FLEXOS_BRANCH[d.discipline] : undefined;
    const icon = d.icon ? ICON_MAP[d.icon] : undefined;

    plans.push({
      sourceId: doc.id,
      doc: {
        id: db.collection("flexos_assignment_templates").doc().id,
        tenantId: TENANT_ID,
        scope: "personal",
        trainerId: uid,
        branch,
        title: d.name,
        subtitle: d.subtitle || undefined,
        description: d.description || "",
        icon,
        kind: "normal",
        // NOT: canlıdaki "points" alanı küçük değerler taşıyor (3-5), FlexOS'un
        // maxPuan (100/150/200 ölçekli not puanı) kavramıyla örtüşmüyor — taşınmıyor,
        // hepsi varsayılan 100 (kullanıcı sonradan Şablon Yönetimi'nden düzenler).
        maxPuan: 100,
        attachments: [],
        visible: false,
        createdAt: toIso(d.createdAt),
        createdBy: uid,
      },
    });
  });

  console.log(`Hariç tutulan oyunlaştırılmış (${gamifiedSkipped.length}): ${gamifiedSkipped.join(", ")}\n`);
  console.log(`Taşınacak şablon sayısı: ${plans.length}\n`);
  for (const p of plans) {
    console.log(`[canlı:${p.sourceId}] → [flexos:${p.doc.id}]`);
    console.log(`  title="${p.doc.title}" branch=${p.doc.branch ?? "(yok)"} icon=${p.doc.icon ?? "(yok)"} kind=${p.doc.kind} maxPuan=${p.doc.maxPuan}`);
  }

  if (!COMMIT) {
    console.log("\nDRY-RUN bitti. Gerçekten yazmak için: node scripts/migrate-my-templates.mjs --commit");
    return;
  }

  const batch = db.batch();
  for (const p of plans) {
    const clean = JSON.parse(JSON.stringify(p.doc)); // undefined alanları at
    batch.set(db.collection("flexos_assignment_templates").doc(p.doc.id), clean);
  }
  await batch.commit();
  console.log(`\n✅ ${plans.length} şablon flexos_assignment_templates'e yazıldı.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
