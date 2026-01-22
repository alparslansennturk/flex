"use client";

import React, { useRef, useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { 
  Users, BookOpen, Trophy, Palette, Briefcase, Zap, 
  Clock, Repeat, ChevronRight, ChevronLeft, 
  LibraryBig, Route, ArrowBigUpDash, ArrowBigDownDash, PlusCircle
} from "lucide-react";

export default function DashboardPage() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'management'>('dashboard');
  const [viewMode, setViewMode] = useState<'Sınıflarım' | 'Şubem' | 'Tümü'>('Sınıflarım');

  const handleScroll = (dir: 'left' | 'right') => {
    if (scrollRef.current) {
      const currentScroll = scrollRef.current.scrollLeft;
      
      // Sola basınca en baştaysa titremeyi/kaymayı önler
      if (dir === 'left' && currentScroll <= 1) {
        scrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
        return;
      }

      const amt = scrollRef.current.offsetWidth / 4.3; 
      scrollRef.current.scrollBy({ left: dir === 'left' ? -amt : amt, behavior: 'smooth' });
    }
  };

  // Klavye yön tuşları ile scroll kontrolü
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        handleScroll('left');
      } else if (e.key === "ArrowRight") {
        handleScroll('right');
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="flex min-h-screen bg-[#F4F7FB] font-inter antialiased text-[#1E222B] overflow-x-hidden">
     {/* @ts-ignore */}
<Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="flex-1 lg:pl-64 flex flex-col min-h-screen w-full">
        <Header />
        
        {/* ANA KAPSAYICI */}
        <div className="w-full max-w-[1800px] mx-auto px-6 md:px-10 py-6 flex-1">  
          
          {activeTab === 'dashboard' ? (
            <>
              {/* 1. ANALİZ VE LİG */}
              <div className="grid grid-cols-12 gap-6 items-stretch">
                <div className="col-span-12 xl:col-span-8 bg-[#10294C] rounded-[32px] p-8 text-white relative overflow-hidden border border-white/5 shadow-lg min-h-[320px] flex flex-col justify-center">
                  <div className="relative z-10 flex flex-col items-start w-full">
                    <span className="text-[11px] bg-white/5 px-4 py-1.5 rounded-full border border-white/10 text-[#FF8D28] font-bold uppercase tracking-widest">Atölye analizi</span>
                    <h2 className="text-[28px] 2xl:text-[36px] mt-3 font-bold tracking-tight leading-tight">Atölyedeki son gelişmeler ve <span className="text-[#FF8D28]">istatistikler.</span></h2>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8 w-full">
                      <StatBox label="Öğrenci" value="33" icon={<Users size={20} />} />
                      <StatBox label="Biten ödev" value="12" icon={<BookOpen size={20} />} />
                      <StatBox label="Bekleyen" value="14" icon={<Clock size={20} />} />
                      <StatBox label="Ortalama" value="6.2" icon={<Zap size={20} />} />
                    </div>
                  </div>
                </div>

                <div className="col-span-12 xl:col-span-4 bg-white rounded-[32px] p-6 border border-[#E2E5EA] flex flex-col justify-between shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[18px] font-bold text-[#10294C] flex items-center gap-2"><Trophy size={16} className="text-[#FF8D28]" /> Sınıflar ligi</h3>
                    <button onClick={() => setViewMode(viewMode === 'Sınıflarım' ? 'Şubem' : viewMode === 'Şubem' ? 'Tümü' : 'Sınıflarım')} className="flex items-center justify-center gap-2 text-[#3A7BD5] bg-[#F7F8FA] px-3 h-8 rounded-xl border border-[#EEF0F3] cursor-pointer active:scale-95 transition-all">
                      <span className="text-[clamp(12px,0.8vw,14px)] font-bold whitespace-nowrap">{viewMode}</span>
                      <Repeat size={12} />
                    </button>
                  </div>
                  <div className="space-y-3 flex-1">
                    <LeaderRow rank={1} name="Mert Demir" status="Zirvede" statusType="stable" xp="2.850" avatar="Mert" gender="male" viewMode={viewMode} />
                    <LeaderRow rank={2} name="Selin Yılmaz" status="Yükselişte" statusType="rising" xp="2.720" avatar="Selin" gender="female" viewMode={viewMode} />
                    <LeaderRow rank={3} name="Caner Aydın" status="Düşüşte" statusType="falling" xp="2.450" avatar="Caner" gender="male" viewMode={viewMode} />
                  </div>
                  <button className="mt-6 w-full h-[48px] flex items-center justify-center gap-2 rounded-xl bg-[#6F74D8] text-white font-bold text-[13px] hover:bg-[#5E63C2] transition-all shadow-sm cursor-pointer">
                    Tüm sonuçları gör <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {/* 2. TASARIM PARKURU */}
              <section className="mt-[48px] space-y-[24px]">
                <div className="flex items-center gap-3 text-[#10294C] px-2"><Route size={22} className="text-[#FF8D28]" /><h3 className="text-[22px] font-bold cursor-default">Tasarım parkuru</h3></div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  <ParkourCard title="Kolaj Bahçesi" desc="Sürrealist kompozisyon teknikleri." tag="Ödev" iconGradient="bg-gradient-to-b from-pink-500 to-[#B80E57]" icon={<Palette size={22} />} tagStyles="bg-pink-100 text-pink-700" status="Aktif" duration="Son 2 Gün" />
                  <ParkourCard title="Marka Kimliği" desc="Kurumsal kimlik ve logo sistemi." tag="Proje" iconGradient="bg-gradient-to-b from-[#1CB5AE] to-[#0E5D59]" icon={<Briefcase size={22} />} tagStyles="bg-cyan-100 text-cyan-700" status="Aktif" duration="Son 5 Gün" />
                  <ParkourCard title="Kitap Dünyası" desc="Kitap kapağı ve tasarımı" tag="Ödev" iconGradient="bg-gradient-to-b from-[#FF8D28] to-[#D35400]" disabled icon={<BookOpen size={22} />} tagStyles="bg-orange-100 text-[#FF8D28]" status="Pasif" duration="Süre doldu" />
                </div>
              </section>

              {/* 3. ÖDEV KÜTÜPHANESİ */}
              <section className="mt-[48px] mb-[64px] space-y-[24px]">
                <div className="flex items-center gap-3 text-[#8E95A3] px-2"><LibraryBig size={22} /><h3 className="text-[22px] font-bold text-[#8E95A3] cursor-default">Ödev kütüphanesi</h3></div>
                <div className="relative group overflow-visible">
                  <button onClick={() => handleScroll('left')} className="absolute -left-5 top-[140px] -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-xl border border-[#EEF0F3] hover:scale-110 active:scale-95 transition-all cursor-pointer text-[#10294C]"><ChevronLeft size={24} /></button>
                  <button onClick={() => handleScroll('right')} className="absolute -right-5 top-[140px] -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-xl border border-[#EEF0F3] hover:scale-110 active:scale-95 transition-all cursor-pointer text-[#10294C]"><ChevronRight size={24} /></button>
                  
                  {/* SCROLL ALANI: px-2 kaldırıldı, titreme engellendi */}
                  <div ref={scrollRef} className="flex gap-6 overflow-x-auto no-scrollbar scroll-smooth snap-x py-10 -my-10">
                    <LibraryCard title="Ambalaj tasarımı" desc="Görsel kimlik üzerine" />
                    <LibraryCard title="Logo challange" desc="Vektörel çizim" />
                    <LibraryCard title="Posterini seç" desc="Film poster tasarımı" />
                    <LibraryCard title="Broşür tasarla" desc="3 kırımlı broşür" />
                    <LibraryCard title="Reklam bulucu" desc="Sosyal medya reklamları" />
                  </div>
                </div>
              </section>
            </>
          ) : (
            <div className="mt-[48px] bg-white rounded-[32px] p-12 border border-[#E2E5EA] min-h-[500px] flex items-center justify-center text-[24px] font-bold text-[#10294C]">Yönetim Paneli İçeriği</div>
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

/* --- YARDIMCI BİLEŞENLER --- */

function StatBox({ label, value, icon }: any) {
  return (
    <div className="bg-white/5 border border-white/5 p-5 rounded-[24px] flex flex-col items-center justify-center text-center h-full">
      <div className="w-10 h-10 bg-white/7 rounded-[8px] flex items-center justify-center text-white/70 mb-3">{icon}</div>
      <span className="text-[10px] text-white/50 mb-1 font-medium tracking-widest uppercase">{label}</span>
      <span className="text-[28px] font-extrabold text-white leading-none tracking-tighter">{value}</span>
    </div>
  );
}

function LeaderRow({ rank, name, status, statusType, xp, avatar, gender, viewMode }: any) {
  const avatarUrl = `https://api.dicebear.com/7.x/${gender === 'female' ? 'lorelei' : 'avataaars'}/svg?seed=${avatar}`;
  const displayStatus = viewMode === 'Tümü' ? "Kadıköy Şubesi" : status;

  return (
    <div className="flex items-center justify-between p-2 -mx-2 rounded-xl hover:bg-[#F7F8FA] transition-colors cursor-pointer group">
      <div className="flex items-center flex-1 min-w-0 mr-2">
        <span className={`text-[15px] font-bold w-8 shrink-0 ${rank === 1 ? 'text-[#FF8D28]' : 'text-[#AEB4C0]'}`}>{rank}</span>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-full border border-[#E2E5EA] p-0.5 overflow-hidden bg-[#F7F8FA] shrink-0">
            <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col min-w-0">
            <p className="text-[clamp(14px,1vw,16px)] text-[#1E222B] font-bold whitespace-nowrap overflow-hidden leading-none mb-1">{name}</p>
            <p className={`text-[11px] font-semibold truncate ${rank === 1 ? 'text-[#FF8D28]' : 'text-[#8E95A3]'}`}>
              {displayStatus}
            </p>
          </div>
        </div>
        <div className="ml-4 w-8 flex justify-center items-center shrink-0">
             {statusType === 'stable' && <div className="w-4 h-0.5 bg-[#FF8D28] rounded-full" />}
             {statusType === 'rising' && <ArrowBigUpDash size={18} className="text-[#FF8D28]" />}
             {statusType === 'falling' && <ArrowBigDownDash size={18} className="text-[#AEB4C0] opacity-50" />}
        </div>
      </div>
      <span className="text-[14px] font-bold text-[#10294C] whitespace-nowrap shrink-0">
        {xp}<span className="text-[clamp(11px,0.7vw,13px)] text-[#8E95A3] font-bold uppercase ml-0">XP</span>
      </span>
    </div>
  );
}

function ParkourCard({ title, desc, tag, iconGradient, icon, disabled = false, tagStyles, status, duration }: any) {
  return (
    <div className="bg-white p-7 rounded-[32px] border border-[#E2E5EA] flex flex-col justify-between transition-all duration-300 hover:shadow-[15px_30px_60px_-15px_rgba(16,41,76,0.08)] hover:-translate-y-1 h-full cursor-default group">
      <div className="flex justify-between items-start mb-5">
        <div className={`w-12 h-12 ${iconGradient} rounded-[14px] flex items-center justify-center text-white shadow-lg shrink-0`}>{icon}</div>
        <span className={`px-4 py-1.5 rounded-full text-[11px] font-bold ${tagStyles}`}>{tag}</span>
      </div>
      <div className="mb-5">
        <h4 className="text-[20px] text-[#10294C] font-bold mb-1.5 leading-tight">{title}</h4>
        <p className="text-[13px] text-[#8E95A3] leading-relaxed line-clamp-2">{desc}</p>
      </div>
      <div className="bg-[#F7F8FA] rounded-2xl p-3.5 flex justify-between mb-6 border border-[#EEF0F3]">
        <div className="flex flex-col">
          <span className="text-[11px] text-[#8E95A3]">Durum</span>
          <span className={`text-[13px] font-bold mt-0.5 ${status === 'Aktif' ? 'text-[#009F3E]' : 'text-[#AEB4C0]'}`}>{status}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[11px] text-[#8E95A3]">Teslim süresi</span>
          <div className="flex items-center gap-1.5 mt-0.5 text-[#10294C]">
            <Clock size={12} />
            <span className="text-[13px] font-bold">{duration}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-[#F7F8FA] pt-5">
        <span className="text-[11px] text-[#AEB4C0] italic font-semibold opacity-60">Tasarım atölyesi</span>
        <button disabled={disabled} className={`px-5 h-10 flex items-center gap-2 rounded-xl text-[13px] font-bold transition-all active:scale-95 cursor-pointer ${disabled ? 'bg-[#E2E5EA] text-[#AEB4C0] cursor-not-allowed' : 'bg-[#6F74D8] text-white hover:bg-[#5E63C2]'}`}>
          Ödev ver <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

function LibraryCard({ title, desc }: any) {
  return (
    <div className="min-w-[calc((100%-80px)/4.3)] snap-start bg-white p-6 rounded-[28px] border border-[#EEF0F3] flex flex-col justify-between h-[210px] transition-all duration-500 hover:shadow-[15px_40px_80px_-20px_rgba(16,41,76,0.08)] hover:-translate-y-2 cursor-pointer group">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 bg-[#F7F8FA] text-[#8E95A3] rounded-xl flex items-center justify-center shrink-0"><Palette size={20} /></div>
        <div className="truncate">
          <h5 className="text-[15px] font-bold text-[#10294C] mb-0.5 truncate">{title}</h5>
          <p className="text-[11px] text-[#8E95A3] line-clamp-2">{desc}</p>
        </div>
      </div>
      <div className="border-t border-[#EEF0F3] my-4"></div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[#AEB4C0] italic font-semibold opacity-60">Tasarım atölyesi</span>
        <button className="px-4 py-1.5 bg-[#F7F8FA] text-[#10294C] rounded-xl text-[11px] font-bold flex items-center gap-2 hover:bg-[#10294C] hover:text-white transition-all cursor-pointer">Ekle <PlusCircle size={14} /></button>
      </div>
    </div>
  );
}