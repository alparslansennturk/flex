import React from "react";
import { Trash2, PencilLine, MapPin, User as UserIcon } from "lucide-react";

interface StudentTableProps {
  students: any[];
  selectedStudentIds: string[];
  viewMode: string;
  groups: any[];
  toggleStudentSelection: (id: string) => void;
  handleSelectAll: () => void;
  handleEditStudent: (student: any) => void;
  setDeleteModal: (config: { isOpen: boolean; studentId: string }) => void;
}

export const StudentTable: React.FC<StudentTableProps> = ({
  students,
  selectedStudentIds,
  viewMode,
  groups,
  toggleStudentSelection,
  handleSelectAll,
  handleEditStudent,
  setDeleteModal
}) => {
  return (
    <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden mb-12 shadow-sm">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className={`border-b border-neutral-200 transition-all duration-300 ${selectedStudentIds.length > 0 ? "bg-base-primary-900 text-white h-14" : "bg-neutral-50/30 h-10"}`}>
            <th className="px-6 w-10 text-center">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-neutral-300 text-base-primary-600 focus:ring-base-primary-500 cursor-pointer accent-base-primary-600"
                onChange={handleSelectAll}
                checked={selectedStudentIds.length === students.length && students.length > 0}
              />
            </th>

            {selectedStudentIds.length > 0 ? (
              <th colSpan={viewMode === 'all-branches' ? 7 : 6} className="px-8">
                <div className="flex items-center justify-between w-full animate-in fade-in duration-300">
                  <div className="flex items-center gap-4">
                    <span className="text-[13px] font-bold uppercase tracking-widest">{selectedStudentIds.length} Seçildi</span>
                    <div className="w-px h-4 bg-white/20" />
                    <button
                      onClick={() => setDeleteModal({ isOpen: true, studentId: "bulk" })}
                      className="flex items-center gap-2 text-[13px] font-bold text-red-300 hover:text-red-100 transition-colors cursor-pointer outline-none"
                    >
                      <Trash2 size={16} /> Seçilenleri Sil
                    </button>
                  </div>
                  <button
                    onClick={() => toggleStudentSelection('clear-all' as any)} // Ana dosyada [] set etmek için
                    className="text-[12px] font-bold text-white/50 hover:text-white transition-colors cursor-pointer underline underline-offset-4"
                  >
                    Temizle
                  </button>
                </div>
              </th>
            ) : (
              <>
                <th className="px-8 text-[14px] font-bold text-base-primary-900">Öğrenci İsmi</th>
                <th className="px-8 text-[14px] font-bold text-base-primary-900">Şube</th>
                <th className="px-8 text-[14px] font-bold text-base-primary-900">Grup Kodu</th>
                <th className="px-8 text-[14px] font-bold text-base-primary-900">E-Posta Adresi</th>
                <th className="px-8 text-[14px] font-bold text-base-primary-900">Eğitmen Notu</th>
                {viewMode === 'all-branches' && <th className="px-8 text-[14px] font-bold text-base-primary-900">Eğitmen</th>}
                <th className="px-8 text-[14px] font-bold text-base-primary-900 text-right pr-8">Aksiyonlar</th>
              </>
            )}
          </tr>
        </thead>

        <tbody className="divide-y divide-neutral-200">
          {students.length > 0 ? (
            students.map((student) => (
              <tr key={student.id} className={`h-14 transition-colors group cursor-pointer ${student.status === 'passive' ? 'bg-neutral-50/30 opacity-70' : 'hover:bg-neutral-50/50'}`}>
                <td className="px-6 w-10 text-center">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-neutral-300 text-base-primary-600 focus:ring-base-primary-500 cursor-pointer accent-base-primary-600"
                    checked={selectedStudentIds.includes(student.id)}
                    onChange={() => toggleStudentSelection(student.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </td>
                <td className="px-8 text-[14px] font-semibold text-base-primary-900 leading-none">
                  {student.name} {student.lastName}
                  {student.status === 'passive' && <span className="ml-2 text-[10px] font-bold uppercase tracking-widest text-neutral-400">Mezun</span>}
                </td>
                <td className="px-8 text-[13px] font-medium text-neutral-600 leading-none">{student.branch}</td>
                <td className="px-8 text-[13px] font-medium text-neutral-600 leading-none">{student.groupCode}</td>
                <td className="px-8 text-[13px] font-medium text-neutral-500 leading-none">{student.email || "-"}</td>
                <td className="px-8 text-[13px] font-medium text-neutral-500 leading-none max-w-[180px] truncate">{student.note || "-"}</td>
                {viewMode === 'all-branches' && (
                  <td className="px-8 text-[13px] font-medium text-neutral-600 leading-none">
                    {groups.find(g => g.id === student.groupId)?.instructor || "-"}
                  </td>
                )}
                <td className="px-8 text-right pr-8">
                  <div className="flex items-center justify-end gap-4">
                    <button onClick={(e) => { e.stopPropagation(); handleEditStudent(student); }} className="text-base-primary-400 hover:text-base-primary-600 transition-colors"><PencilLine size={18} /></button>
                    <button onClick={(e) => { e.stopPropagation(); setDeleteModal({ isOpen: true, studentId: student.id }); }} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 size={18} /></button>
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={viewMode === 'all-branches' ? 8 : 7} className="py-20 text-center text-neutral-400 font-medium text-[14px]">Gösterilecek kayıt bulunamadı.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};