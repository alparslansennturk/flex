"use client";
import React, { useEffect, useState } from "react";
import { Users, ClipboardList, UsersRound, Zap } from "lucide-react";
import { db } from "@/app/lib/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { calcScore, computeStudentStats } from "@/app/lib/scoring";
import { useScoring } from "@/app/context/ScoringContext";

function StatBox({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="bg-white/5 border border-white/5 p-5 rounded-20 flex flex-col items-center justify-center text-center h-full">
      <div className="w-10 h-10 bg-white/10 rounded-[8px] flex items-center justify-center text-white/70 mb-3">{icon}</div>
      <span className="text-[14px] text-white/50 mb-2 font-medium tracking-tight">
        {label}
      </span>
      <span className="text-[28px] font-bold text-white leading-none tracking-tighter">
        {value}
      </span>
    </div>
  );
}

export default function WorkshopAnalysis() {
  const { settings, activeSeasonId } = useScoring();

  const [studentCount, setStudentCount] = useState<number>(0);
  const [avgScore,     setAvgScore]     = useState<string>("–");
  const [taskCount,    setTaskCount]    = useState<number>(0);
  const [groupCount,   setGroupCount]   = useState<number>(0);

  // Aktif öğrenci sayısı + puan ortalaması (tek subscription)
  useEffect(() => {
    const q = query(collection(db, "students"), where("status", "==", "active"));
    return onSnapshot(q, snap => {
      setStudentCount(snap.size);

      if (snap.empty) { setAvgScore("0"); return; }

      let total = 0;
      let count = 0;
      snap.docs.forEach(d => {
        const data = d.data() as any;
        const { totalXP, completedTasks } = computeStudentStats(
          data.gradedTasks,
          data.isScoreHidden,
          activeSeasonId,
        );
        const score = calcScore(totalXP, completedTasks, settings);
        if (score > 0) { total += score; count++; }
      });

      setAvgScore(count > 0 ? (total / count).toFixed(1) : "0");
    });
  }, [settings, activeSeasonId]);

  // Tüm sistemdeki görev toplamı
  useEffect(() => {
    return onSnapshot(collection(db, "tasks"), snap => {
      setTaskCount(snap.size);
    });
  }, []);

  // Toplam grup sayısı
  useEffect(() => {
    return onSnapshot(collection(db, "groups"), snap => {
      setGroupCount(snap.size);
    });
  }, []);

  return (
    <div className="col-span-12 xl:col-span-8 bg-[#10294C] rounded-24 p-8 text-white relative overflow-hidden border border-white/5 shadow-lg min-h-[320px] flex flex-col justify-center">

      {/* Arkaplan Süsü */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF8D28]/10 blur-[100px] -mr-32 -mt-32 pointer-events-none"></div>

      <div className="relative z-10 flex flex-col items-start w-full">
        {/* Atölye Analizi Etiketi */}
        <span className="text-[11px] bg-white/5 px-4 py-1.5 rounded-full border border-white/10 text-[#FF8D28] font-bold tracking-widest">
          Atölye analizi
        </span>

        <h2 className="text-[clamp(24px,1.8vw,32px)] mt-3 font-semibold tracking-tight leading-tight max-w-[90%]">
          Atölyedeki son gelişmeler ve <span className="text-[#FF8D28]">istatistikler.</span>
        </h2>

        {/* İSTATİSTİK KARTLARI */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8 w-full">
          <StatBox label="Öğrenci"      value={studentCount} icon={<Users       size={20} />} />
          <StatBox label="Grup"         value={groupCount}   icon={<UsersRound  size={20} />} />
          <StatBox label="Toplam Görev" value={taskCount}    icon={<ClipboardList size={20} />} />
          <StatBox label="Ortalama"     value={avgScore}     icon={<Zap         size={20} />} />
        </div>
      </div>
    </div>
  );
}
