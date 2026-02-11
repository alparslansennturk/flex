import React from "react";
import { X, ChevronDown, ChevronRight } from "lucide-react";

interface GroupFormProps {
  isFormOpen: boolean;
  isShaking: boolean;
  groupCode: string;
  setGroupCode: (val: string) => void;
  groupBranch: string;
  setGroupBranch: (val: string) => void;
  instructors: any[];
  selectedInstructorId: string;
  setSelectedInstructorId: (val: string) => void;
  errors: { code?: string; schedule?: string };
  setErrors: (val: any) => void;
  selectedSchedule: string;
  setSelectedSchedule: (val: string) => void;
  isScheduleOpen: boolean;
  setIsScheduleOpen: (val: boolean) => void;
  schedules: string[];
  customSchedule: string;
  setCustomSchedule: (val: string) => void;
  handleCancel: () => void;
  handleSave: () => void;
  scheduleRef: React.RefObject<HTMLDivElement | null>;
  isAdmin?: boolean;
}

export const GroupForm: React.FC<GroupFormProps> = ({
  isFormOpen, isShaking, groupCode, setGroupCode, groupBranch, setGroupBranch,
  instructors, selectedInstructorId, setSelectedInstructorId,
  errors, setErrors, selectedSchedule, setSelectedSchedule,
  isScheduleOpen, setIsScheduleOpen, schedules, customSchedule, setCustomSchedule,
  handleCancel, handleSave, scheduleRef, isAdmin = true
}) => {

  return (
    <div
      className={`
        grid transition-[grid-template-rows,opacity,margin] duration-500 ease-in-out
        ${isFormOpen ? "grid-rows-[1fr] opacity-100 mt-8 mb-4" : "grid-rows-[0fr] opacity-0 mt-0 mb-0"}
      `}
    >
      {/* KRİTİK DÜZELTME: isScheduleOpen true ise overflow-hidden'ı kaldırıyoruz 
        böylece liste dışarı taşabiliyor.
      */}
      <div className={`${isScheduleOpen ? "" : "overflow-hidden"}`}>
        <div className={`
          bg-white border border-neutral-200 rounded-[20px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]
          ${isShaking ? "animate-shake-fast border-red-200" : ""}
        `}>

          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[16px] font-bold text-base-primary-900 tracking-tight">Grup Yapılandırması</h3>
            <button onClick={handleCancel} className="p-2 hover:bg-neutral-50 rounded-full transition-colors cursor-pointer outline-none">
              <X size={18} className="text-neutral-400" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
            {/* Şube */}
            <div className="flex flex-col gap-2">
              <label className="text-[12px] font-bold text-neutral-400 uppercase tracking-wider ml-1">Şube</label>
              <div className="relative">
                <select
                  disabled={!isAdmin}
                  value={groupBranch}
                  onChange={(e) => setGroupBranch(e.target.value)}
                  className="w-full h-11 bg-neutral-50 border border-neutral-200 rounded-lg px-4 text-[13px] font-bold text-base-primary-900 outline-none focus:border-base-primary-500 appearance-none disabled:opacity-50 cursor-pointer"
                >
                  <option value="Kadıköy">Kadıköy</option>
                  <option value="Şirinevler">Şirinevler</option>
                  <option value="Pendik">Pendik</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
              </div>
            </div>

            {/* Eğitmen */}
            <div className="flex flex-col gap-2">
              <label className="text-[12px] font-bold text-neutral-400 uppercase tracking-wider ml-1">Sorumlu Eğitmen</label>
              <div className="relative">
                <select
                  disabled={!isAdmin}
                  value={selectedInstructorId}
                  onChange={(e) => setSelectedInstructorId(e.target.value)}
                  className="w-full h-11 bg-neutral-50 border border-neutral-200 rounded-lg px-4 text-[13px] font-bold text-base-primary-900 outline-none focus:border-base-primary-500 appearance-none disabled:opacity-50 cursor-pointer"
                >
                  <option value="">Eğitmen Seçiniz</option>
                  {instructors?.map((ins) => (
                    <option key={ins.id} value={ins.id}>
                      {ins.displayName}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
              </div>
            </div>

            {/* Grup Kodu */}
            <div className="flex flex-col gap-2">
              <label className="text-[12px] font-bold text-neutral-400 uppercase tracking-wider ml-1">Grup Kodu</label>
              <input
                type="text"
                value={groupCode}
                onChange={(e) => { setGroupCode(e.target.value); if (errors.code) setErrors({ ...errors, code: "" }); }}
                placeholder="Örn: 101"
                className={`w-full h-11 bg-neutral-50 border ${errors.code ? "border-red-300" : "border-neutral-200"} rounded-lg px-4 text-[13px] font-bold text-base-primary-900 outline-none focus:border-base-primary-500 transition-all`}
              />
            </div>

            {/* Seans */}
            <div className="flex flex-col gap-2 relative" ref={scheduleRef}>
              <label className="text-[12px] font-bold text-neutral-400 uppercase tracking-wider ml-1">Seans</label>
              <button
                onClick={() => setIsScheduleOpen(!isScheduleOpen)}
                className={`h-11 w-full bg-neutral-50 border ${errors.schedule ? "border-red-300" : "border-neutral-200"} rounded-lg px-4 flex items-center justify-between text-[13px] font-bold text-base-primary-900 cursor-pointer outline-none`}
              >
                <span className="truncate">{selectedSchedule}</span>
                <ChevronDown size={14} className={`transition-transform duration-300 text-neutral-400 ${isScheduleOpen ? "rotate-180" : ""}`} />
              </button>

              {isScheduleOpen && (
                <div className="absolute top-[calc(100%+8px)] left-0 w-full bg-white border border-neutral-200 shadow-[0_10px_30px_-5px_rgba(0,0,0,0.1)] rounded-xl py-1 z-[999] animate-in zoom-in-95 duration-200">
                  {schedules.map((s) => (
                    <button
                      key={s}
                      onClick={() => { setSelectedSchedule(s); setIsScheduleOpen(false); if (errors.schedule) setErrors({ ...errors, schedule: "" }); }}
                      className="w-full px-4 py-1.5 text-left text-[13px] font-bold text-neutral-500 hover:bg-neutral-50 hover:text-base-primary-900 transition-colors cursor-pointer"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {selectedSchedule === "Özel Grup Tanımla" && (
            <div className="mt-4 p-4 bg-neutral-50 border border-neutral-100 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest mb-2 block">Özel Seans Detayı</label>
              <input
                type="text"
                value={customSchedule}
                onChange={(e) => setCustomSchedule(e.target.value)}
                placeholder="Pzt-Sal-Çar | 10:00 - 13:00"
                className="w-full h-10 bg-white border border-neutral-200 rounded-lg px-4 text-[13px] font-semibold text-base-primary-900 outline-none focus:border-base-primary-500"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-neutral-100">
            <button onClick={handleCancel} className="px-4 py-2 text-[13px] font-bold text-neutral-400 hover:text-neutral-600 transition-all cursor-pointer">Vazgeç</button>
            <button
              onClick={handleSave}
              className="h-10 px-8 bg-[var(--color-designstudio-secondary-500)] text-white rounded-lg font-bold text-sm flex items-center gap-2 cursor-pointer shadow-md shadow-indigo-500/10 active:scale-95 transition-all outline-none"
            >
              Kaydet
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};