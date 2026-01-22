"use client";
import React from "react";
import { Users, BookOpen, Clock, Zap } from "lucide-react";

function StatBox({ label, value, icon }: any) {
  return (
    <div className="bg-white/5 border border-white/5 p-5 rounded-[24px] flex flex-col items-center justify-center text-center h-full">
      <div className="w-10 h-10 bg-white/10 rounded-[8px] flex items-center justify-center text-white/70 mb-3">{icon}</div>
      {/* Etiket 14px yapıldı ve uppercase kaldırıldı */}
      <span className="text-[14px] text-white/50 mb-1 font-medium tracking-tight">
        {label}
      </span>
      <span className="text-[28px] font-extrabold text-white leading-none tracking-tighter">
        {value}
      </span>
    </div>
  );
}

export default function WorkshopAnalysis() {
  return (
    <div className="col-span-12 xl:col-span-8 bg-[#10294C] rounded-[32px] p-8 text-white relative overflow-hidden border border-white/5 shadow-lg min-h-[320px] flex flex-col justify-center">
      
      {/* Arkaplan Süsü */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF8D28]/10 blur-[100px] -mr-32 -mt-32 pointer-events-none"></div>

      <div className="relative z-10 flex flex-col items-start w-full">
        {/* Atölye Analizi Etiketi */}
        <span className="text-[11px] bg-white/5 px-4 py-1.5 rounded-full border border-white/10 text-[#FF8D28] font-bold tracking-widest">
          Atölye analizi
        </span>

        {/* BAŞLIK: SemiBold ve Küçük Harf Ağırlıklı */}
        <h2 className="text-[clamp(24px,1.8vw,32px)] mt-3 font-semibold tracking-tight leading-tight max-w-[90%]">
          Atölyedeki son gelişmeler ve <span className="text-[#FF8D28]">istatistikler.</span>
        </h2>

        {/* İSTATİSTİK KARTLARI */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8 w-full">
          <StatBox label="Öğrenci" value="33" icon={<Users size={20} />} />
          <StatBox label="Biten ödev" value="12" icon={<BookOpen size={20} />} />
          <StatBox label="Bekleyen" value="14" icon={<Clock size={20} />} />
          <StatBox label="Ortalama" value="6.2" icon={<Zap size={20} />} />
        </div>
      </div>
    </div>
  );
}