"use client";

import { useEffect, useRef, useState } from "react";
import { db } from "@/app/lib/firebase";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { Upload, MessageCircle, AlertTriangle, RefreshCw, CheckCircle2, Loader2 } from "lucide-react";
import type { TimelineEntryType } from "@/app/types/submission-timeline";

interface TimelineEntry {
  id: string;
  type: TimelineEntryType;
  authorId: string;
  authorName?: string;
  createdAt: Date;
  data: { commentId?: string; fileId?: string };
  text?: string; // comment text (gerekirse)
}

const ENTRY_CONFIG: Record<TimelineEntryType, {
  icon: React.ReactNode;
  label: string;
  iconBg: string;
}> = {
  submitted: {
    icon: <Upload size={14} />,
    label: "Teslim edildi",
    iconBg: "bg-blue-100 text-blue-600",
  },
  comment: {
    icon: <MessageCircle size={14} />,
    label: "Yorum",
    iconBg: "bg-surface-100 text-surface-600",
  },
  revision_needed: {
    icon: <AlertTriangle size={14} />,
    label: "Revizyon istendi",
    iconBg: "bg-orange-100 text-orange-600",
  },
  resubmitted: {
    icon: <RefreshCw size={14} />,
    label: "Yeniden teslim",
    iconBg: "bg-blue-100 text-blue-600",
  },
  approved: {
    icon: <CheckCircle2 size={14} />,
    label: "Onaylandı",
    iconBg: "bg-emerald-100 text-emerald-600",
  },
};

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(date));
}

interface Props {
  submissionId: string;
  /** Map authorId → ad soyad (parent'tan geçirilir) */
  authorNames?: Record<string, string>;
}

export default function SubmissionTimeline({ submissionId, authorNames = {} }: Props) {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(
      collection(db, "submission_timeline"),
      where("submissionId", "==", submissionId),
      orderBy("createdAt", "asc"),
    );

    const unsub = onSnapshot(q, snap => {
      setEntries(snap.docs.map(d => {
        const data = d.data();
        return {
          id:       d.id,
          type:     data.type as TimelineEntryType,
          authorId: data.authorId,
          createdAt: data.createdAt?.toDate?.() ?? new Date(),
          data:     data.data ?? {},
          text:     data.text,
        };
      }));
      setLoading(false);
    });

    return () => unsub();
  }, [submissionId]);

  // Yeni entry gelince en alta scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-surface-400">
        <Loader2 size={18} className="animate-spin" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="py-8 text-center text-[13px] text-surface-400">
        Henüz aktivite yok
      </div>
    );
  }

  return (
    <div className="relative space-y-0">
      {entries.map((entry, idx) => {
        const cfg = ENTRY_CONFIG[entry.type] ?? ENTRY_CONFIG.comment;
        const isLast = idx === entries.length - 1;
        const authorName = authorNames[entry.authorId] ?? "—";

        return (
          <div key={entry.id} className="flex gap-4">
            {/* Sol: ikon + çizgi */}
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${cfg.iconBg}`}>
                {cfg.icon}
              </div>
              {!isLast && <div className="w-px flex-1 bg-surface-100 my-1" />}
            </div>

            {/* Sağ: içerik */}
            <div className={`flex-1 ${isLast ? "pb-0" : "pb-4"}`}>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-[13px] font-bold text-text-primary">{cfg.label}</span>
                <span className="text-[11px] text-surface-400">{authorName}</span>
                <span className="text-[11px] text-surface-300">·</span>
                <span className="text-[11px] text-surface-400">{formatTime(entry.createdAt)}</span>
              </div>
              {entry.text && (
                <div className="mt-1.5 px-3 py-2 bg-surface-50 rounded-xl border border-surface-100">
                  <p className="text-[13px] text-text-secondary leading-relaxed">{entry.text}</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
