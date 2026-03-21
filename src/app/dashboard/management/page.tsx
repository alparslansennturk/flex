"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import Header from "../../components/layout/Header";
import Sidebar from "../../components/layout/Sidebar";
import Footer from "../../components/layout/Footer";
import ManagementContent from "../../components/dashboard/ManagementContent";

export default function ManagementPage() {
  const [activeTab, setActiveTab] = useState('management');
  const [headerTitle, setHeaderTitle] = useState("Eğitim Yönetimi");

  // BEKÇİ İÇİN EKLEDİĞİMİZ KISIM
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    const checkAdmin = async () => {
      const user = auth.currentUser;

      if (!user) {
        router.push("/login");
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const data = userDoc.exists() ? userDoc.data() : null;

        // 🛡️ Hem eski 'role' (string) hem yeni 'roles' (array) kontrolü
        const hasAccess = data && (
          data.role === "admin" ||
          data.role === "instructor" ||
          (data.roles && (data.roles.includes("admin") || data.roles.includes("instructor")))
        );

        if (hasAccess) {
          setIsAdmin(true);
        } else {
          router.push("/dashboard");
        }
      } catch (error) {
        console.error("Yetki hatası:", error);
        router.push("/dashboard");
      }
    };

    checkAdmin();
  }, [router]);

  // Yükleme sırasında (kontrol sürerken) boş ekran veya loading göster
  if (isAdmin === null) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // BURADAN AŞAĞISI SENİN ORİJİNAL KODUN (HİÇ DOKUNULMADI)
  return (
    <div className="flex h-screen w-full bg-white font-inter overflow-hidden">
      <div className="h-full shrink-0">
        <Sidebar />
      </div>

      <div className="flex-1 flex flex-col min-w-0 h-full">
        <Header activeTabLabel={headerTitle} />

        <main className="flex-1 overflow-y-auto bg-surface-50/20 [scrollbar-gutter:stable]">
          <div className="w-full max-w-[1920px] mx-auto">
            <ManagementContent setHeaderTitle={setHeaderTitle} />
          </div>
        </main>

        <Footer />
      </div>
    </div>
  );
}