"use client";
import React, { useState, useEffect } from "react";
import { X, ChevronDown, Check, Users } from "lucide-react";

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
  instructors: any[];
  selectedInstructorId: string;
  setSelectedInstructorId: (val: string) => void;
  lessonHours: string;
  setLessonHours: (val: string) => void;
  groupStartDate: string;
  setGroupStartDate: (val: string) => void;
  errors: { code?: string; schedule?: string; instructor?: string; duplicate?: string };
  setErrors: (val: any) => void;
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

  useEffect(() => {
    if (!isFormOpen) { setIsSuccess(false); setLoading(false); }
  }, [isFormOpen]);

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

  return (
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
            <div className="relative">
              <select
                value={groupBranch}
                onChange={e => { setGroupBranch(e.target.value); if (errors.duplicate) setErrors({ ...errors, duplicate: "" }); }}
                className={`${selectBase} ${inputNormal}`}
              >
                <option value="Kadıköy">Kadıköy</option>
                <option value="Şirinevler">Şirinevler</option>
                <option value="Pendik">Pendik</option>
              </select>
              <ChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[13px] font-semibold text-neutral-500 ml-1">Branş</label>
            <div className="relative">
              <select
                value={groupDiscipline}
                onChange={e => handleDisciplineChange(e.target.value)}
                className={`${selectBase} ${inputNormal}`}
              >
                <option value="">Seçiniz...</option>
                {availableBranches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
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
              <div className="relative">
                <select
                  value={selectedInstructorId}
                  onChange={e => { setSelectedInstructorId(e.target.value); if (errors.instructor) setErrors({ ...errors, instructor: "" }); }}
                  className={`${selectBase} ${errors.instructor ? inputError : inputNormal}`}
                >
                  <option value="">Eğitmen Seçiniz</option>
                  {visibleInstructors.map(ins => (
                    <option key={ins.id} value={ins.id}>{ins.displayName}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-[13px] font-semibold text-neutral-500 ml-1">Seans</label>
            <div className="relative">
              <select
                value={selectedSchedule}
                onChange={e => { setSelectedSchedule(e.target.value); if (errors.schedule) setErrors({ ...errors, schedule: "" }); }}
                className={`${selectBase} ${errors.schedule ? inputError : inputNormal}`}
              >
                <option value="Grup seansı seçiniz..." disabled>Grup seansı seçiniz...</option>
                {schedules.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
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
            <input
              type="date"
              value={groupStartDate}
              onChange={e => setGroupStartDate(e.target.value)}
              className={inputNormal}
            />
          </div>
        </div>

        {/* Satır 3: Modül + Özel alanlar + Aylık Ders Sayısı */}
        <div className="grid grid-cols-4 gap-6">
          {groupType === "standart" && (
            <div className="col-span-2 space-y-2">
              <label className={`text-[13px] font-semibold ml-1 ${branchModules.length > 0 ? "text-neutral-500" : "text-neutral-300"}`}>
                Modül
              </label>
              <div className="relative">
                <select
                  value={selectedModuleId}
                  onChange={e => {
                    setSelectedModuleId(e.target.value);
                    const mod = branchModules.find(m => m.id === e.target.value);
                    if (mod) {
                      const n = mod.name.toLowerCase();
                      if (n.includes("grafik") && (n.includes("-1") || n.includes("1"))) setGroupModule("GRAFIK_1");
                      else if (n.includes("grafik") && (n.includes("-2") || n.includes("2"))) setGroupModule("GRAFIK_2");
                      else setGroupModule("");
                    } else setGroupModule("");
                  }}
                  disabled={branchModules.length === 0}
                  className={`${selectBase} ${branchModules.length > 0 ? inputNormal : "border-neutral-100 bg-neutral-100 text-neutral-300 cursor-not-allowed"}`}
                >
                  <option value="">{branchModules.length > 0 ? "Belirtilmemiş" : "Önce branş seçin"}</option>
                  {branchModules.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.totalHours} saat)</option>
                  ))}
                </select>
                <ChevronDown size={16} className={`absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${branchModules.length > 0 ? "text-neutral-400" : "text-neutral-300"}`} />
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
  );
};
