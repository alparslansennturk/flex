"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Users, BookOpen, Annoyed, ArrowRight, MoreVertical, ArchiveRestore, Archive } from "lucide-react";

interface GroupCardProps {
  id: string;
  code: string;
  session: string;
  branch: string;
  instructor: string;
  studentCount: number;
  activeTaskCount: number;
  submissionCount: number;
  status: string;
  onClick: () => void;
  onArchive: (id: string, archive: boolean) => void;
}

const GROUP_COLORS = [
  { bg: '#F91079', dark: '#B80E57' },
  { bg: '#1CB5AE', dark: '#0E5D59' },
  { bg: '#FF8D28', dark: '#FF7800' },
  { bg: '#6F74D8', dark: '#5E63C2' },
  { bg: '#3A7BD5', dark: '#2867BD' },
  { bg: '#4FA3A5', dark: '#42888A' },
  { bg: '#652980', dark: '#4C1F61' },
];

function getGroupColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  return GROUP_COLORS[Math.abs(hash) % GROUP_COLORS.length];
}

export default function GroupCard({
  id,
  code,
  session,
  branch,
  instructor,
  studentCount,
  activeTaskCount,
  submissionCount,
  status,
  onClick,
  onArchive,
}: GroupCardProps) {
  const color = getGroupColor(id);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isArchived = status === "archived";

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  return (
    <>
      <div
        onClick={onClick}
        className="group relative bg-white border border-surface-200 rounded-2xl p-6 cursor-pointer
          hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5 transition-all duration-200"
      >
        {/* Üst: başlık + butonlar */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[11px] font-semibold text-surface-400 tracking-wide mb-1">{branch} Şb.</p>
            <h3 className="text-[17px] font-bold text-base-primary-900 leading-tight">{code}</h3>
            <p className="text-[13px] font-medium text-surface-500 mt-0.5">{session}</p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0" ref={menuRef}>
            {/* Ok butonu */}
            <button
              onClick={(e) => { e.stopPropagation(); onClick(); }}
              className="w-9 h-9 rounded-[11px] flex items-center justify-center text-white transition-colors duration-150 shadow-sm"
              style={{ backgroundColor: color.bg }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = color.dark)}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = color.bg)}
            >
              <ArrowRight size={16} strokeWidth={2.5} />
            </button>

            {/* Üç nokta menü */}
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v); }}
                className="w-8 h-8 rounded-[9px] flex items-center justify-center text-surface-400 cursor-pointer
                  hover:bg-surface-100 hover:text-surface-600 transition-colors duration-150"
              >
                <MoreVertical size={15} strokeWidth={2.5} />
              </button>

              {menuOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 top-full mt-1.5 w-44 bg-white border border-surface-200
                    rounded-xl shadow-lg shadow-black/8 z-50 py-1 overflow-hidden"
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      if (isArchived) {
                        onArchive(id, false);
                      } else {
                        setConfirmOpen(true);
                      }
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[14px] cursor-pointer
                      text-surface-600 hover:bg-surface-50 hover:text-surface-800 transition-colors"
                  style={{ fontWeight: 400, fontVariationSettings: "'wght' 400" }}
                  >
                    {isArchived
                      ? <><ArchiveRestore size={14} className="text-base-primary-500" /> Aktife Al</>
                      : <><Archive size={14} className="text-surface-400" /> Arşive Al</>
                    }
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-surface-100 mb-4" />

        {/* İstatistikler */}
        <div className="grid grid-cols-3 gap-3">
          <Stat icon={<Users size={14} />} value={studentCount} label="Öğrenci" />
          <Stat icon={<BookOpen size={14} />} value={activeTaskCount} label="Ödev" />
          <Stat icon={<Annoyed size={14} />} value={submissionCount} label="Teslim" />
        </div>

        {/* Eğitmen */}
        <p className="mt-4 text-[12px] font-medium text-surface-400 truncate">{instructor}</p>
      </div>

      {/* Arşiv onay modalı */}
      {confirmOpen && createPortal(
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
          onClick={() => setConfirmOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-[640px] min-h-[480px] flex flex-col overflow-hidden"
          >
            {/* İçerik */}
            <div className="px-10 pt-11 pb-8 flex-1">
              <div className="flex items-center gap-3.5 mb-9">
                <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center shrink-0">
                  <Archive size={22} className="text-[#FF8D28]" />
                </div>
                <div>
                  <h2 className="text-[20px] font-bold text-base-primary-900 leading-tight">Arşive Al</h2>
                  <p className="text-[13px] text-surface-400 mt-0.5">{branch} Şubesi</p>
                </div>
              </div>

              <p className="text-[15px] text-surface-700 leading-relaxed mb-8">
                <span className="font-semibold text-base-primary-900">{code}</span> grubunu arşive almak istediğinize emin misiniz?
              </p>

              {/* Bilgi kutusu */}
              <div className="bg-orange-50 border border-orange-100 rounded-xl px-5 py-4 flex gap-3">
                <div className="w-1 rounded-full bg-[#FF8D28] shrink-0 self-stretch" />
                <div className="space-y-1">
                  <p className="text-[13px] font-semibold text-[#CC6A00]">Bu işlem ne yapar?</p>
                  <p className="text-[13px] text-orange-700/80 leading-relaxed">
                    Grup Aktif Sınıflar listesinden kaldırılır. Öğrenci ve ödev verileri korunur, Arşiv sekmesinden istediğiniz zaman tekrar aktife alabilirsiniz.
                  </p>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-surface-100 mx-10" />

            {/* Butonlar */}
            <div className="px-10 py-7 flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmOpen(false)}
                className="px-6 py-3 rounded-xl text-[14px] font-semibold text-surface-500 cursor-pointer
                  border border-surface-200 hover:bg-surface-50 hover:text-surface-700 transition-colors"
              >
                Hayır, İptal Et
              </button>
              <button
                onClick={() => { setConfirmOpen(false); onArchive(id, true); }}
                className="px-7 py-3 rounded-xl text-[14px] font-bold text-white cursor-pointer
                  bg-[#FF8D28] hover:bg-[#FF7800] transition-colors shadow-sm shadow-orange-200"
              >
                Evet, Arşive Al
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="text-surface-300">{icon}</div>
      <p className="text-[15px] font-bold text-text-primary leading-none">{value}</p>
      <p className="text-[10px] font-medium text-surface-400">{label}</p>
    </div>
  );
}
