"use client";

import Sidebar from "@/app/components/layout/Sidebar";
import Header from "@/app/components/layout/Header";
import Footer from "@/app/components/layout/Footer";
import {
  Users, UsersRound, BookOpen, CheckCircle2,
  UserPlus, ChevronRight, CalendarCheck,
  ClipboardList, TrendingUp, AlertCircle, PenLine,
} from "lucide-react";

// ── Mock veriler ──────────────────────────────────────────────────────────────
const GROUPS = [
  { id: "1", name: "Grafik 1A", done: true  },
  { id: "2", name: "Grafik 2B", done: false },
  { id: "3", name: "Web Test",  done: true  },
];

const ACTIVITIES = [
  { id:"1", Icon: CheckCircle2,  bg:"bg-status-success-100",        iconCls:"text-status-success-500",         label:"Zeynep Arslan kolaj odevini yukledi",          time:"2 dk" },
  { id:"2", Icon: CalendarCheck, bg:"bg-base-primary-50",           iconCls:"text-base-primary-500",           label:"Grafik 1A icin yoklama aldin",                 time:"1 sa" },
  { id:"3", Icon: ClipboardList, bg:"bg-designstudio-secondary-50", iconCls:"text-designstudio-secondary-500", label:"Afise Giris odevini Grafik 2B ye ekledin",     time:"3 sa" },
  { id:"4", Icon: CheckCircle2,  bg:"bg-status-success-100",        iconCls:"text-status-success-500",         label:"Merve Yildiz logo tasarimini teslim etti",     time:"Dun"  },
  { id:"5", Icon: UserPlus,      bg:"bg-accent-turquoise-100",      iconCls:"text-accent-turquoise-700",       label:"Ali Kaya Web Test grubuna eklendi",            time:"2 gun"},
  { id:"6", Icon: BookOpen,      bg:"bg-designstudio-primary-50",   iconCls:"text-designstudio-primary-600",   label:"Web Test grubuna Tipografi odevini ekledin",  time:"3 gun"},
  { id:"7", Icon: AlertCircle,   bg:"bg-[#FFF7ED]",                 iconCls:"text-designstudio-primary-500",   label:"Grafik 2B — 4 ogrenci henuz teslim etmedi",   time:"4 gun"},
  { id:"8", Icon: TrendingUp,    bg:"bg-base-primary-50",           iconCls:"text-base-primary-400",           label:"Lig tablosu guncellendi — lider: Zeynep A.",  time:"5 gun"},
];

const STATS = [
  { Icon: UsersRound, accent: "#6F74D8", bg: "rgba(111,116,216,0.15)", value: "3",  label: "Toplam Grup",    sub: "Grafik + Web Tasarım" },
  { Icon: Users,      accent: "#FF8D28", bg: "rgba(255,141,40,0.15)",  value: "48", label: "Toplam Öğrenci", sub: "+2 bu ay eklendi"     },
  { Icon: BookOpen,   accent: "#4FA3A5", bg: "rgba(79,163,165,0.15)",  value: "24", label: "Bu Ay Ders",     sub: "Haftada 6 ders"       },
];
// ─────────────────────────────────────────────────────────────────────────────

// SVG donut chart
function DonutChart({ percent }: { percent: number }) {
  const r    = 46;
  const circ = 2 * Math.PI * r;
  const dash = (percent / 100) * circ;
  const gap  = circ - dash;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-[140px] h-[140px]">
        <svg width="140" height="140" viewBox="0 0 120 120">
          {/* track */}
          <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="11" />
          {/* devam (turuncu) */}
          <circle
            cx="60" cy="60" r={r}
            fill="none"
            stroke="#FF8D28"
            strokeWidth="11"
            strokeDasharray={`${dash} ${gap}`}
            strokeLinecap="round"
            transform="rotate(-90 60 60)"
          />
          {/* devamsız (beyaz soluk) */}
          <circle
            cx="60" cy="60" r={r}
            fill="none"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="11"
            strokeDasharray={`${gap} ${dash}`}
            strokeDashoffset={-dash}
            strokeLinecap="round"
            transform="rotate(-90 60 60)"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[30px] font-bold text-white leading-none tracking-tight">%{percent}</span>
          <span className="text-[10px] text-white/30 mt-1 font-medium">Devam</span>
        </div>
      </div>

      {/* Lejant */}
      <div className="space-y-2 w-full">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#FF8D28]" />
            <span className="text-[11px] text-white/40 font-medium">Devam eden</span>
          </div>
          <span className="text-[12px] font-bold text-white">%{percent}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
            <span className="text-[11px] text-white/40 font-medium">Devamsız</span>
          </div>
          <span className="text-[12px] font-bold text-white/40">%{100 - percent}</span>
        </div>
      </div>
    </div>
  );
}

export default function PortalPreviewPage() {
  const now     = new Date();
  const month   = now.toLocaleDateString("tr-TR", { month: "long" });
  const year    = now.getFullYear();
  const doneCnt = GROUPS.filter(g => g.done).length;

  return (
    <div className="flex h-screen overflow-hidden bg-[#F9FAFB] font-inter antialiased text-text-primary">

      <aside className="hidden lg:block h-full shrink-0 z-50 w-[280px] 2xl:w-[320px] bg-[#10294C]">
        <Sidebar />
      </aside>

      <div className="flex-1 flex flex-col min-w-0 relative h-full">
        <Header />

        <main className="flex-1 w-full overflow-y-scroll overflow-x-clip [scrollbar-gutter:stable]">
          <div className="w-[94%] mx-auto pt-6 pb-10 max-w-[1280px] xl:max-w-[1600px] space-y-5">

            {/* Test rozet */}
            <span className="inline-flex text-[10px] font-bold tracking-widest uppercase bg-designstudio-primary-50 text-designstudio-primary-600 border border-designstudio-primary-200 px-3 py-1 rounded-full">
              UI Önizleme — Test Modu
            </span>

            {/* ── SATIR 1: %70 Stat + %30 Not Gir ─────────────── */}
            <div className="grid grid-cols-12 gap-5 items-stretch">

              {/* Sol %70 — Navy kart: stats + donut */}
              <div className="col-span-12 xl:col-span-8 bg-[#10294C] rounded-24 overflow-hidden relative">

                {/* Dekor */}
                <div className="absolute -top-24 -right-24 w-80 h-80 bg-[#FF8D28]/8 blur-[100px] pointer-events-none" />
                <div className="absolute -bottom-16 right-1/3 w-64 h-64 bg-[#3a7bd5]/8 blur-[80px] pointer-events-none" />

                <div className="relative z-10 flex h-full">

                  {/* Sol bölüm: başlık + stats */}
                  <div className="flex-1 p-9 flex flex-col justify-between">

                    {/* Başlık */}
                    <div>
                      <p className="text-[10.5px] font-bold tracking-[0.16em] uppercase text-white/25">
                        {month} {year}
                      </p>
                      <h2 className="text-[20px] font-bold text-white mt-1.5 tracking-tight">
                        Atölye Özeti
                      </h2>
                    </div>

                    {/* 3 stat — ikon + rakam + etiket */}
                    <div className="flex flex-col gap-7 mt-8">
                      {STATS.map(s => (
                        <div key={s.label} className="flex items-center gap-4">
                          {/* Renkli ikon kutusu */}
                          <div
                            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                            style={{ background: s.bg }}
                          >
                            <s.Icon size={18} style={{ color: s.accent }} />
                          </div>

                          {/* Rakam + etiket */}
                          <div className="flex items-baseline gap-3 flex-1">
                            <span className="text-[36px] font-bold text-white leading-none tracking-tight">
                              {s.value}
                            </span>
                            <div>
                              <p className="text-[13px] font-bold text-white/70 leading-none">{s.label}</p>
                              <p className="text-[11px] text-white/25 mt-1">{s.sub}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Alt boşluk dengesi */}
                    <div />
                  </div>

                  {/* Sağ bölüm: donut chart */}
                  <div className="w-[200px] shrink-0 border-l border-white/6 flex flex-col items-center justify-center p-8 gap-2">
                    <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-white/20 mb-2">
                      Devam Oranı
                    </p>
                    <DonutChart percent={87} />
                  </div>
                </div>
              </div>

              {/* Sağ %30 — Hızlı Not */}
              <div className="col-span-12 xl:col-span-4 bg-white rounded-24 border border-surface-100 shadow-sm flex flex-col overflow-hidden">
                <div className="px-7 py-6 border-b border-surface-100 flex items-center gap-3">
                  <div className="w-9 h-9 bg-surface-50 border border-surface-100 rounded-xl flex items-center justify-center shrink-0">
                    <PenLine size={16} className="text-surface-500" />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-bold text-text-primary">Hızlı Not</h3>
                    <p className="text-[11px] text-text-placeholder mt-0.5">Gruba not ekle</p>
                  </div>
                </div>

                <div className="flex-1 divide-y divide-surface-50">
                  {GROUPS.map(g => (
                    <div key={g.id} className="flex items-center justify-between px-7 py-5 hover:bg-surface-50 transition-colors">
                      <p className="text-[14px] font-bold text-text-primary">{g.name}</p>
                      <button className="flex items-center gap-1.5 text-[12px] font-bold text-white bg-status-success-500 hover:bg-status-success-700 active:scale-95 px-4 py-2 rounded-xl transition-all cursor-pointer">
                        <PenLine size={12} /> Not Gir
                      </button>
                    </div>
                  ))}
                </div>

                <button className="w-full px-7 py-4 border-t border-surface-100 text-[12px] font-bold text-base-primary-500 hover:bg-surface-50 transition-colors cursor-pointer flex items-center justify-center gap-1">
                  Tüm Notlar <ChevronRight size={13} />
                </button>
              </div>
            </div>

            {/* ── SATIR 2: %60 Aktivite + %40 Yoklama ─────────── */}
            <div className="grid grid-cols-12 gap-5 items-stretch">

              {/* Sol %60 — Aktivite listesi */}
              <div className="col-span-12 xl:col-span-7 bg-white rounded-24 border border-surface-100 shadow-sm flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-7 py-5 border-b border-surface-100">
                  <h3 className="text-[14px] font-bold text-text-primary">Son Aktiviteler</h3>
                  <button className="flex items-center gap-0.5 text-[12px] font-bold text-base-primary-500 hover:text-base-primary-700 transition-colors cursor-pointer">
                    Tümü <ChevronRight size={13} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-surface-50">
                  {ACTIVITIES.map(a => (
                    <div key={a.id} className="flex items-center gap-4 px-7 py-3.5 hover:bg-surface-50 transition-colors">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${a.bg}`}>
                        <a.Icon size={15} className={a.iconCls} />
                      </div>
                      <p className="flex-1 text-[13px] font-semibold text-text-primary leading-snug">{a.label}</p>
                      <span className="text-[11px] text-text-placeholder shrink-0 whitespace-nowrap">{a.time}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sağ %40 — Yoklama */}
              <div className="col-span-12 xl:col-span-5 bg-white rounded-24 border border-surface-100 shadow-sm flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-7 py-5 border-b border-surface-100">
                  <div>
                    <h3 className="text-[14px] font-bold text-text-primary">Günlük Yoklama</h3>
                    <p className="text-[11px] text-text-placeholder mt-0.5">{doneCnt}/{GROUPS.length} tamamlandı</p>
                  </div>
                  {doneCnt === GROUPS.length
                    ? <CheckCircle2 size={20} className="text-status-success-500" />
                    : <span className="text-[11px] font-bold text-designstudio-primary-500 bg-designstudio-primary-50 px-3 py-1 rounded-full">{GROUPS.length - doneCnt} bekliyor</span>
                  }
                </div>

                <div className="flex-1 divide-y divide-surface-50">
                  {GROUPS.map(g => (
                    <div key={g.id} className="flex items-center justify-between px-7 py-5 hover:bg-surface-50 transition-colors">
                      <p className="text-[14px] font-bold text-text-primary">{g.name}</p>
                      {g.done ? (
                        <span className="flex items-center gap-1.5 text-[12px] font-bold text-status-success-500">
                          <CheckCircle2 size={14} /> Alındı
                        </span>
                      ) : (
                        <button className="flex items-center gap-1.5 text-[12px] font-bold text-white bg-base-primary-900 hover:bg-base-primary-800 active:scale-95 px-4 py-2 rounded-xl transition-all cursor-pointer">
                          <CalendarCheck size={13} /> Yoklama Gir
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button className="w-full px-7 py-4 border-t border-surface-100 text-[12px] font-bold text-base-primary-500 hover:bg-surface-50 transition-colors cursor-pointer flex items-center justify-center gap-1">
                  Tüm Yoklamalar <ChevronRight size={13} />
                </button>
              </div>
            </div>

            {/* Placeholders */}
            <div className="rounded-24 border-2 border-dashed border-surface-200 flex items-center justify-center h-28 text-[13px] text-surface-400 font-medium">
              Ödev Parkuru — buraya taşınacak
            </div>
            <div className="rounded-24 border-2 border-dashed border-surface-200 flex items-center justify-center h-20 text-[13px] text-surface-400 font-medium">
              Ödev Kütüphanesi — buraya taşınacak
            </div>

          </div>
        </main>

        <Footer setActiveTab={() => {}} />
      </div>
    </div>
  );
}
