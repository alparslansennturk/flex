"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@/app/context/UserContext";
import { PERMISSIONS, NAV_CONFIG } from "@/app/lib/constants";
import { LayoutDashboard, Users, BookOpen, Trophy, Settings, LogOut, ShieldAlert } from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();
  const { hasPermission } = useUser();

  return (
    <div className="flex flex-col h-full bg-[#10294C] text-white transition-all duration-500">
      <div className="p-[40px_40px_0_40px] select-none">
        <Link href="/dashboard" className="flex items-center gap-1">
          <span className="text-[24px] font-semibold text-[#FF8D28]">tasarım</span>
          <span className="text-[24px] font-bold text-white">atölyesi</span>
        </Link>
      </div>
      <nav className="flex-1 px-4 mt-[64px] space-y-[12px] overflow-y-auto no-scrollbar">
        <SidebarLink href="/dashboard" icon={<LayoutDashboard size={18} />} label="Ana Sayfa" exact />
        <SidebarLink href={NAV_CONFIG.GROUPS.path} icon={<Users size={18} />} label="Sınıf Yönetimi" />
        {hasPermission(PERMISSIONS.ASSIGNMENT_MANAGE) && (
          <SidebarLink href="/dashboard/tasks" icon={<BookOpen size={18} />} label={NAV_CONFIG.ASSIGNMENTS.title} />
        )}
        <SidebarLink href="/dashboard/league" icon={<Trophy size={18} />} label="Sınıflar Ligi" />
        {hasPermission(PERMISSIONS.ROLE_MANAGE) && (
          <SidebarLink href={NAV_CONFIG.PERMISSIONS.path} icon={<ShieldAlert size={18} />} label={NAV_CONFIG.PERMISSIONS.title} />
        )}
        <SidebarLink href="/dashboard/settings" icon={<Settings size={18} />} label="Atölye Ayarları" />
      </nav>
      <div className="p-6 mt-auto border-t border-white/5">
        <div className="flex items-center gap-4 px-6 py-4 text-white cursor-pointer hover:bg-white/10 transition-all group rounded-xl">
          <LogOut size={18} className="group-hover:text-[#FF8D28]" />
          <span className="text-[15px] font-medium">Çıkış Yap</span>
        </div>
      </div>
    </div>
  );
}

function SidebarLink({ href, icon, label, exact = false }: { href: string, icon: any, label: string, exact?: boolean }) {
  const pathname = usePathname();
  const active = exact ? pathname === href : (pathname === href || pathname.startsWith(href + '/'));
  return (
    <Link
      href={href}
      className={`flex items-center gap-4 px-6 py-[16px] rounded-xl transition-all duration-200 group 
        ${active ? 'bg-white/10 text-white shadow-sm' : 'text-white hover:bg-white/5'}`}
    >
      <span className={`transition-colors duration-200 ${active ? 'text-[#FF8D28]' : 'group-hover:text-[#FF8D28]'}`}>
        {icon}
      </span>
      <span className="text-[15px] font-medium leading-tight">
        {label}
      </span>
    </Link>
  );
}