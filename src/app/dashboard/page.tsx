"use client";

import React, { useRef, useState } from "react";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import Footer from "../components/Footer";
import ManagementPanel from "../components/ManagementPanel";
import { 
  Users, BookOpen, Trophy, Palette, Briefcase, Zap, 
  Clock, PlusCircle, Repeat, ChevronRight, ChevronLeft, 
  LibraryBig, Route, ArrowBigUpDash, ArrowBigDownDash
} from "lucide-react";

type ViewMode = 'Sınıflarım' | 'Şubem' | 'Tümü';
type ActiveTab = 'dashboard' | 'management';

export default function DashboardPage() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [viewMode, setViewMode] = useState<ViewMode>('Sınıflarım');
  const [headerConfig] = useState({ isLinkedToFlex: true, showBranchSelect: true });

  const toggleViewMode = () => {
    if (viewMode === 'Sınıflarım') setViewMode('Şubem');
    else if (viewMode === 'Şubem') setViewMode('Tümü');
    else setViewMode('Sınıflarım');
  };

  const handleScroll = (dir: 'left' | 'right') => {
    if (scrollRef.current) {
      const amt = scrollRef.current.offsetWidth / 4.3; 
      scrollRef.current.scrollBy({ left: dir === 'left' ? -amt : amt, behavior: 'smooth' });
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F4F7FB] font-inter antialiased text-text-primary overflow-x-hidden">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 lg:pl-64 flex flex-col min-h-screen w-full">
        <Header config={headerConfig} />

        <div className="p-4 md:p-8 lg:p-10 w-full max-w-[1540px] 2xl:max-w-[1700px] mx-auto space-y-8 flex-1">
          {activeTab === 'dashboard' ? (
            <>
              {/* ÜST BÖLÜM: ANALİZ VE LİG */}
              <div className="grid grid-cols-12 gap-6 items-stretch">
                <div className="col-span-12 xl:col-span-8 bg-[#10294C] rounded-[32px] p-8 text-white relative border border-white/5 shadow-lg overflow-hidden flex flex-col justify-center">
                  <span className="text-[11px] bg-white/5 px-4 py-1.5 rounded-full border border-white/10 text-[#FF8D28] font-bold uppercase tracking-wider w-fit">Atölye Analizi</span>
                  <h2 className="text-[32px] mt-4 font-bold tracking-tight leading-tight">Atölyedeki son gelişmeler ve <span className="text-[#FF8D28]">istatistikler.</span></h2>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
                    <StatBox label="Öğrenci" value="33" icon={<Users size={20} />} />
                    <StatBox label="Biten Ödev" value="12" icon={<BookOpen size={20} />} />
                    <StatBox label="Bekleyen" value="14" icon={<Clock size={20} />} />
                    <StatBox label="Ortalama" value="6.2" icon={<Zap size={20} />} />
                  </div>
                </div>

                <div className="col-span-12 xl:col-span-4 bg-white rounded-[32px] p-6 md:p-8 border border-surface-200 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-[18px] font-bold text-[#10294C] flex items-center gap-2"><Trophy size={18} className="text-[#FF8D28]" /> Sınıf Ligi</h3>
                    <button onClick={toggleViewMode} className="flex items-center gap-1.5 text-[#3A7BD5] bg-surface-50 px-3 py-1 rounded-lg border border-surface-100 cursor-pointer hover:bg-surface-100 transition-colors active:scale-95">
                      <span className="text-[12px] font-bold">{viewMode}</span>
                      <Repeat size={14} className="text-[#3A7BD5]" /> {/* İKON MAVİYE DÖNDÜ */}
                    </button>
                  </div>
                  <div className="space-y-4 flex-1">
                    <LeaderRow rank={1} name="Mert Demir" status="Zirvede" xp="2.850" avatar="Mert" statusType="stable" />
                    <LeaderRow rank={2} name="Selin Yılmaz" status="Yükselişte" xp="2.720" avatar="Selin" statusType="rising" />
                    <LeaderRow rank={3} name="Caner Aydın" status="Düşüşte" xp="2.450" avatar="Caner" statusType="falling" />
                  </div>
                  <button className="mt-8 w-full py-3 rounded-xl bg-[#6F74D8] text-white font-bold text-[13px] hover:bg-[#5E63C2] transition-colors shadow-sm active:scale-95 cursor-pointer">Tüm Sonuçları Gör</button>
                </div>
              </div>

              {/* TASARIM PARKURU */}
              <section className="space-y-6 pt-4">
                <div className="flex items-center gap-3 text-[#10294C]"><Route size={24} className="text-[#FF8D28]" /><h3 className="text-[20px] font-bold">Tasarım Parkuru</h3></div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  <ParkourCard title="Kolaj Bahçesi" desc="Sürrealist kompozisyon teknikleri." tag="Ödev" iconGradient="bg-gradient-to-b from-pink-500 to-[#B80E57]" icon={<Palette size={24} />} status="Aktif" deadline="Son 2 Gün" />
                  <ParkourCard title="Kurumsal Kimlik" desc="Marka kimliği ve logo sistemi." tag="Proje" iconGradient="bg-gradient-to-b from-[#1CB5AE] to-[#0E5D59]" icon={<Briefcase size={24} />} status="Aktif" deadline="14.02.2026" />
                  <ParkourCard title="Kitap Dünyası" desc="Kitap kapağı ve tasarımı" tag="Ödev" iconGradient="bg-gradient-to-b from-[#FF8D28] to-[#D35400]" icon={<BookOpen size={24} />} status="Pasif" deadline="----------" disabled />
                </div>
              </section>

              {/* ÖDEV KÜTÜPHANESİ - 6 KARTLI SCROLL */}
              <section className="space-y-6 pt-4 pb-12">
                <div className="flex items-center gap-3 text-text-tertiary px-2"><LibraryBig size={24} /><h3 className="text-[20px] font-bold text-[#10294C]">Ödev Kütüphanesi</h3></div>
                <div className="relative">
                  <button onClick={() => handleScroll('left')} className="absolute -left-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white flex items-center justify-center text-neutral-900 shadow-xl hover:scale-110 active:scale-95 cursor-pointer border border-surface-100"><ChevronLeft size={24} /></button>
                  <button onClick={() => handleScroll('right')} className="absolute -right-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white flex items-center justify-center text-neutral-900 shadow-xl hover:scale-110 active:scale-95 cursor-pointer border border-surface-100"><ChevronRight size={24} /></button>
                  <div ref={scrollRef} className="flex gap-6 overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory">
                    <LibraryCard title="Ambalaj Tasarımı" desc="Ambalaj Tasarımı Üzerine" />
                    <LibraryCard title="Logo Challange" desc="Logo Etkinlik" />
                    <LibraryCard title="Raketini Tasarla" desc="Outdoor Tasarımı" />
                    <LibraryCard title="Reklam Bulucu" desc="Sosyal Medya Reklamları" />
                    <LibraryCard title="Post Tasarımı" desc="Post Çalışmaları" />
                    <LibraryCard title="Broşür Tasarımı" desc="Broşür Çalışmaları" />
                  </div>
                </div>
              </section>
            </>
          ) : (
            <ManagementPanel />
          )}
        </div>

        <Footer setActiveTab={setActiveTab} />
      </main>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

// BİLEŞENLER
function StatBox({ label, value, icon }: any) {
  return (
    <div className="bg-white/5 border border-white/5 p-6 rounded-[24px] flex flex-col items-center justify-center text-center transition-all hover:bg-white/10 cursor-default h-full">
      <div className="w-12 h-12 bg-white/7 rounded-[8px] flex items-center justify-center text-white/70 mb-4">{icon}</div>
      <span className="text-[10px] uppercase text-white/50 mb-2 font-medium tracking-widest">{label}</span>
      <span className="text-[28px] font-extrabold text-white leading-none tracking-tighter">{value}</span>
    </div>
  );
}

function LeaderRow({ rank, name, status, xp, avatar, statusType }: any) {
  return (
    <div className="flex items-center justify-between p-2 -mx-2 rounded-xl hover:bg-surface-50 transition-colors cursor-pointer group">
      <div className="flex items-center gap-4">
        <span className={`text-[12px] font-bold w-4 ${rank === 1 ? 'text-[#FF8D28]' : 'text-text-placeholder'}`}>{rank}</span>
        <div className="w-11 h-11 rounded-full border border-[#D1D5DB] p-0.5 overflow-hidden bg-surface-50"><img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${avatar}`} alt="Avatar" /></div>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <p className="text-[14px] text-text-primary font-bold">{name}</p>
            {statusType === 'rising' && <ArrowBigUpDash size={14} className="text-[#FF8D28]" />}
            {statusType === 'falling' && <ArrowBigDownDash size={14} className="text-text-muted opacity-50" />}
          </div>
          <p className={`text-[11px] font-semibold ${rank === 1 ? 'text-[#FF8D28]' : 'text-text-tertiary'}`}>{status}</p>
        </div>
      </div>
      <span className="text-[13px] font-bold text-[#10294C]">{xp} <span className="text-[10px] text-text-tertiary uppercase">XP</span></span>
    </div>
  );
}

function ParkourCard({ title, desc, tag, iconGradient, icon, status, deadline, disabled = false }: any) {
  return (
    <div className="bg-white p-8 rounded-[32px] border border-surface-200 flex flex-col justify-between transition-all hover:shadow-[0_20px_50px_rgba(0,0,0,0.05)] h-full">
      <div className="flex justify-between items-start mb-8">
        <div className={`w-14 h-14 ${iconGradient} rounded-[12px] flex items-center justify-center text-white shadow-lg`}>{icon}</div>
        <span className="px-4 py-1.5 rounded-full text-[11px] font-bold bg-surface-50 text-text-tertiary uppercase">{tag}</span>
      </div>
      <div className="mb-8">
        <h4 className="text-[18px] text-[#10294C] font-bold mb-1.5">{title}</h4>
        <p className="text-[12px] text-text-tertiary leading-relaxed">{desc}</p>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-text-placeholder font-semibold italic opacity-60">Tasarım Atölyesi</span>
        <button disabled={disabled} className={`px-6 py-2.5 rounded-xl text-[13px] font-bold transition-all active:scale-95 cursor-pointer ${disabled ? 'bg-surface-200 text-text-placeholder cursor-not-allowed' : 'bg-[#6F74D8] text-white hover:bg-[#5E63C2]'}`}>
          {disabled ? 'Kapalı' : 'Ödev Ver'}
        </button>
      </div>
    </div>
  );
}

function LibraryCard({ title, desc }: any) {
  return (
    <div className="min-w-[calc((100%-96px)/4.3)] snap-start bg-white p-7 rounded-[28px] border border-surface-100 flex flex-col justify-between h-[210px] transition-all hover:shadow-[0_45px_70px_-20px_rgba(0,0,0,0.12)] hover:border-transparent cursor-pointer group">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 bg-neutral-100 text-neutral-400 rounded-[12px] flex items-center justify-center shrink-0"><Palette size={20} /></div>
        <div className="truncate"><h5 className="text-[14px] font-bold text-[#10294C] mb-1 truncate">{title}</h5><p className="text-[11px] text-text-tertiary line-clamp-2">{desc}</p></div>
      </div>
      <div className="border-t border-neutral-100 my-4"></div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-text-placeholder italic font-semibold opacity-60">Tasarım Atölyesi</span>
        <button className="px-5 py-2 bg-neutral-200 text-text-primary rounded-xl text-[11px] font-bold flex items-center gap-2 hover:bg-[#10294C] hover:text-white transition-all active:scale-90 cursor-pointer">Ekle <PlusCircle size={14} /></button>
      </div>
    </div>
  );
}