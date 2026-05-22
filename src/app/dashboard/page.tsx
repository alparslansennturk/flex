"use client";

import { useRef, useState, useEffect } from "react";
import { useUser } from "@/app/context/UserContext"; // Motoru bağladık
import { PERMISSIONS } from "@/app/lib/constants"; // Kuralları getirdik
import { useRouter } from "next/navigation";

import Sidebar from "../components/layout/Sidebar";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";

import WorkshopAnalysis from "../components/dashboard/scoring/WorkshopAnalysis";
import LeaderboardWidget from "../components/dashboard/scoring/LeaderboardWidget";
import DesignParkour from "../components/dashboard/scoring/DesignParkour";
import AssignmentLibrary from "../components/dashboard/assignment/AssignmentLibrary";

export default function DashboardPage() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { hasPermission, user, loading } = useUser(); // loading'i buraya ekledik
  const router = useRouter(); // router'ı burada tanımladık
  const [activeTab, setActiveTab] = useState<'dashboard' | 'management'>('dashboard');
  const [viewMode, setViewMode] = useState<'Sınıflarım' | 'Şubem' | 'Tümü'>('Tümü');
  const handleScroll = (dir: 'left' | 'right') => {
    if (scrollRef.current) {
      const amt = scrollRef.current.offsetWidth / 4.3;
      scrollRef.current.scrollBy({ left: dir === 'left' ? -amt : amt, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handleScroll('left');
      else if (e.key === "ArrowRight") handleScroll('right');
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (loading || !user) return null;

  return (
    <>
<div className="flex h-screen overflow-hidden bg-[#F9FAFB] font-inter antialiased text-text-primary">

      {/* SOL: SIDEBAR (Zaten kendi içinde yetki kontrolü yapıyor) */}
      <aside className="hidden lg:block h-full shrink-0 z-50 transition-all duration-300 w-[280px] 2xl:w-[320px] bg-[#10294C]">
        <Sidebar />
      </aside>

      {/* SAĞ: CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 relative h-full">
        <Header />

        <main className="flex-1 w-full overflow-y-scroll overflow-x-clip [scrollbar-gutter:stable]">
          <div className="w-[94%] mx-auto pt-6 pb-8 max-w-[1280px] xl:max-w-[1600px] 2xl:max-w-[1920px]">

            {activeTab === 'dashboard' ? (
              <div className="space-y-12">
                <div className="grid grid-cols-12 gap-6 items-stretch">
                  <WorkshopAnalysis />
                  <LeaderboardWidget viewMode={viewMode} setViewMode={setViewMode} />
                </div>

                <DesignParkour />

                {/* 🛡️ KÜTÜPHANE GÖRÜNÜMÜ: Adminler yönetir, Eğitmenler (instructor) kullanır/görür. */}
                {(hasPermission(PERMISSIONS.ASSIGNMENT_MANAGE) || user?.roles?.includes('instructor')) && (
                  <AssignmentLibrary scrollRef={scrollRef} handleScroll={handleScroll} />
                )}
              </div>
            ) : (
              <div className="bg-white rounded-24 p-12 border border-surface-200 min-h-[500px] flex items-center justify-center ui-title-md text-base-primary-900">
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
    </>
  );
}