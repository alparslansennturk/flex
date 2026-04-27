"use client";

import { useEffect, useState } from "react";
import { db } from "@/app/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { Trophy } from "lucide-react";

interface StudentEntry {
  id: string;
  name: string;
  lastName: string;
  gender?: string;
  avatarId?: number;
  points: number;
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

export default function StudentLeagueWidget({ groupId, light = false }: { groupId: string; light?: boolean }) {
  const [students, setStudents] = useState<StudentEntry[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    if (!groupId) return;
    getDocs(query(
      collection(db, "students"),
      where("groupId", "==", groupId),
      where("status",  "==", "active"),
    ))
      .then(snap => {
        const list = snap.docs
          .map(d => ({
            id:       d.id,
            name:     d.data().name     ?? "",
            lastName: d.data().lastName ?? "",
            gender:   d.data().gender,
            avatarId: d.data().avatarId,
            points:   d.data().points   ?? 0,
            rank:     0,
          }))
          .sort((a, b) => b.points - a.points)
          .slice(0, 5)
          .map((s, i) => ({ ...s, rank: i + 1 }));
        setStudents(list);
      })
      .finally(() => setLoading(false));
  }, [groupId]);

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
                  {Math.round(s.points)}<span className="text-[10px] text-surface-400 ml-0.5">P</span>
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
                  {Math.round(s.points)}<span className="text-[10px] text-white/30 ml-0.5">P</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
