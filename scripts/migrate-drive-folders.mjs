/**
 * Google Drive Klasör Migrasyon & Başlatma Scripti
 *
 * Modlar:
 *   node scripts/migrate-drive-folders.mjs --init-all
 *     → Firestore'daki tüm grup ve öğrenciler için Drive klasörlerini oluşturur.
 *       Aktif gruplar: Gruplar/{grupAdı}/Öğrenciler/{öğrenciAdı}/
 *       Arşiv grupları: Arşiv/{grupAdı}/Öğrenciler/{öğrenciAdı}/
 *
 *   node scripts/migrate-drive-folders.mjs --migrate
 *     → Eski yapıdaki (group_XXX / student_XXX) dosyaları yeni yapıya taşır.
 *
 *   node scripts/migrate-drive-folders.mjs --migrate --dry-run
 *     → Taşıma işlemini önizle, dokunma.
 *
 *   İkisi birlikte de kullanılabilir:
 *   node scripts/migrate-drive-folders.mjs --init-all --migrate
 */

import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp, cert }  from "firebase-admin/app";
import { getFirestore }         from "firebase-admin/firestore";

// ─── Argümanlar ───────────────────────────────────────────────────────────────

const INIT_ALL = process.argv.includes("--init-all");
const MIGRATE  = process.argv.includes("--migrate");
const DRY_RUN  = process.argv.includes("--dry-run");

if (!INIT_ALL && !MIGRATE) {
  console.error("Kullanım: node scripts/migrate-drive-folders.mjs [--init-all] [--migrate] [--dry-run]");
  process.exit(1);
}

// ─── Env ──────────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath   = path.join(__dirname, "..", ".env.local");

function readEnv(key) {
  const match = fs.readFileSync(envPath, "utf-8").match(new RegExp(`^${key}=(.+)$`, "m"));
  return match?.[1]?.trim() ?? null;
}

const strip = v => v?.replace(/^["']|["']$/g, "");
const CLIENT_ID     = strip(readEnv("GOOGLE_CLIENT_ID"));
const CLIENT_SECRET = strip(readEnv("GOOGLE_CLIENT_SECRET"));
const REFRESH_TOKEN = strip(readEnv("GOOGLE_REFRESH_TOKEN"));
const ROOT_FOLDER   = strip(readEnv("GOOGLE_DRIVE_FOLDER_ID"));
const PROJECT_ID    = readEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
const CLIENT_EMAIL  = readEnv("FIREBASE_CLIENT_EMAIL");
const PRIVATE_KEY   = readEnv("FIREBASE_PRIVATE_KEY")?.replace(/\\n/g, "\n").replace(/^"|"$/g, "");

for (const [k, v] of [["CLIENT_ID", CLIENT_ID], ["CLIENT_SECRET", CLIENT_SECRET],
  ["REFRESH_TOKEN", REFRESH_TOKEN], ["ROOT_FOLDER", ROOT_FOLDER],
  ["PROJECT_ID", PROJECT_ID], ["CLIENT_EMAIL", CLIENT_EMAIL], ["PRIVATE_KEY", PRIVATE_KEY]]) {
  if (!v) { console.error(`❌ ${k} .env.local'de bulunamadı.`); process.exit(1); }
}

// ─── Firebase Admin ───────────────────────────────────────────────────────────

initializeApp({ credential: cert({ projectId: PROJECT_ID, clientEmail: CLIENT_EMAIL, privateKey: PRIVATE_KEY }) });
const db = getFirestore();

// ─── Drive OAuth ──────────────────────────────────────────────────────────────

let _token = null;
async function getToken() {
  if (_token) return _token;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: REFRESH_TOKEN, client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("Drive token alınamadı: " + JSON.stringify(data));
  _token = data.access_token;
  return _token;
}

// ─── Drive yardımcıları ───────────────────────────────────────────────────────

async function findFolder(name, parentId) {
  const token = await getToken();
  const q = encodeURIComponent(`name = '${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)&pageSize=1`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  return data.files?.[0]?.id ?? null;
}

async function ensureFolder(name, parentId) {
  const existing = await findFolder(name, parentId);
  if (existing) return existing;
  if (DRY_RUN) return `[dry:${name}]`;
  const token = await getToken();
  const res = await fetch("https://www.googleapis.com/drive/v3/files?supportsAllDrives=true", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }),
  });
  const data = await res.json();
  if (!data.id) throw new Error(`Klasör oluşturulamadı "${name}": ${JSON.stringify(data)}`);
  return data.id;
}

async function listChildren(parentId, onlyFolders = false) {
  const token = await getToken();
  const parts = [`'${parentId}' in parents`, "trashed = false"];
  if (onlyFolders) parts.push("mimeType = 'application/vnd.google-apps.folder'");
  const q = encodeURIComponent(parts.join(" and "));
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType)&pageSize=200`, { headers: { Authorization: `Bearer ${token}` } });
  return (await res.json()).files ?? [];
}

async function moveFile(fileId, fromId, toId) {
  if (DRY_RUN) return;
  const token = await getToken();
  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${toId}&removeParents=${fromId}&fields=id`,
    { method: "PATCH", headers: { Authorization: `Bearer ${token}` } });
}

// ─── Firestore yardımcıları ───────────────────────────────────────────────────

async function getAllGroups() {
  const snap = await db.collection("groups").get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getStudentsForGroup(groupId) {
  const snap = await db.collection("students").where("groupId", "==", groupId).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─── Init All ─────────────────────────────────────────────────────────────────

async function initAll() {
  console.log("\n📁 --init-all: Tüm gruplar için Drive klasörleri oluşturuluyor...\n");

  // Kök seviyesi: "Ödev Dosyaları" (ortak şablonlar ve ödev kaynakları için)
  await ensureFolder("Ödev Dosyaları", ROOT_FOLDER);
  console.log(`   ${DRY_RUN ? "[dry]" : "✅"} Ödev Dosyaları/ (kök)\n`);

  const groups = await getAllGroups();
  console.log(`   Firestore'da ${groups.length} grup bulundu.\n`);

  let created = 0;

  for (const group of groups) {
    const groupName       = (group.code ?? "").trim() || group.id;
    const instructorName  = (group.instructor ?? "").trim() || "Eğitmen";
    const isArchived      = group.status === "archived";
    const parentLabel     = isArchived ? "Arşiv" : "Gruplar";

    const parentId    = await ensureFolder(parentLabel, ROOT_FOLDER);
    const groupId_dr  = await ensureFolder(groupName, parentId);
    const studentsId  = await ensureFolder("Öğrenciler", groupId_dr);

    // Eğitmen/EğitmenAdı/ klasörü
    const egitmenId      = await ensureFolder("Eğitmen", groupId_dr);
    await ensureFolder(instructorName, egitmenId);
    console.log(`   ${DRY_RUN ? "[dry]" : "✅"} ${parentLabel}/${groupName}/Eğitmen/${instructorName}/`);

    // Gruptaki öğrenciler
    const students = isArchived ? [] : await getStudentsForGroup(group.id);

    for (const student of students) {
      const studentName = `${student.name ?? ""} ${student.lastName ?? ""}`.trim() || student.id;
      await ensureFolder(studentName, studentsId);
      created++;
      console.log(`   ${DRY_RUN ? "[dry]" : "✅"} ${parentLabel}/${groupName}/Öğrenciler/${studentName}/`);
    }

    if (students.length === 0) {
      console.log(`   ℹ️  ${parentLabel}/${groupName}/ — öğrenci yok`);
    }
  }

  console.log(`\n   Oluşturulan öğrenci klasörü: ${created}`);
}

// ─── Migrate ──────────────────────────────────────────────────────────────────

async function migrate() {
  console.log(`\n🔄 --migrate: Eski yapıdan${DRY_RUN ? " (dry-run)" : ""} dosyalar taşınıyor...\n`);

  const oldGroupsFolder = await findFolder("groups", ROOT_FOLDER);
  if (!oldGroupsFolder) {
    console.log("   ℹ️  'groups' klasörü bulunamadı — taşıma gerekmiyor.");
    return;
  }

  const groupFolders = await listChildren(oldGroupsFolder, true);
  console.log(`   ${groupFolders.length} eski grup klasörü bulundu.\n`);

  let total = 0, moved = 0;

  for (const gf of groupFolders) {
    const groupId   = gf.name.startsWith("group_") ? gf.name.slice(6) : gf.name;
    let   groupName = groupId;
    try {
      const snap = await db.collection("groups").doc(groupId).get();
      if (snap.exists) groupName = (snap.data().code ?? "").trim() || groupId;
    } catch {}

    console.log(`\n   Grup: ${gf.name} → "${groupName}"`);

    const gruplarId  = await ensureFolder("Gruplar", ROOT_FOLDER);
    const newGroupId = await ensureFolder(groupName, gruplarId);

    const roleFolders = await listChildren(gf.id, true);
    for (const rf of roleFolders) {
      const isStudent    = rf.name === "students";
      const newRoleLabel = isStudent ? "Öğrenciler" : "Eğitmen";
      const newRoleId    = await ensureFolder(newRoleLabel, newGroupId);

      const userFolders = await listChildren(rf.id, true);
      for (const uf of userFolders) {
        const prefix  = isStudent ? "student_" : "instructor_";
        const userId  = uf.name.startsWith(prefix) ? uf.name.slice(prefix.length) : uf.name;
        let   userName = userId;
        if (isStudent) {
          try {
            const snap = await db.collection("students").doc(userId).get();
            if (snap.exists) userName = `${snap.data().name ?? ""} ${snap.data().lastName ?? ""}`.trim() || userId;
          } catch {}
        }

        const newUserFolderId = await ensureFolder(userName, newRoleId);
        const files = (await listChildren(uf.id, false)).filter(f => f.mimeType !== "application/vnd.google-apps.folder");

        total += files.length;
        for (const file of files) {
          console.log(`      ${DRY_RUN ? "[dry]" : "→"} ${file.name}  →  Gruplar/${groupName}/${newRoleLabel}/${userName}/`);
          await moveFile(file.id, uf.id, newUserFolderId);
          moved++;
        }
        if (files.length === 0) console.log(`      ℹ️  ${uf.name} — dosya yok`);
      }
    }
  }

  console.log(`\n   ${DRY_RUN ? "Taşınacak" : "Taşınan"}: ${moved}/${total} dosya`);
  console.log("   Not: Eski 'groups' klasörü Drive'da kalmaya devam ediyor — boşaldıktan sonra silebilirsin.");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(DRY_RUN ? "\n🔍 DRY-RUN modu — hiçbir şey oluşturulmayacak/taşınmayacak" : "");
  if (INIT_ALL)  await initAll();
  if (MIGRATE)   await migrate();
  console.log("\n✅ Tamamlandı.\n");
}

main().catch(err => {
  console.error("❌ Hata:", err.message);
  process.exit(1);
});
