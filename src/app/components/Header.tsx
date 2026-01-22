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

  const myAvatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=Mason&scale=110`;

  return (
    <header className="w-full bg-white border-b border-surface-200 font-inter">
      <div className="w-[94%] mx-auto h-20 flex items-center justify-between transition-all duration-500 max-w-[1280px] xl:max-w-[1600px] 2xl:max-w-[2000px]">
        
        <div className="truncate pr-4">
          {/* Boyut 18px'den başlayıp 2K'da 24px'e kadar esniyor */}
          <h1 className="text-[clamp(18px,1.2vw,24px)] text-[#10294C] font-bold leading-tight">
            Hoş geldin, Alparslan
          </h1>
          <p className="text-[14px] 2xl:text-[15px] text-text-tertiary hidden sm:block font-medium">Bugün yeni bir perspektif keşfetmeye ne dersin?</p>
        </div>
        
        <div className="flex items-center shrink-0">
          <div className="relative text-neutral-900 cursor-pointer hover:text-[#3A7BD5] transition-colors">
            <Bell size={24} />
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#FF4D4D] text-white text-[11px] flex items-center justify-center rounded-full font-bold border-2 border-white leading-none">3</span>
          </div>
          <div className="h-8 w-px bg-surface-200 mx-5"></div>
          <div className="text-right hidden md:block">
            <p className="text-[14px] 2xl:text-[16px] text-[#10294C] font-bold leading-none mb-1 whitespace-nowrap">Alparslan Şentürk</p>
            <p className="text-[12px] 2xl:text-[14px] text-text-tertiary font-medium whitespace-nowrap">Eğitmen | Arı Bilgi</p>
          </div>
          <div className="h-8 w-px bg-surface-200 mx-3"></div>
          <div className="w-10 h-10 rounded-full border-2 border-[#FF8D28] p-0.5 shrink-0 overflow-hidden bg-surface-50 shadow-sm">
            <img src={myAvatarUrl} alt="Profil" className="w-full h-full object-cover" />
          </div>

          <div className="relative ml-6" ref={dropdownRef}>
            {/* Genişlik 118px'den 140px'e çıkarıldı ki Şirinevler sığsın */}
            <button 
              onClick={() => setIsBranchOpen(!isBranchOpen)} 
              className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-xl transition-all w-[140px] border border-transparent ${isBranchOpen ? 'bg-surface-50 border-surface-200' : 'bg-transparent hover:bg-surface-50'}`}
            >
              <span className="text-[13px] font-bold text-text-tertiary pl-1">{selectedBranch}</span>
              <ChevronDown size={14} className={`transition-transform duration-300 ${isBranchOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {isBranchOpen && (
              <div className="absolute top-full left-0 mt-2 w-52 bg-white border border-surface-200 rounded-2xl shadow-xl overflow-hidden z-50">
                {otherBranches.map((branch) => (
                  <button key={branch} onClick={() => { setSelectedBranch(branch); setIsBranchOpen(false); }} className="w-full text-left px-6 py-4 text-[13px] font-medium text-[#10294C] hover:bg-surface-50 border-b border-surface-50 last:border-0">
                    {branch}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 cursor-pointer group ml-6 pl-6 border-l border-surface-200">
            <span className="text-[22px] font-bold text-[#3A7BD5] tracking-tighter">flex</span>
            <ChevronRight size={18} className="text-[#3A7BD5]" />
          </div>
        </div>
      </div>
    </header>
  );
}