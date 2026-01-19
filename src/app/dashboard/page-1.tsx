"use client";

import React, { useRef, useEffect } from "react";
import { 
  LayoutDashboard, BookOpen, Trophy, Settings, LogOut, ChevronRight,
  Palette, SearchCode, Briefcase, FileText, Image as ImageIcon, Zap, Flame, 
  TrendingUp, Users, CheckCircle2, Clock, PlusCircle, Home, ChevronLeft
} from "lucide-react";

const leaderboard = [
  { id: 1, name: "Mert Demir", points: 2850, rank: 1, status: "Zirvede", avatar: "Mert" },
  { id: 2, name: "Selin Yılmaz", points: 2720, rank: 2, status: "Yükselişte", avatar: "Selin" },
  { id: 3, name: "Caner Aydın", points: 2450, rank: 3, status: "Stabil", avatar: "Caner" },
];

const inventoryLibrary = [
  { id: 10, title: "Ambalaj Tasarımı", type: "Ürün", icon: <Zap size={18} /> },
  { id: 11, title: "Logo Challenge", type: "Yarışma", icon: <Trophy size={18} /> },
  { id: 12, title: "Raket Tasarımı", type: "Outdoor", icon: <SearchCode size={18} /> },
  { id: 13, title: "UI Challenge", type: "Web", icon: <Zap size={18} /> },
  { id: 14, title: "Sosyal Medya", type: "Dijital", icon: <ImageIcon size={18} /> },
  { id: 15, title: "Logo Sistemi", type: "Marka", icon: <Briefcase size={18} /> },
];

const realActiveAssignments = [
  { 
    id: 1, title: "Kolaj Bahçesi", status: "Aktif", statusColor: "text-emerald-600",
    deadline: "Teslime 2 Gün", icon: <Palette size={24} />, gradient: "from-pink-500 to-rose-500", 
    tag: "Popüler", tagColor: "bg-rose-50 text-rose-600", description: "Sürrealist kompozisyon teknikleri.", hint: "Eğitmen odağı: Kompozisyon"
  },
  { 
    id: 4, title: "Kurumsal Kimlik", status: "Aktif", statusColor: "text-emerald-600",
    deadline: "Teslime 10 Gün", icon: <Briefcase size={24} />, gradient: "from-indigo-500 to-violet-500", 
    tag: "Yeni", tagColor: "bg-indigo-50 text-indigo-600", description: "Marka kimliği ve logo sistemi.", hint: "Bu hafta aktif"
  }
];

export default function DashboardPage() {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Yön tuşları için event listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handleScroll('left');
      if (e.key === "ArrowRight") handleScroll('right');
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const getDisplayActive = () => {
    const count = realActiveAssignments.length;
    let list = [...realActiveAssignments];

    if (count > 0 && count < 3) {
      const substitutes = inventoryLibrary.slice(0, 3 - count).map(item => ({
        ...item, status: "Yedek", statusColor: "text-slate-400", deadline: "Atama Bekliyor",
        gradient: "from-slate-400 to-slate-500", tag: "Envanter", tagColor: "bg-slate-50 text-slate-400",
        description: `${item.title} taslağı gridi tamamlamak için çekildi.`, hint: "Boşluk doldurucu"
      }));
      list = [...list, ...substitutes];
    } else if (count > 3 && count < 6) {
      const substitutes = inventoryLibrary.slice(0, 6 - count).map(item => ({
        ...item, status: "Yedek", statusColor: "text-slate-400", deadline: "Atama Bekliyor",
        gradient: "from-slate-400 to-slate-500", tag: "Envanter", tagColor: "bg-slate-50 text-slate-400",
        description: `${item.title} taslağı gridi tamamlamak için çekildi.`, hint: "Boşluk doldurucu"
      }));
      list = [...list, ...substitutes];
    }
    return list;
  };

  const displayActive = getDisplayActive();

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.offsetWidth / 4.3; 
      const target = direction === 'left' 
        ? scrollRef.current.scrollLeft - scrollAmount 
        : scrollRef.current.scrollLeft + scrollAmount;
      scrollRef.current.scrollTo({ left: target, behavior: 'smooth' });
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] font-inter antialiased text-slate-900 overflow-x-hidden">
      
      {/* SIDEBAR */}
      <aside className="w-[280px] bg-[#10294C] text-white flex flex-col fixed h-full z-20 shadow-2xl">
        <div className="p-8">
          <div className="flex items-center gap-1 select-none cursor-default text-nowrap">
            <span className="text-[24px] tracking-tight" style={{ color: 'var(--color-designstudio-primary-500)', fontWeight: 600, fontFamily: 'Source Sans Pro, sans-serif' }}>tasarım</span>
            <span className="text-[24px] tracking-tight text-white" style={{ fontWeight: 700, fontFamily: 'Source Sans Pro, sans-serif' }}>atölyesi</span>
          </div>
        </div>
        <nav className="flex-1 px-4 mt-2 space-y-1 text-nowrap">
          <NavItem icon={<LayoutDashboard size={18} />} label="Atölye Özeti" active />
          <NavItem icon={<Users size={18} />} label="Öğrencilerim" />
          <NavItem icon={<BookOpen size={18} />} label="Ödev Havuzu" />
          <NavItem icon={<Trophy size={18} />} label="Sınıf Ligi" />
          <NavItem icon={<Settings size={18} />} label="Atölye Ayarları" />
        </nav>
        
        <div className="p-6 space-y-2 border-t border-white/5 mt-auto text-nowrap">
          <NavItem icon={<Home size={18} />} label="Ana Ekrana Dön" color="bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 mb-2" />
          <NavItem icon={<LogOut size={18} />} label="Çıkış Yap" color="hover:text-red-300" />
        </div>
      </aside>

      <main className="flex-1 ml-[280px] flex flex-col min-h-screen">
        
        {/* HEADER */}
        <header className="h-20 bg-white/70 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-10 sticky top-0 z-30">
          <div className="flex flex-col">
            <h1 className="text-lg font-black text-slate-800 tracking-tight leading-none text-nowrap">Hoş geldin, Alparslan</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 italic leading-none">Bugün yeni bir perspektif keşfetmeye ne dersin?</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right border-r border-slate-200 pr-6 text-nowrap">
              <p className="text-sm font-black text-slate-900 leading-none tracking-tight">Alparslan Şentürk</p>
              <p className="text-[10px] text-[#FF5C00] mt-1 font-bold uppercase tracking-widest leading-none">Kıdemli Eğitmen</p>
            </div>
            <div className="w-10 h-10 rounded-xl border border-slate-200 p-0.5 shadow-sm overflow-hidden bg-slate-50">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Alparslan" className="w-full h-full object-cover grayscale-[0.2]" alt="avatar" />
            </div>
          </div>
        </header>

        <div className="p-8 max-w-[1400px] mx-auto space-y-12 flex-1 w-full">
          
          <div className="grid grid-cols-12 gap-6 items-stretch">
            {/* STATS */}
            <div className="col-span-12 lg:col-span-8 bg-[#10294C] rounded-[32px] p-8 text-white relative overflow-hidden shadow-xl border border-white/5 flex flex-col justify-between">
              <div className="relative z-10 flex flex-col h-full justify-between">
                <div className="flex justify-between items-start mb-6 text-nowrap">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#FF5C00] bg-white/5 px-3 py-1 rounded-full border border-white/10">Stüdyo Analizi</span>
                    <h2 className="text-2xl font-black mt-3 leading-tight tracking-tight text-white/95 uppercase italic leading-none text-nowrap">Atölye Süreçlerinde <span className="text-[#FF5C00]">Verimli</span> İlerleme.</h2>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4 text-nowrap">
                  <AdminStat label="Öğrenci" value="124" icon={<Users className="text-white/40" size={16} />} />
                  <AdminStat label="Biten" value="86" icon={<CheckCircle2 className="text-white/40" size={16} />} />
                  <AdminStat label="Bekleyen" value="38" icon={<Clock className="text-white/40" size={16} />} />
                  <AdminStat label="Sınıf Ort." value="8.4" icon={<TrendingUp className="text-white/40" size={16} />} />
                </div>
              </div>
            </div>

            {/* LEADERBOARD CARD */}
            <div className="col-span-12 lg:col-span-4 bg-white rounded-[32px] p-6 border border-slate-200 shadow-sm flex flex-col relative overflow-hidden text-nowrap">
              <div className="flex items-center justify-between mb-8 px-1">
                <h3 className="text-sm font-black tracking-tight flex items-center gap-2 text-slate-800 uppercase italic leading-none text-nowrap"><Trophy size={16} className="text-[#FF5C00]" /> Sınıf Ligi</h3>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Haftalık</span>
              </div>
              <div className="space-y-6 flex-1">
                {leaderboard.map((user, i) => (
                  <div key={user.id} className="group flex items-center justify-between relative cursor-default">
                    <div className="flex items-center gap-4">
                      <span className={`text-[12px] font-black w-3 ${i === 0 ? 'text-[#FF5C00]' : 'text-slate-300'}`}>{i + 1}</span>
                      <div className="w-11 h-11 rounded-full bg-slate-50 border border-slate-100 overflow-hidden shadow-sm transition-transform group-hover:scale-105"><img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.avatar}`} className="w-full h-full object-cover grayscale-[0.2]" alt="avatar" /></div>
                      <div className="flex flex-col"><p className="text-[14px] font-bold text-slate-800 leading-none tracking-tight">{user.name}</p><p className={`text-[9px] font-bold uppercase mt-1.5 tracking-tighter ${i === 0 ? 'text-[#FF5C00]' : 'text-slate-400'}`}>{user.status}</p></div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right"><p className="text-[14px] font-black text-slate-900 leading-none italic">{user.points.toLocaleString()}</p><p className="text-[8px] font-black text-slate-300 uppercase mt-1">XP</p></div>
                      <ChevronRight size={14} className="text-slate-200" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* SECTION: AKTİF GÖREVLER */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 px-2">
              <Flame className="text-[#FF5C00]" size={22} />
              <h3 className="text-xl font-black tracking-tighter text-slate-800 uppercase italic leading-none text-nowrap">Atölye Görevleri</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayActive.map((item, idx) => (
                <div key={`${item.id}-${idx}`} className="group bg-white p-6 rounded-[32px] border border-slate-200 hover:border-slate-300 hover:shadow-2xl transition-all duration-300 flex flex-col relative overflow-hidden">
                  <div className="flex justify-between items-start mb-6">
                    <div className={`w-14 h-14 bg-gradient-to-br ${item.gradient} rounded-2xl flex items-center justify-center text-white shadow-lg`}>{item.icon}</div>
                    <div className={`px-3 py-1 ${item.tagColor} rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm`}>{item.tag}</div>
                  </div>
                  <div className="flex-1 mb-6">
                    <div className="flex flex-col mb-1 space-y-1">
                      <h4 className="text-lg font-black text-slate-900 leading-none">{item.title}</h4>
                      <span className="text-[10px] font-black text-[#FF5C00] uppercase italic leading-none">{item.hint}</span>
                    </div>
                    <p className="text-xs font-medium text-slate-500 italic mb-4 mt-2 leading-relaxed">{item.description}</p>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="flex flex-col gap-0.5 text-nowrap"><span className="text-[8px] font-black text-slate-300 uppercase leading-none">Durum</span><span className={`text-[10px] font-black tracking-tight ${item.statusColor}`}>{item.status}</span></div>
                      <div className="flex flex-col gap-0.5 text-right text-nowrap"><span className="text-[8px] font-black text-slate-300 uppercase leading-none text-right">Zaman</span><span className="text-[10px] font-black text-slate-600 flex items-center gap-1 justify-end uppercase"><Clock size={10} /> {item.deadline}</span></div>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-50 flex items-center justify-between mt-auto">
                    <span className="text-[10px] font-black text-slate-200 uppercase italic leading-none">FlexOS Studio</span>
                    <button className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-[10px] font-black bg-[#10294C] text-white hover:bg-[#FF5C00] transition-all uppercase shadow-sm active:scale-95">İncele <ChevronRight size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION: ÖDEV ENVANTERİ - %100 DENGELİ OKLAR */}
          <div className="space-y-6 pb-12 relative">
             <div className="flex items-center gap-3 px-2">
                <BookOpen className="text-slate-400" size={20} />
                <h3 className="text-lg font-black tracking-tighter text-slate-400 uppercase italic leading-none text-nowrap">Ödev Envanteri</h3>
             </div>

             <div className="relative px-4 overflow-visible">
                
                <button 
                  onClick={() => handleScroll('left')} 
                  className="absolute top-[80px] -translate-y-1/2 z-20 w-10 h-10 bg-white border border-slate-100 rounded-full shadow-lg flex items-center justify-center text-slate-400 hover:text-[#10294C] transition-all hover:scale-110 active:scale-90"
                  style={{ left: 'clamp(-40px, (1700px - 100vw) * 1000, -4px)' }}
                >
                  <ChevronLeft size={20} />
                </button>

                <div ref={scrollRef} className="flex gap-6 overflow-x-auto pb-6 no-scrollbar scroll-smooth snap-x snap-mandatory">
                  {inventoryLibrary.map((item) => (
                    <div 
                      key={item.id} 
                      className="min-w-[calc((100%-96px)/4.3)] snap-start bg-white p-5 rounded-[28px] border border-slate-100 hover:border-slate-300 hover:shadow-xl transition-all group cursor-pointer flex flex-col justify-between h-[160px]"
                    >
                      <div className="flex items-center gap-4">
                         <div className="w-11 h-11 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-[#10294C] group-hover:text-white transition-all">{item.icon}</div>
                         <div>
                            <h5 className="text-[13px] font-bold text-slate-800 leading-tight">{item.title}</h5>
                            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-1 block italic leading-none">{item.type} TASLAĞI</span>
                         </div>
                      </div>
                      <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                         <span className="text-[9px] font-black text-slate-200 uppercase italic leading-none">Hazır</span>
                         <button className="flex items-center gap-1.5 text-[9px] font-black text-[#10294C] hover:text-[#FF5C00] uppercase transition-colors italic">ATA <PlusCircle size={12} /></button>
                      </div>
                    </div>
                  ))}
                </div>

                <button 
                  onClick={() => handleScroll('right')} 
                  className="absolute top-[80px] -translate-y-1/2 z-20 w-10 h-10 bg-white border border-slate-100 rounded-full shadow-lg flex items-center justify-center text-slate-400 hover:text-[#10294C] transition-all hover:scale-110 active:scale-90"
                  style={{ right: 'clamp(-40px, (1700px - 100vw) * 1000, -4px)' }}
                >
                  <ChevronRight size={20} />
                </button>
             </div>
          </div>
        </div>

        <footer className="h-14 bg-[#10294C] px-10 flex items-center justify-between text-[10px] font-black text-white/40 uppercase tracking-[0.2em] shadow-2xl mt-auto border-t border-white/5">
          <div className="flex items-center gap-4 text-nowrap"><div className="w-1.5 h-1.5 rounded-full bg-[#FF5C00]" /><span className="text-white/80">Stüdyo Durumu: Stabil</span></div>
          <div className="flex items-center gap-1 opacity-80 scale-75 origin-center select-none"><span style={{ color: 'var(--color-designstudio-primary-500)', fontWeight: 600, fontFamily: 'Source Sans Pro, sans-serif' }}>tasarım</span><span className="text-white" style={{ fontWeight: 700, fontFamily: 'Source Sans Pro, sans-serif' }}>atölyesi</span></div>
          <div className="flex items-center gap-6"><button className="text-white/80 hover:text-[#FF5C00] transition-all flex items-center gap-2 group tracking-widest uppercase italic leading-none text-nowrap">Analiz <ChevronRight size={12} /></button></div>
        </footer>
      </main>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

function NavItem({ icon, label, active = false, color = "" }: { icon: any, label: string, active?: boolean, color?: string }) {
  return (
    <a href="#" className={`flex items-center gap-4 px-6 py-3.5 rounded-xl transition-all group ${active ? 'bg-white/10 text-white shadow-xl' : `text-white/80 hover:bg-white/5 hover:text-white ${color}`}`}>
      <span className={active ? 'text-white' : 'group-hover:text-[#FF5C00] transition-colors'}>{icon}</span>
      <span className="text-sm font-black tracking-tight leading-none">{label}</span>
    </a>
  );
}

function AdminStat({ label, value, icon }: { label: string, value: string, icon: any }) {
  return (
    <div className="bg-white/5 border border-white/5 p-4 rounded-2xl flex flex-col items-center hover:bg-white/10 transition-colors cursor-default group/stat text-center h-full justify-center text-nowrap">
      <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center mb-2 shadow-inner group-hover/stat:scale-105 transition-transform">{icon}</div>
      <span className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em] mb-1 leading-tight">{label}</span>
      <span className="text-xl font-black text-white italic tracking-tighter leading-none">{value}</span>
    </div>
  );
}