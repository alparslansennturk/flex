/**
 * loadtest.js — FlexOS k6 yük testi.
 *
 * Hedef: `flexos-loadtest` Vercel deployment'ı (ayrı staging Firebase projesine
 * bağlı, prod'a hiç dokunmuyor). Gerçek soruya cevap arıyoruz: "30-40 personel +
 * 500 öğrenci gerçek kullanmaya başlarsa sistem kararlı çalışır mı?"
 *
 * ÖN KOŞUL: `node scripts/k6/generate-tokens.mjs` ÖNCE çalıştırılmış olmalı
 * (scripts/k6/.tokens.json üretir, idToken'lar 1 saat geçerli).
 *
 * 4 senaryo, gerçek kullanım oranlarına yakın ağırlıklarla:
 *   - login              GET  /api/flexos/me                                  (%20)
 *   - attendance_read     GET  /api/flexos/attendance?groupId=&month=          (%30)
 *   - send_message         POST /api/flexos/connect/conversations/:id/messages   (%30)
 *   - assignments_list    GET  /api/flexos/student/assignments?personId=       (%15)
 *   - attendance_write     PATCH /api/flexos/attendance/:id                     (%5, admin/org-scope)
 *
 * Kullanım:
 *   k6 run scripts/k6/loadtest.js
 *   k6 run -e VUS=50 -e DURATION=3m scripts/k6/loadtest.js
 *   k6 run -e BASE_URL=https://flexos-loadtest.vercel.app scripts/k6/loadtest.js
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { SharedArray } from "k6/data";
import { Rate, Trend } from "k6/metrics";
import exec from "k6/execution";

// Varsayılan hafif tutuldu (Vercel Hobby plan, fair-use sınırı — bkz. LOAD_TEST.md).
// Daha ağır bir koşum istenirse: k6 run -e VUS=60 -e DURATION=3m scripts/k6/loadtest.js
const VUS = Number.parseInt(__ENV.VUS || "20", 10);
const DURATION = __ENV.DURATION || "1m";

const tokens = new SharedArray("tokens", function () {
  return [JSON.parse(open("./.tokens.json"))];
})[0];

const BASE_URL = __ENV.BASE_URL || tokens.baseUrl || "https://flexos-loadtest.vercel.app";
// Vercel Deployment Protection (SSO) bypass — flexos-loadtest projesi korumalı,
// bu header olmadan her istek 302'ye düşer (bkz. LOAD_TEST.md).
const BYPASS_SECRET = __ENV.VERCEL_AUTOMATION_BYPASS_SECRET || tokens.protectionBypass || "";

const errorRate = new Rate("flexos_errors");
const loginDuration = new Trend("flexos_login_duration");
const messageDuration = new Trend("flexos_message_duration");
const attendanceReadDuration = new Trend("flexos_attendance_read_duration");
const attendanceWriteDuration = new Trend("flexos_attendance_write_duration");
const assignmentsDuration = new Trend("flexos_assignments_duration");

function pick(arr, i) {
  return arr[i % arr.length];
}

// İlk 30sn "warm-up" — cold start + ramp-up gürültüsü. Metrik/threshold'lar
// SADECE `stage:steady` etiketiyle raporlanır (kullanıcı isteği, 2026-08-05).
const WARMUP_MS = 30_000;
function currentStage() {
  return exec.instance.currentTestRunDuration < WARMUP_MS ? "warmup" : "steady";
}

function authHeaders(idToken, stage) {
  return {
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
      "x-vercel-protection-bypass": BYPASS_SECRET,
    },
    tags: { stage },
  };
}

export const options = {
  scenarios: {
    login: {
      executor: "ramping-vus",
      exec: "login",
      startVUs: 0,
      stages: [
        { duration: "30s", target: Math.round(VUS * 0.2) },
        { duration: DURATION, target: Math.round(VUS * 0.2) },
        { duration: "30s", target: 0 },
      ],
    },
    attendance_read: {
      executor: "ramping-vus",
      exec: "attendanceRead",
      startVUs: 0,
      stages: [
        { duration: "30s", target: Math.round(VUS * 0.3) },
        { duration: DURATION, target: Math.round(VUS * 0.3) },
        { duration: "30s", target: 0 },
      ],
    },
    send_message: {
      executor: "ramping-vus",
      exec: "sendMessage",
      startVUs: 0,
      stages: [
        { duration: "30s", target: Math.round(VUS * 0.3) },
        { duration: DURATION, target: Math.round(VUS * 0.3) },
        { duration: "30s", target: 0 },
      ],
    },
    assignments_list: {
      executor: "ramping-vus",
      exec: "assignmentsList",
      startVUs: 0,
      stages: [
        { duration: "30s", target: Math.round(VUS * 0.15) },
        { duration: DURATION, target: Math.round(VUS * 0.15) },
        { duration: "30s", target: 0 },
      ],
    },
    attendance_write: {
      executor: "ramping-vus",
      exec: "attendanceWrite",
      startVUs: 0,
      stages: [
        { duration: "30s", target: Math.max(1, Math.round(VUS * 0.05)) },
        { duration: DURATION, target: Math.max(1, Math.round(VUS * 0.05)) },
        { duration: "30s", target: 0 },
      ],
    },
  },
  thresholds: {
    // Sadece warm-up sonrası (steady) dönem değerlendirilir — bkz. WARMUP_MS.
    "http_req_failed{stage:steady}": ["rate<0.01"],
    "http_req_duration{stage:steady}": ["p(95)<800", "p(99)<2000"],
    "flexos_errors{stage:steady}": ["rate<0.01"],
  },
};

// ─── login: eğitmen+öğrenci karışık, /api/flexos/me ─────────────────────────
export function login() {
  const stage = currentStage();
  const pool = __VU % 2 === 0 ? tokens.trainers : tokens.students;
  const user = pick(pool, __ITER + __VU);
  const res = http.get(`${BASE_URL}/api/flexos/me`, authHeaders(user.idToken, stage));
  loginDuration.add(res.timings.duration, { stage });
  const ok = check(res, { "login: 200": (r) => r.status === 200 });
  errorRate.add(!ok, { stage });
  sleep(1 + Math.random() * 2);
}

// ─── attendance_read: eğitmen kendi sınıfının yoklama takvimine bakıyor ─────
export function attendanceRead() {
  const stage = currentStage();
  const trainer = pick(tokens.trainers, __ITER + __VU);
  const month = new Date().toISOString().slice(0, 7);
  const res = http.get(
    `${BASE_URL}/api/flexos/attendance?groupId=${trainer.groupId}&month=${month}`,
    authHeaders(trainer.idToken, stage),
  );
  attendanceReadDuration.add(res.timings.duration, { stage });
  const ok = check(res, { "attendance read: 200": (r) => r.status === 200 });
  errorRate.add(!ok, { stage });
  sleep(1 + Math.random() * 3);
}

// ─── send_message: eğitmen kendi sınıf odasına mesaj atıyor ─────────────────
const MESSAGES = [
  "Yarınki ders saat 19:00'da başlıyor.",
  "Ödevleri unutmayın lütfen.",
  "Materyalleri paylaşıyorum, kontrol edin.",
  "Herkese iyi çalışmalar.",
  "Soru olan yazabilir.",
];
export function sendMessage() {
  const stage = currentStage();
  const trainer = pick(tokens.trainers, __ITER + __VU);
  const text = pick(MESSAGES, __ITER + __VU);
  const res = http.post(
    `${BASE_URL}/api/flexos/connect/conversations/${trainer.conversationId}/messages`,
    JSON.stringify({ text }),
    authHeaders(trainer.idToken, stage),
  );
  messageDuration.add(res.timings.duration, { stage });
  const ok = check(res, { "send message: 201": (r) => r.status === 201 });
  errorRate.add(!ok, { stage });
  sleep(2 + Math.random() * 4);
}

// ─── assignments_list: öğrenci kendi ödev listesine bakıyor ─────────────────
export function assignmentsList() {
  const stage = currentStage();
  const student = pick(tokens.students, __ITER + __VU);
  const res = http.get(
    `${BASE_URL}/api/flexos/student/assignments?personId=${student.personId}`,
    authHeaders(student.idToken, stage),
  );
  assignmentsDuration.add(res.timings.duration, { stage });
  const ok = check(res, { "assignments: 200": (r) => r.status === 200 });
  errorRate.add(!ok, { stage });
  sleep(1 + Math.random() * 2);
}

// ─── attendance_write: admin (org-scope) mevcut kapalı bir kaydı düzenliyor ──
export function attendanceWrite() {
  const stage = currentStage();
  const target = pick(tokens.attendanceTargets, __ITER + __VU);
  const id = `${target.groupId}_${target.date}`;
  const body = {
    groupId: target.groupId,
    date: target.date,
    entries: { "loadtest-dummy-person": { hours: 3, online: false } },
    close: true,
  };
  const res = http.patch(
    `${BASE_URL}/api/flexos/attendance/${id}`,
    JSON.stringify(body),
    authHeaders(tokens.admin.idToken, stage),
  );
  attendanceWriteDuration.add(res.timings.duration, { stage });
  const ok = check(res, { "attendance write: 200": (r) => r.status === 200 });
  errorRate.add(!ok, { stage });
  sleep(3 + Math.random() * 4);
}
