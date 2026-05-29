"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useUser } from "@/app/context/UserContext";
import { useRouter } from "next/navigation";
import { ArrowUpRight, CalendarCheck, ClipboardList, Award, Activity, BookOpen, Star, UserPlus, CheckCircle2, Clock, Users, UsersRound } from "lucide-react";

import Sidebar from "@/app/components/layout/Sidebar";
import Header from "@/app/components/layout/Header";
import DesignParkour from "@/app/components/dashboard/scoring/DesignParkour";
import AssignmentLibrary from "@/app/components/dashboard/assignment/AssignmentLibrary";
import { PERMISSIONS } from "@/app/lib/constants";
import { db } from "@/app/lib/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";

// ── Yoklama zaman penceresi yardımcıları (AttendancePanel ile aynı mantık) ────
const TR_DAYS: Record<string, number> = {
  pts: 1, pzt: 1, pazartesi: 1,
  sal: 2, sali: 2,
  çar: 3, car: 3, çarşamba: 3, carsamba: 3,
  per: 4, perşembe: 4, persembe: 4,
  cum: 5, cuma: 5,
  cts: 6, cmt: 6, cumartesi: 6,
  paz: 0, pazar: 0,
};
function parseWeekDaysHome(label: string): number[] {
  if (!label) return [];
  const lower = label.toLowerCase()
    .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g")
    .replace(/ü/g, "u").replace(/ö/g, "o");
  const found: number[] = [];
  for (const [key, day] of Object.entries(TR_DAYS))
    if (lower.includes(key) && !found.includes(day)) found.push(day);
  return found;
}
function parseSessionTimeHome(session: string): { start: number; end: number } | null {
  const match = session.match(/(\d{1,2})[.:](\d{2})\s*[-–]\s*(\d{1,2})[.:](\d{2})/);
  if (!match) return null;
  return {
    start: parseInt(match[1]) * 60 + parseInt(match[2]),
    end:   parseInt(match[3]) * 60 + parseInt(match[4]),
  };
}
const ATTEND_BEFORE_MIN = 15;
const ATTEND_AFTER_MIN  = 180;

// ─── İstatistik Banner ───────────────────────────────────────────────────────
function StatBox({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
  return (
    <div className="bg-white/5 border border-white/8 rounded-2xl flex flex-col items-center justify-center text-center py-8 px-4">
      <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center text-white/60 mb-4">
        {icon}
      </div>
      <span className="text-[13px] text-white/50 font-medium mb-2 tracking-tight">{label}</span>
      <span className="text-[36px] font-bold text-white leading-none tracking-tighter">{value}</span>
    </div>
  );
}

function HomeBanner() {
  const [groupCount,   setGroupCount]   = useState<number>(0);
  const [studentCount, setStudentCount] = useState<number>(0);
  const [taskCount,    setTaskCount]    = useState<number>(0);

  useEffect(() => {
    const unsub1 = onSnapshot(query(collection(db, "groups"),   where("status", "==", "active")), s => setGroupCount(s.size));
    const unsub2 = onSnapshot(query(collection(db, "students"), where("status", "==", "active")), s => setStudentCount(s.size));
    const unsub3 = onSnapshot(query(collection(db, "tasks"),    where("isActive", "==", true)),   s => setTaskCount(s.size));
    return () => { unsub1(); unsub2(); unsub3(); };
  }, []);

  return (
    <div className="bg-[#10294C] rounded-2xl p-8 text-white relative overflow-hidden border border-white/5 shadow-lg w-full">
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF8D28]/10 blur-[100px] -mr-32 -mt-32 pointer-events-none" />
      <div className="relative z-10">
        <span className="text-[11px] bg-white/5 px-4 py-1.5 rounded-full border border-white/10 text-[#FF8D28] font-bold tracking-widest">
          Atölye Özeti
        </span>
        <h2 className="text-[28px] font-semibold tracking-tight leading-tight mt-3 mb-8">
          Atölyendeki güncel <span className="text-[#FF8D28]">istatistikler.</span>
        </h2>
        <div className="grid grid-cols-3 gap-5">
          <StatBox label="Sınıf"    value={groupCount}   icon={<UsersRound  size={22} />} />
          <StatBox label="Öğrenci"  value={studentCount} icon={<Users       size={22} />} />
          <StatBox label="Ödev"     value={taskCount}    icon={<ClipboardList size={22} />} />
        </div>
      </div>
    </div>
  );
}

// ─── Aktivite tipi tanımları ─────────────────────────────────────────────────
type ActivityType = "odev" | "yoklama" | "not" | "ogrenci" | "tamamlandi" | "sistem";

interface ActivityItem {
  id: number;
  type: ActivityType;
  title: string;
  desc: string;
  time: string;
}

const ACTIVITY_CONFIG: Record<ActivityType, { icon: React.ReactNode; bg: string; color: string }> = {
  odev:       { icon: <BookOpen size={13} strokeWidth={2.2} />,    bg: "bg-[#FFF4EB]",  color: "text-[#FF8D28]"  },
  yoklama:    { icon: <CalendarCheck size={13} strokeWidth={2.2} />, bg: "bg-[#EEF4FD]",  color: "text-[#3A7BD5]"  },
  not:        { icon: <Star size={13} strokeWidth={2.2} />,         bg: "bg-[#E6F5ED]",  color: "text-[#009F3E]"  },
  ogrenci:    { icon: <UserPlus size={13} strokeWidth={2.2} />,     bg: "bg-[#F1F2FD]",  color: "text-[#6F74D8]"  },
  tamamlandi: { icon: <CheckCircle2 size={13} strokeWidth={2.2} />, bg: "bg-[#E6F5ED]",  color: "text-[#009F3E]"  },
  sistem:     { icon: <Activity size={13} strokeWidth={2.2} />,     bg: "bg-surface-100", color: "text-surface-500" },
};

const MOCK_ACTIVITIES: ActivityItem[] = [
  { id:  1, type: "odev",       title: "Yeni ödev teslimi",  desc: "Elif Yıldız — Kolaj Bahçesi",        time: "2 dk önce"  },
  { id:  2, type: "yoklama",    title: "Yoklama alındı",      desc: "Grup 541 — 18/20 öğrenci",           time: "14 dk önce" },
  { id:  3, type: "not",        title: "Not girildi",         desc: "Ahmet Demir — Kurumsal Kimlik 87p",  time: "32 dk önce" },
  { id:  4, type: "ogrenci",    title: "Yeni öğrenci kaydı", desc: "Zeynep Kara — Grup 201",             time: "1 sa önce"  },
  { id:  5, type: "tamamlandi", title: "Ödev tamamlandı",    desc: "Kitap Dünyası — Grup 102",           time: "2 sa önce"  },
  { id:  6, type: "odev",       title: "Yeni ödev teslimi",  desc: "Can Öztürk — Sosyal Medya",          time: "3 sa önce"  },
  { id:  7, type: "yoklama",    title: "Yoklama alındı",      desc: "Grup 303 — 14/16 öğrenci",           time: "5 sa önce"  },
  { id:  8, type: "not",        title: "Not girildi",         desc: "Selin Aydın — Logo Tasarım 92p",     time: "6 sa önce"  },
  { id:  9, type: "odev",       title: "Yeni ödev teslimi",  desc: "Mert Yılmaz — Tipografi",            time: "7 sa önce"  },
  { id: 10, type: "ogrenci",    title: "Yeni öğrenci kaydı", desc: "Deniz Şahin — Grup 404",             time: "8 sa önce"  },
  { id: 11, type: "tamamlandi", title: "Ödev tamamlandı",    desc: "Sosyal Medya — Grup 201",            time: "9 sa önce"  },
  { id: 12, type: "yoklama",    title: "Yoklama alındı",      desc: "Grup 102 — 12/14 öğrenci",           time: "10 sa önce" },
  { id: 13, type: "odev",       title: "Yeni ödev teslimi",  desc: "Ayşe Kılıç — Renk Teorisi",          time: "11 sa önce" },
  { id: 14, type: "not",        title: "Not girildi",         desc: "Berk Arslan — Ambalaj Tasarım 78p",  time: "12 sa önce" },
  { id: 15, type: "ogrenci",    title: "Yeni öğrenci kaydı", desc: "Canan Yıldız — Grup 550",            time: "13 sa önce" },
];

// ─── En Son Aktiviteler Paneli ───────────────────────────────────────────────
function ActivityFeed() {
  return (
    <div className="bg-white rounded-2xl border border-surface-200 flex flex-col h-full">

      {/* Başlık */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-surface-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-base-primary-900 flex items-center justify-center shrink-0">
            <Activity size={16} className="text-white" strokeWidth={2} />
          </div>
          <div>
            <p className="text-[15px] font-bold text-text-primary tracking-tight leading-none">En Son Aktiviteler</p>
            <p className="text-[11px] text-text-tertiary mt-0.5 leading-none">Atölyendeki son hareketler</p>
          </div>
        </div>
      </div>

      {/* Liste */}
      <div
        className="overflow-y-auto activity-scroll [scrollbar-gutter:stable]"
        style={{
          maxHeight: "calc((7 * 56px) + 24px)",
          paddingTop: "12px",
          paddingBottom: "24px",
          paddingLeft: "16px",
          paddingRight: "16px",
          boxSizing: "border-box",
        }}
      >
        {MOCK_ACTIVITIES.map((item, i) => {
          const cfg = ACTIVITY_CONFIG[item.type];
          return (
            <div
              key={item.id}
              className={`h-[56px] shrink-0 flex items-center gap-3 w-full hover:bg-surface-50 transition-colors cursor-default
                          ${i < MOCK_ACTIVITIES.length - 1 ? "border-b border-surface-100" : ""}`}
            >
              {/* İkon */}
              <div className={`w-7 h-7 rounded-xl ${cfg.bg} ${cfg.color} flex items-center justify-center shrink-0 mt-0.5`}>
                {cfg.icon}
              </div>

              {/* İçerik */}
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-bold text-text-primary leading-snug truncate">{item.title}</p>
                <p className="text-[11.5px] text-text-tertiary leading-snug truncate mt-0.5">{item.desc}</p>
              </div>

              {/* Zaman */}
              <div className="flex items-center gap-1 shrink-0 mt-0.5">
                <Clock size={10} className="text-surface-400" />
                <span className="text-[10.5px] text-surface-400 font-medium whitespace-nowrap">{item.time}</span>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}

// ─── Hızlı Eylem Kartı ──────────────────────────────────────────────────────
function QuickActionCard({
  icon,
  label,
  href,
  meta,
  statusText,
  statusColor = "text-[#10294C]",
  iconBg = "bg-[#F7F8FA]",
  iconColor = "text-[#8E95A3]",
  badge = false,
  pulse = false,
  onBeforeNavigate,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
  meta?: string;
  statusText?: string;
  statusColor?: string;
  iconBg?: string;
  iconColor?: string;
  badge?: boolean;
  pulse?: boolean;
  onBeforeNavigate?: () => void;
}) {
  const router = useRouter();
  return (
    <div
      onClick={() => { onBeforeNavigate?.(); router.push(href); }}
      className="bg-white rounded-2xl border border-[#E2E5EA] p-6 flex flex-col justify-between cursor-pointer min-h-[160px]
                 hover:shadow-[0_8px_30px_-8px_rgba(16,41,76,0.12)] hover:-translate-y-0.5 transition-all duration-200 select-none"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center" style={{ gap: '8px' }}>
          <div className={`w-9 h-9 rounded-xl ${iconBg} ${iconColor} flex items-center justify-center shrink-0`}>
            {icon}
          </div>
          <p className="text-[15px] font-bold text-[#10294C]">{label}</p>
        </div>
        <div className="w-8 h-8 rounded-full border border-[#E2E5EA] flex items-center justify-center text-[#10294C] hover:bg-[#F7F8FA] transition-colors shrink-0">
          <ArrowUpRight size={15} strokeWidth={2} />
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        {meta && <span className="text-[12px] text-[#8E95A3] min-w-0 truncate">{meta}</span>}
        {statusText && (
          badge
            ? (
              <div className="relative ml-auto shrink-0">
                {pulse && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#009F3E] rounded-full animate-ping opacity-75" />
                )}
                <span className={`text-[12px] font-bold px-4 py-1.5 rounded-full ${statusColor} whitespace-nowrap block`}>{statusText}</span>
              </div>
            )
            : <span className={`text-[13px] font-bold ${statusColor} ${meta ? "ml-auto" : ""} whitespace-nowrap shrink-0`}>{statusText}</span>
        )}
      </div>
    </div>
  );
}

// ─── Footer (sosyal medya olmadan, kısa) ────────────────────────────────────
function FooterV2() {
  const router = useRouter();
  return (
    <footer className="w-full bg-[#10294C] border-t border-white/5 mt-auto font-inter shrink-0">
      <div className="w-[94%] mx-auto h-14 flex items-center justify-between max-w-[1300px] xl:max-w-[1440px] 2xl:max-w-[1620px]">
        <div className="cursor-pointer" onClick={() => router.push("/dashboard/home-v2")}>
          <img src="/assets/flex-logo-white.svg" width={70} alt="flex" />
        </div>
        <p className="text-[11px] font-normal text-white/60 tracking-wide">
          Copyright © Alparslan Şentürk 2026. Tüm Hakları Saklıdır.
        </p>
      </div>
    </footer>
  );
}

// ─── Sayfa ───────────────────────────────────────────────────────────────────
export default function HomeV2Page() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { hasPermission, user, loading } = useUser();
  const router = useRouter();

  const [activeTaskCount,   setActiveTaskCount]   = useState<number | null>(null);
  const [attendMetaText,    setAttendMetaText]    = useState("");          // "" → tarihi göster
  const [attendancePulse,   setAttendancePulse]   = useState(false);
  const [odevPulse,         setOdevPulse]         = useState(false);

  // Refs — snapshot callback'lerinde güncel kalır
  const activeGroupsRef  = useRef<Array<{ id: string; code: string; session: string; type: string }>>([]);
  const todayAttendedRef = useRef<Set<string>>(new Set());   // bugün doc'u olan groupId'ler
  const holidayDatesRef  = useRef<Set<string>>(new Set());
  const todayKeyRef      = useRef<string>("");

  // Yoklama pulse'ı hesapla (holiday + time window + localStorage dismiss)
  const computeAttendPulse = useCallback(() => {
    const key = todayKeyRef.current;

    // Tatil günü → kesinlikle sönük
    if (holidayDatesRef.current.has(key)) {
      setAttendMetaText(""); setAttendancePulse(false); return;
    }

    // Kullanıcı daha önce incelediyse (attend sayfasına gittiyse) → sönük
    if (typeof window !== "undefined" && localStorage.getItem(`attend_dismissed_${key}`)) {
      setAttendMetaText(""); setAttendancePulse(false); return;
    }

    const now     = new Date();
    const todayDay = now.getDay();
    const nowMins  = now.getHours() * 60 + now.getMinutes();

    const pendingCodes: string[] = [];
    for (const g of activeGroupsRef.current) {
      if (todayAttendedRef.current.has(g.id)) continue;   // doc mevcut = başlatıldı
      // Standart gruplar Cuma'da tatil — pulse atla
      if (g.type === "standart" && todayDay === 5) continue;
      if (!parseWeekDaysHome(g.session).includes(todayDay)) continue;
      const tr = parseSessionTimeHome(g.session);
      if (!tr) continue;
      if (nowMins < tr.start - ATTEND_BEFORE_MIN || nowMins > tr.end + ATTEND_AFTER_MIN) continue;
      pendingCodes.push(g.code);
    }

    if (pendingCodes.length === 0) {
      setAttendMetaText(""); setAttendancePulse(false);
    } else if (pendingCodes.length === 1) {
      setAttendMetaText(pendingCodes[0]); setAttendancePulse(true);
    } else {
      setAttendMetaText(`${pendingCodes.length} grup`); setAttendancePulse(true);
    }
  }, []);

  useEffect(() => {
    const d   = new Date();
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    todayKeyRef.current = key;

    // Tatilleri dinle
    const unsubHolidays = onSnapshot(collection(db, "holidays"), snap => {
      const dates = new Set<string>();
      snap.docs.forEach(doc => {
        const { startDate, endDate } = doc.data() as { startDate: string; endDate: string };
        const cur = new Date(startDate + "T12:00:00");
        const end = new Date(endDate   + "T12:00:00");
        while (cur <= end) { dates.add(cur.toISOString().slice(0, 10)); cur.setDate(cur.getDate() + 1); }
      });
      holidayDatesRef.current = dates;
      computeAttendPulse();
    });

    // Aktif grupları dinle
    const unsubGroups = onSnapshot(
      query(collection(db, "groups"), where("status", "==", "active")),
      snap => {
        activeGroupsRef.current = snap.docs.map(doc => ({
          id:        doc.id,
          code:      (doc.data().code      ?? "") as string,
          session:   (doc.data().session   ?? "") as string,
          type: (doc.data().type ?? "") as string,
        }));
        computeAttendPulse();
      }
    );

    // Bugünkü yoklama dokümanları (var mı = başlatıldı)
    const unsubAttend = onSnapshot(
      query(collection(db, "design_attendance"), where("date", "==", key)),
      snap => {
        todayAttendedRef.current = new Set(snap.docs.map(doc => doc.data().groupId as string));
        computeAttendPulse();
      }
    );

    // Aktif görev sayısı
    const unsubTasks = onSnapshot(
      query(collection(db, "tasks"), where("isActive", "==", true)),
      snap => {
        const count = snap.size;
        setActiveTaskCount(count);
        const dismissed = typeof window !== "undefined" && localStorage.getItem(`assignment_dismissed_${key}`);
        setOdevPulse(count > 0 && !dismissed);
      }
    );

    // Her dakika yeniden hesapla (zaman penceresi değişebilir)
    const interval = setInterval(computeAttendPulse, 60_000);

    return () => { unsubHolidays(); unsubGroups(); unsubAttend(); unsubTasks(); clearInterval(interval); };
  }, [computeAttendPulse]);

  const handleScroll = (dir: "left" | "right") => {
    if (scrollRef.current) {
      const amt = scrollRef.current.offsetWidth / 4.3;
      scrollRef.current.scrollBy({ left: dir === "left" ? -amt : amt, behavior: "smooth" });
    }
  };

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handleScroll("left");
      else if (e.key === "ArrowRight") handleScroll("right");
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (loading || !user) return null;

  const today = new Date();
  const todayFormatted = `${String(today.getDate()).padStart(2, "0")}.${String(today.getMonth() + 1).padStart(2, "0")}.${today.getFullYear()}`;

  return (
    <div className="flex h-screen overflow-hidden bg-[#F9FAFB] font-inter antialiased text-text-primary">

      {/* SOL: SIDEBAR */}
      <aside className="hidden lg:block h-full shrink-0 z-50 transition-all duration-300 w-[280px] 2xl:w-[320px] bg-[#10294C]">
        <Sidebar logo={<img src="/assets/flex-logo-title-white.svg" width={165} alt="flex" />} />
      </aside>

      {/* SAĞ: CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 relative h-full">
        <Header innerClassName="w-[94%] max-w-[1300px] xl:max-w-[1440px] 2xl:max-w-[1620px]" />

        <main className="flex-1 w-full overflow-y-scroll overflow-x-clip [scrollbar-gutter:stable]">
          <div className="w-[94%] mx-auto pt-6 pb-8 max-w-[1300px] xl:max-w-[1440px] 2xl:max-w-[1620px]">
            <div className="space-y-10">

              {/* ── Üst Blok: Sol sütun (banner + 3 kart) + Sağ aktiviteler ── */}
              <div className="flex flex-col xl:flex-row gap-6 items-stretch">

                {/* Sol sütun: üst geniş alan + 3 hızlı eylem kartı */}
                <div className="flex-1 min-w-0 flex flex-col gap-6">
                  <HomeBanner />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <QuickActionCard
                      icon={<CalendarCheck size={18} />}
                      label="Hızlı Yoklama"
                      href="/attend"
                      meta={attendMetaText || todayFormatted}
                      statusText="Derse Git"
                      statusColor="bg-[#009F3E] text-white"
                      iconBg="bg-[#EEF4FD]"
                      iconColor="text-[#3A7BD5]"
                      badge
                      pulse={attendancePulse}
                      onBeforeNavigate={() => {
                        localStorage.setItem(`attend_dismissed_${todayKeyRef.current}`, "1");
                        setAttendancePulse(false);
                        setAttendMetaText("");
                      }}
                    />
                    <QuickActionCard
                      icon={<ClipboardList size={18} />}
                      label="Ödev Teslimi"
                      href="/dashboard/assignment"
                      meta={activeTaskCount !== null ? `${activeTaskCount} aktif ödev` : "—"}
                      statusText="İncele"
                      statusColor="bg-[#FF8D28] text-white"
                      iconBg="bg-[#FFF4EB]"
                      iconColor="text-[#FF8D28]"
                      badge
                    />
                    <QuickActionCard
                      icon={<Award size={18} />}
                      label="Sertifikasyon"
                      href="/dashboard/graduation"
                      meta="Not girişi bekliyor"
                      statusText="Not Gir"
                      statusColor="bg-[#6F74D8] text-white"
                      iconBg="bg-[#F1F2FD]"
                      iconColor="text-[#6F74D8]"
                      badge
                    />
                  </div>
                </div>

                {/* Sağ sütun: banner'dan kartların bitimine kadar uzanır */}
                <div className="w-full xl:w-[380px] shrink-0 flex flex-col">
                  <ActivityFeed />
                </div>
              </div>

              {/* ── Ödev Parkuru (mevcut bileşen, değişmedi) ── */}
              <DesignParkour />

              {/* ── Ödev Kütüphanesi (mevcut bileşen, değişmedi) ── */}
              {(hasPermission(PERMISSIONS.ASSIGNMENT_MANAGE) || user?.roles?.includes("instructor")) && (
                <AssignmentLibrary scrollRef={scrollRef} handleScroll={handleScroll} />
              )}
            </div>
          </div>
        </main>

        <FooterV2 />
      </div>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

        .activity-scroll::-webkit-scrollbar { width: 4px; }
        .activity-scroll::-webkit-scrollbar-track { background: transparent; margin: 4px 0; }
        .activity-scroll::-webkit-scrollbar-thumb {
          background: #CBD5E1;
          border-radius: 999px;
        }
        .activity-scroll::-webkit-scrollbar-thumb:hover {
          background: #10294C;
        }
        .activity-scroll {
          scrollbar-width: thin;
          scrollbar-color: #CBD5E1 transparent;
          box-sizing: border-box;
          scrollbar-gutter: stable;
        }
      `}</style>
    </div>
  );
}
