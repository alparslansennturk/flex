"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, BookOpen, Trophy, Settings, LogOut, ChevronLeft, ShieldCheck } from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();
  
  // Yönetim alanında olup olmadığımızı anlayan anahtar
  const isManagement = pathname.includes('/management');

  return (
    <div className="flex flex-col h-full bg-[#10294C] text-white transition-all duration-500">
      
      {/* Logo Alanı */}
      <div className="p-[clamp(24px,2.5vw,40px)] select-none">
        <Link href="/dashboard" className="flex items-center gap-1 cursor-pointer">
          <span className="text-[clamp(20px,1.5vw,24px)] font-semibold text-[#FF8D28] tracking-tight">tasarım</span>
          <span className="text-[clamp(20px,1.5vw,24px)] font-bold text-white tracking-tight">atölyesi</span>
        </Link>
        {isManagement && (
          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-[#3A7BD5]/20 border border-[#3A7BD5]/30 rounded-full">
            <ShieldCheck size={12} className="text-[#3A7BD5]" />
            <span className="text-[10px] font-bold text-[#3A7BD5] uppercase tracking-wider">Yönetim Modu</span>
          </div>
        )}
      </div>

      {/* Dinamik Navigasyon */}
      <nav className="flex-1 px-4 mt-4 space-y-2 overflow-y-auto no-scrollbar">
        {!isManagement ? (
          /* DASHBOARD MENÜLERİ */
          <>
            <SidebarLink href="/dashboard" icon={<LayoutDashboard size={18} />} label="Atölye Özeti" />
            <SidebarLink href="/dashboard/management" icon={<Users size={18} />} label="Öğrencilerim" />
            <SidebarLink href="/dashboard/tasks" icon={<BookOpen size={18} />} label="Ödev Havuzu" />
            <SidebarLink href="/dashboard/league" icon={<Trophy size={18} />} label="Sınıflar Ligi" />
            <SidebarLink href="/dashboard/settings" icon={<Settings size={18} />} label="Atölye Ayarları" />
          </>
        ) : (
          /* YÖNETİM MENÜLERİ */
          <>
            <Link href="/dashboard" className="flex items-center gap-3 px-6 py-3 text-white/70 hover:text-white transition-all mb-4 group font-medium text-[14px]">
              <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
              Panoya Dön
            </Link>
            <SidebarLink href="/dashboard/management" icon={<Users size={18} />} label="Grup Yönetimi" />
            <SidebarLink href="/dashboard/management/students" icon={<Users size={18} />} label="Öğrenci Listesi" />
            <SidebarLink href="/dashboard/management/settings" icon={<Settings size={18} />} label="Atölye Ayarları" />
          </>
        )}
      </nav>

      {/* Alt Bölüm */}
      <div className="p-6 mt-auto border-t border-white/5">
        <div className="flex items-center gap-4 px-6 py-4 text-white cursor-pointer hover:bg-white/10 transition-all group rounded-xl font-medium text-[clamp(14px,1vw,16px)]">
          <LogOut size={18} className="group-hover:text-[#FF8D28] transition-colors" />
          <span>Çıkış Yap</span>
        </div>
      </div>
    </div>
  );
}

function SidebarLink({ href, icon, label }: { href: string, icon: any, label: string }) {
  const pathname = usePathname();
  
  // Önerdiğin o kritik iyileştirme: Parent ve Alt rotaları kapsayan aktiflik kontrolü
  const active = pathname === href || pathname.startsWith(href + '/');

  return (
    <Link 
      href={href}
      className={`flex items-center gap-4 px-6 py-[clamp(14px,1.2vw,18px)] rounded-xl transition-all duration-200 cursor-pointer group 
        ${active ? 'bg-white/10 text-white shadow-sm' : 'text-white hover:bg-white/5'}`}
    >
      <span className={`transition-colors duration-200 ${active ? 'text-[#FF8D28]' : 'group-hover:text-[#FF8D28]'}`}>
        {icon}
      </span>
      <span className="text-[clamp(14px,1vw,16px)] font-medium tracking-wide">
        {label}
      </span>
    </Link>
  );
}