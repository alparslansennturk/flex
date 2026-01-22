"use client";
import React from "react";
import { LayoutDashboard, Users, BookOpen, Trophy, Settings, LogOut } from "lucide-react";

export default function Sidebar({ activeTab, setActiveTab }: any) {
  return (
    <div className="flex flex-col h-full bg-[#10294C] text-white">
      {/* Logo Alanı */}
      <div className="p-[clamp(24px,2.5vw,40px)] text-nowrap select-none" onClick={() => setActiveTab('dashboard')}>
        <div className="flex items-center gap-1 cursor-pointer">
          <span className="text-[clamp(20px,1.5vw,24px)] font-semibold text-[#FF8D28] tracking-tight">tasarım</span>
          <span className="text-[clamp(20px,1.5vw,24px)] font-bold text-white tracking-tight">atölyesi</span>
        </div>
      </div>

      {/* Navigasyon */}
      <nav className="flex-1 px-4 mt-8 space-y-2 overflow-y-auto no-scrollbar">
        <SidebarLink 
          icon={<LayoutDashboard size={18} />} 
          label="Atölye Özeti" 
          active={activeTab === 'dashboard'} 
          onClick={() => setActiveTab('dashboard')} 
        />
        <SidebarLink 
          icon={<Users size={18} />} 
          label="Öğrencilerim" 
          active={activeTab === 'management'} 
          onClick={() => setActiveTab('management')} 
        />
        <SidebarLink icon={<BookOpen size={18} />} label="Ödev Havuzu" />
        <SidebarLink icon={<Trophy size={18} />} label="Sınıflar Ligi" />
        <SidebarLink icon={<Settings size={18} />} label="Atölye Ayarları" />
      </nav>

      {/* Alt Bölüm */}
      <div className="p-6 mt-auto border-t border-white/5">
        <div className="flex items-center gap-4 px-6 py-4 text-white cursor-pointer hover:bg-white/10 transition-all group rounded-xl font-medium text-[clamp(15px,1vw,17px)]">
          <LogOut size={18} className="group-hover:text-[#FF8D28] transition-colors" />
          <span>Çıkış Yap</span>
        </div>
      </div>
    </div>
  );
}

function SidebarLink({ icon, label, active, onClick }: any) {
  return (
    <div 
      onClick={onClick} 
      className={`flex items-center gap-4 px-6 py-[clamp(14px,1.2vw,18px)] rounded-xl transition-all duration-200 cursor-pointer group 
        ${active ? 'bg-white/10 text-white shadow-sm' : 'text-white hover:bg-white/5'}`}
    >
      <span className={`transition-colors duration-200 ${active ? 'text-[#FF8D28]' : 'group-hover:text-[#FF8D28]'}`}>
        {icon}
      </span>
      {/* Font weight Medium (500) olarak ayarlandı */}
      <span className="text-[clamp(15px,1vw,17px)] font-medium tracking-wide">
        {label}
      </span>
    </div>
  );
}