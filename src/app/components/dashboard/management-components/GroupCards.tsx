import React from "react";
import { MoreVertical, Edit2, Archive, Layout, Plus, MapPin, User, RotateCcw, Trash2, PencilLine, Pencil } from "lucide-react";

interface GroupCardsProps {
  currentView: string;
  filteredGroups: any[];
  selectedGroupId: string | null;
  setSelectedGroupId: (id: string) => void;
  openMenuId: string | null;
  setOpenMenuId: (id: string | null) => void;
  handleEdit: (group: any) => void;
  requestModal: (id: string, type: 'archive' | 'delete' | 'restore') => void;
  handleOpenForm: () => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
}

export const GroupCards: React.FC<GroupCardsProps> = ({
  currentView,
  filteredGroups,
  selectedGroupId,
  setSelectedGroupId,
  openMenuId,
  setOpenMenuId,
  handleEdit,
  requestModal,
  handleOpenForm,
  menuRef
}) => {
  // --- DURUM C: ARŞİV VEYA TÜM SINIFLAR (TABLO MODU) ---
  if (currentView !== "Aktif Sınıflar") {
    return (
      <div className="px-4 md:px-5 lg:px-3 xl:px-4 2xl:px-14 w-full animate-in fade-in duration-500">
        <div className="bg-white border border-neutral-300 rounded-[16px] overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-50 border-b border-neutral-200">
                <th className="px-6 py-3 text-[14px] font-semibold text-base-primary-900 tracking-tight">Grup kodu</th>
                <th className="px-6 py-3 text-[14px] font-semibold text-base-primary-900 tracking-tight">Şube</th>
                <th className="px-6 py-3 text-[14px] font-semibold text-base-primary-900 tracking-tight">Eğitmen</th>
                <th className="px-6 py-3 text-[14px] font-semibold text-base-primary-900 tracking-tight text-center">Öğrenci</th>
                <th className="px-6 py-3 text-[14px] font-semibold text-base-primary-900 tracking-tight text-right pr-8">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {filteredGroups.map((group) => (
                <tr key={group.id} className="border-b border-neutral-100 last:border-0 hover:bg-surface-50/50 transition-colors">
                  <td className="px-6 py-3 font-bold text-base-primary-700">{group.code}</td>
                  <td className="px-6 py-3 text-[14px] text-neutral-600 font-medium"><div className="flex items-center gap-2"><MapPin size={14} className="text-neutral-400" />{group.branch}</div></td>
                  <td className="px-6 py-3 text-[14px] text-neutral-600 font-medium"><div className="flex items-center gap-2"><User size={14} className="text-neutral-400" />{group.instructor}</div></td>
                  <td className="px-6 py-3 text-center font-bold text-neutral-700">{group.students}</td>
                  <td className="px-6 py-3 text-right pr-8">
                    {currentView === "Arşiv" ? (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => requestModal(group.id, 'restore')}
                          className="p-2 text-base-primary-500 hover:bg-neutral-50 rounded-lg cursor-pointer transition-colors"
                          title="Geri Yükle"
                        >
                          <RotateCcw size={18} />
                        </button>
                        <button
                          onClick={() => requestModal(group.id, 'delete')}
                          className="p-2 text-red-500 hover:bg-neutral-50 rounded-lg cursor-pointer transition-colors"
                          title="Tamamen Sil"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ) : (
                      /* BURASI: "Tüm Sınıflar" sekmesindeki tertemiz ikon alanı */
                      <div className="flex justify-end items-center gap-1">

                        {/* 1. DÜZENLE (Lila / Design Secondary) */}
                        <button
                          onClick={() => handleEdit(group)}
                          className="p-2 rounded-lg cursor-pointer transition-all duration-200 hover:bg-neutral-50 group/table-edit"
                          title="Düzenle"
                        >
                          <PencilLine
                            size={18}
                            className="text-[#8B5CF6] group-hover/table-edit:text-[#6D28D9] transition-colors"
                          />
                        </button>

                        {/* 2. ARŞİVE GÖNDER (Kibar Gri / Neutral) */}
                        <button
                          onClick={() => requestModal(group.id, 'archive')}
                          className="p-2 rounded-lg cursor-pointer transition-all duration-200 hover:bg-neutral-50 group/table-archive"
                          title="Arşive Gönder"
                        >
                          <Archive
                            size={18}
                            className="text-neutral-400 group-hover/table-archive:text-neutral-900 transition-colors"
                          />
                        </button>

                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // --- DURUM B: GRUP YOKSA (EMPTY STATE) ---
  if (filteredGroups.length === 0) {
    return (
      <div className="px-4 md:px-5 lg:px-3 xl:px-4 2xl:px-14 pr-8 w-full animate-in fade-in zoom-in-95 duration-500">
        <div className="w-full py-12 bg-white border border-dashed border-neutral-300 rounded-[20px] flex flex-col items-center justify-center text-center shadow-sm">
          <div className="w-14 h-14 bg-neutral-50 rounded-2xl flex items-center justify-center text-neutral-300 mb-4 border border-neutral-100">
            <Layout size={28} strokeWidth={1.5} />
          </div>
          <h3 className="text-[16px] font-bold text-neutral-700 mb-1">Aktif Grup Tanımı Bulunmuyor</h3>
          <p className="text-[13px] font-medium text-neutral-400 max-w-[320px] leading-relaxed">Sistemi kullanmaya başlamak için önce bir eğitim grubu oluşturmalısınız.</p>
          <button onClick={handleOpenForm} className="mt-6 px-6 py-2.5 bg-base-primary-700 text-white rounded-xl text-[13px] font-bold hover:bg-base-primary-800 transition-all cursor-pointer shadow-lg shadow-base-primary-700/20 active:scale-95 flex items-center gap-2 outline-none">
            <Plus size={18} /> Yeni Grup Oluştur
          </button>
        </div>
      </div>
    );
  }

  // --- DURUM A: GRUP VARSA KARTLAR ---
  return (
    <div className="px-4 md:px-5 lg:px-3 xl:px-4 2xl:px-14 flex flex-wrap gap-6 animate-in fade-in duration-500">
      {filteredGroups.map((group) => {
        const isActive = selectedGroupId === group.id;
        return (
          <div
            key={group.id}
            onClick={() => setSelectedGroupId(group.id)}
            className={`relative w-[256px] h-[116px] rounded-[16px] p-6 transition-all cursor-pointer group ${isActive
              ? "bg-base-primary-700 text-white shadow-xl scale-[1.02]"
              : "bg-white border border-neutral-300 text-text-primary hover:bg-base-primary-700 hover:text-white hover:border-transparent"
              }`}
          >
            <button
              onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === group.id ? null : group.id); }}
              className={`absolute top-4 right-4 p-1 rounded-lg transition-colors cursor-pointer ${isActive ? "text-white/60 hover:bg-white/10" : "text-neutral-400 group-hover:text-white/60"
                }`}
            >
              <MoreVertical size={20} />
            </button>

            {openMenuId === group.id && (
              <div ref={menuRef} className="absolute top-12 right-4 w-48 bg-white rounded-xl shadow-2xl border border-neutral-200 z-[60] overflow-hidden py-1.5 animate-in fade-in zoom-in-95 duration-200 cursor-default">

                {/* 1. DÜZENLE (Zemin nötr gri, içerik lila) */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleEdit(group); }}
                  className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-neutral-700 hover:bg-neutral-50 flex items-center gap-3 cursor-pointer transition-all duration-200 group/edit"
                >
                  <PencilLine
                    size={18}
                    className="text-[#8B5CF6] group-hover/edit:text-[#6D28D9] transition-colors"
                  />
                  <span className="group-hover/edit:text-[#6D28D9] transition-colors">
                    Düzenle
                  </span>
                </button>

                {/* 2. ARŞİVE EKLE (Zemin aynı nötr gri, içerik gri) */}
                <button
                  onClick={(e) => { e.stopPropagation(); requestModal(group.id, 'archive'); }}
                  className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-neutral-700 hover:bg-neutral-50 flex items-center gap-3 cursor-pointer transition-all duration-200 group/archive"
                >
                  <Archive
                    size={18}
                    className="text-neutral-400 group-hover/archive:text-neutral-900 transition-colors"
                  />
                  <span className="group-hover/archive:text-neutral-900 transition-colors">
                    Arşive ekle
                  </span>
                </button>

              </div>
            )}

            <div className="flex flex-col h-full justify-between pointer-events-none">
              <div>
                <p className={`text-[14px] font-semibold leading-none mb-2 transition-colors ${isActive ? "text-white/60" : "text-text-primary group-hover:text-white/60"
                  }`}>
                  {group.code}
                </p>
                <p className={`text-[16px] font-bold leading-none transition-colors ${isActive ? "text-white" : "text-base-primary-700 group-hover:text-white"
                  }`}>
                  {group.session}
                </p>
              </div>
              <p className={`text-[14px] font-semibold leading-none transition-colors ${isActive ? "text-white/60" : "text-text-primary group-hover:text-white/60"
                }`}>
                Öğrenci Sayısı: {group.students}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};