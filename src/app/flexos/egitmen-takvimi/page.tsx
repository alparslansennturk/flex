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
 * VERİ — 2026-07-31 TAMAMEN GERÇEK VERİYE BAĞLANDI (önceden "gerçek liste + mock
 * seans" deseniydi, `blocksFor()` deterministik sahte üretimdi — bkz. arşiv/git
 * geçmişi). Artık bir eğitmenin bir gündeki TÜM programı üç gerçek kaynaktan
 * hesaplanıyor:
 * 1. **Ders blokları** — `Group.schedule` (gün/saat/tarih aralığı, `GET /api/flexos/
 *    trainers`'ın zaten döndürdüğü read-time join). Bir grup, o günün ISO haftanın
 *    günü `schedule.days`'te VE tarih `[startDate,endDate]` aralığındaysa "ders" bloğu
 *    üretir — grup kodu/eğitim adı/öğrenci sayısı/gerçek salon (labId→Lab.name) hep
 *    gerçek. **Bilinçli sınır:** tekil gün iptalleri (`lesson-exception-service.ts`)
 *    burada kontrol EDİLMİYOR — o kontrol `groupId+date` başına ayrı bir istek
 *    gerektiriyor (bu takvim onlarca grup×gün'ü aynı anda gösteriyor, N+1'e girmemek
 *    için haftalık düzenli program "kesin doğru" kabul ediliyor; tek seferlik "Ders
 *    Olmadı" işaretlemeleri buraya yansımaz).
 * 2. **Rezerve/müsaitlik blokları** — `Trainer.availability` (haftalık, gün-adı bazlı
 *    dilimler, `dolu:true` = rezerve, aksi = müsait beyanı). Ders bloklarıyla
 *    ÇAKIŞMAYAN, kalan boş zaman otomatik "müsait" sayılır (eski davranışla aynı
 *    varsayım — beyan edilmemiş zaman serbest kabul edilir).
 * 3. **Resmi tatil** — `GET /api/flexos/holidays` + `expandHolidayDates()` (yoklama
 *    modülüyle AYNI fonksiyon, `lib/domain/services/schedule-calc.ts`).
 * **İzin/Raporlu KALDIRILDI** — bunların hiçbir gerçek karşılığı yok (`TrainerLeave`
 * gibi bir domain kavramı YOK), sahte üretmek yerine bilinçli olarak hiç üretilmiyor.
 * `BLK`/legend/filtre seçenekleri (izin/rapor) İLERİDE gerçek bir izin sistemi
 * eklenirse diye dokunulmadan bırakıldı — sadece hiçbir gün bu duruma düşmüyor.
 * **"Katılım" (Online/Yüz Yüze) filtresi KALDIRILDI** — `Group` domain modelinde
 * "online" diye bir alan hiç yok (mock'ta bile firma/online rastgele üretiliyordu,
 * gerçek karşılığı OLMAYACAK bir ayrım), yarı-doğru bir filtre göstermektense
 * kaldırılması tercih edildi.
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
import { toast } from "sonner";
import { expandHolidayDates } from "@/app/lib/domain/services/schedule-calc";
import type { TrainerAvailabilitySlot } from "@/app/lib/domain/core/trainer";

// ── sabitler (tasarımla birebir) ──
const DOW = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const DOW_FULL = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
// 2026-07-27 kullanıcı isteği: eksen 08:00'dan başlıyordu ama gerçek mesai WORK_START
// (09:00) — o 1 saatlik boş/kullanılmayan tampon yatay scroll'a sebep oluyordu ("08:00
// kaldır ya da 09:00 sola çek, yatay scroll olmasın"). Eksen artık WORK_START'la aynı.
const AX_START = 9 * 60, AX_END = 22 * 60;
// 2026-07-27 kullanıcı bulgusu: 09:00/22:00 etiket+bloklar timeline'ın tam kenarına
// yapışıyordu ("sağdan/soldan en az 16px padding olmalı"). Yüzde konumlamayı 0-100%
// yerine [AXIS_PAD, 100%-AXIS_PAD] aralığına sıkıştırıyoruz — absolute-positioned
// elemanlar parent'ın padding'ini otomatik hesaba katmadığı için (containing block =
// padding box, left:0% zaten padding'in İÇİNDE değil dış kenarında), gerçek çözüm
// px+% karışık calc() formülü, sabit bir kaydırma değil.
const AXIS_PAD = 16;
const axisLeft = (pct: number) => `calc(${AXIS_PAD}px + (100% - ${AXIS_PAD * 2}px) * ${pct / 100})`;
const axisWidth = (pct: number) => `calc((100% - ${AXIS_PAD * 2}px) * ${pct / 100})`;
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

/** `TrainerAvailabilitySlot.gun` değerleri — `egitmenler/_shared/types.ts::GUNLER`
 * İLE AYNI olmak ZORUNDA (Eğitmenler sayfası müsaitlik dilimlerini bu string'lerle
 * yazıyor); farklı bir kısaltma seti (ör. "Cmt" yerine "Cts") sessizce hiç eşleşmez. */
const GUNLER = ["Pts", "Sal", "Çar", "Per", "Cum", "Cts", "Paz"];

/** Bir grubun gerçek `GroupSchedule`'ı — `GET /api/flexos/trainers`'ın read-time
 * join'inden geliyor (bkz. `trainers/route.ts`). */
interface InstructorGroupSchedule { days: number[]; startTime?: string; endTime?: string; startDate?: string; endDate?: string }

/** Gerçek `Trainer` kaydından türetilen eğitmen — kimlik (ad/branş/şube) VE program
 * (gruplar + müsaitlik dilimleri) artık TAMAMEN gerçek (2026-07-31). */
interface Instructor {
  id: string; name: string; brans: string; sube: string; av: [string, string];
  /** Bu eğitmene GERÇEKTEN atanmış gruplar — ders bloklarının TEK kaynağı. */
  groups: { kod: string; egitim: string; ogrenci: number; type: string; salon: string; schedule: InstructorGroupSchedule }[];
  /** Haftalık müsaitlik/rezerve beyanı (`Trainer.availability`) — Eğitmenler
   * sayfasındaki AYNI veri, burada da okunuyor. */
  availability: TrainerAvailabilitySlot[];
}

// ── yardımcılar ──
function isoDate(d: Date) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function parseISO(s: string) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
function mondayOf(d: Date) { const x = new Date(d); const k = (x.getDay() + 6) % 7; x.setDate(x.getDate() - k); x.setHours(0, 0, 0, 0); return x; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function fmtTime(m: number) { return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); }
function initials(name: string) { return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toLocaleUpperCase("tr"); }
function entityOf(b: Block) { return b.grup ?? ""; }
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

/** ISO haftanın günü — 0=Pazartesi..6=Pazar. `Group.schedule.days` bu formatta
 * (bkz. `schedule-calc.ts::isoWeekday` — AYNI mantık, domain katmanından bu
 * client dosyasına import edilmiyor, bilinçli tekrar). `mondayOf` de zaten aynı
 * formülü kullanıyor (satır ~106), o yüzden dosya içinde tutarlı. */
function isoWeekday(date: Date): number { return (date.getDay() + 6) % 7; }
/** "HH:MM" → gün içi dakika. Gerçek veri hep iki-nokta-üst-üste formatında
 * (bkz. `GroupFormSheet.tsx::toMin` — AYNI parser, Seans/Group.schedule zaten
 * bu formatta yazılıyor). */
function toMin(t: string): number { const [h, m] = t.split(":").map(Number); return h * 60 + m; }

interface Block { type: BlockType; startMin: number; dur: number; egitim?: string; tur?: string; grup?: string; salon?: string; ogrenci?: number }
type DayType = "kapali" | "tatil" | "izin" | "rapor" | "aktif";

/**
 * Bir eğitmenin bir gündeki TÜM blokları — 2026-07-31'den beri TAMAMEN gerçek
 * veriden hesaplanıyor (bkz. dosya başı doküman yorumu):
 * 1. Resmi tatil → tüm gün "tatil".
 * 2. Ders blokları → `instr.groups[].schedule` (gün/saat/tarih aralığı gerçek).
 * 3. Rezerve blokları → `instr.availability`'de o günün `dolu:true` dilimleri.
 * 4. Kalan boş zaman (ders/rezerve'nin kapsamadığı, WORK_START-WORK_END içindeki
 *    aralıklar) → "müsait" (beyan edilmemiş zaman serbest kabul edilir, eski
 *    davranışla aynı varsayım).
 * İzin/Raporlu ARTIK ÜRETİLMİYOR — gerçek karşılığı yok (bkz. dosya başı yorum).
 */
function blocksFor(instr: Instructor, dateISO: string, holidayDates: Set<string>): { dayType: DayType; blocks: Block[] } {
  if (holidayDates.has(dateISO)) {
    return { dayType: "tatil", blocks: [{ type: "tatil", startMin: WORK_START, dur: WORK_END - WORK_START }] };
  }

  const wd = isoWeekday(parseISO(dateISO));
  const gunAdi = GUNLER[wd];

  const sessions: Block[] = [];
  for (const g of instr.groups) {
    const s = g.schedule;
    if (!s.days.includes(wd) || !s.startTime || !s.endTime) continue;
    if (s.startDate && dateISO < s.startDate) continue;
    if (s.endDate && dateISO > s.endDate) continue;
    const startMin = toMin(s.startTime);
    const dur = toMin(s.endTime) - startMin;
    if (dur <= 0) continue;
    sessions.push({
      type: "ders", startMin, dur, egitim: g.egitim, grup: g.kod, salon: g.salon,
      ogrenci: g.ogrenci, tur: g.type === "kurumsal" ? "Kurumsal" : "Bireysel",
    });
  }
  // Trainer.availability — SADECE `dolu:true` dilimler aktif bir blok üretir (rezerve,
  // içeriği belirsiz — gerçek ders bilgisi yok). `dolu:false/undefined` dilimler zaten
  // "beyan edilmiş müsaitlik" anlamına geliyor, aşağıdaki boşluk-doldurma ile ZATEN
  // müsait sayılıyor, ayrıca bir blok üretmelerine gerek yok.
  for (const slot of instr.availability) {
    if (slot.gun !== gunAdi || !slot.dolu) continue;
    const startMin = toMin(slot.baslangic);
    const dur = toMin(slot.bitis) - startMin;
    if (dur <= 0) continue;
    sessions.push({ type: "rezerve", startMin, dur });
  }

  const busy = sessions.map((s) => ({ s: s.startMin, e: s.startMin + s.dur })).sort((a, b) => a.s - b.s);
  const free: Block[] = [];
  let c = WORK_START;
  busy.forEach((b) => { if (b.s - c >= 15) free.push({ type: "musait", startMin: c, dur: b.s - c }); c = Math.max(c, b.e); });
  if (WORK_END - c >= 15) free.push({ type: "musait", startMin: c, dur: WORK_END - c });
  const blocks = sessions.concat(free).sort((a, b) => a.startMin - b.startMin);
  return { dayType: "aktif", blocks };
}

/** Bir eğitmenin verilen tarih+saat aralığında müsait olup olmadığı — Eğitim
 * Planla modalının kalbi: null=müsait, aksi halde "neden dolu" metni. */
function isBusyAt(instr: Instructor, dateISO: string, startMin: number, endMin: number, holidayDates: Set<string>): string | null {
  const { dayType, blocks } = blocksFor(instr, dateISO, holidayDates);
  if (dayType === "tatil") return "Resmi tatil";
  for (const b of blocks) {
    if (b.type === "musait") continue;
    const be = b.startMin + b.dur;
    if (b.startMin < endMin && startMin < be) {
      return "Dolu · " + fmtTime(b.startMin) + " " + (b.egitim || "rezerve edilmiş");
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

  // ── gerçek eğitmen listesi + program (2026-07-31'den beri TAMAMEN gerçek) ──
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loadingInstructors, setLoadingInstructors] = useState(true);
  /** Resmi tatil günleri — `GET /api/flexos/holidays` + yoklama modülüyle AYNI
   * `expandHolidayDates` (bkz. dosya başı doküman yorumu). */
  const [holidayDates, setHolidayDates] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const u = auth.currentUser;
        const token = u ? await u.getIdToken() : "";
        const headers = { Authorization: `Bearer ${token}` };
        const [res, hRes] = await Promise.all([
          fetch("/api/flexos/trainers", { headers }),
          fetch("/api/flexos/holidays", { headers }),
        ]);
        const json = res.ok ? await res.json() : { items: [], branches: [] };
        // 2026-07-27 eklendi (2. tur — kullanıcı bulgusu: "Finans ve Grafik-1 diye branş yok"):
        // gerçek branş kataloğu — hiç grubu olmayan (dolayısıyla gerçek branşı bulunamayan) bir
        // eğitmene mock branş atanacaksa artık uydurma bir isim (`BRANSLAR`) yerine bu GERÇEK
        // listeden seçilir.
        const realBranches: string[] = json.branches ?? [];
        type ApiTrainer = {
          id: string; name: string; subes: string[]; status: string; comp: Record<string, string[]>;
          musaitlik: TrainerAvailabilitySlot[];
          groups: { kod: string; egitim: string; ogrenci: number; status: string; branch: string; type: string; salon: string; schedule: InstructorGroupSchedule }[];
        };
        // GERÇEK BUG FIX (2026-07-27, kullanıcı bulgusu): API bir eğitmenin TÜM gruplarını
        // (tamamlanmış/arşivlenmiş dahil) veriyor — sadece bunlardan üretilen ders havuzunda
        // kullanılıyorsa, tek/az grubu tamamlanmış bir eğitmen o bitmiş dersle "hâlâ meşgul"
        // gösteriliyordu. Sadece hâlâ AÇIK/DEVAM EDEN gruplar havuza giriyor.
        const AKTIF_GRUP_DURUM = new Set(["planned", "enrolling", "active", "postponed"]);
        const mapped: Instructor[] = (json.items ?? [])
          .filter((t: ApiTrainer) => t.status === "aktif")
          .map((t: ApiTrainer) => {
            // GERÇEK BUG FIX (2026-07-27, kullanıcı bulgusu: "Tasarım diye branş seçtim,
            // Alparslan Şentürk listede kalmadı — Grafik Tasarım diye branş var ama Tasarım
            // yok"): `trainer.comp` anahtarları (Design/Finance/Software) Eğitmenler CRUD'un
            // KENDİ kategorileri, gerçek branş taksonomisiyle (Grafik Tasarım, Yazılım
            // Geliştirme...) ilgisi yok. Gerçek branş, eğitmenin atandığı grupların gerçek
            // `Group.branch` alanından geliyor (herhangi bir grubu — sadece açık olanlar değil,
            // branş kimliği zaman içinde değişmez). Hiç atanmış grubu yoksa mock'a düşer.
            const realBranch = (t.groups ?? []).map((g) => g.branch).find((b) => b);
            const brans = realBranch ?? (realBranches.length ? realBranches[hashSeed(t.id) % realBranches.length] : BRANSLAR[hashSeed(t.id) % BRANSLAR.length]);
            const sube = t.subes?.[0] ?? SUBELER[hashSeed(t.id) % SUBELER.length];
            const acikGruplar = (t.groups ?? []).filter((g) => AKTIF_GRUP_DURUM.has(g.status));
            return { id: t.id, name: t.name, brans, sube, av: avatarFor(t.id), groups: acikGruplar, availability: t.musaitlik ?? [] };
          });
        if (!cancelled) setInstructors(mapped);
        if (hRes.ok) {
          const h = await hRes.json();
          if (!cancelled) setHolidayDates(expandHolidayDates((h.items ?? []) as { startDate: string; endDate: string }[]));
        }
      } catch {
        if (!cancelled) toast.error("Eğitmen listesi yüklenemedi.");
      } finally {
        if (!cancelled) setLoadingInstructors(false);
      }
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
  const clearFilters = () => { setFEgitmen("Tümü"); setFSube("Tümü"); setFBrans("Tümü"); setFTur("Tümü"); setFDurum("Tümü"); };
  const openInstr = (id: string, iso: string) => setInstrModal({ id, iso });
  const openPlan = () => { setPlanOpen(true); setPlanPick(null); };
  const planForInstr = () => {
    if (!instrModal) return;
    const inst = instructors.find((x) => x.id === instrModal.id);
    setInstrModal(null); setPlanOpen(true); setPlanDate(instrModal.iso); setPlanBrans(inst ? inst.brans : "Tümü"); setPlanPick(instrModal.id);
  };
  const planFromBlock = (iso: string, startMin: number, brans: string, instId: string) => { setInstrModal(null); setPlanOpen(true); setPlanDate(iso); setPlanStart(startMin); setPlanBrans(brans); setPlanPick(instId); };

  // GERÇEK BUG FIX (2026-07-27): filtre/planla dropdown'ları sabit mock `BRANSLAR` listesini
  // (Yazılım/Tasarım/Finans/Pazarlama/Dil) gösteriyordu — gerçek branş adları (Grafik Tasarım
  // gibi) o listede yok, seçilince kimse eşleşmiyordu. Artık listedeki eğitmenlerin GERÇEK
  // `brans` değerlerinden (yukarıda türetilen) türetiliyor, hep en az bir eşleşme garanti.
  const branslarOptions = useMemo(() => Array.from(new Set(instructors.map((i) => i.brans))).sort((a, b) => a.localeCompare(b, "tr")), [instructors]);

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
    } else {
      if (fTur !== "Tümü") return false;
    }
    return true;
  };

  const activeFilterCount = [fEgitmen, fSube, fBrans, fTur, fDurum].filter((x) => x !== "Tümü").length;

  // ---- stat kartları (bugün anlık durumu) ----
  const stats = useMemo(() => {
    let musaitCount = 0, dersVeren = 0, izinli = 0, toplamDersDk = 0, aktif = 0, capDen = 0, capNum = 0;
    instructors.forEach((i) => {
      const { dayType, blocks } = blocksFor(i, todayISO, holidayDates);
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
  }, [instructors, todayISO, holidayDates]);

  // ---- Hafta ----
  const weekMon = useMemo(() => addDays(mondayOf(TODAY), weekOffset * 7), [TODAY, weekOffset]);
  // 2026-07-27 kullanıcı düzeltmesi: Pazar dahil 7 gün (eskiden Pzt-Cmt 6 gün varsayılmıştı —
  // "Pazar günü de çalışılıyor, dersler var" bulgusu).
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekMon, i)), [weekMon]);

  // ---- Gün ----
  const dayD = parseISO(dayISO);
  const axisHours = useMemo(() => { const out: { label: string; leftPct: number }[] = []; for (let h = 9; h <= 22; h++) out.push({ label: String(h).padStart(2, "0"), leftPct: ((h * 60 - AX_START) / (AX_END - AX_START)) * 100 }); return out; }, []);

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
        const { dayType, blocks } = blocksFor(inst, dISO, holidayDates);
        if (dayType === "izin" || dayType === "rapor") { leave++; return; }
        if (dayType === "tatil") return;
        activeN++;
        if (blocks.some((b) => b.type === "musait")) avail++;
        ders += blocks.filter((b) => b.type === "ders" || b.type === "rezerve").length;
      });
      out.push({ iso: dISO, num: d.getDate(), inMonth, isToday: dISO === todayISO, avail, ders, leave, pct: activeN ? Math.round((avail / activeN) * 100) : 0 });
    }
    return out;
  }, [instructors, monthStart, monthBase, todayISO, holidayDates]);

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
    const { dayType, blocks } = blocksFor(inst, iso, holidayDates);
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
  }, [instructors, instrModal, holidayDates]);

  // ---- Eğitim Planla modalı verisi ----
  const startOptions = useMemo(() => { const out: number[] = []; for (let m = WORK_START; m <= LATEST_START; m += 30) out.push(m); return out; }, []);
  const durOptions = [{ v: 60, l: "1 saat" }, { v: 90, l: "1.5 saat" }, { v: 120, l: "2 saat" }, { v: 150, l: "2.5 saat" }, { v: 180, l: "3 saat" }];
  const slotEnd = planStart + planDur;
  const planD = parseISO(planDate);
  const planSlotLabel = `${planD.getDate()} ${MONTHS[planD.getMonth()]}, ${fmtTime(planStart)}–${fmtTime(slotEnd)}`;
  const planCandidates = useMemo(() => instructors.filter((i) => planBrans === "Tümü" || i.brans === planBrans).map((inst) => {
    const reason = isBusyAt(inst, planDate, planStart, slotEnd, holidayDates);
    return { inst, available: reason === null, reason };
  }), [instructors, planBrans, planDate, planStart, slotEnd, holidayDates]);
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
        {/* 2026-07-27 kullanıcı isteği: 1440x900'e mümkün olduğunca tek ekranda sığsın diye
            dikey boşluklar hafifçe sıkılaştırıldı (22→16, 18→12, 14→10). */}
        <FlexPageContent style={{ padding: "16px 0 32px" }}>
          {/* STAT KARTLARI */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 13, marginBottom: 12 }}>
            {stats.map((s) => (
              <div key={s.label} style={{ background: "#fff", border: "1px solid #E2E5EA", borderRadius: 14, padding: "11px 14px", boxShadow: "0 1px 3px rgba(15,31,61,.05)" }}>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: "#6F7B87" }}>{s.label}</span>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#1E222B", letterSpacing: "-.6px", marginTop: 6 }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* TOOLBAR */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <button type="button" onClick={goPrev} style={navBtnStyle}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg></button>
                <button type="button" onClick={goToday} style={{ padding: "0 15px", height: 38, borderRadius: 10, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>Bugün</button>
                <button type="button" onClick={goNext} style={navBtnStyle}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg></button>
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#1E222B", letterSpacing: "-.3px", minWidth: 210 }}>{rangeLabel}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ display: "inline-flex", padding: 4, borderRadius: 12, background: "#E4E7EC", gap: 3 }}>
                {viewTabs.map((v) => (
                  <button type="button" key={v.key} onClick={() => setView(v.key)} style={{ padding: "8px 17px", borderRadius: 9, border: "none", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", transition: "all .14s", background: view === v.key ? "#fff" : "transparent", color: view === v.key ? "#1E222B" : "#6F7B87", boxShadow: view === v.key ? "0 1px 3px rgba(15,31,61,.12)" : "none" }}>{v.label}</button>
                ))}
              </div>
              <button type="button" onClick={() => setFiltersOpen((v) => !v)} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 15px", height: 38, borderRadius: 11, border: "1px solid " + (filtersOpen || activeFilterCount > 0 ? "#92b6e8" : "#E2E5EA"), background: filtersOpen ? "#EFF3FA" : "#fff", color: filtersOpen || activeFilterCount > 0 ? "#205297" : "#414B59", fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
                Filtreler
                {activeFilterCount > 0 && <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999, background: "#2867bd", color: "#fff", fontSize: 10.5, fontWeight: 800 }}>{activeFilterCount}</span>}
              </button>
              <button type="button" onClick={openPlan} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 17px", borderRadius: 11, border: "none", background: "linear-gradient(135deg,#FF8D28,#D66500)", color: "#fff", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 8px 18px -8px rgba(214,101,0,.55)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
                Eğitim Planla
              </button>
            </div>
          </div>

          {/* FİLTRE PANELİ */}
          {filtersOpen && (
            <div style={{ background: "#fff", border: "1px solid #E2E5EA", borderRadius: 16, padding: "18px 20px", marginBottom: 16, boxShadow: "0 1px 3px rgba(15,31,61,.05)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14 }}>
                {[
                  { label: "Eğitmen", value: fEgitmen, set: setFEgitmen, options: ["Tümü", ...instructors.map((i) => i.name)] },
                  { label: "Şube", value: fSube, set: setFSube, options: ["Tümü", ...SUBELER] },
                  { label: "Branş", value: fBrans, set: setFBrans, options: ["Tümü", ...branslarOptions] },
                  { label: "Eğitim Türü", value: fTur, set: setFTur, options: ["Tümü", "Bireysel", "Kurumsal"] },
                  { label: "Durum", value: fDurum, set: setFDurum, options: ["Tümü", "Eğitimde", "Müsait", "Rezerve", "İzin", "Raporlu", "Resmi Tatil"] },
                ].map((f) => (
                  <div key={f.label}>
                    <label htmlFor="value" style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 7 }}>{f.label}</label>
                    <select id="value" value={f.value} onChange={(e) => f.set(e.target.value)} style={{ ...selectStyle, background: "#FBFCFD" }}>
                      {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12, marginTop: 16, paddingTop: 15, borderTop: "1px solid #F2F4F7" }}>
                <button type="button" onClick={clearFilters} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 15px", borderRadius: 10, border: "1px solid #E2E5EA", background: "#fff", color: "#6F7B87", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                  Filtreleri Temizle
                </button>
              </div>
            </div>
          )}

          {/* LEGEND */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 10 }}>
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
                  {/* 2026-07-27 kullanıcı bulgusu: burada AYRICA `maxHeight+overflowY:auto` vardı —
                      sayfanın kendisi (`<main>`) zaten scroll ediyor, ikisi üst üste binip "2 scroll"
                      görünümü oluşturuyordu. Kaldırıldı, tek (sayfa seviyesi) scroll'a bırakıldı. */}
                  <div>
                    {filteredInstructors.map((inst) => (
                      <div key={inst.id} style={{ display: "grid", gridTemplateColumns: "210px repeat(7,1fr)", borderBottom: "1px solid #F2F4F7" }}>
                        <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }} onClick={() => openInstr(inst.id, isoDate(weekDates.find((d) => isoDate(d) === todayISO) || weekDates[0]))} style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 16px", borderRight: "1px solid #EEF0F3", cursor: "pointer", minWidth: 0, overflow: "hidden" }}>
                          <div style={{ width: 38, height: 38, borderRadius: 11, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13.5, fontWeight: 800, background: `linear-gradient(135deg,${inst.av[0]},${inst.av[1]})` }}>{initials(inst.name)}</div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1E222B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{inst.name}</div>
                            <div style={{ fontSize: 11.5, color: "#8E95A3", fontWeight: 500, whiteSpace: "nowrap" }}>{inst.brans} · {inst.sube}</div>
                          </div>
                        </div>
                        {weekDates.map((d, i) => {
                          const dISO = isoDate(d);
                          const isT = dISO === todayISO;
                          const { dayType, blocks } = blocksFor(inst, dISO, holidayDates);
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
                              <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }} key={i} onClick={() => openInstr(inst.id, dISO)} style={cellStyle}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, height: "100%", minHeight: 72, justifyContent: "center", borderRadius: 9, background: m.bg, border: "1px solid " + m.border, color: m.color, fontSize: 12, fontWeight: 700 }}>
                                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: m.dot }} />{m.label}
                                </div>
                              </div>
                            );
                          }
                          const vis = blocks.filter(blockVisible);
                          const chips = vis.slice(0, 3);
                          return (
                            <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }} key={i} onClick={() => openInstr(inst.id, dISO)} style={cellStyle}>
                              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                {chips.map((b, ci) => {
                                  const m = BLK[b.type];
                                  const label = b.type === "musait" ? "müsait" : (b.egitim || m.label);
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
              // 2026-07-27 kullanıcı düzeltmesi: sabit piksel `minWidth` (1120, sonra 1040) YİNE
              // BİR TAHMİNDİ — ekseni zaten yüzdeyle (`left:%`) konumlanıyor, sabit bir piksel
              // genişlik VERMEYE hiç gerek yok. `overflowX:auto` + `minWidth` sarmalayıcısı TAMAMEN
              // kaldırıldı — grid artık kartın o an ne kadar genişse ONA (100%) sığıyor, hangi
              // ekran boyutunda olursa olsun tam oturuyor, tahmine/piksel ayarına gerek kalmadı.
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "210px 1fr", borderBottom: "1px solid #EEF0F3", background: "#FBFCFD" }}>
                  <div style={{ padding: "12px 18px", fontSize: 11.5, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".05em", borderRight: "1px solid #EEF0F3", display: "flex", alignItems: "flex-end" }}>Eğitmen</div>
                  <div style={{ position: "relative", height: 38 }}>
                    {axisHours.map((h) => <span key={h.label} style={{ position: "absolute", bottom: 8, left: axisLeft(h.leftPct), transform: "translateX(-50%)", fontSize: 11, fontWeight: 600, color: "#AEB4C0" }}>{h.label}</span>)}
                  </div>
                </div>
                {/* aynı çift-scroll düzeltmesi (bkz. Hafta görünümündeki AYNI not) */}
                <div>
                  {filteredInstructors.map((inst) => {
                      const { dayType, blocks } = blocksFor(inst, dayISO, holidayDates);
                      const vis = blocks.filter(blockVisible);
                      const ders = blocks.filter((b) => b.type === "ders" || b.type === "rezerve");
                      const metaLine = dayType === "izin" ? "İzinli" : dayType === "rapor" ? "Raporlu" : dayType === "tatil" ? "Resmi Tatil" : `${inst.brans} · ${ders.length} ders`;
                      const span = AX_END - AX_START;
                      return (
                        <div key={inst.id} style={{ display: "grid", gridTemplateColumns: "210px 1fr", borderBottom: "1px solid #F2F4F7", minHeight: 78 }}>
                          <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }} onClick={() => openInstr(inst.id, dayISO)} style={{ display: "flex", alignItems: "center", gap: 11, padding: "0 16px", borderRight: "1px solid #EEF0F3", cursor: "pointer" }}>
                            <div style={{ width: 38, height: 38, borderRadius: 11, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13.5, fontWeight: 800, background: `linear-gradient(135deg,${inst.av[0]},${inst.av[1]})` }}>{initials(inst.name)}</div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1E222B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{inst.name}</div>
                              <div style={{ fontSize: 11.5, color: "#8E95A3", fontWeight: 500, whiteSpace: "nowrap" }}>{metaLine}</div>
                            </div>
                          </div>
                          <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }} onClick={() => openInstr(inst.id, dayISO)} style={{ position: "relative", height: 78, cursor: "pointer", background: dayType === "tatil" ? "#FBFAFE" : "transparent" }}>
                            {axisHours.map((h) => <div key={h.label} style={{ position: "absolute", top: 0, bottom: 0, left: axisLeft(h.leftPct), width: 1, background: "#F2F4F7" }} />)}
                            {vis.map((b, bi) => {
                              const m = BLK[b.type];
                              const leftPct = ((b.startMin - AX_START) / span) * 100;
                              const widthPct = (b.dur / span) * 100;
                              const left = axisLeft(leftPct);
                              const width = axisWidth(widthPct);
                              const isFull = b.type === "izin" || b.type === "rapor" || b.type === "tatil";
                              const isFree = b.type === "musait";
                              let title: string, sub: string, showSub: boolean;
                              if (isFree) { title = "Müsait"; sub = fmtTime(b.startMin) + "–" + fmtTime(b.startMin + b.dur); showSub = widthPct > 10; }
                              else if (isFull) { title = m.label; sub = ""; showSub = false; }
                              else {
                                title = b.egitim || m.label;
                                sub = b.grup ? (b.salon || "Salon atanmamış") + " · " + entityOf(b) : "";
                                showSub = widthPct > 14 && !!b.grup;
                              }
                              const stripe = b.type === "rezerve" ? `repeating-linear-gradient(135deg,${m.bg} 0,${m.bg} 8px,#FBEED6 8px,#FBEED6 14px)` : isFree ? `repeating-linear-gradient(135deg,${m.bg} 0,${m.bg} 9px,#DDF1E6 9px,#DDF1E6 16px)` : m.bg;
                              return (
                                <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }} key={bi} onClick={(e) => { e.stopPropagation(); openInstr(inst.id, dayISO); }} style={{ position: "absolute", top: 8, bottom: 8, left: `calc(${left} + 2px)`, width: `calc(${width} - 4px)`, background: stripe, border: "1px solid " + m.border, borderLeft: "3px solid " + m.dot, borderRadius: 8, padding: "6px 8px", overflow: "hidden", cursor: "pointer", display: "flex", flexDirection: "column", justifyContent: "center", gap: 1, boxShadow: "0 1px 2px rgba(15,31,61,.05)" }}>
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
            )}

            {view === "month" && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", borderBottom: "1px solid #EEF0F3", background: "#FBFCFD" }}>
                  {DOW.map((d) => <div key={d} style={{ padding: "11px 12px", textAlign: "center", fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: "#8E95A3" }}>{d}</div>)}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gridAutoRows: "minmax(118px,1fr)" }}>
                  {monthCells.map((c, i) => (
                    <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }} key={i} onClick={() => { setView("day"); setDayISO(c.iso); }} style={{ borderRight: i % 7 === 6 ? "none" : "1px solid #F2F4F7", borderBottom: "1px solid #F2F4F7", padding: "8px 9px", display: "flex", flexDirection: "column", cursor: "pointer", background: c.inMonth ? "#fff" : "#FBFCFD", opacity: c.inMonth ? 1 : 0.55 }}>
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
      <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }} onClick={() => setInstrModal(null)} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(15,31,61,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, opacity: instrModal ? 1 : 0, visibility: instrModal ? "visible" : "hidden", transition: "opacity .24s ease, visibility .24s ease" }}>
        <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }} onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 860, background: "#fff", borderRadius: 22, boxShadow: "0 30px 80px -20px rgba(15,31,61,.5)", overflow: "hidden", transform: instrModal ? "translateY(0) scale(1)" : "translateY(16px) scale(.98)", opacity: instrModal ? 1 : 0, transition: "transform .3s cubic-bezier(.2,.8,.3,1), opacity .26s ease" }}>
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
                  <button type="button" onClick={() => setInstrModal(null)} style={{ width: 38, height: 38, borderRadius: 11, border: "1px solid #DCE3EC", background: "rgba(255,255,255,.85)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6F7B87", flex: "0 0 auto" }}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg></button>
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
                    const hasLesson = isDers && !!b.grup;
                    return (
                      <div key={bi} style={{ display: "flex", alignItems: "flex-start", gap: 13, border: "1px solid " + (isFree ? "#BFE6D0" : m.border), borderRadius: 13, padding: "13px 15px", background: isFree ? "#F3FBF6" : "#fff" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, width: 62, flex: "0 0 auto", borderRadius: 11, padding: "8px 6px", background: m.bg, color: m.color, fontSize: 13.5, fontWeight: 800 }}>
                          {fmtTime(b.startMin)}<span style={{ fontSize: 10, fontWeight: 600, opacity: 0.7 }}>{fmtTime(b.startMin + b.dur)}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 14.5, fontWeight: 800, color: "#1E222B" }}>{isDers ? (b.egitim || m.label) : isFree ? "Müsait Saat" : m.label}</span>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, color: m.color, background: m.bg }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: m.dot }} />{m.label}</span>
                            {hasLesson && b.tur && <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 9px", borderRadius: 999, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap", color: TUR_META[b.tur].color, background: TUR_META[b.tur].bg }}>{b.tur}</span>}
                          </div>
                          {hasLesson && (
                            <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 5, flexWrap: "wrap" }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#6F7B87", fontWeight: 600 }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18" /><path d="M5 21V7l8-4v18" /></svg>{b.salon || "Salon atanmamış"}</span>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#6F7B87", fontWeight: 600 }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>{entityOf(b)} · {b.ogrenci} kişi</span>
                            </div>
                          )}
                          {isFree && (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 5 }}>
                              <span style={{ fontSize: 12.5, color: "#0A6B3F", fontWeight: 600 }}>Bu aralık boş — {Math.round((b.dur / 60) * 10) / 10} saat müsait</span>
                              <button type="button" onClick={() => planFromBlock(instrModalData.iso, b.startMin, instrModalData.inst.brans, instrModalData.inst.id)} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 8, border: "1px solid #BFE6D0", background: "#EAF7F0", color: "#0A6B3F", fontSize: 11.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>Bu saate planla</button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "15px 28px", borderTop: "1px solid #EEF0F3", background: "#FBFCFD", flexWrap: "wrap", flex: "0 0 auto" }}>
                <button type="button" onClick={planForInstr} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 18px", borderRadius: 11, border: "none", background: "linear-gradient(135deg,#2867bd,#205297)", color: "#fff", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 8px 18px -8px rgba(32,82,151,.5)" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /><path d="M12 14v4" /><path d="M10 16h4" /></svg>Eğitim Planla</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ====== EĞİTİM PLANLA MODALI (müsait eğitmen önerisi) ====== */}
      <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }} onClick={() => setPlanOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(15,31,61,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, opacity: planOpen ? 1 : 0, visibility: planOpen ? "visible" : "hidden", transition: "opacity .24s ease, visibility .24s ease" }}>
        <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }} onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 640, background: "#fff", borderRadius: 22, boxShadow: "0 30px 80px -20px rgba(15,31,61,.5)", overflow: "hidden", transform: planOpen ? "translateY(0) scale(1)" : "translateY(16px) scale(.98)", opacity: planOpen ? 1 : 0, transition: "transform .3s cubic-bezier(.2,.8,.3,1), opacity .26s ease" }}>
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
                <button type="button" onClick={() => setPlanOpen(false)} style={{ width: 38, height: 38, borderRadius: 11, border: "1px solid #E2E5EA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6F7B87", flex: "0 0 auto" }}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg></button>
              </div>

              <div style={{ padding: "18px 26px", borderBottom: "1px solid #EEF0F3", background: "#FBFCFD", flex: "0 0 auto" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1.2fr", gap: 12 }}>
                  <div>
                    <label htmlFor="planDate" style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 7 }}>Tarih</label>
                    <input id="planDate" type="date" value={planDate} onChange={(e) => { setPlanDate(e.target.value); setPlanPick(null); }} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #E2E5EA", background: "#fff", color: "#1E222B", fontSize: 13, fontWeight: 600, fontFamily: "inherit", outline: "none" }} />
                  </div>
                  <div>
                    <label htmlFor="planStart" style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 7 }}>Başlangıç</label>
                    <select id="planStart" value={planStart} onChange={(e) => { setPlanStart(Number.parseInt(e.target.value)); setPlanPick(null); }} style={selectStyle}>
                      {startOptions.map((o) => <option key={o} value={o}>{fmtTime(o)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="planDur" style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 7 }}>Süre</label>
                    <select id="planDur" value={planDur} onChange={(e) => { setPlanDur(Number.parseInt(e.target.value)); setPlanPick(null); }} style={selectStyle}>
                      {durOptions.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="planBrans" style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 7 }}>Branş</label>
                    <select id="planBrans" value={planBrans} onChange={(e) => { setPlanBrans(e.target.value); setPlanPick(null); }} style={selectStyle}>
                      {["Tümü", ...branslarOptions].map((o) => <option key={o} value={o}>{o}</option>)}
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
                      <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }} key={p.inst.id} onClick={() => { if (p.available) setPlanPick(p.inst.id); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 13, border: "1.5px solid " + (picked ? "#2867bd" : p.available ? "#E2E5EA" : "#EEF0F3"), background: picked ? "#EFF3FA" : p.available ? "#fff" : "#FBFCFD", opacity: p.available ? 1 : 0.72, cursor: p.available ? "pointer" : "not-allowed" }}>
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
                <button type="button" onClick={() => setPlanOpen(false)} style={{ padding: "11px 20px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>Vazgeç</button>
                <button type="button"
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
