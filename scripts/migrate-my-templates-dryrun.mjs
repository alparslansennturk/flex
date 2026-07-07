// Canlıdaki (templates koleksiyonu) kendi şablonlarımı FlexOS'a taşımadan ÖNCE önizleme.
// SADECE OKUR, hiçbir yere yazmaz.
// Kullanım: node scripts/migrate-my-templates-dryrun.mjs
import { readFileSync } from "fs";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
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

async function main() {
  const authUser = await auth.getUserByEmail(EMAIL);
  const uid = authUser.uid;
  console.log(`UID: ${uid}`);

  const userDoc = await db.collection("users").doc(uid).get();
  console.log(`users/${uid} var mı: ${userDoc.exists}`, userDoc.exists ? userDoc.data()?.name : "");

  const snap = await db.collection("templates").where("createdBy", "==", uid).get();
  console.log(`\nToplam createdBy===${uid} olan şablon: ${snap.size}\n`);

  const normal = [];
  const gamified = [];
  snap.forEach((doc) => {
    const d = doc.data();
    const row = { id: doc.id, name: d.name, subtitle: d.subtitle, type: d.type, points: d.points, branch: d.branch, discipline: d.discipline, scope: d.scope, icon: d.icon, level: d.level, module: d.module, description: d.description };
    if (d.scope === "gamified") gamified.push(row);
    else normal.push(row);
  });

  console.log(`── NORMAL (scope != "gamified") — ${normal.length} adet ──`);
  normal.forEach((r) => console.log(`  [${r.id}] "${r.name}" tür=${r.type} puan=${r.points} branş(şube?)=${r.branch} discipline=${r.discipline} scope=${r.scope ?? "(yok)"}\n      desc: ${(r.description||"").slice(0,80)}`));

  console.log(`\n── OYUNLAŞTIRILMIŞ (scope === "gamified") — ${gamified.length} adet ──`);
  gamified.forEach((r) => console.log(`  [${r.id}] "${r.name}" tür=${r.type} puan=${r.points} branş(şube?)=${r.branch} discipline=${r.discipline} level=${r.level} module=${r.module}`));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
