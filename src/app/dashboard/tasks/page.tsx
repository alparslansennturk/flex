"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import Header from "../../components/Header";
import Sidebar from "../../components/Sidebar";
import Footer from "../../components/Footer";
import TasksContent from "../../components/dashboard/TasksContent";

export default function TasksPage() {
  const [headerTitle, setHeaderTitle] = useState("Ödev Yönetimi");
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);
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
        if (hasAccess) setIsAllowed(true);
        else router.push("/dashboard");
      } catch {
        router.push("/dashboard");
      }
    };
    checkAccess();
  }, [router]);

  if (isAllowed === null) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-base-primary-500" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-white font-inter overflow-hidden">
      <div className="h-full shrink-0">
        <Sidebar />
      </div>
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <Header activeTabLabel={headerTitle} />
        <main className="flex-1 overflow-y-scroll bg-surface-50/20">
          <div className="w-full max-w-[1920px] mx-auto">
            <TasksContent />
          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
}
