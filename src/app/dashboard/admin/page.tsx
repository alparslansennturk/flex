"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import Header from "../../components/Header";
import Sidebar from "../../components/Sidebar";
import Footer from "../../components/Footer";
import SubNavigation from "../../components/dashboard/SubNavigation";
import UserManagement from "../../components/dashboard/UserManagement";
import TaskManagementPanel from "../../components/dashboard/TaskManagementPanel";

export default function AdminPage() {
  const [headerTitle, setHeaderTitle] = useState("Yönetim Paneli");
  const [activeSubTab, setActiveSubTab] = useState("general");
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    const checkAdmin = async () => {
      const user = auth.currentUser;
      if (!user) { router.push("/login"); return; }
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const data = userDoc.exists() ? userDoc.data() : null;
        const hasAccess = data && (
          data.role === "admin" ||
          (data.roles && data.roles.includes("admin")) ||
          data.permissionOverrides?.MANAGEMENT_PANEL === true
        );
        if (hasAccess) {
          setIsAdmin(true);
        } else {
          router.push("/dashboard");
        }
      } catch {
        router.push("/dashboard");
      }
    };
    checkAdmin();
  }, [router]);

  useEffect(() => {
    const labels: Record<string, string> = {
      users: "Kullanıcı Yönetimi",
      "task-management": "Ödev Yönetimi",
    };
    setHeaderTitle(labels[activeSubTab] || "Yönetim Paneli");
  }, [activeSubTab]);

  if (isAdmin === null) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-base-primary-600" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-white font-inter overflow-hidden">
      <div className="h-full shrink-0"><Sidebar /></div>
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <Header activeTabLabel={headerTitle} />
        <main className="flex-1 overflow-y-auto bg-surface-50/20 [scrollbar-gutter:stable]">
          <div className="w-full max-w-[1920px] mx-auto">
            <SubNavigation activeTab={activeSubTab} onTabChange={setActiveSubTab} />
            {activeSubTab === "users" && <UserManagement />}
            {activeSubTab === "task-management" && <TaskManagementPanel />}
          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
}
