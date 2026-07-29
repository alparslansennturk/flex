"use client";

/**
 * Öğrenci Detay — "Eğitim Bilgileri": course dropdown (birden fazla enrollment varsa) +
 * kurs meta kartı + yoklama donut'u + sertifika kartı/grid'i. `Öğrenci Bilgi.dc.html`
 * (sayfa) ve `Öğrenci Bilgi Modal.dc.html` (modal, `compact`) BİREBİR portu — TEK bileşen,
 * ikisi de kullanır.
 *
 * Sertifika bölümü: aynı eğitimin (aynı `trainingName`) birden fazla modülü/bölümü varsa
 * (ör. Grafik Tasarım'ın Grafik-1/Grafik-2'si) hepsinin notu dropdown'dan BAĞIMSIZ yan
 * yana grid'de gösterilir — yoklama/donut sadece dropdown'da seçili modüle özel kalır.
 * 2026-07-16'da bu grid "tek kart yeterli" gerekçesiyle sadeleştirilmişti; 2026-07-27'de
 * kullanıcı kararıyla Claude Design'daki (`Öğrenci Bilgi Modal.dc.html`) orijinal çoklu-
 * modül grid'i geri getirildi.
 */

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check, GraduationCap } from "lucide-react";
import type { CertificateSummary, TrainingSummary } from "@/app/lib/domain/services/person-education-summary-service";
import { fmtDateLong, CERT_STATUS_STYLE, COURSE_STATUS_STYLE, avatarGradient } from "./studentShared";

/** Dropdown'da eğitim/bölüm etiketi — "Grafik Tasarım Kursu - Grafik-2" (2026-07-16
 * kullanıcı isteği: `-` ayraç, `·` değil). */
function trainingLabel(t: TrainingSummary): string {
  return t.moduleName ? `${t.trainingName} - ${t.moduleName}` : t.trainingName;
}

/** Yüz yüze/online kırılımı — "Derse Katılım" değerinin üzerine gelince (masaüstü) veya
 * dokununca (tablet/mobil, çoğu mobil tarayıcı `:hover`'ı dokunmada da tetikler) küçük bir
 * popover açar. Sağ üstte küçük bir "!" rozet — "burası tıklanabilir" net olsun diye.
 *
 * 2026-07-27, 3. TUR: önceki JS (`useState` + `onMouseEnter`/`onMouseLeave` + dışarı-tıklama
 * `fixed` katmanı) sürümü kullanıcıda güvenilir açılmıyordu (birkaç olası CSS/stacking bug'ı
 * denendi, çözülemedi). TAMAMEN CSS'e geçildi — Tailwind `group`/`group-hover:` ile tarayıcının
 * NATIVE `:hover` sözde-sınıfı kullanılıyor, hiç JS state/olay dinleyicisi yok, bug ihtimali
 * pratikte sıfır. `pointer-events-none` popover'ın kendisinin mouse'u "yemesini" (hover'ı
 * tetikleyiciden çalıp titretmesini) engelliyor. */
function HoursBreakdownPopover({ faceHours, onlineHours, children }: { faceHours: number; onlineHours: number; children: React.ReactNode }) {
  return (
    <span className="group relative inline-flex items-start">
      {children}
      <span className="relative -top-1 ml-1 inline-flex items-center justify-center w-[15px] h-[15px] rounded-full bg-[#2867bd] text-white text-[9.5px] font-black leading-none shrink-0 cursor-pointer">!</span>
      <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute z-50 top-full right-0 mt-1.5 whitespace-nowrap bg-[#1E222B] text-white text-[11px] rounded-lg px-2.5 py-1.5 shadow-lg">
        <span className="font-extrabold">{faceHours}s.</span>
        <span className="font-medium text-[#C4CAD3]"> yüz yüze · </span>
        <span className="font-extrabold">{onlineHours}s.</span>
        <span className="font-medium text-[#C4CAD3]"> online</span>
      </span>
    </span>
  );
}

/** Derse Katılım dışındaki (rozetsiz) saat değerlerine de rozet genişliği kadar (15px + 4px
 * boşluk) sağ boşluk verir — böylece 5 satırın rakamları da hizalanır, sadece Derse Katılım'ın
 * rozeti bu hizanın SAĞINDA, ayrı bir yerde durur (2026-07-27 kullanıcı isteği). */
const HOURS_BADGE_RESERVE = "19px";

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

/** Not sayacı — Claude Design'daki `countCert()` ile aynı: cubic ease-out, ~900ms,
 * requestAnimationFrame ile 0'dan hedef değere sayar. Bar genişliği de AYNI sayaçtan
 * beslenir (ayrı bir CSS transition değil) — rakam ve çubuk birebir senkron dolar. */
function useCountUp(target: number, ms = 900) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [target, ms]);
  return value;
}

/** Tek sertifika modülü kartı — bir eğitimin 2+ bölümü varsa (ör. Grafik Tasarım'ın
 * Grafik-1/Grafik-2 modülleri) bunlardan birden fazlası yan yana grid'de gösterilir.
 * Fontlar/padding 2026-07-27'de bir tık küçültüldü (kullanıcı: "sertifika notları çok
 * büyük") — modal'da soldaki Not alanının bitişiyle sağdaki bu bölümün bitişi arasındaki
 * fark bu sayede de azalıyor (skorun 40px→32px olması kartın toplam yüksekliğini düşürüyor). */
function CertCard({ label, cert }: { label: string; cert: CertificateSummary }) {
  const shown = useCountUp(cert.toplamNot ?? 0);
  const color = certScoreColor(cert.toplamNot);
  const gradient = certBarGradient(cert.toplamNot);
  const pct = cert.toplamNot == null ? 0 : shown;
  return (
    <div className="bg-white border border-[#F1E3C6] rounded-[13px] p-3.5">
      <div className="flex items-center gap-2.5 mb-2.5">
        <span className="text-[13px] font-extrabold text-[#1E222B] flex-1 truncate">{label}</span>
        {cert.durum && (
          <span className="text-[10.5px] font-bold px-2.5 py-1 rounded-full shrink-0" style={{ color: CERT_STATUS_STYLE[cert.durum].color, background: CERT_STATUS_STYLE[cert.durum].background }}>
            {cert.durum}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3.5">
        <div className="flex items-end gap-1.5 shrink-0">
          {/* `min-w-[3ch]` — `shown` 0'dan hedefe RAF ile ~900ms'de sayıyor (`useCountUp`),
              1 haneden ("0") 2-3 haneye ("87") büyürken sabit genişlik olmazsa sağdaki
              `flex-1 min-w-0` detay metnini sıkıştırıp SATIR KAYDIRIYORDU — bu da kartın
              (dolayısıyla modal'ın) sayaç bitene kadar birkaç piksel büyümesine yol açıyordu
              (2026-07-29 kullanıcı bulgusu: sadece not girilmiş/graded öğrencide, çünkü
              notu boş olan kartta hedef 0 olduğu için `shown` hiç değişmiyor). */}
          <span className="text-[32px] leading-none font-extrabold tracking-tight tabular-nums text-right inline-block min-w-[3ch]" style={{ color }}>
            {cert.toplamNot == null ? "—" : shown}
          </span>
          <span className="text-[12.5px] font-bold text-[#AEB4C0] mb-0.5">/ 100</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-semibold text-[#8E95A3]">
            {cert.toplamNot == null ? "Henüz not girilmedi" : cert.durum === "Kaldı" ? "Geçme notu altında" : "Not girildi"}
          </div>
          <div className="h-1.5 rounded-lg bg-[#EFE6D2] overflow-hidden mt-1.5">
            <div className="h-full rounded-lg" style={{ width: `${pct}%`, background: gradient }} />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] font-semibold text-[#B79B6A]">Geçme notu 50{cert.odevAktif ? ` · Sertifika %${cert.sertifikaPct} · Ödev %${100 - cert.sertifikaPct}` : ""}</span>
            {cert.toplamNot != null && (
              <span className="text-[10.5px] font-bold" style={{ color: cert.toplamNot >= 50 ? "#0A6B3F" : "#D93636" }}>{cert.toplamNot >= 50 ? "Geçti" : "Kaldı"}</span>
            )}
          </div>
        </div>
      </div>
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
  const donutColor = att == null || att.pct == null ? "#CDD2DA" : att.pct >= 80 ? "#12A56A" : att.pct >= 50 ? "#2867bd" : "#D93636";
  const courseStyle = COURSE_STATUS_STYLE[cur.courseStatus] ?? { color: "#205297", background: "#DDE8F8" };

  // Aynı eğitimin (aynı trainingName) birden fazla bölümü/modülü varsa (ör. Grafik
  // Tasarım'ın Grafik-1/Grafik-2'si) sertifika kartları dropdown'dan BAĞIMSIZ hepsi
  // birden yan yana gösterilir — sadece yoklama/donut seçili modüle özel kalır
  // (kullanıcı kararı, 2026-07-27: Claude Design'daki çoklu-modül grid'i geri getirildi).
  const certSiblings = trainings
    .filter((t) => t.trainingName === cur.trainingName && t.certificate)
    .sort((a, b) => (a.moduleName ?? "").localeCompare(b.moduleName ?? "", "tr"));

  return (
    <div className="flex flex-col gap-3.5">
      {/* 2026-07-29 kullanıcı bulgusu: bu kutu SADECE 2+ eğitimde render ediliyordu —
          tek eğitimi olan öğrencide (ör. sadece Grafik-2) sağ üst boşluk kalıp sütun
          daha kısa başlıyor, bu da (grid `stretch` yüzünden) modal'ın genel yüksekliğini
          düşürüp alt hizayı bozuyordu. Artık HER ZAMAN aynı kutu render ediliyor — tek
          fark: tek eğitimde tıklanamaz/chevron'suz, sadece bilgi etiketi. */}
      <div className="relative self-end">
        <button
          onClick={() => trainings.length > 1 && setDdOpen((v) => !v)}
          className={`inline-flex items-center justify-between gap-3 rounded-[11px] border border-[#E2E5EA] bg-white font-bold text-[#1E222B] ${trainings.length > 1 ? "cursor-pointer" : "cursor-default"} ${compact ? "min-w-[230px] px-3.5 py-2.5 text-[13px]" : "min-w-[260px] px-4 py-3 text-[14px]"}`}
        >
          <span className="inline-flex items-center gap-2 truncate">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c1 }} />
            {trainingLabel(cur)}
          </span>
          {trainings.length > 1 && (
            <ChevronDown size={14} className={`text-[#8E95A3] shrink-0 transition-transform ${ddOpen ? "rotate-180" : ""}`} />
          )}
        </button>
        {trainings.length > 1 && ddOpen && (
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

      {/* yoklama + sertifika — non-compact (tam sayfa/panel): yoklama kartı tam genişlik
          alınca boşta çok yer kaplıyordu (kullanıcı bulgusu, 2026-07-27), yan yana ~%40/%60
          düzenine alındı (donut+bilgiler yatay kalabilsin diye %30 yetmedi, %40'a çıkarıldı).
          Modal (compact) buna dokunulmadı, eskisi gibi alt alta kaldı. */}
      {compact ? (
        <>
          {att && <AttendanceCard att={att} cur={cur} donutSize={donutSize} donutColor={donutColor} compact={compact} />}
          {certSiblings.length > 0 && <CertSection certSiblings={certSiblings} compact={compact} />}
        </>
      ) : (
        <div className="grid gap-3.5" style={{ gridTemplateColumns: "minmax(0,40%) minmax(0,1fr)" }}>
          {att && <AttendanceCard att={att} cur={cur} donutSize={donutSize} donutColor={donutColor} compact={compact} />}
          {certSiblings.length > 0 && <CertSection certSiblings={certSiblings} compact={compact} />}
        </div>
      )}
    </div>
  );
}

function AttendanceCard({ att, cur, donutSize, donutColor, compact }: { att: NonNullable<TrainingSummary["attendance"]>; cur: TrainingSummary; donutSize: number; donutColor: string; compact: boolean }) {
  // 2026-07-27: aşağıdaki 2 düzenleme SADECE non-compact (tam sayfa/panel) — modal'a
  // artık dokunulmuyor (kullanıcı talimatı), o yüzden compact'ta HER ZAMAN eski
  // (flex-1, tam genişlik) davranış korunuyor.
  const statsBoxClass = compact
    ? "flex-1 min-w-[210px] flex flex-col"
    // `flex-1` — kutu donut'un HEMEN yanından başlayıp kartın sağ kenarına (16px, `pr-4`)
    // kadar geriliyor. Satır içindeki `justify-between` başlığı sol kenara (donut'a yakın),
    // rakamı sağ kenara (kartın kenarı) itiyor (2026-07-27 kullanıcı isteği: "başlıklar
    // donuta yakın kalsın, değerler yerinde kalsın").
    : "flex-1 min-w-[150px] flex flex-col";
  // 2026-07-27 kullanıcı isteği: saat rakamları küçük ekranda bir tık küçülsün — `md:`
  // altında (768px) 13px, üstünde eski 14.5px. Sadece non-compact (modal dokunulmuyor).
  const valueSizeClass = compact ? "text-[14.5px]" : "text-[13px] md:text-[14.5px]";
  return (
    <div className={`bg-white border border-[#E2E5EA] rounded-[14px] flex items-center gap-6 flex-wrap ${compact ? "p-4" : "py-5 pl-5 pr-4"}`}>
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
      <div className={statsBoxClass}>
        <div className="flex items-center justify-between pb-[11px] border-b border-[#F2F4F7]">
          <span className="text-[13px] font-semibold text-[#6F7B87]">Toplam Ders</span>
          <span className={`${valueSizeClass} font-extrabold text-[#1E222B]`} style={{ marginRight: HOURS_BADGE_RESERVE }}>{att.totalHours} saat</span>
        </div>
        <div className="flex items-center justify-between pt-[11px] pb-[11px] border-b border-[#F2F4F7]">
          <span className="text-[13px] font-semibold text-[#6F7B87]">Yapılan Ders</span>
          <span className={`${valueSizeClass} font-extrabold text-[#1E222B]`} style={{ marginRight: HOURS_BADGE_RESERVE }}>{att.heldHours} saat</span>
        </div>
        <div className="flex items-center justify-between pt-[11px] pb-[11px] border-b border-[#F2F4F7]">
          <span className="text-[13px] font-semibold text-[#6F7B87]">Derse Katılım</span>
          <div className="text-right">
            {/* 2026-07-27 kullanıcı kararı: yüz yüze/online kırılımı artık HER ZAMAN açık
                satır DEĞİL — sadece ikisinden biri >0 ise (0/0'da satır zaten anlamsız/
                rahatsız edici), rakamın kendisi hover/tap ile popover açan bir tetikleyici
                oluyor (`HoursBreakdownPopover`). Modal (compact) dahil HER YERDE aynı. */}
            {!cur.isOnlineStudent && (att.faceHours > 0 || att.onlineHours > 0) ? (
              <HoursBreakdownPopover faceHours={att.faceHours} onlineHours={att.onlineHours}>
                <span className={`${valueSizeClass} font-extrabold text-[#1E222B]`}>{att.doneHours} saat</span>
              </HoursBreakdownPopover>
            ) : (
              <div className={`${valueSizeClass} font-extrabold text-[#1E222B]`} style={{ marginRight: HOURS_BADGE_RESERVE }}>{att.doneHours} saat</div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between pt-[11px] pb-[11px] border-b border-[#F2F4F7]">
          <span className="text-[13px] font-semibold text-[#D93636]">Devamsızlık</span>
          <span className={`${valueSizeClass} font-extrabold text-[#D93636]`} style={{ marginRight: HOURS_BADGE_RESERVE }}>{att.absentHours} saat</span>
        </div>
        <div className="flex items-center justify-between pt-[11px]">
          <span className="text-[13px] font-semibold text-[#6F7B87]">Kalan Ders</span>
          <span className={`${valueSizeClass} font-extrabold text-[#1E222B]`} style={{ marginRight: HOURS_BADGE_RESERVE }}>{att.upcomingHours} saat</span>
        </div>
      </div>
    </div>
  );
}

/** Sertifika — 2+ modül varsa (aynı eğitimin bölümleri) yan yana grid. */
function CertSection({ certSiblings, compact }: { certSiblings: TrainingSummary[]; compact: boolean }) {
  return (
    <div className={`bg-gradient-to-br from-[#FFFDF7] to-[#FFF8EC] border border-[#F1E3C6] rounded-2xl ${compact ? "p-4" : "p-5"}`}>
      <div className="flex items-center gap-2.5 mb-3.5">
        <div className="w-[30px] h-[30px] rounded-[9px] bg-[#FCEFD0] text-[#B7791F] flex items-center justify-center shrink-0">
          <GraduationCap size={16} />
        </div>
        <span className="text-[12px] font-extrabold text-[#414B59] uppercase tracking-wide">Sertifika Not Bilgileri</span>
      </div>
      <div className="grid gap-3.5" style={{ gridTemplateColumns: certSiblings.length > 1 ? "1fr 1fr" : "1fr" }}>
        {certSiblings.map((t) => (
          <CertCard key={t.enrollmentId} label={t.moduleName ?? t.trainingName} cert={t.certificate as CertificateSummary} />
        ))}
      </div>
    </div>
  );
}
