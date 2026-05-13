"use client";

import { useState, useEffect } from "react";
import { X, CheckCircle2, ChevronDown, BookmarkPlus } from "lucide-react";
import { db, auth } from "@/app/lib/firebase";
import { collection, addDoc, serverTimestamp, query, where, onSnapshot } from "firebase/firestore";
import { useUser } from "@/app/context/UserContext";
import { TaskType, DEFAULT_ICON, TYPE_GRADIENT, getIcon } from "../assignment/taskTypes";

interface Group { id: string; code: string; branch: string; }

export function QuickAssignModal({ onClose }: { onClose: () => void }) {
  const { user } = useUser();
  const [visible, setVisible]               = useState(false);
  const [name, setName]                     = useState("");
  const [type, setType]                     = useState<TaskType>("odev");
  const [subtitle, setSubtitle]             = useState("");
  const [groupId, setGroupId]               = useState("");
  const [endDate, setEndDate]               = useState("");
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [groups, setGroups]                 = useState<Group[]>([]);
  const [saving, setSaving]                 = useState(false);
  const [errors, setErrors]                 = useState<Record<string, boolean>>({});
  const [shake, setShake]                   = useState(false);

  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  useEffect(() => {
    if (!shake) return;
    const t = setTimeout(() => setShake(false), 400);
    return () => clearTimeout(t);
  }, [shake]);

  useEffect(() => {
    const uid = user?.uid ?? auth.currentUser?.uid;
    if (!uid) return;
    const q = query(
      collection(db, "groups"),
      where("instructorId", "==", uid),
      where("status", "==", "active")
    );
    return onSnapshot(q, snap => {
      setGroups(snap.docs.map(d => ({ id: d.id, ...d.data() } as Group)));
    });
  }, [user?.uid]);

  const handleClose = () => { setVisible(false); setTimeout(onClose, 300); };

  const handleSave = async () => {
    const newErrors: Record<string, boolean> = {};
    if (!name.trim()) newErrors.name = true;
    if (!groupId)     newErrors.groupId = true;
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); setShake(true); return; }

    setSaving(true);
    const uid = user?.uid ?? auth.currentUser?.uid ?? null;
    const selectedGroup = groups.find(g => g.id === groupId);

    await addDoc(collection(db, "tasks"), {
      name:          name.trim(),
      subtitle:      subtitle.trim() || null,
      type,
      icon:          DEFAULT_ICON[type],
      groupId,
      groupBranch:   selectedGroup?.branch ?? null,
      classId:       selectedGroup?.code ?? null,
      endDate:       endDate || null,
      status:        "active",
      isActive:      true,
      isPaused:      false,
      isHidden:      false,
      createdAt:     serverTimestamp(),
      createdBy:     uid,
      createdByName: user ? `${user.name} ${user.surname}` : null,
      ownedBy:       uid,
    });

    if (saveAsTemplate) {
      await addDoc(collection(db, "templates"), {
        name:          name.trim(),
        subtitle:      subtitle.trim() || null,
        type,
        icon:          DEFAULT_ICON[type],
        scope:         "personal",
        isActive:      false,
        isPaused:      false,
        isHidden:      false,
        createdAt:     serverTimestamp(),
        createdBy:     uid,
        createdByName: user ? `${user.name} ${user.surname}` : null,
      });
    }

    setSaving(false);
    handleClose();
  };

  const typeOptions: { value: TaskType; label: string }[] = [
    { value: "odev",     label: "Ödev"     },
    { value: "proje",    label: "Proje"    },
    { value: "etkinlik", label: "Etkinlik" },
  ];

  const today    = new Date().toISOString().split("T")[0];
  const inputCls = "w-full h-11 px-4 rounded-xl border text-[14px] text-text-primary font-medium placeholder:text-text-placeholder outline-none transition-all";

  return (
    <div className={`fixed inset-0 z-[700] flex items-center justify-center p-6 transition-all duration-300 ${visible ? "visible" : "invisible"}`}>
      <div
        className={`absolute inset-0 bg-base-primary-900/40 backdrop-blur-md transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
        onClick={handleClose}
      />
      <div className={`relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${visible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-8"} ${shake ? "animate-shake-fast" : ""}`}>

        {/* Header */}
        <div className="bg-base-primary-900 px-7 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl ${TYPE_GRADIENT[type]} flex items-center justify-center shadow-lg`}>
              {getIcon(DEFAULT_ICON[type], type, 17)}
            </div>
            <div>
              <h2 className="text-[16px] font-bold leading-none">Hızlı Ödev Ver</h2>
              <p className="text-[11px] text-white/50 mt-0.5">Ver ve unut</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-white/10 rounded-full cursor-pointer transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-7 py-6 space-y-4">

          {/* Ödev adı */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-bold text-surface-500 ml-1">
              Ödev Adı <span className="text-status-danger-500">*</span>
            </label>
            <input
              value={name}
              onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: false })); }}
              placeholder="ör. Poster Tasarımı"
              autoFocus
              className={`${inputCls} ${errors.name
                ? "border-status-danger-400 bg-status-danger-50"
                : "border-surface-200 bg-surface-50 focus:border-designstudio-secondary-500 focus:bg-white"}`}
            />
          </div>

          {/* Alt başlık */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-bold text-surface-500 ml-1">
              Alt Başlık <span className="text-surface-300 font-normal">(isteğe bağlı)</span>
            </label>
            <input
              value={subtitle}
              onChange={e => setSubtitle(e.target.value)}
              placeholder="ör. A4 formatında, minimalist tasarım"
              className={`${inputCls} border-surface-200 bg-surface-50 focus:border-designstudio-secondary-500 focus:bg-white`}
            />
          </div>

          {/* Tür + Grup yan yana */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-surface-500 ml-1">Tür</label>
              <div className="flex gap-1.5">
                {typeOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setType(opt.value)}
                    className={`flex-1 h-11 rounded-xl text-[12px] font-bold transition-all cursor-pointer border ${
                      type === opt.value
                        ? "bg-base-primary-900 text-white border-base-primary-900"
                        : "bg-surface-50 text-surface-500 border-surface-200 hover:border-surface-400"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-surface-500 ml-1">
                Grup <span className="text-status-danger-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={groupId}
                  onChange={e => { setGroupId(e.target.value); setErrors(p => ({ ...p, groupId: false })); }}
                  className={`w-full h-11 px-4 pr-9 rounded-xl border text-[13px] font-bold outline-none appearance-none cursor-pointer transition-all ${
                    errors.groupId
                      ? "border-status-danger-400 bg-status-danger-50"
                      : "border-surface-200 bg-surface-50 focus:border-designstudio-secondary-500"
                  }`}
                >
                  <option value="">Grup seçin</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.code}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Bitiş tarihi */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-bold text-surface-500 ml-1">
              Bitiş Tarihi <span className="text-surface-300 font-normal">(isteğe bağlı)</span>
            </label>
            <input
              type="date"
              value={endDate}
              min={today}
              onChange={e => setEndDate(e.target.value)}
              className="w-full h-11 px-4 rounded-xl border border-surface-200 bg-surface-50 text-[14px] text-text-primary font-medium outline-none focus:border-designstudio-secondary-500 focus:bg-white transition-all cursor-pointer"
            />
          </div>

          {/* Şablona kaydet */}
          <div
            onClick={() => setSaveAsTemplate(v => !v)}
            className={`flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all select-none ${
              saveAsTemplate
                ? "border-designstudio-secondary-300 bg-designstudio-secondary-50"
                : "border-surface-100 bg-surface-50 hover:border-surface-200"
            }`}
          >
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
              saveAsTemplate ? "bg-designstudio-secondary-500 border-designstudio-secondary-500" : "border-surface-300"
            }`}>
              {saveAsTemplate && <CheckCircle2 size={11} className="text-white" />}
            </div>
            <BookmarkPlus size={15} className={saveAsTemplate ? "text-designstudio-secondary-500 shrink-0" : "text-surface-400 shrink-0"} />
            <div>
              <p className={`text-[13px] font-bold leading-none ${saveAsTemplate ? "text-designstudio-secondary-700" : "text-surface-600"}`}>
                Kişisel şablona kaydet
              </p>
              <p className="text-[11px] text-surface-400 mt-0.5">Kütüphanene ekle, tekrar kullanabilirsin</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-7 py-5 bg-surface-50 border-t border-surface-100 flex items-center justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-5 font-bold text-surface-400 hover:text-surface-700 cursor-pointer transition-colors text-[13px]"
          >
            Vazgeç
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-11 px-8 rounded-xl bg-designstudio-secondary-500 text-white text-[13px] font-bold hover:bg-designstudio-secondary-600 active:scale-95 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2 shadow-md"
          >
            {saving
              ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <><CheckCircle2 size={16} /> Ödevi Ver</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
