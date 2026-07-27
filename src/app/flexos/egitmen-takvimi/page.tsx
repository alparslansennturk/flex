"use client";

/**
 * FlexOS · Eğitmen Takvimi — eğitmen müsaitlik/program görünümü.
 * Tasarım kaynağı: `Eğitmen Takvimi.dc.html` (Claude Design, proje "Flex-Eğitim
 * Yönetimi") — SADECE ana içerik alanı portlandı (sidebar/header mockup'ın kendi
 * HTML'i DEĞİL, gerçek app'teki `FlexSidebar`/`FlexHeader` zaten var).
 *
 * 2026-07-27 — TAM PORT: Hafta/Gün/Ay görünümleri + filtreler + "Eğitmen Günü"
 * modalı + "Eğitim Planla" modalı (tarih/saat/branş seçince SADECE müsait
 * eğitmenleri listeler — kullanıcının "eğitmen atarken müsait değilse uyarır"
 * isteğinin karşılığı bu modal).
 *
 * VERİ: eğitmen LİSTESİ gerçek (`GET /api/flexos/trainers` — `trainer.read`
 * ile aynı kapı, Eğitmenler sayfasının kullandığı uç), her eğitmenin GERÇEKTEN
 * atanmış grupları (kod/eğitim adı/öğrenci sayısı) da gerçek. Kullanıcı kararı
 * (2026-07-27): "dummy kalsın şu anda ama azalt, gerçek veriye bağla" — Lab
 * Utilizasyon'daki "gerçek liste + mock seans" deseninin aynısı. Yani HANGİ
 * GÜN/SAAT dolu olacağı hâlâ deterministik mock (`blocksFor`), ama İÇERİK
 * (hangi grup, kaç öğrenci) gerçek. `Trainer.availability` alanı (haftalık
 * müsaitlik dilimleri) zaten domain'de var ama BURADA henüz okunmuyor — sıradaki
 * adım, bkz. FLEXOS.md.
 *
 * "EĞİTİM PLANLA" → GRUP EKLE (2026-07-27, kullanıcı: "eğitim planlama ile grup
 * ekleme aslında benzer şeyler"): müsait bir eğitmen seçilip onaylanınca ayrı bir
 * sahte kayıt YARATILMIYOR — kullanıcı GERÇEK "Grup Ekle" formuna (`/flexos/siniflar`)
 * seçilen eğitmen + tarih önceden dolu şekilde yönlendiriliyor (`?trainerId=&tarih=`,
 * bkz. `siniflar/page.tsx` + `GroupFormSheet`'in `prefill` prop'u). Saat/süre BİLEREK
 * taşınmıyor — Grup Ekle'de zaman serbest girilmiyor, önceden tanımlı "Seans"
 * kütüphanesinden seçiliyor, buradaki dakika hassasiyetinin orada karşılığı olmayabilir.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/app/lib/firebase";
import FlexSidebar from "../_components/FlexSidebar";
import FlexHeader, { FlexPageContent, FLEX_CONTENT_MAX_WIDTH_COMPACT_CLASS, FLEX_PAGE_FOOTER_CLASS } from "../_components/FlexHeader";
import Footer from "@/app/components/layout/Footer";
import { FlexPageLoader } from "../_components/FlexSpinner";

// ── sabitler (tasarımla birebir) ──
const DOW = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const DOW_FULL = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const AX_START = 8 * 60, AX_END = 22 * 60;
// 2026-07-27 kullanıcı düzeltmesi: gerçek seanslar 09:00'da başlayıp 19:00'da BAŞLAYAN akşam
// dersleri 21:30'a kadar sürebiliyor (Lab Utilizasyon'daki gerçek Seans verisiyle doğrulandı)
// — önceki 09:00-18:00 varsayımı yanlıştı, en geç başlangıç 17:30 çıkıyordu.
const WORK_START = 9 * 60, WORK_END = 22 * 60;
// "Başlangıç" dropdown'ında son seçenek — WORK_END'den bağımsız (WORK_END sadece derslerin
// EN GEÇ biteceği an, en geç BAŞLAYABİLECEĞİ an değil).
const LATEST_START = 19 * 60;

type BlockType = "ders" | "musait" | "rezerve" | "izin" | "rapor" | "tatil";
const BLK: Record<BlockType, { key: BlockType; label: string; color: string; bg: string; border: string; dot: string }> = {
  ders: { key: "ders", label: "Eğitimde", color: "#205297", bg: "#EAF1FB", border: "#C6DBF5", dot: "#2867bd" },
  musait: { key: "musait", label: "Müsait", color: "#0A6B3F", bg: "#E7F6EE", border: "#BFE6D0", dot: "#12A56A" },
  rezerve: { key: "rezerve", label: "Rezerve", color: "#B45309", bg: "#FFF4E3", border: "#F3D9AE", dot: "#E8890C" },
  izin: { key: "izin", label: "İzin", color: "#B7791F", bg: "#FDF4E3", border: "#F2E0B8", dot: "#E8A20C" },
  rapor: { key: "rapor", label: "Raporlu", color: "#C0392B", bg: "#FCEDEC", border: "#F4CFCB", dot: "#D93636" },
  tatil: { key: "tatil", label: "Resmi Tatil", color: "#5B4B8A", bg: "#EDE9F7", border: "#D6CEEE", dot: "#7A66B8" },
};
const TUR_META: Record<string, { color: string; bg: string }> = { Bireysel: { color: "#4A5568", bg: "#EDF0F4" }, Kurumsal: { color: "#4D52A6", bg: "#E6E7FA" } };

const BRANSLAR = ["Yazılım", "Tasarım", "Finans", "Pazarlama", "Dil"];
const SUBELER = ["Kadıköy", "Pendik", "Ümraniye", "Beşiktaş"];
const SALONLAR = ["A-101", "A-102", "B-201", "C-301"];
const FIRMALAR = ["Aselsan", "Turkcell", "Getir", "Trendyol", "Vestel"];
// SADECE bir eğitmene HİÇ gerçek grup atanmamışsa (edge-case) yer tutucu ders adı için.
const EG_BY_BRANS: Record<string, string[]> = {
  Yazılım: ["Full-Stack Web", "Veri Bilimi", "Python Bootcamp"],
  Tasarım: ["UI/UX Tasarım", "Grafik Tasarım"],
  Finans: ["Finansal Modelleme", "Bütçe Yönetimi"],
  Pazarlama: ["Dijital Pazarlama", "SEO & SEM"],
  Dil: ["İngilizce B2", "İş İngilizcesi"],
};

/** Gerçek `Trainer` kaydından türetilen eğitmen — sadece kimlik (ad/branş/şube/
 * atanmış gerçek gruplar) gerçek, PROGRAM/SAAT hâlâ mock (kullanıcı kararı,
 * 2026-07-27: "dummy kalsın ama azalt, gerçek veriye bağla" — Lab Utilizasyon'daki
 * "gerçek liste + mock seans" deseninin aynısı). */
interface Instructor {
  id: string; name: string; brans: string; sube: string; av: [string, string];
  /** Bu eğitmene GERÇEKTEN atanmış gruplar (kod/eğitim adı/öğrenci sayısı) — mock
   * ders bloklarının içeriği (hangi grup/eğitim/kaç öğrenci) buradan seçiliyor,
   * sadece HANGİ GÜN/SAAT işleneceği hâlâ deterministik mock. */
  groups: { kod: string; egitim: string; ogrenci: number }[];
}

// ── yardımcılar ──
function isoDate(d: Date) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function parseISO(s: string) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
function mondayOf(d: Date) { const x = new Date(d); const k = (x.getDay() + 6) % 7; x.setDate(x.getDate() - k); x.setHours(0, 0, 0, 0); return x; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function fmtTime(m: number) { return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); }
function initials(name: string) { return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toLocaleUpperCase("tr"); }
function rnd(seed: number) { const x = Math.sin(seed) * 10000; return x - Math.floor(x); }
function entityOf(b: Block) { return b.tur === "Kurumsal" ? b.firma : b.grup; }
/** Firestore doc ID (string) → sayısal seed. Gerçek `Trainer.id` artık kullanıcı
 * numarası değil UUID benzeri bir string olduğu için mock üreticinin `id*7919`
 * gibi aritmetiğine sokabilmek için kısa/sabit bir hash gerekiyor. */
function hashSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 96000) + 1;
}
const AV_PALETTES: Array<[string, string]> = [
  ["#689adf", "#2867bd"], ["#F76FA3", "#F91079"], ["#67B5B6", "#1CB5AE"], ["#8B91E6", "#4D52A6"],
  ["#FFA352", "#FF7800"], ["#7FBF8F", "#2E8B57"], ["#F0A868", "#D66500"], ["#9B8CFF", "#6C5CE7"],
];
function avatarFor(id: string): [string, string] { return AV_PALETTES[hashSeed(id) % AV_PALETTES.length]; }

interface Block { type: BlockType; startMin: number; dur: number; egitim?: string; tur?: string; online?: boolean; firma?: string; grup?: string; salon?: string; ogrenci?: number }
type DayType = "kapali" | "tatil" | "izin" | "rapor" | "aktif";

/** Bir eğitmenin bir gündeki TÜM blokları (ders/rezerve/izin/rapor/tatil/boş) —
 * HANGİ GÜN/SAAT'in dolu olacağı deterministik seed'li mock (tasarımdaki
 * `blocksFor` ile aynı mantık), ama ders bloğunun İÇERİĞİ (grup/eğitim/öğrenci
 * sayısı) bu eğitmene GERÇEKTEN atanmış bir gruptan seçiliyor — hiç atanmış
 * grubu yoksa jenerik bir yer tutucuya düşer. */
function blocksFor(instr: Instructor, dateISO: string): { dayType: DayType; blocks: Block[] } {
  const d = parseISO(dateISO);
  // 2026-07-27 kullanıcı düzeltmesi: Pazar "kapalı" varsayımı YANLIŞTI — kurum gerçekte
  // 7 gün çalışıyor, Pazar günü de ders var. "Cuma hafif/kapalı" gibi gün-bazlı kurallar
  // da BİLEREK konulmadı: bu belirli bir müşterinin (Arı Bilgi) kendi iş kuralı — "genel
  // bir sistem kuruyoruz", Kurumsal/Özel Ders gibi türler herhangi bir günde olabilir.
  // Bu yüzden mock üretici artık haftanın 7 gününe de EŞİT davranıyor, gün bazlı özel
  // durum yok (izin/rapor hâlâ eğitmen bazında rastgele — bu genel/makul bir varsayım).
  const idSeed = hashSeed(instr.id);
  const base = d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate();
  const seed = idSeed * 7919 + base;
  const r = rnd(seed);
  if (r < 0.07) return { dayType: "izin", blocks: [{ type: "izin", startMin: WORK_START, dur: WORK_END - WORK_START }] };
  if (r < 0.12) return { dayType: "rapor", blocks: [{ type: "rapor", startMin: WORK_START, dur: WORK_END - WORK_START }] };

  const sessions: Block[] = [];
  // 2026-07-27: yoğunluk azaltıldı (önceki sürümde 3'tü) — ama hangi GÜN olduğuna göre
  // değişmiyor artık (yukarıdaki not: gün-bazlı özel kural yok, 7 gün eşit).
  const nMax = 2;
  const nS = 1 + Math.floor(rnd(seed * 3) * nMax);
  let cursor = WORK_START + Math.floor(rnd(seed * 5) * 2) * 30;
  const pool = instr.groups.length ? instr.groups : [{ kod: "Ders", egitim: EG_BY_BRANS[instr.brans]?.[0] ?? instr.brans + " Dersi", ogrenci: 10 }];
  for (let k = 0; k < nS; k++) {
    const sk = seed * 13 + k * 101;
    const dur = [90, 120, 150][Math.floor(rnd(sk) * 3)];
    if (cursor + dur > WORK_END) break;
    const isRez = rnd(sk * 3) > 0.86;
    const tur = rnd(sk * 5) > 0.5 ? "Kurumsal" : "Bireysel";
    const online = rnd(sk * 7) > 0.68;
    const g = pool[Math.floor(rnd(sk * 17) * pool.length)];
    sessions.push({
      type: isRez ? "rezerve" : "ders", startMin: cursor, dur, egitim: g.egitim, tur, online,
      firma: FIRMALAR[Math.floor(rnd(sk * 11) * FIRMALAR.length)],
      grup: g.kod,
      salon: online ? "Online" : SALONLAR[Math.floor(rnd(sk * 13) * SALONLAR.length)],
      ogrenci: g.ogrenci || 6 + Math.floor(rnd(sk * 19) * 16),
    });
    cursor += dur + [0, 30, 60][Math.floor(rnd(sk * 23) * 3)];
  }
  const busy = sessions.map((s) => ({ s: s.startMin, e: s.startMin + s.dur })).sort((a, b) => a.s - b.s);
  const free: Block[] = [];
  let c = WORK_START;
  busy.forEach((b) => { if (b.s - c >= 45) free.push({ type: "musait", startMin: c, dur: b.s - c }); c = Math.max(c, b.e); });
  if (WORK_END - c >= 45) free.push({ type: "musait", startMin: c, dur: WORK_END - c });
  const blocks = sessions.concat(free).sort((a, b) => a.startMin - b.startMin);
  return { dayType: "aktif", blocks };
}

/** Bir eğitmenin verilen tarih+saat aralığında müsait olup olmadığı — Eğitim
 * Planla modalının kalbi: null=müsait, aksi halde "neden dolu" metni. */
function isBusyAt(instr: Instructor, dateISO: string, startMin: number, endMin: number): string | null {
  const { blocks } = blocksFor(instr, dateISO);
  for (const b of blocks) {
    if (b.type === "musait") continue;
    const be = b.startMin + b.dur;
    if (b.startMin < endMin && startMin < be) {
      if (b.type === "izin") return "İzinli";
      if (b.type === "rapor") return "Raporlu";
      if (b.type === "tatil") return "Resmi tatil";
      return "Dolu · " + fmtTime(b.startMin) + " " + (b.egitim || "eğitim");
    }
  }
  if (startMin < WORK_START || endMin > WORK_END) return "Çalışma saati dışı";
  return null;
}

const navBtnStyle: React.CSSProperties = { width: 38, height: 38, borderRadius: 10, border: "1px solid #E2E5EA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#414B59" };
const selectStyle: React.CSSProperties = { width: "100%", padding: "10px 30px 10px 12px", borderRadius: 10, border: "1px solid #E2E5EA", background: "#fff", color: "#1E222B", fontSize: 13, fontWeight: 600, outline: "none", cursor: "pointer", appearance: "none", WebkitAppearance: "none" };

type ViewKey = "day" | "week" | "month";

export default function EgitmenTakvimiPage() {
  const router = useRouter();
  const TODAY = useMemo(() => new Date(), []);
  const todayISO = isoDate(TODAY);

  // ── gerçek eğitmen listesi (Firestore) — program/saat verisi hâlâ mock ──
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loadingInstructors, setLoadingInstructors] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const u = auth.currentUser;
      const token = u ? await u.getIdToken() : "";
      const res = await fetch("/api/flexos/trainers", { headers: { Authorization: `Bearer ${token}` } });
      const json = res.ok ? await res.json() : { items: [] };
      type ApiTrainer = { id: string; name: string; subes: string[]; status: string; comp: Record<string, string[]>; groups: { kod: string; egitim: string; ogrenci: number; status: string }[] };
      // GERÇEK BUG FIX (2026-07-27, kullanıcı bulgusu): API bir eğitmenin TÜM gruplarını
      // (tamamlanmış/arşivlenmiş dahil) veriyor — sadece bunlardan üretilen mock ders
      // havuzunda kullanılıyorsa, tek/az grubu tamamlanmış bir eğitmen o bitmiş dersle
      // "hâlâ meşgul" gösteriliyordu. Sadece hâlâ AÇIK/DEVAM EDEN gruplar havuza giriyor.
      const AKTIF_GRUP_DURUM = new Set(["planned", "enrolling", "active", "postponed"]);
      const mapped: Instructor[] = (json.items ?? [])
        .filter((t: ApiTrainer) => t.status === "aktif")
        .map((t: ApiTrainer) => {
          const compKeys = Object.keys(t.comp || {});
          const brans = compKeys[0] ?? BRANSLAR[hashSeed(t.id) % BRANSLAR.length];
          const sube = t.subes?.[0] ?? SUBELER[hashSeed(t.id) % SUBELER.length];
          const acikGruplar = (t.groups ?? []).filter((g) => AKTIF_GRUP_DURUM.has(g.status));
          return { id: t.id, name: t.name, brans, sube, av: avatarFor(t.id), groups: acikGruplar };
        });
      if (!cancelled) { setInstructors(mapped); setLoadingInstructors(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  const [view, setView] = useState<ViewKey>("week");
  const [weekOffset, setWeekOffset] = useState(0);
  const [dayISO, setDayISO] = useState(todayISO);
  const [monthOffset, setMonthOffset] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [fEgitmen, setFEgitmen] = useState("Tümü");
  const [fSube, setFSube] = useState("Tümü");
  const [fBrans, setFBrans] = useState("Tümü");
  const [fTur, setFTur] = useState("Tümü");
  const [fMode, setFMode] = useState("Tümü");
  const [fDurum, setFDurum] = useState("Tümü");

  const [instrModal, setInstrModal] = useState<{ id: string; iso: string } | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [planDate, setPlanDate] = useState(todayISO);
  const [planStart, setPlanStart] = useState(WORK_START + 60);
  const [planDur, setPlanDur] = useState(120);
  const [planBrans, setPlanBrans] = useState("Tümü");
  const [planPick, setPlanPick] = useState<string | null>(null);

  const goPrev = () => { if (view === "week") setWeekOffset((v) => v - 1); else if (view === "day") setDayISO(isoDate(addDays(parseISO(dayISO), -1))); else setMonthOffset((v) => v - 1); };
  const goNext = () => { if (view === "week") setWeekOffset((v) => v + 1); else if (view === "day") setDayISO(isoDate(addDays(parseISO(dayISO), 1))); else setMonthOffset((v) => v + 1); };
  const goToday = () => { setWeekOffset(0); setMonthOffset(0); setDayISO(todayISO); };
  const clearFilters = () => { setFEgitmen("Tümü"); setFSube("Tümü"); setFBrans("Tümü"); setFTur("Tümü"); setFMode("Tümü"); setFDurum("Tümü"); };
  const openInstr = (id: string, iso: string) => setInstrModal({ id, iso });
  const openPlan = () => { setPlanOpen(true); setPlanPick(null); };
  const planForInstr = () => {
    if (!instrModal) return;
    const inst = instructors.find((x) => x.id === instrModal.id);
    setInstrModal(null); setPlanOpen(true); setPlanDate(instrModal.iso); setPlanBrans(inst ? inst.brans : "Tümü"); setPlanPick(instrModal.id);
  };
  const planFromBlock = (iso: string, startMin: number, brans: string, instId: string) => { setInstrModal(null); setPlanOpen(true); setPlanDate(iso); setPlanStart(startMin); setPlanBrans(brans); setPlanPick(instId); };

  const filteredInstructors = useMemo(() => instructors.filter((i) => {
    if (fEgitmen !== "Tümü" && i.name !== fEgitmen) return false;
    if (fSube !== "Tümü" && i.sube !== fSube) return false;
    if (fBrans !== "Tümü" && i.brans !== fBrans) return false;
    return true;
  }), [instructors, fEgitmen, fSube, fBrans]);

  const blockVisible = (b: Block) => {
    if (fDurum !== "Tümü" && BLK[b.type].label !== fDurum) return false;
    if (b.type === "ders" || b.type === "rezerve") {
      if (fTur !== "Tümü" && b.tur !== fTur) return false;
      if (fMode === "Online" && !b.online) return false;
      if (fMode === "Yüz Yüze" && b.online) return false;
    } else {
      if (fTur !== "Tümü") return false;
      if (fMode !== "Tümü") return false;
    }
    return true;
  };

  const activeFilterCount = [fEgitmen, fSube, fBrans, fTur, fMode, fDurum].filter((x) => x !== "Tümü").length;

  // ---- stat kartları (bugün anlık durumu) ----
  const stats = useMemo(() => {
    let musaitCount = 0, dersVeren = 0, izinli = 0, toplamDersDk = 0, aktif = 0, capDen = 0, capNum = 0;
    instructors.forEach((i) => {
      const { dayType, blocks } = blocksFor(i, todayISO);
      if (dayType === "kapali") return;
      if (dayType === "izin" || dayType === "rapor" || dayType === "tatil") { if (dayType !== "tatil") izinli++; return; }
      aktif++;
      const ders = blocks.filter((b) => b.type === "ders" || b.type === "rezerve");
      if (ders.length) dersVeren++;
      if (blocks.some((b) => b.type === "musait")) musaitCount++;
      const dk = ders.reduce((a, b) => a + b.dur, 0);
      toplamDersDk += dk; capNum += dk; capDen += WORK_END - WORK_START;
    });
    const doluluk = capDen ? Math.round((capNum / capDen) * 100) : 0;
    return [
      { label: "Aktif Eğitmen", value: String(aktif), color: "#205297", bg: "#EAF1FB" },
      { label: "Müsait Eğitmen", value: String(musaitCount), color: "#0A6B3F", bg: "#E7F6EE" },
      { label: "Ders Veren", value: String(dersVeren), color: "#B45309", bg: "#FFF4E3" },
      { label: "İzinli / Raporlu", value: String(izinli), color: "#C0392B", bg: "#FCEDEC" },
      { label: "Toplam Ders Saati", value: Math.round(toplamDersDk / 60) + " sa", color: "#4D52A6", bg: "#E6E7FA" },
      { label: "Doluluk", value: "%" + doluluk, color: "#7A3EAF", bg: "#EDE0FB" },
    ];
  }, [instructors, todayISO]);

  // ---- Hafta ----
  const weekMon = useMemo(() => addDays(mondayOf(TODAY), weekOffset * 7), [TODAY, weekOffset]);
  // 2026-07-27 kullanıcı düzeltmesi: Pazar dahil 7 gün (eskiden Pzt-Cmt 6 gün varsayılmıştı —
  // "Pazar günü de çalışılıyor, dersler var" bulgusu).
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekMon, i)), [weekMon]);

  // ---- Gün ----
  const dayD = parseISO(dayISO);
  const axisHours = useMemo(() => { const out: { label: string; leftPct: number }[] = []; for (let h = 8; h <= 22; h++) out.push({ label: String(h).padStart(2, "0"), leftPct: ((h * 60 - AX_START) / (AX_END - AX_START)) * 100 }); return out; }, []);

  // ---- Ay ----
  const monthBase = useMemo(() => new Date(TODAY.getFullYear(), TODAY.getMonth() + monthOffset, 1), [TODAY, monthOffset]);
  const monthStart = useMemo(() => mondayOf(monthBase), [monthBase]);
  const monthCells = useMemo(() => {
    const out: { iso: string; num: number; inMonth: boolean; isToday: boolean; avail: number; ders: number; leave: number; pct: number }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = addDays(monthStart, i);
      const dISO = isoDate(d);
      const inMonth = d.getMonth() === monthBase.getMonth();
      // 2026-07-27 kullanıcı düzeltmesi: Pazar artık kapalı sayılmıyor (bkz. blocksFor),
      // ay heatmap'i de 7 günü de sayıyor — eskiden Pazar hiç hesaba katılmıyordu.
      let avail = 0, ders = 0, leave = 0, activeN = 0;
      instructors.forEach((inst) => {
        const { dayType, blocks } = blocksFor(inst, dISO);
        if (dayType === "izin" || dayType === "rapor") { leave++; return; }
        if (dayType === "tatil") return;
        activeN++;
        if (blocks.some((b) => b.type === "musait")) avail++;
        ders += blocks.filter((b) => b.type === "ders" || b.type === "rezerve").length;
      });
      out.push({ iso: dISO, num: d.getDate(), inMonth, isToday: dISO === todayISO, avail, ders, leave, pct: activeN ? Math.round((avail / activeN) * 100) : 0 });
    }
    return out;
  }, [instructors, monthStart, monthBase, todayISO]);

  let rangeLabel: string;
  if (view === "week") {
    const f = weekDates[0], l = weekDates[6];
    rangeLabel = f.getMonth() === l.getMonth() ? `${f.getDate()} – ${l.getDate()} ${MONTHS[f.getMonth()]} ${f.getFullYear()}` : `${f.getDate()} ${MONTHS[f.getMonth()]} – ${l.getDate()} ${MONTHS[l.getMonth()]}`;
  } else if (view === "day") {
    rangeLabel = `${dayD.getDate()} ${MONTHS[dayD.getMonth()]} ${dayD.getFullYear()} · ${DOW_FULL[(dayD.getDay() + 6) % 7]}`;
  } else {
    rangeLabel = `${MONTHS[monthBase.getMonth()]} ${monthBase.getFullYear()}`;
  }

  // ---- Eğitmen Günü modalı verisi ----
  const instrModalData = useMemo(() => {
    if (!instrModal) return null;
    const inst = instructors.find((x) => x.id === instrModal.id);
    if (!inst) return null;
    const iso = instrModal.iso;
    const d = parseISO(iso);
    const { dayType, blocks } = blocksFor(inst, iso);
    const ders = blocks.filter((b) => b.type === "ders" || b.type === "rezerve");
    const free = blocks.filter((b) => b.type === "musait");
    const dersDk = ders.reduce((a, b) => a + b.dur, 0);
    const freeDk = free.reduce((a, b) => a + b.dur, 0);
    const ogr = ders.reduce((a, b) => a + (b.ogrenci || 0), 0);
    const dolulukI = dersDk + freeDk ? Math.round((dersDk / (dersDk + freeDk)) * 100) : 0;
    const dayStatusLabel = dayType === "izin" ? "İzinli" : dayType === "rapor" ? "Raporlu" : dayType === "tatil" ? "Resmi Tatil" : dayType === "kapali" ? "Kapalı" : "Aktif";
    const dayChipMeta = dayType === "izin" ? BLK.izin : dayType === "rapor" ? BLK.rapor : dayType === "tatil" ? BLK.tatil : BLK.musait;
    const program = blocks.slice().sort((a, b) => a.startMin - b.startMin);
    return { inst, iso, d, dayType, ders, dersDk, freeDk, ogr, dolulukI, dayStatusLabel, dayChipMeta, program };
  }, [instructors, instrModal]);

  // ---- Eğitim Planla modalı verisi ----
  const startOptions = useMemo(() => { const out: number[] = []; for (let m = WORK_START; m <= LATEST_START; m += 30) out.push(m); return out; }, []);
  const durOptions = [{ v: 60, l: "1 saat" }, { v: 90, l: "1.5 saat" }, { v: 120, l: "2 saat" }, { v: 150, l: "2.5 saat" }, { v: 180, l: "3 saat" }];
  const slotEnd = planStart + planDur;
  const planD = parseISO(planDate);
  const planSlotLabel = `${planD.getDate()} ${MONTHS[planD.getMonth()]}, ${fmtTime(planStart)}–${fmtTime(slotEnd)}`;
  const planCandidates = useMemo(() => instructors.filter((i) => planBrans === "Tümü" || i.brans === planBrans).map((inst) => {
    const reason = isBusyAt(inst, planDate, planStart, slotEnd);
    return { inst, available: reason === null, reason };
  }), [instructors, planBrans, planDate, planStart, slotEnd]);
  const planAvailCount = planCandidates.filter((c) => c.available).length;

  const viewTabs: { key: ViewKey; label: string }[] = [{ key: "day", label: "Gün" }, { key: "week", label: "Hafta" }, { key: "month", label: "Ay" }];
  const legend = (Object.keys(BLK) as BlockType[]).map((k) => BLK[k]);

  if (loadingInstructors) {
    return (
      <div style={{ display: "flex", width: "100%", height: "100vh", overflow: "hidden" }}>
        <FlexSidebar active="egitmen-takvimi" />
        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#EEF0F3" }}>
          <FlexPageLoader />
        </main>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh", overflow: "hidden", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <FlexSidebar active="egitmen-takvimi" />
      <main style={{ flex: 1, height: "100%", overflowY: "auto", background: "#EEF0F3", display: "flex", flexDirection: "column" }}>
        <FlexHeader
          icon={<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 21a8 8 0 0 0-16 0" /><circle cx="10" cy="8" r="5" /><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3" /></svg>}
          title="Eğitmen Takvimi"
          subtitle="Eğitmen müsaitlik ve programını tek ekrandan yönetin."
          maxWidthClassName={FLEX_CONTENT_MAX_WIDTH_COMPACT_CLASS}
        />
        <FlexPageContent style={{ padding: "22px 0 48px" }}>
          {/* STAT KARTLARI */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 13, marginBottom: 18 }}>
            {stats.map((s) => (
              <div key={s.label} style={{ background: "#fff", border: "1px solid #E2E5EA", borderRadius: 14, padding: "15px 16px", boxShadow: "0 1px 3px rgba(15,31,61,.05)" }}>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: "#6F7B87" }}>{s.label}</span>
                <div style={{ fontSize: 25, fontWeight: 800, color: "#1E222B", letterSpacing: "-.6px", marginTop: 10 }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* TOOLBAR */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <button onClick={goPrev} style={navBtnStyle}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg></button>
                <button onClick={goToday} style={{ padding: "0 15px", height: 38, borderRadius: 10, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>Bugün</button>
                <button onClick={goNext} style={navBtnStyle}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg></button>
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#1E222B", letterSpacing: "-.3px", minWidth: 210 }}>{rangeLabel}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ display: "inline-flex", padding: 4, borderRadius: 12, background: "#E4E7EC", gap: 3 }}>
                {viewTabs.map((v) => (
                  <button key={v.key} onClick={() => setView(v.key)} style={{ padding: "8px 17px", borderRadius: 9, border: "none", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", transition: "all .14s", background: view === v.key ? "#fff" : "transparent", color: view === v.key ? "#1E222B" : "#6F7B87", boxShadow: view === v.key ? "0 1px 3px rgba(15,31,61,.12)" : "none" }}>{v.label}</button>
                ))}
              </div>
              <button onClick={() => setFiltersOpen((v) => !v)} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 15px", height: 38, borderRadius: 11, border: "1px solid " + (filtersOpen || activeFilterCount > 0 ? "#92b6e8" : "#E2E5EA"), background: filtersOpen ? "#EFF3FA" : "#fff", color: filtersOpen || activeFilterCount > 0 ? "#205297" : "#414B59", fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
                Filtreler
                {activeFilterCount > 0 && <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999, background: "#2867bd", color: "#fff", fontSize: 10.5, fontWeight: 800 }}>{activeFilterCount}</span>}
              </button>
              <button onClick={openPlan} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 17px", borderRadius: 11, border: "none", background: "linear-gradient(135deg,#FF8D28,#D66500)", color: "#fff", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 8px 18px -8px rgba(214,101,0,.55)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
                Eğitim Planla
              </button>
            </div>
          </div>

          {/* FİLTRE PANELİ */}
          {filtersOpen && (
            <div style={{ background: "#fff", border: "1px solid #E2E5EA", borderRadius: 16, padding: "18px 20px", marginBottom: 16, boxShadow: "0 1px 3px rgba(15,31,61,.05)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 14 }}>
                {[
                  { label: "Eğitmen", value: fEgitmen, set: setFEgitmen, options: ["Tümü", ...instructors.map((i) => i.name)] },
                  { label: "Şube", value: fSube, set: setFSube, options: ["Tümü", ...SUBELER] },
                  { label: "Branş", value: fBrans, set: setFBrans, options: ["Tümü", ...BRANSLAR] },
                  { label: "Eğitim Türü", value: fTur, set: setFTur, options: ["Tümü", "Bireysel", "Kurumsal"] },
                  { label: "Katılım", value: fMode, set: setFMode, options: ["Tümü", "Yüz Yüze", "Online"] },
                  { label: "Durum", value: fDurum, set: setFDurum, options: ["Tümü", "Eğitimde", "Müsait", "Rezerve", "İzin", "Raporlu", "Resmi Tatil"] },
                ].map((f) => (
                  <div key={f.label}>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 7 }}>{f.label}</label>
                    <select value={f.value} onChange={(e) => f.set(e.target.value)} style={{ ...selectStyle, background: "#FBFCFD" }}>
                      {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12, marginTop: 16, paddingTop: 15, borderTop: "1px solid #F2F4F7" }}>
                <button onClick={clearFilters} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 15px", borderRadius: 10, border: "1px solid #E2E5EA", background: "#fff", color: "#6F7B87", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                  Filtreleri Temizle
                </button>
              </div>
            </div>
          )}

          {/* LEGEND */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
            {legend.map((l) => (
              <span key={l.key} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 600, color: "#6F7B87" }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: l.dot }} />{l.label}
              </span>
            ))}
          </div>

          {/* TAKVİM KARTI */}
          <div style={{ background: "#fff", border: "1px solid #E2E5EA", borderRadius: 18, overflow: "hidden", boxShadow: "0 1px 3px rgba(15,31,61,.05)" }}>
            {view === "week" && (
              <div style={{ overflowX: "auto" }}>
                <div style={{ minWidth: 1240 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "210px repeat(7,1fr)", borderBottom: "1px solid #EEF0F3", background: "#FBFCFD" }}>
                    <div style={{ padding: "13px 18px", fontSize: 11.5, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".05em", borderRight: "1px solid #EEF0F3", display: "flex", alignItems: "center" }}>Eğitmen</div>
                    {weekDates.map((d, i) => {
                      const iso = isoDate(d);
                      const isT = iso === todayISO;
                      return (
                        <div key={i} style={{ padding: "10px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, borderLeft: i === 0 ? "none" : "1px solid #F2F4F7", background: isT ? "#EFF5FE" : "transparent" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: isT ? "#2867bd" : "#AEB4C0" }}>{DOW[i]}</span>
                          {isT ? <span style={{ width: 26, height: 26, borderRadius: "50%", background: "#2867bd", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13.5, fontWeight: 800 }}>{d.getDate()}</span> : <span style={{ fontSize: 15, fontWeight: 800, color: "#1E222B" }}>{d.getDate()}</span>}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ maxHeight: 600, overflowY: "auto" }}>
                    {filteredInstructors.map((inst) => (
                      <div key={inst.id} style={{ display: "grid", gridTemplateColumns: "210px repeat(7,1fr)", borderBottom: "1px solid #F2F4F7" }}>
                        <div onClick={() => openInstr(inst.id, isoDate(weekDates.find((d) => isoDate(d) === todayISO) || weekDates[0]))} style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 16px", borderRight: "1px solid #EEF0F3", cursor: "pointer", minWidth: 0, overflow: "hidden" }}>
                          <div style={{ width: 38, height: 38, borderRadius: 11, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13.5, fontWeight: 800, background: `linear-gradient(135deg,${inst.av[0]},${inst.av[1]})` }}>{initials(inst.name)}</div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1E222B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{inst.name}</div>
                            <div style={{ fontSize: 11.5, color: "#8E95A3", fontWeight: 500, whiteSpace: "nowrap" }}>{inst.brans} · {inst.sube}</div>
                          </div>
                        </div>
                        {weekDates.map((d, i) => {
                          const dISO = isoDate(d);
                          const isT = dISO === todayISO;
                          const { dayType, blocks } = blocksFor(inst, dISO);
                          // GERÇEK BUG FIX (2026-07-27, kullanıcı bulgusu): `minWidth: 0` YOKTU —
                          // CSS Grid hücreleri varsayılan `min-width: auto` ile içeriğin (uzun bir
                          // eğitim adı, ör. "Grafik Tasarım Kursu") sarmayan/kırpılmayan doğal
                          // genişliğinin ALTINA küçülmeyi reddediyordu. Her eğitmen SATIRI ayrı bir
                          // grid örneği olduğu için, içeriği daha uzun olan satır (Alparslan) daha
                          // GENİŞ satır oluyordu, kısa içerikli satır (Hasan) ise dar kalıyordu —
                          // sütun sınırları satırlar arasında hizasız görünüyordu ("Salı sağa/sola
                          // kaymış" gibi). `minWidth: 0` ile hücre gerçekten `1fr` payına sıkışıyor,
                          // taşan metin `ellipsis` ile kırpılıyor (çip metninde zaten vardı).
                          const cellStyle: React.CSSProperties = { padding: "10px 10px", borderLeft: i === 0 ? "none" : "1px solid #F2F4F7", minHeight: 92, minWidth: 0, overflow: "hidden", cursor: "pointer", background: isT ? "rgba(40,103,189,.03)" : "transparent" };
                          if (dayType === "izin" || dayType === "rapor" || dayType === "tatil") {
                            const m = BLK[dayType];
                            return (
                              <div key={i} onClick={() => openInstr(inst.id, dISO)} style={cellStyle}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, height: "100%", minHeight: 72, justifyContent: "center", borderRadius: 9, background: m.bg, border: "1px solid " + m.border, color: m.color, fontSize: 12, fontWeight: 700 }}>
                                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: m.dot }} />{m.label}
                                </div>
                              </div>
                            );
                          }
                          const vis = blocks.filter(blockVisible);
                          const chips = vis.slice(0, 3);
                          return (
                            <div key={i} onClick={() => openInstr(inst.id, dISO)} style={cellStyle}>
                              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                {chips.map((b, ci) => {
                                  const m = BLK[b.type];
                                  const label = b.type === "musait" ? "müsait" : b.egitim;
                                  return (
                                    <div key={ci} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 700, color: m.color, background: m.bg, border: "1px solid " + m.border, borderRadius: 6, padding: "3px 6px" }}>
                                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: m.dot, flex: "0 0 auto" }} />
                                      <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{b.type === "musait" ? fmtTime(b.startMin + b.dur) : fmtTime(b.startMin)}</span>
                                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
                                    </div>
                                  );
                                })}
                                {vis.length > 3 && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#8E95A3", paddingLeft: 2 }}>+{vis.length - 3} daha</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {view === "day" && (
              <div style={{ overflowX: "auto" }}>
                <div style={{ minWidth: 1120 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "210px 1fr", borderBottom: "1px solid #EEF0F3", background: "#FBFCFD" }}>
                    <div style={{ padding: "12px 18px", fontSize: 11.5, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".05em", borderRight: "1px solid #EEF0F3", display: "flex", alignItems: "flex-end" }}>Eğitmen</div>
                    <div style={{ position: "relative", height: 38 }}>
                      {axisHours.map((h) => <span key={h.label} style={{ position: "absolute", bottom: 8, left: h.leftPct + "%", transform: "translateX(-50%)", fontSize: 11, fontWeight: 600, color: "#AEB4C0" }}>{h.label}</span>)}
                    </div>
                  </div>
                  <div style={{ maxHeight: 620, overflowY: "auto" }}>
                    {filteredInstructors.map((inst) => {
                      const { dayType, blocks } = blocksFor(inst, dayISO);
                      const vis = blocks.filter(blockVisible);
                      const ders = blocks.filter((b) => b.type === "ders" || b.type === "rezerve");
                      const metaLine = dayType === "izin" ? "İzinli" : dayType === "rapor" ? "Raporlu" : dayType === "tatil" ? "Resmi Tatil" : `${inst.brans} · ${ders.length} ders`;
                      const span = AX_END - AX_START;
                      return (
                        <div key={inst.id} style={{ display: "grid", gridTemplateColumns: "210px 1fr", borderBottom: "1px solid #F2F4F7", minHeight: 78 }}>
                          <div onClick={() => openInstr(inst.id, dayISO)} style={{ display: "flex", alignItems: "center", gap: 11, padding: "0 16px", borderRight: "1px solid #EEF0F3", cursor: "pointer" }}>
                            <div style={{ width: 38, height: 38, borderRadius: 11, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13.5, fontWeight: 800, background: `linear-gradient(135deg,${inst.av[0]},${inst.av[1]})` }}>{initials(inst.name)}</div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1E222B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{inst.name}</div>
                              <div style={{ fontSize: 11.5, color: "#8E95A3", fontWeight: 500, whiteSpace: "nowrap" }}>{metaLine}</div>
                            </div>
                          </div>
                          <div onClick={() => openInstr(inst.id, dayISO)} style={{ position: "relative", height: 78, cursor: "pointer", background: dayType === "tatil" ? "#FBFAFE" : "transparent" }}>
                            {axisHours.map((h) => <div key={h.label} style={{ position: "absolute", top: 0, bottom: 0, left: h.leftPct + "%", width: 1, background: "#F2F4F7" }} />)}
                            {vis.map((b, bi) => {
                              const m = BLK[b.type];
                              const left = ((b.startMin - AX_START) / span) * 100;
                              const width = (b.dur / span) * 100;
                              const isFull = b.type === "izin" || b.type === "rapor" || b.type === "tatil";
                              const isFree = b.type === "musait";
                              let title: string, sub: string, showSub: boolean;
                              if (isFree) { title = "Müsait"; sub = fmtTime(b.startMin) + "–" + fmtTime(b.startMin + b.dur); showSub = width > 10; }
                              else if (isFull) { title = m.label; sub = ""; showSub = false; }
                              else { title = b.egitim || ""; sub = (b.online ? "Online" : b.salon) + " · " + entityOf(b); showSub = width > 14; }
                              const stripe = b.type === "rezerve" ? `repeating-linear-gradient(135deg,${m.bg} 0,${m.bg} 8px,#FBEED6 8px,#FBEED6 14px)` : isFree ? `repeating-linear-gradient(135deg,${m.bg} 0,${m.bg} 9px,#DDF1E6 9px,#DDF1E6 16px)` : m.bg;
                              return (
                                <div key={bi} onClick={(e) => { e.stopPropagation(); openInstr(inst.id, dayISO); }} style={{ position: "absolute", top: 8, bottom: 8, left: `calc(${left}% + 2px)`, width: `calc(${width}% - 4px)`, background: stripe, border: "1px solid " + m.border, borderLeft: "3px solid " + m.dot, borderRadius: 8, padding: "6px 8px", overflow: "hidden", cursor: "pointer", display: "flex", flexDirection: "column", justifyContent: "center", gap: 1, boxShadow: "0 1px 2px rgba(15,31,61,.05)" }}>
                                  <div style={{ fontSize: 10.5, fontWeight: 800, color: m.color, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
                                  {showSub && <div style={{ fontSize: 9.5, fontWeight: 600, color: "#6F7B87", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {view === "month" && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", borderBottom: "1px solid #EEF0F3", background: "#FBFCFD" }}>
                  {DOW.map((d) => <div key={d} style={{ padding: "11px 12px", textAlign: "center", fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: "#8E95A3" }}>{d}</div>)}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gridAutoRows: "minmax(118px,1fr)" }}>
                  {monthCells.map((c, i) => (
                    <div key={i} onClick={() => { setView("day"); setDayISO(c.iso); }} style={{ borderRight: i % 7 === 6 ? "none" : "1px solid #F2F4F7", borderBottom: "1px solid #F2F4F7", padding: "8px 9px", display: "flex", flexDirection: "column", cursor: "pointer", background: c.inMonth ? "#fff" : "#FBFCFD", opacity: c.inMonth ? 1 : 0.55 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        {c.isToday ? <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: "50%", background: "#2867bd", color: "#fff", fontSize: 12.5, fontWeight: 800 }}>{c.num}</span> : <span style={{ fontSize: 13, fontWeight: 700, color: c.inMonth ? "#1E222B" : "#AEB4C0" }}>{c.num}</span>}
                      </div>
                      {c.inMonth && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ flex: 1, height: 7, borderRadius: 999, background: "#EEF0F3", overflow: "hidden" }}>
                              <div style={{ height: "100%", width: c.pct + "%", borderRadius: 999, background: c.pct >= 60 ? "#12A56A" : c.pct >= 30 ? "#E8A20C" : "#D93636" }} />
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 700, color: "#0A6B3F", background: "#E7F6EE", padding: "2px 7px", borderRadius: 6 }}>{c.avail} müsait</span>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 700, color: "#205297", background: "#EAF1FB", padding: "2px 7px", borderRadius: 6 }}>{c.ders} ders</span>
                          </div>
                          {c.leave > 0 && <span style={{ fontSize: 10, fontWeight: 600, color: "#B7791F" }}>{c.leave} izinli/raporlu</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </FlexPageContent>
        <Footer mini containerClassName={FLEX_PAGE_FOOTER_CLASS} />
      </main>

      {/* ====== EĞİTMEN GÜNÜ MODALI ====== */}
      <div onClick={() => setInstrModal(null)} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(15,31,61,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, opacity: instrModal ? 1 : 0, visibility: instrModal ? "visible" : "hidden", transition: "opacity .24s ease, visibility .24s ease" }}>
        <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 860, background: "#fff", borderRadius: 22, boxShadow: "0 30px 80px -20px rgba(15,31,61,.5)", overflow: "hidden", transform: instrModal ? "translateY(0) scale(1)" : "translateY(16px) scale(.98)", opacity: instrModal ? 1 : 0, transition: "transform .3s cubic-bezier(.2,.8,.3,1), opacity .26s ease" }}>
          {instrModalData && (
            <div style={{ display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 48px)" }}>
              <div style={{ padding: "22px 28px", borderBottom: "1px solid #EEF0F3", background: "linear-gradient(120deg,#EAF1FB,#FBFCFD)", flex: "0 0 auto" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
                    <div style={{ width: 54, height: 54, borderRadius: 16, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 19, fontWeight: 800, background: `linear-gradient(135deg,${instrModalData.inst.av[0]},${instrModalData.inst.av[1]})` }}>{initials(instrModalData.inst.name)}</div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#1E222B", letterSpacing: "-.4px" }}>{instrModalData.inst.name}</h3>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700, color: instrModalData.dayChipMeta.color, background: instrModalData.dayChipMeta.bg }}>
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: instrModalData.dayChipMeta.dot }} />{instrModalData.dayStatusLabel}
                        </span>
                      </div>
                      <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6F7B87", fontWeight: 600 }}>{instrModalData.inst.brans} · {instrModalData.inst.sube} · {instrModalData.d.getDate()} {MONTHS[instrModalData.d.getMonth()]} {instrModalData.d.getFullYear()}</p>
                    </div>
                  </div>
                  <button onClick={() => setInstrModal(null)} style={{ width: 38, height: 38, borderRadius: 11, border: "1px solid #DCE3EC", background: "rgba(255,255,255,.85)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6F7B87", flex: "0 0 auto" }}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg></button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 10, marginTop: 18 }}>
                  {[
                    { label: "Ders Sayısı", value: String(instrModalData.ders.length) },
                    { label: "Ders Saati", value: (instrModalData.dersDk / 60).toFixed(instrModalData.dersDk % 60 ? 1 : 0) + " sa" },
                    { label: "Toplam Öğrenci", value: String(instrModalData.ogr) },
                    { label: "Boş Saat", value: (instrModalData.freeDk / 60).toFixed(instrModalData.freeDk % 60 ? 1 : 0) + " sa", tone: "green" as const },
                    { label: "Doluluk", value: "%" + instrModalData.dolulukI },
                    { label: "İzin Durumu", value: instrModalData.dayType === "izin" ? "İzinli" : instrModalData.dayType === "rapor" ? "Raporlu" : instrModalData.dayType === "tatil" ? "Tatil" : "—", tone: (instrModalData.dayType === "izin" || instrModalData.dayType === "rapor") ? "amber" as const : undefined },
                  ].map((m) => {
                    const t = m.tone === "green" ? { lc: "#0A6B3F", vc: "#0A6B3F", bg: "#E7F6EE", bd: "#BFE6D0" } : m.tone === "amber" ? { lc: "#B7791F", vc: "#B7791F", bg: "#FDF4E3", bd: "#F2E0B8" } : { lc: "#8E95A3", vc: "#1E222B", bg: "#F7F8FA", bd: "#EEF0F3" };
                    return (
                      <div key={m.label} style={{ background: t.bg, border: "1px solid " + t.bd, borderRadius: 11, padding: "11px 13px" }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: t.lc }}>{m.label}</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: t.vc, marginTop: 3, letterSpacing: "-.5px" }}>{m.value}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 12 }}>Günlük Program</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {instrModalData.program.length === 0 && <div style={{ fontSize: 13, color: "#8E95A3", fontWeight: 500 }}>Bu gün için program yok.</div>}
                  {instrModalData.program.map((b, bi) => {
                    const m = BLK[b.type];
                    const isDers = b.type === "ders" || b.type === "rezerve";
                    const isFree = b.type === "musait";
                    return (
                      <div key={bi} style={{ display: "flex", alignItems: "flex-start", gap: 13, border: "1px solid " + (isFree ? "#BFE6D0" : m.border), borderRadius: 13, padding: "13px 15px", background: isFree ? "#F3FBF6" : "#fff" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, width: 62, flex: "0 0 auto", borderRadius: 11, padding: "8px 6px", background: m.bg, color: m.color, fontSize: 13.5, fontWeight: 800 }}>
                          {fmtTime(b.startMin)}<span style={{ fontSize: 10, fontWeight: 600, opacity: 0.7 }}>{fmtTime(b.startMin + b.dur)}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 14.5, fontWeight: 800, color: "#1E222B" }}>{isDers ? b.egitim : isFree ? "Müsait Saat" : m.label}</span>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, color: m.color, background: m.bg }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: m.dot }} />{m.label}</span>
                            {isDers && b.tur && <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 9px", borderRadius: 999, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap", color: TUR_META[b.tur].color, background: TUR_META[b.tur].bg }}>{b.tur}</span>}
                          </div>
                          {isDers && (
                            <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 5, flexWrap: "wrap" }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#6F7B87", fontWeight: 600 }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18" /><path d="M5 21V7l8-4v18" /></svg>{b.online ? "Online" : b.salon}</span>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#6F7B87", fontWeight: 600 }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>{entityOf(b)} · {b.ogrenci} kişi</span>
                            </div>
                          )}
                          {isFree && (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 5 }}>
                              <span style={{ fontSize: 12.5, color: "#0A6B3F", fontWeight: 600 }}>Bu aralık boş — {Math.round((b.dur / 60) * 10) / 10} saat müsait</span>
                              <button onClick={() => planFromBlock(instrModalData.iso, b.startMin, instrModalData.inst.brans, instrModalData.inst.id)} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 8, border: "1px solid #BFE6D0", background: "#EAF7F0", color: "#0A6B3F", fontSize: 11.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>Bu saate planla</button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "15px 28px", borderTop: "1px solid #EEF0F3", background: "#FBFCFD", flexWrap: "wrap", flex: "0 0 auto" }}>
                <button onClick={planForInstr} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 18px", borderRadius: 11, border: "none", background: "linear-gradient(135deg,#2867bd,#205297)", color: "#fff", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 8px 18px -8px rgba(32,82,151,.5)" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /><path d="M12 14v4" /><path d="M10 16h4" /></svg>Eğitim Planla</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ====== EĞİTİM PLANLA MODALI (müsait eğitmen önerisi) ====== */}
      <div onClick={() => setPlanOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(15,31,61,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, opacity: planOpen ? 1 : 0, visibility: planOpen ? "visible" : "hidden", transition: "opacity .24s ease, visibility .24s ease" }}>
        <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 640, background: "#fff", borderRadius: 22, boxShadow: "0 30px 80px -20px rgba(15,31,61,.5)", overflow: "hidden", transform: planOpen ? "translateY(0) scale(1)" : "translateY(16px) scale(.98)", opacity: planOpen ? 1 : 0, transition: "transform .3s cubic-bezier(.2,.8,.3,1), opacity .26s ease" }}>
          {planOpen && (
            <div style={{ display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 48px)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, padding: "22px 26px", borderBottom: "1px solid #EEF0F3", flex: "0 0 auto" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,#2867bd,#205297)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", boxShadow: "0 8px 18px -8px rgba(32,82,151,.5)" }}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /><path d="M12 14v4" /><path d="M10 16h4" /></svg></div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: "#1E222B", letterSpacing: "-.3px" }}>Eğitim Planla</h3>
                    <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#8E95A3", fontWeight: 500 }}>Tarih ve saat seçin — sistem yalnızca müsait eğitmenleri önerir.</p>
                  </div>
                </div>
                <button onClick={() => setPlanOpen(false)} style={{ width: 38, height: 38, borderRadius: 11, border: "1px solid #E2E5EA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6F7B87", flex: "0 0 auto" }}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg></button>
              </div>

              <div style={{ padding: "18px 26px", borderBottom: "1px solid #EEF0F3", background: "#FBFCFD", flex: "0 0 auto" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1.2fr", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 7 }}>Tarih</label>
                    <input type="date" value={planDate} onChange={(e) => { setPlanDate(e.target.value); setPlanPick(null); }} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #E2E5EA", background: "#fff", color: "#1E222B", fontSize: 13, fontWeight: 600, fontFamily: "inherit", outline: "none" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 7 }}>Başlangıç</label>
                    <select value={planStart} onChange={(e) => { setPlanStart(parseInt(e.target.value)); setPlanPick(null); }} style={selectStyle}>
                      {startOptions.map((o) => <option key={o} value={o}>{fmtTime(o)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 7 }}>Süre</label>
                    <select value={planDur} onChange={(e) => { setPlanDur(parseInt(e.target.value)); setPlanPick(null); }} style={selectStyle}>
                      {durOptions.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 7 }}>Branş</label>
                    <select value={planBrans} onChange={(e) => { setPlanBrans(e.target.value); setPlanPick(null); }} style={selectStyle}>
                      {["Tümü", ...BRANSLAR].map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 13, fontSize: 12.5, fontWeight: 600, color: "#414B59" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 999, background: "#EAF1FB", color: "#205297", fontWeight: 700 }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>{planSlotLabel}</span>
                  <span style={{ color: "#8E95A3" }}>seçilen zaman aralığı</span>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "18px 26px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".05em" }}>Müsait Eğitmenler</div>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#0A6B3F", background: "#E7F6EE", padding: "3px 11px", borderRadius: 999 }}>{planAvailCount} müsait</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {planCandidates.map((p) => {
                    const picked = planPick === p.inst.id && p.available;
                    return (
                      <div key={p.inst.id} onClick={() => { if (p.available) setPlanPick(p.inst.id); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 13, border: "1.5px solid " + (picked ? "#2867bd" : p.available ? "#E2E5EA" : "#EEF0F3"), background: picked ? "#EFF3FA" : p.available ? "#fff" : "#FBFCFD", opacity: p.available ? 1 : 0.72, cursor: p.available ? "pointer" : "not-allowed" }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontWeight: 800, background: `linear-gradient(135deg,${p.inst.av[0]},${p.inst.av[1]})` }}>{initials(p.inst.name)}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#1E222B" }}>{p.inst.name}</div>
                          <div style={{ fontSize: 12, color: "#8E95A3", fontWeight: 500 }}>{p.inst.brans} · {p.inst.sube}</div>
                        </div>
                        {/* kullanıcının istediği "müsait değilse uyarı" — kırmızı/nötr rozet: yeşil "Müsait" ya da gri "neden dolu" metni */}
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 11px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, color: p.available ? "#0A6B3F" : "#8E95A3", background: p.available ? "#E7F6EE" : "#F0F2F5", whiteSpace: "nowrap" }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: p.available ? "#12A56A" : "#C0C6D0", flex: "0 0 auto" }} />{p.available ? "Müsait" : p.reason}
                        </span>
                        {p.available && (
                          <span style={{ width: 20, height: 20, borderRadius: "50%", flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: picked ? "#2867bd" : "transparent", border: picked ? "none" : "2px solid #CDD2DA" }}>
                            {picked && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 11, padding: "16px 26px", borderTop: "1px solid #EEF0F3", background: "#FBFCFD", flex: "0 0 auto" }}>
                <button onClick={() => setPlanOpen(false)} style={{ padding: "11px 20px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>Vazgeç</button>
                <button
                  // 2026-07-27 kullanıcı kararı: "eğitim planlama ile grup ekleme aslında benzer
                  // şeyler" — bu buton artık ayrı/sahte bir kayıt oluşturmuyor, seçilen müsait
                  // eğitmeni + tarihi GERÇEK "Grup Ekle" formuna (`/flexos/siniflar`) taşıyor.
                  // Saat/süre burada taşınmıyor (Grup Ekle'de saat serbest değil, önceden
                  // tanımlı "Seans" kütüphanesinden seçiliyor — burada seçilen dakika hassasiyeti
                  // orada karşılığı olmayabilir, o yüzden kullanıcı orada Seans'ı kendi seçiyor).
                  onClick={() => { if (planPick != null) router.push(`/flexos/siniflar?trainerId=${encodeURIComponent(planPick)}&tarih=${encodeURIComponent(planDate)}`); }}
                  disabled={planPick == null}
                  style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 20px", borderRadius: 11, border: "none", background: planPick != null ? "linear-gradient(135deg,#2867bd,#205297)" : "#CDD2DA", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: planPick != null ? "pointer" : "not-allowed", boxShadow: planPick != null ? "0 8px 18px -8px rgba(32,82,151,.5)" : "none" }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>Devam Et
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
