"use client";

import { Clock, Eye, RotateCcw, CheckCircle2 } from "lucide-react";
import type { SubmissionStatus } from "@/app/types/submission";

const STATUS_CONFIG: Record<SubmissionStatus, {
  label: string;
  icon: React.ReactNode;
  className: string;
}> = {
  submitted: {
    label: "Teslim Edildi",
    icon: <Clock size={11} />,
    className: "bg-blue-50 text-blue-600 border-blue-100",
  },
  reviewing: {
    label: "İnceleniyor",
    icon: <Eye size={11} />,
    className: "bg-amber-50 text-amber-600 border-amber-100",
  },
  revision: {
    label: "Revizyon",
    icon: <RotateCcw size={11} />,
    className: "bg-orange-50 text-orange-600 border-orange-100",
  },
  completed: {
    label: "Tamamlandı",
    icon: <CheckCircle2 size={11} />,
    className: "bg-emerald-50 text-emerald-600 border-emerald-100",
  },
};

interface Props {
  status: SubmissionStatus;
  size?: "sm" | "md";
}

export default function SubmissionStatusBadge({ status, size = "sm" }: Props) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.submitted;
  const sizeClass = size === "md"
    ? "px-3 py-1 text-[12px] gap-1.5"
    : "px-2 py-0.5 text-[11px] gap-1";

  return (
    <span className={`inline-flex items-center rounded-full border font-bold ${sizeClass} ${cfg.className}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}
