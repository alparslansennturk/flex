"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Bell, BellOff, Megaphone,
  ClipboardList, AlertCircle, MessageSquare, ChevronRight,
} from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { useUser } from "@/app/context/UserContext";
import { useNotifications } from "@/app/hooks/useNotifications";
import type { NotificationPayload } from "@/app/lib/notifications/types";

/* ── Helpers ── */
function relTime(ts: Timestamp): string {
  const m = Math.floor((Date.now() - ts.toMillis()) / 60000);
  if (m < 60) return `${m} Dk. Önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} Sa. Önce`;
  return `${Math.floor(h / 24)} Gün Önce`;
}

function fmtDate(ts: Timestamp): string {
  const d = ts.toDate();
  const dd = d.getDate().toString().padStart(2, "0");
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
}

/* ── Type → görsel mapping ── */
type NotifType = NotificationPayload["type"];

const TYPE_CONFIG: Record<NotifType, {
  Icon: React.ElementType;
  bg: string;
  color: string;
  titleColor: string;
}> = {
  system: {
    Icon: AlertCircle,
    bg: "bg-status-danger-50",
    color: "text-status-danger-500",
    titleColor: "text-status-danger-500",
  },
  announcement: {
    Icon: Megaphone,
    bg: "bg-base-primary-50",
    color: "text-base-primary-600",
    titleColor: "text-text-primary",
  },
  assignment: {
    Icon: ClipboardList,
    bg: "bg-designstudio-primary-50",
    color: "text-designstudio-primary-600",
    titleColor: "text-text-primary",
  },
  message: {
    Icon: MessageSquare,
    bg: "bg-base-secondary-50",
    color: "text-base-secondary-600",
    titleColor: "text-text-primary",
  },
};

/* ── Component ── */
export default function NotificationBell() {
  const { user } = useUser();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { notifications, unreadCount, markAsRead, clearAll } = useNotifications(user?.uid);

  /* ── Dışarı tıklayınca kapat ── */
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  /* ── Bildirime tıklama: optimistic markAsRead + navigate ── */
  function handleNotifClick(n: NotificationPayload) {
    if (!n.isRead) markAsRead(n.id);   // optimistic — badge anında düşer
    setOpen(false);
    if (n.actionUrl && n.actionUrl !== "/") router.push(n.actionUrl);
  }

  return (
    <div className="relative" ref={ref}>

      {/* ── Bell button ── */}
      <button
        onClick={() => setOpen(v => !v)}
        className="relative text-neutral-900 cursor-pointer hover:text-base-primary-500 transition-colors"
        aria-label="Bildirimler"
      >
        <Bell size={24} />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-status-danger-500 text-white text-[11px] flex items-center justify-center rounded-full font-bold border-2 border-white leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <>
          <div
            className="fixed inset-0 bg-black/25 z-40 animate-in fade-in duration-200"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-[-37px] top-[calc(100%+14px)] w-[400px] 2xl:w-[440px] h-[220px] 2xl:h-[260px] bg-white rounded-xl shadow-xl border border-surface-100 z-50 animate-in fade-in slide-in-from-top-2 duration-200 flex flex-col">

            {/* Speech bubble tail — gövde 16px sağa kaydı, triangle 16px kompanse edildi (24+16=40) */}
            <div className="absolute -top-[9px] right-[40px] w-[18px] h-[18px] bg-white border-l border-t border-surface-100 rotate-45" />

            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-surface-100">
              <span className="text-[16px] 2xl:text-[18px] text-text-primary" style={{ fontWeight: 630 }}>
                Bildirimler
              </span>
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-[12px] 2xl:text-[13px] font-semibold text-base-primary-600 hover:text-base-primary-700 transition-colors cursor-pointer"
                >
                  Hepsi Okundu
                </button>
              )}
            </div>

            {/* Empty state */}
            {notifications.length === 0 ? (
              <div className="flex-1 flex items-center justify-center mx-6 mb-8">
                <p className="text-[13px] 2xl:text-[14px] text-text-tertiary text-center">
                  Şu anda herhangi bir bildirim bulunmuyor.
                </p>
              </div>
            ) : (
              /* Notification list */
              <div
                className="flex-1 overflow-y-auto overflow-x-hidden mx-6 mt-4 mb-6"
                style={{ scrollbarWidth: "thin", scrollbarColor: "#d3d8df #f2f2f2" }}
              >
                {notifications.map((n, i) => {
                  const { Icon, bg, color, titleColor } = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.announcement;
                  return (
                    <div key={n.id}>
                      {i > 0 && <div className="h-px bg-surface-200 my-3" />}
                      <div
                        onClick={() => handleNotifClick(n)}
                        className="group flex items-start gap-3 cursor-pointer rounded-lg px-2 py-1.5 -mx-2 transition-colors hover:bg-surface-50"
                      >
                        {/* Icon */}
                        <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${bg}`}>
                          <Icon size={20} className={color} />
                        </div>
                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[11px] 2xl:text-[12px] font-semibold text-text-tertiary">
                              {n.createdAt ? fmtDate(n.createdAt) : "—"}
                            </span>
                            <span className="text-[11px] 2xl:text-[12px] text-text-tertiary leading-none">•</span>
                            <span className="text-[11px] 2xl:text-[12px] font-semibold text-text-tertiary">
                              {n.createdAt ? relTime(n.createdAt) : ""}
                            </span>
                          </div>
                          <p className={`text-[14px] 2xl:text-[15px] leading-snug mb-1 ${titleColor}`} style={{ fontWeight: 630 }}>
                            {n.title}
                          </p>
                          <p className="text-[13px] 2xl:text-[14px] text-text-secondary leading-relaxed" style={{ fontWeight: 450 }}>
                            {n.preview}
                          </p>
                        </div>
                        {/* Hover arrow */}
                        <ChevronRight
                          size={14}
                          className="shrink-0 mt-1 text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
