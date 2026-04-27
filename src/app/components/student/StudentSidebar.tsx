"use client";

import Link from "next/link";
import { useParams, useRouter, usePathname } from "next/navigation";
import { BookOpen, Trophy, LogOut } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/app/lib/firebase";

interface Props {
  studentId?: string;
}

export default function StudentSidebar({ studentId: studentIdProp }: Props) {
  const params   = useParams<{ studentId?: string }>();
  const router   = useRouter();
  const pathname = usePathname();
  const studentId = studentIdProp ?? params.studentId ?? "";

  const handleLogout = async () => {
    await signOut(auth);
    document.cookie = "flex-token=; path=/; max-age=0";
    router.push("/login");
  };

  const isLeague = pathname === "/league" || pathname.startsWith("/league/");

  return (
    <div className="flex flex-col h-full bg-base-primary-900 text-white select-none">

      {/* Logo */}
      <div className="p-[40px_40px_0_40px]">
        <Link href={`/student/${studentId}`} className="flex items-center gap-1">
          <span className="text-[24px] font-semibold text-designstudio-primary-500">tasarım</span>
          <span className="text-[24px] font-bold text-white">atölyesi</span>
        </Link>
      </div>

      {/* Nav */}
      <div className="flex-1 px-4 mt-16 space-y-3 overflow-y-auto no-scrollbar">
        <Link
          href={`/student/${studentId}`}
          className={`flex items-center gap-4 px-6 py-4 rounded-xl transition-all ${
            !isLeague
              ? "bg-white/10 text-white"
              : "text-white/60 hover:text-white hover:bg-white/5"
          }`}
        >
          <BookOpen size={18} className={!isLeague ? "text-designstudio-primary-500 shrink-0" : "shrink-0"} />
          <span className="text-[14px] font-semibold leading-none">Ödevlerim</span>
        </Link>
        <Link
          href="/league"
          className={`flex items-center gap-4 px-6 py-4 rounded-xl transition-all ${
            isLeague
              ? "bg-white/10 text-white"
              : "text-white/60 hover:text-white hover:bg-white/5"
          }`}
        >
          <Trophy size={18} className={isLeague ? "text-designstudio-primary-500 shrink-0" : "shrink-0"} />
          <span className="text-[14px] font-semibold leading-none">Sınıflar Ligi</span>
        </Link>
      </div>

      {/* Alt: çıkış */}
      <div className="px-4 pb-4">
        <div
          onClick={handleLogout}
          className="flex items-center gap-4 px-6 py-4 text-white cursor-pointer hover:bg-white/5 transition-all duration-200 group rounded-xl"
        >
          <span className="transition-colors duration-200 group-hover:text-designstudio-primary-500">
            <LogOut size={18} />
          </span>
          <span className="text-[15px] font-medium leading-tight">Çıkış Yap</span>
        </div>
      </div>
    </div>
  );
}
