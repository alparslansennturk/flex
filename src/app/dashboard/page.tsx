"use client";

import React, { useRef, useState } from "react";
import { 
  LayoutDashboard, Users, BookOpen, Trophy, Settings, LogOut, 
  ChevronRight, ChevronLeft, Palette, Briefcase, Zap, Bell, 
  Linkedin, Facebook, Instagram, Twitter, Clock, PlusCircle,
  Repeat, Minus, ArrowBigUpDash, ArrowBigDownDash
} from "lucide-react";

// --- TYPES & INTERFACES ---
interface SidebarLinkProps { icon: React.ReactNode; label: string; active?: boolean; }
interface StatBoxProps { label: string; value: string; icon: React.ReactNode; }
interface LeaderRowProps { 
  rank: number; 
  name: string; 
  status: string; 
  statusType: 'stable' | 'rising' | 'falling';
  xp: string; 
  avatar: string; 
}
interface ParkourCardProps { title: string; desc: string; tag: string; status: string; deadline: string; iconBg: string; btnText: string; icon: React.ReactNode; disabled?: boolean; }
interface LibraryCardProps { title: string; desc: string; }

export default function DashboardPage() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [listType, setListType] = useState<'Haftalık' | 'Aylık'>('Haftalık');

  const handleScroll = (dir: 'left' | 'right') => {
    if (scrollRef.current) {
      const amt = 320;
      scrollRef.current.scrollBy({ left: dir === 'left' ? -amt : amt, behavior: 'smooth' });
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F4F7FB] font-inter antialiased text-text-primary overflow-x-hidden">
      
      {/* SIDEBAR */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 bg-[#10294C] text-white flex-col z-50">
        <div className="p-8 text-nowrap">
          <div className="flex items-center gap-1">
            <span className="ui-title-sm text-[#FF8D28]">tasarım</span>
            <span className="ui-title-sm text-white font-bold">atölyesi</span>
          </div>
        </div>
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          <SidebarLink icon={<LayoutDashboard size={18} />} label="Atölye Özeti" active />
          <SidebarLink icon={<Users size={18} />} label="Öğrencilerim" />
          <SidebarLink icon={<BookOpen size={18} />} label="Ödev Havuzu" />
          <SidebarLink icon={<Trophy size={18} />} label="Sınıf Ligi" />
          <SidebarLink icon={<Settings size={18} />} label="Atölye Ayarları" />
        </nav>
        <div className="p-6 mt-auto border-t border-white/5">
          <div className="flex items-center gap-3 px-4 py-3 text-white/40 cursor-pointer hover:text-white transition-colors ui-label-small group">
            <LogOut size={18} className="group-hover:text-[#FF8D28]" />
            <span>Çıkış Yap</span>
          </div>
        </div>
      </aside>

      {/* MAIN AREA */}
      <main className="flex-1 lg:pl-64 flex flex-col min-h-screen w-full">
        
        {/* HEADER */}
        <header className="h-20 bg-white border-b border-surface-200 px-6 md:px-10 flex items-center justify-between sticky top-0 z-40 w-full">
          <div className="truncate pr-4">
            <h1 className="ui-title-xs text-text-primary truncate font-bold">Hoş geldin, Alparslan</h1>
            <p className="ui-helper-xs text-text-tertiary hidden sm:block">Bugün yeni bir perspektif keşfetmeye ne dersin?</p>
          </div>

          <div className="flex items-center gap-3 md:gap-6 shrink-0">
            <div className="relative text-text-secondary cursor-pointer hover:text-[#3A7BD5]">
              <Bell size={20} />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#FF4D4D] text-white text-[9px] flex items-center justify-center rounded-full font-bold">3</span>
            </div>
            <div className="flex items-center gap-3 md:gap-4 border-l border-surface-200 pl-4 md:pl-6">
              <div className="text-right hidden md:block">
                <p className="ui-label-small text-text-primary font-bold">Alparslan Şentürk</p>
                <p className="ui-helper-xs text-text-tertiary">Eğitmen | Arı Bilgi</p>
              </div>
              <div className="w-10 h-10 rounded-full border-2 border-[#FF8D28] p-0.5 shrink-0">
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Alparslan" alt="Avatar" className="rounded-full bg-surface-50" />
              </div>
            </div>
          </div>
        </header>

        {/* CONTENT BODY */}
        <div className="p-4 md:p-8 lg:p-10 w-full max-w-[1540px] 2xl:max-w-[1700px] mx-auto space-y-8 flex-1">
          
          <div className="grid grid-cols-12 gap-6 items-stretch">
            
            {/* ATÖLYE ANALİZİ */}
            <div className="col-span-12 xl:col-span-8 bg-[#10294C] rounded-[32px] p-8 text-white flex flex-col justify-center relative overflow-hidden group border border-white/5">
              <div className="relative z-10 flex flex-col items-start w-full">
                <span className="ui-helper-xs bg-white/5 px-4 py-1.5 rounded-full border border-white/10 inline-block text-[#FF8D28] font-bold capitalize">
                  Atölye analizi
                </span>
                <h2 className="ui-title-md mt-4 tracking-tight leading-tight">
                  Atölyedeki son gelişmeler ve <span className="text-[#FF8D28]">istatistikler.</span>
                </h2>
                
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-[22px] w-full">
                  <StatBox label="Öğrenci" value="33" icon={<Users size={20} />} />
                  <StatBox label="Biten ödev" value="12" icon={<BookOpen size={20} />} />
                  <StatBox label="Bekleyen" value="14" icon={<Clock size={20} />} />
                  <StatBox label="Ortalama" value="6.2" icon={<Zap size={20} />} />
                </div>
              </div>
            </div>

            {/* SINIFLAR LİGİ */}
            <div className="col-span-12 xl:col-span-4 bg-white rounded-[32px] p-6 md:p-8 border border-surface-200 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-6">
                <h3 className="ui-title-xs flex items-center gap-2 font-bold text-text-primary">
                   <Trophy size={18} className="text-[#FF8D28]" /> Sınıflar Ligi
                </h3>
                <button 
                  onClick={() => setListType(listType === 'Haftalık' ? 'Aylık' : 'Haftalık')}
                  className="flex items-center gap-1.5 text-[#3A7BD5] hover:opacity-80 transition-opacity"
                >
                  <span className="text-xs md:text-[12px] font-medium capitalize-first">{listType}</span>
                  <Repeat size={14} className="shrink-0" />
                </button>
              </div>

              <div className="space-y-4 flex-1">
                <LeaderRow rank={1} name="Mert Demir" status="Zirvede" statusType="stable" xp="2.850" avatar="Mert" />
                <LeaderRow rank={2} name="Selin Yılmaz" status="Yükselişte" statusType="rising" xp="2.720" avatar="Selin" />
                <LeaderRow rank={3} name="Caner Aydın" status="Düşüşte" statusType="falling" xp="2.450" avatar="Caner" />
              </div>

              <div className="flex justify-end mt-8">
                <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#6F74D8] text-white hover:bg-[#5E63C2] transition-all active:scale-95">
                  <span className="text-[14px] font-semibold">Detaylar</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* TASARIM PARKURU SECTION */}
          <section className="space-y-6 pt-4">
            <div className="flex items-center gap-3">
              <Zap className="text-[#FF8D28]" size={24} />
              <h3 className="ui-title-sm text-text-primary capitalize font-bold">tasarım parkuru</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              <ParkourCard title="Kolaj Bahçesi" desc="Sürrealist kompozisyon teknikleri." tag="Ödev" status="Aktif" deadline="Son 2 Gün" iconBg="bg-[#E91E63]" btnText="Ödev Ver" icon={<Palette size={24} />} />
              <ParkourCard title="Kurumsal Kimlik" desc="Marka kimliği ve logo sistemi." tag="Proje" status="Aktif" deadline="14.02.2026" iconBg="bg-[#009688]" btnText="Proje Ver" icon={<Briefcase size={24} />} />
              <ParkourCard title="Kitap Dünyası" desc="Kitap kapağı ve tasarımı" tag="Ödev" status="Pasif" deadline="----------" iconBg="bg-[#FF8D28]" btnText="Ödev Ver" disabled icon={<BookOpen size={24} />} />
            </div>
          </section>

          {/* ÖDEV KÜTÜPHANESİ SECTION */}
          <section className="space-y-6 pb-12 pt-4">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-3 text-text-tertiary">
                <BookOpen size={20} />
                <h3 className="ui-title-xs uppercase font-bold italic opacity-70">ödev kütüphanesi</h3>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleScroll('left')} className="w-10 h-10 rounded-full border border-surface-200 bg-white flex items-center justify-center hover:border-[#FF8D28] transition-all"><ChevronLeft size={18} /></button>
                <button onClick={() => handleScroll('right')} className="w-10 h-10 rounded-full border border-surface-200 bg-white flex items-center justify-center hover:border-[#FF8D28] transition-all"><ChevronRight size={18} /></button>
              </div>
            </div>
            <div ref={scrollRef} className="flex gap-6 overflow-x-auto no-scrollbar scroll-smooth py-2">
              <LibraryCard title="Ambalaj Tasarımı" desc="Ambalaj Tasarımı Üzerine" />
              <LibraryCard title="Logo Challange" desc="Logo Etkinlik" />
              <LibraryCard title="Raketini Tasarla" desc="Outdoor Tasarımı" />
              <LibraryCard title="Reklam Bulucu" desc="Sosyal Medya Reklamları" />
              <LibraryCard title="Post Tasarımı" desc="Post Çalışmaları" />
            </div>
          </section>
        </div>

        {/* FOOTER */}
        <footer className="h-20 bg-[#10294C] text-white px-6 md:px-10 flex items-center justify-between border-t border-white/5 mt-auto">
          <div className="flex items-center gap-2">
            <span className="ui-helper-sm text-[#FF8D28] font-bold">tasarım</span>
            <span className="ui-helper-sm text-white font-bold">atölyesi</span>
          </div>
          <div className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-medium hidden lg:block">
            Copyright © Alparslan Şentürk 2026. Tüm Hakları Saklıdır.
          </div>
          <div className="flex items-center gap-4 text-white/40 shrink-0">
            <Linkedin size={18} className="cursor-pointer hover:text-[#FF8D28] transition-colors" />
            <Facebook size={18} className="cursor-pointer hover:text-[#FF8D28] transition-colors" />
            <Instagram size={18} className="cursor-pointer hover:text-[#FF8D28] transition-colors" />
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

// --- HELPER COMPONENTS ---

function SidebarLink({ icon, label, active = false }: SidebarLinkProps) {
  return (
    <div className={`flex items-center gap-4 px-6 py-4 rounded-xl transition-all cursor-pointer ${active ? 'bg-white/5 text-white' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
      <span className={active ? 'text-[#FF8D28]' : ''}>{icon}</span>
      <span className="ui-label-small font-semibold text-nowrap">{label}</span>
    </div>
  );
}

function StatBox({ label, value, icon }: StatBoxProps) {
  return (
    <div className="bg-white/5 border border-white/5 p-4 md:p-6 rounded-[24px] flex flex-col items-center justify-center text-center h-full transition-all">
      <div className="w-10 h-10 md:w-12 md:h-12 bg-white/7 rounded-[8px] flex items-center justify-center text-white/70 mb-3 md:mb-4">
        {icon}
      </div>
      <span className="ui-label-small capitalize text-white/50 mb-1 md:mb-2 font-medium">
        {label}
      </span>
      <span className="text-[20px] md:text-[28px] font-extrabold text-white leading-none tracking-tighter">
        {value}
      </span>
    </div>
  );
}

function LeaderRow({ rank, name, status, statusType, xp, avatar }: LeaderRowProps) {
  return (
    <div className="flex items-center justify-between group cursor-default p-2 -mx-2 rounded-xl hover:bg-surface-50 transition-colors">
      <div className="flex items-center gap-3 md:gap-4 truncate">
        <span className={`ui-helper-sm w-4 font-bold ${rank === 1 ? 'text-[#FF8D28]' : 'text-text-placeholder'}`}>{rank}</span>
        <div className="w-11 h-11 rounded-full border border-[#D1D5DB] p-0.5 overflow-hidden shrink-0">
          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${avatar}`} alt="Avatar" />
        </div>
        <div className="truncate flex flex-col">
          <div className="flex items-center gap-2">
            <p className="ui-label-small text-text-primary leading-none font-bold capitalize truncate">{name}</p>
            {/* İkonlar: ArrowBigUpDash & ArrowBigDownDash & Minus */}
            {statusType === 'rising' && <ArrowBigUpDash size={16} className="text-[#FF8D28]" />}
            {statusType === 'falling' && <ArrowBigDownDash size={16} className="text-text-muted" />}
            {statusType === 'stable' && <Minus size={16} className={rank === 1 ? "text-[#FF8D28]" : "text-text-muted"} />}
          </div>
          <p className={`ui-helper-xs font-semibold capitalize mt-1 tracking-tighter ${rank === 1 ? 'text-[#FF8D28]' : 'text-text-tertiary'}`}>
            {status}
          </p>
        </div>
      </div>
      <div className="text-right shrink-0 ml-2">
        {/* XP: Büyük harf, Bitişik (boşluksuz), 10px ve muted rengi */}
        <span className="ui-label-small font-bold text-text-primary">
          {xp}<span className="text-text-tertiary uppercase text-[10px]">XP</span>
        </span>
      </div>
    </div>
  );
}

function ParkourCard({ title, desc, tag, status, deadline, iconBg, btnText, icon, disabled = false }: ParkourCardProps) {
  return (
    <div className={`bg-white p-6 md:p-8 rounded-[32px] border border-surface-200 flex flex-col justify-between transition-all ${disabled ? 'opacity-50 grayscale' : 'hover:border-surface-300'}`}>
      <div className="flex justify-between items-start mb-6 md:mb-8">
        <div className={`w-12 h-12 md:w-14 md:h-14 ${iconBg} rounded-[20px] flex items-center justify-center text-white`}>{icon}</div>
        <span className="px-3 md:px-4 py-1.5 bg-[#FFF4EB] text-[#FF8D28] rounded-full text-[9px] font-black uppercase tracking-[0.1em]">{tag}</span>
      </div>
      <div className="mb-6 md:mb-8">
        <h4 className="ui-title-xs text-text-primary mb-1 capitalize font-bold">{title}</h4>
        <p className="ui-helper-xs text-text-tertiary italic line-clamp-2">{desc}</p>
      </div>
      <div className="flex items-center justify-between mb-6 md:mb-8 border-t border-surface-100 pt-6">
        <div className="flex flex-col gap-1">
          <span className="ui-label-subtle text-text-placeholder uppercase font-bold tracking-widest">Durum</span>
          <span className={`ui-helper-xs font-black ${status === 'Aktif' ? 'text-text-success' : 'text-text-tertiary'}`}>{status}</span>
        </div>
        <div className="flex flex-col gap-1 text-right">
          <span className="ui-label-subtle text-text-placeholder uppercase font-bold tracking-widest text-nowrap">Teslim</span>
          <span className="ui-helper-xs text-text-primary font-black flex items-center gap-1.5 justify-end"><Clock size={12} className="opacity-40" /> {deadline}</span>
        </div>
      </div>
      <button className={`w-full py-4 rounded-2xl ui-helper-sm uppercase transition-all font-bold ${disabled ? 'bg-surface-200 text-text-placeholder' : 'bg-[#6F74D8] text-white hover:bg-[#5E63C2] active:scale-95'}`}>
        {btnText}
      </button>
    </div>
  );
}

function LibraryCard({ title, desc }: LibraryCardProps) {
  return (
    <div className="min-w-[280px] md:min-w-[310px] bg-white p-6 md:p-7 rounded-[28px] border border-surface-100 flex flex-col justify-between h-48 transition-all group">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-surface-50 rounded-[18px] flex items-center justify-center text-text-placeholder group-hover:bg-[#10294C] group-hover:text-white transition-all">
          <Zap size={20} />
        </div>
        <div className="truncate">
          <h5 className="ui-label-small text-text-primary leading-tight mb-1 font-bold capitalize truncate">{title}</h5>
          <p className="text-[11px] text-text-tertiary italic line-clamp-2">{desc}</p>
        </div>
      </div>
      <div className="flex items-center justify-between pt-5 border-t border-surface-50">
        <span className="text-[9px] text-text-placeholder uppercase tracking-widest font-bold opacity-40">Hazır</span>
        <button className="px-5 py-2 bg-[#2C3440] text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 hover:bg-[#10294C] active:scale-90">
          Ekle <PlusCircle size={14} />
        </button>
      </div>
    </div>
  );
}