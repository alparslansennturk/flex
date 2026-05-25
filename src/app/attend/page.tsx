"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AttendancePanel from "../components/dashboard/attendance/AttendancePanel";
import { useUser } from "../context/UserContext";
import { motion } from "framer-motion";

const T = { type: "tween" as const, duration: 0.3, ease: [0.4, 0, 0.2, 1] as const };

const PANEL_SHADOW = { boxShadow: "-8px 0 24px rgba(0,0,0,0.08)" };

export default function AttendPage() {
  const router = useRouter();
  const { user, loading } = useUser();
  const [ready, setReady]               = useState(false);
  const [showDetail, setShowDetail]     = useState(false);
  const [detailGroupId, setDetailGroupId] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.push("/login"); return; }
    const isAuthorized =
      user.roles?.includes("admin") ||
      user.roles?.includes("instructor");
    if (!isAuthorized) { router.push("/dashboard"); return; }
    setReady(true);
  }, [loading, user, router]);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="w-7 h-7 border-2 border-surface-200 border-t-base-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  const avatarUrl = `/avatars/${user?.gender ?? "male"}/${user?.avatarId ?? 1}.svg`;
  const fullName  = [user?.name, user?.surname].filter(Boolean).join(" ");

  const topBar = (onArrow: () => void) => (
    <div className="h-[64px] shrink-0 border-b border-surface-100 bg-white">
      <div className="max-w-[1920px] mx-auto h-full flex">
        <div className="w-[260px] shrink-0 flex items-center gap-4 px-5 bg-neutral-50 border-r border-surface-100">
          <button
            onClick={onArrow}
            className="w-10 h-10 rounded-xl hover:bg-surface-200 flex items-center justify-center text-surface-400 transition-colors cursor-pointer active:scale-95 shrink-0"
          >
            <ArrowLeft size={20} />
          </button>
          <Link href="/dashboard" className="flex items-center select-none">
            <span className="text-[22px] font-semibold text-[#FF8D28]">tasarım</span>
            <span className="text-[22px] font-bold text-base-primary-900">atölyesi</span>
          </Link>
        </div>
        <div className="flex-1 min-w-0 max-w-[1400px] flex items-center justify-end px-8">
          <div className="flex items-center gap-3">
            {fullName && (
              <span className="text-[13px] font-semibold text-text-secondary">{fullName}</span>
            )}
            <img src={avatarUrl} alt="" className="w-9 h-9 rounded-full bg-surface-100 object-cover shrink-0" />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative w-full h-screen overflow-hidden bg-neutral-50">

      {/* ── Yoklama Al ───────────────────────────────────────────────────── */}
      <motion.div
        animate={{ x: showDetail ? "-100%" : 0 }}
        transition={T}
        style={PANEL_SHADOW}
        className="absolute inset-0 flex flex-col bg-white"
      >
        {topBar(() => router.push("/dashboard"))}
        <main className="flex-1 overflow-y-auto">
          <AttendancePanel
            mode="simple"
            autoSelectToday
            enforceTimeWindow
            onViewDetail={(gid) => { setDetailGroupId(gid); setShowDetail(true); }}
          />
        </main>
      </motion.div>

      {/* ── Yoklama Detay: sağdan gelir ──────────────────────────────────── */}
      <motion.div
        initial={false}
        animate={{ x: showDetail ? 0 : "100%" }}
        transition={T}
        style={PANEL_SHADOW}
        className="absolute inset-0 flex flex-col bg-white"
      >
        {topBar(() => setShowDetail(false))}
        <main className="flex-1 overflow-y-auto">
          {detailGroupId && (
            <AttendancePanel
              preSelectedGroupId={detailGroupId}
              allowEdit={true}
              enforceTimeWindow={true}
            />
          )}
        </main>
      </motion.div>

    </div>
  );
}
