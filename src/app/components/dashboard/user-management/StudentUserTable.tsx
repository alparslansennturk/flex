"use client";
import React from "react";
import { PenLine, Trash2 } from "lucide-react";

export const StudentUserTable = ({ students, onEdit, onDelete, onToggle }: any) => {
  return (
    <div className="bg-white rounded-[24px] border border-neutral-100 overflow-hidden shadow-sm mt-6">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-neutral-100 bg-neutral-50/50">
            <th className="p-3 xl:p-5 text-[12px] xl:text-[13px] font-bold text-neutral-500 w-64 xl:w-72">Öğrenci</th>
            <th className="p-3 xl:p-5 text-[12px] xl:text-[13px] font-bold text-neutral-500 w-24 text-left">Rol</th>
            <th className="p-3 xl:p-5 text-[12px] xl:text-[13px] font-bold text-neutral-500 w-40 text-left">Şube</th>
            <th className="p-3 xl:p-5 text-[12px] xl:text-[13px] font-bold text-neutral-500 w-32 text-left">Sınıf</th>
            <th className="p-3 xl:p-5 text-[12px] xl:text-[13px] font-bold text-neutral-500 w-52 text-left">E-Posta</th>
            <th className="p-3 xl:p-5 text-[12px] xl:text-[13px] font-bold text-neutral-500 w-36 text-left">Durum</th>
            <th className="p-3 xl:p-5 text-[12px] xl:text-[13px] font-bold text-neutral-500 text-right sticky right-0 bg-neutral-50/80 backdrop-blur-sm">İşlem</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-50">
          {students.map((student: any) => {
            const isFrozen = !!student.isFrozen;
            return (
              <tr key={student.id} className={`hover:bg-neutral-50/50 transition-colors group ${isFrozen ? 'bg-amber-50/30' : ''}`}>
                <td className="p-3 xl:p-5">
                  <div className="flex items-center gap-2 xl:gap-3 min-w-0">
                    <div className="w-8 h-8 xl:w-10 xl:h-10 rounded-full bg-neutral-100 border border-neutral-200 overflow-hidden shrink-0 shadow-sm">
                      <img
                        src={`/avatars/${student.gender === 'female' ? 'female' : 'male'}/${student.avatarId || 1}.svg`}
                        className="w-full h-full object-cover" alt=""
                        onError={(e) => { (e.target as HTMLImageElement).src = '/avatars/male/1.svg'; }}
                      />
                    </div>
                    <div className="font-bold text-[#10294C] text-[13px] xl:text-[14px] min-w-0 truncate">
                      {student.name} {student.lastName}
                    </div>
                  </div>
                </td>
                <td className="p-3 xl:p-5">
                  <span className="px-1.5 py-0.5 rounded-md text-[11px] font-bold border shadow-sm bg-purple-50 text-purple-600 border-purple-100 whitespace-nowrap">
                    Öğrenci
                  </span>
                </td>
                <td className="p-3 xl:p-5">
                  <span className="text-[12px] xl:text-[13px] font-semibold text-[#10294C] bg-neutral-100 px-2 xl:px-3 py-0.5 xl:py-1 rounded-lg border border-neutral-200 whitespace-nowrap inline-block">
                    {student.branch || "—"}
                  </span>
                </td>
                <td className="p-3 xl:p-5 text-[12px] xl:text-[13px] text-[#10294C] font-medium whitespace-nowrap">
                  {student.groupCode || "—"}
                </td>
                <td className="p-3 xl:p-5 text-[12px] xl:text-[13px] text-neutral-400 truncate">{student.email || "—"}</td>
                <td className="p-3 xl:p-5">
                  <div className="flex items-center gap-2 xl:gap-3">
                    <span className={`inline-flex items-center px-2 xl:px-2.5 py-0.5 rounded-full text-[10px] xl:text-[11px] font-bold shrink-0 ${isFrozen ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full mr-1 xl:mr-1.5 ${isFrozen ? 'bg-red-400' : 'bg-green-500'}`}></span>
                      {isFrozen ? 'Dondurulmuş' : 'Aktif'}
                    </span>
                    <button
                      type="button"
                      title={isFrozen ? 'Hesabı aç' : 'Hesabı dondur'}
                      onClick={() => {
                        const action = isFrozen ? "açmak" : "dondurmak";
                        if (window.confirm(`${student.name} ${student.lastName} hesabını ${action} istediğinize emin misiniz?`)) {
                          onToggle(student);
                        }
                      }}
                      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none cursor-pointer ${isFrozen ? 'bg-red-400' : 'bg-green-500'}`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isFrozen ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </td>
                <td className="p-3 xl:p-5 text-right sticky right-0 bg-white group-hover:bg-neutral-50/50">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => onEdit(student)} className="p-1.5 xl:p-2 text-neutral-400 hover:text-orange-500 transition-colors cursor-pointer">
                      <PenLine size={16} />
                    </button>
                    <button onClick={() => onDelete(student.id)} className="p-1.5 xl:p-2 text-neutral-400 hover:text-red-500 transition-colors cursor-pointer">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
          {students.length === 0 && (
            <tr>
              <td colSpan={7} className="py-16 text-center text-[13px] font-medium text-neutral-300">
                Gösterilecek öğrenci bulunamadı.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
