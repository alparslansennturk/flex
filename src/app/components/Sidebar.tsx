"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@/app/context/UserContext";
import { PERMISSIONS, NAV_CONFIG } from "@/app/lib/constants";
import { LayoutDashboard, Users, BookOpen, Trophy, LogOut, PencilLine, UserCircle, Settings2 } from "lucide-react";
import { auth } from "../lib/firebase";
import { signOut } from "firebase/auth";
export default function Sidebar() {
  const pathname = usePathname();
  const { hasPermission, user } = useUser();
  const isAdmin = user?.roles?.includes('admin') || false;
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Çıkış hatası:", error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#10294C] text-white transition-all duration-500">
      <div className="p-[40px_40px_0_40px] select-none">
        <Link href="/dashboard" className="flex items-center gap-1">
          <span className="text-[24px] font-semibold text-[#FF8D28]">tasarım</span>
          <span className="text-[24px] font-bold text-white">atölyesi</span>
        </Link>
      </div>

      {/* ANA OPERASYONEL MENÜ */}
      <nav className="flex-1 px-4 mt-[64px] space-y-[12px] overflow-y-auto no-scrollbar">
        <SidebarLink href="/dashboard" icon={<LayoutDashboard size={18} />} label="Ana Sayfa" exact />
        <SidebarLink href={NAV_CONFIG.GROUPS.path} icon={<Users size={18} />} label="Sınıf Yönetimi" />

        {hasPermission(PERMISSIONS.ASSIGNMENT_MANAGE) && (
          <SidebarLink href="/dashboard/tasks" icon={<BookOpen size={18} />} label="Ödev Yönetimi" />
        )}

        <SidebarLink href="/dashboard/grading" icon={<PencilLine size={18} />} label="Not Girişi" />
        <SidebarLink href="/dashboard/league" icon={<Trophy size={18} />} label="Sınıflar Ligi" />
        <SidebarLink href="/dashboard/profile" icon={<UserCircle size={18} />} label="Profil Ayarları" />
      </nav>

      {/* ALT BÖLÜM */}
      <div className="mt-auto px-4 pb-8 flex flex-col gap-2 shrink-0">

        {/* YÖNETİM PANELİ — Admin veya MANAGEMENT_PANEL yetkisi */}
        {(isAdmin || hasPermission(PERMISSIONS.MANAGEMENT_PANEL)) && (
          <>
            <SidebarLink href="/dashboard/admin" icon={<Settings2 size={18} />} label="Yönetim Paneli" />
            <div className="mx-2 my-1 border-t border-white/10" />
          </>
        )}

        {/* ÇIKIŞ */}
        <div
          onClick={handleLogout}
          className="flex items-center gap-4 px-6 py-[16px] text-white cursor-pointer hover:bg-white/5 transition-all duration-200 group rounded-xl outline-none"
        >
          <span className="transition-colors duration-200 group-hover:text-[#FF8D28]">
            <LogOut size={18} />
          </span>
          <span className="text-[15px] font-medium leading-tight">Çıkış Yap</span>
        </div>

      </div>
    </div>
  );
}

// SidebarLink BİLEŞENİ (Orijinal, dokunulmadı)
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