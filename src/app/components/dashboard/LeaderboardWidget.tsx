"use client";

import { useState, useEffect } from "react";
import { Trophy, Repeat, ChevronRight } from "lucide-react";
import { db } from "@/app/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { useUser } from "@/app/context/UserContext";

interface StudentRank {
  id: string;
  name: string;
  lastName: string;
  gender?: string;
  groupCode: string;
  branch: string;
  points: number;
}

function LeaderRow({ rank, name, sub, xp, gender }: {
  rank: number;
  name: string;
  sub: string;
  xp: number;
  gender?: string;
}) {
  const avatarUrl = `https://api.dicebear.com/7.x/${gender === "female" ? "lorelei" : "avataaars"}/svg?seed=${encodeURIComponent(name)}`;

  return (
    <div className="flex items-center justify-between p-2 -mx-2 rounded-xl hover:bg-[#F7F8FA] transition-colors cursor-pointer group">
      <div className="flex items-center flex-1 min-w-0 mr-2">
        <span className={`text-[15px] font-bold w-8 shrink-0 ${rank === 1 ? "text-[#FF8D28]" : "text-[#AEB4C0]"}`}>
          {rank}
        </span>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-full border border-[#E2E5EA] p-0.5 overflow-hidden bg-[#F7F8FA] shrink-0">
            <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col min-w-0">
            <p className="text-[clamp(14px,1vw,16px)] text-[#1E222B] font-bold whitespace-nowrap overflow-hidden leading-none mb-1">
              {name}
            </p>
            <p className={`text-[11px] font-semibold truncate ${rank === 1 ? "text-[#FF8D28]" : "text-[#8E95A3]"}`}>
              {sub}
            </p>
          </div>
        </div>
      </div>
      <span className="text-[14px] font-bold text-[#10294C] whitespace-nowrap shrink-0">
        {xp.toLocaleString("tr-TR")}
        <span className="text-[11px] text-[#8E95A3] font-bold uppercase ml-0.5">XP</span>
      </span>
    </div>
  );
}

export default function LeaderboardWidget({ viewMode, setViewMode }: any) {
  const { user } = useUser();
  const [students,      setStudents]      = useState<StudentRank[]>([]);
  const [myGroupCodes,  setMyGroupCodes]  = useState<string[] | null>(null); // null = henüz yüklenmedi
  const [loading,       setLoading]       = useState(true);

  // Eğitmene ait aktif grup kodlarını çek (Sınıflarım modu için)
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

  // Öğrencileri çek — viewMode ve grup listesine göre
  useEffect(() => {
    const uid = user?.uid;
    if (!uid || myGroupCodes === null) return; // Gruplar henüz yüklenmedi

    setLoading(true);

    let q;

    if (viewMode === "Sınıflarım") {
      if (myGroupCodes.length === 0) {
        setStudents([]);
        setLoading(false);
        return;
      }
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
      // Tümü
      q = query(collection(db, "students"), where("status", "==", "active"));
    }

    return onSnapshot(q, snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as StudentRank));
      all.sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
      setStudents(all.slice(0, 5));
      setLoading(false);
    });
  }, [viewMode, myGroupCodes, user?.uid, user?.branch]);

  const cycleView = () =>
    setViewMode((v: string) =>
      v === "Sınıflarım" ? "Şubem" : v === "Şubem" ? "Tümü" : "Sınıflarım"
    );

  return (
    <div className="col-span-12 xl:col-span-4 bg-white rounded-24 p-6 border border-[#E2E5EA] flex flex-col justify-between shadow-sm">

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[18px] font-bold text-[#10294C] flex items-center gap-2">
          <Trophy size={16} className="text-[#FF8D28]" /> Sınıflar ligi
        </h3>
        <button
          onClick={cycleView}
          className="flex items-center justify-center gap-2 text-[#3A7BD5] bg-surface-50 px-3 h-8 rounded-xl border border-surface-100 cursor-pointer active:scale-95 transition-all"
        >
          <span className="text-[clamp(12px,0.8vw,14px)] font-bold whitespace-nowrap">{viewMode}</span>
          <Repeat size={12} />
        </button>
      </div>

      <div className="flex-1">
        {loading ? (
          <div className="h-full flex items-center justify-center min-h-35">
            <div className="w-5 h-5 border-2 border-surface-100 border-t-[#FF8D28] rounded-full animate-spin" />
          </div>
        ) : students.length === 0 ? (
          <div className="h-full flex items-center justify-center min-h-35">
            <p className="text-[13px] text-[#AEB4C0] font-medium text-center">
              Henüz puan kazanan öğrenci yok
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {students.map((s, i) => (
              <LeaderRow
                key={s.id}
                rank={i + 1}
                name={`${s.name} ${s.lastName}`}
                sub={viewMode === "Tümü" ? s.branch : s.groupCode}
                xp={s.points ?? 0}
                gender={s.gender}
              />
            ))}
          </div>
        )}
      </div>

      <button className="mt-6 w-full h-[48px] flex items-center justify-center gap-2 rounded-xl bg-[#6F74D8] text-white font-bold text-[13px] hover:bg-[#5E63C2] transition-all shadow-sm cursor-pointer">
        Tüm sonuçları gör <ChevronRight size={16} />
      </button>
    </div>
  );
}
