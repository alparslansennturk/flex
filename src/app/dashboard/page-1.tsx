"use client";

import React, { useRef, useState } from "react";
import { 
  LayoutDashboard, Users, BookOpen, Trophy, Settings, LogOut, 
  ChevronRight, ChevronLeft, Palette, Briefcase, Zap, Bell, 
  Clock, PlusCircle, Repeat, Minus, ArrowBigUpDash, 
  ArrowBigDownDash, LibraryBig, ChevronDown, Route
} from "lucide-react";

type ViewMode = 'Sınıflarım' | 'Şubem' | 'Tümü';
type ActiveTab = 'dashboard' | 'management';

export default function DashboardPage() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const instructorBranch = "Kadıköy"; 
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [viewMode, setViewMode] = useState<ViewMode>('Sınıflarım');
  
  const [headerConfig] = useState({
    isLinkedToFlex: true, 
    showBranchSelect: true, 
  });

  const toggleViewMode = () => {
    if (viewMode === 'Sınıflarım') setViewMode('Şubem');
    else if (viewMode === 'Şubem') setViewMode('Tümü'); // Global -> Tümü yapıldı
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
      
      {/* SIDEBAR */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 bg-[#10294C] text-white flex-col z-50">
        <div className="p-8 text-nowrap">
          <div className="flex items-center gap-1 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <span className="text-[20px] font-semibold text-[#FF8D28] tracking-tight">tasarım</span>
            <span className="text-[20px] font-bold text-white tracking-tight">atölyesi</span>
          </div>
        </div>

        <nav className="flex-1 px-4 mt-12 space-y-1 overflow-y-auto">
          <SidebarLink 
            icon={<LayoutDashboard size={15} />} 
            label="Atölye Özeti" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
          />
          <SidebarLink 
            icon={<Users size={15} />} 
            label="Öğrencilerim" 
            active={activeTab === 'management'} 
            onClick={() => setActiveTab('management')} 
          />
          <SidebarLink icon={<BookOpen size={15} />} label="Ödev Havuzu" />
          <SidebarLink icon={<Trophy size={15} />} label="Sınıf Ligi" />
          <SidebarLink icon={<Settings size={15} />} label="Atölye Ayarları" />
        </nav>

        <div className="p-6 mt-auto border-t border-white/5">
          <div className="flex items-center gap-3 px-4 py-3 text-white cursor-pointer hover:bg-white/5 transition-colors text-[15px] group rounded-xl font-medium">
            <LogOut size={15} className="group-hover:text-[#FF8D28] transition-colors" />
            <span>Çıkış Yap</span>
          </div>
        </div>
      </aside>

      <main className="flex-1 lg:pl-64 flex flex-col min-h-screen w-full">
        {/* HEADER */}
        <header className="h-20 bg-white border-b border-surface-200 px-6 md:px-10 flex items-center justify-between sticky top-0 z-40 w-full">
          <div className="truncate pr-4">
            <h1 className="ui-title-xs text-[#10294C] truncate font-bold">Hoş geldin, Alparslan</h1>
            <p className="ui-helper-xs text-text-tertiary hidden sm:block">Bugün yeni bir perspektif keşfetmeye ne dersin?</p>
          </div>
          <div className="flex items-center shrink-0">
            <div className="relative text-text-secondary cursor-pointer hover:text-[#3A7BD5] mr-6">
              <Bell size={20} />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#FF4D4D] text-white text-[9px] flex items-center justify-center rounded-full font-bold border-2 border-white">3</span>
            </div>
            <div className="flex items-center gap-4 border-l border-surface-200 pl-6">
              <div className="text-right hidden md:block">
                <p className="ui-label-small text-[#10294C] font-bold leading-none mb-1">Alparslan Şentürk</p>
                <p className="text-[11px] text-text-tertiary font-medium">Eğitmen | Arı Bilgi</p>
              </div>
              <div className="w-10 h-10 rounded-full border-2 border-[#FF8D28] p-0.5 shrink-0 cursor-pointer overflow-hidden bg-surface-50 transition-transform hover:scale-105">
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Alparslan" alt="Avatar" className="rounded-full w-full h-full object-cover" />
              </div>
            </div>
            {headerConfig.showBranchSelect && (
              <div className="flex items-center gap-1 ml-[32px] cursor-pointer group select-none">
                <span className="text-[13px] font-medium text-text-tertiary group-hover:text-text-primary transition-colors">Kadıköy Şb.</span>
                <ChevronDown size={14} className="text-text-tertiary group-hover:text-[#3A7BD5]" />
              </div>
            )}
            {headerConfig.isLinkedToFlex && (
              <div className="flex items-center gap-2 ml-[32px] cursor-pointer group select-none">
                <span className="text-[22px] font-semibold text-[#3A7BD5] tracking-tight">flex</span>
                <ChevronRight size={18} className="text-[#3A7BD5] group-hover:translate-x-1 transition-transform" />
              </div>
            )}
          </div>
        </header>

        {/* CONTENT BODY */}
        <div className="p-4 md:p-8 lg:p-10 w-full max-w-[1540px] 2xl:max-w-[1700px] mx-auto space-y-8 flex-1">
          {activeTab === 'dashboard' ? (
            <>
              <div className="grid grid-cols-12 gap-6 items-stretch">
                <div className="col-span-12 xl:col-span-8 bg-[#10294C] rounded-[32px] p-8 text-white flex flex-col justify-center relative overflow-hidden group border border-white/5 shadow-lg">
                  <div className="relative z-10 flex flex-col items-start w-full">
                    <span className="ui-helper-xs bg-white/5 px-4 py-1.5 rounded-full border border-white/10 text-[#FF8D28] font-bold">Atölye Analizi</span>
                    <h2 className="ui-title-md mt-4 tracking-tight leading-tight">Atölyedeki son gelişmeler ve <span className="text-[#FF8D28]">istatistikler.</span></h2>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 w-full"><StatBox label="Öğrenci" value="33" icon={<Users size={20} />} /><StatBox label="Biten Ödev" value="12" icon={<BookOpen size={20} />} /><StatBox label="Bekleyen" value="14" icon={<Clock size={20} />} /><StatBox label="Ortalama" value="6.2" icon={<Zap size={20} />} /></div>
                  </div>
                </div>
                <div className="col-span-12 xl:col-span-4 bg-white rounded-[32px] p-6 md:p-8 border border-surface-200 flex flex-col justify-between shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="ui-title-xs flex items-center gap-2 font-bold text-[#10294C]"><Trophy size={18} className="text-[#FF8D28]" /> Sınıf Ligi</h3>
                    <button onClick={toggleViewMode} className="flex items-center gap-1.5 text-[#3A7BD5] hover:bg-surface-100 transition-colors bg-surface-50 px-3 py-1 rounded-lg border border-surface-100 cursor-pointer active:scale-95"><span className="text-[12px] font-bold">{viewMode}</span><Repeat size={14} className="shrink-0 text-[#FF8D28]" /></button>
                  </div>
                  <div className="space-y-4 flex-1"><LeaderRow rank={1} name="Mert Demir" status="Zirvede" statusType="stable" xp="2.850" avatar="Mert" /> <LeaderRow rank={2} name="Selin Yılmaz" status="Yükselişte" statusType="rising" xp="2.720" avatar="Selin" /> <LeaderRow rank={3} name="Caner Aydın" status="Düşüşte" statusType="falling" xp="2.450" avatar="Caner" /></div>
                  <div className="mt-8"><button className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#6F74D8] text-white hover:bg-[#5E63C2] transition-all active:scale-95 shadow-sm font-bold text-[13px] cursor-pointer"><span>Tüm Sonuçları Gör</span><ChevronRight size={16} /></button></div>
                </div>
              </div>

              <section className="space-y-6 pt-4">
                {/* Tasarım Parkuru - Ikon Route ve Baş harfler büyük */}
                <div className="flex items-center gap-3 text-[#10294C]"><Route size={24} className="text-[#FF8D28]" /><h3 className="ui-title-sm font-bold">Tasarım Parkuru</h3></div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"><ParkourCard title="Kolaj Bahçesi" desc="Sürrealist kompozisyon teknikleri." tag="Ödev" status="Aktif" deadline="Son 2 Gün" iconGradient="bg-gradient-to-b from-pink-500 to-[#B80E57]" btnText="Ödev Ver" icon={<Palette size={24} />} /><ParkourCard title="Kurumsal Kimlik" desc="Marka kimliği ve logo sistemi." tag="Proje" status="Aktif" deadline="14.02.2026" iconGradient="bg-gradient-to-b from-[#1CB5AE] to-[#0E5D59]" btnText="Proje Ver" icon={<Briefcase size={24} />} /><ParkourCard title="Kitap Dünyası" desc="Kitap kapağı ve tasarımı" tag="Ödev" status="Pasif" deadline="----------" iconGradient="bg-gradient-to-b from-[#FF8D28] to-[#D35400]" btnText="Ödev Ver" disabled icon={<BookOpen size={24} />} /></div>
              </section>

              <section className="space-y-6 pt-4 pb-12">
                <div className="flex items-center gap-3 text-text-tertiary px-2"><LibraryBig size={24} /><h3 className="ui-title-sm font-bold text-[#10294C]">Ödev Kütüphanesi</h3></div>
                <div className="relative">
                  <button onClick={() => handleScroll('left')} className="absolute -left-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white flex items-center justify-center text-neutral-900 shadow-xl transition-transform hover:scale-110 active:scale-95 cursor-pointer"><ChevronLeft size={24} /></button>
                  <button onClick={() => handleScroll('right')} className="absolute -right-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white flex items-center justify-center text-neutral-900 shadow-xl transition-transform hover:scale-110 active:scale-95 cursor-pointer"><ChevronRight size={24} /></button>
                  <div ref={scrollRef} className="flex gap-6 overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory"><LibraryCard title="Ambalaj Tasarımı" desc="Ambalaj Tasarımı Üzerine" /><LibraryCard title="Logo Challange" desc="Logo Etkinlik" /><LibraryCard title="Raketini Tasarla" desc="Outdoor Tasarımı" /><LibraryCard title="Reklam Bulucu" desc="Sosyal Medya Reklamları" /><LibraryCard title="Post Tasarımı" desc="Post Çalışmaları" /><LibraryCard title="Broşür Tasarımı" desc="Broşür Çalışmaları" /></div>
                </div>
              </section>
            </>
          ) : (
            <div className="bg-white rounded-[32px] p-12 border border-surface-200 shadow-sm min-h-[500px] flex flex-col items-center justify-center text-center">
               <div className="w-20 h-20 bg-surface-50 rounded-full flex items-center justify-center mb-6 text-[#3A7BD5]"><Settings size={40} className="animate-spin" /></div>
               <h2 className="text-[24px] font-bold text-[#10294C] mb-2">Yönetim Paneli</h2>
               <p className="text-text-tertiary max-w-md">Burada Gruplar, Öğrenciler ve Sistem Ayarları yer alacak.</p>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <footer className="bg-[#10294C] px-[32px] py-[24px] flex items-center justify-between border-t border-white/5 mt-auto min-h-[74px]">
          <div className="flex items-center gap-1 select-none cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <span className="text-[20px] font-semibold text-[#FF8D28] tracking-tight">tasarım</span>
            <span className="text-[20px] font-bold text-white tracking-tight">atölyesi</span>
          </div>
          <div className="flex flex-col items-end justify-center">
            <div className="flex items-center gap-[16px] mb-[12px]">
              <SocialIcon src="/icons/linkedin.svg" />
              <SocialIcon src="/icons/facebook.svg" />
              <SocialIcon src="/icons/x.svg" />
              <SocialIcon src="/icons/instagram.svg" />
            </div>
            <p className="text-[12px] font-normal text-white tracking-wide opacity-80">
              Copyright @ Alparslan Şentürk 2026. Tüm Hakları Saklıdır.
            </p>
          </div>
        </footer>
      </main>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

// YARDIMCI BİLEŞENLER
function SocialIcon({ src }: { src: string }) {
  return (
    <div className="w-[24px] h-[24px] flex items-center justify-center cursor-pointer transition-all hover:scale-110 active:scale-95">
      <img src={src} className="w-full h-full object-contain" alt="social icon" />
    </div>
  );
}

function SidebarLink({ icon, label, active = false, onClick }: any) {
  return (
    <div onClick={onClick} className={`flex items-center gap-4 px-6 py-4 rounded-xl transition-all duration-200 cursor-pointer group ${active ? 'bg-white/5 text-white' : 'text-white hover:bg-white/5'}`}>
      <span className={`transition-colors duration-200 ${active ? 'text-[#FF8D28]' : 'group-hover:text-[#FF8D28]'}`}>{icon}</span>
      <span className="text-[15px] font-medium tracking-wide">{label}</span>
    </div>
  );
}

function StatBox({ label, value, icon }: { label: string, value: string, icon: any }) {
  return (
    <div className="bg-white/5 border border-white/5 p-6 rounded-[24px] flex flex-col items-center justify-center text-center transition-all hover:bg-white/10 cursor-default h-full">
      <div className="w-12 h-12 bg-white/7 rounded-[8px] flex items-center justify-center text-white/70 mb-4">{icon}</div>
      <span className="text-[10px] uppercase text-white/50 mb-2 font-medium tracking-widest">{label}</span>
      <span className="text-[28px] font-extrabold text-white leading-none tracking-tighter">{value}</span>
    </div>
  );
}

function LeaderRow({ rank, name, status, statusType, xp, avatar }: any) {
  return (
    <div className="flex items-center justify-between p-2 -mx-2 rounded-xl hover:bg-surface-50 transition-colors cursor-pointer group">
      <div className="flex items-center gap-4">
        <span className={`text-[12px] font-bold w-4 ${rank === 1 ? 'text-[#FF8D28]' : 'text-text-placeholder'}`}>{rank}</span>
        <div className="w-11 h-11 rounded-full border border-[#D1D5DB] p-0.5 overflow-hidden bg-surface-50">
          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${avatar}`} alt="Avatar" />
        </div>
        <div className="flex flex-col">
          <p className="text-[14px] text-text-primary font-bold">{name}</p>
          <div className="flex items-center gap-1">
             <p className={`text-[11px] font-semibold ${rank === 1 ? 'text-[#FF8D28]' : 'text-text-tertiary'}`}>{status}</p>
             {statusType === 'rising' && <ArrowBigUpDash size={14} className="text-[#FF8D28]" />}
             {statusType === 'falling' && <ArrowBigDownDash size={14} className="text-text-muted opacity-50" />}
          </div>
        </div>
      </div>
      <span className="text-[13px] font-bold text-[#10294C]">{xp} <span className="text-[10px] text-text-tertiary">XP</span></span>
    </div>
  );
}

function ParkourCard({ title, desc, tag, deadline, iconGradient, icon, disabled = false }: any) {
  return (
    <div className="bg-white p-8 rounded-[32px] border border-surface-200 flex flex-col justify-between transition-all hover:shadow-[0_20px_50px_rgba(0,0,0,0.05)] h-full">
      <div className="flex justify-between items-start mb-8">
        <div className={`w-14 h-14 ${iconGradient} rounded-[12px] flex items-center justify-center text-white shadow-lg`}>{icon}</div>
        <span className="px-4 py-1.5 rounded-full text-[11px] font-bold bg-surface-50 text-text-tertiary">{tag}</span>
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
        <div className="w-10 h-10 bg-neutral-200 text-neutral-400 rounded-[12px] flex items-center justify-center shrink-0"><Palette size={20} /></div>
        <div className="truncate"><h5 className="text-[14px] font-bold text-[#10294C] mb-1 truncate">{title}</h5><p className="text-[11px] text-text-tertiary line-clamp-2">{desc}</p></div>
      </div>
      <div className="border-t border-neutral-200 my-4"></div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-text-placeholder italic font-semibold opacity-60">Tasarım Atölyesi</span>
        <button className="px-5 py-2 bg-neutral-200 text-text-primary rounded-xl text-[11px] font-bold flex items-center gap-2 hover:bg-neutral-700 hover:text-white transition-all active:scale-90 cursor-pointer">Ekle <PlusCircle size={14} /></button>
      </div>
    </div>
  );
}