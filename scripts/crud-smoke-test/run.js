/**
 * FlexOS — modül-bazlı CRUD duman testi. Gerçek API rotalarına (localhost:3000)
 * gerçek admin ID token'ıyla yazar; TÜM test verisi TEST_<timestamp> önekiyle
 * işaretlenir. `cleanup.js` bu script'in ürettiği manifest.json'u okuyup her şeyi
 * (Firestore doküman + Firebase Auth hesabı) admin SDK ile kesin siler.
 *
 * Kullanım (repo kökünden, dev server ayrı bir terminalde `npm run dev` ile açıkken):
 *   CRUD_TEST_EMAIL=... CRUD_TEST_PASS=... node scripts/crud-smoke-test/run.js
 *   node scripts/crud-smoke-test/cleanup.js
 *
 * 2026-07-28'de yazıldı — GRP-784 gerçek grubunu düzenlerken çıkan sahte "eğitmen
 * müsait değil" uyarısının (bkz. FLEXOS.md ilgili oturum notu) ardından kullanıcı
 * "her modül için gerçek CRUD testi yap" dedi. İlk koşuda 25/25, küçük bir düzeltmeyle
 * (Kullanıcılar formunda `subes` zorunluymuş) 26/26 — bkz. FLEXOS.md 2026-07-28 notu.
 */
"use strict";

const fs = require("fs");
const path = require("path");

function loadEnvLocal(p) {
  const txt = fs.readFileSync(p, "utf8");
  for (const line of txt.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnvLocal(path.resolve(__dirname, "../../.env.local"));

const BASE = process.env.CRUD_TEST_BASE_URL || "http://localhost:3000";
const TS = Date.now();
const TEST_TAG = `TEST_${TS}`;
const TEST_EMAIL_TRAINER = `flexos.crud.test.trainer.${TS}@example.com`;
const TEST_EMAIL_USER = `flexos.crud.test.user.${TS}@example.com`;

const results = []; // {module, op, ok, detail}
const manifest = {}; // izlenen kayıtlar — cleanup.js için

function log(module, op, ok, detail) {
  results.push({ module, op, ok, detail: detail || "" });
  // 2026-08-05 Sonar bulgusu (S5145): API yanıtından gelen `detail` JSON.stringify
  // ile basılıyor — satır sonu/kontrol karakteri enjekte edip sahte log satırı
  // oluşturmayı (log forging) engeller. Gerçek risk yok (yerel test scripti,
  // kendi dev sunucumuza konuşuyor) ama bedeli yok.
  console.log(`${ok ? "✅" : "❌"} [${module}] ${op}${detail ? " — " + JSON.stringify(detail) : ""}`);
}

let idToken = null;
async function api(method, urlPath, body) {
  // 2026-08-05/06 Sonar bulgusu (S8476/S7044): `urlPath` bu dosyanın KENDİ sabit
  // string çağrılarından geliyor (dışarıdan asla alınmıyor) ama statik analiz
  // "tainted" sayıyor. `.startsWith()` string kontrolü Sonar'ın taint-tracker'ı
  // tarafından sanitizer olarak tanınmadığından, `new URL()` ile parse edip
  // origin + pathname'i açıkça doğruluyoruz — hedef URL string birleştirme
  // yerine URL nesnesi olarak fetch'e veriliyor.
  const target = new URL(urlPath, BASE);
  if (target.origin !== new URL(BASE).origin || !target.pathname.startsWith("/api/")) {
    throw new Error(`Geçersiz urlPath: ${JSON.stringify(urlPath)}`);
  }
  const res = await fetch(target, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* boş gövde olabilir */ }
  return { ok: res.ok, status: res.status, json };
}

async function signIn(email, password) {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, returnSecureToken: true }) },
  );
  const json = await res.json();
  if (!res.ok) throw new Error("Giriş başarısız: " + JSON.stringify(json));
  return json.idToken;
}

async function main() {
  if (!process.env.CRUD_TEST_EMAIL || !process.env.CRUD_TEST_PASS) {
    throw new Error("CRUD_TEST_EMAIL / CRUD_TEST_PASS env değişkenleri gerekli (gerçek admin hesabı — org-scope yetki lazım).");
  }

  console.log(`\n=== FlexOS CRUD Testi — etiket: ${TEST_TAG} ===\n`);
  idToken = await signIn(process.env.CRUD_TEST_EMAIL, process.env.CRUD_TEST_PASS);
  console.log("Giriş yapıldı, ID token alındı.\n");

  // ---- Referans katalog: canlıdan GERÇEK bir grup örnek alınıp şube/eğitim/bölüm ID'leri türetilir.
  // Varsayılan GRP-784 — yoksa/silinmişse ilk bulunan gerçek grup kullanılır.
  const groupsRes = await api("GET", "/api/flexos/groups");
  const refCode = process.env.CRUD_TEST_REF_GROUP_CODE || "GRP-784";
  const refGroup = groupsRes.json.items.find((g) => g.code === refCode) || groupsRes.json.items[0];
  if (!refGroup) throw new Error("Referans katalog ID'leri için gerçek bir grup bulunamadı.");
  const REF = { branchOfficeId: refGroup.branchOfficeId, educationId: refGroup.educationId, sectionId: refGroup.sectionId };
  console.log(`Referans grup: ${JSON.stringify(refGroup.code)}`, REF, "\n");

  const roleDefsRes = await api("GET", "/api/flexos/role-defs");
  const nonTrainerRole = (roleDefsRes.json?.items || []).find((r) => r.id !== "egitmen");
  const REF_ROLE_ID = nonTrainerRole ? nonTrainerRole.id : "satis";
  console.log("Kullanıcılar testi için rol:", JSON.stringify(REF_ROLE_ID), "\n");

  // ============================================================
  // 1) EĞİTMENLER
  // ============================================================
  try {
    const r = await api("POST", "/api/flexos/trainers", {
      name: `${TEST_TAG} Eğitmen`, email: TEST_EMAIL_TRAINER, phone: "05000000000",
      branchOffices: [REF.branchOfficeId], status: "aktif",
    });
    if (r.ok) { manifest.trainerId = r.json.id; log("Eğitmenler", "Create", true, `id=${manifest.trainerId}`); }
    else log("Eğitmenler", "Create", false, JSON.stringify(r.json));
  } catch (e) { log("Eğitmenler", "Create", false, e.message); }

  if (manifest.trainerId) {
    try {
      const r = await api("PATCH", `/api/flexos/trainers/${manifest.trainerId}`, { phone: "05001112233" });
      log("Eğitmenler", "Update", r.ok, r.ok ? "telefon güncellendi" : JSON.stringify(r.json));
    } catch (e) { log("Eğitmenler", "Update", false, e.message); }
  }

  // ============================================================
  // 2) GRUPLAR — TEST_ eğitmene atanır, gerçek hiçbir eğitmenin takvimine dokunmaz.
  // ============================================================
  const today = new Date();
  const isoWeekday = (today.getDay() + 6) % 7; // 0=Pazartesi
  try {
    const r = await api("POST", "/api/flexos/groups", {
      code: `TEST_GRP_${TS}`, type: "standart",
      educationId: REF.educationId, sectionId: REF.sectionId, branchOfficeId: REF.branchOfficeId,
      trainerId: manifest.trainerId, capacity: 5, status: "active",
      schedule: { startDate: today.toISOString().slice(0, 10), days: [isoWeekday], sessionHours: 2, startTime: "00:30", endTime: "23:30" },
    });
    if (r.ok) { manifest.groupId = r.json.id; log("Gruplar", "Create", true, `id=${manifest.groupId}`); }
    else log("Gruplar", "Create", false, JSON.stringify(r.json));
  } catch (e) { log("Gruplar", "Create", false, e.message); }

  if (manifest.groupId) {
    try {
      const r = await api("PATCH", `/api/flexos/groups/${manifest.groupId}`, { capacity: 8 });
      log("Gruplar", "Update", r.ok, r.ok ? "kontenjan 5→8" : JSON.stringify(r.json));
    } catch (e) { log("Gruplar", "Update", false, e.message); }
  }

  // ============================================================
  // 3) ÖĞRENCİLER (Satış üzerinden — Person+Sale+Enrollment tek çağrıda)
  // ============================================================
  try {
    const r = await api("POST", "/api/flexos/sales", {
      firstName: TEST_TAG, lastName: "Öğrenci", gender: "unspecified",
      customerType: "individual", type: "new_sale",
      educationId: REF.educationId, branchOfficeId: REF.branchOfficeId, soldPrice: 1000,
    });
    if (r.ok) {
      manifest.saleId = r.json.saleId; manifest.personId = r.json.personId; manifest.enrollmentIds = r.json.enrollmentIds || [];
      log("Öğrenciler/Satış", "Create", true, `saleId=${manifest.saleId} personId=${manifest.personId}`);
    } else log("Öğrenciler/Satış", "Create", false, JSON.stringify(r.json));
  } catch (e) { log("Öğrenciler/Satış", "Create", false, e.message); }

  if (manifest.saleId) {
    try {
      const r = await api("PATCH", `/api/flexos/sales/${manifest.saleId}`, { guardian: { name: `${TEST_TAG} Veli` } });
      log("Öğrenciler/Satış", "Update", r.ok, r.ok ? "veli bilgisi eklendi" : JSON.stringify(r.json));
    } catch (e) { log("Öğrenciler/Satış", "Update", false, e.message); }
  }

  const testEnrollmentId = manifest.enrollmentIds && manifest.enrollmentIds[0];
  manifest.testEnrollmentId = testEnrollmentId;
  if (testEnrollmentId && manifest.groupId) {
    try {
      const r = await api("PATCH", `/api/flexos/enrollments/${testEnrollmentId}`, { groupId: manifest.groupId });
      log("Öğrenciler/Kayıt", "Update (gruba ata)", r.ok, r.ok ? `enrollment→${manifest.groupId}` : JSON.stringify(r.json));
    } catch (e) { log("Öğrenciler/Kayıt", "Update (gruba ata)", false, e.message); }
  }

  // ============================================================
  // 4) ÖDEVLER — Şablon + Ödev + Manuel Not
  // ============================================================
  try {
    const r = await api("POST", "/api/flexos/assignment-templates", { title: `${TEST_TAG} Şablon`, description: "CRUD testi şablonu", kind: "normal", maxPuan: 100 });
    if (r.ok) { manifest.templateId = r.json.id; log("Ödevler/Şablon", "Create", true, `id=${manifest.templateId}`); }
    else log("Ödevler/Şablon", "Create", false, JSON.stringify(r.json));
  } catch (e) { log("Ödevler/Şablon", "Create", false, e.message); }

  if (manifest.templateId) {
    try {
      const r = await api("PATCH", `/api/flexos/assignment-templates/${manifest.templateId}`, { title: `${TEST_TAG} Şablon (güncellendi)` });
      log("Ödevler/Şablon", "Update", r.ok, r.ok ? "başlık güncellendi" : JSON.stringify(r.json));
    } catch (e) { log("Ödevler/Şablon", "Update", false, e.message); }
  }

  if (manifest.groupId) {
    try {
      // status:"draft" BİLİNÇLİ — "published" olsaydı öğrencilere gerçek mail atardı.
      const r = await api("POST", "/api/flexos/assignments", { groupId: manifest.groupId, title: `${TEST_TAG} Ödev`, description: "CRUD testi ödevi", status: "draft", maxPuan: 100, kind: "normal" });
      if (r.ok) { manifest.assignmentId = r.json.id; log("Ödevler", "Create", true, `id=${manifest.assignmentId} (draft, mail yok)`); }
      else log("Ödevler", "Create", false, JSON.stringify(r.json));
    } catch (e) { log("Ödevler", "Create", false, e.message); }
  }

  if (manifest.assignmentId) {
    try {
      const r = await api("PATCH", `/api/flexos/assignments/${manifest.assignmentId}`, { title: `${TEST_TAG} Ödev (güncellendi)` });
      log("Ödevler", "Update", r.ok, r.ok ? "başlık güncellendi" : JSON.stringify(r.json));
    } catch (e) { log("Ödevler", "Update", false, e.message); }
  }

  if (manifest.assignmentId && manifest.groupId && manifest.personId) {
    try {
      const r = await api("POST", "/api/flexos/submissions/manual-grade", { assignmentId: manifest.assignmentId, personId: manifest.personId, groupId: manifest.groupId, isLate: false, grade: 88 });
      if (r.ok) { manifest.submissionId = r.json.id; log("Ödevler/Not", "Create (manuel not)", true, `submissionId=${manifest.submissionId} grade=88`); }
      else log("Ödevler/Not", "Create (manuel not)", false, JSON.stringify(r.json));
    } catch (e) { log("Ödevler/Not", "Create (manuel not)", false, e.message); }
  }

  // ============================================================
  // 5) YOKLAMALAR — Dersi Başlat / Kaydet / İptal
  // ============================================================
  if (manifest.groupId) {
    const dateStr = today.toISOString().slice(0, 10);
    manifest.attendanceDate = dateStr;
    try {
      const r = await api("POST", "/api/flexos/attendance", { groupId: manifest.groupId, date: dateStr });
      if (r.ok) { manifest.attendanceId = r.json.id; log("Yoklamalar", "Create (Dersi Başlat)", true, `id=${manifest.attendanceId}`); }
      else log("Yoklamalar", "Create (Dersi Başlat)", false, JSON.stringify(r.json));
    } catch (e) { log("Yoklamalar", "Create (Dersi Başlat)", false, e.message); }

    if (manifest.attendanceId && manifest.personId) {
      try {
        const r = await api("PATCH", `/api/flexos/attendance/${manifest.attendanceId}`, { groupId: manifest.groupId, date: dateStr, entries: { [manifest.personId]: { hours: 2, online: false } } });
        log("Yoklamalar", "Update (Kaydet)", r.ok, r.ok ? "yoklama kaydedildi (2 saat)" : JSON.stringify(r.json));
      } catch (e) { log("Yoklamalar", "Update (Kaydet)", false, e.message); }
    }

    if (manifest.attendanceId) {
      try {
        const r = await api("DELETE", `/api/flexos/attendance/${manifest.attendanceId}?groupId=${manifest.groupId}&date=${dateStr}`);
        log("Yoklamalar", "Delete (İptal)", r.ok, r.ok ? "yoklama kaydı silindi" : JSON.stringify(r.json));
        if (r.ok) manifest.attendanceId = null;
      } catch (e) { log("Yoklamalar", "Delete (İptal)", false, e.message); }
    }
  }

  // ============================================================
  // 6) SERTİFİKASYON (Grades) — delete endpoint YOK (ürün tasarımı: notlar sıfırlanır, silinmez)
  // ============================================================
  if (manifest.groupId && testEnrollmentId && manifest.personId) {
    try {
      const r = await api("POST", "/api/flexos/grades", { groupId: manifest.groupId, entries: [{ enrollmentId: testEnrollmentId, personId: manifest.personId, projectGrade: 75 }] });
      log("Sertifikasyon", "Create (not gir)", r.ok, r.ok ? "projectGrade=75" : JSON.stringify(r.json));
    } catch (e) { log("Sertifikasyon", "Create (not gir)", false, e.message); }

    try {
      const r = await api("POST", "/api/flexos/grades", { groupId: manifest.groupId, entries: [{ enrollmentId: testEnrollmentId, personId: manifest.personId, projectGrade: 92 }] });
      log("Sertifikasyon", "Update (not güncelle)", r.ok, r.ok ? "projectGrade 75→92" : JSON.stringify(r.json));
    } catch (e) { log("Sertifikasyon", "Update (not güncelle)", false, e.message); }
  }

  // ============================================================
  // 7) AKTİVİTE MERKEZİ (Cases) — delete endpoint YOK. NOT: personData ile prospect bir
  // Person de yaratır — cleanup.js bunu manifest.caseId'den bağımsız ayrıca bulup siler.
  // ============================================================
  try {
    const r = await api("POST", "/api/flexos/cases", { personData: { firstName: TEST_TAG, lastName: "Aday", phone: "05009998877" }, channel: "telefon", type: "satis_oncesi", note: "CRUD testi talebi" });
    if (r.ok) { manifest.caseId = r.json.id; manifest.caseActivityId = r.json.activityId; log("Aktivite Merkezi", "Create", true, `caseId=${manifest.caseId}`); }
    else log("Aktivite Merkezi", "Create", false, JSON.stringify(r.json));
  } catch (e) { log("Aktivite Merkezi", "Create", false, e.message); }

  if (manifest.caseId) {
    try {
      const r = await api("PATCH", `/api/flexos/cases/${manifest.caseId}`, { status: "randevu_olusturuldu" });
      log("Aktivite Merkezi", "Update", r.ok, r.ok ? "durum güncellendi" : JSON.stringify(r.json));
    } catch (e) { log("Aktivite Merkezi", "Update", false, e.message); }
  }

  // ============================================================
  // 8) KULLANICILAR — tam CRUD (gerçek Firebase Auth hesabı dahil)
  // ============================================================
  try {
    const r = await api("POST", "/api/flexos/users", {
      name: TEST_TAG, surname: "Kullanıcı", email: TEST_EMAIL_USER, phone: "05005556677",
      gender: "unspecified", roles: [REF_ROLE_ID], subes: [REF.branchOfficeId], status: "aktif",
    });
    if (r.ok) { manifest.flexosUserId = r.json.id; log("Kullanıcılar", "Create", true, `id=${manifest.flexosUserId}`); }
    else log("Kullanıcılar", "Create", false, JSON.stringify(r.json));
  } catch (e) { log("Kullanıcılar", "Create", false, e.message); }

  if (manifest.flexosUserId) {
    try {
      const r = await api("PATCH", `/api/flexos/users/${manifest.flexosUserId}`, { title: "CRUD Test Görevlisi" });
      log("Kullanıcılar", "Update", r.ok, r.ok ? "unvan eklendi" : JSON.stringify(r.json));
    } catch (e) { log("Kullanıcılar", "Update", false, e.message); }

    try {
      const r = await api("DELETE", `/api/flexos/users/${manifest.flexosUserId}`);
      log("Kullanıcılar", "Delete", r.ok, r.ok ? "Firestore + Auth hesabı silindi" : JSON.stringify(r.json));
      if (r.ok) manifest.flexosUserId = null;
    } catch (e) { log("Kullanıcılar", "Delete", false, e.message); }
  }

  // ============================================================
  // DELETE'ler — sıra önemli: eğitmen silinmeden önce ona atanmış grup silinmeli
  // (deleteTrainer aktif grubu olan eğitmeni reddeder).
  // ============================================================
  if (manifest.assignmentId) {
    try {
      const r = await api("DELETE", `/api/flexos/assignments/${manifest.assignmentId}`);
      log("Ödevler", "Delete", r.ok, r.ok ? "ödev silindi" : JSON.stringify(r.json));
      if (r.ok) manifest.assignmentId = null;
    } catch (e) { log("Ödevler", "Delete", false, e.message); }
  }
  if (manifest.templateId) {
    try {
      const r = await api("DELETE", `/api/flexos/assignment-templates/${manifest.templateId}`);
      log("Ödevler/Şablon", "Delete", r.ok, r.ok ? "şablon silindi" : JSON.stringify(r.json));
      if (r.ok) manifest.templateId = null;
    } catch (e) { log("Ödevler/Şablon", "Delete", false, e.message); }
  }
  if (manifest.groupId) {
    try {
      const r = await api("DELETE", `/api/flexos/groups/${manifest.groupId}`);
      log("Gruplar", "Delete", r.ok, r.ok ? "grup silindi" : JSON.stringify(r.json));
      if (r.ok) manifest.groupId = null;
    } catch (e) { log("Gruplar", "Delete", false, e.message); }
  }
  if (manifest.trainerId) {
    try {
      const r = await api("DELETE", `/api/flexos/trainers/${manifest.trainerId}`);
      log("Eğitmenler", "Delete", r.ok, r.ok ? "eğitmen kaydı silindi" : JSON.stringify(r.json));
      if (r.ok) manifest.trainerId = null;
    } catch (e) { log("Eğitmenler", "Delete", false, e.message); }
  }
  // Enrollment API DELETE'i SOFT'tur (status→cancelled, hard-delete değil) — gerçek hard-delete
  // cleanup.js'de admin SDK ile yapılır. Grup zaten silindiği için burada genelde "zaten
  // gruba bağlı değil" hatası alınır — bu BEKLENEN bir durumdur (grup silme cascade'i zaten
  // enrollment'ı gruptan düşürmüştür), gerçek bir hata değildir.
  if (testEnrollmentId) {
    try {
      const r = await api("DELETE", `/api/flexos/enrollments/${testEnrollmentId}`);
      log("Öğrenciler/Kayıt", "Delete (soft-cancel denemesi)", r.ok, r.ok ? "status→cancelled" : `${JSON.stringify(r.json)} (muhtemelen zaten grup-cascade ile ayrılmış, normal)`);
    } catch (e) { log("Öğrenciler/Kayıt", "Delete (soft-cancel denemesi)", false, e.message); }
  }

  fs.writeFileSync(path.resolve(__dirname, "manifest.json"), JSON.stringify({ TEST_TAG, TEST_EMAIL_TRAINER, TEST_EMAIL_USER, manifest }, null, 2));
  fs.writeFileSync(path.resolve(__dirname, "results.json"), JSON.stringify(results, null, 2));

  console.log("\n=== ÖZET ===");
  const fail = results.filter((r) => !r.ok);
  console.log(`Toplam: ${results.length}, Başarılı: ${results.length - fail.length}, Başarısız: ${fail.length}`);
  if (fail.length) { console.log("\nBaşarısız işlemler:"); fail.forEach((f) => console.log(`  - [${f.module}] ${f.op}: ${f.detail}`)); }
  console.log(`\nŞimdi çalıştır: node scripts/crud-smoke-test/cleanup.js`);
}

main().catch((e) => {
  console.error("FATAL:", e);
  fs.writeFileSync(path.resolve(__dirname, "results.json"), JSON.stringify(results, null, 2));
  fs.writeFileSync(path.resolve(__dirname, "manifest.json"), JSON.stringify({ TEST_TAG, TEST_EMAIL_TRAINER, TEST_EMAIL_USER, manifest }, null, 2));
  process.exit(1);
});
