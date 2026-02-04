"use client";

import React, { useState } from "react";
import Header from "../../components/Header"; 
import Sidebar from "../../components/Sidebar"; 
import Footer from "../../components/Footer";
import ManagementContent from "../../components/dashboard/ManagementContent";

export default function ManagementPage() {
  const [activeTab, setActiveTab] = useState('management');
  // Dinamik başlık için state ekledik
  const [headerTitle, setHeaderTitle] = useState("Eğitim Yönetimi");

  return (
    <div className="flex h-screen w-full bg-white font-inter overflow-hidden">
      <div className="h-full shrink-0">
        <Sidebar />
      </div>

      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Header artık dinamik başlığı page.tsx'ten alıyor */}
        <Header activeTabLabel={headerTitle} />

        <main className="flex-1 overflow-y-scroll bg-surface-50/20">
          <div className="w-full max-w-[1920px] mx-auto">
             {/* ManagementContent başlığı değiştirme yetkisine sahip oldu */}
             <ManagementContent setHeaderTitle={setHeaderTitle} />
          </div>
        </main>

        <Footer />
      </div>
    </div>
  );
}