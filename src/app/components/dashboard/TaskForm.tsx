"use client";

import { useState, useEffect } from "react";
import { db, auth } from "@/app/lib/firebase";
import { collection, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { X, CheckCircle2, Star } from "lucide-react";
import {
  Task, TaskType, IconKey,
  DEFAULT_ICON, TYPE_GRADIENT,
  TypeBadge, getIcon,
} from "./taskTypes";
import IconPicker from "./IconPicker";
import { getFlexMessage } from "@/app/lib/messages";
import { useUser } from "@/app/context/UserContext";

interface TaskFormProps {
  editingTask: Task | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
  targetCollection?: string;   // Hangi koleksiyona yazılacak (default: "tasks")
  prefill?: Partial<Task>;     // Şablondan klonlarken alanları önceden doldur
  sourceTemplateId?: string;   // Klonlanacak şablonun ID'si (templateId + ownedBy set edilir)
}

export default function TaskForm({ editingTask, onClose, onSaved, targetCollection = "tasks", prefill, sourceTemplateId }: TaskFormProps) {
  const { user }                        = useUser();
  const [visible, setVisible]           = useState(false);
  const [name, setName]                 = useState(editingTask?.name ?? prefill?.name ?? "");
  const [type, setType]                 = useState<TaskType>(editingTask?.type ?? prefill?.type ?? "odev");
  const [selectedIcon, setSelectedIcon] = useState<IconKey>(editingTask?.icon ?? prefill?.icon ?? DEFAULT_ICON[editingTask?.type ?? prefill?.type ?? "odev"]);
  const [description, setDescription]  = useState(editingTask?.description ?? prefill?.description ?? "");
  const [points, setPoints]             = useState<number>(editingTask?.points ?? prefill?.points ?? 3);
  const [startDate]                     = useState(editingTask?.startDate ?? "");
  const [endDate, setEndDate]           = useState(editingTask?.endDate ?? "");
  const [saving, setSaving]             = useState(false);
  const [errors, setErrors]             = useState<Record<string, boolean>>({});
  const [shake, setShake]               = useState(false);
  const [saveError, setSaveError]       = useState("");
  const [iconTouched, setIconTouched]   = useState(!!editingTask?.icon);

  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  useEffect(() => {
    if (!shake) return;
    const t = setTimeout(() => setShake(false), 500);
    return () => clearTimeout(t);
  }, [shake]);

  const handleTypeChange = (t: TaskType) => {
    setType(t);
    if (!iconTouched) setSelectedIcon(DEFAULT_ICON[t]);
  };
  const handleIconSelect = (k: IconKey) => { setSelectedIcon(k); setIconTouched(true); };
  const handleClose = () => { setVisible(false); setTimeout(onClose, 300); };

  const typeOptions: { value: TaskType; label: string }[] = [
    { value: "odev", label: "Ödev" },
    { value: "proje", label: "Proje" },
    { value: "etkinlik", label: "Etkinlik" },
  ];

  const handleSave = async () => {
    const newErrors: Record<string, boolean> = {};
    if (!name.trim()) newErrors.name = true;
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setShake(true);
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const payload = {
        name: name.trim(), type, icon: selectedIcon,
        description: description.trim(), points,
        startDate: startDate || null, endDate: endDate || null,
      };
      if (editingTask) {
        await updateDoc(doc(db, targetCollection, editingTask.id), payload);
        onSaved("Kart güncellendi.");
      } else {
        const isClone    = !!sourceTemplateId;
        const isTemplate = targetCollection === "templates";

        // Taban veri — şablonlar ve görevler için ortak alanlar
        const baseData: Record<string, unknown> = {
          name:          payload.name,
          type:          payload.type,
          icon:          payload.icon,
          description:   payload.description,
          points:        payload.points,
          startDate:     payload.startDate ?? null,
          isActive:      false,
          isPaused:      false,
          isHidden:      false,
          createdBy:     auth.currentUser?.uid ?? null,
          createdByName: user ? `${user.name} ${user.surname}` : null,
          branch:        user?.branch ?? null,
          createdAt:     serverTimestamp(),
        };

        if (isTemplate) {
          // templates koleksiyonu: endDate, status, ownedBy, classId eklenmez
        } else {
          // tasks koleksiyonu
          baseData.endDate = payload.endDate ?? null;
          baseData.status  = isClone ? "active" : "library"; // hiçbir zaman undefined değil
          if (isClone) {
            baseData.isActive    = true;
            baseData.templateId  = sourceTemplateId;
            baseData.ownedBy     = auth.currentUser?.uid ?? null;
          }
        }

        // undefined değerleri temizle — Firestore hata vermesin
        const cleanData = Object.fromEntries(
          Object.entries(baseData).filter(([, v]) => v !== undefined)
        );

        await addDoc(collection(db, targetCollection), cleanData);
        onSaved(isClone ? "Ödev başlatıldı." : "Kart oluşturuldu.");
      }
      handleClose();
    } catch (err) {
      console.error("[TaskForm] Kayıt hatası:", err);
      setSaveError("Kayıt sırasında hata oluştu.");
      setShake(true);
      setSaving(false);
    }
  };

  const inputCls = "w-full h-12 px-4 rounded-xl border text-[14px] text-text-primary font-medium placeholder:text-text-placeholder outline-none transition-all";
  const dateCls  = "w-full h-12 px-4 rounded-xl border text-[14px] text-text-primary font-medium outline-none transition-all border-surface-200 bg-surface-50 focus:border-base-primary-500 focus:bg-white cursor-pointer";
  const labelCls = "text-[12px] font-bold text-surface-500 ml-1";

  const hasFieldErrors = Object.values(errors).some(Boolean);

  return (
    <div className={`fixed inset-0 z-600 flex items-center justify-center p-6 transition-all duration-300 ${visible ? "visible" : "invisible"}`}>
      <div className={`absolute inset-0 bg-base-primary-900/40 backdrop-blur-md transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`} onClick={handleClose} />

      <div className={`relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${visible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-8"} ${shake ? "error-shake" : ""}`}>

        {/* Header */}
        <div className="bg-base-primary-900 px-8 py-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${TYPE_GRADIENT[type]} flex items-center justify-center shadow-lg`}>
              {getIcon(selectedIcon, type, 20)}
            </div>
            <div>
              <h2 className="text-[17px] font-bold leading-none">
                {editingTask ? "Kartı Düzenle" : sourceTemplateId ? "Ödevi Başlat" : "Yeni Kart Oluştur"}
              </h2>
              <p className="text-[12px] text-white/50 mt-0.5">
                {sourceTemplateId ? "Şablondan başlatılıyor" : "Ödev kütüphanesi"}
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-white/10 rounded-full cursor-pointer transition-colors"><X size={20} /></button>
        </div>

        {/* Body — 2 kolon, 4 satır */}
        <div className="px-8 py-7 grid grid-cols-2 gap-x-10 gap-y-6 overflow-y-auto max-h-[82vh]">

          {/* Satır 1: Kart adı | Bitiş tarihi */}
          <div className={`space-y-1.5 ${targetCollection === "templates" && !sourceTemplateId ? "col-span-2" : ""}`}>
            <label className={labelCls}>Kart adı <span className="text-status-danger-500">*</span></label>
            <input
              value={name}
              onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: false })); }}
              placeholder="ör. Kolaj bahçesi"
              className={`${inputCls} ${errors.name ? "border-status-danger-500 bg-status-danger-50" : "border-surface-200 bg-surface-50 focus:border-base-primary-500 focus:bg-white"}`}
            />
          </div>

          {!(targetCollection === "templates" && !sourceTemplateId) && (
            <div className="space-y-1.5">
              <label className={labelCls}>Bitiş tarihi</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={dateCls} />
            </div>
          )}

          {/* Satır 2: Tür | Baz puan */}
          <div className="space-y-1.5">
            <label className={labelCls}>Tür</label>
            <div className="grid grid-cols-3 gap-2">
              {typeOptions.map(opt => (
                <button key={opt.value} onClick={() => handleTypeChange(opt.value)}
                  className={`h-11 rounded-xl text-[13px] font-bold transition-all cursor-pointer border ${
                    type === opt.value ? "bg-base-primary-900 text-white border-base-primary-900"
                    : "bg-surface-50 text-surface-500 border-surface-200 hover:border-surface-400 hover:text-surface-700"}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={labelCls}>Baz puan</label>
            <div className="grid grid-cols-4 gap-2">
              {[1, 3, 5, 10].map(p => (
                <button key={p} onClick={() => setPoints(p)}
                  className={`h-11 rounded-xl text-[14px] font-bold transition-all cursor-pointer border ${
                    points === p ? "bg-designstudio-primary-500 text-white border-designstudio-primary-500"
                    : "bg-surface-50 text-surface-500 border-surface-200 hover:border-surface-400 hover:text-surface-700"}`}>
                  {p}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-surface-400 ml-1">Eğitmen bu değeri sonradan ayarlayabilir.</p>
          </div>

          {/* Satır 3: İkon | Önizleme */}
          <div className="space-y-1.5">
            <label className={labelCls}>İkon</label>
            <IconPicker value={selectedIcon} onChange={handleIconSelect} type={type} />
          </div>

          <div className="space-y-1.5">
            <label className={labelCls}>Önizleme</label>
            <div className="bg-surface-50 rounded-2xl border border-surface-100 p-4 h-14 flex items-center gap-3">
              <div className={`w-8 h-8 rounded-xl ${TYPE_GRADIENT[type]} flex items-center justify-center text-white shadow-md shrink-0`}>
                {getIcon(selectedIcon, type, 16)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-base-primary-900 truncate leading-tight">{name || "Kart adı"}</p>
                <TypeBadge type={type} />
              </div>
              <div className="flex items-center gap-1 text-[12px] font-bold text-surface-500 shrink-0">
                <Star size={11} className="text-designstudio-primary-500 fill-designstudio-primary-500" />
                {points}
              </div>
            </div>
          </div>

          {/* Satır 4: Açıklama (full width) */}
          <div className="col-span-2 space-y-1.5">
            <label className={labelCls}>Açıklama</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Bu ödev ne hakkında?"
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-surface-200 bg-surface-50 text-[14px] text-text-primary font-medium placeholder:text-text-placeholder outline-none resize-none focus:border-base-primary-500 focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 bg-surface-50 border-t border-surface-100 flex items-center justify-end gap-4 shrink-0">
          {(hasFieldErrors || saveError) && (
            <span className="text-[13px] font-bold text-status-danger-500 mr-auto animate-in fade-in slide-in-from-right-4">
              {saveError || getFlexMessage("validation/required-fields").text}
            </span>
          )}
          <button onClick={handleClose} className="px-6 font-bold text-surface-400 hover:text-surface-700 cursor-pointer transition-colors text-[14px]">Vazgeç</button>
          <button onClick={handleSave} disabled={saving}
            className="h-12 px-10 rounded-xl bg-designstudio-secondary-500 text-white text-[14px] font-bold hover:bg-designstudio-secondary-600 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg">
            {saving
              ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <><CheckCircle2 size={18} /> {editingTask ? "Güncelle" : "Kartı Kaydet"}</>}
          </button>
        </div>
      </div>
    </div>
  );
}
