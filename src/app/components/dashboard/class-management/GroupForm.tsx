"use client";
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X, ChevronDown, Check, Users, Calendar } from "lucide-react";
import { DayCalendarPopover } from "@/app/components/dashboard/attendance/CalendarPopover";

interface GroupFormProps {
  isFormOpen: boolean;
  editingGroupId?: string | null;
  groupCode: string;
  setGroupCode: (val: string) => void;
  groupBranch: string;
  setGroupBranch: (val: string) => void;
  groupDiscipline: string;
  setGroupDiscipline: (val: string) => void;
  availableBranches: { id: string; name: string }[];
  groupModule: "GRAFIK_1" | "GRAFIK_2" | "";
  setGroupModule: (val: "GRAFIK_1" | "GRAFIK_2" | "") => void;
  groupType: "standart" | "özel_ders" | "kurumsal";
  setGroupType: (val: "standart" | "özel_ders" | "kurumsal") => void;
  selectedModuleId: string;
  setSelectedModuleId: (val: string) => void;
  customHours: string;
  setCustomHours: (val: string) => void;
  companyName: string;
  setCompanyName: (val: string) => void;
  branchModules: { id: string; name: string; totalHours: number; sessionHours?: number }[];
  instructors: { id: string; displayName: string; branches?: string[] }[];
  selectedInstructorId: string;
  setSelectedInstructorId: (val: string) => void;
  lessonHours: string;
  setLessonHours: (val: string) => void;
  groupStartDate: string;
  setGroupStartDate: (val: string) => void;
  errors: { code?: string; schedule?: string; instructor?: string; duplicate?: string };
  setErrors: (val: { code?: string; schedule?: string; instructor?: string; duplicate?: string }) => void;
  selectedSchedule: string;
  setSelectedSchedule: (val: string) => void;
  isScheduleOpen?: boolean;
  setIsScheduleOpen?: (val: boolean) => void;
  schedules: string[];
  customSchedule: string;
  setCustomSchedule: (val: string) => void;
  handleCancel: () => void;
  handleSave: () => Promise<void> | void;
  scheduleRef?: React.RefObject<HTMLDivElement | null>;
  isAdmin?: boolean;
}

export const GroupForm: React.FC<GroupFormProps> = ({
  isFormOpen, editingGroupId,
  groupCode, setGroupCode, groupBranch, setGroupBranch,
  groupDiscipline, setGroupDiscipline, availableBranches,
  groupModule, setGroupModule,
  groupType, setGroupType, selectedModuleId, setSelectedModuleId,
  customHours, setCustomHours, companyName, setCompanyName, branchModules,
  instructors, selectedInstructorId, setSelectedInstructorId,
  lessonHours, setLessonHours,
  groupStartDate, setGroupStartDate,
  errors, setErrors, selectedSchedule, setSelectedSchedule,
  schedules, customSchedule, setCustomSchedule,
  handleCancel, handleSave, isAdmin = true,
}) => {
  const [loading, setLoading]     = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [shake, setShake]         = useState(false);
  const [dateDisplay, setDateDisplay] = useState("");
  const [isLocDropOpen, setIsLocDropOpen]           = useState(false);
  const [locDropPos, setLocDropPos]                 = useState({ top: 0, left: 0, width: 0 });
  const [isDisciplineDropOpen, setIsDisciplineDropOpen] = useState(false);
  const [disciplineDropPos, setDisciplineDropPos]   = useState({ top: 0, left: 0, width: 0 });
  const [isInstructorDropOpen, setIsInstructorDropOpen] = useState(false);
  const [instructorDropPos, setInstructorDropPos]   = useState({ top: 0, left: 0, width: 0 });
  const [isScheduleDropOpen, setIsScheduleDropOpen] = useState(false);
  const [scheduleDropPos, setScheduleDropPos]       = useState({ top: 0, left: 0, width: 0 });
  const [isModuleDropOpen, setIsModuleDropOpen]     = useState(false);
  const [moduleDropPos, setModuleDropPos]           = useState({ top: 0, left: 0, width: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!isFormOpen) {
      setIsSuccess(false); setLoading(false);
      setIsLocDropOpen(false); setIsDisciplineDropOpen(false);
      setIsInstructorDropOpen(false); setIsScheduleDropOpen(false); setIsModuleDropOpen(false);
    }
  }, [isFormOpen]);

  // groupStartDate (YYYY-MM-DD) → dd/mm/yy görüntüsünü senkronize et
  useEffect(() => {
    if (groupStartDate && /^\d{4}-\d{2}-\d{2}$/.test(groupStartDate)) {
      const [y, m, d] = groupStartDate.split("-");
      setDateDisplay(`${d}/${m}/${y}`);
    } else if (!groupStartDate) {
      setDateDisplay("");
    }
  }, [groupStartDate]);

  const handleDateInput = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    let formatted = digits;
    if (digits.length > 2) formatted = digits.slice(0, 2) + "/" + digits.slice(2);
    if (digits.length > 4) formatted = formatted.slice(0, 5) + "/" + digits.slice(4);
    setDateDisplay(formatted);

    // 8 rakam tamam → YYYY-MM-DD'ye çevir ve kaydet
    if (digits.length === 8) {
      const dd   = digits.slice(0, 2);
      const mm   = digits.slice(2, 4);
      const yyyy = digits.slice(4, 8);
      const d = new Date(`${yyyy}-${mm}-${dd}`);
      if (!isNaN(d.getTime())) setGroupStartDate(`${yyyy}-${mm}-${dd}`);
    } else {
      setGroupStartDate("");
    }
  };

  useEffect(() => {
    const hasErrors = Object.values(errors).some(Boolean);
    if (!hasErrors) return;
    setShake(true);
    const t = setTimeout(() => setShake(false), 400);
    return () => clearTimeout(t);
  }, [errors]);

  const handleDisciplineChange = (val: string) => {
    setGroupDiscipline(val);
    setSelectedModuleId("");
    const name = availableBranches.find(b => b.id === val)?.name?.toLowerCase() ?? "";
    if (!name.includes("grafik")) setGroupModule("");
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await handleSave();
      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), 1500);
    } finally {
      setLoading(false);
    }
  };

  const inputBase   = "h-12 w-full border rounded-[12px] px-4 outline-none transition-all font-bold text-[14px] placeholder:text-neutral-400 placeholder:font-normal";
  const inputNormal = `${inputBase} border-neutral-100 bg-neutral-50 focus:border-designstudio-secondary-400 focus:bg-white`;
  const inputError  = `${inputBase} border-red-400 bg-red-50`;
  const selectBase  = `${inputBase} appearance-none cursor-pointer pr-10`;

  // Seçili branşa göre eğitmen filtrele (branches dizisi yoksa veya boşsa herkese göster)
  const visibleInstructors = groupDiscipline
    ? instructors.filter(i => !i.branches || i.branches.length === 0 || i.branches.includes(groupDiscipline))
    : instructors;

  const dropProps = {
    initial: { opacity: 0, y: -6, scaleY: 0.92 as number },
    animate: { opacity: 1, y: 0, scaleY: 1 as number },
    exit:    { opacity: 0, y: -6, scaleY: 0.92 as number },
    transition: { duration: 0.15 },
  };

  return (
    <>
    <div className={`relative w-full bg-white rounded-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-[#10294C] ${shake ? "error-shake" : ""}`}>

      {/* Header */}
      <div className="bg-[#10294C] p-6 text-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-designstudio-secondary-500 rounded-[12px] flex items-center justify-center shadow-lg shadow-designstudio-secondary-500/30">
            <Users size={24} strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="text-[20px] font-bold">
              {editingGroupId ? "Grubu Düzenle" : "Yeni Grup Oluştur"}
            </h3>
            <p className="text-white/50 text-[13px] font-medium">
              Grup bilgilerini ve program detaylarını buradan yönetin.
            </p>
          </div>
        </div>
        <button type="button" onClick={handleCancel} className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer">
          <X size={20} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-10 space-y-8 custom-scrollbar">

        {/* Grup tipi */}
        <div className="flex items-center gap-1 bg-neutral-100 w-fit p-1 rounded-xl">
          {([
            { id: "standart"  as const, label: "Standart" },
            { id: "özel_ders" as const, label: "Özel Ders" },
            { id: "kurumsal"  as const, label: "Kurumsal" },
          ]).map(t => (
            <button
              key={t.id} type="button"
              onClick={() => { setGroupType(t.id); setSelectedModuleId(""); setCustomHours(""); setCompanyName(""); }}
              className={`px-5 py-2 rounded-[10px] text-[13px] font-bold transition-all cursor-pointer ${
                groupType === t.id ? "bg-white text-designstudio-secondary-700 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Satır 1: Şube · Branş · Grup Kodu */}
        <div className="grid grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-[13px] font-semibold text-neutral-500 ml-1">Şube</label>
            <div onClick={(e) => { if (!isLocDropOpen) { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setLocDropPos({ top: r.bottom + 4, left: r.left, width: r.width }); } setIsLocDropOpen(!isLocDropOpen); }} className={`h-12 w-full border-2 rounded-[12px] px-4 flex items-center justify-between cursor-pointer transition-all duration-200 ${isLocDropOpen ? 'border-orange-500 bg-white' : 'border-neutral-100 bg-neutral-50'}`}>
              <span className={`text-[14px] ${groupBranch ? 'font-bold text-[#10294C]' : 'font-normal text-neutral-400'}`}>{groupBranch || 'Seçiniz...'}</span>
              <ChevronDown size={16} className={`shrink-0 transition-transform duration-300 ${isLocDropOpen ? 'rotate-180 text-orange-500' : 'text-neutral-400'}`} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[13px] font-semibold text-neutral-500 ml-1">Branş</label>
            <div onClick={(e) => { if (!isDisciplineDropOpen) { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setDisciplineDropPos({ top: r.bottom + 4, left: r.left, width: r.width }); } setIsDisciplineDropOpen(!isDisciplineDropOpen); }} className={`h-12 w-full border-2 rounded-[12px] px-4 flex items-center justify-between cursor-pointer transition-all duration-200 ${isDisciplineDropOpen ? 'border-orange-500 bg-white' : 'border-neutral-100 bg-neutral-50'}`}>
              <span className={`text-[14px] ${groupDiscipline ? 'font-bold text-[#10294C]' : 'font-normal text-neutral-400'}`}>{availableBranches.find(b => b.id === groupDiscipline)?.name || 'Seçiniz...'}</span>
              <ChevronDown size={16} className={`shrink-0 transition-transform duration-300 ${isDisciplineDropOpen ? 'rotate-180 text-orange-500' : 'text-neutral-400'}`} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[13px] font-semibold text-neutral-500 ml-1">Grup Kodu</label>
            <input
              type="text"
              value={groupCode}
              onChange={e => { setGroupCode(e.target.value); if (errors.code || errors.duplicate) setErrors({ ...errors, code: "", duplicate: "" }); }}
              placeholder="Örn: 101"
              className={errors.code ? inputError : inputNormal}
            />
          </div>
        </div>

        {/* Satır 2: Eğitmen · Seans · Ders Saati · Başlangıç Tarihi */}
        <div className="grid grid-cols-4 gap-6">
          <div className="space-y-2">
            <label className="text-[13px] font-semibold text-neutral-500 ml-1">Sorumlu Eğitmen</label>
            {!isAdmin ? (
              <div className={`${inputNormal} flex items-center opacity-70 cursor-not-allowed`}>
                {instructors.find(i => i.id === selectedInstructorId)?.displayName || "Eğitmen Tanımlanıyor..."}
              </div>
            ) : (
              <div onClick={(e) => { if (!isInstructorDropOpen) { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setInstructorDropPos({ top: r.bottom + 4, left: r.left, width: r.width }); } setIsInstructorDropOpen(!isInstructorDropOpen); }} className={`h-12 w-full border-2 rounded-[12px] px-4 flex items-center justify-between cursor-pointer transition-all duration-200 ${errors.instructor ? 'border-red-400 bg-red-50' : isInstructorDropOpen ? 'border-orange-500 bg-white' : 'border-neutral-100 bg-neutral-50'}`}>
                <span className={`text-[14px] ${selectedInstructorId ? 'font-bold text-[#10294C]' : 'font-normal text-neutral-400'}`}>{visibleInstructors.find(i => i.id === selectedInstructorId)?.displayName || 'Eğitmen Seçiniz'}</span>
                <ChevronDown size={16} className={`shrink-0 transition-transform duration-300 ${isInstructorDropOpen ? 'rotate-180 text-orange-500' : 'text-neutral-400'}`} />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-[13px] font-semibold text-neutral-500 ml-1">Seans</label>
            <div onClick={(e) => { if (!isScheduleDropOpen) { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setScheduleDropPos({ top: r.bottom + 4, left: r.left, width: r.width }); } setIsScheduleDropOpen(!isScheduleDropOpen); }} className={`h-12 w-full border-2 rounded-[12px] px-4 flex items-center justify-between cursor-pointer transition-all duration-200 ${errors.schedule ? 'border-red-400 bg-red-50' : isScheduleDropOpen ? 'border-orange-500 bg-white' : 'border-neutral-100 bg-neutral-50'}`}>
              <span className={`text-[14px] truncate ${selectedSchedule && selectedSchedule !== 'Grup seansı seçiniz...' ? 'font-bold text-[#10294C]' : 'font-normal text-neutral-400'}`}>{selectedSchedule && selectedSchedule !== 'Grup seansı seçiniz...' ? selectedSchedule : 'Grup seansı seçiniz...'}</span>
              <ChevronDown size={16} className={`shrink-0 transition-transform duration-300 ${isScheduleDropOpen ? 'rotate-180 text-orange-500' : 'text-neutral-400'}`} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[13px] font-semibold text-neutral-500 ml-1">Ders Saati</label>
            <input
              type="number" min={1} max={12}
              value={lessonHours}
              onChange={e => setLessonHours(e.target.value)}
              placeholder="3"
              className={inputNormal}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[13px] font-semibold text-neutral-500 ml-1">Başlangıç Tarihi</label>
            <DayCalendarPopover
              value={groupStartDate ? new Date(groupStartDate + "T12:00:00") : new Date()}
              onChange={d => setGroupStartDate(d.toISOString().slice(0, 10))}
            >
              <div className="relative">
                <input
                  type="text"
                  value={dateDisplay}
                  onChange={e => handleDateInput(e.target.value)}
                  onClick={e => e.stopPropagation()}
                  placeholder="gg/aa/yyyy"
                  maxLength={10}
                  className={inputNormal}
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 cursor-pointer">
                  <Calendar size={14} />
                </span>
              </div>
            </DayCalendarPopover>
          </div>
        </div>

        {/* Satır 3: Modül + Özel alanlar + Aylık Ders Sayısı */}
        <div className="grid grid-cols-4 gap-6">
          {groupType === "standart" && (
            <div className="col-span-2 space-y-2">
              <label className={`text-[13px] font-semibold ml-1 ${branchModules.length > 0 ? "text-neutral-500" : "text-neutral-300"}`}>
                Modül
              </label>
              <div onClick={(e) => { if (branchModules.length === 0) return; if (!isModuleDropOpen) { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setModuleDropPos({ top: r.bottom + 4, left: r.left, width: r.width }); } setIsModuleDropOpen(!isModuleDropOpen); }} className={`h-12 w-full border-2 rounded-[12px] px-4 flex items-center justify-between transition-all duration-200 ${branchModules.length === 0 ? 'border-neutral-100 bg-neutral-100 cursor-not-allowed opacity-60' : isModuleDropOpen ? 'border-orange-500 bg-white cursor-pointer' : 'border-neutral-100 bg-neutral-50 cursor-pointer'}`}>
                <span className={`text-[14px] truncate ${selectedModuleId ? 'font-bold text-[#10294C]' : branchModules.length === 0 ? 'text-neutral-300' : 'font-normal text-neutral-400'}`}>{selectedModuleId ? (() => { const m = branchModules.find(x => x.id === selectedModuleId); return m ? `${m.name} (${m.totalHours} saat)` : 'Belirtilmemiş'; })() : branchModules.length > 0 ? 'Belirtilmemiş' : 'Önce branş seçin'}</span>
                <ChevronDown size={16} className={`shrink-0 transition-transform duration-300 ${isModuleDropOpen ? 'rotate-180 text-orange-500' : branchModules.length === 0 ? 'text-neutral-300' : 'text-neutral-400'}`} />
              </div>
            </div>
          )}

          {groupType === "kurumsal" && (
            <div className="space-y-2">
              <label className="text-[13px] font-semibold text-neutral-500 ml-1">Şirket Adı</label>
              <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Şirket adı" className={inputNormal} />
            </div>
          )}

          {groupType !== "standart" && (
            <div className="space-y-2">
              <label className="text-[13px] font-semibold text-neutral-500 ml-1">Toplam Saat</label>
              <input type="number" min={1} value={customHours} onChange={e => setCustomHours(e.target.value)} placeholder="Örn: 40" className={inputNormal} />
            </div>
          )}

        </div>

        {/* Özel seans input */}
        {selectedSchedule === "Özel Grup Tanımla" && (
          <div className="p-5 bg-neutral-50 border border-neutral-100 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
            <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest mb-2 block">Özel Seans Detayı</label>
            <input
              type="text"
              value={customSchedule}
              onChange={e => setCustomSchedule(e.target.value)}
              placeholder="Pzt-Sal-Çar | 10:00 - 13:00"
              className={`${inputBase} border-neutral-200 bg-white focus:border-designstudio-secondary-400`}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-8 bg-neutral-50 border-t border-neutral-100 flex items-center justify-end gap-3 shrink-0">
        {errors.duplicate && (
          <span className="text-[13px] font-bold text-red-500 mr-4 animate-in fade-in">{errors.duplicate}</span>
        )}
        <button type="button" onClick={handleCancel} className="px-8 font-bold text-neutral-400 hover:text-neutral-600 transition-colors cursor-pointer text-[14px]">
          Vazgeç
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || isSuccess}
          className={`px-[24px] py-[12px] rounded-[12px] font-semibold text-[14px] transition-all flex items-center gap-2.5 cursor-pointer active:scale-95 ${
            isSuccess
              ? "bg-green-500 text-white"
              : "bg-designstudio-secondary-500 hover:bg-designstudio-secondary-600 text-white shadow-md shadow-designstudio-secondary-500/20"
          } disabled:opacity-60`}
        >
          {isSuccess
            ? <><Check size={18} strokeWidth={3} /><span>Kaydedildi</span></>
            : loading ? "Kaydediliyor..."
            : editingGroupId ? "Güncelle" : "Grubu Oluştur"
          }
        </button>
      </div>
    </div>

    {mounted && createPortal(<>
      {isLocDropOpen && <div className="fixed inset-0 z-[9998]" onClick={() => setIsLocDropOpen(false)} />}
      <AnimatePresence>
        {isLocDropOpen && (
          <motion.div {...dropProps} className="fixed bg-white border border-neutral-200 shadow-xl rounded-xl z-[9999] overflow-hidden" style={{ transformOrigin: 'top', top: locDropPos.top, left: locDropPos.left, width: locDropPos.width }}>
            {['Kadıköy', 'Şirinevler', 'Pendik'].map(loc => (
              <div key={loc} onClick={() => { setGroupBranch(loc); if (errors.duplicate) setErrors({ ...errors, duplicate: "" }); setIsLocDropOpen(false); }} className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50 cursor-pointer transition-colors border-b last:border-0 border-neutral-100">
                <span className="text-[14px] font-medium text-neutral-700">{loc}</span>
                {groupBranch === loc && <Check size={16} className="text-orange-500" strokeWidth={3} />}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>, document.body)}

    {mounted && createPortal(<>
      {isDisciplineDropOpen && <div className="fixed inset-0 z-[9998]" onClick={() => setIsDisciplineDropOpen(false)} />}
      <AnimatePresence>
        {isDisciplineDropOpen && (
          <motion.div {...dropProps} className="fixed bg-white border border-neutral-200 shadow-xl rounded-xl z-[9999] overflow-hidden" style={{ transformOrigin: 'top', top: disciplineDropPos.top, left: disciplineDropPos.left, width: disciplineDropPos.width }}>
            <div onClick={() => { handleDisciplineChange(""); setIsDisciplineDropOpen(false); }} className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50 cursor-pointer transition-colors border-b border-neutral-100">
              <span className="text-[14px] font-medium text-neutral-400 italic">Seçilmemiş</span>
              {!groupDiscipline && <Check size={16} className="text-orange-500" strokeWidth={3} />}
            </div>
            {availableBranches.map(b => (
              <div key={b.id} onClick={() => { handleDisciplineChange(b.id); setIsDisciplineDropOpen(false); }} className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50 cursor-pointer transition-colors border-b last:border-0 border-neutral-100">
                <span className="text-[14px] font-medium text-neutral-700">{b.name}</span>
                {groupDiscipline === b.id && <Check size={16} className="text-orange-500" strokeWidth={3} />}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>, document.body)}

    {mounted && createPortal(<>
      {isInstructorDropOpen && <div className="fixed inset-0 z-[9998]" onClick={() => setIsInstructorDropOpen(false)} />}
      <AnimatePresence>
        {isInstructorDropOpen && (
          <motion.div {...dropProps} className="fixed bg-white border border-neutral-200 shadow-xl rounded-xl z-[9999] overflow-hidden max-h-60 overflow-y-auto" style={{ transformOrigin: 'top', top: instructorDropPos.top, left: instructorDropPos.left, width: instructorDropPos.width }}>
            {visibleInstructors.map(ins => (
              <div key={ins.id} onClick={() => { setSelectedInstructorId(ins.id); if (errors.instructor) setErrors({ ...errors, instructor: "" }); setIsInstructorDropOpen(false); }} className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50 cursor-pointer transition-colors border-b last:border-0 border-neutral-100">
                <span className="text-[14px] font-medium text-neutral-700">{ins.displayName}</span>
                {selectedInstructorId === ins.id && <Check size={16} className="text-orange-500" strokeWidth={3} />}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>, document.body)}

    {mounted && createPortal(<>
      {isScheduleDropOpen && <div className="fixed inset-0 z-[9998]" onClick={() => setIsScheduleDropOpen(false)} />}
      <AnimatePresence>
        {isScheduleDropOpen && (
          <motion.div {...dropProps} className="fixed bg-white border border-neutral-200 shadow-xl rounded-xl z-[9999] overflow-hidden max-h-60 overflow-y-auto" style={{ transformOrigin: 'top', top: scheduleDropPos.top, left: scheduleDropPos.left, width: scheduleDropPos.width }}>
            {schedules.map(s => (
              <div key={s} onClick={() => { setSelectedSchedule(s); if (errors.schedule) setErrors({ ...errors, schedule: "" }); setIsScheduleDropOpen(false); }} className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50 cursor-pointer transition-colors border-b last:border-0 border-neutral-100">
                <span className="text-[14px] font-medium text-neutral-700">{s}</span>
                {selectedSchedule === s && <Check size={16} className="text-orange-500" strokeWidth={3} />}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>, document.body)}

    {mounted && createPortal(<>
      {isModuleDropOpen && <div className="fixed inset-0 z-[9998]" onClick={() => setIsModuleDropOpen(false)} />}
      <AnimatePresence>
        {isModuleDropOpen && (
          <motion.div {...dropProps} className="fixed bg-white border border-neutral-200 shadow-xl rounded-xl z-[9999] overflow-hidden" style={{ transformOrigin: 'top', top: moduleDropPos.top, left: moduleDropPos.left, width: moduleDropPos.width }}>
            <div onClick={() => { setSelectedModuleId(""); setGroupModule(""); setIsModuleDropOpen(false); }} className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50 cursor-pointer transition-colors border-b border-neutral-100">
              <span className="text-[14px] font-medium text-neutral-400 italic">Belirtilmemiş</span>
              {!selectedModuleId && <Check size={16} className="text-orange-500" strokeWidth={3} />}
            </div>
            {branchModules.map(m => (
              <div key={m.id} onClick={() => { setSelectedModuleId(m.id); const n = m.name.toLowerCase(); if (n.includes("grafik") && (n.includes("-1") || n.includes("1"))) setGroupModule("GRAFIK_1"); else if (n.includes("grafik") && (n.includes("-2") || n.includes("2"))) setGroupModule("GRAFIK_2"); else setGroupModule(""); setIsModuleDropOpen(false); }} className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50 cursor-pointer transition-colors border-b last:border-0 border-neutral-100">
                <span className="text-[14px] font-medium text-neutral-700">{m.name} ({m.totalHours} saat)</span>
                {selectedModuleId === m.id && <Check size={16} className="text-orange-500" strokeWidth={3} />}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>, document.body)}
    </>
  );
};
