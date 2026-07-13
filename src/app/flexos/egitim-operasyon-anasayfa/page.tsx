"use client";

/**
 * FlexOS · Operasyon çalışanının ANA SAYFASI (menü öğesi değil — Ana Sayfa'nın
 * `education.create` paketine düşen hedefi, bkz. FlexSidebar "Ana Sayfa" routing).
 * Tasarım: Claude Design "Eğitim Operasyon Dashboard.dc.html" portlandı (demo veri → gerçek uçlar).
 * Donut (aktif sınıfların branş dağılımı) + özet metrik şeridi + büyük işlem kartları
 * (Grup Oluştur/Yoklama Takibi) + hızlı işlemler (Sertifikasyon/Anketler/Bildirim Merkezi —
 * hiçbiri için backend yok, "yakında" toast) + Yaklaşan Sınıflar + Operasyon Akışı.
 */

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { auth } from "@/app/lib/firebase";
import FlexSidebar from "../_components/FlexSidebar";
import FlexHeader, { FLEX_CONTENT_MAX_WIDTH } from "../_components/FlexHeader";
import Footer from "@/app/components/layout/Footer";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { useRealtimeSync } from "../_shared/useRealtimeSync";
import { isoWeekday } from "../siniflar/_shared/groupDisplay";

// ── types (API şekilleri) ──
interface GroupSchedule {
  startDate?: string;
  days?: number[];
  sessionHours?: number;
  startTime?: string;
  endTime?: string;
  endDate?: string;
}

interface GroupItem {
  id: string;
  code: string;
  status: "planned" | "enrolling" | "active" | "postponed" | "completed" | "archived";
  branch: string;
  trainerId: string;
  schedule: GroupSchedule;
  capacity: number;
  enrolled: number;
}

interface BranchDoc { id: string; name: string; order?: number }
interface TrainerItem { id: string; name: string }

type ActivityType = "arama" | "mesaj" | "randevu" | "not" | "satis_donusumu";

interface ActivityItem {
  id: string;
  caseId: string;
  personName: string;
  type: ActivityType;
  note: string | null;
  createdAt: string;
}

const DONUT_PALETTE = ["#3A7BD5", "#FF8D28", "#009F3E", "#7C3AED", "#F91079", "#0E5D59"];
const YAKLASAN_YAKIN_GUN = 4; // bu kadar gün ve altı "yakın" vurgusu alır
const YAKLASAN_MAX = 6;
const ACTION_ROW_COMPACT_BREAKPOINT = "(max-width: 1600px)"; // Satış Dashboard'daki aynı kırılım — sağ sütun genişliği buna bağlı

// Üst kısım (donut + özet şerit) kullanıcı kararıyla DUMMY veri — gerçek "aktif sınıf"
// sayısı bu ortamda az/dağınık olduğu için görsel olarak Claude Design'ın orijinal demo
// rakamları kullanılıyor (Yaklaşan Sınıflar + Operasyon Akışı hâlâ GERÇEK veri).
const DONUT_DUMMY = [
  { label: "Yazılım", count: 8, color: DONUT_PALETTE[0] },
  { label: "Grafik Tasarım", count: 6, color: DONUT_PALETTE[1] },
  { label: "Veri Bilimi", count: 6, color: DONUT_PALETTE[2] },
  { label: "İngilizce", count: 4, color: DONUT_PALETTE[3] },
];
const OZET_DUMMY = { aktifOgrenci: 210, buHaftaBaslayacak: 6, sertifikaBekleyen: 18 };

// Aynı ikon/etiket seti Satış Dashboard'daki Canlı Aktivite Akışı ile birebir —
// Operasyon Akışı şu an aynı `activities` koleksiyonunu okuyor (CRM/talep sistemi
// department-agnostic, `activity.read` Operasyon paketinde de var). Yoklama/sertifika/
// anket/bildirim gibi ayrı bir operasyon-olay-log'u backend'de HENÜZ yok — o yüzden bu
// panel dürüstçe mevcut talep/aktivite akışını gösteriyor, tasarımdaki 6 farklı ikon
// tipini uydurmuyoruz.
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

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysUntil(dateStr: string): number {
  const today = new Date(`${todayStr()}T00:00:00`);
  const target = new Date(`${dateStr}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
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

// Donut halkası ile ortasındaki sayının TEK bir saatten (0→1 progress) beslenmesi —
// Satış Dashboard'daki `useAnimProgress` ile birebir aynı (bkz. o dosyadaki detaylı not):
// Recharts'ın kendi animasyonu KAPALI (isAnimationActive=false), açı bu progress'ten
// hesaplanıyor, `active=false` iken saat hiç çalışmaz (veri gelmeden erken bitmesin diye).
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

export default function EgitimOperasyonAnasayfaPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [branches, setBranches] = useState<BranchDoc[]>([]);
  const [trainers, setTrainers] = useState<TrainerItem[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  // Sağ sütun (Yaklaşan Sınıflar/Operasyon Akışı) büyük ekranda daha geniş — Satış
  // Dashboard'daki `isCompactRow` ile aynı breakpoint/lazy-initializer deseni.
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
    try {
      const headers = await authHeaders();
      const [groupsRes, branchRes, trainerRes, actRes] = await Promise.all([
        fetch("/api/flexos/groups", { headers, signal }),
        fetch("/api/flexos/branches", { headers, signal }),
        fetch("/api/flexos/trainers", { headers, signal }),
        fetch("/api/flexos/activities", { headers, signal }),
      ]);
      if (signal?.aborted) return;
      if (groupsRes.ok) setGroups(((await groupsRes.json()).items ?? []) as GroupItem[]);
      if (branchRes.ok) setBranches(((await branchRes.json()).items ?? []) as BranchDoc[]);
      if (trainerRes.ok) setTrainers(((await trainerRes.json()).items ?? []) as TrainerItem[]);
      if (actRes.ok) setActivities(((await actRes.json()).items ?? []) as ActivityItem[]);
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error("Veriler yüklenemedi.");
    } finally {
      if (!signal?.aborted) setInitialLoadDone(true);
    }
  }, [authHeaders]);

  // 2026-07-12 ACİL fix: `/api/flexos/groups` tenant'taki TÜM enrollment kayıtlarını
  // sınırsız okuyor (doluluk hesabı için) — Firestore kota olayına sebep oldu, çünkü
  // `loadAll` önceden satış/not/yoklama/öğrenci değişikliklerinde de (sadece aktivite
  // şeridini etkileyen olaylar) TAM bu pahalı sorguyu tetikliyordu. Bu olaylar sadece
  // aktiviteyi etkiler — SADECE `/api/flexos/activities` yeniden çekilir, groups/
  // branches/trainers'a dokunulmaz.
  const loadActivitiesOnly = useCallback(async () => {
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/flexos/activities", { headers });
      if (res.ok) setActivities(((await res.json()).items ?? []) as ActivityItem[]);
    } catch {
      // sessiz — aktivite şeridi kozmetik bir yeniden çekim
    }
  }, [authHeaders]);

  // 2026-07-11 — polling mimarisi TAMAMEN kaldırıldı. Aktiviteler `loadAll` ile sayfa
  // açılışında TEK SEFER çekiliyor (yukarıda). Bu sayfada aktivite mutasyonu (checkbox
  // onay vb.) yapılmıyor — o Aktivite Merkezi'nde; oraya gidip dönmek zaten (Next.js
  // dinamik sayfa cache'i yok) taze veriyle yeniden mount olur. Zamanlayıcıya gerek yok.

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

  // 2026-07-11/12 — bu sayfa operasyonun MERKEZ ekranı: grup/eğitmen/eğitim kataloğu
  // doğrudan bu sayfanın kendi verisi (groups/branches/trainers) — SADECE bunlar
  // değişince PAHALI `loadAll` (groups tüm-tenant enrollment okuması içerir) çalışır.
  useRealtimeSync(
    ["groups.changed", "trainers.changed", "educations.changed"],
    useCallback(() => { void loadAll(); }, [loadAll]),
  );
  // Satış/not/yoklama/öğrenci/aktivite ise SADECE "Operasyon Akışı" şeridini besliyor —
  // 2026-07-12 ACİL fix: bunlar için artık ucuz `loadActivitiesOnly`, pahalı `loadAll` DEĞİL
  // (bkz. yukarıdaki fix notu — kota olayının kök nedeni buydu).
  useRealtimeSync(
    ["students.changed", "sales.changed", "grades.changed", "attendance.changed", "activities.changed"],
    loadActivitiesOnly,
  );

  // ── branş renk paleti — donut ile Yaklaşan Sınıflar arasında tutarlı ──
  const branchColor = useMemo(() => {
    const m = new Map<string, string>();
    branches.forEach((b, i) => m.set(b.name, DONUT_PALETTE[i % DONUT_PALETTE.length]));
    return m;
  }, [branches]);

  // ── donut: dummy (bkz. DONUT_DUMMY yorumu) — Yaklaşan Sınıflar/Operasyon Akışı GERÇEK kalır ──
  const donut = useMemo(() => {
    const total = DONUT_DUMMY.reduce((a, s) => a + s.count, 0);
    const pieData = DONUT_DUMMY.map((s) => ({ name: s.label, value: s.count, color: s.color }));
    const legend = DONUT_DUMMY.map((s) => ({ label: s.label, count: s.count, pct: Math.round((s.count / total) * 100), color: s.color }));
    return { total, legend, pieData };
  }, []);

  // Donut halkası + ortasındaki sayı, sayfa yüklenince TEK saatten senkron açılır.
  const revealProgress = useAnimProgress(initialLoadDone);
  const donutTotalAnimated = Math.round(donut.total * revealProgress);

  // ── Yaklaşan Sınıflar: henüz başlamamış (planned/enrolling), yakın tarihten uzağa ──
  const yaklasanTumu = useMemo(() => {
    const t0 = todayStr();
    return groups
      .filter((g) => (g.status === "planned" || g.status === "enrolling") && g.schedule?.startDate && g.schedule.startDate >= t0)
      .map((g) => ({ ...g, gun: daysUntil(g.schedule.startDate!) }))
      .sort((a, b) => a.gun - b.gun);
  }, [groups]);
  const yaklasanSiniflar = useMemo(() => yaklasanTumu.slice(0, YAKLASAN_MAX), [yaklasanTumu]);
  // "Bu hafta" = başlangıcı bugün ile +7 gün arasında olan TÜM gruplar (durumdan bağımsız).
  const buHaftaSinifSayisi = useMemo(() => yaklasanTumu.filter((g) => g.gun <= 7).length, [yaklasanTumu]);

  // ── Eğitmen Takvimi mini-bilgi: GERÇEK — bugün dersi olan aktif grup sayısı + boşta
  // kalan eğitmen sayısı (toplam eğitmen − bugün en az bir dersi olan eğitmen). Çakışma
  // tespiti (aynı eğitmenin çakışan iki seansı) kullanıcı kararıyla kapsam dışı bırakıldı.
  const egitmenTakvimiStats = useMemo(() => {
    const todayDow = isoWeekday(new Date());
    const busyToday = new Set<string>();
    let bugunDersSayisi = 0;
    for (const g of groups) {
      if (g.status !== "active") continue;
      if (!g.schedule?.days?.includes(todayDow)) continue;
      bugunDersSayisi += 1;
      if (g.trainerId) busyToday.add(g.trainerId);
    }
    const bosEgitmen = Math.max(0, trainers.length - busyToday.size);
    return { bugunDersSayisi, bosEgitmen };
  }, [groups, trainers]);

  if (authed === null || !initialLoadDone) return null;

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh", overflow: "hidden", fontFamily: "'Inter', system-ui, sans-serif", color: "#1E222B" }}>
      <style>{`
        .eo-quick-card { transition: transform .15s ease, box-shadow .15s ease; }
        .eo-quick-card:hover { transform: translateY(-3px); box-shadow: 0 10px 24px -12px rgba(15,31,61,.3); }
        .eo-quick-icon { transition: transform .15s ease; }
        .eo-quick-card:hover .eo-quick-icon { transform: scale(1.05); }
        .eo-big-card { transition: transform .15s ease, box-shadow .15s ease; }
        .eo-big-card:hover { transform: translateY(-3px); box-shadow: 0 14px 30px -14px rgba(15,31,61,.32); }
        .eo-big-icon { transition: transform .15s ease; }
        .eo-big-card:hover .eo-big-icon { transform: scale(1.05); }
      `}</style>
      <FlexSidebar active="ana" />
      <main style={{ flex: 1, height: "100%", overflowY: "auto", background: "#EEF0F3", display: "flex", flexDirection: "column" }}>
        <FlexHeader greeting subtitle="Sınıflar, yoklamalar ve öğrenci operasyonları tek ekranda." roleLabel="Yönetici · Operasyon" />

        {/* `flex:1` BİLEREK yok — grid'e "doldurulacak fazla boşluk" verirsek (büyük ekranda
            içerik viewport'tan kısa kalınca) satırlar (auto auto auto) o boşluğu doldurmak
            için esner, bu da 2-3. satırı kapsayan Operasyon Akışı (mutlak konumlu, hücresini
            TAM dolduruyor) ile aynı satırlardaki Hızlı İşlemler'in (normal akış, esnemiyor)
            arasında yükseklik uyuşmazlığı yaratıyordu. Footer'ın kendi `mt-auto`'su zaten
            kısa içerikte alta yapışmayı sağlıyor — grid'in kendisi flex-grow olmasın. */}
        <div style={{ padding: "28px 36px 56px", maxWidth: FLEX_CONTENT_MAX_WIDTH, margin: "0 auto", width: "100%", boxSizing: "border-box", display: "grid", gridTemplateColumns: isCompactRow ? "1fr 340px" : "1fr 420px", gridTemplateRows: "auto auto auto", gap: 20, alignItems: "stretch" }}>

          {/* DONUT + LEGEND + ÖZET ŞERİDİ */}
          <div style={{ gridColumn: 1, gridRow: 1, background: "#fff", border: "1px solid #E2E5EA", borderRadius: 24, padding: "32px", boxShadow: "0 4px 20px -12px rgba(15,31,61,.15)", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#1E222B", letterSpacing: "-.2px" }}>Açık Eğitim Dağılımı</div>
                <div style={{ fontSize: 12.5, color: "#8E95A3", fontWeight: 500, marginTop: 2 }}>Aktif sınıfların branş kırılımı</div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#205297", background: "#DDE8F8", padding: "5px 12px", borderRadius: 999 }}>Bu Dönem</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 40, flexWrap: "wrap", flex: 1, justifyContent: "center" }}>
              <div style={{ position: "relative", width: 216, height: 216, flex: "0 0 auto" }}>
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
                  <div style={{ fontSize: 11, color: "#8E95A3", fontWeight: 600, marginTop: 3, whiteSpace: "nowrap" }}>Aktif Sınıf</div>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 240, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {donut.legend.map((l) => (
                  <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 14px", borderRadius: 13, background: "#F7F8FA", border: "1px solid #EEF0F3" }}>
                    <span style={{ width: 4, alignSelf: "stretch", minHeight: 34, borderRadius: 999, background: l.color, flex: "0 0 auto" }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                        <span style={{ fontSize: 19, fontWeight: 800, color: "#1E222B", letterSpacing: "-.4px", lineHeight: 1 }}>{l.pct}%</span>
                        <span style={{ fontSize: 11, color: "#AEB4C0", fontWeight: 600 }}>{l.count} sınıf</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#6F7B87", fontWeight: 600, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* özet metrik şeridi */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginTop: 8, paddingTop: 14, borderTop: "1px solid #EEF0F3" }}>
              <SummaryMetric label="Aktif Sınıf" value={String(donut.total)} bg="#DDE8F8" color="#205297" icon={IC.group} />
              <SummaryMetric label="Aktif Öğrenci" value={String(OZET_DUMMY.aktifOgrenci)} bg="#E6F5ED" color="#007A30" icon={IC.users} />
              <SummaryMetric label="Bu Hafta Başlayacak" value={String(OZET_DUMMY.buHaftaBaslayacak)} bg="#FFEAD7" color="#C2410C" icon={IC.calendar} />
              <SummaryMetric label="Sertifika Bekleyen" value={String(OZET_DUMMY.sertifikaBekleyen)} bg="#EDE4FB" color="#6B29A8" icon={IC.award} />
            </div>
          </div>

          {/* BÜYÜK İŞLEM KARTLARI */}
          <div style={{ gridColumn: 1, gridRow: 2, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <BigActionCard
              onClick={() => router.push("/flexos/siniflar")}
              icon={IC.plus} bg="#FFEAD7" color="#C2410C"
              baslik="Grup Oluştur" alt="Yeni sınıf aç"
              aciklama="Şube, branş, eğitmen ve seans bilgileriyle yeni bir sınıf grubu oluştur."
              cta="Sınıf Ekle" ctaColor="#C2410C"
            />
            <BigActionCard
              onClick={() => router.push("/flexos/yoklama/al")}
              icon={IC.attendance} bg="#DDE8F8" color="#205297"
              baslik="Yoklama Takibi" alt="Devamsızlık gir"
              aciklama="Aktif sınıfların günlük yoklamasını al, devamsızlıkları anında işle."
              cta="Yoklamaya Git" ctaColor="#205297"
            />
            {/* Eğitmen Takvimi — tam takvim ekranı henüz yok ("yakında" toast), ama mini
                bilgiler GERÇEK (groups+trainers'tan hesaplanıyor, bkz. egitmenTakvimiStats) */}
            <BigActionCard
              onClick={() => toast.info("Bu özellik yakında.")}
              icon={IC.calendar} bg="#AFF3F0" color="#0E5D59"
              baslik="Eğitmen Takvimi" alt="Ders programını gör"
              stats={[
                { label: "Bugün", value: `${egitmenTakvimiStats.bugunDersSayisi} ders` },
                { label: "Boş eğitmen", value: String(egitmenTakvimiStats.bosEgitmen) },
              ]}
              cta="Takvimi Aç" ctaColor="#0E5D59"
            />
          </div>

          {/* HIZLI İŞLEMLER */}
          <div style={{ gridColumn: 1, gridRow: 3 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C2410C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" /></svg>
              <span style={{ fontSize: 17, fontWeight: 800, color: "#1E222B", letterSpacing: "-.2px" }}>Hızlı İşlemler</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
              <QuickActionCard compact={isCompactRow} icon={IC.award} bg="#EDE4FB" color="#6B29A8" baslik="Sertifikasyon" alt="Belge hazırla" />
              <QuickActionCard compact={isCompactRow} icon={IC.survey} bg="#AFF3F0" color="#0E5D59" baslik="Anketler" alt="Memnuniyet & geri bildirim" />
              <QuickActionCard compact={isCompactRow} icon={IC.bell} bg="#DDE0FA" color="#4D52A6" baslik="Bildirim Merkezi" alt="SMS / e-posta gönder" />
              <QuickActionCard compact={isCompactRow} icon={IC.users} bg="#E6F5ED" color="#007A30" baslik="Öğrenci Havuzu" alt="Gruba atama yap" onClick={() => router.push("/flexos/ogrenciler/havuz")} />
            </div>
          </div>

          {/* RIGHT: YAKLAŞAN SINIFLAR */}
          <div style={{ gridColumn: 2, gridRow: 1, background: "#fff", border: "1px solid #E2E5EA", borderRadius: 24, padding: 20, boxShadow: "0 4px 20px -12px rgba(15,31,61,.15)", display: "flex", flexDirection: "column", minHeight: 214, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 16, flex: "0 0 auto" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: "#DDE8F8", color: "#205297", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /></svg>
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: "#1E222B" }}>Yaklaşan Sınıflar</div>
                  <div style={{ fontSize: 11.5, color: "#8E95A3", fontWeight: 500 }}>En yakın başlangıç tarihleri</div>
                </div>
              </div>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "#205297", background: "#DDE8F8", padding: "4px 10px", borderRadius: 999 }}>{yaklasanSiniflar.length} sınıf</span>
            </div>
            <div style={{ fontSize: 11, color: "#AEB4C0", fontWeight: 600, marginBottom: 10, flex: "0 0 auto" }}>
              Bu hafta: {buHaftaSinifSayisi} sınıf · Toplam bekleyen: {yaklasanTumu.length}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", flex: 1, minHeight: 0, paddingRight: 2 }}>
              {yaklasanSiniflar.length === 0 ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#8E95A3", fontSize: 13, fontWeight: 600 }}>Yaklaşan sınıf yok.</div>
              ) : yaklasanSiniflar.map((g) => {
                const yakin = g.gun <= YAKLASAN_YAKIN_GUN;
                const color = branchColor.get(g.branch) ?? "#8E95A3";
                return (
                  <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 12px", borderRadius: 12, border: "1px solid #EEF0F3", background: "#FBFCFD" }}>
                    <span style={{ width: 4, alignSelf: "stretch", minHeight: 30, borderRadius: 999, background: color, flex: "0 0 auto" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#1E222B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.code}</div>
                      <div style={{ fontSize: 11, color: "#8E95A3", fontWeight: 500, marginTop: 1, display: "flex", alignItems: "center", gap: 6 }}>
                        <span>{g.branch || "—"}</span><span style={{ color: "#CDD2DA" }}>•</span><span>{g.enrolled} öğrenci</span>
                      </div>
                    </div>
                    <span style={{ flex: "0 0 auto", padding: "5px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap", color: yakin ? "#C2410C" : "#6F7B87", background: yakin ? "#FFEAD7" : "#F2F4F7" }}>
                      {g.gun === 0 ? "Bugün" : `${g.gun} gün sonra`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT: OPERASYON AKIŞI */}
          <div style={{ gridColumn: 2, gridRow: "2 / span 2", position: "relative", minHeight: 0 }}>
            <div style={{ position: "absolute", inset: 0, background: "#fff", border: "1px solid #E2E5EA", borderRadius: 24, padding: "20px 20px 12px", boxShadow: "0 4px 20px -12px rgba(15,31,61,.15)", display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#3A7BD5,#205297)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 14px -6px rgba(32,82,151,.5)" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: "#1E222B" }}>Eğitim Operasyon Akışı</div>
                    <div style={{ fontSize: 11.5, color: "#8E95A3", fontWeight: 500 }}>Son operasyon hareketleri</div>
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
                ) : (
                  <AnimatePresence initial={false}>
                    {activities.map((a, i) => {
                      const meta = ACTIVITY_META[a.type];
                      return (
                        <motion.div
                          key={a.id}
                          layout
                          initial={{ opacity: 0, y: -24 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                          style={{ position: "relative", display: "flex", gap: 12, paddingBottom: 14 }}
                        >
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
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                )}
              </div>
            </div>
          </div>

        </div>
        <Footer mini containerClassName="w-full max-w-[1920px] mx-auto px-9" />
      </main>
    </div>
  );
}

// ── Özet metrik kartı (donut kartının alt şeridi) ──
function SummaryMetric({ label, value, bg, color, icon }: { label: string; value: string; bg: string; color: string; icon: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 42, height: 42, borderRadius: 12, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: bg, color }} dangerouslySetInnerHTML={{ __html: icon }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#1E222B", letterSpacing: "-.6px", lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 11.5, color: "#8E95A3", fontWeight: 600, marginTop: 4 }}>{label}</div>
      </div>
    </div>
  );
}

// ── Büyük işlem kartı (Grup Oluştur / Yoklama Takibi / Eğitmen Takvimi) ──
function BigActionCard({ onClick, icon, bg, color, baslik, alt, aciklama, stats, cta, ctaColor }: {
  onClick: () => void; icon: string; bg: string; color: string; baslik: string; alt: string;
  /** Sade açıklama metni — `stats` verilirse yok sayılır. */
  aciklama?: string;
  /** Canlı mini-bilgi satırları (ör. "Bugün: 8 ders") — verilirse `aciklama` yerine bu render edilir. */
  stats?: Array<{ label: string; value: string }>;
  cta: string; ctaColor: string;
}) {
  return (
    <button
      className="eo-big-card"
      onClick={onClick}
      style={{ textAlign: "left", textDecoration: "none", background: "#fff", border: "1px solid #E2E5EA", borderRadius: 22, padding: "30px 26px", minHeight: 230, display: "flex", flexDirection: "column", boxShadow: "0 4px 20px -12px rgba(15,31,61,.2)", cursor: "pointer", fontFamily: "inherit" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 14 }}>
        <div className="eo-big-icon" style={{ width: 42, height: 42, borderRadius: 12, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: bg, color }} dangerouslySetInnerHTML={{ __html: icon }} />
        <div>
          <div style={{ fontSize: 15.5, fontWeight: 800, color: "#1E222B", letterSpacing: "-.2px" }}>{baslik}</div>
          <div style={{ fontSize: 12, color: "#8E95A3", fontWeight: 500 }}>{alt}</div>
        </div>
      </div>
      {stats ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7, justifyContent: "center" }}>
          {stats.map((s) => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 10, background: "#F7F8FA" }}>
              <span style={{ fontSize: 12.5, color: "#6F7B87", fontWeight: 600 }}>{s.label}</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#1E222B" }}>{s.value}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ flex: 1, fontSize: 13, color: "#6F7B87", fontWeight: 500, lineHeight: 1.5 }}>{aciklama}</div>
      )}
      <div style={{ marginTop: 16, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "14px 18px", borderRadius: 12, background: "#fff", border: "1px solid #E2E5EA", color: ctaColor, fontSize: 13.5, fontWeight: 700 }}>
        {cta}
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
      </div>
    </button>
  );
}

// ── Hızlı işlem kartı (Sertifikasyon/Anketler/Bildirim — hiçbirinin backend'i yok) ──
function QuickActionCard({ icon, bg, color, baslik, alt, onClick, compact }: { icon: string; bg: string; color: string; baslik: string; alt: string; onClick?: () => void; compact?: boolean }) {
  const iconSize = compact ? 32 : 44;
  return (
    <button
      className="eo-quick-card"
      onClick={onClick ?? (() => toast.info("Bu özellik yakında."))}
      style={{
        textAlign: "left", textDecoration: "none", background: "#fff", border: "1px solid #E2E5EA", borderRadius: 20,
        padding: compact ? "18px 16px" : "30px 22px", minHeight: compact ? 100 : 120, justifyContent: compact ? "center" : undefined,
        display: "flex", flexDirection: compact ? "column" : "row", alignItems: compact ? "flex-start" : "center", gap: compact ? 8 : 14,
        boxShadow: "0 4px 20px -14px rgba(15,31,61,.22)", cursor: "pointer", fontFamily: "inherit", width: "100%", boxSizing: "border-box",
      }}
    >
      {compact ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
            <div className="eo-quick-icon" style={{ width: iconSize, height: iconSize, borderRadius: 10, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: bg, color }} dangerouslySetInnerHTML={{ __html: icon }} />
            <div style={{ fontSize: 13, fontWeight: 800, color: "#1E222B", letterSpacing: "-.2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{baslik}</div>
          </div>
          <div style={{ fontSize: 11, color: "#8E95A3", fontWeight: 500 }}>{alt}</div>
        </>
      ) : (
        <>
          <div className="eo-quick-icon" style={{ width: iconSize, height: iconSize, borderRadius: 13, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: bg, color }} dangerouslySetInnerHTML={{ __html: icon }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#1E222B", letterSpacing: "-.2px" }}>{baslik}</div>
            <div style={{ fontSize: 11.5, color: "#8E95A3", fontWeight: 500, marginTop: 2 }}>{alt}</div>
          </div>
        </>
      )}
    </button>
  );
}

// ── ikonlar ──
const sv = (inner: string, attrs = 'width="18" height="18"') =>
  `<svg ${attrs} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const IC = {
  group: sv('<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>'),
  users: sv('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
  calendar: sv('<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/>'),
  award: sv('<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>'),
  plus: sv('<path d="M5 12h14"/><path d="M12 5v14"/>', 'width="21" height="21" stroke-width="2.2"'),
  attendance: sv('<path d="M11 12H3"/><path d="M16 6H3"/><path d="M16 18H3"/><path d="m18 9 3 3-3 3"/>', 'width="21" height="21" stroke-width="2.2"'),
  survey: sv('<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z"/><polyline points="14,2 14,8 20,8"/><path d="m9 15 2 2 4-4"/>'),
  bell: sv('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>'),
};
