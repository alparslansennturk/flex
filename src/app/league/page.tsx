"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Trophy,
  ArrowBigUpDash,
  ArrowBigDownDash,
  Minus,
  Zap,
  CheckSquare,
  Shield,
  TrendingUp,
  Users,
  ChevronDown,
} from "lucide-react";
import { useScoring } from "@/app/context/ScoringContext";
import { computeStudentStats, calcStudentFinalScore, safe, ScoringSettings } from "@/app/lib/scoring";

// ─── Types ───────────────────────────────────────────────────────────────────

interface StudentData {
  id: string;
  name: string;
  lastName: string;
  gender?: string;
  groupCode: string;
  branch: string;
  gradedTasks?: Record<string, { xp: number; penalty: number; classId?: string; endDate?: string }>;
  isScoreHidden?: boolean;
  avatarId?: number | string;
  rankChange?: number;
  status?: string;
  points?: number;
  completedTasks?: number;
  latePenaltyTotal?: number;
}

interface TaskMeta {
  id: string;
  endDate:   string | null;
  createdAt: string | null;
  classId:   string | null;
  status:    string | null;
}

interface GroupMeta {
  code: string | null;
  instructor: string | null;
  instructorId: string | null;
  branch: string | null;
}

interface RankedStudent extends StudentData {
  rank: number;
  score: number;
  generalScore: number;
  recentScore: number;
  finalScore: number;
}

interface RankedGroup {
  code: string;
  rank: number;
  students: RankedStudent[];
  activeCount: number;
  studentCount: number;
  rawScore: number;
  displayScore: number;
  totalXP: number;
  branch: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MEDALS = ["🥇", "🥈", "🥉"];

type ScoreMode   = "monthly" | "total";
type ViewMode    = "students" | "groups";

// ─── TrendIcon ────────────────────────────────────────────────────────────────

function TrendIcon({ rankChange, rank }: { rankChange?: number; rank: number }) {
  const change = rankChange ?? 0;
  if (change > 0) return <ArrowBigUpDash size={15} className="text-[#FF8D28]" strokeWidth={2} />;
  if (change < 0) return <ArrowBigDownDash size={15} className="text-[#AEB4C0]" strokeWidth={2} />;
  return <Minus size={15} className={rank === 1 ? "text-[#FF8D28]" : "text-[#AEB4C0]"} strokeWidth={2} />;
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

// ─── Analytics Grid ───────────────────────────────────────────────────────────

const ANALYTICS_CELLS = [
  { key: "topXP",         label: "En Yüksek XP",     icon: Zap,         bg: "#FFF0E0", iconBg: "#FFDDB8", iconColor: "#C45000", nameColor: "#7A3200", subColor: "#A84400" },
  { key: "fastestRising", label: "En Hızlı Yükseliş", icon: TrendingUp,  bg: "#E0F8F6", iconBg: "#B0EEE8", iconColor: "#0A7A74", nameColor: "#084840", subColor: "#0D6A64" },
  { key: "mostTasks",     label: "En Çok Görev",       icon: CheckSquare, bg: "#E0EDFF", iconBg: "#B8D4FF", iconColor: "#1850C4", nameColor: "#0E2860", subColor: "#1840A0" },
  { key: "leastPenalty",  label: "En Az Ceza",         icon: Shield,      bg: "#EEE0FA", iconBg: "#DDB8F5", iconColor: "#6018A4", nameColor: "#380A68", subColor: "#5010A0" },
] as const;

type AnalyticsCellKey = typeof ANALYTICS_CELLS[number]["key"];

function AnalyticsGrid({ analytics }: {
  analytics: {
    topXP: RankedStudent;
    fastestRising: RankedStudent | null;
    mostTasks: RankedStudent;
    leastPenalty: RankedStudent;
  };
}) {
  const getSub = (key: AnalyticsCellKey, s: RankedStudent | null) => {
    if (!s) return "—";
    if (key === "topXP")         return `${s.points ?? 0} XP`;
    if (key === "fastestRising") return `+${s.rankChange ?? 0} sıra`;
    if (key === "mostTasks")     return `${s.completedTasks ?? 0} görev`;
    if (key === "leastPenalty")  return `${s.latePenaltyTotal ?? 0} ceza`;
    return "—";
  };

  return (
    <div className="rounded-20 overflow-hidden grid grid-cols-2" style={{ boxShadow: "0 4px 36px rgba(0,0,0,0.05)" }}>
      {ANALYTICS_CELLS.map(({ key, label, icon: Icon, bg, iconBg, iconColor, nameColor, subColor }, i) => {
        const student = analytics[key];
        const sub     = getSub(key, student);
        const borderR = i % 2 === 0 ? "border-r-2 border-white/70" : "";
        const borderB = i < 2 ? "border-b-2 border-white/70" : "";
        return (
          <div key={key} className={`${borderR} ${borderB} p-5 flex flex-col gap-3 relative overflow-hidden`} style={{ background: bg }}>
            <Icon size={80} strokeWidth={0.8} className="absolute -right-4 -bottom-4 pointer-events-none" style={{ color: iconColor, opacity: 0.07 }} />
            <div className="flex items-center gap-2.5 relative z-10">
              <div className="w-9 h-9 rounded-12 flex items-center justify-center shrink-0" style={{ background: iconBg }}>
                <Icon size={17} style={{ color: iconColor }} />
              </div>
              <p className="text-[11px] font-bold uppercase tracking-wide leading-none" style={{ color: subColor }}>{label}</p>
            </div>
            {student ? (
              <>
                <div className="flex items-center gap-2 relative z-10">
                  <Avatar gender={student.gender} avatarId={student.avatarId} size={32} />
                  <p className="text-[14px] font-bold leading-tight truncate" style={{ color: nameColor }}>
                    {student.name} {student.lastName}
                  </p>
                </div>
                <p className="text-[22px] font-black tabular-nums leading-none relative z-10" style={{ color: iconColor }}>{sub}</p>
              </>
            ) : (
              <p className="text-[13px] relative z-10" style={{ color: subColor }}>Veri yok</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Group Analytics Grid ─────────────────────────────────────────────────────

const GROUP_ANALYTICS_CELLS = [
  { key: "topScore",     label: "En Yüksek Puan",      icon: Trophy,     bg: "#FFF0E0", iconBg: "#FFDDB8", iconColor: "#C45000", nameColor: "#7A3200", subColor: "#A84400" },
  { key: "topXP",        label: "En Yüksek Toplam XP", icon: Zap,        bg: "#E0EDFF", iconBg: "#B8D4FF", iconColor: "#1850C4", nameColor: "#0E2860", subColor: "#1840A0" },
  { key: "mostStudents", label: "En Fazla Öğrenci",    icon: Users,      bg: "#E0F8F6", iconBg: "#B0EEE8", iconColor: "#0A7A74", nameColor: "#084840", subColor: "#0D6A64" },
  { key: "mostActive",   label: "En Aktif Grup",        icon: TrendingUp, bg: "#EEE0FA", iconBg: "#DDB8F5", iconColor: "#6018A4", nameColor: "#380A68", subColor: "#5010A0" },
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
        const group   = analytics[key as keyof typeof analytics];
        const borderR = i % 2 === 0 ? "border-r-2 border-white/70" : "";
        const borderB = i < 2 ? "border-b-2 border-white/70" : "";
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

function PodiumSection({ students }: {
  students: RankedStudent[];
}) {
  const ordered = [students[1], students[0], students[2]].filter((s): s is RankedStudent => Boolean(s));

  const stepH: Record<number, string>    = { 1: "h-12", 2: "h-8", 3: "h-5" };
  const stepGrad: Record<number, string> = {
    1: "linear-gradient(to bottom, rgba(255,141,40,0.20) 0%, transparent 100%)",
    2: "linear-gradient(to bottom, rgba(174,180,192,0.15) 0%, transparent 100%)",
    3: "linear-gradient(to bottom, rgba(174,180,192,0.12) 0%, transparent 100%)",
  };
  const cardW: Record<number, number>  = { 1: 148, 2: 126, 3: 126 };
  const avSize: Record<number, number> = { 1: 56, 2: 44, 3: 44 };

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
            <div key={student.id} className="flex flex-col items-center">
              <div
                className={`border border-surface-200 rounded-16 p-3.5 flex flex-col items-center gap-2 ${isFirst ? "bg-designstudio-primary-50" : "bg-white"}`}
                style={{ width: cardW[rank], boxShadow: isFirst ? "0 4px 32px rgba(255,141,40,0.10)" : "0 4px 28px rgba(0,0,0,0.04)" }}
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
              <div className={`${stepH[rank]} rounded-t-8 w-full`} style={{ background: stepGrad[rank] }} />
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
                className={`border border-surface-200 rounded-16 p-3.5 flex flex-col items-center gap-2 ${isFirst ? "bg-designstudio-primary-50" : "bg-white"}`}
                style={{ width: cardW[rank], boxShadow: isFirst ? "0 4px 32px rgba(255,141,40,0.10)" : "0 4px 28px rgba(0,0,0,0.04)" }}
              >
                <span className="text-[26px] leading-none">{MEDALS[rank - 1]}</span>
                <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ background: isFirst ? "rgba(255,141,40,0.15)" : "#F3F4F6" }}>
                  <Users size={22} className={isFirst ? "text-[#FF8D28]" : "text-text-tertiary"} />
                </div>
                <div className="text-center w-full">
                  <p className={`font-bold text-text-primary truncate leading-snug ${isFirst ? "text-[14px]" : "text-[13px]"}`}>{group.code}</p>
                  <p className="text-[10px] text-text-tertiary mt-0.5">{group.activeCount} aktif öğrenci</p>
                </div>
                <div className="text-center w-full pt-1.5 border-t border-surface-100">
                  <p className={`font-bold tabular-nums leading-none ${isFirst ? "text-[20px] text-[#FF8D28]" : "text-[16px] text-text-primary"}`}>
                    {Math.round(group.rawScore).toLocaleString("tr-TR")}
                  </p>
                  <p className="text-[10px] text-text-tertiary font-semibold mt-0.5">puan</p>
                  <p className="text-[10px] text-text-secondary tabular-nums mt-1.5">Toplam: {group.displayScore.toLocaleString("tr-TR")}</p>
                  <p className="text-[9px] text-text-disabled tabular-nums mt-0.5">{group.totalXP.toLocaleString("tr-TR")} XP</p>
                </div>
              </div>
              <div className={`${stepH[rank]} rounded-t-8 w-full`} style={{ background: stepGrad[rank] }} />
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
            const isTop3 = group.rank <= 3;
            return (
              <tr key={group.code} className={`border-b border-surface-50 last:border-0 hover:bg-surface-50 transition-colors ${isTop3 ? "bg-surface-50/50" : ""}`}>
                <td className="px-8 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 shrink-0 flex justify-center">
                      {isTop3
                        ? <span className="text-[14px] leading-none">{MEDALS[group.rank - 1]}</span>
                        : <span className="text-[12px] font-bold text-text-tertiary">#</span>
                      }
                    </span>
                    <span className={`text-[14px] font-bold tabular-nums ${isTop3 ? "text-text-secondary" : "text-text-tertiary"}`}>{group.rank}.</span>
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
                  <span className="text-[13px] font-semibold text-text-tertiary tabular-nums">{group.totalXP.toLocaleString("tr-TR")} XP</span>
                </td>
                <td className="px-6 py-3 text-right hidden md:table-cell">
                  <span className="text-[13px] font-semibold text-text-tertiary tabular-nums">{group.studentCount}</span>
                </td>
                <td className="px-6 py-3 text-right hidden xl:table-cell">
                  <span className="text-[13px] font-semibold text-text-secondary tabular-nums">{group.activeCount}</span>
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

// ─── Leaderboard Table ────────────────────────────────────────────────────────

function LeaderTable({ students, groupsMap }: {
  students: RankedStudent[];
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
          </tr>
        </thead>
        <tbody>
          {students.map((student) => {
            const medal  = MEDALS[student.rank - 1];
            const isTop3 = !!medal;
            return (
              <tr
                key={student.id}
                className={`border-b border-surface-50 last:border-0 transition-colors ${isTop3 ? "bg-surface-50/50" : ""}`}
              >
                <td className="px-8 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 shrink-0 flex justify-center">
                      {isTop3
                        ? <span className="text-[14px] leading-none">{medal}</span>
                        : <span className="text-[12px] font-bold text-text-tertiary">#</span>
                      }
                    </span>
                    <span className={`text-[14px] font-bold tabular-nums ${isTop3 ? "text-text-secondary" : "text-text-tertiary"}`}>{student.rank}.</span>
                  </div>
                </td>
                <td className="px-6 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar gender={student.gender} avatarId={student.avatarId} size={28} />
                    <div className="min-w-0">
                      <p className="text-[14px] font-bold text-text-primary leading-none truncate">{student.name} {student.lastName}</p>
                      <p className="text-[12px] text-text-tertiary leading-snug truncate mt-0.5">{student.branch}</p>
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
                  <span className={`text-[15px] font-bold tabular-nums ${student.rank === 1 ? "text-[#FF8D28]" : "text-text-primary"}`}>
                    {Math.round(student.score)}
                  </span>
                </td>
                <td className="px-6 py-3 text-right hidden md:table-cell">
                  <span className="text-[13px] font-semibold text-text-tertiary tabular-nums">{(student.points ?? 0).toLocaleString("tr-TR")} XP</span>
                </td>
                <td className="px-6 py-3 text-right hidden xl:table-cell">
                  <span className="text-[13px] font-semibold text-text-secondary tabular-nums">{student.completedTasks ?? 0}</span>
                </td>
                <td className="px-6 py-3 text-right hidden xl:table-cell">
                  <span className="text-[13px] font-semibold text-text-tertiary tabular-nums">{student.latePenaltyTotal ?? 0}</span>
                </td>
                <td className="px-6 py-3">
                  <div className="flex justify-center">
                    <TrendIcon rankChange={student.rankChange} rank={student.rank} />
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

// ─── Filter Dropdown ──────────────────────────────────────────────────────────

function FilterDropdown({ selectedBranch, branches, onChange }: {
  selectedBranch: string;
  branches: string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const options = [
    { value: "", label: "Tüm Şubeler" },
    ...branches.map(b => ({ value: b, label: b })),
  ];

  const selected = options.find(o => o.value === selectedBranch) ?? options[0];

  return (
    <div className="relative">
      {open && <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />}
      <button onClick={() => setOpen(v => !v)} className="league-filter-btn">
        <span>{selected.label}</span>
        <ChevronDown size={14} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 bg-white border border-neutral-200 rounded-12 shadow-lg z-20 py-1 min-w-[200px]">
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-[13px] transition-colors cursor-pointer outline-none ${
                selectedBranch === opt.value
                  ? "font-semibold text-base-primary-900 bg-base-primary-50"
                  : "font-medium text-neutral-600 hover:bg-surface-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Content ─────────────────────────────────────────────────────────────

function LeagueContent() {
  const searchParams = useSearchParams();
  const branchParam  = searchParams.get("branch") ?? "";

  const [selectedBranch,  setSelectedBranch]  = useState<string>(branchParam);
  const [scoreMode,       setScoreMode]       = useState<ScoreMode>("total");
  const [viewMode,        setViewMode]        = useState<ViewMode>("students");
  const [sortAlpha,       setSortAlpha]       = useState(false);
  const [rawStudents,     setRawStudents]     = useState<StudentData[]>([]);
  const [tasksMap,        setTasksMap]        = useState<Record<string, { endDate?: string; createdAt?: string; classId?: string; status?: string }>>({});
  const [groupsMap,       setGroupsMap]       = useState<Record<string, string>>({});
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState<string | null>(null);
  const [apiSettings,     setApiSettings]     = useState<ScoringSettings | null>(null);
  const [apiSeasonId,     setApiSeasonId]     = useState<string | null>(null);

  // ScoringContext: login olunca gerçek ayarlar gelir, logout'ta DEFAULT_SCORING (bonusMultiplier=1) kalır.
  // API'den gelen ayarlar (admin SDK, auth gerektirmez) her zaman doğru — onları öncelik olarak kullan.
  const { settings: ctxSettings, activeSeasonId: ctxSeasonId } = useScoring();
  const settings       = apiSettings  ?? ctxSettings;
  const activeSeasonId = apiSeasonId  ?? ctxSeasonId;

  // ── Veri çek (API route — Admin SDK, auth gerektirmez) ────────────────────
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch("/api/league")
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data: { students: StudentData[]; tasks: TaskMeta[]; groups: GroupMeta[]; scoringSettings?: ScoringSettings; activeSeasonId?: string }) => {
        setRawStudents(data.students);

        if (data.scoringSettings) setApiSettings(data.scoringSettings);
        if (data.activeSeasonId)  setApiSeasonId(data.activeSeasonId);

        const tMap: Record<string, { endDate?: string; createdAt?: string; classId?: string; status?: string }> = {};
        data.tasks.forEach(t => {
          tMap[t.id] = { endDate: t.endDate ?? undefined, createdAt: t.createdAt ?? undefined, classId: t.classId ?? undefined, status: t.status ?? undefined };
        });
        setTasksMap(tMap);

        const gMap: Record<string, string> = {};
        data.groups.forEach(g => { if (g.code) gMap[g.code] = g.instructor ?? ""; });
        setGroupsMap(gMap);

        setLoading(false);
      })
      .catch(() => { setError("Veriler yüklenirken bir hata oluştu."); setLoading(false); });
  }, []);

  // ── Puan hesaplama ────────────────────────────────────────────────────────
  const withScores = useMemo(() => {
    const thirtyDaysAgo = Date.now() - 30 * 86400000;
    const recentTaskIds = new Set<string>(
      Object.entries(tasksMap)
        .filter(([, t]) => {
          const d = t.endDate
            ? new Date(t.endDate).getTime()
            : t.createdAt ? new Date(t.createdAt).getTime() : 0;
          return d >= thirtyDaysAgo;
        })
        .map(([id]) => id)
    );

    return rawStudents.map((s) => {
      const allTasks = s.gradedTasks ?? {};
      const tasks = Object.fromEntries(
        Object.entries(allTasks).filter(([tid, entry]) => {
          const storedClassId = entry.classId;
          if (storedClassId) return storedClassId === s.groupCode;
          const mapClassId = tasksMap[tid]?.classId;
          if (!mapClassId) return true;
          return mapClassId === s.groupCode;
        })
      );
      const { totalXP: baseXP, completedTasks, latePenaltyTotal } = computeStudentStats(tasks, s.isScoreHidden, activeSeasonId);
      // G1→G2 / carry-over bonusu: sınıf bitirildiğinde hesaplanan, sadece lig tablosuna etkili
      const g2Bonus = s.isScoreHidden ? 0 : ((s as any).g2StartXP ?? 0);
      const totalXP = baseXP + g2Bonus;
      const recentEntries = s.isScoreHidden ? [] : Object.entries(tasks).filter(([tid, entry]) => {
        if (recentTaskIds.has(tid)) return true;
        if (tasksMap[tid] !== undefined) return false;
        const storedEnd = entry.endDate;
        if (storedEnd) return new Date(storedEnd).getTime() >= thirtyDaysAgo;
        return true;
      });
      const recentXP           = recentEntries.reduce((sum, [, e]) => sum + (e.xp ?? 0), 0);
      const recentCompleted    = recentEntries.length;
      // totalAssignedTasks: deadline geçmiş görevler (yeni görev puan düşürmez)
      const todayStr = new Date().toISOString().split("T")[0];
      const totalAssignedTasks = Object.values(tasksMap).filter(t =>
        t.classId === s.groupCode &&
        (t.status === "active" || t.status === "published" || t.status === "completed" || !t.status) &&
        (t.status === "completed" || (t.endDate ? t.endDate <= todayStr : true))
      ).length;
      // g2Bonus = carryOverScore: sadece final skora eklenir, averageXP/bonus hesabına girmez
      const { finalScore: generalScore, debug: dbg } = calcStudentFinalScore(baseXP, completedTasks, settings, totalAssignedTasks || undefined, g2Bonus, 0);
      const { finalScore: recentScore }               = calcStudentFinalScore(recentXP, recentCompleted, settings);
      if (process.env.NODE_ENV === "development") console.log(`[League/Public] ${s.name} ${s.lastName}`, dbg);
      return {
        ...s,
        points: totalXP,
        completedTasks,
        latePenaltyTotal,
        generalScore,
        recentScore,
        finalScore: generalScore,
        score: scoreMode === "monthly" ? recentScore : generalScore,
      };
    });
  }, [rawStudents, settings, activeSeasonId, scoreMode, tasksMap]);

  const sortFn = (a: typeof withScores[0], b: typeof withScores[0]) => {
    const sd = b.score - a.score; if (sd !== 0) return sd;
    const pd = (a.latePenaltyTotal ?? 0) - (b.latePenaltyTotal ?? 0); if (pd !== 0) return pd;
    const td = (b.completedTasks ?? 0) - (a.completedTasks ?? 0); if (td !== 0) return td;
    return `${a.name} ${a.lastName}`.localeCompare(`${b.name} ${b.lastName}`, "tr");
  };

  // Şube listesi (veriden dinamik)
  const branches = useMemo(() => {
    const set = new Set<string>();
    rawStudents.forEach(s => { if (s.branch) set.add(s.branch); });
    return Array.from(set).sort();
  }, [rawStudents]);

  // Şube filtresi
  const filtered = useMemo(() => {
    if (selectedBranch) {
      return withScores.filter(s => s.branch === selectedBranch);
    }
    return withScores;
  }, [withScores, selectedBranch]);

  // ── Sıralı öğrenciler ─────────────────────────────────────────────────────
  const rankedStudents = useMemo<RankedStudent[]>(() => {
    const sorted = [...filtered].sort(sortFn);
    // Dense ranking: eşit puanlılar aynı sırayı paylaşır, sonraki sıra atlanmaz (1,1,2,3...)
    const byScore: RankedStudent[] = [];
    for (let i = 0; i < sorted.length; i++) {
      if (i === 0) { byScore.push({ ...sorted[i], rank: 1 } as RankedStudent); continue; }
      const prev = sorted[i - 1];
      const prevRank = byScore[i - 1].rank;
      const same = prev.score === sorted[i].score && (prev.latePenaltyTotal ?? 0) === (sorted[i].latePenaltyTotal ?? 0) && (prev.completedTasks ?? 0) === (sorted[i].completedTasks ?? 0);
      byScore.push({ ...sorted[i], rank: same ? prevRank : prevRank + 1 } as RankedStudent);
    }
    if (sortAlpha) return [...byScore].sort((a, b) => `${a.name} ${a.lastName}`.localeCompare(`${b.name} ${b.lastName}`, "tr"));
    return byScore;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sortAlpha]);

  // ── Sıralı gruplar ────────────────────────────────────────────────────────
  const rankedGroups = useMemo<RankedGroup[]>(() => {
    const byGroup: Record<string, RankedStudent[]> = {};
    const all = [...filtered].sort(sortFn).map((s, i) => ({ ...s, rank: i + 1 })) as RankedStudent[];
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered]);

  // ── Özet istatistikler ────────────────────────────────────────────────────
  const summaryStats = useMemo(() => ({
    studentCount:   rankedStudents.length,
    totalCompleted: rankedStudents.reduce((s, x) => s + (x.completedTasks ?? 0), 0),
    totalXP:        rankedStudents.reduce((s, x) => s + (x.points ?? 0), 0),
    avgScore:       rankedStudents.length > 0
      ? rankedStudents.reduce((s, x) => s + x.score, 0) / rankedStudents.length
      : 0,
  }), [rankedStudents]);

  // ── Analytics ─────────────────────────────────────────────────────────────
  const analytics = useMemo(() => {
    if (rankedStudents.length === 0) return null;
    const topXP         = rankedStudents.reduce((a, b) => (a.points ?? 0) >= (b.points ?? 0) ? a : b);
    const rising        = rankedStudents.filter(s => (s.rankChange ?? 0) > 0).sort((a, b) => (b.rankChange ?? 0) - (a.rankChange ?? 0));
    const fastestRising = rising[0] ?? null;
    const mostTasks     = rankedStudents.reduce((a, b) => (a.completedTasks ?? 0) >= (b.completedTasks ?? 0) ? a : b);
    const leastPenalty  = [...rankedStudents].sort((a, b) => (a.latePenaltyTotal ?? 0) - (b.latePenaltyTotal ?? 0))[0];
    return { topXP, fastestRising, mostTasks, leastPenalty };
  }, [rankedStudents]);

  const groupAnalytics = useMemo(() => {
    if (rankedGroups.length === 0) return null;
    const topScore     = rankedGroups[0];
    const topXP        = [...rankedGroups].sort((a, b) => b.totalXP - a.totalXP)[0];
    const mostStudents = [...rankedGroups].sort((a, b) => b.studentCount - a.studentCount)[0];
    const mostActive   = [...rankedGroups].sort((a, b) => b.activeCount - a.activeCount)[0];
    return { topScore, topXP, mostStudents, mostActive };
  }, [rankedGroups]);


  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-surface-50 font-inter antialiased text-text-primary">

      {/* ── TOP BAR ──────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-surface-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30" style={{ boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}>
        <div className="flex items-center gap-1 select-none">
          <span className="text-[22px] font-semibold text-[#FF8D28]">tasarım</span>
          <span className="text-[22px] font-bold text-text-primary">atölyesi</span>
        </div>
        <FilterDropdown selectedBranch={selectedBranch} branches={branches} onChange={setSelectedBranch} />
      </div>

      <div className="w-[94%] mx-auto py-8 max-w-7xl xl:max-w-400 2xl:max-w-480">

        {/* ── HEADER BAR ───────────────────────────────────────────────── */}
        <div className="bg-base-primary-500 rounded-20 px-6 py-5 mb-3 flex items-center gap-5">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-16 bg-white/20 flex items-center justify-center">
              <Trophy size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-[20px] font-bold text-white leading-tight">Sınıflar Ligi</h1>
              <p className="text-[11px] text-white/60 font-medium">
                {selectedBranch || "Tüm Şubeler"}
              </p>
            </div>
          </div>

          <div className="w-px h-10 bg-white/20 shrink-0" />

          {!loading && !error && (
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

        {/* ── İÇERİK ───────────────────────────────────────────────────── */}
        {loading ? (
          <div className="bg-white rounded-20 border border-surface-200 flex items-center justify-center h-64" style={{ boxShadow: "0 4px 40px rgba(0,0,0,0.04)" }}>
            <div className="w-6 h-6 border-2 border-surface-100 border-t-[#FF8D28] rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-white rounded-20 border border-surface-200 flex items-center justify-center h-64" style={{ boxShadow: "0 4px 40px rgba(0,0,0,0.04)" }}>
            <p className="text-[14px] font-semibold text-text-placeholder">{error}</p>
          </div>
        ) : (
          <div className="space-y-4">

            {/* ── GENEL GÖRÜNÜŞ ── */}
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
                  {rankedStudents.length > 0 && <PodiumSection students={rankedStudents.slice(0, 3)} />}
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

              <div className="ml-8 flex items-center bg-surface-50 p-1 rounded-xl border border-neutral-100 shadow-sm">
                {(["students", "groups"] as ViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
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

              {viewMode === "students" && (
                <div className="ml-auto flex items-center gap-2">
                  {/* Puan modu */}
                  <div className="flex items-center gap-1 bg-surface-100 border border-surface-200 rounded-full p-1">
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
                  </div>
                  {/* Sıralama modu */}
                  <div className="flex items-center gap-1 bg-surface-100 border border-surface-200 rounded-full p-1">
                    {([false, true] as const).map((alpha) => (
                      <button
                        key={String(alpha)}
                        onClick={() => setSortAlpha(alpha)}
                        className={`text-[11px] font-semibold px-3 h-6 rounded-full transition-all cursor-pointer outline-none whitespace-nowrap ${
                          sortAlpha === alpha
                            ? "bg-white text-text-primary shadow-sm"
                            : "text-text-tertiary hover:text-text-primary"
                        }`}
                      >
                        {alpha ? "A–Z" : "Puan"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── TABLO ── */}
            <div className="mt-4">
              {viewMode === "students" ? (
                rankedStudents.length === 0 ? (
                  <div className="bg-white rounded-20 border border-surface-200 min-h-48 flex flex-col items-center justify-center gap-3 p-12" style={{ boxShadow: "0 4px 40px rgba(0,0,0,0.04)" }}>
                    <Users size={36} className="text-surface-200" />
                    <p className="text-[14px] font-semibold text-text-placeholder">Öğrenci bulunamadı</p>
                    <p className="text-[12px] text-text-disabled text-center max-w-60">Bu şubeye ait öğrenci kaydı bulunmamaktadır.</p>
                  </div>
                ) : (
                  <LeaderTable students={rankedStudents} groupsMap={groupsMap} />
                )
              ) : (
                rankedGroups.length === 0 ? (
                  <div className="bg-white rounded-20 border border-surface-200 min-h-48 flex flex-col items-center justify-center gap-3 p-12" style={{ boxShadow: "0 4px 40px rgba(0,0,0,0.04)" }}>
                    <Users size={36} className="text-surface-200" />
                    <p className="text-[14px] font-semibold text-text-placeholder">Grup bulunamadı</p>
                    <p className="text-[12px] text-text-disabled text-center max-w-60">Bu şubeye ait grup bilgisi bulunmamaktadır.</p>
                  </div>
                ) : (
                  <GroupTable groups={rankedGroups} groupsMap={groupsMap} />
                )
              )}
            </div>

          </div>
        )}
      </div>


      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .league-filter-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 9999px;
          border: 1.5px solid #D1D5DB;
          background: white;
          font-size: 13px;
          font-weight: 600;
          color: #1E3A5F;
          cursor: pointer;
          transition: border-color 0.15s, box-shadow 0.15s;
          outline: none;
          white-space: nowrap;
        }
        .league-filter-btn:hover {
          border-color: #FF8D28;
          box-shadow: 0 0 0 3px rgba(255,141,40,0.10);
        }
      `}</style>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LeaguePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-surface-100 border-t-[#FF8D28] rounded-full animate-spin" />
      </div>
    }>
      <LeagueContent />
    </Suspense>
  );
}
