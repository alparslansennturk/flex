"use client";

import React from "react";
import { 
  LayoutDashboard, BookOpen, Trophy, Settings, LogOut, ChevronRight,
  Palette, SearchCode, Briefcase, FileText, Image as ImageIcon, Zap, Flame, 
  TrendingUp, Users, CheckCircle2, Clock, Sparkles
} from "lucide-react";

const leaderboard = [
  { id: 1, name: "Mert Demir", points: 2850, rank: 1, status: "Zirvede" },
  { id: 2, name: "Selin Yılmaz", points: 2720, rank: 2, status: "Yükselişte" },
  { id: 3, name: "Caner Aydın", points: 2450, rank: 3, status: "Stabil" },
];

const assignments = [
  { 
    id: 1, 
    title: "Kolaj Bahçesi", 
    status: "Aktif",
    statusKey: "active",
    statusColor: "text-emerald-600",
    deadline: "Teslime 2 Gün", 
    icon: <Palette size={24} />, 
    gradient: "from-pink-500 to-rose-500", 
    tag: "Popüler", 
    tagColor: "bg-rose-50 text-rose-600",
    description: "Sürrealist kompozisyon teknikleri ve katman yönetimi.",
    hint: "Eğitmen odağı: Kompozisyon"
  },
  { 
    id: 2, 
    title: "Kitap Dünyası", 
    status: "Değerlendiriliyor",
    statusKey: "evaluating",
    statusColor: "text-amber-600",
    deadline: "Süre Doldu", 
    icon: <BookOpen size={24} />, 
    gradient: "from-blue-500 to-cyan-500", 
    tag: "Yeni", 
    tagColor: "bg-cyan-50 text-cyan-600",
    description: "Editorial tasarım, tipografi ve kapak kurgusu.",
    hint: "Gözden geçirme aşamasında"
  },
  { 
    id: 3, 
    title: "Reklam Bulucu", 
    status: "Yakında",
    statusKey: "upcoming",
    statusColor: "text-slate-400",
    deadline: "15 Ocak Başlangıç", 
    icon: <SearchCode size={24} />, 
    gradient: "from-amber-500 to-orange-500", 
    tag: "Zor", 
    tagColor: "bg-orange-50 text-orange-600",
    description: "Görsel analiz, hiyerarşi ve mesaj stratejisi.",
    hint: "İçerik hazırlanıyor"
  },
  { 
    id: 4, 
    title: "Kurumsal Kimlik", 
    status: "Aktif",
    statusKey: "active",
    statusColor: "text-emerald-600",
    deadline: "Teslime 10 Gün", 
    icon: <Briefcase size={24} />, 
    gradient: "from-indigo-500 to-violet-500", 
    tag: "Yeni", 
    tagColor: "bg-indigo-50 text-indigo-600",
    description: "Marka kimliği, logo sistemi ve kurumsal dil.",
    hint: "Bu hafta aktif"
  },
  { 
    id: 5, 
    title: "Posterini Seç", 
    status: "Değerlendiriliyor",
    statusKey: "evaluating",
    statusColor: "text-amber-600",
    deadline: "Süre Doldu", 
    icon: <ImageIcon size={24} />, 
    gradient: "from-emerald-500 to-teal-500", 
    tag: "Popüler", 
    tagColor: "bg-emerald-50 text-emerald-600",
    description: "Büyük formatlı grafik anlatım ve afiş teknikleri.",
    hint: "Puanlama bekleniyor"
  },
  { 
    id: 6, 
    title: "Broşür Tasarla", 
    status: "Hazırlanıyor",
    statusKey: "upcoming",
    statusColor: "text-slate-400",
    deadline: "Şubat Dönemi", 
    icon: <FileText size={24} />, 
    gradient: "from-purple-500 to-fuchsia-500", 
    tag: "Orta", 
    tagColor: "bg-fuchsia-50 text-fuchsia-600",
    description: "Çok sayfalı mizanpaj ve katlama kuralları.",
    hint: "Müfredat güncel"
  },
];

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen bg-[#F8FAFC] font-inter antialiased text-slate-900">
      
      {/* SIDEBAR - #10294C (Base Secondary 900) */}
      <aside className="w-[280px] bg-[#10294C] text-white flex flex-col fixed h-full z-20 shadow-2xl">
        <div className="p-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#FF5C00] rounded-lg flex items-center justify-center shadow-lg shadow-orange-900/40">
              <Zap size={18} className="fill-current text-white" />
            </div>
            <div className="text-lg font-black tracking-tighter flex flex-col leading-none">
              <span>tasarım</span>
              <span className="text-white/20 text-[10px] tracking-[0.2em] uppercase mt-1">atölyesi</span>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-4 mt-2 space-y-1">
          <NavItem icon={<LayoutDashboard size={18} />} label="Atölye Özeti" active />
          <NavItem icon={<Users size={18} />} label="Öğrencilerim" />
          <NavItem icon={<BookOpen size={18} />} label="Ödev Havuzu" />
          <NavItem icon={<Trophy size={18} />} label="Sınıf Ligi" />
          <NavItem icon={<Settings size={18} />} label="Atölye Ayarları" />
        </nav>
        <div className="p-6 border-t border-white/5 mt-auto">
          <NavItem icon={<LogOut size={18} />} label="Çıkış Yap" color="hover:text-red-300" />
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 ml-[280px] flex flex-col min-h-screen">
        
        {/* HEADER */}
        <header className="h-20 bg-white/70 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-10 sticky top-0 z-30">
          <div className="flex flex-col">
            <h1 className="text-lg font-black text-slate-800 tracking-tight leading-none">
              Hoş geldin, Alparslan
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Tasarım Eğitmeni</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right border-r border-slate-200 pr-6">
              <p className="text-sm font-black text-slate-900 leading-none tracking-tight">Alparslan Şentürk</p>
              <p className="text-[10px] text-[#FF5C00] mt-1 font-bold uppercase tracking-widest leading-none">Kıdemli Eğitmen</p>
            </div>
            <div className="w-10 h-10 rounded-xl border border-slate-200 p-0.5 shadow-sm overflow-hidden bg-slate-50">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Alparslan" className="w-full h-full object-cover grayscale-[0.2]" alt="avatar" />
            </div>
          </div>
        </header>

        {/* CONTENT */}
        <div className="p-8 max-w-[1400px] mx-auto space-y-8 flex-1 w-full">
          
          <div className="grid grid-cols-12 gap-6">
            {/* STATS PANEL - #10294C */}
            <div className="col-span-12 lg:col-span-8 bg-[#10294C] rounded-[32px] p-8 text-white relative overflow-hidden shadow-xl border border-white/5">
              <div className="relative z-10 flex flex-col h-full justify-between">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#FF5C00] bg-white/5 px-3 py-1 rounded-full border border-white/10">Stüdyo Analizi</span>
                    <h2 className="text-2xl font-black mt-3 leading-tight tracking-tight text-white/95 uppercase italic">Atölye Süreçlerinde <span className="text-[#FF5C00]">Verimli</span> İlerleme.</h2>
                  </div>
                  <button className="bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl text-[10px] font-bold transition-all border border-white/10 uppercase tracking-widest">Haftalık Rapor</button>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <AdminStat label="Öğrenci" value="124" icon={<Users className="text-white/40" size={16} />} />
                  <AdminStat label="Biten" value="86" icon={<CheckCircle2 className="text-white/40" size={16} />} />
                  <AdminStat label="Bekleyen" value="38" icon={<Clock className="text-white/40" size={16} />} />
                  <AdminStat label="Sınıf Ort." value="8.4" icon={<TrendingUp className="text-white/40" size={16} />} />
                </div>
              </div>
            </div>

            <div className="col-span-12 lg:col-span-4 bg-white rounded-[32px] p-6 border border-slate-200 shadow-sm">
              <h3 className="text-sm font-black tracking-tight flex items-center gap-2 text-slate-800 mb-6 uppercase italic">
                <Trophy size={16} className="text-[#FF5C00]" /> Sınıf Ligi
              </h3>

              <div className="space-y-3">
                {leaderboard.map((user, i) => (
                  <div key={user.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 transition-all">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black text-slate-300 w-4">{i+1}</span>
                      <div>
                        <p className="text-xs font-black text-slate-800 leading-none">{user.name}</p>
                        <p className="text-[9px] font-bold text-[#FF5C00] uppercase mt-1 tracking-tighter opacity-80">{user.status}</p>
                      </div>
                    </div>
                    <p className="text-xs font-black text-slate-900">{user.points} XP</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6 pb-12">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-3">
                <Flame className="text-[#FF5C00]" size={20} />
                <h3 className="text-xl font-black tracking-tighter text-slate-800 uppercase italic">Atölye Görevleri</h3>
              </div>
              <button className="bg-[#10294C] hover:bg-[#FF5C00] text-white px-5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-md flex items-center gap-2 active:scale-95">
                Yeni Ödev Tanımla <Sparkles size={14} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {assignments.map((item) => (
                <div 
                  key={item.id} 
                  className={`group bg-white p-6 rounded-[32px] border transition-all duration-300 cursor-pointer flex flex-col h-full relative
                    ${item.statusKey === 'active' 
                      ? 'border-slate-200 hover:border-[#10294C]/20 hover:shadow-[0_20px_50px_-15px_rgba(16,41,76,0.1)] hover:-translate-y-1' 
                      : ''}
                    ${item.statusKey === 'evaluating' 
                      ? 'border-slate-200 opacity-[0.98] hover:border-amber-500/10 hover:shadow-lg hover:-translate-y-0.5' 
                      : ''}
                    ${item.statusKey === 'upcoming' 
                      ? 'border-slate-100 opacity-60 grayscale-[0.3] hover:grayscale-0 hover:opacity-100 hover:border-slate-300 cursor-default' 
                      : ''}
                  `}
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className={`w-14 h-14 bg-gradient-to-br ${item.gradient} rounded-2xl flex items-center justify-center text-white shadow-lg transition-all duration-500`}>
                      {item.icon}
                    </div>
                    <div className={`px-3 py-1 ${item.tagColor} rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm`}>
                      {item.tag}
                    </div>
                  </div>

                  <div className="flex-1 mb-6">
                    <div className="flex flex-col mb-1 overflow-hidden h-7 relative">
                      <h4 className="text-lg font-black text-slate-900 transition-all duration-300 tracking-tight group-hover:-translate-y-5">
                        {item.title}
                      </h4>
                      <span className="absolute top-0 text-[10px] font-black text-[#FF5C00] uppercase tracking-widest opacity-0 translate-y-3 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 italic">
                        {item.hint}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-slate-500 leading-relaxed italic mb-4">
                      {item.description}
                    </p>
                    
                    <div className={`flex items-center justify-between p-3 rounded-xl border transition-colors
                      ${item.statusKey === 'active' ? 'bg-[#10294C]/5 border-[#10294C]/10' : 'bg-slate-50/50 border-slate-100 shadow-inner'}
                    `}>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest leading-none">Durum</span>
                        <span className={`text-[10px] font-black tracking-tight leading-none ${item.statusColor}`}>
                          {item.status}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5 text-right">
                        <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest leading-none text-right">Süreç</span>
                        <span className="text-[10px] font-black text-slate-600 tracking-tight flex items-center gap-1 justify-end uppercase leading-none text-right">
                          <Clock size={10} className={item.deadline.includes('Son') ? 'text-red-500' : 'text-slate-400'} />
                          {item.deadline}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-200 uppercase tracking-widest italic tracking-tight leading-none">FlexOS Studio</span>
                    <button className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all
                      ${item.statusKey === 'upcoming' 
                        ? 'bg-slate-50 text-slate-300 pointer-events-none' 
                        : 'bg-[#10294C] text-white hover:bg-[#FF5C00] shadow-sm active:scale-95'
                      }
                    `}>
                      Devam Et <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FOOTER - #10294C */}
        <footer className="h-14 bg-[#10294C] px-10 flex items-center justify-between text-[10px] font-black text-white/40 uppercase tracking-[0.2em] shadow-2xl mt-auto">
          <div className="flex items-center gap-4">
             <div className="w-1.5 h-1.5 rounded-full bg-[#FF5C00] shadow-[0_0_8px_rgba(255,92,0,0.6)]" />
             <span className="text-white/80">Stüdyo Durumu: Stabil</span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="opacity-30 tracking-[0.5em] font-black text-white italic lowercase">tasarım atölyesi</span>
            <span className="w-1 h-1 bg-white/20 rounded-full" />
            <span className="opacity-50 text-white">FlexOS 2026</span>
          </div>

          <div className="flex items-center gap-6">
            <button className="text-white/80 hover:text-[#FF5C00] transition-all flex items-center gap-2 group">
              Haftalık Analiz <ChevronRight size={12} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </footer>

      </main>
    </div>
  );
}

// NavItem Component - Beyaza yakın (white/80) metinler
function NavItem({ icon, label, active = false, color = "" }: { icon: any, label: string, active?: boolean, color?: string }) {
  return (
    <a href="#" className={`flex items-center gap-4 px-6 py-3.5 rounded-xl transition-all group ${active ? 'bg-white/10 text-white shadow-xl' : `text-white/80 hover:bg-white/5 hover:text-white ${color}`}`}>
      <span className={active ? 'text-white' : 'group-hover:text-[#FF5C00] transition-colors'}>{icon}</span>
      <span className="text-sm font-black tracking-tight">{label}</span>
    </a>
  );
}

function AdminStat({ label, value, icon }: { label: string, value: string, icon: any }) {
  return (
    <div className="bg-white/5 border border-white/5 p-4 rounded-2xl flex flex-col items-center hover:bg-white/10 transition-colors cursor-default group/stat text-center h-full justify-center">
      <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center mb-2 shadow-inner group-hover/stat:scale-105 transition-transform">{icon}</div>
      <span className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em] mb-1 leading-tight">{label}</span>
      <span className="text-xl font-black text-white italic tracking-tighter leading-none">{value}</span>
    </div>
  );
}