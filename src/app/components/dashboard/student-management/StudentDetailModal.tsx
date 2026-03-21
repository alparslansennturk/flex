"use client";

import { X, Trophy } from "lucide-react";

export interface ModalStudent {
  id: string;
  name: string;
  lastName: string;
  rank: number;
  score: number;
  points?: number;
  completedTasks?: number;
  latePenaltyTotal?: number;
  branch?: string;
  groupCode?: string;
  gender?: string;
  avatarId?: number;
}

interface Props {
  student: ModalStudent | null;
  isOpen: boolean;
  onClose: () => void;
}

const MEDALS = ["🥇", "🥈", "🥉"];

export default function StudentDetailModal({ student, isOpen, onClose }: Props) {
  if (!isOpen || !student) return null;

  const safeGender = student.gender === "female" ? "female" : "male";
  const safeAvatar = student.avatarId && student.avatarId > 0 ? student.avatarId : 1;
  const avatarUrl  = `/avatars/${safeGender}/${safeAvatar}.svg`;
  const medal      = student.rank <= 3 ? MEDALS[student.rank - 1] : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#10294C]/20 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Card */}
      <div className="relative bg-white rounded-24 shadow-xl border border-surface-200 p-8 max-w-sm w-full mx-4 z-10 text-center">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-12 bg-surface-50 hover:bg-surface-100 transition-colors cursor-pointer"
        >
          <X size={15} className="text-text-tertiary" />
        </button>

        {/* Medal */}
        {medal && (
          <span className="text-[36px] leading-none block mb-3">{medal}</span>
        )}

        {/* Avatar */}
        <div className="w-16 h-16 rounded-full border-2 border-surface-200 overflow-hidden bg-surface-50 mx-auto mb-4">
          <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
        </div>

        {/* Name & rank */}
        <h2 className="text-[18px] font-bold text-text-primary leading-tight">
          {student.name} {student.lastName}
        </h2>
        <p className="text-[12px] text-text-tertiary font-medium mt-1 mb-6">
          {student.rank}. sıra · {student.groupCode} · {student.branch}
        </p>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-surface-50 rounded-12 p-3">
            <p className="text-[18px] font-bold text-text-primary tabular-nums leading-none">
              {Math.round(student.score)}
            </p>
            <p className="text-[10px] text-text-tertiary font-semibold mt-0.5">Puan</p>
          </div>
          <div className="bg-surface-50 rounded-12 p-3">
            <p className="text-[18px] font-bold text-text-primary tabular-nums leading-none">
              {student.points ?? 0}
            </p>
            <p className="text-[10px] text-text-tertiary font-semibold mt-0.5">XP</p>
          </div>
          <div className="bg-surface-50 rounded-12 p-3">
            <p className="text-[18px] font-bold text-text-primary tabular-nums leading-none">
              {student.completedTasks ?? 0}
            </p>
            <p className="text-[10px] text-text-tertiary font-semibold mt-0.5">Görev</p>
          </div>
        </div>

        {/* Coming soon */}
        <div className="border border-dashed border-surface-200 rounded-16 p-4 flex flex-col items-center gap-2">
          <Trophy size={20} className="text-surface-300" />
          <p className="text-[12px] text-text-placeholder font-medium">
            Detaylı öğrenci profili yakında
          </p>
        </div>
      </div>
    </div>
  );
}
