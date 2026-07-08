/**
 * backfill-live-to-flexos.mjs
 *
 * Canlı sistemdeki gerçek veriyi (branches/groups/students) FlexOS'un yeni
 * koleksiyonlarına (flexos_users / flexos_groups / persons / enrollments) taşır.
 *
 * SADECE OKUR: canlı `users`/`branches`/`groups`/`students` koleksiyonlarına
 * hiçbir yazma yapılmaz. Yeni koleksiyonlara id'ler DETERMİNİSTİK (canlı id
 * aynen korunur) — script tekrar çalıştırılabilir (idempotent), veri çoğalmaz.
 *
 * Bilinen sınırlar (bilinçli, veri yok):
 *  - Öğrenciler için yeni Firebase Auth hesabı AÇILMAZ (sadece var olan authUid taşınır).
 *  - Group.schedule.days canlıda yapılandırılmış tutulmadığı için [] kalır.
 *  - Enrollment.result / saleId üretilmez (canlıda güvenilir veri yok).
 *  - Branş/Eğitim kataloğuna bağlama yapılmaz (Group.branch sadece isim string'i).
 *
 * Kullanım:
 *   node scripts/backfill-live-to-flexos.mjs --dry-run   # sadece sayaç/log, yazma yok
 *   node scripts/backfill-live-to-flexos.mjs             # gerçek yazma
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { resolve } from "path";

const serviceAccount = JSON.parse(readFileSync(resolve("service-account.json"), "utf8"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const DRY_RUN = process.argv.includes("--dry-run");
const nowTs = new Date().toISOString();

const OWNER_UID = "kYG8N01PTudh1VT1uvy2vg8vmAR2";
const OWNER_EMAIL = "alparslan.sennturk@gmail.com";

function clean(obj) {
  return JSON.parse(JSON.stringify(obj));
}

async function detectTenant() {
  const snap = await db.collection("persons").limit(1).get();
  if (!snap.empty) return snap.docs[0].data().tenantId || "default";
  return "default";
}

async function upsertOwnerFlexosUser(tenantId) {
  const ref = db.collection("flexos_users").doc(OWNER_UID);
  const existing = await ref.get();
  if (existing.exists) {
    console.log(`flexos_users/${OWNER_UID} zaten var, atlanıyor.`);
    return;
  }
  const doc = clean({
    id: OWNER_UID,
    tenantId,
    name: "Alparslan",
    surname: "Şentürk",
    email: OWNER_EMAIL,
    gender: "unspecified",
    roles: ["egitmen"],
    subes: ["Merkez"],
    status: "aktif",
    authUid: OWNER_UID,
    createdAt: nowTs,
    createdBy: "backfill-script",
  });
  console.log(`flexos_users/${OWNER_UID} ← ${doc.name} ${doc.surname} (roles: ${doc.roles.join(",")})`);
  if (!DRY_RUN) await ref.set(doc);
}

async function loadBranchLookup() {
  const snap = await db.collection("branches").get();
  const map = new Map();
  for (const d of snap.docs) map.set(d.id, d.data().name ?? d.id);
  console.log(`Canlı branches: ${map.size} kayıt okundu (lookup için).`);
  return map;
}

const GROUP_TYPE_MAP = { standart: "standart", özel_ders: "ozel_ders", kurumsal: "kurumsal" };
const GROUP_STATUS_MAP = { active: "active", archived: "archived" };

async function migrateGroups(tenantId, branchLookup) {
  const snap = await db.collection("groups").get();
  let migrated = 0;
  let warnings = 0;
  for (const d of snap.docs) {
    const g = d.data();
    const branchName = g.discipline ? branchLookup.get(g.discipline) ?? g.discipline : undefined;
    const type = GROUP_TYPE_MAP[g.type] ?? "standart";
    const status = GROUP_STATUS_MAP[g.status] ?? "active";
    if (!GROUP_STATUS_MAP[g.status]) {
      console.warn(`  [uyarı] grup ${d.id}: bilinmeyen status "${g.status}", "active" varsayıldı.`);
      warnings++;
    }
    const doc = clean({
      id: d.id,
      tenantId,
      code: g.code ?? d.id,
      branch: branchName,
      status,
      type,
      trainerId: g.instructorId ?? undefined,
      schedule: {
        startDate: g.startDate ?? nowTs.slice(0, 10),
        days: [],
        sessionHours: typeof g.sessionHours === "number" ? g.sessionHours : 2,
      },
      createdAt: g.createdAt ?? nowTs,
      createdBy: "backfill-script",
    });
    if (!DRY_RUN) await db.collection("flexos_groups").doc(d.id).set(doc);
    migrated++;
  }
  console.log(`Gruplar: ${migrated} taşındı, ${warnings} uyarı.`);
  return migrated;
}

const PERSON_STATUS_MAP = { active: "active", passive: "passive" };
const ENROLLMENT_STATUS_MAP = { active: "active", passive: "passive" };

async function migrateStudents(tenantId) {
  const snap = await db.collection("students").get();
  let persons = 0;
  let enrollments = 0;
  let noGroup = 0;
  let danglingGroup = 0;

  // Grup varlığını kontrol etmek için canlı groups id setini önceden çek.
  const groupsSnap = await db.collection("groups").select().get();
  const liveGroupIds = new Set(groupsSnap.docs.map((d) => d.id));

  for (const d of snap.docs) {
    const s = d.data();
    const personDoc = clean({
      id: d.id,
      tenantId,
      firstName: s.name ?? "",
      lastName: s.lastName ?? "",
      gender: s.gender ?? undefined,
      pii: s.email ? { email: s.email } : undefined,
      status: PERSON_STATUS_MAP[s.status] ?? "active",
      consentKVKK: false,
      authUid: s.authUid ?? undefined,
      isOnlineStudent: s.isOnlineStudent ?? undefined,
      createdAt: nowTs,
      createdBy: "backfill-script",
    });
    if (!DRY_RUN) await db.collection("persons").doc(d.id).set(personDoc);
    persons++;

    let groupId = s.groupId && s.groupId !== "unassigned" ? s.groupId : undefined;
    if (!groupId) {
      noGroup++;
    } else if (!liveGroupIds.has(groupId)) {
      console.warn(`  [uyarı] öğrenci ${d.id}: groupId "${groupId}" canlıda bulunamadı, grupsuz taşınıyor.`);
      danglingGroup++;
      groupId = undefined;
    }

    // Bu backfill'de kişi başı tek enrollment var → id'yi person id'sinden
    // deterministik türet (tekrar çalıştırmada duplike enrollment oluşmasın).
    const enrollmentRef = db.collection("enrollments").doc(d.id);
    const enrollmentDoc = clean({
      id: enrollmentRef.id,
      tenantId,
      personId: d.id,
      groupId,
      status: ENROLLMENT_STATUS_MAP[s.status] ?? "active",
      createdAt: nowTs,
      createdBy: "backfill-script",
    });
    if (!DRY_RUN) await enrollmentRef.set(enrollmentDoc);
    enrollments++;
  }

  console.log(`Öğrenciler: ${persons} person + ${enrollments} enrollment taşındı.`);
  console.log(`  Grupsuz: ${noGroup}, geçersiz groupId (grupsuza düşürüldü): ${danglingGroup}.`);
  return { persons, enrollments };
}

async function main() {
  console.log(DRY_RUN ? "=== DRY RUN (yazma yok) ===" : "=== GERÇEK ÇALIŞTIRMA ===");
  const tenantId = await detectTenant();
  console.log(`Kiracı: ${tenantId}`);

  await upsertOwnerFlexosUser(tenantId);
  const branchLookup = await loadBranchLookup();
  await migrateGroups(tenantId, branchLookup);
  await migrateStudents(tenantId);

  console.log(DRY_RUN ? "\nDry-run bitti, hiçbir şey yazılmadı." : "\nBackfill tamamlandı.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
