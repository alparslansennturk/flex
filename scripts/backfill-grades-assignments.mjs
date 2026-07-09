/**
 * backfill-grades-assignments.mjs
 *
 * Canlıdaki sertifika notları (`projectGrades`) + normal ödev/teslim geçmişini
 * (`tasks`/`submissions`, gamified HARİÇ, dosya/ek HARİÇ) FlexOS'un yeni
 * koleksiyonlarına (`enrollments`/`flexos_grades`/`flexos_assignments`/`flexos_submissions`)
 * taşır. Kapsam: SADECE Grup 541/550/598 (kullanıcı onayı, 2026-07-09).
 *
 * SADECE OKUR: canlı `projectGrades`/`tasks`/`submissions`/`groups` koleksiyonlarına
 * hiçbir yazma yapılmaz.
 *
 * Modül ayrımı (kullanıcı kararı): 541/598 canlıda AYNI grup doküman id'sini
 * Grafik1→Grafik2 geçişinde de korumuş (sadece `code` değişmiş, `codeAt_GRAFIK_1`
 * alanında eski kod iz bırakmış). Yeni sistemde Group/Enrollment'ta "modül" alanı
 * olmadığı için, kullanıcı kararıyla Grafik1 dönemi için AYRI bir sentetik grup
 * oluşturuluyor (id: `${liveGroupId}_grafik1`, kod: eski `codeAt_GRAFIK_1` değeri)
 * — böylece "Grup 296" ve "Grup 541" arayüzde birbirinden ayrı görünür.
 *
 * 550 farklı: canlıda hâlâ GRAFIK_1 (henüz Grafik2'ye geçmedi orada), o yüzden
 * sentetik grup GEREKMİYOR — dünkü backfill'in oluşturduğu enrollment zaten
 * Grafik1'i temsil ediyor, sadece status "completed"e çevrilecek. 550'de hiç
 * `projectGrades` kaydı yok (proje notu 1-2 ay sonra giriliyor) — Grade dokümanı
 * yine de oluşturulur ama BOŞ ve KİLİTSİZ bırakılır (ileride elle doldurulacak).
 *
 * Ödev Notu % (Sertifika Notu ekranındaki kolon) — `Assignment`/`Submission`
 * kayıtlarından DEĞİL (onlar `status:"closed"` olduğu için `computeOdevYuzdeleri`
 * onları hiç saymaz, bilinen sınır), `Grade.components.odevNotu` SNAPSHOT'ından
 * gelir (`not/page.tsx` bu alan doluysa canlı hesaplamanın yerine geçer). Değer
 * canlının GERÇEK formülünün tersine çevrilmesiyle bulunur — `deriveOdevPct()`:
 * canlıda `odevPuani = round(studentXP/maxXP × maxOdevPuani)`, `maxOdevPuani =
 * assignmentWeight × 100` (branşa özel, `users/{OWNER_UID}.certSettings` — SABİT
 * %30 varsayılmaz, gerçek ayardan okunur). Tahmin YOK — sadece `odevPuani` alanı
 * dolu olan kayıtlar için hesaplanır (2026-07-09 kararı, iki kez düzeltildi:
 * önce `odevPuani`'yi doğrudan yüzde sanmıştım, sonra sadece `finalNote`+
 * `projectScore` ikisi de doluyken hesaplıyordum — halbuki `odevPuani` proje
 * notundan bağımsız, her zaman kullanılabilir).
 *
 * `tasks`/`submissions` backfill'i (maxPuan=100 sabit, CEZA_ORANI penaltı) yine de
 * yapılır — kayıt/detay amaçlı (Ödev Verme ekranında görünür) ama `status:"closed"`
 * olduğu için Ödev Notu YÜZDESİ hesabını ETKİLEMEZ, onu SADECE yukarıdaki snapshot
 * belirler.
 *
 * Kullanım:
 *   node scripts/backfill-grades-assignments.mjs --dry-run
 *   node scripts/backfill-grades-assignments.mjs
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { resolve } from "path";

const serviceAccount = JSON.parse(readFileSync(resolve("service-account.json"), "utf8"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const DRY_RUN = process.argv.includes("--dry-run");
const nowTs = new Date().toISOString();
const OWNER_UID = "kYG8N01PTudh1VT1uvy2vg8vmAR2";

function clean(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function tsToIso(v) {
  if (!v) return undefined;
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === "string") return v;
  return undefined;
}

/**
 * Ödev Notu % — canlı `dashboard/grading/page.tsx` formülünün TAM tersine çevrilmişi
 * (tahmin YOK, gerçek ayardan): canlıda `odevPuani = round(studentXP/maxXP × maxOdevPuani)`
 * olarak hesaplanıp saklanıyor (`maxOdevPuani = assignmentWeight × 100`, branşa özel
 * `users/{OWNER_UID}.certSettings[disciplineId].assignmentWeight` ayarından — bu proje
 * grubu için 0.3, yani maxOdevPuani=30, GERÇEK veriden doğrulandı 2026-07-09). Bu yüzden
 * odev% = odevPuani / maxOdevPuani × 100 — proje notundan TAMAMEN BAĞIMSIZ, `projectGrades`
 * kaydı olan HER öğrenci için hesaplanabilir (önceki sürüm yanlışlıkla sadece finalNote+
 * projectScore ikisi de doluysa hesaplıyordu, gereksiz kısıtlıydı).
 */
function deriveOdevPct(g, maxOdevPuani) {
  if (typeof g.odevPuani !== "number" || !maxOdevPuani) return null;
  return Math.round((g.odevPuani / maxOdevPuani) * 100);
}

// groupKey -> { liveGroupId, hasSplit (Grafik1 ayrı sentetik grup mu gerekiyor) }
const TARGET_GROUPS = {
  "541": { liveGroupId: "4Lib4kA3YvTIqNQ5M2VD", split: true },
  "550": { liveGroupId: "i6OxhplzHS3BBv9BwdDK", split: false },
  "598": { liveGroupId: "8Hisru9CH1rqpCI5zRA2", split: true },
};

const CEZA_ORANI = { teslim: 0, gec1: 0.1, gec2: 0.2 };

function tierFromSubmission(sub, dueDateIso) {
  if (!sub.isLate || !dueDateIso) return "teslim";
  const submittedMs = tsToIso(sub.submittedAt) ? new Date(tsToIso(sub.submittedAt)).getTime() : undefined;
  if (!submittedMs) return "gec1";
  const diffDays = Math.ceil((submittedMs - new Date(dueDateIso).getTime()) / 86400000);
  return diffDays > 7 ? "gec2" : "gec1";
}

async function detectTenant() {
  const snap = await db.collection("persons").limit(1).get();
  if (!snap.empty) return snap.docs[0].data().tenantId || "default";
  return "default";
}

async function loadBranchLookup() {
  const snap = await db.collection("branches").get();
  const map = new Map();
  for (const d of snap.docs) map.set(d.id, d.data().name ?? d.id);
  return map;
}

async function main() {
  console.log(DRY_RUN ? "=== DRY RUN (yazma yok) ===" : "=== GERÇEK ÇALIŞTIRMA ===");
  const tenantId = await detectTenant();
  console.log(`Kiracı: ${tenantId}`);
  const branchLookup = await loadBranchLookup();
  // Canlı ayardan gerçek assignmentWeight (branşa özel, SABİT 0.3 varsayılmaz).
  const ownerSnap = await db.collection("users").doc(OWNER_UID).get();
  const certSettings = ownerSnap.data()?.certSettings ?? {};

  const stats = {
    syntheticGroups: 0,
    enrollmentsUpdated: 0,
    enrollmentsCreated: 0,
    grades: 0,
    assignments: 0,
    assignmentsSkippedGamified: 0,
    submissions: 0,
    warnings: [],
  };

  for (const [code, cfg] of Object.entries(TARGET_GROUPS)) {
    console.log(`\n--- Grup ${code} (liveId=${cfg.liveGroupId}) ---`);
    const liveGroupSnap = await db.collection("groups").doc(cfg.liveGroupId).get();
    const liveGroup = liveGroupSnap.data();
    const branchName = liveGroup.discipline ? branchLookup.get(liveGroup.discipline) ?? liveGroup.discipline : undefined;
    const assignmentWeight = certSettings[liveGroup.discipline]?.assignmentWeight ?? 0.3;
    const maxOdevPuani = assignmentWeight * 100;
    console.log(`  assignmentWeight=${assignmentWeight} (maxOdevPuani=${maxOdevPuani})`);

    // ── Grafik1 için sentetik grup (sadece split gerekenlerde) ──
    let grafik1GroupId = cfg.liveGroupId; // 550: kendi grubu Grafik1'in ta kendisi
    if (cfg.split) {
      const histCode = liveGroup.codeAt_GRAFIK_1 ?? `${code}-grafik1`;
      grafik1GroupId = `${cfg.liveGroupId}_grafik1`;
      const histGroupDoc = clean({
        id: grafik1GroupId,
        tenantId,
        code: histCode,
        branch: branchName,
        status: "completed",
        type: "standart",
        trainerId: liveGroup.instructorId ?? undefined,
        schedule: { startDate: liveGroup.startDate ?? nowTs.slice(0, 10), days: [], sessionHours: 2 },
        createdAt: nowTs,
        createdBy: "backfill-grades-script",
      });
      console.log(`  [sentetik grup] flexos_groups/${grafik1GroupId} ← "${histCode}" (Grafik1 tarihi kaydı)`);
      if (!DRY_RUN) await db.collection("flexos_groups").doc(grafik1GroupId).set(histGroupDoc);
      stats.syntheticGroups++;
    }

    const grafik2GroupId = cfg.liveGroupId; // her zaman mevcut/live grup id'si

    // ── projectGrades → Enrollment + Grade ──
    const pgSnap = await db.collection("projectGrades").where("groupId", "==", cfg.liveGroupId).get();
    const byModule = { GRAFIK_1: [], GRAFIK_2: [] };
    pgSnap.docs.forEach((d) => {
      const g = d.data();
      if (byModule[g.module]) byModule[g.module].push(g);
    });
    console.log(`  projectGrades: GRAFIK_1=${byModule.GRAFIK_1.length}, GRAFIK_2=${byModule.GRAFIK_2.length}`);

    // Grafik1 notları
    for (const g of byModule.GRAFIK_1) {
      const personSnap = await db.collection("persons").doc(g.studentId).get();
      if (!personSnap.exists) {
        stats.warnings.push(`Grup ${code} GRAFIK_1: person ${g.studentId} (${g.studentName}) bulunamadı, atlandı`);
        continue;
      }
      const targetGroupId = cfg.split ? grafik1GroupId : grafik1GroupId; // split ise sentetik, değilse (550) kendi live id'si
      const enrollmentId = cfg.split ? `${g.studentId}_grafik1_${cfg.liveGroupId}` : g.studentId; // 550: dünkü enrollment id'sini reuse et
      const enrollmentDoc = clean({
        id: enrollmentId,
        tenantId,
        personId: g.studentId,
        groupId: targetGroupId,
        status: "completed",
        createdAt: nowTs,
        createdBy: "backfill-grades-script",
      });
      console.log(`  [enrollment] ${enrollmentId} ← ${g.studentName} (Grafik1, completed, groupId=${targetGroupId})`);
      if (!DRY_RUN) await db.collection("enrollments").doc(enrollmentId).set(enrollmentDoc, { merge: true });
      cfg.split ? stats.enrollmentsCreated++ : stats.enrollmentsUpdated++;

      const gradeDoc = clean({
        id: enrollmentId,
        tenantId,
        enrollmentId,
        personId: g.studentId,
        groupId: targetGroupId,
        projectGrade: typeof g.projectScore === "number" ? g.projectScore : undefined,
        // Ödev Notu'nu YENİDEN HESAPLAMAYA çalışmıyoruz (gerçek ödev/teslim verisi kısmi/eksik
        // olabilir — kullanıcı kararı 2026-07-09: "sertifika not kısmında zaten hesaplanmış
        // ödev notları var, onu al sadece yeter"). Canlının `odevPuani`'si snapshot olarak
        // buraya yazılır, `not/page.tsx` bu alan doluysa canlı hesaplama yerine BUNU gösterir.
        components: deriveOdevPct(g, maxOdevPuani) != null ? { odevNotu: deriveOdevPct(g, maxOdevPuani) } : undefined,
        // Kilit "Sertifika Bastır" aksiyonuna bağlı (henüz kod yok) — canlının
        // isFinalized'ı buraya taşınmaz, kullanıcı kararı: not hep AÇIK kalır.
        locked: false,
        createdAt: nowTs,
        createdBy: "backfill-grades-script",
      });
      if (!DRY_RUN) await db.collection("flexos_grades").doc(enrollmentId).set(gradeDoc);
      stats.grades++;
    }

    // 550 özel durum: hiç projectGrades yoksa yine de enrollment'ı completed'a çevir + boş açık Grade oluştur
    if (!cfg.split && byModule.GRAFIK_1.length === 0) {
      const studentsSnap = await db.collection("students").where("groupId", "==", cfg.liveGroupId).get();
      console.log(`  [özel] Grup ${code}: projectGrades yok, ${studentsSnap.size} öğrenci için boş/açık Grade + completed enrollment oluşturuluyor`);
      for (const sd of studentsSnap.docs) {
        const personId = sd.id;
        const enrollmentDoc = clean({
          id: personId,
          tenantId,
          personId,
          groupId: grafik1GroupId,
          status: "completed",
          createdAt: nowTs,
          createdBy: "backfill-grades-script",
        });
        if (!DRY_RUN) await db.collection("enrollments").doc(personId).set(enrollmentDoc, { merge: true });
        stats.enrollmentsUpdated++;

        const gradeDoc = clean({
          id: personId,
          tenantId,
          enrollmentId: personId,
          personId,
          groupId: grafik1GroupId,
          locked: false,
          createdAt: nowTs,
          createdBy: "backfill-grades-script",
        });
        if (!DRY_RUN) await db.collection("flexos_grades").doc(personId).set(gradeDoc);
        stats.grades++;
      }
    }

    // Grafik2 notları (541/598 — mevcut aktif enrollment'a Grade ekle, status'a dokunma)
    for (const g of byModule.GRAFIK_2) {
      const personSnap = await db.collection("persons").doc(g.studentId).get();
      if (!personSnap.exists) {
        stats.warnings.push(`Grup ${code} GRAFIK_2: person ${g.studentId} (${g.studentName}) bulunamadı, atlandı`);
        continue;
      }
      const enrollmentId = g.studentId; // dünkü aktif enrollment, id=personId
      console.log(`  [grade-only] ${enrollmentId} ← ${g.studentName} (Grafik2, mevcut aktif enrollment'a Grade ekleniyor)`);
      const gradeDoc = clean({
        id: enrollmentId,
        tenantId,
        enrollmentId,
        personId: g.studentId,
        groupId: grafik2GroupId,
        projectGrade: typeof g.projectScore === "number" ? g.projectScore : undefined,
        // Ödev Notu'nu YENİDEN HESAPLAMAYA çalışmıyoruz (gerçek ödev/teslim verisi kısmi/eksik
        // olabilir — kullanıcı kararı 2026-07-09: "sertifika not kısmında zaten hesaplanmış
        // ödev notları var, onu al sadece yeter"). Canlının `odevPuani`'si snapshot olarak
        // buraya yazılır, `not/page.tsx` bu alan doluysa canlı hesaplama yerine BUNU gösterir.
        components: deriveOdevPct(g, maxOdevPuani) != null ? { odevNotu: deriveOdevPct(g, maxOdevPuani) } : undefined,
        // Kilit "Sertifika Bastır" aksiyonuna bağlı (henüz kod yok) — canlının
        // isFinalized'ı buraya taşınmaz, kullanıcı kararı: not hep AÇIK kalır.
        locked: false,
        createdAt: nowTs,
        createdBy: "backfill-grades-script",
      });
      if (!DRY_RUN) await db.collection("flexos_grades").doc(enrollmentId).set(gradeDoc);
      stats.grades++;
    }

    // ── tasks (normal, gamified hariç) → Assignment ──
    const tasksSnap = await db.collection("tasks").where("groupId", "==", cfg.liveGroupId).get();
    const tasksByModule = { GRAFIK_1: [], GRAFIK_2: [], OTHER: [] };
    for (const d of tasksSnap.docs) {
      const t = d.data();
      if (t.assignmentType) { stats.assignmentsSkippedGamified++; continue; } // gamified hariç
      const bucket = t.groupModule === "GRAFIK_1" ? "GRAFIK_1" : t.groupModule === "GRAFIK_2" ? "GRAFIK_2" : "OTHER";
      tasksByModule[bucket].push({ id: d.id, ...t });
    }
    console.log(`  tasks (normal, gamified hariç): GRAFIK_1=${tasksByModule.GRAFIK_1.length}, GRAFIK_2=${tasksByModule.GRAFIK_2.length}, diğer=${tasksByModule.OTHER.length}`);

    const moduleGroupMap = { GRAFIK_1: grafik1GroupId, GRAFIK_2: grafik2GroupId, OTHER: grafik2GroupId };

    for (const moduleKey of ["GRAFIK_1", "GRAFIK_2", "OTHER"]) {
      for (const t of tasksByModule[moduleKey]) {
        const targetGroupId = moduleGroupMap[moduleKey];
        const dueDateIso = t.endDate ? new Date(t.endDate).toISOString() : undefined;
        const statusMap = { completed: "closed", active: "published" };
        if (!statusMap[t.status]) stats.warnings.push(`task ${t.id} "${t.name}": bilinmeyen status "${t.status}", "published" varsayıldı`);
        const assignmentDoc = clean({
          id: t.id,
          tenantId,
          groupId: targetGroupId,
          trainerId: t.createdBy ?? OWNER_UID,
          title: t.name ?? "(isimsiz)",
          subtitle: t.subtitle ?? undefined,
          description: t.description ?? "",
          dueDate: dueDateIso,
          status: statusMap[t.status] ?? "published",
          icon: t.icon ?? undefined,
          maxPuan: 100,
          kind: t.type === "proje" ? "proje" : "normal",
          attachments: [],
          createdAt: tsToIso(t.createdAt) ?? nowTs,
          createdBy: "backfill-grades-script",
        });
        if (!DRY_RUN) await db.collection("flexos_assignments").doc(t.id).set(assignmentDoc);
        stats.assignments++;

        // ── submissions (bu task için, en son iterasyon) ──
        const subsSnap = await db.collection("submissions").where("taskId", "==", t.id).get();
        const latestByStudent = new Map();
        for (const sd of subsSnap.docs) {
          const s = sd.data();
          const prev = latestByStudent.get(s.studentId);
          const subMs = tsToIso(s.submittedAt) ? new Date(tsToIso(s.submittedAt)).getTime() : 0;
          const prevMs = prev ? (tsToIso(prev.submittedAt) ? new Date(tsToIso(prev.submittedAt)).getTime() : 0) : -1;
          if (!prev || subMs > prevMs) latestByStudent.set(s.studentId, s);
        }

        for (const [studentId, s] of latestByStudent) {
          const personSnap = await db.collection("persons").doc(studentId).get();
          if (!personSnap.exists) {
            stats.warnings.push(`submission ${t.id}/${studentId}: person bulunamadı, atlandı`);
            continue;
          }
          const tier = tierFromSubmission(s, dueDateIso);
          const grade = Math.round(100 * (1 - CEZA_ORANI[tier]));
          const submittedIso = tsToIso(s.submittedAt) ?? nowTs;
          const submissionId = `${t.id}_${studentId}`;
          const submissionDoc = clean({
            id: submissionId,
            tenantId,
            assignmentId: t.id,
            groupId: targetGroupId,
            personId: studentId,
            status: "completed",
            iteration: 1,
            isLate: s.isLate === true,
            note: s.note ?? undefined,
            submittedAt: submittedIso,
            lastSubmittedAt: tsToIso(s.updatedAt) ?? submittedIso,
            grade,
            gradedAt: tsToIso(s.updatedAt) ?? submittedIso,
            gradedBy: OWNER_UID,
            createdAt: submittedIso,
            createdBy: "backfill-grades-script",
          });
          if (!DRY_RUN) await db.collection("flexos_submissions").doc(submissionId).set(submissionDoc);
          stats.submissions++;
        }
      }
    }
  }

  console.log("\n=== ÖZET ===");
  console.log(`Sentetik (Grafik1) grup: ${stats.syntheticGroups}`);
  console.log(`Enrollment güncellendi (mevcut doküman): ${stats.enrollmentsUpdated}`);
  console.log(`Enrollment oluşturuldu (yeni doküman): ${stats.enrollmentsCreated}`);
  console.log(`Grade dokümanı: ${stats.grades}`);
  console.log(`Assignment: ${stats.assignments} (gamified hariç tutulan: ${stats.assignmentsSkippedGamified})`);
  console.log(`Submission: ${stats.submissions}`);
  if (stats.warnings.length) {
    console.log(`\nUyarılar (${stats.warnings.length}):`);
    stats.warnings.forEach((w) => console.log(`  - ${w}`));
  }
  console.log(DRY_RUN ? "\nDry-run bitti, hiçbir şey yazılmadı." : "\nBackfill tamamlandı.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
