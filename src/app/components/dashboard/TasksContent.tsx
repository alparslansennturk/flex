"use client";

import React, { useState, useEffect } from "react";
import { db, auth } from "@/app/lib/firebase";
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, serverTimestamp, query, orderBy
} from "firebase/firestore";
import {
  Plus, BookOpen, Zap, Star, Filter, Palette, X, CheckCircle2,
  Briefcase, CalendarDays, Trash2, AlertTriangle, PenTool, Image,
  Layout, Layers, Scissors, Type, Camera, Frame, Maximize2,
  Brush, Pencil, Edit2
} from "lucide-react";

// --- TİPLER ---
type TaskType = "odev" | "etkinlik" | "proje";
type FilterTab = "tumu" | TaskType;
type IconKey = "palette" | "pentool" | "image" | "layout" | "layers" | "scissors"
             | "type" | "camera" | "frame" | "maximize" | "brush" | "pencil"
             | "bookopen" | "zap" | "briefcase" | "star";

interface Task {
  id: string;
  name: string;
  description: string;
  type: TaskType;
  points: number;
  icon?: IconKey;
  startDate?: string;
  endDate?: string;
  createdAt: any;
}

// --- İKON HARİTASI ---
const ICON_MAP: Record<IconKey, { node: (s: number) => React.ReactNode; label: string }> = {
  palette:   { node: (s) => <Palette size={s} />,   label: "Palet" },
  pentool:   { node: (s) => <PenTool size={s} />,   label: "Kalem" },
  image:     { node: (s) => <Image size={s} />,     label: "Görsel" },
  layout:    { node: (s) => <Layout size={s} />,    label: "Yerleşim" },
  layers:    { node: (s) => <Layers size={s} />,    label: "Katman" },
  scissors:  { node: (s) => <Scissors size={s} />,  label: "Makas" },
  type:      { node: (s) => <Type size={s} />,      label: "Yazı" },
  camera:    { node: (s) => <Camera size={s} />,    label: "Kamera" },
  frame:     { node: (s) => <Frame size={s} />,     label: "Çerçeve" },
  maximize:  { node: (s) => <Maximize2 size={s} />, label: "Büyüt" },
  brush:     { node: (s) => <Brush size={s} />,     label: "Fırça" },
  pencil:    { node: (s) => <Pencil size={s} />,    label: "Kurşun" },
  bookopen:  { node: (s) => <BookOpen size={s} />,  label: "Kitap" },
  zap:       { node: (s) => <Zap size={s} />,       label: "Enerji" },
  briefcase: { node: (s) => <Briefcase size={s} />, label: "Çanta" },
  star:      { node: (s) => <Star size={s} />,      label: "Yıldız" },
};

const DEFAULT_ICON: Record<TaskType, IconKey> = {
  odev: "palette", proje: "briefcase", etkinlik: "zap",
};

// --- TİP RENKLERİ ---
const TYPE_GRADIENT: Record<TaskType, string> = {
  odev:     "bg-gradient-to-b from-pink-500 to-[#B80E57]",
  proje:    "bg-gradient-to-b from-[#1CB5AE] to-[#0E5D59]",
  etkinlik: "bg-gradient-to-b from-[#3A7BD5] to-[#10294C]",
};

const TYPE_CONFIG: Record<TaskType, { label: string; badgeBg: string; badgeText: string; dot: string }> = {
  odev:     { label: "Ödev",     badgeBg: "bg-base-primary-50",         badgeText: "text-base-primary-500",         dot: "bg-base-primary-400" },
  proje:    { label: "Proje",    badgeBg: "bg-accent-turquoise-100",     badgeText: "text-accent-turquoise-700",     dot: "bg-accent-turquoise-500" },
  etkinlik: { label: "Etkinlik", badgeBg: "bg-designstudio-primary-50", badgeText: "text-designstudio-primary-600", dot: "bg-designstudio-primary-500" },
};

function TypeBadge({ type }: { type: TaskType }) {
  const c = TYPE_CONFIG[type];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${c.badgeBg} ${c.badgeText} text-[11px] font-bold`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

function getIcon(iconKey: IconKey | undefined, type: TaskType, size: number) {
  const key = iconKey ?? DEFAULT_ICON[type];
  return ICON_MAP[key]?.node(size) ?? <Palette size={size} />;
}

// --- STAT KARTI ---
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-3xl border border-surface-100 px-6 py-5 flex flex-col gap-1">
      <p className="text-[11px] font-bold text-surface-400 uppercase tracking-wider">{label}</p>
      <p className={`text-[30px] font-bold leading-none ${color}`}>{value}</p>
    </div>
  );
}

// --- TASK SATIRI (liste görünümü) ---
function TaskRow({ task, onEdit, onDelete }: {
  task: Task;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
}) {
  const gradient = TYPE_GRADIENT[task.type];
  const iconNode  = getIcon(task.icon, task.type, 16);

  const formatDate = (d?: string) => {
    if (!d) return null;
    const [y, m, day] = d.split("-");
    const months = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
    return `${parseInt(day)} ${months[parseInt(m) - 1]} ${y}`;
  };

  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-surface-50 transition-colors group border-b border-surface-100 last:border-0">
      {/* İkon */}
      <div className={`w-9 h-9 rounded-xl ${gradient} flex items-center justify-center text-white shadow-sm shrink-0`}>
        {iconNode}
      </div>

      {/* Ad + badge */}
      <div className="flex items-center gap-2.5 w-55 shrink-0 xl:w-65">
        <span className="text-[14px] font-bold text-base-primary-900 truncate">{task.name}</span>
        <TypeBadge type={task.type} />
      </div>

      {/* Açıklama */}
      <p className="flex-1 text-[13px] text-surface-500 truncate min-w-0 hidden md:block">
        {task.description || <span className="italic text-surface-300">Açıklama yok</span>}
      </p>

      {/* Puan */}
      <div className="flex items-center gap-1 shrink-0 w-16 justify-center">
        <Star size={12} className="text-designstudio-primary-500 fill-designstudio-primary-500" />
        <span className="text-[13px] font-bold text-surface-700">{task.points}</span>
      </div>

      {/* Tarih */}
      <div className="shrink-0 w-28 hidden lg:flex items-center gap-1.5 text-[12px] font-medium text-surface-400">
        {task.endDate ? (
          <><CalendarDays size={12} /><span>{formatDate(task.endDate)}</span></>
        ) : (
          <span className="italic text-surface-300">Tarih yok</span>
        )}
      </div>

      {/* Aksiyonlar */}
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(task)}
          className="w-8 h-8 flex items-center justify-center rounded-xl text-surface-400 hover:bg-base-primary-50 hover:text-base-primary-500 transition-all cursor-pointer"
          title="Düzenle"
        >
          <Edit2 size={14} />
        </button>
        <button
          onClick={() => onDelete(task)}
          className="w-8 h-8 flex items-center justify-center rounded-xl text-surface-400 hover:bg-status-danger-50 hover:text-status-danger-500 transition-all cursor-pointer"
          title="Sil"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// --- SİL ONAY MODALİ ---
function DeleteConfirmModal({ task, onCancel, onConfirm }: {
  task: Task; onCancel: () => void; onConfirm: () => void;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);
  const handleCancel  = () => { setVisible(false); setTimeout(onCancel, 280); };
  const handleConfirm = () => { setVisible(false); setTimeout(onConfirm, 280); };

  return (
    <div className={`fixed inset-0 z-700 flex items-center justify-center p-6 transition-all duration-300 ${visible ? "visible" : "invisible"}`}>
      <div className={`absolute inset-0 bg-base-primary-900/40 backdrop-blur-md transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`} onClick={handleCancel} />
      <div className={`relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 flex flex-col items-center gap-5 text-center transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${visible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"}`}>
        <div className="w-14 h-14 rounded-full bg-status-danger-50 flex items-center justify-center">
          <AlertTriangle size={26} className="text-status-danger-500" />
        </div>
        <div>
          <p className="text-[17px] font-bold text-base-primary-900 mb-1">Kartı sil</p>
          <p className="text-[13px] text-surface-500">
            <span className="font-bold text-base-primary-700">"{task.name}"</span> kalıcı olarak silinecek.
          </p>
        </div>
        <div className="flex gap-3 w-full">
          <button onClick={handleCancel} className="flex-1 h-11 rounded-xl border border-surface-200 text-[13px] font-bold text-surface-600 hover:bg-surface-50 transition-all cursor-pointer">Vazgeç</button>
          <button onClick={handleConfirm} className="flex-1 h-11 rounded-xl bg-status-danger-500 text-white text-[13px] font-bold hover:bg-status-danger-700 active:scale-95 transition-all cursor-pointer">Evet, sil</button>
        </div>
      </div>
    </div>
  );
}

// --- FORM MODALİ ---
function TaskForm({ editingTask, onClose, onSaved }: {
  editingTask: Task | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [name, setName]               = useState(editingTask?.name ?? "");
  const [type, setType]               = useState<TaskType>(editingTask?.type ?? "odev");
  const [selectedIcon, setSelectedIcon] = useState<IconKey>(editingTask?.icon ?? DEFAULT_ICON[editingTask?.type ?? "odev"]);
  const [description, setDescription] = useState(editingTask?.description ?? "");
  const [points, setPoints]           = useState<number>(editingTask?.points ?? 3);
  const [startDate, setStartDate]     = useState(editingTask?.startDate ?? "");
  const [endDate, setEndDate]         = useState(editingTask?.endDate ?? "");
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState("");

  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  // Tip değişince default ikonu güncelle (eğer kullanıcı değiştirmediyse)
  const [iconTouched, setIconTouched] = useState(!!editingTask?.icon);
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
    if (!name.trim()) { setError("Kart adı zorunlu."); return; }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(), type, icon: selectedIcon,
        description: description.trim(), points,
        startDate: startDate || null, endDate: endDate || null,
      };
      if (editingTask) {
        await updateDoc(doc(db, "tasks", editingTask.id), payload);
        onSaved("Kart güncellendi.");
      } else {
        await addDoc(collection(db, "tasks"), {
          ...payload,
          createdBy: auth.currentUser?.uid ?? null,
          createdAt: serverTimestamp(),
        });
        onSaved("Kart oluşturuldu.");
      }
      handleClose();
    } catch {
      setError("Kayıt sırasında hata oluştu.");
      setSaving(false);
    }
  };

  const inputCls = "w-full h-12 px-4 rounded-xl border text-[14px] text-text-primary font-medium placeholder:text-text-placeholder outline-none transition-all border-surface-200 bg-surface-50 focus:border-base-primary-500 focus:bg-white";
  const dateCls  = "w-full h-12 px-4 rounded-xl border text-[14px] text-text-primary font-medium outline-none transition-all border-surface-200 bg-surface-50 focus:border-base-primary-500 focus:bg-white cursor-pointer";

  return (
    <div className={`fixed inset-0 z-600 flex items-center justify-center p-6 transition-all duration-300 ${visible ? "visible" : "invisible"}`}>
      <div className={`absolute inset-0 bg-base-primary-900/40 backdrop-blur-md transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`} onClick={handleClose} />

      <div className={`relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${visible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-8"}`}>

        {/* Header */}
        <div className="bg-base-primary-900 px-8 py-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${TYPE_GRADIENT[type]} flex items-center justify-center shadow-lg`}>
              {getIcon(selectedIcon, type, 20)}
            </div>
            <div>
              <h2 className="text-[17px] font-bold leading-none">{editingTask ? "Kartı Düzenle" : "Yeni Kart Oluştur"}</h2>
              <p className="text-[12px] text-white/50 mt-0.5">Ödev kütüphanesi</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-white/10 rounded-full cursor-pointer transition-colors"><X size={20} /></button>
        </div>

        {/* Body — 2 kolon */}
        <div className="px-8 py-7 grid grid-cols-2 gap-x-8 gap-y-6 overflow-y-auto max-h-[75vh]">

          {/* SOL */}
          <div className="flex flex-col gap-6">

            {/* Ad */}
            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-surface-500 ml-1">KART ADI <span className="text-status-danger-500">*</span></label>
              <input value={name} onChange={e => { setName(e.target.value); setError(""); }} placeholder="ör. Kolaj bahçesi"
                className={`${inputCls} ${error ? "border-status-danger-500 bg-status-danger-50" : ""}`} />
              {error && <p className="text-[12px] text-status-danger-500 font-medium ml-1">{error}</p>}
            </div>

            {/* Tip */}
            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-surface-500 ml-1">TİP</label>
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

            {/* İkon seçici */}
            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-surface-500 ml-1">İKON</label>
              <div className="grid grid-cols-8 gap-1.5">
                {(Object.keys(ICON_MAP) as IconKey[]).map(key => (
                  <button key={key} onClick={() => handleIconSelect(key)} title={ICON_MAP[key].label}
                    className={`w-9 h-9 flex items-center justify-center rounded-xl border transition-all cursor-pointer ${
                      selectedIcon === key
                        ? `${TYPE_GRADIENT[type]} text-white border-transparent shadow-md`
                        : "bg-surface-50 text-surface-400 border-surface-200 hover:border-surface-400 hover:text-surface-700"}`}>
                    {ICON_MAP[key].node(15)}
                  </button>
                ))}
              </div>
            </div>

            {/* Açıklama */}
            <div className="space-y-1.5 flex-1">
              <label className="text-[12px] font-bold text-surface-500 ml-1">AÇIKLAMA</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Bu ödev ne hakkında?" rows={4}
                className="w-full min-h-30 px-4 py-3 rounded-xl border border-surface-200 bg-surface-50 text-[14px] text-text-primary font-medium placeholder:text-text-placeholder outline-none resize-none focus:border-base-primary-500 focus:bg-white transition-all" />
            </div>
          </div>

          {/* SAĞ */}
          <div className="flex flex-col gap-6">

            {/* Tarihler */}
            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-surface-500 ml-1">TARİHLER</label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold text-surface-400 ml-1">Başlangıç</p>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={dateCls} />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold text-surface-400 ml-1">Teslim</p>
                  <input type="date" value={endDate} min={startDate || undefined} onChange={e => setEndDate(e.target.value)} className={dateCls} />
                </div>
              </div>
            </div>

            {/* Baz puan */}
            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-surface-500 ml-1">BAZ PUAN</label>
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

            {/* Önizleme */}
            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-surface-500 ml-1">ÖNİZLEME</label>
              <div className="bg-surface-50 rounded-2xl border border-surface-100 p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${TYPE_GRADIENT[type]} flex items-center justify-center text-white shadow-md shrink-0`}>
                  {getIcon(selectedIcon, type, 18)}
                </div>
                <div className="min-w-0">
                  <p className="text-[14px] font-bold text-base-primary-900 truncate">{name || "Kart adı"}</p>
                  <TypeBadge type={type} />
                </div>
                <div className="ml-auto flex items-center gap-1 text-[12px] font-bold text-surface-500 shrink-0">
                  <Star size={11} className="text-designstudio-primary-500 fill-designstudio-primary-500" />
                  {points}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 bg-surface-50 border-t border-surface-100 flex items-center justify-end gap-4 shrink-0">
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

// --- ANA BİLEŞEN ---
export default function TasksContent() {
  const [tasks, setTasks]           = useState<Task[]>([]);
  const [loading, setLoading]       = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("tumu");
  const [formOpen, setFormOpen]     = useState(false);
  const [editingTask, setEditingTask]   = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [toast, setToast]           = useState({ show: false, message: "" });

  useEffect(() => {
    const q = query(collection(db, "tasks"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const showToast = (msg: string) => {
    setToast({ show: true, message: msg });
    setTimeout(() => setToast({ show: false, message: "" }), 3000);
  };

  const handleDelete = async () => {
    if (!deletingTask) return;
    try {
      await deleteDoc(doc(db, "tasks", deletingTask.id));
      showToast(`"${deletingTask.name}" silindi.`);
    } catch {
      showToast("Silme sırasında hata oluştu.");
    } finally {
      setDeletingTask(null);
    }
  };

  const openEdit   = (task: Task) => { setEditingTask(task); setFormOpen(true); };
  const openCreate = () => { setEditingTask(null); setFormOpen(true); };
  const closeForm  = () => { setFormOpen(false); setEditingTask(null); };

  const filtered = tasks.filter(t => activeFilter === "tumu" || t.type === activeFilter);

  const filterTabs: { id: FilterTab; label: string }[] = [
    { id: "tumu", label: "Tümü" },
    { id: "odev", label: "Ödevler" },
    { id: "proje", label: "Projeler" },
    { id: "etkinlik", label: "Etkinlikler" },
  ];

  return (
    <div className="w-full font-inter select-none pb-20">

      {/* TOAST */}
      {toast.show && (
        <div className="fixed top-12 right-12 z-200 animate-in fade-in slide-in-from-right duration-300">
          <div className="bg-white border border-surface-100 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-[20px] p-5 flex items-center gap-4 min-w-75">
            <div className="w-10 h-10 rounded-full bg-status-success-100 flex items-center justify-center text-status-success-500">
              <CheckCircle2 size={20} />
            </div>
            <p className="text-[14px] font-bold text-text-primary">{toast.message}</p>
            <button onClick={() => setToast({ show: false, message: "" })} className="ml-auto text-surface-300 hover:text-surface-500 cursor-pointer"><X size={16} /></button>
          </div>
        </div>
      )}

      {/* BAŞLIK */}
      <div className="px-6 pt-10 pb-6 xl:px-8 2xl:px-12">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-[26px] xl:text-[28px] font-bold text-base-primary-900 leading-none mb-2">Ödev Yönetimi</h1>
            <p className="text-[13px] xl:text-[14px] text-surface-500 font-medium">Ödev kartlarını oluştur, düzenle ve eğitmenlere sun.</p>
          </div>
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 xl:px-5 xl:py-3 bg-base-primary-900 text-white rounded-2xl text-[13px] xl:text-[14px] font-bold hover:bg-base-primary-800 active:scale-95 transition-all cursor-pointer shadow-sm">
            <Plus size={16} /> Yeni kart oluştur
          </button>
        </div>
      </div>

      {/* STAT */}
      <div className="px-6 pb-6 xl:px-8 2xl:px-12">
        <div className="grid grid-cols-4 gap-3 xl:gap-4">
          <StatCard label="Toplam" value={tasks.length} color="text-base-primary-900" />
          <StatCard label="Ödev" value={tasks.filter(t => t.type === "odev").length} color="text-designstudio-secondary-500" />
          <StatCard label="Proje" value={tasks.filter(t => t.type === "proje").length} color="text-accent-turquoise-500" />
          <StatCard label="Etkinlik" value={tasks.filter(t => t.type === "etkinlik").length} color="text-base-primary-500" />
        </div>
      </div>

      {/* FİLTRE */}
      <div className="px-6 xl:px-8 2xl:px-12 mb-4 flex items-center gap-2">
        <Filter size={14} className="text-surface-400" />
        {filterTabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveFilter(tab.id)}
            className={`px-3.5 py-1.5 rounded-xl text-[12px] xl:text-[13px] font-bold transition-all cursor-pointer ${
              activeFilter === tab.id
                ? "bg-base-primary-900 text-white"
                : "bg-white border border-surface-100 text-surface-500 hover:text-surface-700 hover:border-surface-300"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* LİSTE */}
      <div className="px-6 xl:px-8 2xl:px-12">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-2 border-surface-100 border-t-base-primary-500 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-surface-300">
            <Palette size={48} className="mb-4 opacity-40" />
            <p className="text-[15px] font-semibold mb-3">Henüz kart yok</p>
            <button onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-50 text-surface-500 text-[13px] font-bold hover:text-surface-700 transition-all cursor-pointer">
              <Plus size={14} /> İlk kartı oluştur
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-surface-100 overflow-hidden shadow-sm">
            {/* Tablo başlığı */}
            <div className="flex items-center gap-4 px-5 py-3 bg-surface-50 border-b border-surface-100">
              <div className="w-9 shrink-0" />
              <div className="w-55 shrink-0 xl:w-65">
                <span className="text-[11px] font-bold text-surface-400 uppercase tracking-wider">Kart Adı</span>
              </div>
              <div className="flex-1 hidden md:block">
                <span className="text-[11px] font-bold text-surface-400 uppercase tracking-wider">Açıklama</span>
              </div>
              <div className="w-16 text-center shrink-0">
                <span className="text-[11px] font-bold text-surface-400 uppercase tracking-wider">Puan</span>
              </div>
              <div className="w-28 hidden lg:block">
                <span className="text-[11px] font-bold text-surface-400 uppercase tracking-wider">Teslim</span>
              </div>
              <div className="w-18 shrink-0" />
            </div>

            {/* Satırlar */}
            {filtered.map(task => (
              <TaskRow
                key={task.id}
                task={task}
                onEdit={openEdit}
                onDelete={(t) => setDeletingTask(t)}
              />
            ))}
          </div>
        )}
      </div>

      {formOpen && (
        <TaskForm editingTask={editingTask} onClose={closeForm} onSaved={(msg) => { closeForm(); showToast(msg); }} />
      )}
      {deletingTask && (
        <DeleteConfirmModal task={deletingTask} onCancel={() => setDeletingTask(null)} onConfirm={handleDelete} />
      )}
    </div>
  );
}
