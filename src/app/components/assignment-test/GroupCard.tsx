"use client";

import { Users, BookOpen, ArrowRight } from "lucide-react";

interface GroupCardProps {
  id: string;
  code: string;
  session: string;
  branch: string;
  instructor: string;
  studentCount: number;
  activeTaskCount: number;
  submissionCount: number;
  onClick: () => void;
}

export default function GroupCard({
  code,
  session,
  branch,
  instructor,
  studentCount,
  activeTaskCount,
  submissionCount,
  onClick,
}: GroupCardProps) {
  return (
    <div
      onClick={onClick}
      className="group relative bg-white border border-surface-200 rounded-2xl p-6 cursor-pointer
        hover:shadow-lg hover:shadow-base-primary-500/10 hover:border-base-primary-300
        hover:-translate-y-0.5 transition-all duration-200"
    >
      {/* Üst: başlık + ok */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-[11px] font-bold text-surface-400 uppercase tracking-wider mb-1">{branch} Şb</p>
          <h3 className="text-[17px] font-bold text-base-primary-900 leading-tight">{code}</h3>
          <p className="text-[13px] font-medium text-surface-500 mt-0.5">{session}</p>
        </div>
        <div className="w-8 h-8 rounded-xl bg-surface-50 group-hover:bg-base-primary-500 flex items-center justify-center transition-colors duration-200">
          <ArrowRight size={15} className="text-surface-400 group-hover:text-white transition-colors duration-200" />
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-surface-100 mb-4" />

      {/* Alt: istatistikler */}
      <div className="grid grid-cols-3 gap-3">
        <Stat icon={<Users size={13} />} value={studentCount} label="Öğrenci" />
        <Stat icon={<BookOpen size={13} />} value={activeTaskCount} label="Ödev" />
        <Stat icon={null} value={submissionCount} label="Teslim" />
      </div>

      {/* Eğitmen */}
      <p className="mt-4 text-[11px] font-medium text-surface-400 truncate">{instructor}</p>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex items-center gap-1 text-surface-400">{icon}</div>
      <p className="text-[16px] font-bold text-text-primary leading-none">{value}</p>
      <p className="text-[10px] font-medium text-surface-400">{label}</p>
    </div>
  );
}
