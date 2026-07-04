"use client";

/**
 * FlexOS · Satış çalışanının ANA SAYFASI (menü öğesi değil — Ana Sayfa'nın
 * sale.create paketine düşen hedefi, bkz. FlexSidebar "Ana Sayfa" routing).
 * Tasarım: Claude Design "Satış Dashboard.dc.html" portlandı (demo veri → gerçek uçlar).
 * Donut (bu ayki aktif satış branş dağılımı) + hızlı aksiyon kartları (Satış Yap/Satış Listesi)
 * + Aktif Satışlar havuzu (son 3 satış) + Bugünkü Randevular + Canlı Aktivite Akışı.
 * Ödeme durumu rozeti burada YOK (karar 2026-06-29: ödeme rozeti yalnız Finans modülünde).
 */

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { auth } from "@/app/lib/firebase";
import FlexSidebar from "../../_components/FlexSidebar";
import FlexHeader, { FLEX_CONTENT_MAX_WIDTH } from "../../_components/FlexHeader";
import Footer from "@/app/components/layout/Footer";
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

// ── types (API şekilleri) ──
interface SaleItem {
  id: string;
  date: string;
  studentName: string;
  educationName: string;
  branchName: string;
  soldPrice: number;
  status: "active" | "cancelled";
  createdAt?: string;
}

interface AppointmentItem {
  id: string;
  caseId: string;
  personName: string;
  scheduledAt: string;
  note: string | null;
  status: "bekliyor" | "gerceklesti" | "iptal";
}

type ActivityType = "arama" | "mesaj" | "randevu" | "not" | "satis_donusumu";

interface ActivityItem {
  id: string;
  caseId: string;
  personName: string;
  type: ActivityType;
  note: string | null;
  createdAt: string;
}

interface BranchDoc { id: string; name: string; order?: number }

interface DonutLegendItem {
  label: string;
  count: number;
  pct: number;
  color: string;
  detail?: Array<{ label: string; count: number; pct: number }>;
  muted?: boolean;
}

const DONUT_MIN_CARDS = 4; // her zaman 2 üst 2 alt (kullanıcı kararı 2026-07-03: donuta dokunma, Satış Kotası kartı ayrı bir satıra — aksiyon kartları satırına — eklenecek)
// Branş havuzu henüz DONUT_MIN_CARDS kadar dolmadığında (kullanıcı kararı 2026-07-03) geçici
// dummy isimlerle tamamlanır — kataloğa gerçek branş eklendikçe bunların yerini otomatik alır.
const DONUT_DUMMY_BRANCHES = ["Dijital Pazarlama", "Fotoğrafçılık", "Muhasebe ve Finans", "İngilizce", "Sistem Uzmanlığı", "Robotik ve Kodlama"];

// Gerçek kota/hedef backend'i yok (ayrı iş kalemi) — dummy TL hedefi, kullanıcı onayıyla (2026-07-03).
// Gerçekleşen artık GERÇEK satış verisinden hesaplanıyor (bkz. `kota` useMemo).
// 500.000'den 1.500.000'e çıkarıldı: demo seed'in gerçek toplam hacmi (~1.3-1.4M TL, ~50 satış)
// eski hedefin çok üzerindeydi, bu da kesikli hedef çizgisini grafiğin dibine sıkıştırıp
// kıyaslamayı anlamsızlaştırıyordu (kullanıcı fark etti).
const SATIS_KOTASI_HEDEF_TL = 1500000;
const ACTION_ROW_COMPACT_BREAKPOINT = "(max-width: 1600px)"; // altında 3'lü aksiyon kartı satırı daha az iç boşlukla "dik" durmasın

const DONUT_PALETTE = ["#3A7BD5", "#FF8D28", "#009F3E", "#7C3AED", "#F91079", "#0E5D59"];
const DONUT_TOP_N = 6; // en çok satan 6 branş ayrı gösterilir — gerisi "Diğer"ye toplanır (hover'da popup)
const DONUT_OTHER_COLOR = "#94A3B8";
const APPT_ROW_HEIGHT = 56; // her randevu satırının SABİT yüksekliği (tahmini değil — container maxHeight bundan hesaplanır)
const APPT_ROW_GAP = 8;
const APPT_VISIBLE_ROWS_NARROW = 4; // <=1600px: tam olarak bu kadarı sığar, fazlası kaydırılır
const APPT_VISIBLE_ROWS_WIDE = 5; // >1600px: kartta ekstra dikey alan var, 5. randevu da sığar
const APPT_LIST_PAD = 24; // listenin üst/alt iç boşluğu (kartın kendisi değil, sadece randevu alanı)
const AV_PALETTES: Array<[string, string]> = [
  ["#689adf", "#2867bd"], ["#F76FA3", "#F91079"], ["#67B5B6", "#1CB5AE"],
  ["#FFA352", "#FF7800"], ["#8B91E6", "#4D52A6"],
];

const ACTIVITY_META: Record<ActivityType, { bg: string; color: string; label: string; icon: string }> = {
  arama: {
    bg: "#DDE8F8", color: "#205297", label: "Arama",
    icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 11.97 19.79 19.79 0 0 1 1.62 3.36 2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
  },
  mesaj: {
    bg: "#AFF3F0", color: "#0E5D59", label: "Mesaj",
    icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z"/><polyline points="14,2 14,8 20,8"/></svg>',
  },
  randevu: {
    bg: "#DDE0FA", color: "#4D52A6", label: "Randevu Oluşturuldu",
    icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>',
  },
  not: {
    bg: "#F2F4F7", color: "#6F7B87", label: "Not Eklendi",
    icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  },
  satis_donusumu: {
    bg: "#E6F5ED", color: "#007A30", label: "Satışa Dönüştü",
    icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>',
  },
};

function fmtTL(n: number): string {
  return new Intl.NumberFormat("tr-TR").format(Math.round(n)) + " TL";
}

// Donut halkası ile ortasındaki sayının TEK bir saatten (0→1 progress) beslenmesi için —
// Recharts'ın kendi iç animasyonuyla bizim ayrı bir sayaç animasyonumuzu senkronlamaya
// çalışmak (onAnimationStart callback'i denendi) güvenilir olmadı: ikisi ayrı zamanlayıcı
// olduğu için sayaç halkadan önce/sonra bitebiliyordu. Artık Pie'ın kendi animasyonu KAPALI
// (isAnimationActive=false), açısı da bu progress'ten hesaplanıyor — matematiksel olarak
// aynı anda hareket etmek zorundalar.
// `active=false` iken saat HİÇ ÇALIŞMAZ (erken return) — ilk versiyonda saat mount anında
// (sayfa henüz "boş" render olurken, initialLoadDone=false iken) çalışmaya başlıyordu; veri
// yüklenmesi 800ms'den uzun sürünce saat arka planda tamamlanıp progress=1'de kalıyor, içerik
// gerçekten görününce animasyon oynamadan "bitmiş" görünüyordu (kullanıcı fark etti).
function useAnimProgress(active: boolean, duration = 800): number {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf: number;
    const start = performance.now();
    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      setProgress(1 - Math.pow(1 - t, 3)); // ease-out cubic
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, duration]);
  return progress;
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toLocaleUpperCase("tr");
}

function isThisMonth(dateStr: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function isToday(iso: string): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "--:--";
  return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

function relTime(iso: string): string {
  const d = new Date(iso).getTime();
  if (isNaN(d)) return "";
  const diffMs = Date.now() - d;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "az önce";
  if (min < 60) return `${min} dk önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} saat önce`;
  const day = Math.floor(hr / 24);
  return `${day} gün önce`;
}

export default function SatisDashboardPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [sales, setSales] = useState<SaleItem[]>([]);
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [branches, setBranches] = useState<BranchDoc[]>([]);
  const [loading, setLoading] = useState(false);
  // İlk veri yüklemesi bitene kadar (authed===null'daki "hiçbir şey render etme" pattern'iyle
  // aynı mantık) içerik hiç mount edilmiyor — aksi halde donut/kota grafiği gibi bileşenler
  // önce BOŞ veriyle bir kere render olup gerçek veri gelince aniden "sıçrıyor" (kullanıcı fark
  // etti: kota grafiğinin animasyonu düz başlayıp birden yükseliyordu, donut'ta da aynı zıplama).
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  // Küçük ekranda (<=1600px) 3'lü aksiyon kartı satırı fazla "dik" durmasın diye iç boşluklar
  // daralıyor — büyük ekranda AYNI kalıyor (kullanıcı: "büyük ekranlarda aynı kalacak").
  // Lazy initializer ilk render'da doğru değeri okur (donuttaki isWideDonut fix'iyle aynı
  // sebep: bu sayfa authed===null iken hiçbir şey render etmiyor, titreme/hydration riski yok).
  const [isCompactRow, setIsCompactRow] = useState(
    () => typeof window !== "undefined" && window.matchMedia(ACTION_ROW_COMPACT_BREAKPOINT).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(ACTION_ROW_COMPACT_BREAKPOINT);
    const update = () => setIsCompactRow(mq.matches);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const u = auth.currentUser;
    const token = u ? await u.getIdToken() : "";
    return { Authorization: `Bearer ${token}` };
  }, []);

  const loadAll = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const headers = await authHeaders();
      const [salesRes, apptRes, actRes, branchRes] = await Promise.all([
        fetch("/api/flexos/sales", { headers, signal }),
        fetch("/api/flexos/appointments", { headers, signal }),
        fetch("/api/flexos/activities", { headers, signal }),
        fetch("/api/flexos/branches", { headers, signal }),
      ]);
      if (signal?.aborted) return;
      if (salesRes.ok) setSales(((await salesRes.json()).items ?? []) as SaleItem[]);
      if (apptRes.ok) setAppointments(((await apptRes.json()).items ?? []) as AppointmentItem[]);
      if (actRes.ok) setActivities(((await actRes.json()).items ?? []) as ActivityItem[]);
      if (branchRes.ok) setBranches(((await branchRes.json()).items ?? []) as BranchDoc[]);
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error("Veriler yüklenemedi.");
    } finally {
      if (!signal?.aborted) { setLoading(false); setInitialLoadDone(true); }
    }
  }, [authHeaders]);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      await auth.authStateReady();
      if (!auth.currentUser) { router.push("/login"); return; }
      setAuthed(true);
      await loadAll(ac.signal);
    })();
    return () => ac.abort();
  }, [router, loadAll]);

  // ── bu ay aktif satışlar ──
  const monthActive = useMemo(() => sales.filter((s) => s.status === "active" && isThisMonth(s.date)), [sales]);
  const monthCancelled = useMemo(() => sales.filter((s) => s.status === "cancelled" && isThisMonth(s.date)).length, [sales]);
  const monthCiro = useMemo(() => monthActive.reduce((a, s) => a + s.soldPrice, 0), [monthActive]);

  // ── satış kotası: gerçek günlük kümülatif TL eğrisi — Tremor AreaChart'ın görsel tarifi
  // (gradient dolgu %5→%95 stop, strokeWidth:2, yuvarlak uç/köşe, monotone eğri, animasyonlu)
  // ödünç alındı; Tremor'un kendi 989 satırlık bileşeni KURULMADI, sadece stil taklit edildi.
  // Gerçek "hedef/kota" backend'i yok (ayrı bir iş kalemi) — sadece hedefTl dummy placeholder.
  // Gerçekleşen (yapilanTl/kalanTl/tamamlanmaOrani) GERÇEK satış verisinden (soldPrice).
  const kota = useMemo(() => {
    const now = new Date();
    const daysSoFar = now.getDate();
    const dailyTl = new Array(daysSoFar).fill(0);
    for (const s of monthActive) {
      const d = new Date(s.date + "T00:00:00");
      if (!isNaN(d.getTime()) && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
        const idx = d.getDate() - 1;
        if (idx >= 0 && idx < daysSoFar) dailyTl[idx] += s.soldPrice;
      }
    }
    let acc = 0;
    const chartData = dailyTl.map((tl, i) => ({ day: i + 1, gerceklesen: (acc += tl) }));
    const yapilanTl = acc;
    const todayStr = now.toISOString().slice(0, 10);
    const bugunDelta = monthActive.filter((s) => s.date === todayStr).length;
    const tamamlanmaOrani = SATIS_KOTASI_HEDEF_TL > 0 ? Math.round((yapilanTl / SATIS_KOTASI_HEDEF_TL) * 100) : 0;
    const kalanTl = Math.max(0, SATIS_KOTASI_HEDEF_TL - yapilanTl);
    return { chartData, bugunDelta, hedefTl: SATIS_KOTASI_HEDEF_TL, yapilanTl, kalanTl, tamamlanmaOrani };
  }, [monthActive]);

  // ── donut: branş dağılımı ──
  const donut = useMemo(() => {
    const byBranch = new Map<string, number>();
    for (const s of monthActive) {
      const key = s.branchName || "Diğer";
      byBranch.set(key, (byBranch.get(key) ?? 0) + 1);
    }
    const total = monthActive.length;
    const sorted = Array.from(byBranch.entries()).sort((a, b) => b[1] - a[1]);

    // Belirli sayıdan (DONUT_TOP_N) sonra kalanlar tek "Diğer" dilimine toplanır —
    // legend her zaman 2 sütun × en fazla ⌈(TOP_N+1)/2⌉ satırda sabit kalır, sonsuz uzamaz.
    const top = sorted.slice(0, DONUT_TOP_N);
    const rest = sorted.slice(DONUT_TOP_N);
    const otherCount = rest.reduce((a, [, count]) => a + count, 0);
    const entries: Array<[string, number]> = otherCount > 0 ? [...top, ["Diğer", otherCount]] : top;

    const otherDetail = rest.map(([label, count]) => ({
      label, count, pct: total > 0 ? Math.round((count / total) * 100) : 0,
    }));

    let acc = 0;
    const stops: string[] = [];
    const pieData: Array<{ name: string; value: number; color: string }> = [];
    const legend: DonutLegendItem[] = entries.map(([label, count], i) => {
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      const isOther = label === "Diğer" && otherCount > 0 && i === entries.length - 1;
      const color = isOther ? DONUT_OTHER_COLOR : DONUT_PALETTE[i % DONUT_PALETTE.length];
      const start = acc; const end = acc + pct; acc = end;
      stops.push(`${color} ${start}% ${end}%`);
      pieData.push({ name: label, value: count, color });
      return { label, count, pct, color, detail: isOther ? otherDetail : undefined };
    });

    // Az branş satılmışken (1-3) kart grid'i gerilmesin diye kataloğun geri
    // kalanından soluk yer tutucu kartlarla DONUT_MIN_CARDS'a tamamlanır.
    // (0 satış ayrı bir boş-durum ekranı — burada dokunulmuyor.)
    if (top.length > 0 && top.length < DONUT_MIN_CARDS) {
      const usedNames = new Set(top.map(([label]) => label));
      const catalogFillers = branches
        .filter((b) => !usedNames.has(b.name))
        .map((b) => b.name);
      for (const name of catalogFillers) usedNames.add(name);
      // Katalog yetmezse (branş havuzu henüz dolmadıysa) geçici dummy isimlerle tamamla —
      // gerçek branş eklendikçe yukarıdaki catalogFillers listesi büyüyüp bunların yerini alır.
      const dummyFillers = DONUT_DUMMY_BRANCHES.filter((name) => !usedNames.has(name));
      const fillers = [...catalogFillers, ...dummyFillers].slice(0, DONUT_MIN_CARDS - top.length);
      // Renk çubuğu tek düze gri değil, gerçek kartların paletinden devam eder (turuncu/mor/vs.) —
      // sadece metin/arkaplan soluklaştırılır, "satış yok" bilgisi rengiyle DEĞİL stiliyle verilir.
      fillers.forEach((label, i) => {
        const color = DONUT_PALETTE[(top.length + i) % DONUT_PALETTE.length];
        legend.push({ label, count: 0, pct: 0, color, muted: true });
      });
    }

    return { total, legend, pieData, conic: stops.length ? `conic-gradient(${stops.join(", ")})` : "conic-gradient(#EEF0F3 0% 100%)" };
  }, [monthActive, branches]);

  // Sayfadaki TÜM giriş animasyonları (donut halkası+sayısı, kota grafiği) bu TEK saatten
  // besleniyor — initialLoadDone false→true olduğu anda tetiklenir (veri gelmeden önce
  // sayaç akıp bitmesin diye `donut.total` gibi veriye bağlı bir tetikleyici DEĞİL, doğrudan
  // yükleme durumunun kendisi kullanılıyor). Ayrı ayrı Recharts animasyonları/kendi
  // zamanlayıcılarımız senkronsuz kalıyordu (kullanıcı fark etti) — artık matematiksel olarak
  // aynı anda başlamak zorundalar.
  const revealProgress = useAnimProgress(initialLoadDone);
  const donutTotalAnimated = Math.round(donut.total * revealProgress);

  // ── az branş varken donut+kartlar büyür, 6'da (DONUT_TOP_N) mevcut boyuta iner ──
  const donutTopCount = donut.legend.filter((l) => !l.detail).length;
  const donutScale = donutTopCount > 0 ? Math.max(1, 1.25 - (Math.min(donutTopCount, DONUT_TOP_N) - 1) * 0.05) : 1;
  const donutCols = donutTopCount <= 2 ? 1 : 2;
  // Büyük ekranda (>1600px) Bugünkü Randevular kartında 5. randevu da sığıyor, küçük ekranda 4'te kalıyor.
  const apptVisibleRows = isCompactRow ? APPT_VISIBLE_ROWS_NARROW : APPT_VISIBLE_ROWS_WIDE;

  // ── aktif satışlar havuzu: son 3 (tüm zamanlar, en yeni önce) ──
  const recentActive = useMemo(() => {
    return [...sales]
      .filter((s) => s.status === "active")
      .sort((a, b) => (b.createdAt ?? b.date).localeCompare(a.createdAt ?? a.date))
      .slice(0, 3);
  }, [sales]);

  // ── bugünkü randevular ──
  const todayAppointments = useMemo(() => {
    return appointments
      .filter((a) => a.status !== "iptal" && isToday(a.scheduledAt))
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  }, [appointments]);

  if (authed === null || !initialLoadDone) return null;

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh", overflow: "hidden", fontFamily: "'Inter', system-ui, sans-serif", color: "#1E222B" }}>
      <FlexSidebar active="ana" />
      <main style={{ flex: 1, height: "100%", overflowY: "auto", background: "#EEF0F3", display: "flex", flexDirection: "column" }}>
        <FlexHeader greeting subtitle="Bugün satışlarda neler oluyor? İşte son durum." roleLabel="Yönetici · Satış" />

        <div style={{ padding: "28px 36px 56px", maxWidth: FLEX_CONTENT_MAX_WIDTH, margin: "0 auto", width: "100%", boxSizing: "border-box", flex: 1, display: "grid", gridTemplateColumns: isCompactRow ? "1fr 340px" : "1fr 420px", gridTemplateRows: "auto auto auto", gap: 20, alignItems: "stretch" }}>

          {/* DONUT + LEGEND */}
          <div style={{ gridColumn: 1, gridRow: 1, position: "relative", background: "#fff", border: "1px solid #E2E5EA", borderRadius: 24, padding: "24px 28px 32px", boxShadow: "0 4px 20px -12px rgba(15,31,61,.15)", minHeight: 252, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#1E222B", letterSpacing: "-.2px" }}>Satış Dağılımı</div>
                <div style={{ fontSize: 12.5, color: "#8E95A3", fontWeight: 500, marginTop: 2 }}>Bu ayki aktif kayıtların branş kırılımı</div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#205297", background: "#DDE8F8", padding: "5px 12px", borderRadius: 999 }}>Bu Ay</span>
            </div>

            {loading ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#8E95A3", fontSize: 14, fontWeight: 600 }}>Yükleniyor…</div>
            ) : donut.total === 0 ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#8E95A3", fontSize: 13.5, fontWeight: 600 }}>Bu ay henüz satış kaydı yok.</div>
            ) : (
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 40, flexWrap: "wrap" }}>
                <div style={{ position: "relative", width: 216, height: 216, flex: "0 0 auto" }}>
                  {/* Eski conic-gradient CSS halkası yerine animasyonlu Recharts Pie/donut — legend/skala/"Diğer"
                      popup mantığı (donut useMemo) hiç değişmedi, sadece görsel halka Recharts'a taşındı. */}
                  <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 216, height: 216 }}>
                    <PieChart>
                      <Pie
                        data={donut.pieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={58}
                        outerRadius={108}
                        startAngle={90}
                        endAngle={90 - 360 * revealProgress}
                        paddingAngle={0}
                        stroke="#fff"
                        strokeWidth={2}
                        isAnimationActive={false}
                      >
                        {donut.pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ position: "absolute", inset: 50, background: "#fff", borderRadius: "50%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", boxShadow: "inset 0 0 0 1px #F2F4F7", pointerEvents: "none" }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: "#1E222B", letterSpacing: "-.7px", lineHeight: 1 }}>{donutTotalAnimated}</div>
                    <div style={{ fontSize: 11, color: "#8E95A3", fontWeight: 600, marginTop: 3, whiteSpace: "nowrap" }}>Aktif Kayıt</div>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 240, display: "grid", gridTemplateColumns: `repeat(${donutCols}, 1fr)`, gap: 10 * donutScale, alignSelf: "center" }}>
                  {donut.legend.filter((l) => !l.detail).map((l) => (
                    <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 11 * donutScale, padding: `${13 * donutScale}px ${14 * donutScale}px`, borderRadius: 13, background: l.muted ? "#FBFBFC" : "#F7F8FA", border: l.muted ? "1px dashed #E2E5EA" : "1px solid #EEF0F3" }}>
                      <span style={{ width: 4, alignSelf: "stretch", minHeight: 34 * donutScale, borderRadius: 999, background: l.color, flex: "0 0 auto" }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                          <span style={{ fontSize: 19 * donutScale, fontWeight: 800, color: l.muted ? "#8E95A3" : "#1E222B", letterSpacing: "-.4px", lineHeight: 1 }}>{l.muted ? "—" : `${l.pct}%`}</span>
                          <span style={{ fontSize: 11 * donutScale, color: l.muted ? "#8E95A3" : "#AEB4C0", fontWeight: 600 }}>{l.muted ? "satış yok" : `${l.count} kayıt`}</span>
                        </div>
                        <div style={{ fontSize: 12 * donutScale, color: "#6F7B87", fontWeight: 600, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.label}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* "Diğer" — ortalanan alanın DIŞINDA, kartın sağ alt köşesine sabit */}
            {donut.legend.filter((l) => l.detail).map((l) => (
              <div key={l.label} className="sd-other-legend" style={{ position: "absolute", right: 24, bottom: 32, display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 10, background: "#F2F4F7", border: "1px solid #E2E5EA", cursor: "default" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: l.color, flex: "0 0 auto" }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#414B59" }}>{l.label}</span>
                <span style={{ fontSize: 11.5, color: "#8E95A3", fontWeight: 600 }}>{l.pct}%</span>

                <div className="sd-other-tip" style={{ position: "absolute", bottom: "calc(100% + 8px)", right: 0, zIndex: 60, minWidth: 200, background: "#1E222B", borderRadius: 13, padding: "10px 12px", boxShadow: "0 12px 28px -8px rgba(15,31,61,.35)", opacity: 0, visibility: "hidden", transform: "translateY(4px)", transition: "all .15s" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#9fb2cd", marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: ".3px" }}>Diğer branşlar</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {l.detail?.map((d) => (
                      <div key={d.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontSize: 12.5, color: "#fff", fontWeight: 600, whiteSpace: "nowrap" }}>
                        <span>{d.label}</span>
                        <span style={{ color: "#9fb2cd", fontWeight: 700 }}>{d.pct}% · {d.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <style>{`
            .sd-other-legend:hover .sd-other-tip { opacity: 1 !important; visibility: visible !important; transform: translateY(0) !important; }
          `}</style>

          {/* DIRECT ACTION CARDS */}
          <div style={{ gridColumn: 1, gridRow: 2, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <button
              onClick={() => router.push("/flexos/satislar/satis-yap")}
              style={{ textAlign: "left" as const, textDecoration: "none", background: "#fff", border: "1px solid #E2E5EA", borderRadius: 22, padding: isCompactRow ? 16 : 22, display: "flex", flexDirection: "column", boxShadow: "0 4px 20px -12px rgba(15,31,61,.15)", cursor: "pointer", fontFamily: "inherit" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: isCompactRow ? 10 : 14 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: "#FFEAD7", color: "#C2410C", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
                  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                </div>
                <div>
                  <div style={{ fontSize: 15.5, fontWeight: 800, color: "#1E222B", letterSpacing: "-.2px" }}>Satış Yap</div>
                  <div style={{ fontSize: 12, color: "#8E95A3", fontWeight: 500 }}>Yeni kayıt oluştur</div>
                </div>
              </div>
              <div style={{ flex: 1, display: "flex", alignItems: "center", padding: isCompactRow ? "10px 12px" : "16px 16px", borderRadius: 14, border: "1px solid #EEF0F3", background: "#F7F8FA" }}>
                <span style={{ display: "block", fontSize: isCompactRow ? 11.5 : 14, color: "#6F7B87", fontWeight: 500, lineHeight: 1.5 }}>
                  {recentActive.length > 0 ? (
                    <>En son <b style={{ color: "#1E222B" }}>{relTime(recentActive[0].createdAt ?? recentActive[0].date)}</b> önce <b style={{ color: "#1E222B" }}>{recentActive[0].studentName}</b> için <b style={{ color: "#1E222B" }}>{recentActive[0].branchName}</b> branşında satış yapıldı.</>
                  ) : "Henüz satış kaydı yok."}
                </span>
              </div>
              <div style={{ marginTop: isCompactRow ? 10 : 14, display: "flex", width: "100%", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 16px", borderRadius: 11, background: "linear-gradient(135deg,#FF8D28,#D66500)", color: "#fff", fontSize: 13.5, fontWeight: 700, boxShadow: "0 8px 16px -8px rgba(214,101,0,.5)" }}>
                Başla
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </div>
            </button>

            <button
              onClick={() => router.push("/flexos/satislar/satis-liste")}
              style={{ textAlign: "left" as const, textDecoration: "none", background: "#fff", border: "1px solid #E2E5EA", borderRadius: 22, padding: isCompactRow ? 16 : 22, display: "flex", flexDirection: "column", boxShadow: "0 4px 20px -12px rgba(15,31,61,.15)", cursor: "pointer", fontFamily: "inherit" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: isCompactRow ? 10 : 14 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: "#DDE8F8", color: "#205297", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
                  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="m19 9-5 5-4-4-3 3"/></svg>
                </div>
                <div>
                  <div style={{ fontSize: 15.5, fontWeight: 800, color: "#1E222B", letterSpacing: "-.2px" }}>Satış Listesi</div>
                  <div style={{ fontSize: 12, color: "#8E95A3", fontWeight: 500 }}>Tüm satış kayıtları</div>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: isCompactRow ? 6 : 8, flex: 1 }}>
                <SummaryRow label="Bu Ay Ciro" value={fmtTL(monthCiro)} color="#3A7BD5" />
                <SummaryRow label="Satış Adedi" value={String(monthActive.length)} color="#009F3E" />
                <SummaryRow label="İptal" value={String(monthCancelled)} color="#B42318" />
              </div>
              <div style={{ marginTop: isCompactRow ? 8 : 12, display: "flex", width: "100%", alignItems: "center", justifyContent: "center", gap: 7, padding: "9px 14px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#fff", color: "#205297", fontSize: 13, fontWeight: 700 }}>
                Satış Listesini Aç
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </div>
            </button>

            <SatisKotasiCard {...kota} compact={isCompactRow} revealProgress={revealProgress} />
          </div>

          {/* ACTIVE SALES POOL */}
          <div style={{ gridColumn: 1, gridRow: 3 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#007A30" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
                <span style={{ fontSize: 17, fontWeight: 800, color: "#1E222B", letterSpacing: "-.2px" }}>En Son Satışlar</span>
              </div>
              <button onClick={() => router.push("/flexos/satislar/satis-liste")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#205297", fontFamily: "inherit" }}>Tümünü Gör →</button>
            </div>

            {recentActive.length === 0 ? (
              <div style={{ background: "#fff", border: "1px solid #E2E5EA", borderRadius: 20, padding: "30px 20px", textAlign: "center", color: "#8E95A3", fontSize: 13.5, fontWeight: 600 }}>
                Henüz aktif satış kaydı yok.
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
                {recentActive.map((s, i) => {
                  const pal = AV_PALETTES[i % AV_PALETTES.length];
                  return (
                    <div key={s.id} style={{ background: "#fff", border: "1px solid #E2E5EA", borderRadius: 20, padding: 18, display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 4px 20px -14px rgba(15,31,61,.18)" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ width: 42, height: 42, borderRadius: 12, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontWeight: 700, background: `linear-gradient(135deg,${pal[0]},${pal[1]})` }}>
                          {initials(s.studentName)}
                        </span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, color: "#007A30", background: "#E6F5ED", whiteSpace: "nowrap" }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#009F3E", flex: "0 0 auto" }} />
                          Aktif
                        </span>
                      </div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "#1E222B", letterSpacing: "-.2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.studentName}</div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: "#6F7B87", letterSpacing: "-.2px", marginTop: 4 }}>{fmtTL(s.soldPrice)}</div>
                        {s.educationName && (
                          <span style={{ display: "inline-flex", alignItems: "center", marginTop: 8, padding: "3px 10px", borderRadius: 7, fontSize: 11.5, fontWeight: 600, color: "#6F7B87", background: "#F2F4F7" }}>{s.educationName}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT: BUGÜNKÜ RANDEVULAR */}
          <div style={{ gridColumn: 2, gridRow: 1, background: "#fff", border: "1px solid #E2E5EA", borderRadius: 24, padding: 20, boxShadow: "0 4px 20px -12px rgba(15,31,61,.15)", display: "flex", flexDirection: "column", minHeight: 244, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 16, flex: "0 0 auto" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: "#DDE8F8", color: "#205297", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: "#1E222B" }}>Bugünkü Randevular</div>
                  <div style={{ fontSize: 11.5, color: "#8E95A3", fontWeight: 500 }}>{new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "long" })}</div>
                </div>
              </div>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "#205297", background: "#DDE8F8", padding: "4px 10px", borderRadius: 999 }}>{todayAppointments.length} randevu</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: APPT_ROW_GAP, overflowY: "auto", flex: 1, minHeight: 0, maxHeight: APPT_LIST_PAD + APPT_ROW_HEIGHT * apptVisibleRows + APPT_ROW_GAP * (apptVisibleRows - 1), paddingTop: APPT_LIST_PAD, paddingRight: 2 }}>
              {todayAppointments.length === 0 ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#8E95A3", fontSize: 13, fontWeight: 600 }}>Bugün için randevu yok.</div>
              ) : todayAppointments.map((r) => (
                <div key={r.id} style={{ height: APPT_ROW_HEIGHT, boxSizing: "border-box", display: "flex", alignItems: "center", gap: 12, padding: "0 13px", borderRadius: 13, border: "1px solid #EEF0F3", background: "#FBFCFD", flex: "0 0 auto" }}>
                  <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", padding: "7px 9px", borderRadius: 10, background: "#0f1f3d", color: "#fff", fontSize: 12.5, fontWeight: 700, letterSpacing: "-.2px", minWidth: 52 }}>{fmtTime(r.scheduledAt)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1E222B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.personName}</div>
                    <div style={{ fontSize: 11.5, color: "#8E95A3", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.note || "—"}</div>
                  </div>
                </div>
              ))}
            </div>
            {todayAppointments.length > 0 && <div style={{ flex: "0 0 auto", height: APPT_LIST_PAD }} />}
          </div>

          {/* RIGHT: CANLI AKTİVİTE AKIŞI */}
          <div style={{ gridColumn: 2, gridRow: "2 / span 2", position: "relative", minHeight: 0 }}>
            <div style={{ position: "absolute", inset: 0, background: "#fff", border: "1px solid #E2E5EA", borderRadius: 24, padding: "20px 20px 12px", boxShadow: "0 4px 20px -12px rgba(15,31,61,.15)", display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#FF8D28,#D66500)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 14px -6px rgba(214,101,0,.5)" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: "#1E222B" }}>Canlı Aktivite Akışı</div>
                    <div style={{ fontSize: 11.5, color: "#8E95A3", fontWeight: 500 }}>Son satış hareketleri</div>
                  </div>
                </div>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 999, background: "#E6F5ED", fontSize: 11, fontWeight: 700, color: "#007A30" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#009F3E" }} />
                  Canlı
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", overflowY: "auto", flex: 1, minHeight: 0, paddingRight: 2 }}>
                {activities.length === 0 ? (
                  <div style={{ padding: "20px 0", textAlign: "center", color: "#8E95A3", fontSize: 13, fontWeight: 600 }}>Henüz aktivite yok.</div>
                ) : activities.map((a, i) => {
                  const meta = ACTIVITY_META[a.type];
                  return (
                    <div key={a.id} style={{ position: "relative", display: "flex", gap: 12, paddingBottom: 14 }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "0 0 auto" }}>
                        <span style={{ width: 32, height: 32, borderRadius: 9, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: meta.bg, color: meta.color }} dangerouslySetInnerHTML={{ __html: meta.icon }} />
                        <span style={{ width: 2, flex: 1, background: i < activities.length - 1 ? "#EEF0F3" : "transparent", minHeight: 8, marginTop: 4 }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0, border: "1px solid #EEF0F3", borderRadius: 13, padding: "11px 12px", background: "#fff" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#1E222B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{meta.label}</span>
                          <span style={{ fontSize: 10.5, color: "#AEB4C0", fontWeight: 600, whiteSpace: "nowrap", flex: "0 0 auto" }}>{relTime(a.createdAt)}</span>
                        </div>
                        <div style={{ fontSize: 12, color: "#8E95A3", fontWeight: 500, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {a.personName}{a.note ? ` — ${a.note}` : ""}
                        </div>
                        <button
                          onClick={() => router.push("/flexos/aktivite-merkezi")}
                          style={{ marginTop: 9, display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 8, border: "none", background: "#EEF0F3", color: "#205297", fontSize: 11.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}
                        >
                          Aktivite Gir
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </div>
        {/* Tailwind JIT dinamik interpolasyonu build-time'da göremez — FLEX_CONTENT_MAX_WIDTH (1920) burada BİLEREK sabit yazılı, değişirse elle senkron tutulmalı. */}
        <Footer mini containerClassName="w-full max-w-[1920px] mx-auto px-9" />
      </main>
    </div>
  );
}

// ── Satış Kotası kartı (aksiyon kartları satırının 3.'sü) — sade Hedef vs Gerçekleşen kıyası ──
function SatisKotasiCard({ chartData, bugunDelta, hedefTl, yapilanTl, kalanTl, tamamlanmaOrani, compact = false, revealProgress }: {
  chartData: Array<{ day: number; gerceklesen: number }>;
  bugunDelta: number; hedefTl: number; yapilanTl: number; kalanTl: number; tamamlanmaOrani: number; compact?: boolean; revealProgress: number;
}) {
  const firstDay = chartData[0]?.day ?? 1;
  const lastDay = chartData[chartData.length - 1]?.day ?? 1;
  // Değerleri ölçekleyip dikey büyütme denendi ama bu SADECE yükseliş veriyordu — kullanıcı
  // eskiden (Recharts'ın kendi varsayılan giriş animasyonunda) hem genişlik hem yükseklik aynı
  // anda açılan bir görünüm hatırlıyor; o aslında bir clip-path maskesiydi. Veri hep SABİT/son
  // haliyle çiziliyor (Y ekseni de sabit — otomatik ölçeklenip titremesin diye), üstüne
  // donut'la PAYLAŞILAN revealProgress'e göre soldan sağa açılan bir clip-path maskesi konuyor.
  const maxValue = Math.max(...chartData.map((d) => d.gerceklesen), 1);
  return (
    <div style={{ background: "#fff", border: "1px solid #E2E5EA", borderRadius: 22, padding: compact ? 16 : 22, display: "flex", flexDirection: "column", boxShadow: "0 4px 20px -12px rgba(15,31,61,.15)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: compact ? 10 : 14 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: "#EEF0FD", color: "#6F74D8", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></svg>
        </div>
        <div>
          <div style={{ fontSize: 15.5, fontWeight: 800, color: "#1E222B", letterSpacing: "-.2px" }}>Satış Kotası</div>
          <div style={{ fontSize: 12, color: "#8E95A3", fontWeight: 500 }}>Aylık satış hedefi</div>
        </div>
      </div>

      <div style={{ fontSize: 11, color: "#8E95A3", fontWeight: 600 }}>Hedef Satış</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#1E222B", letterSpacing: "-.5px", marginTop: 2 }}>{fmtTL(hedefTl)}</div>
      <span style={{ display: "inline-flex", alignSelf: "flex-start", marginTop: 8, fontSize: 11.5, fontWeight: 700, color: "#6F74D8", background: "#EEF0FD", padding: "3px 10px", borderRadius: 999 }}>
        %{tamamlanmaOrani} Tamamlanma Oranı
      </span>

      {/* Tremor "Revenue by month" örneğinin görsel tarifi ödünç alındı (989 satırlık bileşenin
          kendisi kurulmadı — sadece stil): açık gri yatay grid, ince üst/alt çerçeve, sade eksen
          (sadece ilk/son gün etiketi), yumuşak eğri + gradient dolgu, animasyonlu. */}
      <div
        style={{
          width: "100%", height: compact ? 72 : 96, marginTop: compact ? 10 : 14,
          borderTop: "1px solid #EEF0F3", borderBottom: "1px solid #EEF0F3",
          clipPath: `inset(0 ${(1 - revealProgress) * 100}% 0 0)`,
        }}
      >
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 240, height: compact ? 72 : 96 }}>
          <AreaChart data={chartData} margin={{ top: 8, right: 4, bottom: 4, left: 4 }} onContextMenu={(_, e) => e.preventDefault()}>
            <defs>
              <linearGradient id="kotaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6F74D8" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6F74D8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid horizontal vertical={false} stroke="#EEF0F3" />
            <XAxis
              dataKey="day"
              type="number"
              domain={[firstDay, lastDay]}
              ticks={[firstDay, lastDay]}
              tickFormatter={(d: number) => (d === firstDay ? "Ay başı" : "Bugün")}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10.5, fill: "#8E95A3", fontWeight: 600 }}
              tickMargin={6}
            />
            <YAxis hide domain={[0, maxValue]} />
            <Area
              type="monotone"
              dataKey="gerceklesen"
              stroke="#6F74D8"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="url(#kotaFill)"
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div style={{ marginTop: compact ? 8 : 14, paddingTop: compact ? 8 : 12, borderTop: "1px solid #F7F8FA", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ display: "grid", gridTemplateColumns: "auto auto", alignItems: "baseline", rowGap: 4, columnGap: 8 }}>
          <span style={{ fontSize: 10.5, color: "#8E95A3", fontWeight: 600 }}>Yapılan Satış</span>
          <span style={{ fontSize: 12.5, fontWeight: 800, color: "#1E222B", textAlign: "right", justifySelf: "end" }}>{fmtTL(yapilanTl)}</span>
          <span style={{ fontSize: 10.5, color: "#8E95A3", fontWeight: 600 }}>Kalan Satış</span>
          <span style={{ fontSize: 12.5, fontWeight: 800, color: "#1E222B", textAlign: "right", justifySelf: "end" }}>{fmtTL(kalanTl)}</span>
        </div>
        <div style={{ textAlign: "right" as const }}>
          <div style={{ fontSize: 10.5, color: "#8E95A3", fontWeight: 600 }}>Dününe göre</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: bugunDelta > 0 ? "#009F3E" : "#8E95A3" }}>{bugunDelta > 0 ? `+${bugunDelta}` : bugunDelta} kayıt</div>
        </div>
      </div>
    </div>
  );
}

// ── küçük özet satırı (Satış Listesi kartı içinde) ──
function SummaryRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 12px", borderRadius: 10, background: "#F7F8FA" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flex: "0 0 auto" }} />
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "#414B59", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
      </div>
      <span style={{ fontSize: 13, fontWeight: 800, color: "#1E222B", whiteSpace: "nowrap", flex: "0 0 auto" }}>{value}</span>
    </div>
  );
}
