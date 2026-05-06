"use client";

import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { calcStudentFinalScore, DEFAULT_SCORING, type ScoringSettings } from "@/app/lib/scoring";

interface StudentEntry {
  id: string;
  name: string;
  lastName: string;
  gender?: string;
  avatarId?: number;
  score: number;
  rank: number;
}

const MEDALS = ["🥇", "🥈", "🥉"];

function Avatar({ gender, avatarId }: { gender?: string; avatarId?: number }) {
  const g  = gender === "female" ? "female" : "male";
  const id = Number(avatarId) || 1;
  return (
    <img
      src={`/avatars/${g}/${id}.svg`}
      alt=""
      className="w-7 h-7 rounded-full object-cover bg-white/10 border border-white/10 shrink-0"
      onError={e => { (e.target as HTMLImageElement).src = `/avatars/${g}/1.svg`; }}
    />
  );
}

// Aylık skor hesaplama — league/page.tsx ile aynı mantık
function calcGroupScores(
  students: any[],
  tasksMap: Record<string, { endDate?: string; classId?: string; status?: string }>,
  settings: ScoringSettings,
  groupCode: string,
): StudentEntry[] {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthStart = `${currentMonthKey}-01`;

  const effectiveMonthKey = (ca?: string, end?: string): string | null => {
    const d = end ?? ca ?? null;
    return d ? d.substring(0, 7) : null;
  };

  const assignedInMonth = (mStart: string, mEnd: string, classId: string) =>
    Object.values(tasksMap).filter(t =>
      t.classId === classId &&
      (t.status === "active" || t.status === "published" || t.status === "completed" || !t.status) &&
      t.endDate && t.endDate >= mStart && t.endDate <= mEnd
    ).length || undefined;

  return students
    .filter(s => s.groupCode === groupCode)
    .map(s => {
      // Sadece mevcut gruba (groupCode) ait görevler — G1 carry-over karışmasın
      const classEntries = Object.entries(s.gradedTasks ?? {}).filter(([tid, entry]: any) => {
        const storedClassId = entry.classId;
        if (storedClassId) return storedClassId === s.groupCode;
        const mapClassId = tasksMap[tid]?.classId;
        if (!mapClassId) return true;
        return mapClassId === s.groupCode;
      });

      const byMonth: Record<string, any[]> = {};
      for (const [tid, entry] of classEntries) {
        const m = effectiveMonthKey((entry as any).completedAt, (entry as any).endDate ?? tasksMap[tid]?.endDate);
        if (!m) continue;
        if (!byMonth[m]) byMonth[m] = [];
        byMonth[m].push([tid, entry]);
      }

      const monthlyEntries   = byMonth[currentMonthKey] ?? [];
      const monthlyXP        = monthlyEntries.reduce((sum: number, [, e]: any) => sum + (e.xp ?? 0), 0);
      const monthlyCompleted = monthlyEntries.length;
      // Sadece mevcut grup için atanan görev sayısı
      const monthlyAssigned  = assignedInMonth(monthStart, todayStr, s.groupCode);

      const { finalScore } = calcStudentFinalScore(monthlyXP, monthlyCompleted, settings, monthlyAssigned, 0, 0);

      return {
        id:       s.id,
        name:     s.name ?? "",
        lastName: s.lastName ?? "",
        gender:   s.gender,
        avatarId: s.avatarId,
        score:    finalScore,
        rank:     0,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((s, i) => ({ ...s, rank: i + 1 }));
}

export default function StudentLeagueWidget({
  groupId,
  groupCode,
  light = false,
}: {
  groupId?: string;
  groupCode?: string;
  light?: boolean;
}) {
  const [students, setStudents] = useState<StudentEntry[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    console.log("[LeagueWidget] groupCode:", groupCode);
    if (!groupCode) { setLoading(false); return; }
    setLoading(true);
    fetch("/api/league")
      .then(res => res.ok ? res.json() : Promise.reject())
      .then((data: { students: any[]; tasks: any[]; scoringSettings?: ScoringSettings }) => {
        const settings = data.scoringSettings ?? DEFAULT_SCORING;
        const tasksMap: Record<string, { endDate?: string; classId?: string; status?: string }> = {};
        data.tasks.forEach((t: any) => {
          tasksMap[t.id] = { endDate: t.endDate ?? undefined, classId: t.classId ?? undefined, status: t.status ?? undefined };
        });
        setStudents(calcGroupScores(data.students, tasksMap, settings, groupCode));
      })
      .catch(() => setStudents([]))
      .finally(() => setLoading(false));
  }, [groupCode]);

  if (light) {
    return (
      <div className="px-3 py-2">
        {loading ? (
          <div className="flex items-center justify-center py-5">
            <div className="w-4 h-4 border-2 border-surface-100 border-t-base-primary-500 rounded-full animate-spin" />
          </div>
        ) : students.length === 0 ? (
          <p className="text-center text-[12px] text-surface-400 py-5">Henüz puan yok</p>
        ) : (
          <div className="space-y-0.5">
            {students.map(s => (
              <div key={s.id} className="flex items-center gap-2.5 px-2 py-2.5 rounded-xl hover:bg-surface-50 transition-colors">
                <span className="w-7 text-center text-[13px] leading-none shrink-0">
                  {MEDALS[s.rank - 1] ?? (
                    <span className="text-[11px] font-bold text-surface-400">#{s.rank}</span>
                  )}
                </span>
                <Avatar gender={s.gender} avatarId={s.avatarId} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-text-primary truncate leading-none">
                    {s.name} {s.lastName}
                  </p>
                </div>
                <span className="text-[12px] font-bold text-text-secondary shrink-0 tabular-nums">
                  {Math.round(s.score)}<span className="text-[10px] text-surface-400 ml-0.5">P</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-4 mb-4 rounded-2xl bg-white/5 border border-white/8 overflow-hidden">

      {/* Başlık */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-white/8">
        <Trophy size={14} className="text-designstudio-primary-500 shrink-0" />
        <span className="text-[13px] font-bold text-white">Sınıf Ligi</span>
      </div>

      {/* Liste */}
      <div className="px-3 py-2">
        {loading ? (
          <div className="flex items-center justify-center py-5">
            <div className="w-4 h-4 border-2 border-white/10 border-t-designstudio-primary-500 rounded-full animate-spin" />
          </div>
        ) : students.length === 0 ? (
          <p className="text-center text-[11px] text-white/30 py-5">Henüz puan yok</p>
        ) : (
          <div className="space-y-0.5">
            {students.map(s => (
              <div key={s.id} className="flex items-center gap-2.5 px-1 py-2 rounded-xl hover:bg-white/5 transition-colors">
                <span className="w-7 text-center text-[13px] leading-none shrink-0">
                  {MEDALS[s.rank - 1] ?? (
                    <span className="text-[11px] font-bold text-white/30">#{s.rank}</span>
                  )}
                </span>
                <Avatar gender={s.gender} avatarId={s.avatarId} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-white/90 truncate leading-none">
                    {s.name} {s.lastName}
                  </p>
                </div>
                <span className="text-[12px] font-bold text-white/70 shrink-0 tabular-nums">
                  {Math.round(s.score)}<span className="text-[10px] text-white/30 ml-0.5">P</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
