import React from "react";
import { X, Code2, AlertCircle, ChevronDown, Clock, ChevronRight } from "lucide-react";

interface GroupFormProps {
  isFormOpen: boolean;
  isShaking: boolean;
  groupCode: string;
  setGroupCode: (val: string) => void;
  errors: { code?: string; schedule?: string };
  setErrors: (err: any) => void;
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
}

export const GroupForm: React.FC<GroupFormProps> = ({
  isFormOpen,
  isShaking,
  groupCode,
  setGroupCode,
  errors,
  setErrors,
  selectedSchedule,
  setSelectedSchedule,
  isScheduleOpen,
  setIsScheduleOpen,
  schedules,
  customSchedule,
  setCustomSchedule,
  handleCancel,
  handleSave,
  scheduleRef
}) => {
  return (
    <div className={`grid transition-all duration-500 ease-in-out ${isFormOpen ? 'grid-rows-[1fr] opacity-100 mt-6' : 'grid-rows-[0fr] opacity-0 overflow-hidden'}`}>
      <div className="min-h-0 overflow-visible px-4 md:px-5 lg:px-3 xl:px-4 2xl:px-14">
        <div className={`bg-white border border-surface-200 rounded-[16px] p-[36px] shadow-sm relative z-20 mb-8 ${isShaking ? 'animate-shake-fast' : ''}`}>
          <div className="grid grid-cols-2 gap-[40px]">
            {/* Grup Kodu Input */}
            <div className="flex flex-col gap-2">
              <label className="text-[14px] font-medium text-base-primary-900 leading-none">Grup kodu</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={groupCode} 
                  onChange={(e) => { setGroupCode(e.target.value); setErrors({ ...errors, code: undefined }); }} 
                  placeholder="Örn: 121" 
                  className={`w-full h-12 bg-neutral-50 border rounded-lg px-4 text-sm focus:outline-none transition-all ${errors.code ? 'border-status-danger-500' : 'border-surface-300 focus:border-base-primary-500'}`} 
                />
                <Code2 size={20} className={`absolute right-4 top-1/2 -translate-y-1/2 ${errors.code ? 'text-status-danger-500' : 'text-neutral-400'}`} />
              </div>
              {errors.code && <span className="text-[13px] font-medium text-status-danger-500 flex items-center gap-1.5 pt-1 animate-in fade-in slide-in-from-top-1"><AlertCircle size={14} /> {errors.code}</span>}
            </div>

            {/* Seans Seçimi */}
            <div className="flex flex-col gap-2 relative" ref={scheduleRef}>
              <label className="text-[14px] font-medium text-base-primary-900 leading-none">Gün ve saat seçimi</label>
              <button onClick={() => setIsScheduleOpen(!isScheduleOpen)} className={`w-full h-12 bg-neutral-50 border rounded-lg px-4 flex items-center justify-between text-sm transition-all cursor-pointer ${errors.schedule ? 'border-status-danger-500' : 'border-surface-300'}`}>
                <span className={selectedSchedule.includes("seçiniz") ? "text-neutral-400" : "text-base-primary-900"}>{selectedSchedule}</span>
                <ChevronDown size={18} className={`text-neutral-400 transition-transform ${isScheduleOpen ? 'rotate-180' : ''}`} />
              </button>
              {isScheduleOpen && (
                <div className="absolute top-[52px] left-0 w-full bg-white border border-surface-200 rounded-lg shadow-sm z-50 overflow-hidden py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                  {schedules.map((s) => (
                    <button 
                      key={s} 
                      onClick={() => { setSelectedSchedule(s); setIsScheduleOpen(false); setErrors({ ...errors, schedule: undefined }); }} 
                      className="w-full text-left px-4 py-1.5 text-[13px] font-medium text-neutral-600 hover:bg-surface-50 border-b border-surface-50 last:border-0 transition-colors cursor-pointer"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {errors.schedule && <span className="text-[13px] font-medium text-status-danger-500 flex items-center gap-1.5 pt-1 animate-in fade-in slide-in-from-top-1"><AlertCircle size={14} /> {errors.schedule}</span>}
            </div>
          </div>

          {/* Özel Grup Tanımla Alanı */}
          {selectedSchedule === "Özel Grup Tanımla" && (
            <div className="mt-6 flex flex-col gap-2">
              <label className="text-[14px] font-medium text-base-primary-900 leading-none">Özel seans detaylarını girin</label>
              <div className="relative">
                <input type="text" value={customSchedule} onChange={(e) => setCustomSchedule(e.target.value)} placeholder="Örn: Salı - Perşembe | 10:00 - 13:00" className="w-full h-12 bg-neutral-50 border border-surface-300 rounded-lg px-4 text-sm focus:outline-none focus:border-base-primary-500 transition-all font-medium" />
                <Clock size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400" />
              </div>
            </div>
          )}

          {/* Butonlar */}
          <div className="mt-8 flex justify-end gap-3">
            <button onClick={handleCancel} className="px-6 h-10 bg-neutral-500 text-white rounded-lg font-bold text-sm cursor-pointer hover:bg-neutral-200 transition-colors">Vazgeç</button>
            <button onClick={handleSave} className="h-10 px-6 bg-[var(--color-designstudio-secondary-500)] text-white rounded-lg font-bold text-sm flex items-center gap-2 cursor-pointer shadow-md shadow-indigo-500/20 active:scale-95 transition-all">
              Kaydet <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};