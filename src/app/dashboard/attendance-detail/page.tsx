"use client";

import React, { useEffect, Suspense } from "react";
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

// useSearchParams gerektirdiÄŸi iÃ§in Suspense iÃ§inde â€” back URL + tÃ¼m sayfa iÃ§eriÄŸi burada
function AttendanceDetailMain() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const filterInstructorId = searchParams.get("instructorId");
  const filterGroupId      = searchParams.get("groupId");
  const monthParam         = searchParams.get("month");
  const ref                = searchParams.get("ref");

  // Panel state URL'den okunur: ?detail=groupId&detailMonth=...&detailClosed=true
  // Böylece sidebar "Yoklama Detay" linki (param yok) her zaman liste görünümüne döner.
  const detailGroupId  = searchParams.get("detail");
  const detailMonth    = searchParams.get("detailMonth");
  const detailIsClosed = searchParams.get("detailClosed") === "true";
  const showGroupDetail = !!detailGroupId;

  const buildListUrl = () => {
    const p = new URLSearchParams();
    if (filterGroupId)      p.set("groupId", filterGroupId);
    if (filterInstructorId) p.set("instructorId", filterInstructorId);
    if (monthParam)         p.set("month", monthParam);
    if (ref)                p.set("ref", ref);
    const q = p.toString();
    return `/dashboard/attendance-detail${q ? "?" + q : ""}`;
  };

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
        onBack={showGroupDetail ? () => router.push(buildListUrl()) : undefined}
      />
      <main className="flex-1 min-h-0 relative overflow-hidden">

        {/* â”€â”€ Liste paneli â€” sola gider â”€â”€ */}
        <motion.div
          animate={{ x: showGroupDetail ? "-100%" : 0 }}
          transition={T}
          className="absolute inset-0 overflow-y-auto bg-white [scrollbar-gutter:stable]"
        >
          <AttendanceDetailContent
            initialGroupId={filterGroupId ?? undefined}
            initialInstructorId={filterInstructorId ?? undefined}
            initialMonth={monthParam ?? undefined}
            onGroupDetail={(gid, month, isClosed) => {
                const p = new URLSearchParams();
                if (filterGroupId)      p.set("groupId", filterGroupId);
                if (filterInstructorId) p.set("instructorId", filterInstructorId);
                if (monthParam)         p.set("month", monthParam);
                if (ref)                p.set("ref", ref);
                p.set("detail", gid);
                p.set("detailMonth", month);
                p.set("detailClosed", String(isClosed));
                router.push(`/dashboard/attendance-detail?${p.toString()}`);
              }}
          />
        </motion.div>

        {/* â”€â”€ Grup detay paneli â€” saÄŸdan gelir â”€â”€ */}
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
              enforceTimeWindow={false}
              filterMonth={detailMonth ?? monthParam ?? undefined}
              groupMode={detailIsClosed ? "closed" : "active"}
            />
          )}
        </motion.div>

      </main>
      <Footer mini />
    </div>
  );
}

// â”€â”€ Sayfa â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

