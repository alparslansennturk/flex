"use client";

import { useState, useEffect } from "react";
import { Trophy, ArrowBigUpDash, ArrowBigDownDash, Minus, ChevronRight } from "lucide-react";
import { db } from "@/app/lib/firebase";
import { collection, query, where, onSnapshot, getDocs } from "firebase/firestore";
import { useUser } from "@/app/context/UserContext";
import { useScoring } from "@/app/context/ScoringContext";
import { calcStudentFinalScore } from "@/app/lib/scoring";
import Link from "next/link";

interface StudentRank {
  id: string;
  name: string;
  lastName: string;
  gender?: string;
  groupCode: string;
  branch: string;
  gradedTasks?: Record<string, { xp: number; penalty: number }>;
  isScoreHidden?: boolean;
  avatarId?: number;
  rankChange?: number;
  points?: number;
  completedTasks?: number;
  latePenaltyTotal?: number;
  rank?: number;
}

const MEDALS    = ["🥇", "🥈", "🥉"];
const VIEW_MODES = ["Tümü", "Şubem", "Sınıflarım"] as const;

// ─── Trend ikonu ─────────────────────────────────────────────────────────────
function TrendIcon({ rankChange, rank }: { rankChange?: number; rank: number }) {
  const change = rankChange ?? 0;
  const orange = "#FF8D28";
  const muted  = "#AEB4C0";

  if (change > 0) return <ArrowBigUpDash size={15} color={orange} strokeWidth={2} />;
  if (change < 0) return <ArrowBigDownDash size={15} color={muted}  strokeWidth={2} />;
  return <Minus size={15} color={rank === 1 ? orange : muted} strokeWidth={2} />;
}

// ─── Tek satır ───────────────────────────────────────────────────────────────
function LeaderRow({ rank, name, sub, score, gender, avatarId, rankChange }: {
  rank: number;
  name: string;
  sub: string;
  score: number;
  gender?: string;
  avatarId?: number;
  rankChange?: number;
}) {
  const safeGender = gender === "female" ? "female" : "male";
  const safeAvatar = avatarId && avatarId > 0 ? avatarId : 1;
  const avatarUrl  = `/avatars/${safeGender}/${safeAvatar}.svg`;

  return (
    <div className="flex items-center gap-3 px-2 py-0.5 -mx-2 rounded-xl hover:bg-surface-50 transition-colors cursor-pointer group">
      {/* Madalya + Sıra */}
      <div className="flex items-center shrink-0 w-11 gap-0.5">
        <span className="text-[15px] leading-none w-5 inline-block">
          {MEDALS[rank - 1] ?? <span className="text-[12px] font-bold text-[#AEB4C0]">#</span>}
        </span>
        <span className={`text-[12px] font-bold ${rank === 1 ? "text-[#FF8D28]" : "text-[#AEB4C0]"}`}>{rank}.</span>
      </div>

      {/* Avatar */}
      <div className="w-8 h-8 rounded-full border border-surface-200 p-0.5 overflow-hidden bg-surface-50 shrink-0">
        <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
      </div>

      {/* İsim + alt bilgi */}
      <div className="flex-1 min-w-0">
        {/* Üst satır: İsim — [İkon ←20px→ Skor XP] */}
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-[13px] text-[#1E222B] font-bold truncate flex-1 min-w-0 leading-none">
            {name}
          </p>
          {/* İkon + sabit genişlik skor kutusu — sayı kaç basamak olursa olsun ikon aynı x'te */}
          <div className="flex items-center gap-5 shrink-0">
            <TrendIcon rankChange={rankChange} rank={rank} />
            <span className="w-13 text-right text-[14px] font-bold text-[#10294C] leading-none tabular-nums">
              {Math.round(score)}<span className="text-[11px] text-[#AEB4C0] font-semibold ml-0.5">P</span>
            </span>
          </div>
        </div>
        {/* Alt satır: Şube/Grup */}
        <p className={`text-[11px] font-semibold truncate leading-none ${rank === 1 ? "text-[#FF8D28]" : "text-[#8E95A3]"}`}>
          {sub}
        </p>
      </div>
    </div>
  );
}

// ─── Ana bileşen ──────────────────────────────────────────────────────────────
type ViewMode = 'Sınıflarım' | 'Şubem' | 'Tümü';

export default function LeaderboardWidget({ viewMode, setViewMode }: {
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
}) {
  const { user }                     = useUser();
  const { settings, activeSeasonId } = useScoring();

  const [students,     setStudents]     = useState<StudentRank[]>([]);
  const [myGroupCodes, setMyGroupCodes] = useState<string[] | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [tasksMap,     setTasksMap]     = useState<Record<string, { classId?: string; status?: string; endDate?: string }>>({});

  // Eğitmene ait aktif grup kodları (Sınıflarım modu)
  useEffect(() => {
    const uid = user?.uid;
    if (!uid) { setMyGroupCodes([]); return; }
    const q = query(
      collection(db, "groups"),
      where("instructorId", "==", uid),
      where("status", "==", "active")
    );
    return onSnapshot(q, snap => {
      setMyGroupCodes(snap.docs.map(d => (d.data() as any).code).filter(Boolean));
    });
  }, [user?.uid]);

  // Görev haritası — completionRate hesabı için (lig sayfasıyla tutarlı)
  useEffect(() => {
    getDocs(collection(db, "tasks")).then(snap => {
      const map: Record<string, { classId?: string; status?: string; endDate?: string }> = {};
      snap.docs.forEach(d => {
        const data = d.data() as any;
        map[d.id] = { classId: data.classId ?? undefined, status: data.status ?? undefined, endDate: data.endDate ?? undefined };
      });
      setTasksMap(map);
    }).catch(() => {});
  }, []);

  // Öğrencileri çek
  useEffect(() => {
    const uid = user?.uid;
    if (!uid || myGroupCodes === null) return;
    setLoading(true);

    let q;
    if (viewMode === "Sınıflarım") {
      if (myGroupCodes.length === 0) { setStudents([]); setLoading(false); return; }
      q = query(
        collection(db, "students"),
        where("groupCode", "in", myGroupCodes.slice(0, 30)),
        where("status", "==", "active")
      );
    } else if (viewMode === "Şubem") {
      q = query(
        collection(db, "students"),
        where("branch", "==", user?.branch ?? ""),
        where("status", "==", "active")
      );
    } else {
      q = query(collection(db, "students"), where("status", "==", "active"));
    }

    return onSnapshot(q, snap => {
      const now = new Date();
      const todayStr = now.toISOString().split("T")[0];
      const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      const effectiveMonthKey = (ca?: string, end?: string): string | null => {
        const d = end ?? ca ?? null;
        return d ? d.substring(0, 7) : null;
      };

      const assignedInMonth = (mStart: string, mEnd: string, classId: string): number | undefined =>
        Object.values(tasksMap).filter(t =>
          t.classId === classId &&
          (t.status === "active" || t.status === "published" || t.status === "completed" || !t.status) &&
          t.endDate && t.endDate >= mStart && t.endDate <= mEnd
        ).length || undefined;

      const all = snap.docs.map(d => {
        const data  = { id: d.id, ...d.data() } as StudentRank & { g2StartXP?: number };
        if (data.isScoreHidden) return { ...data, points: 0, completedTasks: 0, latePenaltyTotal: 0 };

        const allGT = (data as any).gradedTasks ?? {};

        // G2 (mevcut grup) entry'leri
        const classEntries = Object.entries(allGT).filter(([tid, e]: any) => {
          const cid = e?.classId;
          if (cid) return cid === data.groupCode;
          const mapCid = tasksMap[tid]?.classId;
          if (!mapCid) return true;
          return mapCid === data.groupCode;
        });

        // G1 (eski grup) entry'leri — g2Bonus hesabı için
        const g1Entries = Object.entries(allGT).filter(([tid, e]: any) => {
          const cid = e?.classId;
          if (cid) return cid !== data.groupCode;
          const mapCid = tasksMap[tid]?.classId;
          return mapCid ? mapCid !== data.groupCode : false;
        });

        // G1 ay-ay skor → g2Bonus (%10)
        const g1ByMonth: Record<string, any[]> = {};
        for (const [tid, e] of g1Entries) {
          const m = effectiveMonthKey((e as any).completedAt, (e as any).endDate ?? tasksMap[tid]?.endDate);
          if (!m) continue;
          if (!g1ByMonth[m]) g1ByMonth[m] = [];
          g1ByMonth[m].push([tid, e]);
        }
        const g1Codes = [...new Set(g1Entries.map(([tid, e]: any) => (e?.classId ?? tasksMap[tid]?.classId)).filter(Boolean))] as string[];

        let g1TotalScore = 0;
        for (const [month, entries] of Object.entries(g1ByMonth)) {
          const mXP      = entries.reduce((s: number, [, e]: any) => s + (e.xp ?? 0), 0);
          const mComp    = entries.length;
          const [y, mo]  = month.split("-");
          const mStart   = `${y}-${mo}-01`;
          const mLastDay = new Date(parseInt(y), parseInt(mo), 0).getDate();
          const mEnd     = `${y}-${mo}-${String(mLastDay).padStart(2, "0")}`;
          const mAssigned = g1Codes.reduce((s, cid) => s + (assignedInMonth(mStart, mEnd, cid) ?? 0), 0) || undefined;
          const { finalScore: mScore } = calcStudentFinalScore(mXP, mComp, settings, mAssigned, 0, 0);
          g1TotalScore += mScore;
        }
        const g2Bonus = Math.round(g1TotalScore * 0.10);

        // G2 ay-ay kümülatif skor
        const byMonth: Record<string, any[]> = {};
        for (const [tid, e] of classEntries) {
          const m = effectiveMonthKey((e as any).completedAt, (e as any).endDate ?? tasksMap[tid]?.endDate);
          if (!m) continue;
          if (!byMonth[m]) byMonth[m] = [];
          byMonth[m].push([tid, e]);
        }

        let cumulativeScore = g2Bonus;
        for (const [month, entries] of Object.entries(byMonth)) {
          const mXP      = entries.reduce((s: number, [, e]: any) => s + (e.xp ?? 0), 0);
          const mComp    = entries.length;
          const [y, mo]  = month.split("-");
          const mStart   = `${y}-${mo}-01`;
          const mLastDay = new Date(parseInt(y), parseInt(mo), 0).getDate();
          const mEndFull = `${y}-${mo}-${String(mLastDay).padStart(2, "0")}`;
          const mEnd     = month === currentMonthKey ? todayStr : mEndFull;
          const mAssigned = assignedInMonth(mStart, mEnd, data.groupCode);
          const { finalScore: mScore } = calcStudentFinalScore(mXP, mComp, settings, mAssigned, 0, 0);
          cumulativeScore += mScore;
        }

        const score          = isFinite(cumulativeScore) && !isNaN(cumulativeScore) ? cumulativeScore : 0;
        const totalCompleted = classEntries.length;
        const totalPenalty   = classEntries.reduce((s: number, [, e]: any) => s + (e.penalty ?? 0), 0);

        return { ...data, points: score, completedTasks: totalCompleted, latePenaltyTotal: totalPenalty };
      });

      all.sort((a, b) => {
        const sd = (b.points ?? 0) - (a.points ?? 0); if (sd !== 0) return sd;
        const pd = (a.latePenaltyTotal ?? 0) - (b.latePenaltyTotal ?? 0); if (pd !== 0) return pd;
        return `${a.name} ${a.lastName}`.localeCompare(`${b.name} ${b.lastName}`, "tr");
      });

      // Dense ranking: eşit puanlılar aynı sırayı paylaşır, sonraki sıra atlanmaz (1,1,2,3...)
      const ranked: (typeof all[0] & { rank: number })[] = [];
      for (let i = 0; i < all.length; i++) {
        if (i === 0) { ranked.push({ ...all[i], rank: 1 }); continue; }
        const prev = all[i - 1];
        const prevRank = ranked[i - 1].rank;
        const sameScore = (prev.points ?? 0) === (all[i].points ?? 0) && (prev.latePenaltyTotal ?? 0) === (all[i].latePenaltyTotal ?? 0);
        ranked.push({ ...all[i], rank: sameScore ? prevRank : prevRank + 1 });
      }

      setStudents(ranked.slice(0, 4));
      setLoading(false);
    });
  }, [viewMode, myGroupCodes, user?.uid, user?.branch, settings, activeSeasonId, tasksMap]);

  return (
    <div className="col-span-12 xl:col-span-4 bg-white rounded-24 p-6 border border-surface-200 flex flex-col justify-between shadow-sm">

      {/* Başlık + Filtre Sekmeleri */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[18px] font-bold text-[#10294C] flex items-center gap-2">
          <Trophy size={16} className="text-[#FF8D28]" /> Sınıflar ligi
        </h3>
        <div className="flex items-center gap-1 bg-surface-50 border border-surface-100 rounded-xl p-1">
          {VIEW_MODES.map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`text-[11px] font-bold px-2.5 h-6 rounded-lg transition-all cursor-pointer ${
                viewMode === mode
                  ? "bg-[#3A7BD5] text-white shadow-sm"
                  : "text-[#8E95A3] hover:text-[#3A7BD5]"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Liste */}
      <div className="flex-1">
        {loading ? (
          <div className="h-full flex items-center justify-center min-h-[168px]">
            <div className="w-5 h-5 border-2 border-surface-100 border-t-[#FF8D28] rounded-full animate-spin" />
          </div>
        ) : students.length === 0 ? (
          <div className="h-full flex items-center justify-center min-h-[168px]">
            <p className="text-[13px] text-[#AEB4C0] font-medium text-center">
              Henüz puan kazanan öğrenci yok
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {students.map((s) => (
              <LeaderRow
                key={s.id}
                rank={s.rank ?? 1}
                name={`${s.name} ${s.lastName}`}
                sub={viewMode === "Tümü" ? s.branch : s.groupCode}
                score={s.points ?? 0}
                gender={s.gender}
                avatarId={s.avatarId}
                rankChange={s.rankChange}
              />
            ))}
          </div>
        )}
      </div>

      {/* Tüm Sonuçları Gör */}
      <Link href="/dashboard/league">
        <button className="mt-6 w-full h-12 flex items-center justify-center gap-2 rounded-xl bg-[#6F74D8] text-white font-bold text-[13px] hover:bg-designstudio-secondary-600 transition-all shadow-sm cursor-pointer">
          Tüm sonuçları gör <ChevronRight size={16} />
        </button>
      </Link>
    </div>
  );
}
