"use client";

import { useState, useEffect } from "react";
import { Trophy, ArrowBigUpDash, ArrowBigDownDash, Minus, ChevronRight } from "lucide-react";
import { db } from "@/app/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { useUser } from "@/app/context/UserContext";
import { useScoring } from "@/app/context/ScoringContext";
import { calcScore, computeStudentStats } from "@/app/lib/scoring";
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
  rankChange?: number;      // +N = yükseldi, -N = düştü, 0 = aynı
  // computed at runtime — not read directly from Firestore
  points?: number;
  completedTasks?: number;
  latePenaltyTotal?: number;
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
    <div className="flex items-center gap-3 px-2 py-2 -mx-2 rounded-xl hover:bg-surface-50 transition-colors cursor-pointer group">
      {/* Madalya + Sıra */}
      <div className="flex items-center shrink-0 w-11 gap-0.5">
        <span className="text-[16px] leading-none">{MEDALS[rank - 1]}</span>
        <span className={`text-[12px] font-bold ml-0.5 ${rank === 1 ? "text-[#FF8D28]" : "text-[#AEB4C0]"}`}>
          {rank}.
        </span>
      </div>

      {/* Avatar */}
      <div className="w-9 h-9 rounded-full border border-surface-200 p-0.5 overflow-hidden bg-surface-50 shrink-0">
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
      const all = snap.docs.map(d => {
        const data = { id: d.id, ...d.data() } as StudentRank;
        const { totalXP, completedTasks, latePenaltyTotal } = computeStudentStats(data.gradedTasks, data.isScoreHidden, activeSeasonId);
        const score = calcScore(totalXP, completedTasks, settings);
        return { ...data, points: score, completedTasks, latePenaltyTotal };
      });

      all.sort((a, b) => {
        const diff = (b.points ?? 0) - (a.points ?? 0);
        if (diff !== 0) return diff;
        return (a.latePenaltyTotal ?? 0) - (b.latePenaltyTotal ?? 0);
      });

      setStudents(all.slice(0, 3));
      setLoading(false);
    });
  }, [viewMode, myGroupCodes, user?.uid, user?.branch, settings, activeSeasonId]);

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
          <div className="h-full flex items-center justify-center min-h-32.5">
            <div className="w-5 h-5 border-2 border-surface-100 border-t-[#FF8D28] rounded-full animate-spin" />
          </div>
        ) : students.length === 0 ? (
          <div className="h-full flex items-center justify-center min-h-32.5">
            <p className="text-[13px] text-[#AEB4C0] font-medium text-center">
              Henüz puan kazanan öğrenci yok
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {students.map((s, i) => (
              <LeaderRow
                key={s.id}
                rank={i + 1}
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
