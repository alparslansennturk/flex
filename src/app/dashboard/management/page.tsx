"use client";

import React, { useState } from "react";
// Klasör yapına göre yolları kontrol et (layout yok demiştin, doğrudan components altı)
import Header from "../../components/Header"; 
import Sidebar from "../../components/Sidebar"; 
import Footer from "../../components/Footer";
import ManagementContent from "../../components/dashboard/ManagementContent";

export default function ManagementPage() {
  // Sidebar ve genel navigasyon için activeTab
  const [activeTab, setActiveTab] = useState('management');

  return (
    // h-screen ve overflow-hidden ile ekranın dışına taşmayı ve Sidebar'ın kısalmasını engelliyoruz
    <div className="flex h-screen w-full bg-white font-inter overflow-hidden">
      
      {/* SIDEBAR: h-full ile boyunu tam ekran yapıyoruz */}
      <div className="h-full shrink-0">
        <Sidebar />
      </div>

      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* HEADER: En üste çivilendi */}
        <Header />

        {/* ANA İÇERİK ALANI: Kaydırma sadece burada olacak */}
        <main className="flex-1 overflow-y-auto bg-surface-50/20 px-8 2xl:px-12 py-8">
          <div className="w-full max-w-[1920px] mx-auto">
             {/* Senin o jilet gibi olan ManagementContent buraya oturuyor */}
             <ManagementContent />
          </div>
        </main>

        {/* FOOTER: En alta çivilendi */}
        <Footer />
      </div>
    </div>
  );
}