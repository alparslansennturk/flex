"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import Header from "../../components/Header";
import Sidebar from "../../components/Sidebar";
import Footer from "../../components/Footer";
import TaskManagementPanel from "../../components/dashboard/TaskManagementPanel";

export default function TasksPage() {
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
          (data.roles && data.roles.includes("admin"))
        );
        if (!hasAccess) router.push("/dashboard");
      } catch {
        router.push("/dashboard");
      }
    };
    checkAccess();
  }, [router]);

  return (
    <div className="flex h-screen w-full bg-white font-inter overflow-hidden">
      <div className="h-full shrink-0">
        <Sidebar />
      </div>
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <Header activeTabLabel="Ödev Yönetimi" />
        <main className="flex-1 overflow-y-auto bg-surface-50/20 [scrollbar-gutter:stable]">
          <div className="w-full max-w-480 mx-auto pb-20">
            <div className="px-0 pt-8">
              <TaskManagementPanel />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
}
