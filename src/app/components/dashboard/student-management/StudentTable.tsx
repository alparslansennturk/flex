import React from "react";
import { Trash2, PencilLine, RotateCcw, Users, GraduationCap } from "lucide-react";

interface StudentTableProps {
  students: any[];
  selectedStudentIds: string[];
  viewMode: string;
  groups: any[];
  studentPanel: 'active' | 'passive';
  isAdmin: boolean;
  toggleStudentSelection: (id: string) => void;
  handleSelectAll: () => void;
  handleEditStudent: (student: any) => void;
  handleRestoreStudent: (id: string) => void;
  handleGraduateStudent: (id: string) => void;
  setDeleteModal: (config: { isOpen: boolean; studentId: string; deleteType: 'active' | 'graduated' | 'graduate' }) => void;
}

export const StudentTable: React.FC<StudentTableProps> = ({
  students,
  selectedStudentIds,
  viewMode,
  groups,
  studentPanel,
  isAdmin,
  toggleStudentSelection,
  handleSelectAll,
  handleEditStudent,
  handleRestoreStudent,
  handleGraduateStudent,
  setDeleteModal
}) => {
  const isPassive = studentPanel === 'passive';
  const showBranchCol = viewMode === 'all-branches';
  const colCount = showBranchCol ? 8 : 7;

  return (
    <div className="bg-white border border-neutral-100 rounded-2xl overflow-hidden w-full mb-10 shadow-sm">
      <table className="w-full text-left border-collapse">
        <colgroup>
          <col className="w-[52px]" />
          <col className="w-[200px]" />
          <col className="w-[120px]" />
          <col className="w-[140px]" />
          <col className="w-[220px]" />
          <col className="w-[180px]" />
          {showBranchCol && <col className="w-[160px]" />}
          <col className="w-[120px]" />
        </colgroup>

        <thead>
          <tr className={`border-b transition-colors duration-300 h-12 ${selectedStudentIds.length > 0 ? "bg-base-primary-900 text-white" : "bg-neutral-100 border-neutral-200"}`}>
            <th className="px-5 text-center">
              {!isPassive && (
                <input
                  type="checkbox"
                  className="w-3.5 h-3.5 rounded border-neutral-300 cursor-pointer accent-base-primary-600"
                  onChange={handleSelectAll}
                  checked={selectedStudentIds.length === students.length && students.length > 0}
                />
              )}
            </th>

            {selectedStudentIds.length > 0 && !isPassive ? (
              <th colSpan={colCount - 1} className="px-6">
                <div className="flex items-center justify-between w-full animate-in fade-in duration-200">
                  <div className="flex items-center gap-4">
                    <span className="text-[12px] font-bold tracking-tight">{selectedStudentIds.length} Seçildi</span>
                    <div className="w-px h-4 bg-white/20" />
                    <button
                      onClick={() => setDeleteModal({ isOpen: true, studentId: "bulk", deleteType: 'active' })}
                      className="flex items-center gap-1.5 text-[12px] font-bold text-red-300 hover:text-red-100 transition-colors cursor-pointer outline-none"
                    >
                      <Trash2 size={14} /> Seçilenleri Sil
                    </button>
                  </div>
                  <button
                    onClick={() => toggleStudentSelection('clear-all' as any)}
                    className="text-[11px] font-bold text-white/50 hover:text-white transition-colors cursor-pointer underline underline-offset-4"
                  >
                    Temizle
                  </button>
                </div>
              </th>
            ) : (
              <>
                <th className="px-6 text-[14px] font-bold text-neutral-800">Öğrenci</th>
                <th className="px-6 text-[14px] font-bold text-neutral-800">Şube</th>
                <th className="px-6 text-[14px] font-bold text-neutral-800">Sınıf</th>
                <th className="px-6 text-[14px] font-bold text-neutral-800">E-Posta</th>
                <th className="px-6 text-[14px] font-bold text-neutral-800">Not</th>
                {showBranchCol && <th className="px-6 text-[14px] font-bold text-neutral-800">Eğitmen</th>}
                <th className="px-6 text-[14px] font-bold text-neutral-800 text-right pr-6">İşlem</th>
              </>
            )}
          </tr>
        </thead>

        <tbody className="divide-y divide-neutral-200">
          {students.length > 0 ? (
            students.map((student) => (
              <tr key={student.id} className="h-13 hover:bg-base-primary-50/30 transition-colors group cursor-default">
                <td className="px-5 text-center">
                  {!isPassive && (
                    <input
                      type="checkbox"
                      className="w-3.5 h-3.5 rounded border-neutral-300 cursor-pointer accent-base-primary-600"
                      checked={selectedStudentIds.includes(student.id)}
                      onChange={() => toggleStudentSelection(student.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                </td>
                <td className="px-6">
                  <span className="text-[13px] font-semibold text-neutral-900 leading-none">
                    {student.name} {student.lastName}
                  </span>
                </td>
                <td className="px-6 text-[13px] font-medium text-neutral-500 leading-none truncate">{student.branch || "—"}</td>
                <td className="px-6 text-[13px] font-medium text-neutral-500 leading-none truncate">{student.groupCode || "—"}</td>
                <td className="px-6 text-[13px] font-medium text-neutral-400 leading-none truncate">{student.email || "—"}</td>
                <td className="px-6 text-[13px] font-medium text-neutral-400 leading-none truncate">{student.note || "—"}</td>
                {showBranchCol && (
                  <td className="px-6 text-[13px] font-medium text-neutral-500 leading-none truncate">
                    {groups.find(g => g.id === student.groupId)?.instructor || "—"}
                  </td>
                )}
                <td className="px-6 pr-6 text-right">
                  <div className="flex items-center justify-end gap-3">
                    {/* Düzenle — her iki panelde de */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleEditStudent(student); }}
                      title="Düzenle"
                      className="text-[#8B5CF6] hover:text-[#6D28D9] transition-colors cursor-pointer outline-none"
                    >
                      <PencilLine size={16} />
                    </button>

                    {isPassive ? (
                      /* MEZUN PANELİ: Geri Al + Sil */
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRestoreStudent(student.id); }}
                          title="Aktife al"
                          className="text-base-primary-500 hover:text-base-primary-700 transition-colors cursor-pointer outline-none"
                        >
                          <RotateCcw size={16} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteModal({ isOpen: true, studentId: student.id, deleteType: 'graduated' });
                          }}
                          title={isAdmin ? "Kalıcı sil" : "Listeden kaldır"}
                          className="text-red-400 hover:text-red-600 transition-colors cursor-pointer outline-none"
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    ) : (
                      /* AKTİF PANELİ: Mezun Et + Sil */
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteModal({ isOpen: true, studentId: student.id, deleteType: 'graduate' }); }}
                          title="Mezun Et"
                          className="text-emerald-500 hover:text-emerald-700 transition-colors cursor-pointer outline-none"
                        >
                          <GraduationCap size={16} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteModal({ isOpen: true, studentId: student.id, deleteType: 'active' }); }}
                          title="Sil"
                          className="text-red-400 hover:text-red-600 transition-colors cursor-pointer outline-none"
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={colCount} className="py-16 text-center">
                <div className="flex flex-col items-center gap-2 text-neutral-300">
                  <Users size={32} strokeWidth={1.5} />
                  <p className="text-[13px] font-medium">Gösterilecek kayıt bulunamadı.</p>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
