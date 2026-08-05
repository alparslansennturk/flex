/**
 * full-system.js — FlexOS "Connect hariç tam sistem" k6 yük testi (2026-08-05).
 *
 * Kullanıcı isteği: Connect (mesajlaşma) zaten ayrı test edildi (`loadtest.js`) —
 * bu script gerçek kullanım akışını temsil eden ÖNEMLİ döngüyü hedefler: satış →
 * eğitim operasyon → eğitmen → yoklama/ödev, + admin/koordinatör dashboard'ları.
 *
 * Orta ölçekli, maliyet-kontrollü tasarım: her persona kendi "oturumu" içinde
 * birden fazla gerçekçi eylemi ART ARDA yapar (gerçek bir kullanıcı sayfayı açtığında
 * birkaç API'yi aynı anda tetikler) — ama HER endpoint kendi Trend metriğiyle AYRI
 * raporlanır (modül bazlı rapor için).
 *
 * ÖN KOŞUL:
 *   npm run seed -- --profile=system --clean   (bkz. LOAD_TEST.md)
 *   node scripts/k6/generate-tokens-system.mjs
 *
 * Kullanım:
 *   k6 run scripts/k6/full-system.js
 *   k6 run -e VUS=50 -e DURATION=2m scripts/k6/full-system.js
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { SharedArray } from "k6/data";
import { Rate, Trend } from "k6/metrics";
import exec from "k6/execution";

const VUS = parseInt(__ENV.VUS || "30", 10);
const DURATION = __ENV.DURATION || "90s";

const tokens = new SharedArray("tokens", function () {
  return [JSON.parse(open("./.tokens-system.json"))];
})[0];

const BASE_URL = __ENV.BASE_URL || tokens.baseUrl || "https://flexos-loadtest.vercel.app";
const BYPASS_SECRET = __ENV.VERCEL_AUTOMATION_BYPASS_SECRET || tokens.protectionBypass || "";

const WARMUP_MS = 30_000;
function currentStage() {
  return exec.instance.currentTestRunDuration < WARMUP_MS ? "warmup" : "steady";
}

function pick(arr, i) {
  return arr[i % arr.length];
}

function req(method, path, idToken, body, endpointTag, stage) {
  const params = {
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
      "x-vercel-protection-bypass": BYPASS_SECRET,
    },
    tags: { stage, endpoint: endpointTag },
  };
  const res = method === "GET"
    ? http.get(`${BASE_URL}${path}`, params)
    : method === "POST"
      ? http.post(`${BASE_URL}${path}`, JSON.stringify(body ?? {}), params)
      : http.patch(`${BASE_URL}${path}`, JSON.stringify(body ?? {}), params);
  return res;
}

// ─── Modül bazlı metrikler ───────────────────────────────────────────────────
const errorRate = new Rate("flexos_errors");
const M = {
  meDuration: new Trend("m_me"),
  studentAssignmentsDuration: new Trend("m_student_assignments"),
  studentActivityDuration: new Trend("m_student_activity"),
  trainerAttendanceReadDuration: new Trend("m_trainer_attendance_read"),
  trainerGradeDuration: new Trend("m_trainer_grade"),
  trainerPersonInfoDuration: new Trend("m_trainer_person_info"),
  opsGroupsDuration: new Trend("m_ops_groups"),
  opsAttendanceReportDuration: new Trend("m_ops_attendance_report"),
  opsActivitiesDuration: new Trend("m_ops_activities"),
  studentAffairsPersonsDuration: new Trend("m_student_affairs_persons"),
  studentAffairsPersonDetailDuration: new Trend("m_student_affairs_person_detail"),
  salesListDuration: new Trend("m_sales_list"),
  salesCreateDuration: new Trend("m_sales_create"),
  adminActivitiesDuration: new Trend("m_admin_activities"),
  adminSalesDuration: new Trend("m_admin_sales"),
  adminGroupsDuration: new Trend("m_admin_groups"),
};

function record(trend, res, checkName, stage) {
  trend.add(res.timings.duration, { stage });
  const ok = check(res, { [checkName]: (r) => r.status >= 200 && r.status < 300 });
  errorRate.add(!ok, { stage, endpoint: checkName });
  return ok;
}

export const options = {
  scenarios: {
    // 500 öğrenci ölçeği — en yüksek ağırlık.
    student: {
      executor: "ramping-vus", exec: "student", startVUs: 0,
      stages: [{ duration: "20s", target: Math.round(VUS * 0.5) }, { duration: DURATION, target: Math.round(VUS * 0.5) }, { duration: "20s", target: 0 }],
    },
    trainer: {
      executor: "ramping-vus", exec: "trainer", startVUs: 0,
      stages: [{ duration: "20s", target: Math.round(VUS * 0.24) }, { duration: DURATION, target: Math.round(VUS * 0.24) }, { duration: "20s", target: 0 }],
    },
    egitim_koordinatoru: {
      executor: "ramping-vus", exec: "egitimKoordinatoru", startVUs: 0,
      stages: [{ duration: "20s", target: Math.max(1, Math.round(VUS * 0.08)) }, { duration: DURATION, target: Math.max(1, Math.round(VUS * 0.08)) }, { duration: "20s", target: 0 }],
    },
    ogrenci_isleri: {
      executor: "ramping-vus", exec: "ogrenciIsleri", startVUs: 0,
      stages: [{ duration: "20s", target: Math.max(1, Math.round(VUS * 0.08)) }, { duration: DURATION, target: Math.max(1, Math.round(VUS * 0.08)) }, { duration: "20s", target: 0 }],
    },
    satis_temsilcisi: {
      executor: "ramping-vus", exec: "satisTemsilcisi", startVUs: 0,
      stages: [{ duration: "20s", target: Math.max(1, Math.round(VUS * 0.06)) }, { duration: DURATION, target: Math.max(1, Math.round(VUS * 0.06)) }, { duration: "20s", target: 0 }],
    },
    genel_mudur: {
      executor: "ramping-vus", exec: "genelMudur", startVUs: 0,
      stages: [{ duration: "20s", target: Math.max(1, Math.round(VUS * 0.06)) }, { duration: DURATION, target: Math.max(1, Math.round(VUS * 0.06)) }, { duration: "20s", target: 0 }],
    },
  },
  thresholds: {
    "http_req_failed{stage:steady}": ["rate<0.02"],
    "http_req_duration{stage:steady}": ["p(95)<1500", "p(99)<3000"],
    "flexos_errors{stage:steady}": ["rate<0.02"],
  },
};

// ─── Öğrenci: giriş + ödevlerini/derslerini görüntüle ───────────────────────
export function student() {
  const stage = currentStage();
  const s = pick(tokens.students, __ITER + __VU);

  let res = req("GET", "/api/flexos/me", s.idToken, null, "me", stage);
  record(M.meDuration, res, "me: 2xx", stage);

  res = req("GET", `/api/flexos/student/assignments?personId=${s.personId}`, s.idToken, null, "student_assignments", stage);
  record(M.studentAssignmentsDuration, res, "student_assignments: 2xx", stage);

  res = req("GET", `/api/flexos/student/activity?personId=${s.personId}`, s.idToken, null, "student_activity", stage);
  record(M.studentActivityDuration, res, "student_activity: 2xx", stage);

  sleep(2 + Math.random() * 3);
}

// ─── Eğitmen: yoklama al + (dönüşümlü) ödev değerlendir / öğrenci bilgisi aç ──
export function trainer() {
  const stage = currentStage();
  const t = pick(tokens.trainers, __ITER + __VU);
  const month = new Date().toISOString().slice(0, 7);

  let res = req("GET", `/api/flexos/attendance?groupId=${t.groupId}&month=${month}`, t.idToken, null, "trainer_attendance_read", stage);
  record(M.trainerAttendanceReadDuration, res, "trainer_attendance_read: 2xx", stage);

  const roll = Math.random();
  if (roll < 0.4 && t.submissionIds.length > 0) {
    const submissionId = pick(t.submissionIds, __ITER + __VU);
    res = req("PATCH", `/api/flexos/submissions/${submissionId}/grade`, t.idToken, { grade: randGrade() }, "trainer_grade", stage);
    record(M.trainerGradeDuration, res, "trainer_grade: 2xx", stage);
  } else if (t.studentPersonId) {
    res = req("GET", `/api/flexos/persons/${t.studentPersonId}`, t.idToken, null, "trainer_person_info", stage);
    record(M.trainerPersonInfoDuration, res, "trainer_person_info: 2xx", stage);
  }

  sleep(3 + Math.random() * 4);
}
function randGrade() {
  return Math.floor(50 + Math.random() * 50);
}

// ─── Eğitim Koordinatörü: sınıf listesi + yoklama raporu + aktivite akışı ────
export function egitimKoordinatoru() {
  const stage = currentStage();
  const u = pick(tokens.egitimKoordinatoru, __ITER + __VU);

  let res = req("GET", "/api/flexos/groups", u.idToken, null, "ops_groups", stage);
  record(M.opsGroupsDuration, res, "ops_groups: 2xx", stage);

  // Gerçek frontend (yoklama/rapor/page.tsx) HER ZAMAN from/to gönderir, hiçbir zaman
  // filtresiz çağırmaz — 2026-08-05 optimizasyonunun hedeflediği yol budur (bkz.
  // LOAD_TEST.md). Son 30 gün, gerçekçi bir "aylık rapor" aralığı.
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  res = req("GET", `/api/flexos/attendance/report?from=${from}&to=${to}`, u.idToken, null, "ops_attendance_report", stage);
  record(M.opsAttendanceReportDuration, res, "ops_attendance_report: 2xx", stage);

  res = req("GET", "/api/flexos/activities", u.idToken, null, "ops_activities", stage);
  record(M.opsActivitiesDuration, res, "ops_activities: 2xx", stage);

  sleep(3 + Math.random() * 4);
}

// ─── Öğrenci İşleri: öğrenci listesi (EN AĞIR uç) + zaman zaman detay ───────
export function ogrenciIsleri() {
  const stage = currentStage();
  const u = pick(tokens.ogrenciIsleri, __ITER + __VU);

  let res = req("GET", "/api/flexos/persons", u.idToken, null, "student_affairs_persons", stage);
  record(M.studentAffairsPersonsDuration, res, "student_affairs_persons: 2xx", stage);

  if (Math.random() < 0.5) {
    const s = pick(tokens.students, __ITER + __VU);
    res = req("GET", `/api/flexos/persons/${s.personId}`, u.idToken, null, "student_affairs_person_detail", stage);
    record(M.studentAffairsPersonDetailDuration, res, "student_affairs_person_detail: 2xx", stage);
  }

  sleep(3 + Math.random() * 4);
}

// ─── Satış Temsilcisi: satış listesi + (düşük olasılık) yeni kayıt oluştur ──
export function satisTemsilcisi() {
  const stage = currentStage();
  const u = pick(tokens.satisTemsilcisi, __ITER + __VU);

  let res = req("GET", "/api/flexos/sales", u.idToken, null, "sales_list", stage);
  record(M.salesListDuration, res, "sales_list: 2xx", stage);

  // Düşük olasılık — gerçek veri büyümesi (yeni person+sale+enrollment) yaratan
  // TEK yazma senaryosu, bilerek seyrek (maliyet + veri şişmesi kontrolü).
  if (Math.random() < 0.15) {
    const n = __ITER + __VU;
    res = req("POST", "/api/flexos/sales", u.idToken, {
      firstName: "K6", lastName: `TestOgrenci${n}`,
      educationId: "seed-loadtest-fake-education",
      soldPrice: 1000,
    }, "sales_create", stage);
    record(M.salesCreateDuration, res, "sales_create: 2xx", stage);
  }

  sleep(3 + Math.random() * 4);
}

// ─── Genel Müdür: admin dashboard (aktivite + satış + sınıf özet) ───────────
export function genelMudur() {
  const stage = currentStage();
  const u = pick(tokens.genelMudur, __ITER + __VU);

  let res = req("GET", "/api/flexos/activities", u.idToken, null, "admin_activities", stage);
  record(M.adminActivitiesDuration, res, "admin_activities: 2xx", stage);

  res = req("GET", "/api/flexos/sales", u.idToken, null, "admin_sales", stage);
  record(M.adminSalesDuration, res, "admin_sales: 2xx", stage);

  res = req("GET", "/api/flexos/groups", u.idToken, null, "admin_groups", stage);
  record(M.adminGroupsDuration, res, "admin_groups: 2xx", stage);

  sleep(3 + Math.random() * 4);
}
