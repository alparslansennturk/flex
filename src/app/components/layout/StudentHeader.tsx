"use client";
import React from "react";
import { Bell } from "lucide-react";

interface Props {
  studentName: string;
  groupCode?: string;
  gender?: string;
  avatarId?: number;
}

export default function StudentHeader({ studentName, groupCode, gender, avatarId }: Props) {
  const avatarUrl = `/avatars/${gender ?? "male"}/${avatarId ?? 1}.svg`;
  const firstName = studentName.split(" ")[0] || "";

  return (
    <header className="w-full bg-white border-b border-surface-200 font-inter shrink-0">
      <div className="max-w-[1920px] mx-auto h-20 flex items-center justify-between px-8">

        {/* SOL TARAF */}
        <div className="flex items-center gap-4 truncate pr-4">
          <div className="truncate">
            <h1
              className="text-[clamp(18px,1.2vw,22px)] text-base-primary-900 leading-tight"
              style={{ fontWeight: 630, letterSpacing: "-0.022em" }}
            >
              {`Hoş Geldin, ${firstName} 😊`}
            </h1>
            <p className="text-[14px] text-neutral-400 font-medium mt-0.5 truncate leading-none">
              Bugün ödevlerini kontrol etmeyi unutma.
            </p>
          </div>
        </div>

        {/* SAĞ TARAF */}
        <div className="flex items-center shrink-0">
          <div className="relative text-neutral-900 cursor-pointer hover:text-base-primary-500 transition-colors">
            <Bell size={24} />
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-status-danger-500 text-white text-[11px] flex items-center justify-center rounded-full font-bold border-2 border-white leading-none">
              3
            </span>
          </div>
          <div className="h-8 w-px bg-surface-200 mx-5" />

          <div className="text-right hidden md:block">
            <p className="text-[14px] 2xl:text-[16px] text-base-primary-900 font-bold leading-none mb-1 whitespace-nowrap">
              {studentName}
            </p>
            <p className="text-[12px] 2xl:text-[13px] text-neutral-400 font-medium whitespace-nowrap">
              {groupCode ? `${groupCode} | Öğrenci` : "Öğrenci"}
            </p>
          </div>

          <div className="h-8 w-px bg-surface-200 mx-4" />
          <div className="w-10 h-10 rounded-full border-2 border-designstudio-primary-500 shrink-0 overflow-hidden bg-surface-50 shadow-sm cursor-pointer">
            <img src={avatarUrl} alt="Profil" className="w-full h-full object-contain" />
          </div>
        </div>
      </div>
    </header>
  );
}
