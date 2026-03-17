"use client";

import React, { useState } from "react";
import { Trophy } from "lucide-react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import Footer from "../../components/Footer";

export default function LeaguePage() {
  const [activeTab, setActiveTab] = useState("league");

  return (
    <div className="flex h-screen overflow-hidden bg-[#F9FAFB] font-inter antialiased text-text-primary">

      {/* Sidebar */}
      <aside className="hidden lg:block h-full shrink-0 z-50 transition-all duration-300 w-[280px] 2xl:w-[320px] bg-[#10294C]">
        <Sidebar />
      </aside>

      {/* İçerik */}
      <div className="flex-1 flex flex-col min-w-0 relative h-full">
        <Header />

        <main className="flex-1 w-full overflow-y-auto overflow-x-clip [scrollbar-gutter:stable]">
          <div className="w-[94%] mx-auto py-8 max-w-[1280px] xl:max-w-[1600px] 2xl:max-w-[1920px]">

            {/* Başlık */}
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-[#FF8D28]/10 flex items-center justify-center">
                <Trophy size={20} className="text-[#FF8D28]" />
              </div>
              <div>
                <h1 className="text-[22px] font-bold text-[#10294C]">Sınıflar Ligi</h1>
                <p className="text-[13px] text-[#8E95A3] font-medium">Tüm öğrencilerin puan sıralaması</p>
              </div>
            </div>

            {/* İçerik alanı — henüz boş */}
            <div className="bg-white rounded-24 border border-surface-200 shadow-sm min-h-[500px] flex flex-col items-center justify-center gap-4 p-12">
              <Trophy size={48} className="text-[#E2E5EA]" />
              <p className="text-[15px] font-semibold text-[#AEB4C0] text-center">
                Lig tablosu yakında burada olacak
              </p>
              <p className="text-[13px] text-[#C5C9D1] text-center max-w-[320px]">
                Tüm öğrencilerin detaylı sıralaması, haftalık değişimler ve istatistikler bu sayfada görünecek.
              </p>
            </div>

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
