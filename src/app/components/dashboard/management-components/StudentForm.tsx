import React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface StudentFormProps {
  isStudentFormOpen: boolean;
  studentBranch: string;
  setStudentBranch: (val: string) => void;
  selectedGroupIdForStudent: string;
  setSelectedGroupIdForStudent: (val: string) => void;
  groups: any[];
  studentName: string;
  setStudentName: (val: string) => void;
  studentLastName: string;
  setStudentLastName: (val: string) => void;
  studentEmail: string;
  setStudentEmail: (val: string) => void;
  studentNote: string;
  setStudentNote: (val: string) => void;
  studentError: string;
  setStudentError: (val: string) => void;
  handleAddStudent: () => void;
  setIsStudentFormOpen: (val: boolean) => void;
}

export const StudentForm: React.FC<StudentFormProps> = ({
  isStudentFormOpen,
  studentBranch,
  setStudentBranch,
  selectedGroupIdForStudent,
  setSelectedGroupIdForStudent,
  groups,
  studentName,
  setStudentName,
  studentLastName,
  setStudentLastName,
  studentEmail,
  setStudentEmail,
  studentNote,
  setStudentNote,
  studentError,
  setStudentError,
  handleAddStudent,
  setIsStudentFormOpen
}) => {
  return (
    <div className={`grid transition-all duration-500 ease-in-out ${isStudentFormOpen ? 'grid-rows-[1fr] opacity-100 mt-6' : 'grid-rows-[0fr] opacity-0 overflow-hidden'}`}>
      <div className="min-h-0 overflow-hidden">
        <div className="bg-white border border-neutral-200 rounded-lg p-[36px] shadow-sm mb-8">

          {/* 6'lı Grid Dağılımı */}
          <div className="grid grid-cols-[140px_140px_1fr_1fr_1fr_2fr] gap-[16px]">

            {/* 1. Şube Seçimi */}
            <div className="flex flex-col gap-2">
              <label className="text-[14px] font-medium text-base-primary-900 leading-none">Şube</label>
              <div className="relative">
                <select
                  value={studentBranch}
                  onChange={(e) => {
                    setStudentBranch(e.target.value);
                    setSelectedGroupIdForStudent("");
                    setStudentError("");
                  }}
                  className="w-full h-10 bg-neutral-50 border border-neutral-200 rounded-lg px-4 pr-10 text-[13px] focus:outline-none focus:border-base-primary-500 transition-all font-medium text-base-primary-900 appearance-none cursor-pointer outline-none"
                >
                  <option value="Kadıköy">Kadıköy</option>
                  <option value="Şirinevler">Şirinevler</option>
                  <option value="Pendik">Pendik</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
                  <ChevronDown size={16} />
                </div>
              </div>
            </div>

            {/* 2. Grup Seçimi */}
            <div className="flex flex-col gap-2">
              <label className="text-[14px] font-medium text-base-primary-900 leading-none">Grup Seçimi</label>
              <div className="relative">
                <select
                  value={selectedGroupIdForStudent}
                  onChange={(e) => { setSelectedGroupIdForStudent(e.target.value); setStudentError(""); }}
                  className="w-full h-10 bg-neutral-50 border border-neutral-200 rounded-lg px-4 pr-10 text-[13px] focus:outline-none focus:border-base-primary-500 transition-all font-medium text-base-primary-900 appearance-none cursor-pointer outline-none"
                >
                  <option value="">Grup seç...</option>

                  {/* BURAYI DEĞİŞTİRİYORUZ: Sadece seçili şubeye ait aktif grupları göster */}
                  {groups
                    .filter(g => g.status === 'active' && g.branch === studentBranch)
                    .map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.code}
                      </option>
                    ))
                  }
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
              </div>
            </div>

            {/* 3. Ad */}
            <div className="flex flex-col gap-2">
              <label className="text-[14px] font-medium text-base-primary-900 leading-none">Ad</label>
              <input
                type="text"
                value={studentName}
                onChange={(e) => { setStudentName(e.target.value); setStudentError(""); }}
                placeholder="Örn: Ela"
                className="w-full h-10 bg-neutral-50 border border-neutral-200 rounded-lg px-4 text-sm focus:outline-none focus:border-base-primary-500 transition-all font-medium text-base-primary-900 outline-none"
              />
            </div>

            {/* 4. Soyad */}
            <div className="flex flex-col gap-2">
              <label className="text-[14px] font-medium text-base-primary-900 leading-none">Soyad</label>
              <input
                type="text"
                value={studentLastName}
                onChange={(e) => { setStudentLastName(e.target.value); setStudentError(""); }}
                placeholder="Örn: Karaca"
                className="w-full h-10 bg-neutral-50 border border-neutral-200 rounded-lg px-4 text-sm focus:outline-none focus:border-base-primary-500 transition-all font-medium text-base-primary-900 outline-none"
              />
            </div>

            {/* 5. E-Posta */}
            <div className="flex flex-col gap-2">
              <label className="text-[14px] font-medium text-base-primary-900 leading-none">E-Posta</label>
              <input
                type="email"
                value={studentEmail}
                onChange={(e) => { setStudentEmail(e.target.value); setStudentError(""); }}
                placeholder="mail@ornek.com"
                className="w-full h-10 bg-neutral-50 border border-neutral-200 rounded-lg px-4 text-sm focus:outline-none focus:border-base-primary-500 transition-all font-medium text-base-primary-900 outline-none"
              />
            </div>

            {/* 6. Eğitmen Notu */}
            <div className="flex flex-col gap-2">
              <label className="text-[14px] font-medium text-base-primary-900 leading-none">Eğitmen Notu</label>
              <textarea
                rows={1}
                value={studentNote}
                onChange={(e) => setStudentNote(e.target.value)}
                className="w-full h-10 bg-neutral-50 border border-neutral-200 rounded-lg px-4 text-sm focus:outline-none focus:border-base-primary-500 transition-all font-medium text-base-primary-900 resize-none py-[9px] outline-none"
              />
            </div>
          </div>

          {/* Footer: Error & Buttons */}
          <div className="mt-8 flex items-center justify-end gap-[16px]">
            {studentError && (
              <p className="text-red-500 text-[13px] font-bold animate-shake-fast">
                {studentError}
              </p>
            )}
            <button
              onClick={handleAddStudent}
              className="h-10 px-8 bg-[var(--color-designstudio-secondary-500)] text-white rounded-lg font-bold text-sm flex items-center gap-2 cursor-pointer shadow-md shadow-indigo-500/10 active:scale-95 transition-all outline-none"
            >
              Kaydet <ChevronRight size={18} />
            </button>
            <button
              onClick={() => { setIsStudentFormOpen(false); setStudentError(""); }}
              className="h-10 px-6 bg-neutral-100 text-neutral-500 rounded-lg font-bold text-sm hover:bg-neutral-200 transition-colors outline-none cursor-pointer"
            >
              Vazgeç
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};