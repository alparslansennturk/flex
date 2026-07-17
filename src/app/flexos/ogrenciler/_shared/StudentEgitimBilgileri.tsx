"use client";

/**
 * Öğrenci Detay — "Eğitim Bilgileri": course dropdown (birden fazla enrollment varsa) +
 * kurs meta kartı + yoklama donut'u + sertifika kartı. `Öğrenci Bilgi.dc.html` (sayfa) ve
 * `Öğrenci Bilgi Modal.dc.html` (modal, `compact`) BİREBİR portu — TEK bileşen, ikisi de
 * kullanır. Modal tasarımındaki "bir branşta birden fazla sertifika modülü" grid'i
 * BİLİNÇLİ OLARAK sadeleştirildi (2026-07-16 kullanıcı kararı): gerçek veride her modül
 * zaten kendi Enrollment'ı/dropdown seçeneği, tek kart yeterli.
 */

import { useEffect, useState } from "react";
import { ChevronDown, Check, GraduationCap } from "lucide-react";
import type { TrainingSummary } from "@/app/lib/domain/services/person-education-summary-service";
import { fmtDateLong, CERT_STATUS_STYLE, COURSE_STATUS_STYLE, avatarGradient } from "./studentShared";

/** `pct`'e bağlı key ile mount edilir (bkz. kullanım) — her açılışta/eğitim değişiminde
 * 0'dan gerçek değere dolarak animasyonla açılır (kullanıcı isteği). */
/** Dropdown'da eğitim/bölüm etiketi — "Grafik Tasarım Kursu - Grafik-2" (2026-07-16
 * kullanıcı isteği: `-` ayraç, `·` değil). */
function trainingLabel(t: TrainingSummary): string {
  return t.moduleName ? `${t.trainingName} - ${t.moduleName}` : t.trainingName;
}

/** Sertifika notu 3 kademeli renk — 90+ yeşil, 50-89 mavi, <50 kırmızı (2026-07-16
 * kullanıcı isteği, mockup'taki 2 kademeli (yeşil/kırmızı) renklendirme YERİNE). */
function certScoreColor(n: number | null): string {
  if (n == null) return "#AEB4C0";
  if (n >= 90) return "#0A6B3F";
  if (n >= 50) return "#2867BD";
  return "#D93636";
}
function certBarGradient(n: number | null): string {
  if (n == null) return "#CDD2DA";
  if (n >= 90) return "linear-gradient(90deg,#12A56A,#0A6B3F)";
  if (n >= 50) return "linear-gradient(90deg,#4A8FE0,#2867BD)";
  return "linear-gradient(90deg,#E58080,#D93636)";
}

/** Sertifika not çubuğu — donut ile aynı 0→gerçek-değer giriş animasyonu (kullanıcı isteği). */
function CertBar({ pct, gradient }: { pct: number; gradient: string }) {
  const [animPct, setAnimPct] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setAnimPct(pct), 60);
    return () => clearTimeout(t);
  }, [pct]);
  return (
    <div className="h-2 rounded-lg bg-[#EFE6D2] overflow-hidden mt-2">
      <div className="h-full rounded-lg" style={{ width: `${animPct}%`, background: gradient, transition: "width .8s cubic-bezier(.2,.8,.3,1)" }} />
    </div>
  );
}

function Donut({ pct, size, color }: { pct: number; size: number; color: string }) {
  const [animPct, setAnimPct] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setAnimPct(pct), 60);
    return () => clearTimeout(t);
  }, [pct]);

  const strokeWidth = Math.round(size * 0.13); // kullanıcı: "çok az daha kalın"
  const r = size / 2 - strokeWidth / 2 - 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - animPct / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EEF0F3" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="butt"
        strokeDasharray={circ} strokeDashoffset={offset} style={{ transition: "stroke-dashoffset .8s cubic-bezier(.2,.8,.3,1)" }}
      />
    </svg>
  );
}

export function StudentEgitimBilgileri({ trainings, compact = false }: { trainings: TrainingSummary[]; compact?: boolean }) {
  const [selIdx, setSelIdx] = useState(0);
  const [ddOpen, setDdOpen] = useState(false);

  if (trainings.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center rounded-2xl border border-dashed border-[#E2E5EA] bg-[#F7F8FA]">
        <GraduationCap size={22} className="text-[#AEB4C0]" />
        <p className="text-[13px] font-medium text-[#8E95A3]">Henüz bir eğitime kayıtlı değil.</p>
      </div>
    );
  }

  const idx = Math.min(selIdx, trainings.length - 1);
  const cur = trainings[idx];
  const [c1, c2] = avatarGradient(cur.groupId);
  const donutSize = compact ? 132 : 150;
  const att = cur.attendance;
  const cert = cur.certificate;
  const donutColor = att == null || att.pct == null ? "#CDD2DA" : att.pct >= 80 ? "#12A56A" : att.pct >= 50 ? "#2867bd" : "#D93636";
  const courseStyle = COURSE_STATUS_STYLE[cur.courseStatus] ?? { color: "#205297", background: "#DDE8F8" };

  return (
    <div className="flex flex-col gap-3.5">
      {trainings.length > 1 && (
        <div className="relative self-end">
          <button
            onClick={() => setDdOpen((v) => !v)}
            className={`inline-flex items-center justify-between gap-3 rounded-[11px] border border-[#E2E5EA] bg-white font-bold text-[#1E222B] cursor-pointer ${compact ? "min-w-[230px] px-3.5 py-2.5 text-[13px]" : "min-w-[260px] px-4 py-3 text-[14px]"}`}
          >
            <span className="inline-flex items-center gap-2 truncate">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c1 }} />
              {trainingLabel(cur)}
            </span>
            <ChevronDown size={14} className={`text-[#8E95A3] shrink-0 transition-transform ${ddOpen ? "rotate-180" : ""}`} />
          </button>
          {ddOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setDdOpen(false)} />
              <div className="absolute top-[calc(100%+8px)] right-0 w-[290px] bg-white border border-[#E2E5EA] rounded-[14px] shadow-[0_18px_40px_-12px_rgba(15,31,61,.22)] p-2 z-20">
                {trainings.map((t, i) => {
                  const [tc1] = avatarGradient(t.groupId);
                  const active = i === idx;
                  return (
                    <div
                      key={t.enrollmentId}
                      onClick={() => { setSelIdx(i); setDdOpen(false); }}
                      className={`flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-[10px] cursor-pointer text-[13.5px] ${active ? "bg-[#E2EAF3] text-[#205297] font-bold" : "text-[#414B59] font-medium hover:bg-[#F7F8FA]"}`}
                    >
                      <span className="inline-flex items-center gap-2 min-w-0 truncate">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: tc1 }} />
                        {trainingLabel(t)}
                      </span>
                      {active && <Check size={15} strokeWidth={3} className="text-[#205297] shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* course meta */}
      <div className={`bg-white border border-[#E2E5EA] rounded-[14px] ${compact ? "p-4" : "p-[18px]"}`}>
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl shrink-0 flex items-center justify-center text-white" style={{ background: `linear-gradient(135deg,${c1},${c2})` }}>
            <GraduationCap size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-extrabold text-[#1E222B] truncate">{cur.groupCode}</div>
            <div className="text-[12px] text-[#8E95A3] font-semibold mt-0.5 truncate">{cur.moduleName ?? cur.trainingName} · {cur.instructorName ?? "Eğitmen atanmadı"}</div>
          </div>
          <span className="shrink-0 text-[12px] font-bold px-3 py-1.5 rounded-full" style={{ color: courseStyle.color, background: courseStyle.background }}>{cur.courseStatus}</span>
        </div>
        {!compact && (
          <div className="grid grid-cols-2 gap-3.5 pt-3.5 mt-3.5 border-t border-[#F2F4F7]">
            <div><div className="text-[11.5px] font-semibold text-[#8E95A3]">Başlangıç Tarihi</div><div className="text-[14px] font-bold text-[#1E222B] mt-0.5">{fmtDateLong(cur.startDate)}</div></div>
            <div><div className="text-[11.5px] font-semibold text-[#8E95A3]">Tahmini Bitiş Tarihi</div><div className="text-[14px] font-bold text-[#1E222B] mt-0.5">{fmtDateLong(cur.estimatedEndDate)}</div></div>
          </div>
        )}
      </div>

      {/* yoklama */}
      {att && (
        <div className={`bg-white border border-[#E2E5EA] rounded-[14px] flex items-center gap-6 flex-wrap ${compact ? "p-4" : "p-5"}`}>
          <div className="relative shrink-0" style={{ width: donutSize, height: donutSize }}>
            <Donut pct={att.pct ?? 0} size={donutSize} color={donutColor} />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
              <span className="text-[24px] leading-none font-extrabold text-[#1E222B] tracking-tight">
                {att.pct ?? "—"}{att.pct != null && <span className="text-[13px] font-bold">%</span>}
              </span>
              <span className="text-[11px] leading-none font-semibold text-[#8E95A3]">Katılım</span>
            </div>
          </div>
          {/* 2026-07-17 kullanıcı isteği: 5 satır, HEPSİ eşit aralıklı — her satır arası
              aynı 11px+11px (border ile) boşluk, "Yapılan Ders"/"Derse Katılım" birbirine
              yapışık görünmesin diye artık kendi border'ları da var (önceki versiyonda
              sadece flex `gap-3` vardı, ayrım net değildi). Son satırın (Kalan Ders) alt
              border'ı yok, üstündeki `pt-[11px]` diğerleriyle aynı ritmi korusun diye kaldı. */}
          <div className="flex-1 min-w-[210px] flex flex-col">
            <div className="flex items-center justify-between pb-[11px] border-b border-[#F2F4F7]">
              <span className="text-[13px] font-semibold text-[#6F7B87]">Toplam Ders</span>
              <span className="text-[14.5px] font-extrabold text-[#1E222B]">{att.totalHours} saat</span>
            </div>
            <div className="flex items-center justify-between pt-[11px] pb-[11px] border-b border-[#F2F4F7]">
              <span className="text-[13px] font-semibold text-[#6F7B87]">Yapılan Ders</span>
              <span className="text-[14.5px] font-extrabold text-[#1E222B]">{att.heldHours} saat</span>
            </div>
            <div className="flex items-center justify-between pt-[11px] pb-[11px] border-b border-[#F2F4F7]">
              <span className="text-[13px] font-semibold text-[#6F7B87]">Derse Katılım</span>
              <div className="text-right">
                <div className="text-[14.5px] font-extrabold text-[#1E222B]">{att.doneHours} saat</div>
                {/* 2026-07-17 kullanıcı isteği: sadece online alan öğrencide yüz yüze/online
                    kırılımı gösterilmez — zaten hepsinin online olacağı biliniyor, "0s yüz
                    yüze" yazması gereksiz/kalabalık. */}
                {!cur.isOnlineStudent && (
                  <div className="text-[11px] leading-none font-semibold text-[#8E95A3] mt-0.5">{att.faceHours}s. yüz yüze · {att.onlineHours}s. online</div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between pt-[11px] pb-[11px] border-b border-[#F2F4F7]">
              <span className="text-[13px] font-semibold text-[#D93636]">Devamsızlık</span>
              <span className="text-[14.5px] font-extrabold text-[#D93636]">{att.absentHours} saat</span>
            </div>
            <div className="flex items-center justify-between pt-[11px]">
              <span className="text-[13px] font-semibold text-[#6F7B87]">Kalan Ders</span>
              <span className="text-[14.5px] font-extrabold text-[#1E222B]">{att.upcomingHours} saat</span>
            </div>
          </div>
        </div>
      )}

      {/* sertifika */}
      {cert && (
        <div className={`bg-gradient-to-br from-[#FFFDF7] to-[#FFF8EC] border border-[#F1E3C6] rounded-2xl ${compact ? "p-4" : "p-5"}`}>
          <div className="flex items-center gap-2.5 mb-3.5">
            <div className="w-[30px] h-[30px] rounded-[9px] bg-[#FCEFD0] text-[#B7791F] flex items-center justify-center shrink-0">
              <GraduationCap size={16} />
            </div>
            <span className="text-[12px] font-extrabold text-[#414B59] uppercase tracking-wide">Sertifika Not Bilgileri</span>
          </div>
          <div className="bg-white border border-[#F1E3C6] rounded-[13px] p-4">
            <div className="flex items-center gap-2.5 mb-3">
              <span className="text-[13.5px] font-extrabold text-[#1E222B] flex-1 truncate">{cur.moduleName ?? cur.trainingName}</span>
              {cert.durum && (
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0" style={{ color: CERT_STATUS_STYLE[cert.durum].color, background: CERT_STATUS_STYLE[cert.durum].background }}>
                  {cert.durum}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4.5">
              <div className="flex items-end gap-1.5 shrink-0">
                <span className="text-[46px] leading-none font-extrabold tracking-tight tabular-nums" style={{ color: certScoreColor(cert.toplamNot) }}>
                  {cert.toplamNot ?? "—"}
                </span>
                <span className="text-[14px] font-bold text-[#AEB4C0] mb-1">/ 100</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11.5px] font-semibold text-[#8E95A3]">
                  {cert.toplamNot == null ? "Henüz not girilmedi" : cert.durum === "Kaldı" ? "Geçme notu altında" : "Not girildi"}
                </div>
                <CertBar pct={cert.toplamNot ?? 0} gradient={certBarGradient(cert.toplamNot)} />
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[10.5px] font-semibold text-[#B79B6A]">Geçme notu 50{cert.odevAktif ? ` · Sertifika %${cert.sertifikaPct} · Ödev %${100 - cert.sertifikaPct}` : ""}</span>
                  {cert.toplamNot != null && (
                    <span className="text-[11px] font-bold" style={{ color: cert.toplamNot >= 50 ? "#0A6B3F" : "#D93636" }}>{cert.toplamNot >= 50 ? "Geçti" : "Kaldı"}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
