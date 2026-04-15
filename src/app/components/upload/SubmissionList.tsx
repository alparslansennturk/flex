"use client";

import { ExternalLink, Clock, CheckCircle2, RotateCcw, Eye, AlertCircle } from "lucide-react";
import type { Submission, SubmissionStatus } from "@/app/types/submission";

interface SubmissionListProps {
  submissions: Submission[];
  loading?:    boolean;
}

const STATUS_CONFIG: Record<SubmissionStatus, { label: string; color: string; icon: React.ReactNode }> = {
  submitted: {
    label: "Teslim Edildi",
    color: "bg-blue-50 text-blue-600 border-blue-100",
    icon:  <Clock size={11} />,
  },
  reviewing: {
    label: "İnceleniyor",
    color: "bg-yellow-50 text-yellow-600 border-yellow-100",
    icon:  <Eye size={11} />,
  },
  revision: {
    label: "Revizyon İstendi",
    color: "bg-orange-50 text-orange-600 border-orange-100",
    icon:  <RotateCcw size={11} />,
  },
  completed: {
    label: "Tamamlandı",
    color: "bg-status-success-50 text-status-success-600 border-status-success-100",
    icon:  <CheckCircle2 size={11} />,
  },
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(date));
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function StatusBadge({ status }: { status: SubmissionStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${cfg.color}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

export default function SubmissionList({ submissions, loading }: SubmissionListProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map(i => (
          <div key={i} className="h-16 rounded-xl bg-surface-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <AlertCircle size={20} className="text-surface-300" />
        <p className="text-[13px] font-bold text-surface-400">Henüz teslim yok</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {submissions.map(sub => {
        const cfg = STATUS_CONFIG[sub.status];
        return (
          <div
            key={sub.id}
            className="flex items-start gap-4 px-4 py-3 rounded-xl border border-surface-100 bg-white hover:bg-surface-50 transition-colors"
          >
            {/* İterasyon numarası */}
            <div className="w-7 h-7 rounded-lg bg-surface-100 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[11px] font-black text-surface-500">#{sub.iteration}</span>
            </div>

            {/* Detaylar */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <a
                  href={sub.file.driveViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13px] font-bold text-base-primary-700 hover:underline truncate flex items-center gap-1"
                >
                  {sub.file.fileName}
                  <ExternalLink size={11} className="shrink-0" />
                </a>
                <span className="text-[11px] text-surface-400">{formatBytes(sub.file.fileSize)}</span>
                {sub.isLate && (
                  <span className="text-[11px] font-bold text-status-danger-500">
                    {sub.daysLate}g geç
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <StatusBadge status={sub.status} />
                <span className="text-[11px] text-surface-400">{formatDate(sub.submittedAt)}</span>
              </div>
              {sub.note && (
                <p className="text-[12px] text-surface-500 mt-1.5 italic">"{sub.note}"</p>
              )}
              {sub.feedback && (
                <div className="mt-2 px-3 py-2 rounded-lg bg-surface-50 border border-surface-100">
                  <p className="text-[11px] font-bold text-surface-500 mb-0.5">Eğitmen geri bildirimi</p>
                  <p className="text-[12px] text-base-primary-900">{sub.feedback}</p>
                </div>
              )}
            </div>

            {/* Sağ taraf: grade */}
            {sub.grade != null && (
              <div className="shrink-0 text-right">
                <p className="text-[22px] font-black text-status-success-600 leading-none">{sub.grade}</p>
                <p className="text-[10px] text-surface-400">/ 100</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
