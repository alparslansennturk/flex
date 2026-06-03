"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, db } from "../../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { motion } from "framer-motion";
import Header from "../../components/layout/Header";
import Sidebar from "../../components/layout/Sidebar";
import Footer from "../../components/layout/Footer";
import AttendanceDetailContent from "../../components/dashboard/attendance/AttendanceDetailContent";
import AttendancePanel from "../../components/dashboard/attendance/AttendancePanel";

const T = { type: "tween" as const, duration: 0.3, ease: [0.4, 0, 0.2, 1] as const };

// useSearchParams gerektirdiği için Suspense içinde — back URL + tüm sayfa içeriği burada
function AttendanceDetailMain() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const filterInstructorId = searchParams.get("instructorId");
  const filterGroupId      = searchParams.get("groupId");
  const monthParam         = searchParams.get("month");
  const ref                = searchParams.get("ref");

  const [showGroupDetail, setShowGroupDetail] = useState(false);
  const [detailGroupId, setDetailGroupId]     = useState<string | null>(null);
  const [detailMonth, setDetailMonth]         = useState<string | null>(null);

  const backUrl = ref === "attendance"
    ? `/dashboard/attendance?groupId=${filterGroupId}`
    : null;

  useEffect(() => {
    const checkAccess = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) { router.push("/login"); return; }
      try {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        const data = userDoc.exists() ? userDoc.data() : null;
        const hasAccess = data && (
          data.role === "admin" || data.role === "instructor" ||
          (data.roles && (data.roles.includes("admin") || data.roles.includes("instructor")))
        );
        if (!hasAccess) router.push("/dashboard");
      } catch { router.push("/dashboard"); }
    };
    checkAccess();
  }, [router]);

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full">
      <Header
        activeTabLabel="Yoklama Detay"
        innerClassName="w-full max-w-[1300px] xl:max-w-[1440px] 2xl:max-w-[1620px] px-4 sm:px-6 lg:px-8"
        onBack={showGroupDetail ? () => setShowGroupDetail(false) : undefined}
      />
      <main className="flex-1 min-h-0 relative overflow-hidden">

        {/* ── Liste paneli — sola gider ── */}
        <motion.div
          animate={{ x: showGroupDetail ? "-100%" : 0 }}
          transition={T}
          className="absolute inset-0 overflow-y-auto bg-white [scrollbar-gutter:stable]"
        >
          <AttendanceDetailContent
            initialGroupId={filterGroupId ?? undefined}
            initialInstructorId={filterInstructorId ?? undefined}
            initialMonth={monthParam ?? undefined}
            onGroupDetail={(gid, month) => { setDetailGroupId(gid); setDetailMonth(month); setShowGroupDetail(true); }}
          />
        </motion.div>

        {/* ── Grup detay paneli — sağdan gelir ── */}
        <motion.div
          initial={false}
          animate={{ x: showGroupDetail ? 0 : "100%" }}
          transition={T}
          className="absolute inset-0 overflow-y-auto bg-white"
        >
          {detailGroupId && (
            <AttendancePanel
              preSelectedGroupId={detailGroupId}
              allowEdit={true}
              enforceTimeWindow={true}
              filterMonth={detailMonth ?? monthParam ?? undefined}
            />
          )}
        </motion.div>

      </main>
      <Footer />
    </div>
  );
}

// ── Sayfa ─────────────────────────────────────────────────────────────────────
export default function AttendanceReportPage() {
  return (
    <div className="flex h-screen w-full bg-white font-inter overflow-hidden">
      <aside className="hidden lg:block h-full shrink-0 z-50 w-[280px] 2xl:w-[320px] bg-[#10294C]">
        <Sidebar />
      </aside>
      <Suspense fallback={
        <div className="flex-1 flex items-center justify-center bg-white">
          <div className="w-7 h-7 border-2 border-surface-100 border-t-base-primary-500 rounded-full animate-spin" />
        </div>
      }>
        <AttendanceDetailMain />
      </Suspense>
    </div>
  );
}
