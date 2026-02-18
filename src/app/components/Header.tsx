"use client";
import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronRight, Bell, Settings } from "lucide-react";
import { usePathname } from "next/navigation";
import { useUser } from "@/app/context/UserContext";

export default function Header({ activeTabLabel = "Eğitim Yönetimi" }) {
  const pathname = usePathname();
  const { user } = useUser();
  const [selectedBranch, setSelectedBranch] = useState("Tüm Şubeler");
  const [isBranchOpen, setIsBranchOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const branches = ["Tüm Şubeler", "Kadıköy Şb.", "Şirinevler Şb.", "Pendik Şb."];
  const firstName = user?.name?.split(' ')[0] || "";
  const today = new Date();
  const todayString = `${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
  const isBirthday = user?.birthDate?.includes(todayString);
  useEffect(() => {
    const saved = localStorage.getItem("selectedBranch");
    if (saved && branches.includes(saved)) setSelectedBranch(saved);
  }, []);

  const handleBranchSelect = (branch: string) => {
    setSelectedBranch(branch);
    localStorage.setItem("selectedBranch", branch);
    setIsBranchOpen(false);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsBranchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isManagementPage = pathname?.includes("/management");
  const otherBranches = branches.filter((b) => b !== selectedBranch);
  const myAvatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name || 'User'}&scale=110`;


  return (
    <header className="w-full bg-white border-b border-surface-200 font-inter shrink-0">
      <div className="max-w-[1920px] mx-auto h-20 flex items-center justify-between px-8">

        {/* SOL TARAF: Karşılama ve Başlık */}
        <div className="flex items-center gap-4 truncate pr-4">
          {isManagementPage && (
            <div className="w-10 h-10 rounded-xl bg-base-primary-5 flex items-center justify-center text-base-primary-900 border border-base-primary-100 shrink-0">
              <Settings size={22} strokeWidth={2.5} />
            </div>
          )}
          <div className="truncate">
            <h1 className="text-[clamp(18px,1.2vw,22px)] text-base-primary-900 leading-tight flex items-center gap-2.5"
              style={{ fontWeight: 630, letterSpacing: "-0.022em" }}>
              {isManagementPage ? (
                <>
                  <span className="text-neutral-400 font-medium">Yönetim Paneli</span>
                  <span className="text-neutral-300 font-light select-none">|</span>
                  <span className="animate-in fade-in duration-500">{activeTabLabel}</span>
                </>
              ) : (
                isBirthday ? (
                  <span className="animate-bounce flex items-center gap-2">
                    🎂 İyi ki Doğdun{firstName ? `, ${firstName}` : ""}! 🎉
                  </span>
                ) : (
                  `Hoş Geldin${firstName ? `, ${firstName}` : ""} 😊`
                )
              )}
            </h1>
            <p className="text-[14px] text-neutral-400 font-medium mt-0.5 truncate leading-none">
              {isManagementPage
                ? "Atölye, sınıf ve kullanıcı ayarlarını buradan yönet."
                : "Bugün atölyende neler oluyor? İşte son durum."}
            </p>
          </div>
        </div>

        {/* SAĞ TARAF: Bildirim, Profil ve Şube */}
        <div className="flex items-center shrink-0">
          <div className="relative text-neutral-900 cursor-pointer hover:text-base-primary-500 transition-colors">
            <Bell size={24} />
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-status-danger-500 text-white text-[11px] flex items-center justify-center rounded-full font-bold border-2 border-white leading-none">3</span>
          </div>
          <div className="h-8 w-px bg-surface-200 mx-5"></div>

          <div className="text-right hidden md:block">
            <p className="text-[14px] 2xl:text-[16px] text-base-primary-900 font-bold leading-none mb-1 whitespace-nowrap">
              {user?.name} {user?.surname}
            </p>
            <p className="text-[12px] 2xl:text-[13px] text-neutral-400 font-medium whitespace-nowrap">
              {user?.title || (user?.roles?.includes('admin') ? "Yönetici | Eğitmen" : "Eğitmen")}
            </p>
          </div>

          <div className="h-8 w-px bg-surface-200 mx-4"></div>
          <div className="w-10 h-10 rounded-full border-2 border-designstudio-primary-500 p-0.5 shrink-0 overflow-hidden bg-surface-50 shadow-sm cursor-pointer">
            <img src={myAvatarUrl} alt="Profil" className="w-full h-full object-cover" />
          </div>

          <div className="relative ml-6" ref={dropdownRef}>
            <button
              onClick={() => setIsBranchOpen(!isBranchOpen)}
              className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl transition-all min-w-[120px] w-fit border border-transparent cursor-pointer ${isBranchOpen ? 'bg-surface-50 border-surface-200 shadow-sm' : 'bg-transparent hover:bg-surface-50'}`}
            >
              <span className="text-[13px] font-bold text-text-tertiary pl-1">{selectedBranch}</span>
              <ChevronDown size={14} className={`text-text-tertiary transition-transform duration-300 ${isBranchOpen ? 'rotate-180' : ''}`} />
            </button>

            {isBranchOpen && (
              <div className="absolute top-[calc(100%+8px)] left-0 w-48 bg-white border border-surface-200 rounded-2xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                {otherBranches.map((branch) => (
                  <button
                    key={branch}
                    onClick={() => handleBranchSelect(branch)}
                    className="w-full text-left px-5 py-2.5 text-[13px] font-medium text-base-primary-900 hover:bg-surface-50 border-b border-surface-50 last:border-0 transition-colors cursor-pointer"
                  >
                    {branch}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 cursor-pointer group ml-6 pl-6 border-l border-surface-200">
            <span className="text-[22px] font-bold text-base-primary-500 tracking-tighter">flex</span>
            <ChevronRight size={18} className="text-base-primary-500 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>
    </header>
  );
}