"use client";

import React, { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, db } from "../../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import Header from "../../components/layout/Header";
import Sidebar from "../../components/layout/Sidebar";
import Footer from "../../components/layout/Footer";
import AttendancePanel from "../../components/dashboard/attendance/AttendancePanel";
import { ChevronLeft } from "lucide-react";

function AttendanceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const groupId = searchParams.get("groupId") ?? undefined;
  const ref = searchParams.get("ref");

  return (
    <>
      {ref === "attend" && (
        <div className="px-6 pt-4 pb-0">
          <button
            onClick={() => router.push("/attend")}
            className="flex items-center gap-1 text-[13px] text-surface-400 hover:text-base-primary-700 transition-colors"
          >
            <ChevronLeft size={16} /> Yoklama Al
          </button>
        </div>
      )}
      <AttendancePanel
        preSelectedGroupId={groupId}
        allowEdit={true}
        enforceTimeWindow={true}
        onViewDetail={(gid, month) =>
          router.push(`/dashboard/attendance-detail?groupId=${gid}&month=${month}&ref=attendance`)
        }
      />
    </>
  );
}

export default function AttendancePage() {
  const router = useRouter();

  useEffect(() => {
    const checkAccess = async () => {
      const user = auth.currentUser;
      if (!user) { router.push("/login"); return; }
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const data = userDoc.exists() ? userDoc.data() : null;
        const hasAccess = data && (
          data.role === "admin" ||
          data.role === "instructor" ||
          (data.roles && (data.roles.includes("admin") || data.roles.includes("instructor")))
        );
        if (!hasAccess) router.push("/dashboard");
      } catch {
        router.push("/dashboard");
      }
    };
    checkAccess();
  }, [router]);

  return (
    <div className="flex min-h-screen w-full bg-white font-inter">
      <aside className="hidden lg:block sticky top-0 h-screen shrink-0 z-50 w-[280px] 2xl:w-[320px] bg-[#10294C]">
        <Sidebar />
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <Header activeTabLabel="Yoklama Al" />
        <main className="flex-1 bg-white">
          <Suspense fallback={
            <div className="flex items-center justify-center py-24">
              <div className="w-7 h-7 border-2 border-surface-100 border-t-base-primary-500 rounded-full animate-spin" />
            </div>
          }>
            <AttendanceContent />
          </Suspense>
        </main>
        <Footer />
      </div>
    </div>
  );
}
