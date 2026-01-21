"use client";
import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronRight, Bell } from "lucide-react";

export default function Header() {
  const [selectedBranch, setSelectedBranch] = useState("Kadıköy Şb.");
  const [isBranchOpen, setIsBranchOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const branches = ["Kadıköy Şb.", "Şirinevler Şb.", "Pendik Şb."];
  const otherBranches = branches.filter(b => b !== selectedBranch);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsBranchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cinsiyete göre stil ve kesin çalışan URL yapısı
  const getAvatar = (seed: string, gender: 'male' | 'female') => {
    const style = gender === 'male' ? 'avataaars' : 'lorelei';
    return `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}&scale=110`;
  };

  // Header "Alparslan" (Erkek - Mason seed'i)
  const myAvatarUrl = getAvatar('Mason', 'male');

  return (
    <header className="h-20 bg-white border-b border-surface-200 px-6 md:px-10 flex items-center justify-between sticky top-0 z-40 w-full font-inter">
      {/* SOL TARAF */}
      <div className="truncate pr-4">
        <h1 className="text-[clamp(20px,1.4vw,24px)] text-[#10294C] truncate font-bold leading-tight">
          Hoş geldin, Alparslan
        </h1>
        <p className="text-[clamp(13px,0.9vw,15px)] text-text-tertiary hidden sm:block font-medium">
          Bugün yeni bir perspektif keşfetmeye ne dersin?
        </p>
      </div>
      
      {/* SAĞ TARAF */}
      <div className="flex items-center shrink-0">
        
        {/* 1. BİLDİRİMLER (Neutral-900 / 24px İkon / 11px Font) */}
        <div className="relative text-neutral-900 cursor-pointer hover:text-[#3A7BD5] transition-colors">
          <Bell size={24} />
          <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#FF4D4D] text-white text-[11px] flex items-center justify-center rounded-full font-bold border-2 border-white leading-none">
            3
          </span>
        </div>

        {/* AYIRICI (20px) */}
        <div className="h-8 w-px bg-surface-200 mx-5"></div>

        {/* 2. İSİM VE UNVAN */}
        <div className="text-right hidden md:block">
          <p className="text-[14px] 2xl:text-[16px] text-[#10294C] font-bold leading-none mb-1 whitespace-nowrap">Alparslan Şentürk</p>
          <p className="text-[12px] 2xl:text-[14px] text-text-tertiary font-medium whitespace-nowrap">Eğitmen | Arı Bilgi</p>
        </div>

        {/* AYIRICI (12px) */}
        <div className="h-8 w-px bg-surface-200 mx-3"></div>

        {/* 3. AVATAR (Garantili Çalışan URL) */}
        <div className="w-10 h-10 rounded-full border-2 border-[#FF8D28] p-0.5 shrink-0 overflow-hidden bg-surface-50 shadow-sm">
          <img 
            src={myAvatarUrl} 
            alt="Profil" 
            className="w-full h-full object-cover" 
          />
        </div>

        {/* 4. ŞUBE SEÇİMİ (24px Mesafe / 24px Menu Padding / Sola Yaslı) */}
        <div className="relative ml-6" ref={dropdownRef}>
          <button 
            onClick={() => setIsBranchOpen(!isBranchOpen)} 
            className={`flex items-center justify-between gap-2 px-1.5 py-1.5 rounded-xl transition-all cursor-pointer group w-[118px] border border-transparent 
              ${isBranchOpen ? 'bg-surface-50 border-surface-200' : 'bg-transparent hover:bg-surface-50'}`}
          >
            <span className="text-[13px] font-bold text-text-tertiary group-hover:text-[#10294C] whitespace-nowrap pl-1">
              {selectedBranch}
            </span>
            <ChevronDown size={14} className={`text-text-tertiary shrink-0 transition-transform duration-300 ${isBranchOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {isBranchOpen && (
            <div className="absolute top-full left-0 mt-2 w-52 bg-white border border-surface-200 rounded-2xl shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in duration-200">
              {otherBranches.map((branch) => (
                <button 
                  key={branch} 
                  onClick={() => { setSelectedBranch(branch); setIsBranchOpen(false); }} 
                  className="w-full text-left px-6 py-4 text-[13px] font-medium text-[#10294C] hover:bg-surface-50 transition-colors border-b border-surface-50 last:border-0"
                >
                  {branch}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 5. FLEX LOGOSU (Şubeden 24px sağda) */}
        <div className="flex items-center gap-1.5 cursor-pointer group select-none ml-6 pl-6 border-l border-surface-200">
          <span className="text-[22px] font-bold text-[#3A7BD5] tracking-tighter leading-none">flex</span>
          <ChevronRight size={18} className="text-[#3A7BD5] group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </header>
  );
}