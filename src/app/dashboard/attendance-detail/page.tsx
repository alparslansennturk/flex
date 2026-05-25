"use client";

import React, { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, db } from "../../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import Header from "../../components/layout/Header";
import Sidebar from "../../components/layout/Sidebar";
import Footer from "../../components/layout/Footer";
import AttendanceDetailContent from "../../components/dashboard/attendance/AttendanceDetailContent";

function AttendanceReportContent() {
  const searchParams = useSearchParams();
  const filterInstructorId = searchParams.get("instructorId");
  const filterGroupId = searchParams.get("groupId");
  const monthParam = searchParams.get("month");
  const ref = searchParams.get("ref");
  const router = useRouter();

  const backUrl = ref === "attendance"
    ? `/dashboard/attendance?groupId=${filterGroupId}`
    : filterInstructorId
      ? "/dashboard/attendance-report"
      : null;
  const backLabel = ref === "attendance" ? "Yoklama Al" : "Rapor";

  return (
    <AttendanceDetailContent
      initialGroupId={filterGroupId ?? undefined}
      initialInstructorId={filterInstructorId ?? undefined}
      initialMonth={monthParam ?? undefined}
      onBack={backUrl ? () => router.push(backUrl) : undefined}
      backLabel={backLabel}
    />
  );
}

// ── Sayfa ─────────────────────────────────────────────────────────────────────
export default function AttendanceReportPage() {
  const router = useRouter();

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
    <div className="flex h-screen w-full bg-white font-inter overflow-hidden">
      <aside className="hidden lg:block h-full shrink-0 z-50 w-[280px] 2xl:w-[320px] bg-[#10294C]">
        <Sidebar />
      </aside>
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <Header activeTabLabel="Yoklama Detay" />
        <main className="flex-1 min-h-0 bg-white overflow-y-auto [scrollbar-gutter:stable]">
          <Suspense fallback={
            <div className="flex items-center justify-center h-full">
              <div className="w-7 h-7 border-2 border-surface-100 border-t-base-primary-500 rounded-full animate-spin" />
            </div>
          }>
            <AttendanceReportContent />
          </Suspense>
        </main>
        <Footer />
      </div>
    </div>
  );
}
