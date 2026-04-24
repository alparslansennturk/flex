"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@/app/context/UserContext";
import { PERMISSIONS, NAV_CONFIG } from "@/app/lib/constants";
import { LayoutDashboard, Users, BookOpen, Trophy, LogOut, GraduationCap, UserCircle, Settings2, Archive, ClipboardList, ChevronDown, FileCheck, Star, SlidersHorizontal, Eye } from "lucide-react";
import { auth } from "@/app/lib/firebase";
import { signOut } from "firebase/auth";

function useCompact() {
  const [compact, setCompact] = useState(() =>
    typeof window !== "undefined" ? window.innerHeight < 900 : false
  );
  useEffect(() => {
    const check = () => setCompact(window.innerHeight < 900);
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
  const [assignmentTestOpen, setAssignmentTestOpen] = useState(
    pathname.startsWith('/dashboard/assignment-test') || pathname === '/dashboard/archive'
  );

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
      {/* Logo */}
      <div className={`select-none transition-all duration-300 ${compact ? "p-[20px_40px_0_40px]" : "p-[40px_40px_0_40px]"}`}>
        <Link href="/dashboard" className="flex items-center gap-1">
          <span className="text-[24px] font-semibold text-[#FF8D28]">tasarım</span>
          <span className="text-[24px] font-bold text-white">atölyesi</span>
        </Link>
      </div>

      {/* ANA OPERASYONEL MENÜ — compact'ta üst margin ve item arası biraz azalır */}
      <nav className={`flex-1 px-4 overflow-y-auto no-scrollbar transition-all duration-300 ${compact ? "mt-6 space-y-1" : "mt-16 space-y-3"}`}>
        <SidebarLink href="/dashboard" icon={<LayoutDashboard size={18} />} label="Ana Sayfa" exact compact={compact} />
        <SidebarLink href={NAV_CONFIG.GROUPS.path} icon={<Users size={18} />} label="Sınıf Yönetimi" compact={compact} />

        {hasPermission(PERMISSIONS.ASSIGNMENT_MANAGE) && (
          <SidebarLink href="/dashboard/tasks" icon={<BookOpen size={18} />} label="Ödev Yönetimi" compact={compact} />
        )}

        <SidebarLink href="/dashboard/grading" icon={<GraduationCap size={18} />} label="Sertifikasyon" compact={compact} />
        <SidebarLink href="/dashboard/league" icon={<Trophy size={18} />} label="Sınıflar Ligi" compact={compact} />
        <SidebarLink href="/dashboard/profile" icon={<UserCircle size={18} />} label="Profil Ayarları" compact={compact} />

        {/* ── ÖDEV TEST (Accordion) ── */}
        {(hasPermission(PERMISSIONS.ASSIGNMENT_MANAGE) || user?.roles?.includes('instructor')) && (
          <div>
            <button
              onClick={() => setAssignmentTestOpen(o => !o)}
              className={`w-full flex items-center gap-4 px-6 rounded-xl transition-all duration-200 group
                ${compact ? "py-3.25" : "py-4"}
                ${(pathname.startsWith('/dashboard/assignment-test') || pathname === '/dashboard/archive')
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-white hover:bg-white/5'
                } cursor-pointer outline-none`}
            >
              <span className={`transition-colors duration-200 ${
                (pathname.startsWith('/dashboard/assignment-test') || pathname === '/dashboard/archive') ? 'text-[#FF8D28]' : 'group-hover:text-[#FF8D28]'
              }`}>
                <ClipboardList size={18} />
              </span>
              <span className="text-[15px] font-medium leading-tight flex-1 text-left">Ödev Test</span>
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 opacity-60 ${assignmentTestOpen ? 'rotate-180' : ''}`}
              />
            </button>

            <div
              style={{
                display: "grid",
                gridTemplateRows: assignmentTestOpen ? "1fr" : "0fr",
                transition: "grid-template-rows 0.22s ease",
              }}
            >
              <div style={{ overflow: "hidden" }}>
                <SidebarLink href="/dashboard/assignment-test/review"   icon={<Eye size={15} />}              label="İncelenecekler" compact={compact} sub />
                <SidebarLink href="/dashboard/assignment-test"          icon={<FileCheck size={15} />}         label="Ödevler"        compact={compact} exact sub />
                <SidebarLink href="/dashboard/assignment-test/grading"  icon={<Star size={15} />}              label="Not Girişi"     compact={compact} sub />
                <SidebarLink href="/dashboard/assignment-test/settings" icon={<SlidersHorizontal size={15} />} label="Ödev Ayarları"  compact={compact} sub />
                <SidebarLink href="/dashboard/archive"                  icon={<Archive size={15} />}           label="Ödev Arşivi"   compact={compact} sub />
              </div>
            </div>
          </div>
        )}
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

function SidebarLink({ href, icon, label, exact = false, compact = false, sub = false }: {
  href: string; icon: any; label: string; exact?: boolean; compact?: boolean; sub?: boolean;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : (pathname === href || pathname.startsWith(href + '/'));
  return (
    <Link
      href={href}
      className={`flex items-center gap-4 px-6 rounded-xl transition-all duration-200 group
        ${sub ? (compact ? "py-2" : "py-3") : compact ? "py-3.25" : "py-4"}
        ${active ? 'bg-white/10 text-white shadow-sm' : 'text-white hover:bg-white/5'}`}
    >
      <span className={`transition-colors duration-200 ${active ? 'text-[#FF8D28]' : 'group-hover:text-[#FF8D28]'}`}>
        {icon}
      </span>
      <span className={`leading-tight ${sub ? "text-[14px] font-normal" : "text-[15px] font-medium"}`}>
        {label}
      </span>
    </Link>
  );
}
