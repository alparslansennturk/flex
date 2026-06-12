"use client";
import FlexLogo from "@/app/components/ui/FlexLogo";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
    // Home-v2 yoklama pulse'ını söndür
    const d = new Date();
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    localStorage.setItem(`attend_dismissed_${key}`, "1");
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
      <div className="w-full max-w-[1300px] xl:max-w-[1440px] 2xl:max-w-[1620px] mx-auto h-full flex pl-4 sm:pl-6 lg:pl-8">
        <div className="w-[260px] shrink-0 flex items-center px-6 bg-neutral-50 border-r border-surface-100">
          <Link href="/dashboard" className="select-none">
            <FlexLogo variant="dark" />
          </Link>
        </div>
        <div className="flex-1 min-w-0 flex items-center justify-end px-8">
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
            allowEdit
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
              onBackToAttend={() => setShowDetail(false)}
            />
          )}
        </main>
      </motion.div>

    </div>
  );
}
