"use client";

import React, { useRef, useState, useEffect } from "react";
import { useUser } from "@/app/context/UserContext"; // Motoru bağladık
import { PERMISSIONS } from "@/app/lib/constants"; // Kuralları getirdik

import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import Footer from "../components/Footer";

import WorkshopAnalysis from "../components/dashboard/WorkshopAnalysis";
import LeaderboardWidget from "../components/dashboard/LeaderboardWidget";
import DesignParkour from "../components/dashboard/DesignParkour";
import AssignmentLibrary from "../components/dashboard/AssignmentLibrary";

export default function DashboardPage() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { hasPermission } = useUser(); // Yetki kontrol mekanizması
  const [activeTab, setActiveTab] = useState<'dashboard' | 'management'>('dashboard');
  const [viewMode, setViewMode] = useState<'Sınıflarım' | 'Şubem' | 'Tümü'>('Sınıflarım');

  const handleScroll = (dir: 'left' | 'right') => {
    if (scrollRef.current) {
      const amt = scrollRef.current.offsetWidth / 4.3; 
      scrollRef.current.scrollBy({ left: dir === 'left' ? -amt : amt, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handleScroll('left');
      else if (e.key === "ArrowRight") handleScroll('right');
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="flex min-h-screen bg-[#F9FAFB] font-inter antialiased text-text-primary">
      
      {/* SOL: SIDEBAR (Zaten kendi içinde yetki kontrolü yapıyor) */}
      <aside className="hidden lg:block h-screen sticky top-0 shrink-0 z-50 transition-all duration-300 w-[280px] 2xl:w-[320px] bg-[#10294C]">
        <Sidebar />
      </aside>
      
      {/* SAĞ: CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        <Header />
        
        <main className="flex-1 w-full overflow-x-hidden">
          <div className="w-[94%] mx-auto py-8 transition-all duration-500 max-w-[1280px] xl:max-w-[1600px] 2xl:max-w-[1920px]">
            
            {activeTab === 'dashboard' ? (
              <div className="space-y-12">
                <div className="grid grid-cols-12 gap-6 items-stretch">
                  <WorkshopAnalysis />
                  <LeaderboardWidget viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                
                <DesignParkour />

                {/* 🛡️ KRİTİK KALKAN: Ödev Yönetimi Yetkisi Yoksa Bu Bölüm Hiç Render Edilmez */}
                {hasPermission(PERMISSIONS.ASSIGNMENT_MANAGE) && (
                  <AssignmentLibrary scrollRef={scrollRef} handleScroll={handleScroll} />
                )}
              </div>
            ) : (
              <div className="bg-white rounded-[32px] p-12 border border-surface-200 min-h-[500px] flex items-center justify-center ui-title-md text-base-primary-900">
                Yönetim Paneli İçeriği
              </div>
            )}
          </div>
        </main>

        <Footer setActiveTab={setActiveTab} />
      </div>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}