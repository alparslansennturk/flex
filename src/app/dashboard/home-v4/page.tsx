"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useUser } from "@/app/context/UserContext";
import { useRouter } from "next/navigation";
import {
  CalendarCheck, ClipboardList, Award, Activity, BookOpen,
  Star, UserPlus, CheckCircle2, Clock, Users, UsersRound,
} from "lucide-react";

import Sidebar from "@/app/components/layout/Sidebar";
import Header  from "@/app/components/layout/Header";
import DesignParkour    from "@/app/components/dashboard/scoring/DesignParkour";
import AssignmentLibrary from "@/app/components/dashboard/assignment/AssignmentLibrary";
import { PERMISSIONS }  from "@/app/lib/constants";
import { db } from "@/app/lib/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";

// ── Yoklama zaman penceresi yardımcıları ──────────────────────────────────────
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
    .replace(/ı/g, "i").replace(/ş/g, "s")
    .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ö/g, "o");
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

// ─── Banner ───────────────────────────────────────────────────────────────────
function StatBox({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="bg-white/5 border border-white/8 rounded-xl flex flex-col items-center justify-center text-center py-5 px-3">
      <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center text-white/50 mb-3">
        {icon}
      </div>
      <span className="text-[11px] text-white/40 font-semibold mb-1.5 tracking-tight">{label}</span>
      <span className="text-[28px] font-bold text-white leading-none tracking-tighter">{value}</span>
    </div>
  );
}

function HomeBannerV4() {
  const [groupCount,   setGroupCount]   = useState(0);
  const [studentCount, setStudentCount] = useState(0);
  const [taskCount,    setTaskCount]    = useState(0);

  useEffect(() => {
    const noop = () => {};
    const u1 = onSnapshot(query(collection(db, "groups"),   where("status",   "==", "active")), s => setGroupCount(s.size),   noop);
    const u2 = onSnapshot(query(collection(db, "students"), where("status",   "==", "active")), s => setStudentCount(s.size), noop);
    const u3 = onSnapshot(query(collection(db, "tasks"),    where("isActive", "==", true)),     s => setTaskCount(s.size),    noop);
    return () => { u1(); u2(); u3(); };
  }, []);

  return (
    <div className="bg-[#10294C] rounded-2xl p-6 text-white relative overflow-hidden border border-white/5 shadow-lg w-full">
      <div className="absolute top-0 right-0 w-56 h-56 bg-[#FF8D28]/10 blur-[90px] -mr-24 -mt-24 pointer-events-none" />
      <div className="relative z-10">
        <span className="text-[10px] bg-white/5 px-3 py-1 rounded-full border border-white/10 text-[#FF8D28] font-bold tracking-widest">
          Atölye Özeti
        </span>
        <h2 className="text-[22px] font-semibold tracking-tight leading-tight mt-2.5 mb-5">
          Atölyendeki güncel <span className="text-[#FF8D28]">istatistikler.</span>
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <StatBox label="Sınıf"   value={groupCount}   icon={<UsersRound    size={18} />} />
          <StatBox label="Öğrenci" value={studentCount} icon={<Users         size={18} />} />
          <StatBox label="Ödev"    value={taskCount}    icon={<ClipboardList size={18} />} />
        </div>
      </div>
    </div>
  );
}

// ─── Aktivite tipi tanımları ──────────────────────────────────────────────────
type ActivityType = "odev" | "yoklama" | "not" | "ogrenci" | "tamamlandi" | "sistem";
interface ActivityItem { id: number; type: ActivityType; title: string; desc: string; time: string; }

const ACTIVITY_CONFIG: Record<ActivityType, { icon: React.ReactNode; bg: string; color: string; stripe: string }> = {
  odev:       { icon: <BookOpen     size={13} strokeWidth={2.2} />, bg: "bg-[#FFF4EB]",  color: "text-[#FF8D28]",  stripe: "bg-[#FF8D28]"  },
  yoklama:    { icon: <CalendarCheck size={13} strokeWidth={2.2} />, bg: "bg-[#EEF4FD]",  color: "text-[#3A7BD5]",  stripe: "bg-[#3A7BD5]"  },
  not:        { icon: <Star         size={13} strokeWidth={2.2} />, bg: "bg-[#E6F5ED]",  color: "text-[#009F3E]",  stripe: "bg-[#009F3E]"  },
  ogrenci:    { icon: <UserPlus     size={13} strokeWidth={2.2} />, bg: "bg-[#F1F2FD]",  color: "text-[#6F74D8]",  stripe: "bg-[#6F74D8]"  },
  tamamlandi: { icon: <CheckCircle2 size={13} strokeWidth={2.2} />, bg: "bg-[#E6F5ED]",  color: "text-[#009F3E]",  stripe: "bg-[#009F3E]"  },
  sistem:     { icon: <Activity     size={13} strokeWidth={2.2} />, bg: "bg-[#F7F8FA]",  color: "text-[#8E95A3]",  stripe: "bg-[#C4C9D4]"  },
};

const MOCK_ACTIVITIES: ActivityItem[] = [
  { id: 1, type: "odev",       title: "Yeni ödev teslimi",  desc: "Elif Yıldız — Kolaj Bahçesi",        time: "2 dk önce"  },
  { id: 2, type: "yoklama",    title: "Yoklama alındı",     desc: "Grup 541 — 18/20 öğrenci",           time: "14 dk önce" },
  { id: 3, type: "not",        title: "Not girildi",        desc: "Ahmet Demir — Kurumsal Kimlik 87p",  time: "32 dk önce" },
  { id: 4, type: "ogrenci",    title: "Yeni öğrenci kaydı", desc: "Zeynep Kara — Grup 201",            time: "1 sa önce"  },
  { id: 5, type: "tamamlandi", title: "Ödev tamamlandı",   desc: "Kitap Dünyası — Grup 102",           time: "2 sa önce"  },
];

// ─── Aktiviteler Paneli ───────────────────────────────────────────────────────
function ActivityFeed() {
  return (
    <div className="bg-white rounded-2xl border border-[#E8ECF2] flex flex-col overflow-hidden">
      {/* Başlık */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#F0F2F6] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#10294C] flex items-center justify-center shrink-0">
            <Activity size={16} className="text-white" strokeWidth={2} />
          </div>
          <div>
            <p className="text-[14px] font-bold text-[#10294C] leading-none">En Son Aktiviteler</p>
            <p className="text-[11px] text-[#9CA3AF] mt-0.5 leading-none">Atölyendeki son hareketler</p>
          </div>
        </div>
        <span className="text-[10px] font-bold text-white bg-[#10294C]/10 text-[#10294C] px-2.5 py-1 rounded-full">
          Canlı
        </span>
      </div>

      {/* Liste */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {MOCK_ACTIVITIES.map((item, i) => {
          const cfg = ACTIVITY_CONFIG[item.type];
          return (
            <div
              key={item.id}
              className={`flex items-start gap-3 px-4 py-3 hover:bg-[#F9FAFB] transition-colors cursor-default relative
                          ${i < MOCK_ACTIVITIES.length - 1 ? "border-b border-[#F3F4F6]" : ""}`}
            >
              {/* Renkli sol şerit */}
              <div className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full ${cfg.stripe} opacity-70`} />

              {/* İkon */}
              <div className={`w-7 h-7 rounded-lg ${cfg.bg} ${cfg.color} flex items-center justify-center shrink-0 mt-0.5 ml-2`}>
                {cfg.icon}
              </div>

              {/* İçerik */}
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-bold text-[#10294C] leading-snug truncate">{item.title}</p>
                <p className="text-[11.5px] text-[#9CA3AF] leading-snug truncate mt-0.5">{item.desc}</p>
              </div>

              {/* Zaman */}
              <div className="flex items-center gap-1 shrink-0 mt-0.5">
                <Clock size={10} className="text-[#C4C9D4]" />
                <span className="text-[10.5px] text-[#C4C9D4] font-medium whitespace-nowrap">{item.time}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-5 py-3.5 border-t border-[#F0F2F6] shrink-0">
        <button className="w-full h-9 rounded-xl border border-[#E8ECF2] text-[12px] font-bold text-[#6B7280]
                           hover:bg-[#F9FAFB] hover:border-[#D1D5DB] transition-all cursor-pointer">
          Tüm Aktiviteleri Gör
        </button>
      </div>
    </div>
  );
}

// ─── Hızlı Eylem Kartı ────────────────────────────────────────────────────────
function QuickActionCard({
  icon, label, href, meta, statusText,
  statusColor = "bg-[#10294C] text-white",
  iconBg      = "bg-[#F7F8FA]",
  iconColor   = "text-[#8E95A3]",
  cardTint    = "",
  accentColor = "",
  pulse = false,
  onBeforeNavigate,
}: {
  icon:    React.ReactNode;
  label:   string;
  href:    string;
  meta?:   string;
  statusText?:  string;
  statusColor?: string;
  iconBg?:      string;
  iconColor?:   string;
  cardTint?:    string;
  accentColor?: string;
  pulse?:       boolean;
  onBeforeNavigate?: () => void;
}) {
  const router = useRouter();
  return (
    <div
      onClick={() => { onBeforeNavigate?.(); router.push(href); }}
      className={`${cardTint || "bg-white"} rounded-2xl border border-transparent flex flex-col cursor-pointer min-h-[155px] overflow-hidden
                 hover:shadow-[0_16px_48px_-12px_rgba(16,41,76,0.16)] hover:-translate-y-1
                 transition-all duration-200 select-none group`}
    >
      {/* Üst renk şeridi */}
      {accentColor && <div className={`h-1 w-full ${accentColor} shrink-0`} />}

      {/* İçerik */}
      <div className="p-5 flex flex-col flex-1">
      {/* Üst: ikon + etiket */}
      <div className="flex items-start gap-3 mb-auto">
        <div className={`w-11 h-11 rounded-xl ${iconBg} ${iconColor} flex items-center justify-center shrink-0
                         group-hover:scale-110 transition-transform duration-200`}>
          {icon}
        </div>
        <p className="text-[15px] font-bold text-[#10294C] leading-snug mt-0.5">{label}</p>
      </div>

      {/* Alt: meta + badge */}
      <div className="flex items-center justify-between gap-2 mt-4">
        {meta && (
          <span className="text-[12px] text-[#64748B] font-medium min-w-0 truncate">{meta}</span>
        )}
        {statusText && (
          <div className="relative ml-auto shrink-0">
            {pulse && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#009F3E] rounded-full animate-ping opacity-75" />
            )}
            <span className={`text-[12px] font-bold px-4 py-1.5 rounded-full ${statusColor} whitespace-nowrap block`}>
              {statusText}
            </span>
          </div>
        )}
      </div>
      </div>{/* içerik sonu */}
    </div>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function FooterV4() {
  const router = useRouter();
  return (
    <footer className="w-full bg-[#10294C] border-t border-white/5 mt-auto font-inter shrink-0">
      <div className="w-[94%] mx-auto h-14 flex items-center justify-between max-w-[1300px] xl:max-w-[1440px] 2xl:max-w-[1620px]">
        <div className="cursor-pointer" onClick={() => router.push("/dashboard/home-v4")}>
          <img src="/assets/flex-logo-white.svg" width={70} alt="flex" />
        </div>
        <p className="text-[11px] font-normal text-white/60 tracking-wide">
          Copyright © Alparslan Şentürk 2026. Tüm Hakları Saklıdır.
        </p>
      </div>
    </footer>
  );
}

// ─── Sayfa ────────────────────────────────────────────────────────────────────
export default function HomeV4Page() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { hasPermission, user, loading } = useUser();
  const router = useRouter();

  const [activeTaskCount, setActiveTaskCount] = useState<number | null>(null);
  const [attendMetaText,  setAttendMetaText]  = useState("");
  const [attendancePulse, setAttendancePulse] = useState(false);

  const activeGroupsRef  = useRef<Array<{ id: string; code: string; session: string }>>([]);
  const todayAttendedRef = useRef<Set<string>>(new Set());
  const holidayDatesRef  = useRef<Set<string>>(new Set());
  const todayKeyRef      = useRef<string>("");

  const computeAttendPulse = useCallback(() => {
    const key = todayKeyRef.current;
    if (holidayDatesRef.current.has(key)) {
      setAttendMetaText(""); setAttendancePulse(false); return;
    }
    if (typeof window !== "undefined" && localStorage.getItem(`attend_dismissed_${key}`)) {
      setAttendMetaText(""); setAttendancePulse(false); return;
    }
    const now      = new Date();
    const todayDay = now.getDay();
    const nowMins  = now.getHours() * 60 + now.getMinutes();
    const pendingCodes: string[] = [];
    for (const g of activeGroupsRef.current) {
      if (todayAttendedRef.current.has(g.id)) continue;
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

    const noop = () => {};

    const uHolidays = onSnapshot(collection(db, "holidays"), snap => {
      const dates = new Set<string>();
      snap.docs.forEach(doc => {
        const { startDate, endDate } = doc.data() as { startDate: string; endDate: string };
        const cur = new Date(startDate + "T12:00:00");
        const end = new Date(endDate   + "T12:00:00");
        while (cur <= end) { dates.add(cur.toISOString().slice(0, 10)); cur.setDate(cur.getDate() + 1); }
      });
      holidayDatesRef.current = dates;
      computeAttendPulse();
    }, noop);

    const uGroups = onSnapshot(
      query(collection(db, "groups"), where("status", "==", "active")),
      snap => {
        activeGroupsRef.current = snap.docs.map(doc => ({
          id:      doc.id,
          code:    (doc.data().code    ?? "") as string,
          session: (doc.data().session ?? "") as string,
        }));
        computeAttendPulse();
      },
      noop
    );

    const uAttend = onSnapshot(
      query(collection(db, "design_attendance"), where("date", "==", key)),
      snap => {
        todayAttendedRef.current = new Set(snap.docs.map(doc => doc.data().groupId as string));
        computeAttendPulse();
      },
      noop
    );

    const uTasks = onSnapshot(
      query(collection(db, "tasks"), where("isActive", "==", true)),
      snap => setActiveTaskCount(snap.size),
      noop
    );

    const interval = setInterval(computeAttendPulse, 60_000);
    return () => { uHolidays(); uGroups(); uAttend(); uTasks(); clearInterval(interval); };
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
      if (e.key === "ArrowLeft")  handleScroll("left");
      else if (e.key === "ArrowRight") handleScroll("right");
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (loading || !user) return null;

  const today          = new Date();
  const todayFormatted = `${String(today.getDate()).padStart(2, "0")}.${String(today.getMonth() + 1).padStart(2, "0")}.${today.getFullYear()}`;

  return (
    <div className="flex h-screen overflow-hidden bg-[#F4F6F9] font-inter antialiased text-[#10294C]">

      {/* SIDEBAR */}
      <aside className="hidden lg:block h-full shrink-0 z-50 transition-all duration-300 w-[280px] 2xl:w-[320px] bg-[#10294C]">
        <Sidebar logo={<img src="/assets/flex-logo-title-white.svg" width={165} alt="flex" />} />
      </aside>

      {/* MAIN */}
      <div className="flex-1 flex flex-col min-w-0 relative h-full">
        <Header innerClassName="w-[94%] max-w-[1300px] xl:max-w-[1440px] 2xl:max-w-[1620px]" />

        <main className="flex-1 w-full overflow-y-scroll overflow-x-clip [scrollbar-gutter:stable]">
          <div className="w-[94%] mx-auto pt-6 pb-8 max-w-[1300px] xl:max-w-[1440px] 2xl:max-w-[1620px]">
            <div className="space-y-6">

              {/* ── Üst Blok ── */}
              <div className="flex flex-col xl:flex-row gap-5 items-stretch">

                {/* Sol: banner + kartlar */}
                <div className="flex-1 min-w-0 flex flex-col gap-5">
                  <HomeBannerV4 />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <QuickActionCard
                      icon={<CalendarCheck size={20} />}
                      label="Hızlı Yoklama"
                      href="/attend"
                      meta={attendMetaText || todayFormatted}
                      statusText="Derse Git"
                      statusColor="bg-[#009F3E] text-white"
                      iconBg="bg-[#EEF4FD]"
                      iconColor="text-[#3A7BD5]"
                      cardTint="bg-white"
                      accentColor=""
                      pulse={attendancePulse}
                      onBeforeNavigate={() => {
                        localStorage.setItem(`attend_dismissed_${todayKeyRef.current}`, "1");
                        setAttendancePulse(false);
                        setAttendMetaText("");
                      }}
                    />
                    <QuickActionCard
                      icon={<ClipboardList size={20} />}
                      label="Ödev Teslimi"
                      href="/dashboard/assignment"
                      meta={activeTaskCount !== null ? `${activeTaskCount} aktif ödev` : "—"}
                      statusText="İncele"
                      statusColor="bg-[#FF8D28] text-white"
                      iconBg="bg-[#FFF4EB]"
                      iconColor="text-[#FF8D28]"
                      cardTint="bg-white"
                      accentColor=""
                    />
                    <QuickActionCard
                      icon={<Award size={20} />}
                      label="Sertifikasyon"
                      href="/dashboard/graduation"
                      meta="Not girişi bekliyor"
                      statusText="Not Gir"
                      statusColor="bg-[#6F74D8] text-white"
                      iconBg="bg-[#F1F2FD]"
                      iconColor="text-[#6F74D8]"
                      cardTint="bg-white"
                      accentColor=""
                    />
                  </div>
                </div>

                {/* Sağ: aktivite paneli */}
                <div className="w-full xl:w-[360px] shrink-0 xl:h-full">
                  <ActivityFeed />
                </div>
              </div>

              {/* ── Ödev Parkuru — 4 kart yan yana, compact yükseklik ── */}
              <DesignParkour gridClassName="grid-cols-2 sm:grid-cols-4" compact={true} maxSlots={4} />

              {/* ── Ödev Kütüphanesi ── */}
              {(hasPermission(PERMISSIONS.ASSIGNMENT_MANAGE) || user?.roles?.includes("instructor")) && (
                <AssignmentLibrary scrollRef={scrollRef} handleScroll={handleScroll} />
              )}

            </div>
          </div>
        </main>

        <FooterV4 />
      </div>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
