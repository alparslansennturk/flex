"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@/app/context/UserContext";
import { PERMISSIONS, NAV_CONFIG } from "@/app/lib/constants";
import { LayoutDashboard, Users, BookOpen, Trophy, LogOut, PencilLine, UserCircle, Settings2, Archive } from "lucide-react";
import { auth } from "@/app/lib/firebase";
import { signOut } from "firebase/auth";

// 880px altı → hafif compact (1440x900 ekranlar ~820-840px viewport)
function useCompact() {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const check = () => setCompact(window.innerHeight < 820);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return compact;
}

export default function Sidebar() {
  const pathname = usePathname();
  const { hasPermission, user } = useUser();
  const isAdmin = user?.roles?.includes('admin') || false;
  const router = useRouter();
  const compact = useCompact();

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
      {/* Logo — compact'ta üst boşluk azalır */}
      <div className={`select-none transition-all duration-300 ${compact ? "p-[32px_40px_0_40px]" : "p-[40px_40px_0_40px]"}`}>
        <Link href="/dashboard" className="flex items-center gap-1">
          <span className="text-[24px] font-semibold text-[#FF8D28]">tasarım</span>
          <span className="text-[24px] font-bold text-white">atölyesi</span>
        </Link>
      </div>

      {/* ANA OPERASYONEL MENÜ — compact'ta üst margin ve item arası biraz azalır */}
      <nav className={`flex-1 px-4 overflow-y-auto no-scrollbar transition-all duration-300 ${compact ? "mt-12 space-y-2" : "mt-16 space-y-3"}`}>
        <SidebarLink href="/dashboard" icon={<LayoutDashboard size={18} />} label="Ana Sayfa" exact compact={compact} />
        <SidebarLink href={NAV_CONFIG.GROUPS.path} icon={<Users size={18} />} label="Sınıf Yönetimi" compact={compact} />

        {hasPermission(PERMISSIONS.ASSIGNMENT_MANAGE) && (
          <SidebarLink href="/dashboard/tasks" icon={<BookOpen size={18} />} label="Ödev Yönetimi" compact={compact} />
        )}

        {(hasPermission(PERMISSIONS.ASSIGNMENT_MANAGE) || user?.roles?.includes('instructor')) && (
          <SidebarLink href="/dashboard/archive" icon={<Archive size={18} />} label="Ödev Arşivi" compact={compact} />
        )}

        <SidebarLink href="/dashboard/grading" icon={<PencilLine size={18} />} label="Not Girişi" compact={compact} />
        <SidebarLink href="/dashboard/league" icon={<Trophy size={18} />} label="Sınıflar Ligi" compact={compact} />
        <SidebarLink href="/dashboard/profile" icon={<UserCircle size={18} />} label="Profil Ayarları" compact={compact} />
      </nav>

      {/* ALT BÖLÜM */}
      <div className={`mt-auto px-4 flex flex-col gap-2 shrink-0 transition-all duration-300 ${compact ? "pb-6" : "pb-8"}`}>

        {(isAdmin || hasPermission(PERMISSIONS.MANAGEMENT_PANEL)) && (
          <>
            <SidebarLink href="/dashboard/admin" icon={<Settings2 size={18} />} label="Yönetim Paneli" compact={compact} />
            <div className="mx-2 my-1 border-t border-white/10" />
          </>
        )}

        <div
          onClick={handleLogout}
          className={`flex items-center gap-4 px-6 text-white cursor-pointer hover:bg-white/5 transition-all duration-200 group rounded-xl outline-none ${compact ? "py-3.25" : "py-4"}`}
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

function SidebarLink({ href, icon, label, exact = false, compact = false }: {
  href: string; icon: any; label: string; exact?: boolean; compact?: boolean;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : (pathname === href || pathname.startsWith(href + '/'));
  return (
    <Link
      href={href}
      className={`flex items-center gap-4 px-6 rounded-xl transition-all duration-200 group
        ${compact ? "py-3.25" : "py-4"}
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