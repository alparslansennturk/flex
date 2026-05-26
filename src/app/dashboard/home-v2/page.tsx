"use client";

import { useRef, useEffect, useState } from "react";
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
  { id: 1, type: "odev",       title: "Yeni ödev teslimi",  desc: "Elif Yıldız — Kolaj Bahçesi",       time: "2 dk önce"  },
  { id: 2, type: "yoklama",    title: "Yoklama alındı",      desc: "Grup 541 — 18/20 öğrenci",          time: "14 dk önce" },
  { id: 3, type: "not",        title: "Not girildi",         desc: "Ahmet Demir — Kurumsal Kimlik 87p", time: "32 dk önce" },
  { id: 4, type: "ogrenci",    title: "Yeni öğrenci kaydı", desc: "Zeynep Kara — Grup 201",            time: "1 sa önce"  },
  { id: 5, type: "tamamlandi", title: "Ödev tamamlandı",    desc: "Kitap Dünyası — Grup 102",          time: "2 sa önce"  },
  { id: 6, type: "odev",       title: "Yeni ödev teslimi",  desc: "Can Öztürk — Sosyal Medya",         time: "3 sa önce"  },
  { id: 7, type: "yoklama",    title: "Yoklama alındı",      desc: "Grup 303 — 14/16 öğrenci",          time: "5 sa önce"  },
];

// ─── En Son Aktiviteler Paneli ───────────────────────────────────────────────
function ActivityFeed() {
  return (
    <div className="bg-white rounded-2xl border border-surface-200 flex flex-col h-full overflow-hidden">

      {/* Başlık */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-surface-200 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-base-primary-900 flex items-center justify-center shrink-0">
            <Activity size={16} className="text-white" strokeWidth={2} />
          </div>
          <div>
            <p className="text-[15px] font-bold text-text-primary tracking-tight leading-none">En Son Aktiviteler</p>
            <p className="text-[11px] text-text-tertiary mt-0.5 leading-none">Atölyendeki son hareketler</p>
          </div>
        </div>
        <button className="text-[11px] font-semibold text-base-primary-500 hover:text-base-primary-700 transition-colors cursor-pointer flex items-center gap-1">
          Tümü <ArrowUpRight size={11} strokeWidth={2.5} />
        </button>
      </div>

      {/* Liste */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {MOCK_ACTIVITIES.map((item, i) => {
          const cfg = ACTIVITY_CONFIG[item.type];
          return (
            <div
              key={item.id}
              className={`flex items-start gap-3 px-5 py-2.5 hover:bg-surface-50 transition-colors cursor-default
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

      {/* Footer */}
      <div className="px-5 py-3.5 border-t border-surface-100 shrink-0">
        <button className="w-full h-9 rounded-xl border border-surface-200 text-[12px] font-bold text-text-secondary
                           hover:bg-surface-50 hover:border-surface-300 transition-all cursor-pointer">
          Tüm Aktiviteleri Gör
        </button>
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
}) {
  const router = useRouter();
  return (
    <div
      onClick={() => router.push(href)}
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
      <div className="pl-[44px] flex items-center justify-between">
        {meta && <span className="text-[12px] text-[#8E95A3]">{meta}</span>}
        {statusText && (
          badge
            ? <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${statusColor} ml-auto`}>{statusText}</span>
            : <span className={`text-[13px] font-bold ${statusColor} ${meta ? "ml-auto" : ""}`}>{statusText}</span>
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
                      meta={todayFormatted}
                      statusText="Derse Git"
                      statusColor="bg-[#009F3E] text-white"
                      iconBg="bg-[#EEF4FD]"
                      iconColor="text-[#3A7BD5]"
                      badge
                    />
                    <QuickActionCard
                      icon={<ClipboardList size={18} />}
                      label="Ödev Teslimi"
                      href="/dashboard/assignment"
                      meta="3 aktif ödev"
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

                {/* Sağ sütun: aktiviteler alta yaslanır, kartlarla aynı bitiş */}
                <div className="w-full xl:w-[380px] shrink-0 flex flex-col justify-end">
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
      `}</style>
    </div>
  );
}
