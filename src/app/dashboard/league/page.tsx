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
import { ROLES } from "@/app/lib/constants";
import { computeStudentStats, calcScore, calcFinalScore, safe } from "@/app/lib/scoring";
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
const BASE_TABS  = ["Tüm Öğrenciler", "Sınıflarım"] as const;
const ALL_BRANCH = "Tüm Şubeler";
const ALL_GROUP  = "Tüm Gruplar";

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

function AnalyticsGrid({
  analytics,
}: {
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
    <div
      className="rounded-20 overflow-hidden grid grid-cols-2"
      style={{ boxShadow: "0 4px 36px rgba(0,0,0,0.05)" }}
    >
      {ANALYTICS_CELLS.map(({ key, label, icon: Icon, bg, iconBg, iconColor, nameColor, subColor }, i) => {
        const student = analytics[key];
        const sub = getSub(key, student);
        const borderR = i % 2 === 0 ? "border-r-2 border-white/70" : "";
        const borderB = i < 2     ? "border-b-2 border-white/70" : "";
        return (
          <div
            key={key}
            className={`${borderR} ${borderB} p-5 flex flex-col gap-3 relative overflow-hidden`}
            style={{ background: bg }}
          >
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
                <p className="text-[22px] font-black tabular-nums leading-none relative z-10" style={{ color: iconColor }}>
                  {sub}
                </p>
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

function GroupTable({ groups }: { groups: RankedGroup[] }) {
  return (
    <div className="bg-white rounded-20 border border-surface-200 overflow-hidden" style={{ boxShadow: "0 4px 40px rgba(0,0,0,0.04)" }}>
      <table className="w-full">
        <thead>
          <tr className="border-b border-surface-100">
            <th className="text-left text-[14px] font-bold text-text-secondary px-8 py-4 w-20">#</th>
            <th className="text-left text-[14px] font-bold text-text-secondary px-6 py-4">Grup</th>
            <th className="text-right text-[14px] font-bold text-text-secondary px-6 py-4">
              <span title="Grup puanı, öğrenci ortalamasına göre hesaplanır" className="cursor-help border-b border-dashed border-text-secondary">
                Puan
              </span>
            </th>
            <th className="text-right text-[14px] font-bold text-text-secondary px-6 py-4 hidden md:table-cell">Öğrenci</th>
            <th className="text-right text-[14px] font-bold text-text-secondary px-6 py-4 hidden xl:table-cell">Aktif</th>
            <th className="text-right text-[14px] font-bold text-text-secondary px-6 py-4 hidden xl:table-cell">Toplam Puan</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const isTop3 = group.rank <= 3;
            return (
              <tr
                key={group.code}
                className={`border-b border-surface-50 last:border-0 ${isTop3 ? "bg-surface-50/50" : ""}`}
              >
                <td className="px-8 py-3">
                  <div className="flex items-center gap-1.5">
                    {isTop3 && <span className="text-[14px] leading-none">{MEDALS[group.rank - 1]}</span>}
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
                    <div>
                      <p className="text-[14px] font-bold text-text-primary leading-none">{group.code}</p>
                      <p className="text-[12px] text-text-tertiary leading-snug mt-0.5">{group.branch}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-3 text-right">
                  <div
                    className="flex flex-col items-end gap-0.5"
                    title="Grup puanı, öğrenci ortalamasına göre hesaplanır"
                  >
                    <span className={`text-[15px] font-bold tabular-nums ${isTop3 && group.rank === 1 ? "text-[#FF8D28]" : "text-text-primary"}`}>
                      {Math.round(group.rawScore).toLocaleString("tr-TR")}
                    </span>
                    <span className="text-[11px] font-medium text-text-disabled tabular-nums">
                      {group.totalXP.toLocaleString("tr-TR")} XP
                    </span>
                  </div>
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
                <td className="px-6 py-3 text-right hidden xl:table-cell">
                  <span className="text-[13px] font-semibold text-text-tertiary tabular-nums">
                    {group.displayScore.toLocaleString("tr-TR")}
                  </span>
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
}: {
  students: RankedStudent[];
  onStudentClick: (s: RankedStudent) => void;
}) {
  return (
    <div className="bg-white rounded-20 border border-surface-200 overflow-hidden" style={{ boxShadow: "0 4px 40px rgba(0,0,0,0.04)" }}>
      <table className="w-full">
        <thead>
          <tr className="border-b border-surface-100">
            <th className="text-left text-[14px] font-bold text-text-secondary px-8 py-4 w-20">#</th>
            <th className="text-left text-[14px] font-bold text-text-secondary px-6 py-4">Öğrenci</th>
            <th className="text-right text-[14px] font-bold text-text-secondary px-6 py-4">Puan</th>
            <th className="text-right text-[14px] font-bold text-text-secondary px-6 py-4 hidden md:table-cell">XP</th>
            <th className="text-right text-[14px] font-bold text-text-secondary px-6 py-4 hidden xl:table-cell">Görev</th>
            <th className="text-right text-[14px] font-bold text-text-secondary px-6 py-4 hidden xl:table-cell">Ceza</th>
            <th className="text-center text-[14px] font-bold text-text-secondary px-6 py-4">Trend</th>
            <th className="px-8 py-4 w-20" />
          </tr>
        </thead>
        <tbody>
          {students.map((student) => {
            const isTop3 = student.rank <= 3;
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
                    {isTop3 && <span className="text-[14px] leading-none">{MEDALS[student.rank - 1]}</span>}
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
                        {student.branch} · {student.groupCode}
                      </p>
                    </div>
                  </div>
                </td>

                <td className="px-6 py-3 text-right">
                  <span className={`text-[15px] font-bold tabular-nums ${isTop3 && student.rank === 1 ? "text-[#FF8D28]" : "text-text-primary"}`}>
                    {Math.round(student.score)}
                  </span>
                </td>

                <td className="px-6 py-3 text-right hidden md:table-cell">
                  <span className="text-[13px] font-semibold text-text-tertiary tabular-nums">
                    {student.points ?? 0} XP
                  </span>
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

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="bg-white rounded-20 border border-surface-200 min-h-80 flex flex-col items-center justify-center gap-3 p-12" style={{ boxShadow: "0 4px 40px rgba(0,0,0,0.04)" }}>
      <Trophy size={40} className="text-surface-200" />
      <p className="text-[14px] font-semibold text-text-placeholder">Öğrenci bulunamadı</p>
      <p className="text-[12px] text-text-disabled text-center max-w-60">
        Bu filtre için henüz aktif öğrenci yok.
      </p>
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
  const [baseFilter,      setBaseFilter]      = useState<"Tüm Öğrenciler" | "Sınıflarım">("Tüm Öğrenciler");
  const [branchFilter,    setBranchFilter]    = useState(ALL_BRANCH);
  const [groupFilter,     setGroupFilter]     = useState(ALL_GROUP);
  const [scoreMode,       setScoreMode]       = useState<ScoreMode>("total");
  const [viewMode,        setViewMode]        = useState<ViewMode>("students");
  const [rawStudents,     setRawStudents]     = useState<StudentData[]>([]);
  const [tasksMap,        setTasksMap]        = useState<Record<string, { endDate?: string; createdAt?: any }>>({});
  const [myGroupCodes,    setMyGroupCodes]    = useState<string[] | null>(null);
  const [loading,         setLoading]         = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<ModalStudent | null>(null);
  const [modalOpen,       setModalOpen]       = useState(false);

  const { user }                     = useUser();
  const { settings, activeSeasonId } = useScoring();
  const isAdmin = user?.roles?.includes(ROLES.ADMIN) ?? false;

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

  // ── Görevleri çek ─────────────────────────────────────────────────────────
  useEffect(() => {
    getDocs(collection(db, "tasks")).then((snap) => {
      const map: Record<string, { endDate?: string; createdAt?: any }> = {};
      snap.docs.forEach((d) => {
        const data = d.data() as any;
        map[d.id] = { endDate: data.endDate ?? undefined, createdAt: data.createdAt ?? undefined };
      });
      setTasksMap(map);
    }).catch(() => {});
  }, []);

  // ── Şube değişince grup filtresini sıfırla ──────────────────────────────────
  useEffect(() => { setGroupFilter(ALL_GROUP); }, [branchFilter]);

  // ── Öğrencileri çek ────────────────────────────────────────────────────────
  useEffect(() => {
    const uid = user?.uid;
    if (!uid || myGroupCodes === null) return;
    setLoading(true);

    let q;
    if (baseFilter === "Sınıflarım") {
      if (myGroupCodes.length === 0) { setRawStudents([]); setLoading(false); return; }
      q = query(
        collection(db, "students"),
        where("groupCode", "in", myGroupCodes.slice(0, 30)),
        where("status", "==", "active"),
      );
    } else {
      q = query(collection(db, "students"), where("status", "==", "active"));
    }

    return onSnapshot(q, (snap) => {
      setRawStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() } as StudentData)));
      setLoading(false);
    });
  }, [baseFilter, myGroupCodes, user?.uid]);

  // ── Şube ve grup seçenekleri ───────────────────────────────────────────────
  const branchOptions = useMemo(() => {
    const set = new Set(rawStudents.map((s) => s.branch).filter(Boolean));
    return [ALL_BRANCH, ...Array.from(set).sort()];
  }, [rawStudents]);

  const groupOptions = useMemo(() => {
    const allowedCodes = isAdmin ? null : (myGroupCodes ?? []);
    const pool = rawStudents.filter((s) => {
      if (branchFilter !== ALL_BRANCH && s.branch !== branchFilter) return false;
      if (allowedCodes !== null && !allowedCodes.includes(s.groupCode)) return false;
      return true;
    });
    const set = new Set(pool.map((s) => s.groupCode).filter(Boolean));
    return [ALL_GROUP, ...Array.from(set).sort()];
  }, [rawStudents, branchFilter, isAdmin, myGroupCodes]);

  // ── Runtime sıralama ───────────────────────────────────────────────────────
  const rankedStudents = useMemo<RankedStudent[]>(() => {
    // Son 30 günün task ID'lerini Set olarak derle — O(|tasksMap|) tek seferlik,
    // öğrenci döngüsü içinde tekrarlanan tarih karşılaştırmalarını önler.
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

    const withScores = rawStudents.map((s) => {
      const tasks = s.gradedTasks ?? {};

      // Tüm zamanlardaki istatistikler
      const { totalXP, completedTasks, latePenaltyTotal } = computeStudentStats(
        tasks, s.isScoreHidden, activeSeasonId
      );

      // Son 30 günün istatistikleri — Set ile O(1) lookup, unique taskId garantili
      const recentEntries = s.isScoreHidden
        ? []
        : Object.entries(tasks).filter(([taskId]) => recentTaskIds.has(taskId));
      const recentXP        = recentEntries.reduce((sum, [, e]) => sum + (e.xp ?? 0), 0);
      const recentCompleted = recentEntries.length;

      const generalScore = calcScore(totalXP, completedTasks, settings);
      const recentScore  = calcScore(recentXP, recentCompleted, settings);
      const finalScore   = calcFinalScore(generalScore, recentScore);
      const displayScore = scoreMode === "monthly" ? recentScore : finalScore;

      return {
        ...s,
        points:           totalXP,
        completedTasks,
        latePenaltyTotal,
        generalScore,
        recentScore,
        finalScore,
        score: displayScore,
      };
    });

    const filtered = withScores.filter((s) => {
      if (branchFilter !== ALL_BRANCH && s.branch !== branchFilter) return false;
      if (groupFilter !== ALL_GROUP && s.groupCode !== groupFilter) return false;
      return true;
    });

    filtered.sort((a, b) => {
      const sd = b.score - a.score;
      if (sd !== 0) return sd;
      const pd = (a.latePenaltyTotal ?? 0) - (b.latePenaltyTotal ?? 0);
      if (pd !== 0) return pd;
      return (b.points ?? 0) - (a.points ?? 0);
    });

    return filtered.map((s, i) => ({ ...s, rank: i + 1 }));
  }, [rawStudents, settings, activeSeasonId, branchFilter, groupFilter, scoreMode, tasksMap]);

  // ── Grup sıralaması ───────────────────────────────────────────────────────
  const rankedGroups = useMemo<RankedGroup[]>(() => {
    const byGroup: Record<string, RankedStudent[]> = {};
    for (const s of rankedStudents) {
      if (!s.groupCode) continue;
      if (!byGroup[s.groupCode]) byGroup[s.groupCode] = [];
      byGroup[s.groupCode].push(s);
    }

    return Object.entries(byGroup)
      .map(([code, students]) => {
        const activeCount = students.filter((s) => (s.completedTasks ?? 0) >= 1).length;
        const studentCount = students.length;
        // rawScore: ortalama öğrenci puanı — sıralama adaleti için
        const rawScore = safe(
          students.reduce((acc, s) => acc + s.score, 0) / Math.max(studentCount, 1)
        );
        // displayScore: rawScore × öğrenci sayısı — UI'da güçlü görünür
        const displayScore = Math.round(rawScore * studentCount);
        const totalXP = students.reduce((acc, s) => acc + (s.points ?? 0), 0);
        return {
          code,
          students,
          activeCount,
          studentCount,
          rawScore,
          displayScore,
          totalXP,
          branch: students[0]?.branch ?? "",
        };
      })
      .sort((a, b) => b.rawScore - a.rawScore)
      .map((g, i) => ({ ...g, rank: i + 1 }));
  }, [rankedStudents]);

  const podium = rankedStudents.slice(0, 3);

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
    const topXP = rankedStudents.reduce((a, b) => (a.points ?? 0) >= (b.points ?? 0) ? a : b);
    const rising = rankedStudents.filter((s) => (s.rankChange ?? 0) > 0)
      .sort((a, b) => (b.rankChange ?? 0) - (a.rankChange ?? 0));
    const fastestRising = rising[0] ?? null;
    const mostTasks = rankedStudents.reduce((a, b) =>
      (a.completedTasks ?? 0) >= (b.completedTasks ?? 0) ? a : b
    );
    const leastPenalty = [...rankedStudents].sort(
      (a, b) => (a.latePenaltyTotal ?? 0) - (b.latePenaltyTotal ?? 0)
    )[0];
    return { topXP, fastestRising, mostTasks, leastPenalty };
  }, [rankedStudents]);

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
            ) : rankedStudents.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="space-y-4">

                {/* ── TABLO BAŞLIK SATIRI ── */}
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-3">
                    <h2 className="text-[24px] font-semibold text-text-primary leading-none">Lig Tablosu</h2>
                    <span className="text-[13px] font-medium text-text-tertiary">
                      {viewMode === "groups"
                        ? `${rankedGroups.length} grup`
                        : `${rankedStudents.length} öğrenci`}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {/* Tüm Öğrenciler / Sınıflarım */}
                    <div className="flex items-center gap-0.5 bg-surface-100 rounded-10 p-0.5">
                      {BASE_TABS.map((f) => (
                        <button
                          key={f}
                          onClick={() => setBaseFilter(f)}
                          className={`text-[12px] font-semibold px-3 h-7 rounded-8 transition-all cursor-pointer whitespace-nowrap ${
                            baseFilter === f
                              ? "bg-white text-text-primary shadow-sm"
                              : "text-text-tertiary hover:text-text-primary"
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>

                    <div className="w-px h-5 bg-surface-200 shrink-0" />

                    <select
                      value={branchFilter}
                      onChange={(e) => setBranchFilter(e.target.value)}
                      className="h-8 px-3 rounded-10 bg-white border border-surface-200 text-text-primary text-[12px] font-medium outline-none cursor-pointer"
                    >
                      {branchOptions.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>

                    <select
                      value={groupFilter}
                      onChange={(e) => setGroupFilter(e.target.value)}
                      className="h-8 px-3 rounded-10 bg-white border border-surface-200 text-text-primary text-[12px] font-medium outline-none cursor-pointer"
                    >
                      {groupOptions.map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>

                    <div className="w-px h-5 bg-surface-200 shrink-0" />

                    {/* Toplam / Aylık */}
                    <div className="flex items-center gap-0.5 bg-surface-100 rounded-10 p-0.5">
                      {(["total", "monthly"] as ScoreMode[]).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setScoreMode(mode)}
                          className={`text-[12px] font-semibold px-3 h-7 rounded-8 transition-all cursor-pointer ${
                            scoreMode === mode
                              ? "bg-white text-text-primary shadow-sm"
                              : "text-text-tertiary hover:text-text-primary"
                          }`}
                        >
                          {mode === "total" ? "Toplam" : "Aylık"}
                        </button>
                      ))}
                    </div>

                    <div className="w-px h-5 bg-surface-200 shrink-0" />

                    {/* Öğrenciler / Gruplar */}
                    <div className="flex items-center gap-0.5 bg-surface-100 rounded-10 p-0.5">
                      {(["students", "groups"] as ViewMode[]).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setViewMode(mode)}
                          className={`text-[12px] font-semibold px-3 h-7 rounded-8 transition-all cursor-pointer ${
                            viewMode === mode
                              ? "bg-white text-text-primary shadow-sm"
                              : "text-text-tertiary hover:text-text-primary"
                          }`}
                        >
                          {mode === "students" ? "Öğrenciler" : "Gruplar"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── GÖRÜNÜM ── */}
                {viewMode === "students" ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      {podium.length > 0 && (
                        <PodiumSection students={podium} onStudentClick={handleStudentClick} />
                      )}
                      {analytics && <AnalyticsGrid analytics={analytics} />}
                    </div>
                    <LeaderTable students={rankedStudents} onStudentClick={handleStudentClick} />
                  </>
                ) : (
                  <>
                    {rankedGroups.length >= 2 && (
                      <GroupPodium groups={rankedGroups.slice(0, 3)} />
                    )}
                    <GroupTable groups={rankedGroups} />
                  </>
                )}

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
