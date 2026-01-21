"use client";

import React, { useRef, useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { 
  Users, BookOpen, Trophy, Palette, Briefcase, Zap, 
  Clock, PlusCircle, Repeat, ChevronRight, ChevronLeft, 
  LibraryBig, Route, ArrowBigUpDash, ArrowBigDownDash
} from "lucide-react";

export default function DashboardPage() {
  const scrollRef = useRef<HTMLDivElement>(null);
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
      if (e.key === "ArrowRight") handleScroll('right');
      if (e.key === "ArrowLeft") handleScroll('left');
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="flex min-h-screen bg-[#F4F7FB] font-inter antialiased text-text-primary overflow-x-hidden">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="flex-1 lg:pl-64 flex flex-col min-h-screen w-full">
        <Header />
        <div className="p-4 md:p-8 lg:p-10 w-full max-w-[1540px] 2xl:max-w-[2200px] mx-auto space-y-8 flex-1">
          {activeTab === 'dashboard' ? (
            <>
              {/* ANALİZ VE LİG */}
              <div className="grid grid-cols-12 gap-6 items-stretch">
                <div className="col-span-12 xl:col-span-8 bg-[#10294C] rounded-[32px] p-8 text-white flex flex-col justify-center relative overflow-hidden border border-white/5 shadow-lg">
                  <div className="relative z-10 flex flex-col items-start w-full">
                    <span className="text-[11px] 2xl:text-[13px] bg-white/5 px-4 py-1.5 rounded-full border border-white/10 text-[#FF8D28] font-bold uppercase">Atölye Analizi</span>
                    <h2 className="text-[clamp(24px,1.8vw,36px)] mt-4 font-bold tracking-tight leading-tight">Atölyedeki son gelişmeler ve <span className="text-[#FF8D28]">istatistikler.</span></h2>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8 w-full">
                      <StatBox label="Öğrenci" value="33" icon={<Users size={20} />} />
                      <StatBox label="Biten Ödev" value="12" icon={<BookOpen size={20} />} />
                      <StatBox label="Bekleyen" value="14" icon={<Clock size={20} />} />
                      <StatBox label="Ortalama" value="6.2" icon={<Zap size={20} />} />
                    </div>
                  </div>
                </div>

                <div className="col-span-12 xl:col-span-4 bg-white rounded-[32px] p-6 md:p-8 border border-surface-200 flex flex-col justify-between shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-[18px] 2xl:text-[22px] flex items-center gap-2 font-bold text-[#10294C]"><Trophy size={18} className="text-[#FF8D28]" /> Sınıflar Ligi</h3>
                    <button onClick={() => setViewMode(viewMode === 'Sınıflarım' ? 'Şubem' : viewMode === 'Şubem' ? 'Tümü' : 'Sınıflarım')} className="flex items-center gap-2 text-[#3A7BD5] bg-surface-50 px-3 py-1.5 rounded-xl border border-surface-100 cursor-pointer active:scale-95 transition-all">
                      <span className="text-[12px] 2xl:text-[14px] font-bold">{viewMode}</span>
                      <Repeat size={14} className="shrink-0 text-[#3A7BD5]" />
                    </button>
                  </div>
                  <div className="space-y-4 flex-1">
                    <LeaderRow rank={1} name="Mert Demir" status="Zirvede" statusType="stable" xp="2.850" avatar="Mert" gender="male" />
                    <LeaderRow rank={2} name="Selin Yılmaz" status="Yükselişte" statusType="rising" xp="2.720" avatar="Selin" gender="female" />
                    <LeaderRow rank={3} name="Caner Aydın" status="Düşüşte" statusType="falling" xp="2.450" avatar="Caner" gender="male" />
                  </div>
                  <button className="mt-8 w-full py-3 rounded-xl bg-[#6F74D8] text-white font-bold text-[13px] hover:bg-[#5E63C2] transition-all shadow-sm">Tüm Sonuçları Gör</button>
                </div>
              </div>

              {/* TASARIM PARKURU */}
              <section className="space-y-6 pt-4">
                <div className="flex items-center gap-3 text-[#10294C]"><Route size={24} className="text-[#FF8D28]" /><h3 className="text-[clamp(20px,1.5vw,26px)] font-bold">Tasarım Parkuru</h3></div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  <ParkourCard title="Kolaj Bahçesi" desc="Sürrealist kompozisyon teknikleri." tag="Ödev" iconGradient="bg-gradient-to-b from-pink-500 to-[#B80E57]" icon={<Palette size={24} />} tagStyles="bg-pink-100 text-pink-700" />
                  <ParkourCard title="Kurumsal Kimlik" desc="Marka kimliği ve logo sistemi." tag="Proje" iconGradient="bg-gradient-to-b from-[#1CB5AE] to-[#0E5D59]" icon={<Briefcase size={24} />} tagStyles="bg-cyan-100 text-cyan-700" />
                  <ParkourCard title="Kitap Dünyası" desc="Kitap kapağı ve tasarımı" tag="Ödev" iconGradient="bg-gradient-to-b from-[#FF8D28] to-[#D35400]" disabled icon={<BookOpen size={24} />} tagStyles="bg-orange-100 text-orange-700" />
                </div>
              </section>

              {/* ÖDEV KÜTÜPHANESİ */}
              <section className="space-y-6 pt-4 pb-12">
                <div className="flex items-center gap-3 text-text-tertiary px-2"><LibraryBig size={24} /><h3 className="text-[clamp(20px,1.5vw,26px)] font-bold text-text-tertiary">Ödev Kütüphanesi</h3></div>
                <div className="relative">
                  <button onClick={() => handleScroll('left')} className="absolute -left-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-xl border border-surface-100 hover:scale-110 active:scale-95 transition-all"><ChevronLeft size={24} /></button>
                  <button onClick={() => handleScroll('right')} className="absolute -right-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-xl border border-surface-100 hover:scale-110 active:scale-95 transition-all"><ChevronRight size={24} /></button>
                  <div ref={scrollRef} className="flex gap-6 overflow-x-auto no-scrollbar scroll-smooth snap-x">
                    <LibraryCard title="Ambalaj Tasarımı" desc="Görsel Kimlik Üzerine" />
                    <LibraryCard title="Logo Challange" desc="Vektörel Çizim" />
                    <LibraryCard title="Posterini Seç" desc="Film Poster Tasarımı" />
                    <LibraryCard title="Broşür Tasarla" desc="3 Kırımlı Broşür" />
                    <LibraryCard title="Reklam Bulucu" desc="Sosyal Medya Reklamları" />
                  </div>
                </div>
              </section>
            </>
          ) : (
            <div className="bg-white rounded-[32px] p-12 border border-surface-200 shadow-sm min-h-[500px] flex items-center justify-center text-[24px] font-bold text-[#10294C]">Yönetim Paneli</div>
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

// YARDIMCI BİLEŞENLER
function StatBox({ label, value, icon }: any) {
  return (
    <div className="bg-white/5 border border-white/5 p-6 rounded-[24px] flex flex-col items-center justify-center text-center transition-all hover:bg-white/10 h-full">
      <div className="w-12 h-12 bg-white/7 rounded-[8px] flex items-center justify-center text-white/70 mb-4">{icon}</div>
      <span className="text-[10px] 2xl:text-[12px] uppercase text-white/50 mb-2 font-medium tracking-widest">{label}</span>
      <span className="text-[clamp(24px,1.5vw,34px)] font-extrabold text-white leading-none tracking-tighter">{value}</span>
    </div>
  );
}

function LeaderRow({ rank, name, status, statusType, xp, avatar, gender }: any) {
  const style = gender === 'female' ? 'lorelei' : 'avataaars';
  const avatarUrl = `https://api.dicebear.com/7.x/${style}/svg?seed=${avatar}&scale=110`;

  return (
    <div className="flex items-center justify-between p-2 -mx-2 rounded-xl hover:bg-surface-50 transition-colors cursor-pointer group">
      <div className="flex items-center gap-4">
        <span className={`text-[15px] 2xl:text-[18px] font-bold w-6 ${rank === 1 ? 'text-[#FF8D28]' : 'text-text-placeholder'}`}>{rank}</span>
        <div className="w-11 h-11 rounded-full border border-[#D1D5DB] p-0.5 overflow-hidden bg-surface-50">
          <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
        </div>
        <div className="flex flex-col">
          <p className="text-[14px] 2xl:text-[16px] text-text-primary font-bold">{name}</p>
          <div className="flex items-center gap-1">
             <p className={`text-[11px] 2xl:text-[13px] font-semibold ${rank === 1 ? 'text-[#FF8D28]' : 'text-text-tertiary'}`}>{status}</p>
             {statusType === 'rising' && <ArrowBigUpDash size={14} className="text-[#FF8D28]" />}
             {statusType === 'falling' && <ArrowBigDownDash size={14} className="text-text-muted opacity-50" />}
          </div>
        </div>
      </div>
      <span className="text-[13px] 2xl:text-[15px] font-bold text-[#10294C] whitespace-nowrap">{xp}<span className="text-[10px] 2xl:text-[12px] text-text-tertiary ml-0.5 uppercase">XP</span></span>
    </div>
  );
}

// GÜNCELLENEN PARKOURCARD: Özel ve Geniş Gölge
function ParkourCard({ title, desc, tag, iconGradient, icon, disabled = false, tagStyles }: any) {
  return (
    <div className="bg-white p-8 rounded-[32px] border border-surface-200 flex flex-col justify-between transition-all duration-300 hover:shadow-[0_30px_60px_-15px_rgba(16,41,76,0.15)] hover:-translate-y-1 h-full">
      <div className="flex justify-between items-start mb-8">
        <div className={`w-14 h-14 ${iconGradient} rounded-[12px] flex items-center justify-center text-white shadow-lg`}>{icon}</div>
        <span className={`px-4 py-1.5 rounded-full text-[11px] 2xl:text-[13px] font-bold uppercase ${tagStyles}`}>{tag.charAt(0).toUpperCase() + tag.slice(1).toLowerCase()}</span>
      </div>
      <div className="mb-8">
        <h4 className="text-[18px] 2xl:text-[22px] text-[#10294C] font-bold mb-1.5">{title}</h4>
        <p className="text-[12px] 2xl:text-[14px] text-text-tertiary leading-relaxed">{desc}</p>
      </div>
      <div className="flex items-center justify-between border-t border-surface-50 pt-6">
        <span className="text-[11px] 2xl:text-[13px] text-text-placeholder font-semibold italic opacity-60">Tasarım Atölyesi</span>
        <button disabled={disabled} className={`px-6 py-2.5 rounded-xl text-[13px] 2xl:text-[15px] font-bold transition-all active:scale-95 ${disabled ? 'bg-surface-200 text-text-placeholder cursor-not-allowed' : 'bg-[#6F74D8] text-white hover:bg-[#5E63C2]'}`}>Ödev Ver</button>
      </div>
    </div>
  );
}

// GÜNCELLENEN LIBRARYCARD: Özel ve Geniş Gölge
function LibraryCard({ title, desc }: any) {
  return (
    <div className="min-w-[calc((100%-96px)/4.3)] snap-start bg-white p-7 rounded-[28px] border border-surface-100 flex flex-col justify-between h-[210px] 2xl:h-[240px] transition-all duration-300 hover:shadow-[0_30px_60px_-15px_rgba(16,41,76,0.15)] hover:-translate-y-1 cursor-pointer group">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 bg-neutral-100 text-neutral-400 rounded-[12px] flex items-center justify-center shrink-0"><Palette size={20} /></div>
        <div className="truncate">
          <h5 className="text-[14px] 2xl:text-[16px] font-bold text-[#10294C] mb-1 truncate">{title}</h5>
          <p className="text-[11px] 2xl:text-[13px] text-text-tertiary line-clamp-2">{desc}</p>
        </div>
      </div>
      <div className="border-t border-neutral-100 my-4"></div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] 2xl:text-[12px] text-text-placeholder italic font-semibold opacity-60">Tasarım Atölyesi</span>
        <button className="px-5 py-2 bg-neutral-100 text-[#10294C] rounded-xl text-[11px] 2xl:text-[13px] font-bold flex items-center gap-2 hover:bg-[#10294C] hover:text-white transition-all">Ekle <PlusCircle size={14} /></button>
      </div>
    </div>
  );
}