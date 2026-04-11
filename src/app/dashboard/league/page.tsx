"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Trophy,
  ArrowBigUpDash,
  ArrowBigDownDash,
  Minus,
  Zap,
  CheckSquare,
  Shield,
  TrendingUp,
  ChevronRight,
  Users,
} from "lucide-react";
import { db } from "@/app/lib/firebase";
import { collection, query, where, onSnapshot, getDocs } from "firebase/firestore";
import { useUser } from "@/app/context/UserContext";
import { useScoring } from "@/app/context/ScoringContext";

import { computeStudentStats, calcScore, safe } from "@/app/lib/scoring";
import Sidebar from "../../components/layout/Sidebar";
import Header from "../../components/layout/Header";
import Footer from "../../components/layout/Footer";
import StudentDetailModal, { ModalStudent } from "@/app/components/dashboard/student-management/StudentDetailModal";

// ─── Types ───────────────────────────────────────────────────────────────────

interface StudentData {
  id: string;
  name: string;
  lastName: string;
  gender?: string;
  groupCode: string;
  branch: string;
  gradedTasks?: Record<string, { xp: number; penalty: number }>;
  isScoreHidden?: boolean;
  avatarId?: number | string;
  rankChange?: number;
  status?: string;
  points?: number;
  completedTasks?: number;
  latePenaltyTotal?: number;
}

interface RankedStudent extends StudentData {
  rank: number;
  score: number;
  generalScore: number;
  recentScore: number;
  finalScore: number;
  g2Bonus: number;
}

interface RankedGroup {
  code: string;
  rank: number;
  students: RankedStudent[];
  activeCount: number;
  studentCount: number;
  /** Sıralama için: öğrenci ortalama puanı */
  rawScore: number;
  /** UI için: rawScore × öğrenci sayısı — güçlü görünür */
  displayScore: number;
  /** İkincil bilgi: gruptaki tüm öğrencilerin toplam XP'si */
  totalXP: number;
  branch: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MEDALS     = ["🥇", "🥈", "🥉"];
const ALL_BRANCH = "Tüm Şubeler";
const ALL_GROUP  = "Tüm Gruplarım";

type ScoreMode = "monthly" | "total";
type ViewMode  = "students" | "groups";

// ─── TrendIcon ────────────────────────────────────────────────────────────────

function TrendIcon({ rankChange, rank }: { rankChange?: number; rank: number }) {
  const change = rankChange ?? 0;
  if (change > 0)
    return <ArrowBigUpDash size={15} className="text-[#FF8D28]" strokeWidth={2} />;
  if (change < 0)
    return <ArrowBigDownDash size={15} className="text-[#AEB4C0]" strokeWidth={2} />;
  return (
    <Minus
      size={15}
      className={rank === 1 ? "text-[#FF8D28]" : "text-[#AEB4C0]"}
      strokeWidth={2}
    />
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ gender, avatarId, size }: { gender?: string; avatarId?: number | string; size: number }) {
  const g  = gender === "female" ? "female" : "male";
  const n  = Number(avatarId);
  const id = n > 0 ? n : 1;
  return (
    <div
      className="rounded-full border border-surface-200 overflow-hidden bg-surface-50 shrink-0"
      style={{ width: size, height: size }}
    >
      <img
        src={`/avatars/${g}/${id}.svg`}
        alt=""
        className="w-full h-full object-cover"
        onError={e => { (e.target as HTMLImageElement).src = "/avatars/male/1.svg"; }}
      />
    </div>
  );
}

// ─── Analytics Grid ────────────────────────────────────────────────────────────

const ANALYTICS_CELLS = [
  { key: "topXP",         label: "En Yüksek XP",      icon: Zap,         bg: "#FFF0E0", iconBg: "#FFDDB8", iconColor: "#C45000", nameColor: "#7A3200", subColor: "#A84400" },
  { key: "fastestRising", label: "En Hızlı Yükseliş",  icon: TrendingUp,  bg: "#E0F8F6", iconBg: "#B0EEE8", iconColor: "#0A7A74", nameColor: "#084840", subColor: "#0D6A64" },
  { key: "mostTasks",     label: "En Çok Görev",        icon: CheckSquare, bg: "#E0EDFF", iconBg: "#B8D4FF", iconColor: "#1850C4", nameColor: "#0E2860", subColor: "#1840A0" },
  { key: "leastPenalty",  label: "En Az Ceza",          icon: Shield,      bg: "#EEE0FA", iconBg: "#DDB8F5", iconColor: "#6018A4", nameColor: "#380A68", subColor: "#5010A0" },
] as const;

type AnalyticsCellKey = typeof ANALYTICS_CELLS[number]["key"];

function AnalyticsCell({
  students, label, icon: Icon, bg, iconBg, iconColor, nameColor, subColor, cellKey,
}: {
  students: RankedStudent[];
  label: string;
  icon: React.ElementType;
  bg: string; iconBg: string; iconColor: string; nameColor: string; subColor: string;
  cellKey: AnalyticsCellKey;
}) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (students.length <= 1) { setIdx(0); return; }
    const timer = setInterval(() => {
      setIdx(prev => (prev + 1) % students.length);
    }, 2500);
    return () => clearInterval(timer);
  }, [students]);

  const s = students[idx] ?? null;

  const getSub = () => {
    if (!s) return "—";
    if (cellKey === "topXP")         return `${s.points ?? 0} XP`;
    if (cellKey === "fastestRising") return `+${s.rankChange ?? 0} sıra`;
    if (cellKey === "mostTasks")     return `${s.completedTasks ?? 0} görev`;
    if (cellKey === "leastPenalty")  return `${s.latePenaltyTotal ?? 0} ceza`;
    return "—";
  };

  return (
    <>
      <Icon size={80} strokeWidth={0.8} className="absolute -right-4 -bottom-4 pointer-events-none" style={{ color: iconColor, opacity: 0.07 }} />

      <div className="flex items-center gap-2.5 relative z-10">
        <div className="w-9 h-9 rounded-12 flex items-center justify-center shrink-0" style={{ background: iconBg }}>
          <Icon size={17} style={{ color: iconColor }} />
        </div>
        <p className="text-[11px] font-bold uppercase tracking-wide leading-none" style={{ color: subColor }}>{label}</p>
      </div>

      {s ? (
        <>
          <div className="flex items-center gap-2 relative z-10">
            <Avatar gender={s.gender} avatarId={s.avatarId} size={32} />
            <p className="text-[14px] font-bold leading-tight truncate" style={{ color: nameColor }}>
              {s.name} {s.lastName}
            </p>
          </div>
          <p className="text-[22px] font-black tabular-nums leading-none relative z-10" style={{ color: iconColor }}>
            {getSub()}
          </p>
        </>
      ) : (
        <p className="text-[13px] relative z-10" style={{ color: subColor }}>Veri yok</p>
      )}
    </>
  );
}

function AnalyticsGrid({
  analytics,
}: {
  analytics: {
    topXP: RankedStudent[];
    fastestRising: RankedStudent[];
    mostTasks: RankedStudent[];
    leastPenalty: RankedStudent[];
  };
}) {
  return (
    <div
      className="rounded-20 overflow-hidden grid grid-cols-2"
      style={{ boxShadow: "0 4px 36px rgba(0,0,0,0.05)" }}
    >
      {ANALYTICS_CELLS.map(({ key, label, icon, bg, iconBg, iconColor, nameColor, subColor }, i) => {
        const borderR = i % 2 === 0 ? "border-r-2 border-white/70" : "";
        const borderB = i < 2       ? "border-b-2 border-white/70" : "";
        return (
          <div
            key={key}
            className={`${borderR} ${borderB} p-5 flex flex-col gap-3 relative overflow-hidden`}
            style={{ background: bg }}
          >
            <AnalyticsCell
              students={analytics[key]}
              label={label}
              icon={icon}
              bg={bg}
              iconBg={iconBg}
              iconColor={iconColor}
              nameColor={nameColor}
              subColor={subColor}
              cellKey={key}
            />
          </div>
        );
      })}
    </div>
  );
}

// ─── Group Analytics Grid ─────────────────────────────────────────────────────

const GROUP_ANALYTICS_CELLS = [
  { key: "topScore",     label: "En Yüksek Puan",     icon: Trophy,      bg: "#FFF0E0", iconBg: "#FFDDB8", iconColor: "#C45000", nameColor: "#7A3200", subColor: "#A84400" },
  { key: "topXP",        label: "En Yüksek Toplam XP", icon: Zap,        bg: "#E0EDFF", iconBg: "#B8D4FF", iconColor: "#1850C4", nameColor: "#0E2860", subColor: "#1840A0" },
  { key: "mostStudents", label: "En Fazla Öğrenci",   icon: Users,       bg: "#E0F8F6", iconBg: "#B0EEE8", iconColor: "#0A7A74", nameColor: "#084840", subColor: "#0D6A64" },
  { key: "mostActive",   label: "En Aktif Grup",       icon: TrendingUp,  bg: "#EEE0FA", iconBg: "#DDB8F5", iconColor: "#6018A4", nameColor: "#380A68", subColor: "#5010A0" },
] as const;

function GroupAnalyticsGrid({ analytics }: {
  analytics: { topScore: RankedGroup; topXP: RankedGroup; mostStudents: RankedGroup; mostActive: RankedGroup };
}) {
  const getSub = (key: string, g: RankedGroup) => {
    if (key === "topScore")     return `${Math.round(g.rawScore)} puan`;
    if (key === "topXP")        return `${g.totalXP.toLocaleString("tr-TR")} XP`;
    if (key === "mostStudents") return `${g.studentCount} öğrenci`;
    if (key === "mostActive")   return `${g.activeCount} aktif`;
    return "—";
  };
  return (
    <div className="rounded-20 overflow-hidden grid grid-cols-2" style={{ boxShadow: "0 4px 36px rgba(0,0,0,0.05)" }}>
      {GROUP_ANALYTICS_CELLS.map(({ key, label, icon: Icon, bg, iconBg, iconColor, nameColor, subColor }, i) => {
        const group    = analytics[key as keyof typeof analytics];
        const borderR  = i % 2 === 0 ? "border-r-2 border-white/70" : "";
        const borderB  = i < 2       ? "border-b-2 border-white/70" : "";
        return (
          <div key={key} className={`${borderR} ${borderB} p-5 flex flex-col gap-3 relative overflow-hidden`} style={{ background: bg }}>
            <Icon size={80} strokeWidth={0.8} className="absolute -right-4 -bottom-4 pointer-events-none" style={{ color: iconColor, opacity: 0.07 }} />
            <div className="flex items-center gap-2.5 relative z-10">
              <div className="w-9 h-9 rounded-12 flex items-center justify-center shrink-0" style={{ background: iconBg }}>
                <Icon size={17} style={{ color: iconColor }} />
              </div>
              <p className="text-[11px] font-bold uppercase tracking-wide leading-none" style={{ color: subColor }}>{label}</p>
            </div>
            <div className="flex items-center gap-2 relative z-10">
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: iconBg }}>
                <Users size={14} style={{ color: iconColor }} />
              </div>
              <p className="text-[14px] font-bold leading-tight truncate" style={{ color: nameColor }}>{group.code}</p>
            </div>
            <p className="text-[22px] font-black tabular-nums leading-none relative z-10" style={{ color: iconColor }}>{getSub(key, group)}</p>
          </div>
        );
      })}
    </div>
  );
}

// ─── Podium ───────────────────────────────────────────────────────────────────

function PodiumSection({
  students,
  onStudentClick,
}: {
  students: RankedStudent[];
  onStudentClick: (s: RankedStudent) => void;
}) {
  const ordered = [students[1], students[0], students[2]].filter(
    (s): s is RankedStudent => Boolean(s)
  );

  const stepH: Record<number, string>    = { 1: "h-12", 2: "h-8", 3: "h-5" };
  const stepGrad: Record<number, string> = {
    1: "linear-gradient(to bottom, rgba(255,141,40,0.20) 0%, transparent 100%)",
    2: "linear-gradient(to bottom, rgba(174,180,192,0.15) 0%, transparent 100%)",
    3: "linear-gradient(to bottom, rgba(174,180,192,0.12) 0%, transparent 100%)",
  };
  const cardW: Record<number, number>    = { 1: 148, 2: 126, 3: 126 };
  const avSize: Record<number, number>   = { 1: 56,  2: 44,  3: 44  };

  return (
    <div className="bg-white rounded-20 border border-surface-200 px-6 pt-5 pb-0 overflow-hidden flex flex-col" style={{ boxShadow: "0 4px 40px rgba(0,0,0,0.04)" }}>
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-8 h-8 rounded-12 bg-designstudio-primary-50 flex items-center justify-center shrink-0">
          <Trophy size={16} className="text-[#FF8D28]" />
        </div>
        <span className="text-[18px] font-bold text-text-primary">Podyum</span>
      </div>

      <div className="flex items-end justify-center gap-3 flex-1">
        {ordered.map((student) => {
          const rank    = student.rank as 1 | 2 | 3;
          const isFirst = rank === 1;

          return (
            <div
              key={student.id}
              className="flex flex-col items-center cursor-pointer"
              onClick={() => onStudentClick(student)}
            >
              <div
                className={`border border-surface-200 rounded-16 p-3.5 flex flex-col items-center gap-2 transition-all hover:-translate-y-1 ${
                  isFirst ? "bg-designstudio-primary-50" : "bg-white"
                }`}
                style={{
                  width: cardW[rank],
                  boxShadow: isFirst
                    ? "0 4px 32px rgba(255,141,40,0.10)"
                    : "0 4px 28px rgba(0,0,0,0.04)",
                }}
              >
                <span className="text-[26px] leading-none">{MEDALS[rank - 1]}</span>
                <Avatar gender={student.gender} avatarId={student.avatarId} size={avSize[rank]} />
                <div className="text-center w-full">
                  <p className={`font-bold text-text-primary truncate leading-snug ${isFirst ? "text-[13px]" : "text-[12px]"}`}>
                    {student.name} {student.lastName}
                  </p>
                  <p className="text-[10px] text-text-tertiary mt-0.5">{student.groupCode}</p>
                </div>
                <div className="text-center w-full pt-1.5 border-t border-surface-100">
                  <p className={`font-bold tabular-nums leading-none ${isFirst ? "text-[20px] text-[#FF8D28]" : "text-[16px] text-text-primary"}`}>
                    {Math.round(student.score)}
                  </p>
                  <p className="text-[10px] text-text-tertiary font-semibold mt-0.5">puan</p>
                </div>
              </div>
              <div
                className={`${stepH[rank]} rounded-t-8 w-full`}
                style={{ background: stepGrad[rank] }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Group Podium ─────────────────────────────────────────────────────────────

function GroupPodium({ groups }: { groups: RankedGroup[] }) {
  const ordered = [groups[1], groups[0], groups[2]].filter((g): g is RankedGroup => Boolean(g));

  const stepH: Record<number, string>    = { 1: "h-12", 2: "h-8", 3: "h-5" };
  const stepGrad: Record<number, string> = {
    1: "linear-gradient(to bottom, rgba(255,141,40,0.20) 0%, transparent 100%)",
    2: "linear-gradient(to bottom, rgba(174,180,192,0.15) 0%, transparent 100%)",
    3: "linear-gradient(to bottom, rgba(174,180,192,0.12) 0%, transparent 100%)",
  };
  const cardW: Record<number, number> = { 1: 160, 2: 136, 3: 136 };

  return (
    <div className="bg-white rounded-20 border border-surface-200 px-6 pt-5 pb-0 overflow-hidden flex flex-col" style={{ boxShadow: "0 4px 40px rgba(0,0,0,0.04)" }}>
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-8 h-8 rounded-12 bg-designstudio-primary-50 flex items-center justify-center shrink-0">
          <Trophy size={16} className="text-[#FF8D28]" />
        </div>
        <span className="text-[18px] font-bold text-text-primary">Grup Podyumu</span>
      </div>

      <div className="flex items-end justify-center gap-3 flex-1">
        {ordered.map((group) => {
          const rank    = group.rank as 1 | 2 | 3;
          const isFirst = rank === 1;
          return (
            <div key={group.code} className="flex flex-col items-center">
              <div
                className={`border border-surface-200 rounded-16 p-3.5 flex flex-col items-center gap-2 ${
                  isFirst ? "bg-designstudio-primary-50" : "bg-white"
                }`}
                style={{
                  width: cardW[rank],
                  boxShadow: isFirst
                    ? "0 4px 32px rgba(255,141,40,0.10)"
                    : "0 4px 28px rgba(0,0,0,0.04)",
                }}
              >
                <span className="text-[26px] leading-none">{MEDALS[rank - 1]}</span>
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: isFirst ? "rgba(255,141,40,0.15)" : "#F3F4F6" }}
                >
                  <Users size={22} className={isFirst ? "text-[#FF8D28]" : "text-text-tertiary"} />
                </div>
                <div className="text-center w-full">
                  <p className={`font-bold text-text-primary truncate leading-snug ${isFirst ? "text-[14px]" : "text-[13px]"}`}>
                    {group.code}
                  </p>
                  <p className="text-[10px] text-text-tertiary mt-0.5">{group.activeCount} aktif öğrenci</p>
                </div>
                <div className="text-center w-full pt-1.5 border-t border-surface-100">
                  {/* 1. Ana skor — rawScore, sıralama puanı */}
                  <p className={`font-bold tabular-nums leading-none ${isFirst ? "text-[20px] text-[#FF8D28]" : "text-[16px] text-text-primary"}`}>
                    {Math.round(group.rawScore).toLocaleString("tr-TR")}
                  </p>
                  <p className="text-[10px] text-text-tertiary font-semibold mt-0.5">puan</p>
                  {/* 2. İkincil — displayScore */}
                  <p className="text-[10px] text-text-secondary tabular-nums mt-1.5">
                    Toplam: {group.displayScore.toLocaleString("tr-TR")}
                  </p>
                  {/* 3. Üçüncül — ham XP */}
                  <p className="text-[9px] text-text-disabled tabular-nums mt-0.5">
                    {group.totalXP.toLocaleString("tr-TR")} XP
                  </p>
                </div>
              </div>
              <div
                className={`${stepH[rank]} rounded-t-8 w-full`}
                style={{ background: stepGrad[rank] }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Group Table ──────────────────────────────────────────────────────────────

function GroupTable({ groups, groupsMap }: { groups: RankedGroup[]; groupsMap: Record<string, string> }) {
  return (
    <div className="bg-white rounded-20 border border-surface-200 overflow-hidden" style={{ boxShadow: "0 4px 40px rgba(0,0,0,0.04)" }}>
      <table className="w-full">
        <thead>
          <tr className="border-b border-surface-100">
            <th className="text-left text-[14px] font-bold text-text-secondary px-8 py-4 w-20">#</th>
            <th className="text-left text-[14px] font-bold text-text-secondary px-6 py-4">Grup</th>
            <th className="text-left text-[14px] font-bold text-text-secondary px-6 py-4 hidden lg:table-cell">Eğitmen</th>
            <th className="text-right text-[14px] font-bold text-text-secondary px-6 py-4">Puan</th>
            <th className="text-right text-[14px] font-bold text-text-secondary px-6 py-4 hidden md:table-cell">Toplam XP</th>
            <th className="text-right text-[14px] font-bold text-text-secondary px-6 py-4 hidden md:table-cell">Öğrenci</th>
            <th className="text-right text-[14px] font-bold text-text-secondary px-6 py-4 hidden xl:table-cell">Aktif</th>
            <th className="text-center text-[14px] font-bold text-text-secondary px-6 py-4">Trend</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const medal  = MEDALS[group.rank - 1];
            const isTop3 = !!medal;
            return (
              <tr
                key={group.code}
                className={`border-b border-surface-50 last:border-0 hover:bg-surface-50 transition-colors ${isTop3 ? "bg-surface-50/50" : ""}`}
              >
                <td className="px-8 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 shrink-0 flex justify-center">
                      {isTop3
                        ? <span className="text-[14px] leading-none">{medal}</span>
                        : <span className="text-[12px] font-bold text-text-tertiary">#</span>
                      }
                    </span>
                    <span className={`text-[14px] font-bold tabular-nums ${isTop3 ? "text-text-secondary" : "text-text-tertiary"}`}>
                      {group.rank}.
                    </span>
                  </div>
                </td>

                <td className="px-6 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-surface-100 flex items-center justify-center shrink-0">
                      <Users size={13} className="text-text-tertiary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-bold text-text-primary leading-none">{group.code}</p>
                      <p className="text-[12px] text-text-tertiary leading-snug mt-0.5 truncate">{group.branch}</p>
                    </div>
                  </div>
                </td>

                <td className="px-6 py-3 hidden lg:table-cell">
                  <span className="text-[13px] font-medium text-text-tertiary">{groupsMap[group.code] || "—"}</span>
                </td>

                <td className="px-6 py-3 text-right">
                  <span className={`text-[15px] font-bold tabular-nums ${isTop3 && group.rank === 1 ? "text-[#FF8D28]" : "text-text-primary"}`}>
                    {Math.round(group.rawScore).toLocaleString("tr-TR")}
                  </span>
                </td>

                <td className="px-6 py-3 text-right hidden md:table-cell">
                  <span className="text-[13px] font-semibold text-text-tertiary tabular-nums">
                    {group.totalXP.toLocaleString("tr-TR")} XP
                  </span>
                </td>

                <td className="px-6 py-3 text-right hidden md:table-cell">
                  <span className="text-[13px] font-semibold text-text-tertiary tabular-nums">
                    {group.studentCount}
                  </span>
                </td>

                <td className="px-6 py-3 text-right hidden xl:table-cell">
                  <span className="text-[13px] font-semibold text-text-secondary tabular-nums">
                    {group.activeCount}
                  </span>
                </td>

                <td className="px-6 py-3">
                  <div className="flex justify-center">
                    <Minus size={15} className="text-[#AEB4C0]" strokeWidth={2} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────────

function LeaderTable({
  students,
  onStudentClick,
  groupsMap,
}: {
  students: RankedStudent[];
  onStudentClick: (s: RankedStudent) => void;
  groupsMap: Record<string, string>;
}) {
  return (
    <div className="bg-white rounded-20 border border-surface-200 overflow-hidden" style={{ boxShadow: "0 4px 40px rgba(0,0,0,0.04)" }}>
      <table className="w-full">
        <thead>
          <tr className="border-b border-surface-100">
            <th className="text-left text-[14px] font-bold text-text-secondary px-8 py-4 w-20">#</th>
            <th className="text-left text-[14px] font-bold text-text-secondary px-6 py-4">Öğrenci</th>
            <th className="text-left text-[14px] font-bold text-text-secondary px-6 py-4 hidden md:table-cell">Sınıf</th>
            <th className="text-left text-[14px] font-bold text-text-secondary px-6 py-4 hidden lg:table-cell">Eğitmen</th>
            <th className="text-right text-[14px] font-bold text-text-secondary px-6 py-4">Puan</th>
            <th className="text-right text-[14px] font-bold text-text-secondary px-6 py-4 hidden md:table-cell">Toplam XP</th>
            <th className="text-right text-[14px] font-bold text-text-secondary px-6 py-4 hidden xl:table-cell">Görev</th>
            <th className="text-right text-[14px] font-bold text-text-secondary px-6 py-4 hidden xl:table-cell">Ceza</th>
            <th className="text-center text-[14px] font-bold text-text-secondary px-6 py-4">Trend</th>
            <th className="px-8 py-4 w-20" />
          </tr>
        </thead>
        <tbody>
          {students.map((student) => {
            const medal  = MEDALS[student.rank - 1];
            const isTop3 = !!medal;
            return (
              <tr
                key={student.id}
                onClick={() => onStudentClick(student)}
                className={`border-b border-surface-50 last:border-0 hover:bg-surface-50 transition-colors cursor-pointer group ${
                  isTop3 ? "bg-surface-50/50" : ""
                }`}
              >
                <td className="px-8 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 shrink-0 flex justify-center">
                      {isTop3
                        ? <span className="text-[14px] leading-none">{medal}</span>
                        : <span className="text-[12px] font-bold text-text-tertiary">#</span>
                      }
                    </span>
                    <span className={`text-[14px] font-bold tabular-nums ${isTop3 ? "text-text-secondary" : "text-text-tertiary"}`}>
                      {student.rank}.
                    </span>
                  </div>
                </td>

                <td className="px-6 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar gender={student.gender} avatarId={student.avatarId} size={28} />
                    <div className="min-w-0">
                      <p className="text-[14px] font-bold text-text-primary leading-none truncate">
                        {student.name} {student.lastName}
                      </p>
                      <p className="text-[12px] text-text-tertiary leading-snug truncate mt-0.5">
                        {student.branch}
                      </p>
                    </div>
                  </div>
                </td>

                <td className="px-6 py-3 hidden md:table-cell">
                  <span className="text-[13px] font-semibold text-text-secondary">{student.groupCode || "—"}</span>
                </td>

                <td className="px-6 py-3 hidden lg:table-cell">
                  <span className="text-[13px] font-medium text-text-tertiary">{groupsMap[student.groupCode] || "—"}</span>
                </td>

                <td className="px-6 py-3 text-right">
                  <span className={`text-[15px] font-bold tabular-nums ${isTop3 && student.rank === 1 ? "text-[#FF8D28]" : "text-text-primary"}`}>
                    {Math.round(student.score)}
                  </span>
                </td>

                <td className="px-6 py-3 text-right hidden md:table-cell">
                  <div className="flex flex-col items-end">
                    <span className="text-[13px] font-semibold text-text-tertiary tabular-nums">
                      {(student.points ?? 0).toLocaleString("tr-TR")} XP
                    </span>
                    {student.g2Bonus > 0 && (
                      <span className="text-[12px] font-medium italic text-text-tertiary/70 tabular-nums">
                        (+{student.g2Bonus} bonus)
                      </span>
                    )}
                  </div>
                </td>

                <td className="px-6 py-3 text-right hidden xl:table-cell">
                  <span className="text-[13px] font-semibold text-text-secondary tabular-nums">
                    {student.completedTasks ?? 0}
                  </span>
                </td>

                <td className="px-6 py-3 text-right hidden xl:table-cell">
                  <span className="text-[13px] font-semibold text-text-tertiary tabular-nums">
                    {student.latePenaltyTotal ?? 0}
                  </span>
                </td>

                <td className="px-6 py-3">
                  <div className="flex justify-center">
                    <TrendIcon rankChange={student.rankChange} rank={student.rank} />
                  </div>
                </td>

                <td className="px-8 py-3 text-right">
                  <button
                    onClick={(e) => { e.stopPropagation(); onStudentClick(student); }}
                    className="text-[12px] font-semibold text-[#3A7BD5] hover:text-[#2867BD] transition-colors cursor-pointer opacity-0 group-hover:opacity-100 flex items-center gap-0.5 ml-auto"
                  >
                    Detay <ChevronRight size={12} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}


// ─── League Intro ─────────────────────────────────────────────────────────────

const INTRO_SPARKLES = [
  { x: -110, y: -100, s: 5 }, { x:  100, y:  -90, s: 4 },
  { x:  140, y:   20, s: 6 }, { x:   85, y:  110, s: 4 },
  { x: -130, y:   80, s: 5 }, { x: -145, y:  -15, s: 3 },
  { x:  -45, y:  130, s: 4 }, { x:   50, y: -135, s: 3 },
  { x:  165, y:  -55, s: 3 }, { x: -160, y:   55, s: 4 },
  { x:   70, y:  155, s: 3 }, { x:  -70, y: -140, s: 5 },
  { x:  -15, y:  170, s: 2 }, { x:   30, y: -165, s: 2 },
  { x:  175, y:   75, s: 3 }, { x: -175, y:  -75, s: 3 },
];

function LeagueIntro({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = React.useState<"enter" | "hold" | "exit">("enter");

  React.useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"),   60);
    const t2 = setTimeout(() => setPhase("exit"),  1700);
    const t3 = setTimeout(onComplete,              2250);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onComplete]);

  const isIn  = phase !== "enter";
  const isOut = phase === "exit";

  return (
    <div
      className="fixed inset-0 z-9999 flex flex-col items-center justify-center overflow-hidden select-none"
      style={{
        background: "radial-gradient(ellipse at 50% 40%, #1E3C70 0%, #080F24 80%)",
        transform:  isOut ? "translateY(-110%)" : "translateY(0)",
        transition: isOut ? "transform 0.55s cubic-bezier(0.7,0,1,1)" : "none",
      }}
    >
      <div
        className="absolute w-120 h-120 rounded-full pointer-events-none"
        style={{
          background:  "radial-gradient(circle, rgba(255,141,40,0.24) 0%, transparent 65%)",
          transform:   isIn ? "scale(1)" : "scale(0)",
          transition:  "transform 1s cubic-bezier(0.22,1,0.36,1)",
        }}
      />

      <div
        className="relative z-10 flex flex-col items-center gap-8"
        style={{
          transform:  isIn ? "scale(1) translateY(0)" : "scale(0.3) translateY(60px)",
          opacity:    isIn ? 1 : 0,
          transition: "all 0.65s cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        <div
          className="w-28 h-28 rounded-full flex items-center justify-center"
          style={{ background: "rgba(255,141,40,0.18)", boxShadow: "0 0 80px rgba(255,141,40,0.22)" }}
        >
          <div className="w-18 h-18 rounded-full flex items-center justify-center" style={{ background: "rgba(255,141,40,0.30)" }}>
            <Trophy size={38} className="text-[#FF8D28]" strokeWidth={2} />
          </div>
        </div>

        <div className="text-center">
          <p className="text-[11px] font-bold text-white/40 tracking-[0.5em] uppercase mb-3">Hoş Geldiniz</p>
          <h1
            className="text-[56px] font-black text-white leading-none"
            style={{ letterSpacing: "-0.03em" }}
          >
            Sınıflar
          </h1>
          <h1
            className="text-[56px] font-black leading-none"
            style={{ letterSpacing: "-0.03em", color: "#FF8D28" }}
          >
            Ligi
          </h1>
        </div>
      </div>

      {INTRO_SPARKLES.map((sp, i) => (
        <div
          key={i}
          className="absolute rounded-full pointer-events-none"
          style={{
            width:      sp.s,
            height:     sp.s,
            background: i % 3 === 0 ? "#FF8D28" : i % 3 === 1 ? "#FFD080" : "#FFFFFF",
            left:       "calc(50% - 2px)",
            top:        "calc(50% - 64px)",
            transform:  isIn ? `translate(${sp.x}px, ${sp.y}px) scale(1)` : "translate(0,0) scale(0)",
            opacity:    isIn ? 0.85 : 0,
            transition: `transform ${0.6 + i * 0.02}s cubic-bezier(0.22,1,0.36,1) ${i * 0.02}s, opacity 0.3s ease`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

let _leagueIntroShown = false;

export default function LeaguePage() {
  const [showIntro,       setShowIntro]       = useState(!_leagueIntroShown);
  const [_activeTab,      setActiveTab]       = useState("league");
  const [filterMode,         setFilterMode]         = useState<"trainer" | "branch">("trainer");
  const [trainerGroupFilter, setTrainerGroupFilter] = useState(ALL_GROUP);
  const [branchSubFilter,    setBranchSubFilter]    = useState(ALL_BRANCH);
  const [scoreMode,          setScoreMode]          = useState<ScoreMode>("total");
  const [viewMode,        setViewMode]        = useState<ViewMode>("students");
  const [rawStudents,     setRawStudents]     = useState<StudentData[]>([]);
  const [tasksMap,        setTasksMap]        = useState<Record<string, { endDate?: string; createdAt?: any; classId?: string }>>({});
  const [groupsMap,       setGroupsMap]       = useState<Record<string, string>>({}); // groupCode → instructor name
  const [groupBranches,   setGroupBranches]   = useState<string[]>([]); // şube listesi groups'tan
  const [myGroupCodes,    setMyGroupCodes]    = useState<string[] | null>(null);
  const [loading,         setLoading]         = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<ModalStudent | null>(null);
  const [modalOpen,       setModalOpen]       = useState(false);
  const [openDropdown,    setOpenDropdown]    = useState<"groups" | "branches" | null>(null);

  const { user }                     = useUser();
  const { settings, activeSeasonId } = useScoring();


  // ── Eğitmene ait aktif grup kodları ────────────────────────────────────────
  useEffect(() => {
    const uid = user?.uid;
    if (!uid) { setMyGroupCodes([]); return; }
    const q = query(
      collection(db, "groups"),
      where("instructorId", "==", uid),
      where("status", "==", "active"),
    );
    return onSnapshot(q, (snap) => {
      setMyGroupCodes(snap.docs.map((d) => (d.data() as any).code).filter(Boolean));
    });
  }, [user?.uid]);

  // ── Grupları çek (eğitmen adı için) ───────────────────────────────────────
  useEffect(() => {
    getDocs(collection(db, "groups")).then((snap) => {
      const map: Record<string, string> = {};
      const branches = new Set<string>();
      snap.docs.forEach((d) => {
        const data = d.data() as any;
        if (data.code) map[data.code] = data.instructor || "";
        if (data.branch) branches.add(data.branch);
      });
      setGroupsMap(map);
      setGroupBranches([ALL_BRANCH, ...Array.from(branches).sort()]);
    }).catch(() => {});
  }, []);

  // ── Görevleri çek ─────────────────────────────────────────────────────────
  useEffect(() => {
    getDocs(collection(db, "tasks")).then((snap) => {
      const map: Record<string, { endDate?: string; createdAt?: any; classId?: string }> = {};
      snap.docs.forEach((d) => {
        const data = d.data() as any;
        map[d.id] = { endDate: data.endDate ?? undefined, createdAt: data.createdAt ?? undefined, classId: data.classId ?? undefined };
      });
      setTasksMap(map);
    }).catch(() => {});
  }, []);


  // ── Öğrencileri çek ────────────────────────────────────────────────────────
  useEffect(() => {
    const uid = user?.uid;
    if (!uid) return;
    setLoading(true);
    const q = query(collection(db, "students"), where("status", "==", "active"));
    return onSnapshot(q, (snap) => {
      setRawStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() } as StudentData)));
      setLoading(false);
    });
  }, [user?.uid]);

  // ── Şube ve grup seçenekleri ───────────────────────────────────────────────
  const groupOptions = useMemo(() => {
    return [ALL_GROUP, ...(myGroupCodes ?? [])];
  }, [myGroupCodes]);

  // Groups + öğrencilerden türetilen şube listesi
  const branchOptions = useMemo(() => {
    const branches = new Set<string>(groupBranches.filter(b => b !== ALL_BRANCH));
    rawStudents.forEach(s => { if (s.branch) branches.add(s.branch); });
    return [ALL_BRANCH, ...Array.from(branches).sort()];
  }, [rawStudents, groupBranches]);

  // ── Puan hesaplama (filtresiz) ─────────────────────────────────────────────
  const withScores = useMemo(() => {
    const thirtyDaysAgo = Date.now() - 30 * 86400000;
    const recentTaskIds = new Set<string>(
      Object.entries(tasksMap)
        .filter(([, task]) => {
          const d = task.endDate
            ? new Date(task.endDate).getTime()
            : task.createdAt?.toDate?.()?.getTime?.() ?? 0;
          return d >= thirtyDaysAgo;
        })
        .map(([id]) => id)
    );
    return rawStudents.map((s) => {
      // Sadece öğrencinin şu anki grubuna (groupCode) ait görevleri say.
      // Grafik-1'den Grafik-2'ye geçince eski XP silinmez ama skora dahil edilmez.
      const allTasks = s.gradedTasks ?? {};
      const tasks = Object.fromEntries(
        Object.entries(allTasks).filter(([tid, entry]) => {
          // Önce görevin içine gömülü classId'ye bak (arşivden silinse bile kalır)
          const storedClassId = (entry as any).classId as string | undefined;
          if (storedClassId) return storedClassId === s.groupCode;
          // Eski kayıtlarda classId yoksa tasksMap'ten dene
          const mapClassId = tasksMap[tid]?.classId;
          if (!mapClassId) return true; // görev silinmiş ve classId bilinmiyor → XP koru
          return mapClassId === s.groupCode;
        })
      );
      const { totalXP: baseXP, completedTasks, latePenaltyTotal } = computeStudentStats(tasks, s.isScoreHidden, activeSeasonId);
      // G1→G2 / carry-over bonusu: sınıf bitirildiğinde hesaplanan, sadece lig tablosuna etkili
      const g2Bonus = s.isScoreHidden ? 0 : ((s as any).g2StartXP ?? 0);
      const totalXP = baseXP + g2Bonus; // görüntüleme için (points)
      const recentEntries = s.isScoreHidden ? [] : Object.entries(tasks).filter(([tid, entry]) => {
        if (recentTaskIds.has(tid)) return true;            // görev mevcut ve recent
        if (tasksMap[tid] !== undefined) return false;      // görev mevcut ama recent değil
        // Görev silinmiş → saklanan endDate'e bak
        const storedEnd = (entry as any).endDate as string | undefined;
        if (storedEnd) return new Date(storedEnd).getTime() >= thirtyDaysAgo;
        return true; // endDate bilinmiyor, görev silindi → puanı koru
      });
      const recentXP           = recentEntries.reduce((sum, [, e]) => sum + (e.xp ?? 0), 0);
      const recentCompleted    = recentEntries.length;
      // totalAssignedTasks: gruba atanmış tüm görevler (tasksMap'te classId eşleşenler)
      const totalAssignedTasks = Object.values(tasksMap).filter(t => t.classId === s.groupCode).length;
      // g2Bonus net puan olarak doğrudan eklenir — görev sayısına bölünmez
      const generalScore = calcScore(baseXP, completedTasks, settings, totalAssignedTasks || undefined) + g2Bonus;
      const recentScore  = calcScore(recentXP, recentCompleted, settings);
      return { ...s, points: totalXP, completedTasks, latePenaltyTotal, generalScore, recentScore, finalScore: generalScore, g2Bonus, score: scoreMode === "monthly" ? recentScore : generalScore };
    });
  }, [rawStudents, settings, activeSeasonId, scoreMode, tasksMap]);

  const sortFn = (a: typeof withScores[0], b: typeof withScores[0]) => {
    const sd = b.score - a.score; if (sd !== 0) return sd;
    const pd = (a.latePenaltyTotal ?? 0) - (b.latePenaltyTotal ?? 0); if (pd !== 0) return pd;
    const td = (b.completedTasks ?? 0) - (a.completedTasks ?? 0); if (td !== 0) return td;
    return `${a.name} ${a.lastName}`.localeCompare(`${b.name} ${b.lastName}`, "tr");
  };

  // Ranking: ilk 3 sırada aynı puan = aynı sıra (1,2,2,3). 4. sıradan itibaren
  // ceza → görev sayısı → alfabetik ile benzersiz sıra verilir.
  function denseRank<T extends { score: number; latePenaltyTotal?: number; completedTasks?: number }>(sorted: T[]): (T & { rank: number })[] {
    const result: (T & { rank: number })[] = [];
    for (let i = 0; i < sorted.length; i++) {
      if (i === 0) { result.push({ ...sorted[i], rank: 1 }); continue; }
      const prev     = sorted[i - 1];
      const prevRank = result[i - 1].rank;
      // Sadece ilk 3 sırada aynı puan varsa aynı sıra numarası ver
      const canTie = prevRank <= 3 && prev.score === sorted[i].score;
      result.push({ ...sorted[i], rank: canTie ? prevRank : prevRank + 1 });
    }
    return result;
  }

  // ── Tablo sıralaması (tüm filtreleri takip eder) ──────────────────────────
  const rankedStudents = useMemo<RankedStudent[]>(() => {
    let filtered: typeof withScores;
    if (viewMode === "groups") {
      filtered = withScores;
    } else if (filterMode === "trainer") {
      if (trainerGroupFilter !== ALL_GROUP) {
        filtered = withScores.filter(s => s.groupCode === trainerGroupFilter);
      } else if (myGroupCodes?.length) {
        filtered = withScores.filter(s => myGroupCodes.includes(s.groupCode));
      } else {
        filtered = withScores;
      }
    } else {
      filtered = branchSubFilter !== ALL_BRANCH
        ? withScores.filter(s => s.branch === branchSubFilter)
        : withScores;
    }
    return denseRank([...filtered].sort(sortFn));
  }, [withScores, viewMode, filterMode, trainerGroupFilter, branchSubFilter, myGroupCodes]);

  // ── Podyum öğrencileri (mod düzeyinde, spesifik grup takip etmez) ─────────
  const podiumStudents = useMemo<RankedStudent[]>(() => {
    let filtered: typeof withScores;
    if (filterMode === "trainer") {
      filtered = myGroupCodes?.length
        ? withScores.filter(s => myGroupCodes.includes(s.groupCode))
        : withScores;
    } else {
      filtered = branchSubFilter !== ALL_BRANCH
        ? withScores.filter(s => s.branch === branchSubFilter)
        : withScores;
    }
    return denseRank([...filtered].sort(sortFn));
  }, [withScores, filterMode, branchSubFilter, myGroupCodes]);

  // ── Grup sıralaması (filterMode + branchSubFilter + myGroupCodes takip eder) ──
  const rankedGroups = useMemo<RankedGroup[]>(() => {
    let base: typeof withScores;
    if (filterMode === "trainer") {
      base = myGroupCodes?.length
        ? withScores.filter(s => myGroupCodes.includes(s.groupCode))
        : withScores;
    } else {
      base = branchSubFilter !== ALL_BRANCH
        ? withScores.filter(s => s.branch === branchSubFilter)
        : withScores;
    }
    const byGroup: Record<string, RankedStudent[]> = {};
    const all = [...base].sort(sortFn).map((s, i) => ({ ...s, rank: i + 1 })) as RankedStudent[];
    for (const s of all) {
      if (!s.groupCode) continue;
      if (!byGroup[s.groupCode]) byGroup[s.groupCode] = [];
      byGroup[s.groupCode].push(s);
    }
    return Object.entries(byGroup)
      .map(([code, students]) => {
        const activeCount  = students.filter(s => (s.completedTasks ?? 0) >= 1).length;
        const studentCount = students.length;
        const rawScore     = safe(students.reduce((acc, s) => acc + s.score, 0) / Math.max(studentCount, 1));
        const displayScore = Math.round(rawScore * studentCount);
        const totalXP      = students.reduce((acc, s) => acc + (s.points ?? 0), 0);
        return { code, students, activeCount, studentCount, rawScore, displayScore, totalXP, branch: students[0]?.branch ?? "" };
      })
      .sort((a, b) => b.rawScore - a.rawScore)
      .map((g, i) => ({ ...g, rank: i + 1 }));
  }, [withScores, filterMode, branchSubFilter, myGroupCodes]);

  // ── Özet istatistikler ────────────────────────────────────────────────────
  const summaryStats = useMemo(() => ({
    studentCount:   rankedStudents.length,
    totalCompleted: rankedStudents.reduce((s, x) => s + (x.completedTasks ?? 0), 0),
    totalXP:        rankedStudents.reduce((s, x) => s + (x.points ?? 0), 0),
    avgScore:       rankedStudents.length > 0 ? rankedStudents.reduce((s, x) => s + x.score, 0) / rankedStudents.length : 0,
  }), [rankedStudents]);

  // ── Analytics (podyum verisi takip eder) ──────────────────────────────────
  const analytics = useMemo(() => {
    if (podiumStudents.length === 0) return null;

    // rankChange: genel sıra ile son 30 günlük sıra farkı (pozitif = yükseliş)
    const byGeneral = [...podiumStudents].sort((a, b) => b.generalScore - a.generalScore);
    const byRecent  = [...podiumStudents].sort((a, b) => b.recentScore  - a.recentScore);
    const generalRankMap = new Map(byGeneral.map((s, i) => [s.id, i + 1]));
    const recentRankMap  = new Map(byRecent.map((s, i) => [s.id, i + 1]));
    const withChange = podiumStudents.map(s => ({
      ...s,
      rankChange: (generalRankMap.get(s.id) ?? 0) - (recentRankMap.get(s.id) ?? 0),
    }));

    const maxXP      = Math.max(...withChange.map(s => s.points ?? 0));
    const maxTasks   = Math.max(...withChange.map(s => s.completedTasks ?? 0));
    const minPenalty = Math.min(...withChange.map(s => s.latePenaltyTotal ?? 0));

    const topXP        = withChange.filter(s => (s.points ?? 0) === maxXP);
    const mostTasks    = withChange.filter(s => (s.completedTasks ?? 0) === maxTasks);
    const leastPenalty = withChange.filter(s => (s.latePenaltyTotal ?? 0) === minPenalty);

    const rising        = withChange.filter(s => (s.rankChange ?? 0) > 0).sort((a, b) => (b.rankChange ?? 0) - (a.rankChange ?? 0));
    const fastestRising = rising.length > 0 ? [rising[0]] : [];

    return { topXP, fastestRising, mostTasks, leastPenalty };
  }, [podiumStudents]);

  const groupAnalytics = useMemo(() => {
    if (rankedGroups.length === 0) return null;
    const topScore     = rankedGroups[0];
    const topXP        = [...rankedGroups].sort((a, b) => b.totalXP - a.totalXP)[0];
    const mostStudents = [...rankedGroups].sort((a, b) => b.studentCount - a.studentCount)[0];
    const mostActive   = [...rankedGroups].sort((a, b) => b.activeCount - a.activeCount)[0];
    return { topScore, topXP, mostStudents, mostActive };
  }, [rankedGroups]);

  const handleStudentClick = (student: RankedStudent) => {
    const formattedStudent = { ...student, avatarId: Number(student.avatarId) || 0 };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setSelectedStudent(formattedStudent as any);
    setModalOpen(true);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
    {showIntro && <LeagueIntro onComplete={() => { _leagueIntroShown = true; setShowIntro(false); }} />}
    <div className="flex h-screen overflow-hidden bg-surface-50 font-inter antialiased text-text-primary">

      <aside className="hidden lg:block h-full shrink-0 z-50 transition-all duration-300 w-70 2xl:w-[320px] bg-[#10294C]">
        <Sidebar />
      </aside>

      <div className="flex-1 flex flex-col min-w-0 relative h-full">
        <Header />

        <main className="flex-1 w-full overflow-y-auto overflow-x-clip [scrollbar-gutter:stable]">
          <div className="w-[94%] mx-auto py-8 max-w-7xl xl:max-w-400 2xl:max-w-480">

            {/* ── HEADER BAR ─────────────────────────────────────────────── */}
            <div className="bg-base-primary-500 rounded-20 px-6 py-5 mb-3 flex items-center gap-5">
              <div className="flex items-center gap-3 shrink-0">
                <div className="w-10 h-10 rounded-16 bg-white/20 flex items-center justify-center">
                  <Trophy size={20} className="text-white" />
                </div>
                <div>
                  <h1 className="text-[20px] font-bold text-white leading-tight">Sınıflar Ligi</h1>
                  <p className="text-[11px] text-white/60 font-medium">Puan sıralaması</p>
                </div>
              </div>

              <div className="w-px h-10 bg-white/20 shrink-0" />

              {!loading && (
                <div className="flex items-center gap-7 flex-1">
                  {[
                    { label: "Öğrenci",    value: summaryStats.studentCount },
                    { label: "Tamamlanan", value: summaryStats.totalCompleted },
                    { label: "Toplam XP",  value: summaryStats.totalXP },
                    { label: "Ort. Puan",  value: summaryStats.avgScore.toFixed(1) },
                  ].map(({ label, value }) => (
                    <div key={label} className="text-center">
                      <p className="text-[18px] font-bold text-white tabular-nums leading-none">{value}</p>
                      <p className="text-[10px] text-white/60 font-medium mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── İÇERİK ────────────────────────────────────────────────── */}
            {loading ? (
              <div className="bg-white rounded-20 border border-surface-200 flex items-center justify-center h-64" style={{ boxShadow: "0 4px 40px rgba(0,0,0,0.04)" }}>
                <div className="w-6 h-6 border-2 border-surface-100 border-t-[#FF8D28] rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">

                {/* ── GENEL GÖRÜNÜŞ — her zaman görünür ── */}
                <div className="flex items-center justify-between mt-8 pb-4 border-b border-neutral-300">
                  <div className="flex items-center gap-2.5">
                    <Trophy size={17} className="text-[#FF8D28]" />
                    <h2 className="text-[16px] font-bold text-base-primary-900 tracking-tight">Genel Görünüş</h2>
                  </div>
                  <span className="px-3 py-1 rounded-full text-[12px] font-semibold bg-[#FFF0E0] text-[#C45000] border border-[#FFDDB8]">
                    {new Date().toLocaleDateString("tr-TR", { month: "long", year: "numeric" })}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {viewMode === "students" ? (
                    <>
                      {podiumStudents.length > 0 && <PodiumSection students={podiumStudents.slice(0, 3)} onStudentClick={handleStudentClick} />}
                      {analytics && <AnalyticsGrid analytics={analytics} />}
                    </>
                  ) : (
                    <>
                      {rankedGroups.length >= 2 && <GroupPodium groups={rankedGroups.slice(0, 3)} />}
                      {groupAnalytics && <GroupAnalyticsGrid analytics={groupAnalytics} />}
                    </>
                  )}
                </div>

                {/* ── LİG TABLOSU BAŞLIĞI ── */}
                <div className="flex items-center mt-8 pb-4 border-b border-neutral-300">
                  <Users size={17} className="text-base-primary-900 shrink-0" />
                  <h2 className="text-[16px] font-bold text-base-primary-900 tracking-tight ml-2.5">Lig Tablosu</h2>
                  <span className="text-[13px] font-medium text-neutral-400 border-l border-neutral-200 pl-3 ml-3 h-5 flex items-center shrink-0">
                    {rankedGroups.length} grup · {rankedStudents.length} öğrenci
                  </span>
                  {/* Öğrenci / Grup Bazlı — 32px sağda */}
                  <div className="ml-8 flex items-center bg-surface-50 p-1 rounded-xl border border-neutral-100 shadow-sm">
                    {(["students", "groups"] as ViewMode[]).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => {
                          setViewMode(mode);
                          if (mode === "groups") {
                            setFilterMode("branch");
                            setBranchSubFilter(ALL_BRANCH);
                            setOpenDropdown(null);
                          }
                        }}
                        className={`px-4 py-1.5 rounded-[10px] text-[13px] font-semibold transition-all cursor-pointer outline-none select-none whitespace-nowrap ${
                          viewMode === mode
                            ? "bg-white text-base-primary-900 shadow-sm border border-neutral-100"
                            : "text-neutral-400 hover:text-neutral-600 border border-transparent"
                        }`}
                      >
                        {mode === "students" ? "Öğrenci Bazlı" : "Grup Bazlı"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dropdown dış tıklama kapatma */}
                {openDropdown && (
                  <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)} />
                )}

                {/* ── FİLTRE SATIRI (her iki modda da görünür) ── */}
                <div className="mt-6 flex items-center justify-between">

                    {/* Sol: Eğitmen/Şube toggle + seçim butonları */}
                    <div className="flex items-center">
                      {/* Eğitmen Bazlı / Şube Bazlı toggle — aktif lacivert */}
                      <div className="flex items-center gap-0.5 bg-surface-100 border border-surface-200 rounded-10 p-0.5">
                        {(["trainer", "branch"] as const).map((mode) => (
                          <button
                            key={mode}
                            onClick={() => {
                              setFilterMode(mode);
                              setTrainerGroupFilter(ALL_GROUP);
                              setBranchSubFilter(
                                mode === "branch" && user?.branch && branchOptions.includes(user.branch)
                                  ? user.branch
                                  : ALL_BRANCH
                              );
                              setOpenDropdown(null);
                            }}
                            className={`text-[12px] font-semibold px-3 h-7 rounded-8 transition-all cursor-pointer outline-none whitespace-nowrap ${
                              filterMode === mode
                                ? "bg-base-primary-900 text-white shadow-sm"
                                : "text-text-tertiary hover:text-text-primary"
                            }`}
                          >
                            {mode === "trainer" ? "Eğitmen Bazlı" : "Şube Bazlı"}
                          </button>
                        ))}
                      </div>

                      {/* Seçim butonları — Trendyol pill stili, 64px sağda */}
                      <div className="ml-16 flex items-center gap-2">
                        {filterMode === "trainer" && viewMode === "groups" ? null : filterMode === "trainer" ? (
                          <>
                            {/* Tüm Gruplarım — sade text buton */}
                            <button
                              onClick={() => { setTrainerGroupFilter(ALL_GROUP); setOpenDropdown(null); }}
                              className={`text-[12px] transition-colors cursor-pointer outline-none whitespace-nowrap ${
                                trainerGroupFilter === ALL_GROUP
                                  ? "font-bold text-base-primary-900 underline underline-offset-2 decoration-base-primary-400"
                                  : "font-semibold text-neutral-400 hover:text-base-primary-700"
                              }`}
                            >
                              Tüm Gruplarım
                            </button>
                            {/* Gruplarım dropdown — pill buton */}
                            <div className="relative">
                              <button
                                onClick={() => setOpenDropdown(openDropdown === "groups" ? null : "groups")}
                                className={`flex items-center gap-1 px-3 h-7 rounded-full text-[12px] font-medium border transition-all cursor-pointer outline-none whitespace-nowrap ${
                                  trainerGroupFilter !== ALL_GROUP
                                    ? "border-base-primary-900 text-base-primary-900 font-semibold bg-white"
                                    : "border-neutral-300 text-neutral-500 bg-white hover:border-neutral-400 hover:text-neutral-700"
                                }`}
                              >
                                {trainerGroupFilter !== ALL_GROUP ? trainerGroupFilter : "Gruplarım"}
                                <ChevronRight size={11} className={`transition-transform ${openDropdown === "groups" ? "rotate-90" : ""}`} />
                              </button>
                              {openDropdown === "groups" && (
                                <div className="absolute top-full left-0 mt-1.5 bg-white border border-neutral-200 rounded-12 shadow-lg z-20 py-1 min-w-[150px]">
                                  {groupOptions.filter(g => g !== ALL_GROUP).map((g) => (
                                    <button
                                      key={g}
                                      onClick={() => { setTrainerGroupFilter(g); setOpenDropdown(null); }}
                                      className={`w-full text-left px-4 py-2.5 text-[13px] transition-colors cursor-pointer outline-none ${
                                        trainerGroupFilter === g
                                          ? "font-semibold text-base-primary-900 bg-base-primary-50"
                                          : "font-medium text-neutral-600 hover:bg-surface-50"
                                      }`}
                                    >
                                      {g}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </>
                        ) : (
                          <>
                            {/* Tüm Şubeler — sade text buton */}
                            <button
                              onClick={() => { setBranchSubFilter(ALL_BRANCH); setOpenDropdown(null); }}
                              className={`text-[12px] transition-colors cursor-pointer outline-none whitespace-nowrap ${
                                branchSubFilter === ALL_BRANCH
                                  ? "font-bold text-base-primary-900 underline underline-offset-2 decoration-base-primary-400"
                                  : "font-semibold text-neutral-400 hover:text-base-primary-700"
                              }`}
                            >
                              Tüm Şubeler
                            </button>
                            {/* Şubeler dropdown — pill buton */}
                            <div className="relative">
                              <button
                                onClick={() => setOpenDropdown(openDropdown === "branches" ? null : "branches")}
                                className={`flex items-center gap-1 px-3 h-7 rounded-full text-[12px] font-medium border transition-all cursor-pointer outline-none whitespace-nowrap ${
                                  branchSubFilter !== ALL_BRANCH
                                    ? "border-base-primary-900 text-base-primary-900 font-semibold bg-white"
                                    : "border-neutral-300 text-neutral-500 bg-white hover:border-neutral-400 hover:text-neutral-700"
                                }`}
                              >
                                {branchSubFilter !== ALL_BRANCH ? branchSubFilter : "Şubeler"}
                                <ChevronRight size={11} className={`transition-transform ${openDropdown === "branches" ? "rotate-90" : ""}`} />
                              </button>
                              {openDropdown === "branches" && (
                                <div className="absolute top-full left-0 mt-1.5 bg-white border border-neutral-200 rounded-12 shadow-lg z-20 py-1 min-w-[160px]">
                                  {branchOptions.filter(b => b !== ALL_BRANCH).map((b) => (
                                    <button
                                      key={b}
                                      onClick={() => { setBranchSubFilter(b); setOpenDropdown(null); }}
                                      className={`w-full text-left px-4 py-2.5 text-[13px] transition-colors cursor-pointer outline-none ${
                                        branchSubFilter === b
                                          ? "font-semibold text-base-primary-900 bg-base-primary-50"
                                          : "font-medium text-neutral-600 hover:bg-surface-50"
                                      }`}
                                    >
                                      {b}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Sağ: Toplam / Aylık — sadece öğrenci modunda */}
                    {viewMode === "students" && <div className="flex items-center gap-1 bg-surface-100 border border-surface-200 rounded-full p-1">
                      {(["total", "monthly"] as ScoreMode[]).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setScoreMode(mode)}
                          className={`text-[11px] font-semibold px-3 h-6 rounded-full transition-all cursor-pointer outline-none whitespace-nowrap ${
                            scoreMode === mode
                              ? "bg-white text-text-primary shadow-sm"
                              : "text-text-tertiary hover:text-text-primary"
                          }`}
                        >
                          {mode === "total" ? "Toplam" : "Aylık"}
                        </button>
                      ))}
                    </div>}

                  </div>

                {/* ── TABLO ── */}
                <div className="mt-4">
                  {viewMode === "students" ? (
                    rankedStudents.length === 0 ? (
                      <div className="bg-white rounded-20 border border-surface-200 min-h-48 flex flex-col items-center justify-center gap-3 p-12" style={{ boxShadow: "0 4px 40px rgba(0,0,0,0.04)" }}>
                        <Users size={36} className="text-surface-200" />
                        <p className="text-[14px] font-semibold text-text-placeholder">Öğrenci bulunamadı</p>
                        <p className="text-[12px] text-text-disabled text-center max-w-60">Bu filtreye ait öğrenci kaydı bulunmamaktadır.</p>
                      </div>
                    ) : (
                      <LeaderTable students={rankedStudents} onStudentClick={handleStudentClick} groupsMap={groupsMap} />
                    )
                  ) : (
                    rankedGroups.length === 0 ? (
                      <div className="bg-white rounded-20 border border-surface-200 min-h-48 flex flex-col items-center justify-center gap-3 p-12" style={{ boxShadow: "0 4px 40px rgba(0,0,0,0.04)" }}>
                        <Users size={36} className="text-surface-200" />
                        <p className="text-[14px] font-semibold text-text-placeholder">Grup bulunamadı</p>
                        <p className="text-[12px] text-text-disabled text-center max-w-60">Bu filtreye ait grup bilgisi bulunmamaktadır.</p>
                      </div>
                    ) : (
                      <GroupTable groups={rankedGroups} groupsMap={groupsMap} />
                    )
                  )}
                </div>

              </div>
            )}

          </div>
        </main>

        <Footer setActiveTab={setActiveTab} />
      </div>

      <StudentDetailModal
        student={selectedStudent}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
    </>
  );
}
