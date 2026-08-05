/**
 * seed-loadtest.mjs — FlexOS yük/performans testi için gerçekçi, İLİŞKİLİ test verisi.
 *
 * GÜVENLİK — SADECE `flexos-loadtest` staging projesine yazar, ASLA prod'a
 * (`flexos-10ac4`) dokunmaz. `service-account-staging.json` zorunlu (repo kökünde,
 * `.gitignore`'da korunuyor) — dosya yoksa VEYA içindeki `project_id` beklenenden
 * farklıysa script hiçbir şey yazmadan durur (aşağıdaki `assertStagingProject`).
 *
 * Kullanım:
 *   npm run seed                          # profile=large (varsayılan), yaz
 *   node scripts/seed-loadtest.mjs --dry-run             # sadece sayaç, yazma yok
 *   node scripts/seed-loadtest.mjs --profile=small        # small|medium|large|system
 *   npm run seed:clean                     # ÖNCE bu profildeki eski seed verisini SİLER, sonra yazar
 *   node scripts/seed-loadtest.mjs --clean --dry-run       # ne silineceğini göster, silme
 *
 * İDEMPOTENT: tüm doküman id'leri DETERMİNİSTİK (`seed-student-0001` gibi) —
 * tekrar çalıştırmak veri çoğaltmaz, var olanın üzerine aynı içeriği yazar.
 * Her doküman `seedTag:"seed:loadtest"` taşır — `--clean` bununla bulur/siler,
 * gerçek/organik veriye (bu projede olması beklenmez ama yine de) ASLA dokunmaz.
 *
 * İLİŞKİ ZİNCİRİ (rastgele bağımsız kayıt YOK):
 *   Personel (flexos_users, roller BUILT_IN_ROLE_SEEDS'ten) — bir kısmı "egitmen"
 *     rolünde → her biri için flexos_trainers kaydı da açılır.
 *   Öğrenci (persons) → Enrollment ile BİR sınıfa (flexos_groups) bağlanır.
 *   Sınıf → o sınıfın eğitmeni (Trainer.id), Connect'te bir "sınıf odası" grup
 *     konuşması (üyeler = eğitmen + o sınıfın TÜM öğrencileri, gerçek mesajlarla).
 *   Her öğrenci ayrıca kendi eğitmeniyle 1 DM'e sahip.
 *   Ödev/Yoklama HER ZAMAN bir sınıfa (groupId) bağlı — sınıfın öğrencileri o
 *     ödevin/yoklamanın gerçek muhatabı.
 *   Bildirim her personel+öğrenciye (users/{uid}/notifications) — konuları
 *     (mesaj/ödev/duyuru) yukarıdaki gerçek varlıklara referans verir.
 */

import { readFileSync, existsSync } from "fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const EXPECTED_PROJECT_ID = "flexos-loadtest";
const SEED_TAG = "seed:loadtest";
const TENANT_ID = "default";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const CLEAN = args.includes("--clean");
const profileArg = args.find((a) => a.startsWith("--profile="));
const PROFILE_NAME = profileArg ? profileArg.split("=")[1] : "large";

// ─────────────────────────── Profiller ───────────────────────────
// Oranlar birbirine bağlı (rastgele değil): ~10 öğrenci/sınıf, ~20 ödev/sınıf,
// ~24 yoklama günü/sınıf (dönem boyu haftada 2), ~10 bildirim/kişi, mesaj
// hacmi sınıf-grubu+öğrenci-DM+personel-kanalı karışımına dağıtılır.
const PROFILES = {
  small: {
    students: 20, staff: 5, classes: 2,
    assignmentsPerClass: 4, sessionsPerClass: 6, notifPerPerson: 3,
    templates: 5, staffChannels: 1,
  },
  medium: {
    students: 150, staff: 15, classes: 15,
    assignmentsPerClass: 10, sessionsPerClass: 16, notifPerPerson: 6,
    templates: 12, staffChannels: 2,
  },
  large: {
    students: 500, staff: 50, classes: 50,
    assignmentsPerClass: 20, sessionsPerClass: 24, notifPerPerson: 10,
    templates: 20, staffChannels: 3,
  },
  // "system" — 2026-08-05, kullanıcı isteği: Connect DIŞINDA tüm modülleri (satış/
  // eğitim-op/eğitmen/admin-koordinatör/öğrenci) kapsayan orta ölçekli tam-sistem
  // testi için. Rol dağılımı ağırlıklı-RASTGELE DEĞİL, deterministik sayılarla
  // (`roleCounts`) — k6'nın her rolden yeterli/bilinen sayıda hesaba ihtiyacı var.
  // DM mesaj aralığı diğer profillerden bilerek düşük (2000-5000 toplam mesaj hedefi,
  // Connect zaten ayrı test edildiği için burada odak değil).
  system: {
    students: 500, staff: 20, classes: 40,
    assignmentsPerClass: 13, sessionsPerClass: 50, notifPerPerson: 8,
    templates: 15, staffChannels: 2,
    roleCounts: { genel_mudur: 3, satis_temsilcisi: 3, ogrenci_isleri: 3, egitmen: 8, egitim_koordinatoru: 3 },
    dmMessageRange: [1, 6],
    // Ödev değerlendirme (grading) senaryosunun hedefi olacak teslimler — sınıf
    // başına ilk N ödeve, ilk M öğrenciden "submitted" (henüz notlanmamış) kayıt.
    submissionsAssignmentsPerClass: 3,
    submissionsStudentsPerAssignment: 3,
  },
};
const PROFILE = PROFILES[PROFILE_NAME];
if (!PROFILE) {
  console.error(`Bilinmeyen profil: "${PROFILE_NAME}" — small|medium|large|system olmalı.`);
  process.exit(1);
}

// ─────────────────────────── Bootstrap ───────────────────────────
const SA_PATH = "service-account-staging.json";
if (!existsSync(SA_PATH)) {
  console.error(`"${SA_PATH}" bulunamadı. Bu script SADECE staging projesine yazar —`);
  console.error("prod service-account.json ASLA kullanılmaz. Kurulum için FLEXOS.md'ye bak.");
  process.exit(1);
}
const serviceAccount = JSON.parse(readFileSync(SA_PATH, "utf8"));

/** Bilinçli sert güvenlik kapısı — dosya YANLIŞLIKLA prod'un service-account.json'ı
 * olarak kopyalanmış/yeniden adlandırılmışsa BİLE burada durur, tek bir yazma
 * ÖNCESİNDE. Bu script'in var oluş amacı bu kontrolün ETRAFINDAN DOLAŞMAMAK. */
function assertStagingProject() {
  if (serviceAccount.project_id !== EXPECTED_PROJECT_ID) {
    console.error(`GÜVENLİK DURDURMASI: service-account-staging.json project_id="${serviceAccount.project_id}",`);
    console.error(`beklenen "${EXPECTED_PROJECT_ID}". Prod'a yazma riski nedeniyle işlem durduruldu.`);
    process.exit(1);
  }
}
assertStagingProject();

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
// Diğer script'lerdeki `clean()` (JSON round-trip) yerine — bulkWriter ile daha
// basit: opsiyonel alanlar (templateId, dueDate, sourceGroupId...) bilerek `undefined`.
db.settings({ ignoreUndefinedProperties: true });

// `bulkWriter` — Admin SDK'nın otomatik batch/rate-limit/retry mekanizması, binlerce
// dokümanı elle 500'lük chunk'lara bölmeden güvenle yazar/siler. `runClean()` de
// (aşağıda) bunu kullandığı için `--clean` bloğundan ÖNCE tanımlanmalı.
const writer = db.bulkWriter();
let writeCount = 0;
function w(ref, data) {
  writeCount++;
  if (DRY_RUN) return;
  writer.set(ref, { ...data, seedTag: SEED_TAG });
}

console.log(`=== FlexOS Yük Testi Seed — proje: ${serviceAccount.project_id} | profil: ${PROFILE_NAME} | ${DRY_RUN ? "DRY RUN" : "GERÇEK YAZMA"} ${CLEAN ? "(+ önce temizlik)" : ""} ===`);
console.log(`Hedef: ${PROFILE.students} öğrenci, ${PROFILE.staff} personel, ${PROFILE.classes} sınıf\n`);

// ─────────────────────────── --clean ───────────────────────────
// ID'ler deterministik olduğu için yeniden çalıştırmak zaten çoğaltmaz (üzerine
// yazar) — `--clean` asıl şunun için: profil KÜÇÜLTÜLDÜĞÜNDE (ör. large→small)
// önceki, artık üretilmeyecek yüksek-index'li dokümanlar öksüz kalmasın diye
// TAMAMEN sıfırdan başlamak. SADECE `seedTag==="seed:loadtest"` olan dokümanlara
// dokunur — bu projede organik veri olması beklenmez ama yine de asla körlemesine
// tüm koleksiyonu silmez.
async function deleteBySeedTag(collectionPath) {
  const snap = await db.collection(collectionPath).where("seedTag", "==", SEED_TAG).get();
  if (snap.empty) return 0;
  for (const doc of snap.docs) writer.delete(doc.ref);
  return snap.size;
}

async function runClean() {
  console.log("--- Temizlik: önceki seed verisi siliniyor ---");
  let total = 0;

  // connect_conversations: recursiveDelete alt-koleksiyonları (members/messages)
  // da temizler — tek tek silmeye gerek yok.
  const convSnap = await db.collection("connect_conversations").where("seedTag", "==", SEED_TAG).get();
  for (const doc of convSnap.docs) {
    if (!DRY_RUN) await db.recursiveDelete(doc.ref);
    total++;
  }

  // users/{uid}/notifications — `notifications` YENİ bir collectionGroup olduğu
  // için (bu projede daha önce hiç yoktu) tek-alan index'i bilinçli olarak
  // BEKLEMİYORUZ (dakikalarca "FAILED_PRECONDITION" verebiliyor, boş bir
  // collection group'ta index aktivasyonu garip şekilde yavaş). Bunun yerine:
  // ÖNCE persons/flexos_users'tan (seedTag'li) authUid'leri topla, HER uid için
  // doğrudan `users/{uid}/notifications` alt-koleksiyonunu recursiveDelete et —
  // hiçbir index gerektirmez, "hangi uid'ler bizim" bilgisini zaten biliyoruz.
  const [personsSnap, usersSnap] = await Promise.all([
    db.collection("persons").where("seedTag", "==", SEED_TAG).get(),
    db.collection("flexos_users").where("seedTag", "==", SEED_TAG).get(),
  ]);
  const seededUids = [
    ...personsSnap.docs.map((d) => d.data().authUid),
    ...usersSnap.docs.map((d) => d.data().authUid),
  ].filter(Boolean);
  for (const uid of seededUids) {
    if (!DRY_RUN) await db.recursiveDelete(db.collection("users").doc(uid).collection("notifications"));
    total++;
  }

  for (const col of [
    "flexos_users", "flexos_trainers", "persons", "flexos_groups",
    "enrollments", "flexos_assignment_templates", "flexos_assignments", "flexos_attendance",
    "flexos_submissions",
  ]) {
    total += await deleteBySeedTag(col);
  }

  if (!DRY_RUN) await writer.flush();
  console.log(`${DRY_RUN ? "Silinecek" : "Silindi"}: ${total} doküman (+ konuşmaların alt-koleksiyonları)\n`);
}

if (CLEAN) await runClean();

// ─────────────────────────── Yardımcılar ───────────────────────────
const nowIso = () => new Date().toISOString();
const pad = (n, len = 4) => String(n).padStart(len, "0");
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const pickN = (arr, n) => [...arr].sort(() => Math.random() - 0.5).slice(0, n);
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
/** Geçmişe doğru rastgele bir ISO zaman damgası — `daysBack` gün öncesine kadar. */
function pastIso(daysBack) {
  const d = new Date();
  d.setDate(d.getDate() - randInt(0, daysBack));
  d.setHours(randInt(8, 22), randInt(0, 59), 0, 0);
  return d.toISOString();
}

const FIRST_NAMES_F = ["Ayşe", "Zeynep", "Elif", "Fatma", "Emine", "Hatice", "Merve", "Büşra", "Selin", "Ece", "Naz", "Defne", "İrem", "Ceren", "Gizem", "Yasemin", "Aslı", "Deniz", "Buse", "Sude"];
const FIRST_NAMES_M = ["Mehmet", "Mustafa", "Ahmet", "Ali", "Hüseyin", "Hasan", "İbrahim", "Emre", "Burak", "Kaan", "Onur", "Barış", "Kerem", "Efe", "Berkay", "Yiğit", "Alper", "Cem", "Uğur", "Serkan"];
const LAST_NAMES = ["Yılmaz", "Kaya", "Demir", "Şahin", "Çelik", "Yıldız", "Yıldırım", "Öztürk", "Aydın", "Özdemir", "Arslan", "Doğan", "Kılıç", "Aslan", "Çetin", "Kara", "Koç", "Kurt", "Özkan", "Şimşek", "Erdoğan", "Güneş", "Bulut", "Aksoy", "Tekin"];
const BRANCHES = ["Grafik Tasarım", "Web Geliştirme", "Dijital Pazarlama", "UI/UX Tasarım", "Python ile Veri Analizi", "Fotoğrafçılık", "3D Animasyon", "Sosyal Medya Yönetimi"];
const STAFF_TITLES = ["Kıdemli Eğitmen", "Eğitmen", "Satış Uzmanı", "Operasyon Uzmanı", "Koordinatör", "Uzman"];
const MESSAGE_SNIPPETS = [
  "Merhaba, ödevi ne zaman teslim etmemiz gerekiyor?", "Hocam bugünkü ders saat kaçta?",
  "Anladım, teşekkürler!", "Bu konuyu tekrar anlatabilir misiniz?", "Dosyayı gönderdim, kontrol edebilir misiniz?",
  "Yarın derse gelemeyeceğim, izin alabilir miyim?", "Harika bir ders oldu, teşekkürler.",
  "Ödevimi tamamladım, geri bildirim bekliyorum.", "Bu materyali nereden bulabilirim?", "Tekrar merhaba, küçük bir sorum var.",
  "Sınav tarihi kesinleşti mi?", "Proje konusunu değiştirebilir miyim?", "Çok teşekkür ederim, çok yardımcı oldunuz.",
  "Bir sonraki modül ne zaman başlıyor?", "Materyalleri paylaşabilir misiniz?", "Tamamdır, notlarımı aldım.",
  "Grup çalışması için kimlerle eşleşeceğiz?", "Ders kaydı var mı, izleyebilir miyim?", "Sertifika süreci nasıl işliyor?",
  "Bugün derse birkaç dakika geç kalacağım.",
];
const NOTIF_TITLES = [
  { type: "message", title: "Yeni mesajınız var", preview: "Size yeni bir mesaj gönderildi." },
  { type: "assignment", title: "Yeni ödev yayınlandı", preview: "Sınıfınıza yeni bir ödev eklendi." },
  { type: "announcement", title: "Kurum duyurusu", preview: "Yeni bir duyuru yayınlandı." },
  { type: "system", title: "Sistem bildirimi", preview: "Hesabınızla ilgili bir güncelleme var." },
];

const studentUid = (i) => `seed-student-${pad(i)}`;
const staffUid = (i) => `seed-staff-${pad(i)}`;
const personId = (i) => `seed-person-${pad(i)}`;
const flexosUserId = (i) => `seed-flexosuser-${pad(i)}`;
const trainerId = (i) => `seed-trainer-${pad(i)}`;
const groupId = (i) => `seed-group-${pad(i)}`;
const enrollmentId = (i) => `seed-enr-${pad(i)}`;
const assignmentId = (gi, ai) => `seed-assign-${pad(gi)}-${pad(ai, 3)}`;
const templateId = (i) => `seed-tpl-${pad(i)}`;

// ═══════════════════════════════════════════════════════════════════
// 1) Personel (flexos_users) + Eğitmenler (flexos_trainers)
// ═══════════════════════════════════════════════════════════════════
const ROLE_POOL = [
  { id: "egitmen", weight: 0.5 },
  { id: "satis_temsilcisi", weight: 0.2 },
  { id: "ogrenci_isleri", weight: 0.1 },
  { id: "egitim_koordinatoru", weight: 0.08 },
  { id: "finans", weight: 0.07 },
  { id: "genel_mudur", weight: 0.05 },
];
function weightedRole() {
  const r = Math.random();
  let acc = 0;
  for (const role of ROLE_POOL) {
    acc += role.weight;
    if (r <= acc) return role.id;
  }
  return "egitmen";
}

// `roleCounts` varsa (ör. "system" profili) rol dağılımı DETERMİNİSTİK — idempotentlik
// için rastgele shuffle YOK, sabit blok sırası yeterli (hangi uid'in hangi rolde
// olduğu önemli değil, sadece SAYILAR sabit olmalı — tekrar çalıştırınca aynı sonuç).
function deterministicRoles(counts, expectedTotal) {
  const roles = [];
  for (const [role, n] of Object.entries(counts)) {
    for (let k = 0; k < n; k++) roles.push(role);
  }
  if (roles.length !== expectedTotal) {
    console.error(`roleCounts toplamı (${roles.length}) PROFILE.staff (${expectedTotal}) ile uyuşmuyor.`);
    process.exit(1);
  }
  return roles;
}
const DETERMINISTIC_ROLES = PROFILE.roleCounts ? deterministicRoles(PROFILE.roleCounts, PROFILE.staff) : null;

const staffList = []; // { flexosUserId, authUid, name, surname, role, trainerId? }
for (let i = 1; i <= PROFILE.staff; i++) {
  const isFemale = Math.random() < 0.5;
  const name = pick(isFemale ? FIRST_NAMES_F : FIRST_NAMES_M);
  const surname = pick(LAST_NAMES);
  const role = DETERMINISTIC_ROLES ? DETERMINISTIC_ROLES[i - 1] : weightedRole();
  const uid = staffUid(i);
  const fid = flexosUserId(i);

  w(db.collection("flexos_users").doc(fid), {
    id: fid, tenantId: TENANT_ID,
    name, surname, email: `${fid}@loadtest.flex`, phone: `05${randInt(30, 59)}${randInt(1000000, 9999999)}`,
    gender: isFemale ? "female" : "male",
    title: pick(STAFF_TITLES),
    roles: [role], subes: [],
    status: "aktif", authUid: uid,
    createdAt: nowIso(), createdBy: "seed:loadtest",
  });

  let tId;
  if (role === "egitmen") {
    tId = trainerId(i);
    w(db.collection("flexos_trainers").doc(tId), {
      id: tId, tenantId: TENANT_ID,
      name: `${name} ${surname}`, email: `${fid}@loadtest.flex`,
      branchOffices: [], status: "aktif",
      competencies: { [pick(BRANCHES)]: [pick(BRANCHES)] },
      authUid: uid,
      createdAt: nowIso(), createdBy: "seed:loadtest",
    });
  }

  staffList.push({ flexosUserId: fid, authUid: uid, name, surname, role, trainerId: tId });
}
const trainers = staffList.filter((s) => s.role === "egitmen");
if (trainers.length === 0) throw new Error("Hiç eğitmen üretilmedi — profildeki personel sayısını artır.");
console.log(`✓ Personel: ${staffList.length} (${trainers.length} eğitmen)`);

// ═══════════════════════════════════════════════════════════════════
// 2) Öğrenciler (persons)
// ═══════════════════════════════════════════════════════════════════
const studentList = []; // { personId, authUid, name, surname }
for (let i = 1; i <= PROFILE.students; i++) {
  const isFemale = Math.random() < 0.5;
  const firstName = pick(isFemale ? FIRST_NAMES_F : FIRST_NAMES_M);
  const lastName = pick(LAST_NAMES);
  const uid = studentUid(i);
  const pid = personId(i);

  w(db.collection("persons").doc(pid), {
    id: pid, tenantId: TENANT_ID,
    firstName, lastName,
    gender: isFemale ? "female" : "male",
    pii: { phone: `05${randInt(30, 59)}${randInt(1000000, 9999999)}`, email: `${pid}@loadtest.flex` },
    status: "active", consentKVKK: true,
    authUid: uid,
    createdAt: nowIso(), createdBy: "seed:loadtest",
  });

  studentList.push({ personId: pid, authUid: uid, name: firstName, surname: lastName });
}
console.log(`✓ Öğrenci: ${studentList.length}`);

// ═══════════════════════════════════════════════════════════════════
// 3) Sınıflar (flexos_groups) + Enrollment (öğrenci→sınıf, round-robin)
// ═══════════════════════════════════════════════════════════════════
const classList = []; // { groupId, trainer, branch, code, students: [studentList items] }
for (let i = 1; i <= PROFILE.classes; i++) {
  const trainer = trainers[i % trainers.length];
  const branch = pick(BRANCHES);
  const gid = groupId(i);
  const days = pick([[1, 3], [2, 4], [1, 4], [3, 5]]); // Pzt/Çar, Sal/Per, vb.
  const startDate = new Date(); startDate.setDate(startDate.getDate() - randInt(20, 90));

  w(db.collection("flexos_groups").doc(gid), {
    id: gid, tenantId: TENANT_ID,
    code: `LT-${pad(i, 3)}`,
    branch, status: "active", type: "standart",
    trainerId: trainer.trainerId,
    schedule: {
      startDate: startDate.toISOString().slice(0, 10),
      days, sessionHours: 3, startTime: "19:00", endTime: "22:00",
    },
    capacity: 15,
    createdAt: nowIso(), createdBy: "seed:loadtest",
  });

  classList.push({ groupId: gid, trainer, branch, code: `LT-${pad(i, 3)}`, students: [] });
}

// Her öğrenciyi TAM OLARAK bir sınıfa yerleştir (round-robin — gerçekçi, ~10/sınıf).
let enrCounter = 0;
for (const student of studentList) {
  const cls = classList[enrCounter % classList.length];
  cls.students.push(student);
  enrCounter++;

  const eid = enrollmentId(enrCounter);
  w(db.collection("enrollments").doc(eid), {
    id: eid, tenantId: TENANT_ID,
    personId: student.personId, groupId: cls.groupId,
    status: "active",
    createdAt: nowIso(), createdBy: "seed:loadtest",
  });
}
console.log(`✓ Sınıf: ${classList.length} | Enrollment: ${enrCounter}`);

// ═══════════════════════════════════════════════════════════════════
// 4) Ödev Şablonları (flexos_assignment_templates) — global, sınıftan bağımsız
// ═══════════════════════════════════════════════════════════════════
const templates = [];
for (let i = 1; i <= PROFILE.templates; i++) {
  const tid = templateId(i);
  const branch = pick(BRANCHES);
  w(db.collection("flexos_assignment_templates").doc(tid), {
    id: tid, tenantId: TENANT_ID,
    scope: "global",
    branch, title: `${branch} — Uygulama ${i}`,
    description: `${branch} kapsamında hazırlanan ${i}. uygulama ödevi.`,
    kind: "normal", maxPuan: 100, attachments: [], visible: true,
    createdAt: nowIso(), createdBy: "seed:loadtest",
  });
  templates.push(tid);
}
console.log(`✓ Ödev şablonu: ${templates.length}`);

// ═══════════════════════════════════════════════════════════════════
// 5) Ödevler (flexos_assignments) — sınıf başına N adet
// ═══════════════════════════════════════════════════════════════════
let assignmentCount = 0;
const assignmentsByClass = new Map(); // groupId → [assignmentId,...] (submission seed'i için, aşağıda)
for (const cls of classList) {
  const classAssignmentIds = [];
  for (let ai = 1; ai <= PROFILE.assignmentsPerClass; ai++) {
    const aid = assignmentId(classList.indexOf(cls) + 1, ai);
    const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + randInt(-30, 30));
    w(db.collection("flexos_assignments").doc(aid), {
      id: aid, tenantId: TENANT_ID,
      groupId: cls.groupId,
      templateId: Math.random() < 0.6 ? pick(templates) : undefined,
      trainerId: cls.trainer.authUid,
      title: `${cls.branch} Ödevi ${ai}`,
      description: `${cls.branch} dersi kapsamında ${ai}. ödev — teslim tarihine dikkat edin.`,
      dueDate: dueDate.toISOString(),
      status: ai === PROFILE.assignmentsPerClass ? "published" : pick(["published", "published", "closed"]),
      maxPuan: pick([100, 100, 100, 200]),
      kind: "normal",
      attachments: [],
      createdAt: nowIso(), createdBy: "seed:loadtest",
    });
    assignmentCount++;
    classAssignmentIds.push(aid);
  }
  assignmentsByClass.set(cls.groupId, classAssignmentIds);
}
console.log(`✓ Ödev: ${assignmentCount}`);

// ═══════════════════════════════════════════════════════════════════
// 5b) Teslimler (flexos_submissions) — SADECE `submissionsAssignmentsPerClass`/
// `submissionsStudentsPerAssignment` tanımlıysa (ör. "system" profili). Amaç: k6'nın
// "ödev değerlendir" (grade) senaryosunun hedef alacağı, henüz notlanmamış
// ("submitted") gerçek teslim kayıtları — bunlar olmadan `PATCH .../grade` hiçbir
// şeye yazamaz. `submissionDocId` formülü (`submission-helpers.ts`) ile BİREBİR aynı:
// `${tenantId}_${assignmentId}_${personId}`.
// ═══════════════════════════════════════════════════════════════════
let submissionCount = 0;
if (PROFILE.submissionsAssignmentsPerClass && PROFILE.submissionsStudentsPerAssignment) {
  for (const cls of classList) {
    const targetAssignments = (assignmentsByClass.get(cls.groupId) ?? []).slice(0, PROFILE.submissionsAssignmentsPerClass);
    const targetStudents = cls.students.slice(0, PROFILE.submissionsStudentsPerAssignment);
    for (const aid of targetAssignments) {
      for (const student of targetStudents) {
        const sid = `${TENANT_ID}_${aid}_${student.personId}`;
        const submittedAt = pastIso(10);
        w(db.collection("flexos_submissions").doc(sid), {
          id: sid, tenantId: TENANT_ID,
          assignmentId: aid, groupId: cls.groupId, personId: student.personId,
          status: "submitted", iteration: 1, isLate: false,
          submittedAt, lastSubmittedAt: submittedAt,
          createdAt: submittedAt, createdBy: student.authUid,
        });
        submissionCount++;
      }
    }
  }
}
console.log(`✓ Teslim (ödev değerlendirme hedefi): ${submissionCount}`);

// ═══════════════════════════════════════════════════════════════════
// 6) Yoklama (flexos_attendance) — sınıf başına N oturum, id=`${groupId}_${date}`
// ═══════════════════════════════════════════════════════════════════
let attendanceCount = 0;
for (const cls of classList) {
  const d = new Date();
  d.setDate(d.getDate() - PROFILE.sessionsPerClass * 3); // geriye doğru başla
  for (let s = 0; s < PROFILE.sessionsPerClass; s++) {
    d.setDate(d.getDate() + 3); // ~3 günde bir ders (haftada 2 gibi)
    const date = d.toISOString().slice(0, 10);
    const id = `${cls.groupId}_${date}`;
    const entries = {};
    for (const student of cls.students) {
      const attended = Math.random() < 0.88; // %12 devamsız — gerçekçi dağılım
      entries[student.personId] = { hours: attended ? 3 : 0, online: Math.random() < 0.1 };
    }
    w(db.collection("flexos_attendance").doc(id), {
      id, tenantId: TENANT_ID,
      groupId: cls.groupId, date, month: date.slice(0, 7),
      trainerId: cls.trainer.trainerId, sessionHours: 3,
      entries,
      attendanceClosed: true, closedAt: `${date}T22:30:00.000Z`, lessonStartedAt: `${date}T19:00:00.000Z`,
      createdAt: nowIso(), createdBy: "seed:loadtest",
    });
    attendanceCount++;
  }
}
console.log(`✓ Yoklama kaydı: ${attendanceCount}`);

// ═══════════════════════════════════════════════════════════════════
// 7) Flex Connect — sınıf grup sohbetleri + öğrenci-eğitmen DM'leri + personel kanalı
// ═══════════════════════════════════════════════════════════════════
/** Konuşma + mesajlar + üyeler tek seferde üretir. `kind` alanı (2026-08-04
 * rol-bazlı okundu-tiki güvenliği) her üyeye DOĞRU set edilir — gerçek
 * `firestore.rules::isConnectStaffMember` kısıtlaması bu veriyle de çalışır. */
function seedConversation({ id, realm, type, name, members, messageTarget, sourceGroupId }) {
  const convRef = db.collection("connect_conversations").doc(id);
  const now = nowIso();
  const memberDocs = members.map((m) => ({
    uid: m.uid, realm, role: m.role, kind: m.kind,
    lastReadAt: pastIso(3), lastDeliveredAt: pastIso(3),
    joinedAt: pastIso(60),
  }));

  const messageCount = randInt(Math.max(1, Math.floor(messageTarget * 0.6)), messageTarget);
  let lastMessage = null;
  const timestamps = Array.from({ length: messageCount }, () => pastIso(45)).sort();
  for (let i = 0; i < messageCount; i++) {
    const author = pick(members);
    const text = pick(MESSAGE_SNIPPETS);
    const msgId = `msg-${pad(i, 4)}`;
    const createdAt = timestamps[i];
    w(convRef.collection("messages").doc(msgId), {
      id: msgId, authorUid: author.uid, text, createdAt,
    });
    lastMessage = { messageId: msgId, text, senderUid: author.uid, at: createdAt };
  }

  w(convRef, {
    id, tenantId: TENANT_ID, realm, type, name,
    writePolicy: "members",
    admins: [members[0].uid],
    lastMessage,
    messageCount,
    ownerUid: members[0].uid,
    sourceGroupId,
    createdAt: now, createdBy: members[0].uid,
  });

  for (const m of memberDocs) {
    // readMessageCount: %70 tamamen okumuş, %30 birkaç mesaj geride — gerçekçi
    // okunmamış rozeti dağılımı için.
    const readCount = Math.random() < 0.7 ? messageCount : Math.max(0, messageCount - randInt(1, 5));
    w(convRef.collection("members").doc(m.uid), { ...m, readMessageCount: readCount });
  }

  return messageCount;
}

let totalMessages = 0;
let convCount = 0;

// 7a) Sınıf grup sohbetleri
for (const cls of classList) {
  const gid = groupId(classList.indexOf(cls) + 1);
  const members = [
    { uid: cls.trainer.authUid, role: "owner", kind: "staff" },
    ...cls.students.map((s) => ({ uid: s.authUid, role: "member", kind: "student" })),
  ];
  totalMessages += seedConversation({
    id: `seed-conv-class-${gid}`, realm: "trainer_student", type: "group",
    name: `${cls.code} — ${cls.branch} Sınıf Odası`,
    members, messageTarget: randInt(20, 80), sourceGroupId: gid,
  });
  convCount++;
}

// 7b) Öğrenci ↔ kendi eğitmeni DM'leri (her öğrenci için bir tane)
// `dmMessageRange` profil override'ı (ör. "system" — toplam mesaj sayısını
// 2000-5000 aralığında tutmak için diğer profillerden daha dar bir aralık).
const [DM_MIN, DM_MAX] = PROFILE.dmMessageRange ?? [2, 14];
for (const cls of classList) {
  for (const student of cls.students) {
    totalMessages += seedConversation({
      id: `seed-conv-dm-${student.personId}`, realm: "trainer_student", type: "dm",
      name: "", members: [
        { uid: cls.trainer.authUid, role: "owner", kind: "staff" },
        { uid: student.authUid, role: "member", kind: "student" },
      ],
      messageTarget: randInt(DM_MIN, DM_MAX),
    });
    convCount++;
  }
}

// 7c) Personel kanalları (staff realm — sadece personel, tamamı "kind:staff")
for (let i = 1; i <= PROFILE.staffChannels; i++) {
  const members = pickN(staffList, Math.min(staffList.length, randInt(10, staffList.length)))
    .map((s) => ({ uid: s.authUid, role: "member", kind: "staff" }));
  if (members.length === 0) continue;
  totalMessages += seedConversation({
    id: `seed-conv-staffchannel-${i}`, realm: "staff", type: "channel",
    name: i === 1 ? "Şirket Duyuruları" : `Personel Kanalı ${i}`,
    members, messageTarget: randInt(80, 250),
  });
  convCount++;
}
console.log(`✓ Connect konuşma: ${convCount} | mesaj: ~${totalMessages}`);

// ═══════════════════════════════════════════════════════════════════
// 8) Bildirimler (users/{uid}/notifications)
// ═══════════════════════════════════════════════════════════════════
let notifCount = 0;
const allPeople = [
  ...staffList.map((s) => ({ uid: s.authUid, senderPool: studentList })),
  ...studentList.map((s) => ({ uid: s.authUid, senderPool: staffList })),
];
for (const person of allPeople) {
  for (let n = 0; n < PROFILE.notifPerPerson; n++) {
    const template = pick(NOTIF_TITLES);
    const sender = pick(person.senderPool);
    const senderUid = sender.authUid;
    const id = `seed-notif-${person.uid}-${pad(n, 2)}`;
    w(db.collection("users").doc(person.uid).collection("notifications").doc(id), {
      type: template.type, entityId: `seed-entity-${pad(n, 3)}`,
      senderId: senderUid, title: template.title, preview: template.preview,
      actionUrl: "/flexos",
      createdAt: pastIso(21),
      isRead: Math.random() < 0.7, isArchived: false,
    });
    notifCount++;
  }
}
console.log(`✓ Bildirim: ${notifCount}`);

// ═══════════════════════════════════════════════════════════════════
await writer.close();
console.log(`\n=== ${DRY_RUN ? "DRY RUN tamam — hiçbir şey yazılmadı" : "Yazım tamamlandı"} (${writeCount} doküman) ===`);
console.log(`Konsol: https://console.firebase.google.com/project/${serviceAccount.project_id}/firestore/databases/-default-/data`);
