"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import Header from "../../components/layout/Header";
import Sidebar from "../../components/layout/Sidebar";
import Footer from "../../components/layout/Footer";
import SubNavigation from "../../components/layout/SubNavigation";
import UserManagement from "../../components/dashboard/user-management/UserManagement";
import TaskManagementPanel from "../../components/dashboard/assignment/TaskManagementPanel";
import SystemPanel from "../../components/dashboard/admin/SystemPanel";
import NotificationPanel from "../../components/dashboard/admin/NotificationPanel";

export default function AdminPage() {
  const [headerTitle, setHeaderTitle] = useState("Yönetim Paneli");
  const [activeSubTab, setActiveSubTab] = useState<string>(() =>
    typeof window !== "undefined"
      ? (sessionStorage.getItem("admin_active_tab") ?? "general")
      : "general"
  );
  const [isAdmin, setIsAdmin]           = useState<boolean | null>(null);
  const [userRole, setUserRole]         = useState<string>("admin");
  const [currentUid, setCurrentUid]     = useState<string>("");
  const router = useRouter();

  useEffect(() => {
    const checkAdmin = async () => {
      const user = auth.currentUser;
      if (!user) { router.push("/login"); return; }
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const data = userDoc.exists() ? userDoc.data() : null;
        const role: string = data?.role || data?.roles?.[0] || "";

        const isAdminRole = role === "admin" ||
          (data?.roles && data.roles.includes("admin")) ||
          data?.permissionOverrides?.MANAGEMENT_PANEL === true;
        const isInstructorRole = role === "instructor";

        if (isAdminRole) {
          setUserRole("admin");
          setCurrentUid(user.uid);
          setIsAdmin(true);
        } else if (isInstructorRole) {
          setUserRole("instructor");
          setCurrentUid(user.uid);
          // Eğitmen sadece bildirimler tabına erişebilir
          if (typeof window !== "undefined") {
            const saved = sessionStorage.getItem("admin_active_tab");
            if (!saved || saved !== "notifications") {
              sessionStorage.setItem("admin_active_tab", "notifications");
            }
          }
          setActiveSubTab("notifications");
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
      notifications: userRole === "instructor" ? "Bildirimler" : "Yönetim Paneli",
    };
    setHeaderTitle(labels[activeSubTab] || "Yönetim Paneli");
  }, [activeSubTab, userRole]);

  if (isAdmin === null) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-base-primary-600" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-white font-inter overflow-hidden">
      <aside className="hidden lg:block h-full shrink-0 z-50 w-[280px] 2xl:w-[320px] bg-[#10294C]"><Sidebar /></aside>
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <Header activeTabLabel={headerTitle} />
        <main className="flex-1 overflow-y-auto bg-surface-50/20 [scrollbar-gutter:stable]">
          <div className="w-full max-w-[1920px] mx-auto">
            <SubNavigation
              activeTab={activeSubTab}
              onTabChange={(tab) => { setActiveSubTab(tab); sessionStorage.setItem("admin_active_tab", tab); }}
              allowedTabs={userRole === "instructor" ? ["notifications"] : undefined}
            />
            {activeSubTab === "users" && <UserManagement />}
            {activeSubTab === "task-management" && <TaskManagementPanel />}
            {activeSubTab === "notifications" && (
              <NotificationPanel
                userRole={userRole}
                instructorUid={currentUid}
              />
            )}
            {activeSubTab === "logs" && <SystemPanel />}
          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
}
