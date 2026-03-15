"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/app/lib/firebase";
import {
  collection, deleteDoc, doc, getDocs, onSnapshot,
  query, orderBy, updateDoc,
} from "firebase/firestore";
import {
  Plus, Edit2, Trash2, MoreHorizontal, X, CheckCircle2,
  Trophy, Star, CalendarDays, AlertTriangle, Check,
} from "lucide-react";
import { Task } from "./taskTypes";
import { DeleteConfirmModal } from "./TaskCardManager";
import TaskForm from "./TaskForm";

type AdminTab = "templates" | "active" | "archive" | "scoring";

const GROUPS = ["Grup 101", "Grup 102", "Grup 103"];
const LEVELS = ["Seviye-1", "Seviye-2", "Seviye-3", "Seviye-4"];

// ─── Görev hızlı düzenleme modalı (grup / seviye / tarih) ────────────────────
function TaskQuickEditModal({
  task, onSave, onCancel,
}: {
  task: Task;
  onSave: (classId: string, level: string, endDate: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [classId,  setClassId]  = useState(task.classId  ?? "");
  const [level,    setLevel]    = useState(task.level    ?? "");
  const [endDate,  setEndDate]  = useState(task.endDate  ?? "");
  const [loading,  setLoading]  = useState(false);
  const [visible,  setVisible]  = useState(false);

  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  const handleCancel = () => { setVisible(false); setTimeout(onCancel, 280); };

  const handleSave = async () => {
    setLoading(true);
    await onSave(classId, level, endDate);
    setVisible(false);
    setLoading(false);
  };

  return (
    <div className={`fixed inset-0 z-[800] flex items-center justify-center p-6 transition-all duration-300 ${visible ? "visible" : "invisible"}`}>
      <div
        className={`absolute inset-0 bg-base-primary-900/40 backdrop-blur-md transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
        onClick={handleCancel}
      />
      <div className={`relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 flex flex-col gap-5 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${visible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"}`}>
        <div>
          <p className="text-[17px] font-bold text-base-primary-900 mb-1">Ödevi Düzenle</p>
          <p className="text-[13px] text-surface-500">
            <span className="font-bold text-base-primary-700">"{task.name}"</span> — grup, seviye ve tarihi güncelle.
          </p>
        </div>

        {/* Grup */}
        <div>
          <p className="text-[12px] font-bold text-surface-500 uppercase tracking-wide mb-2">Grup</p>
          <div className="flex flex-wrap gap-2">
            {GROUPS.map(g => (
              <button
                key={g}
                onClick={() => setClassId(g)}
                className={`px-3.5 py-2 rounded-xl text-[12px] font-bold transition-all cursor-pointer border ${
                  classId === g
                    ? "bg-base-primary-900 text-white border-base-primary-900"
                    : "bg-white border-surface-200 text-surface-600 hover:border-base-primary-400 hover:text-base-primary-700"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Seviye */}
        <div>
          <p className="text-[12px] font-bold text-surface-500 uppercase tracking-wide mb-2">Seviye</p>
          <div className="grid grid-cols-4 gap-2">
            {LEVELS.map(l => (
              <button
                key={l}
                onClick={() => setLevel(l)}
                className={`py-2 rounded-xl text-[12px] font-bold transition-all cursor-pointer border ${
                  level === l
                    ? "bg-base-primary-900 text-white border-base-primary-900"
                    : "bg-white border-surface-200 text-surface-600 hover:border-base-primary-400 hover:text-base-primary-700"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Bitiş Tarihi */}
        <div>
          <p className="text-[12px] font-bold text-surface-500 uppercase tracking-wide mb-2">Bitiş Tarihi</p>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="w-full h-12 px-4 rounded-xl border border-surface-200 bg-surface-50 text-[14px] text-text-primary font-medium outline-none focus:border-base-primary-500 focus:bg-white transition-all cursor-pointer"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleCancel}
            className="flex-1 h-11 rounded-xl border border-surface-200 text-[13px] font-bold text-surface-600 hover:bg-surface-50 transition-all cursor-pointer"
          >
            Vazgeç
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 h-11 rounded-xl bg-base-primary-900 text-white text-[13px] font-bold hover:bg-base-primary-800 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : "Kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Silme onay modalı (koleksiyon adı bağımsız) ─────────────────────────────
function DeleteModal({
  task, onCancel, onConfirm,
}: {
  task: Task; collectionName: string; onCancel: () => void; onConfirm: () => void;
}) {
  return (
    <DeleteConfirmModal
      task={task}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}

// ─── Şablon satırı ────────────────────────────────────────────────────────────
function TemplateRow({
  task, onEdit, onDelete, onToggleVisibility,
}: {
  task: Task;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
  onToggleVisibility: (t: Task) => void;
}) {
  const isVisible = !task.isHidden;

  return (
    <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-50 transition-colors border-b border-surface-100 last:border-0 group">
      <div className="flex-1 min-w-0">
        <span className={`text-[14px] font-bold truncate block ${isVisible ? "text-base-primary-900" : "text-surface-400"}`}>{task.name}</span>
      </div>
      <div className="flex-[2] min-w-0 hidden md:block">
        <span className="text-[13px] text-surface-500 truncate block">
          {task.description || <span className="italic text-surface-300">Açıklama yok</span>}
        </span>
      </div>
      <div className="w-28 shrink-0 hidden lg:block">
        <span className="text-[13px] text-surface-500">{task.level || "—"}</span>
      </div>
      {/* Ana ekran görünürlük toggle */}
      <div className="shrink-0">
        <button
          onClick={() => onToggleVisibility(task)}
          title={isVisible ? "Ana ekrandan kaldır" : "Ana ekrana al"}
          className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all cursor-pointer ${
            isVisible
              ? "bg-status-success-50 text-status-success-500 hover:bg-status-success-100"
              : "bg-surface-100 text-surface-400 hover:bg-surface-200"
          }`}
        >
          {isVisible ? <Check size={14} strokeWidth={2.5} /> : <X size={14} strokeWidth={2.5} />}
        </button>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onEdit(task)}
          className="w-8 h-8 flex items-center justify-center rounded-xl text-surface-300 hover:bg-base-primary-50 hover:text-base-primary-500 transition-all cursor-pointer"
          title="Düzenle"
        >
          <Edit2 size={14} />
        </button>
        <button
          onClick={() => onDelete(task)}
          className="w-8 h-8 flex items-center justify-center rounded-xl text-surface-300 hover:bg-status-danger-50 hover:text-status-danger-500 transition-all cursor-pointer"
          title="Sil"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Task satırı (Mevcut Ödevler & Arşiv) ────────────────────────────────────
function TaskRow({
  task, tab, onEdit, onDelete, onArchive, onActivate, onGrade,
}: {
  task: Task;
  tab: "active" | "archive";
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
  onArchive: (t: Task) => void;
  onActivate: (t: Task) => void;
  onGrade: (t: Task) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const formatDate = (d?: string) => {
    if (!d) return null;
    const [y, m, day] = d.split("-");
    const months = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
    return `${parseInt(day)} ${months[parseInt(m) - 1]} ${y}`;
  };

  const isCompleted = task.status === "completed";

  return (
    <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-50 transition-colors border-b border-surface-100 last:border-0 group">
      {/* Ödev Adı */}
      <div className="w-36 shrink-0 xl:w-44">
        <span className="text-[13px] font-bold text-base-primary-900 truncate block">{task.name}</span>
      </div>
      {/* Açıklama */}
      <div className="flex-1 min-w-0 hidden md:block">
        <span className="text-[13px] text-surface-500 truncate block">
          {task.description || <span className="italic text-surface-300">—</span>}
        </span>
      </div>
      {/* Eğitmen */}
      <div className="w-32 shrink-0 hidden lg:block">
        <span className="text-[13px] text-surface-600 truncate block">{task.createdByName || "—"}</span>
      </div>
      {/* Şube */}
      <div className="w-24 shrink-0 hidden xl:block">
        <span className="text-[12px] text-surface-400 truncate block">{task.branch || "—"}</span>
      </div>
      {/* Grup */}
      <div className="w-20 shrink-0 hidden lg:block">
        <span className="text-[12px] text-surface-600 truncate block">{task.classId || "—"}</span>
      </div>
      {/* Seviye */}
      <div className="w-20 shrink-0 hidden lg:block">
        <span className="text-[12px] text-surface-500 truncate block">{task.level || "—"}</span>
      </div>
      {/* Statü */}
      <div className="w-28 shrink-0 hidden lg:block">
        {isCompleted ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-status-success-50 text-status-success-600 text-[11px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-status-success-500" />
            Tamamlandı
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-100 text-surface-500 text-[11px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-surface-400" />
            Aktif
          </span>
        )}
      </div>
      {/* Puan */}
      <div className="w-14 shrink-0 flex items-center gap-1 justify-center">
        <Star size={11} className="text-designstudio-primary-500 fill-designstudio-primary-500" />
        <span className="text-[13px] font-bold text-surface-700">{task.points}</span>
      </div>
      {/* Teslim Tarihi */}
      <div className="w-24 shrink-0 hidden lg:flex items-center gap-1 text-[12px] text-surface-400">
        {task.endDate ? (
          <><CalendarDays size={11} /><span>{formatDate(task.endDate)}</span></>
        ) : (
          <span className="italic text-surface-300">—</span>
        )}
      </div>
      {/* Düzenle / Sil */}
      <div className="w-20 shrink-0 flex items-center gap-1">
        <button
          onClick={() => onEdit(task)}
          className="w-8 h-8 flex items-center justify-center rounded-xl text-surface-300 hover:bg-base-primary-50 hover:text-base-primary-500 transition-all cursor-pointer"
          title="Düzenle"
        >
          <Edit2 size={14} />
        </button>
        <button
          onClick={() => onDelete(task)}
          className="w-8 h-8 flex items-center justify-center rounded-xl text-surface-300 hover:bg-status-danger-50 hover:text-status-danger-500 transition-all cursor-pointer"
          title="Sil"
        >
          <Trash2 size={14} />
        </button>
      </div>
      {/* Üç nokta menüsü */}
      <div className="relative shrink-0" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(v => !v)}
          className="w-8 h-8 flex items-center justify-center rounded-xl text-surface-400 hover:bg-surface-100 hover:text-surface-700 transition-all cursor-pointer"
          title="Seçenekler"
        >
          <MoreHorizontal size={16} />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-9 z-50 bg-white border border-surface-100 rounded-2xl shadow-xl overflow-hidden min-w-[175px]">
            {tab === "active" && isCompleted && (
              <button
                onClick={() => { onGrade(task); setMenuOpen(false); }}
                className="w-full px-4 py-2.5 text-left text-[13px] font-bold text-status-success-600 hover:bg-status-success-50 transition-colors cursor-pointer"
              >
                Not Ver
              </button>
            )}
            {tab === "active" && (
              <button
                onClick={() => { onArchive(task); setMenuOpen(false); }}
                className={`w-full px-4 py-2.5 text-left text-[13px] font-bold text-base-primary-900 hover:bg-surface-50 transition-colors cursor-pointer ${isCompleted ? "border-t border-surface-100" : ""}`}
              >
                Arşive Taşı
              </button>
            )}
            {tab === "archive" && (
              <button
                onClick={() => { onActivate(task); setMenuOpen(false); }}
                className="w-full px-4 py-2.5 text-left text-[13px] font-bold text-status-success-600 hover:bg-status-success-50 transition-colors cursor-pointer"
              >
                Aktife Al
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ANA BİLEŞEN ─────────────────────────────────────────────────────────────
export default function TaskManagementPanel() {
  const router = useRouter();
  const [adminTab, setAdminTab] = useState<AdminTab>("templates");

  // Templates
  const [templates, setTemplates] = useState<Task[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);

  // Tasks
  const [activeTasks, setActiveTasks] = useState<Task[]>([]);
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);

  // Users map
  const [usersMap, setUsersMap] = useState<Record<string, { name: string; branch: string }>>({});

  // Form (şablon düzenleme)
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formCollection, setFormCollection] = useState<string>("templates");

  // Görev hızlı düzenleme (grup/seviye/tarih)
  const [quickEditTask, setQuickEditTask] = useState<Task | null>(null);

  // Delete
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [deletingCollection, setDeletingCollection] = useState<string>("templates");

  // Toast
  const [toast, setToast] = useState({ show: false, message: "" });

  const showToast = (msg: string) => {
    setToast({ show: true, message: msg });
    setTimeout(() => setToast({ show: false, message: "" }), 3000);
  };

  // ── Firestore abonelikleri ──────────────────────────────────────────────────
  useEffect(() => {
    const q = query(collection(db, "templates"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, snap => {
      setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
      setTemplatesLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "tasks"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Task));
      // Mevcut Ödevler: isActive=true ve arşivlenmemiş
      setActiveTasks(all.filter(t =>
        t.isActive === true && t.status !== "archived"
      ));
      // Arşiv: status alanı archived
      setArchivedTasks(all.filter(t =>
        t.status === "archived"
      ));
      setTasksLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    getDocs(collection(db, "users")).then(snap => {
      const map: Record<string, { name: string; branch: string }> = {};
      snap.docs.forEach(d => {
        const data = d.data();
        map[d.id] = {
          name: (data.name && data.surname) ? `${data.name} ${data.surname}` : (data.name || ""),
          branch: data.branch || "",
        };
      });
      setUsersMap(map);
    });
  }, []);

  // ── Yardımcılar ────────────────────────────────────────────────────────────
  const enrichTask = (t: Task): Task => ({
    ...t,
    createdByName: t.createdByName
      || (t.ownedBy   ? usersMap[t.ownedBy]?.name   : undefined)
      || (t.createdBy ? usersMap[t.createdBy]?.name  : undefined),
    branch: t.branch
      || (t.ownedBy   ? usersMap[t.ownedBy]?.branch  : undefined)
      || (t.createdBy ? usersMap[t.createdBy]?.branch : undefined),
  });

  const handleDelete = async () => {
    if (!deletingTask) return;
    try {
      await deleteDoc(doc(db, deletingCollection, deletingTask.id));
      showToast(`"${deletingTask.name}" silindi.`);
    } catch {
      showToast("Silme sırasında hata oluştu.");
    } finally {
      setDeletingTask(null);
    }
  };

  const handleArchive = async (task: Task) => {
    try {
      await updateDoc(doc(db, "tasks", task.id), {
        status: "archived",
        isActive: false,
      });
      showToast(`"${task.name}" arşivlendi.`);
    } catch { showToast("İşlem sırasında hata oluştu."); }
  };

  const handleActivate = async (task: Task) => {
    try {
      await updateDoc(doc(db, "tasks", task.id), {
        status: "active",
        isActive: true,
        isPaused: false,
      });
      showToast(`"${task.name}" aktife alındı.`);
    } catch { showToast("İşlem sırasında hata oluştu."); }
  };

  const handleGrade = (task: Task) => {
    router.push(`/dashboard/notes?taskId=${task.id}`);
  };

  const handleToggleTemplateVisibility = async (task: Task) => {
    try {
      const newHidden = !task.isHidden;
      await updateDoc(doc(db, "templates", task.id), { isHidden: newHidden });
      showToast(newHidden ? `"${task.name}" ana ekrandan kaldırıldı.` : `"${task.name}" ana ekrana alındı.`);
    } catch { showToast("İşlem sırasında hata oluştu."); }
  };

  // ── Form açma fonksiyonları ────────────────────────────────────────────────
  const openTemplateCreate = () => {
    setFormCollection("templates");
    setEditingTask(null);
    setFormOpen(true);
  };

  const openTemplateEdit = (task: Task) => {
    setFormCollection("templates");
    setEditingTask(task);
    setFormOpen(true);
  };

  const openTaskEdit = (task: Task) => setQuickEditTask(task);

  const handleQuickEditSave = async (classId: string, level: string, endDate: string) => {
    if (!quickEditTask) return;
    await updateDoc(doc(db, "tasks", quickEditTask.id), { classId, level, endDate });
    showToast("Ödev güncellendi.");
    setQuickEditTask(null);
  };

  const closeForm = () => { setFormOpen(false); setEditingTask(null); };

  // ── Sekme yapılandırması ───────────────────────────────────────────────────
  const innerTabs: { id: AdminTab; label: string }[] = [
    { id: "templates", label: "Şablon Yönetimi" },
    { id: "active",    label: "Mevcut Ödevler"  },
    { id: "archive",   label: "Arşiv"            },
    { id: "scoring",   label: "Puanlama"          },
  ];

  const enrichedActive   = activeTasks.map(enrichTask);
  const enrichedArchived = archivedTasks.map(enrichTask);


  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-[1920px] mx-auto px-8 mt-[24px] animate-in fade-in duration-500">

      {/* TOAST */}
      {toast.show && (
        <div className="fixed top-12 right-12 z-[200] animate-in fade-in slide-in-from-right duration-300">
          <div className="bg-white border border-surface-100 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-[20px] p-5 flex items-center gap-4 min-w-[300px]">
            <div className="w-10 h-10 rounded-full bg-status-success-50 flex items-center justify-center text-status-success-500">
              <CheckCircle2 size={20} />
            </div>
            <p className="text-[14px] font-bold text-text-primary">{toast.message}</p>
            <button onClick={() => setToast({ show: false, message: "" })} className="ml-auto text-surface-300 hover:text-surface-500 cursor-pointer">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* İÇ SEKMELER */}
      <div className="flex items-center gap-1 bg-surface-50 w-fit p-1 rounded-[14px] border border-surface-100 shadow-sm mb-8">
        {innerTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setAdminTab(tab.id)}
            className={`px-5 py-2 rounded-[10px] text-[13px] font-bold transition-all cursor-pointer outline-none ${
              adminTab === tab.id
                ? "bg-white text-base-primary-900 shadow-sm border border-surface-100"
                : "text-surface-400 hover:text-surface-600 border border-transparent"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── ŞABLON YÖNETİMİ ─────────────────────────────────────────────────── */}
      {adminTab === "templates" && (
        <div className="space-y-8">
          {/* Üst kısım */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[20px] font-bold text-base-primary-900 leading-none mb-1">Şablon Yönetimi</h2>
              <p className="text-[13px] text-surface-400">Eğitmenlerin kullanacağı ödev şablonlarını oluştur ve yönet.</p>
            </div>
            <button
              onClick={openTemplateCreate}
              className="flex items-center gap-2 px-5 py-3 bg-base-primary-900 text-white rounded-2xl text-[13px] font-bold hover:bg-base-primary-800 active:scale-95 transition-all cursor-pointer shadow-sm"
            >
              <Plus size={15} /> Yeni Şablon Oluştur
            </button>
          </div>

          {/* Şablon listesi */}
          <div className="bg-white rounded-3xl border border-surface-100 shadow-sm overflow-visible">
            {/* Başlık satırı */}
            <div className="flex items-center gap-4 px-5 py-3 bg-surface-50 border-b border-surface-100 rounded-t-3xl">
              <div className="flex-1 min-w-0">
                <span className="text-[12px] font-bold text-surface-600">Kart Adı</span>
              </div>
              <div className="flex-[2] min-w-0 hidden md:block">
                <span className="text-[12px] font-bold text-surface-600">Açıklama</span>
              </div>
              <div className="w-28 shrink-0 hidden lg:block">
                <span className="text-[12px] font-bold text-surface-600">Seviye</span>
              </div>
              <div className="w-8 shrink-0 text-center">
                <span className="text-[12px] font-bold text-surface-600">Ana Ekran</span>
              </div>
              <div className="w-20 shrink-0" />
            </div>

            {templatesLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-7 h-7 border-2 border-surface-100 border-t-base-primary-500 rounded-full animate-spin" />
              </div>
            ) : templates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-surface-300">
                <p className="text-[14px] font-semibold mb-3">Henüz şablon yok</p>
                <button onClick={openTemplateCreate} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-50 text-surface-500 text-[13px] font-bold hover:text-surface-700 transition-all cursor-pointer">
                  <Plus size={13} /> İlk şablonu oluştur
                </button>
              </div>
            ) : (
              templates.map(t => (
                <TemplateRow
                  key={t.id}
                  task={t}
                  onEdit={openTemplateEdit}
                  onDelete={task => { setDeletingCollection("templates"); setDeletingTask(task); }}
                  onToggleVisibility={handleToggleTemplateVisibility}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* ── MEVCUT ÖDEVLER ──────────────────────────────────────────────────── */}
      {adminTab === "active" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-[20px] font-bold text-base-primary-900 leading-none mb-1">Mevcut Ödevler</h2>
            <p className="text-[13px] text-surface-400">Eğitmenlerin aktif olarak atadığı ödevler. ({enrichedActive.length} kayıt)</p>
          </div>
          <TaskTable
            tasks={enrichedActive}
            loading={tasksLoading}
            tab="active"
            onEdit={openTaskEdit}
            onDelete={task => { setDeletingCollection("tasks"); setDeletingTask(task); }}
            onArchive={handleArchive}
            onActivate={handleActivate}
            onGrade={handleGrade}
          />
        </div>
      )}

      {/* ── ARŞİV ───────────────────────────────────────────────────────────── */}
      {adminTab === "archive" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-[20px] font-bold text-base-primary-900 leading-none mb-1">Arşiv</h2>
            <p className="text-[13px] text-surface-400">Arşivlenen ödevler. ({enrichedArchived.length} kayıt)</p>
          </div>
          <TaskTable
            tasks={enrichedArchived}
            loading={tasksLoading}
            tab="archive"
            onEdit={openTaskEdit}
            onDelete={task => { setDeletingCollection("tasks"); setDeletingTask(task); }}
            onArchive={handleArchive}
            onActivate={handleActivate}
            onGrade={handleGrade}
          />
        </div>
      )}

      {/* ── PUANLAMA ────────────────────────────────────────────────────────── */}
      {adminTab === "scoring" && (
        <div className="bg-white border border-surface-100 rounded-[24px] p-20 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-designstudio-primary-50 rounded-2xl flex items-center justify-center text-designstudio-primary-500 mb-4">
            <Trophy size={32} />
          </div>
          <h3 className="text-[18px] font-bold text-base-primary-900">Puanlama Sistemi</h3>
          <p className="text-surface-400 text-[14px] mt-2 max-w-sm">
            Puanlama modülü çok yakında bu alanda aktif olacak.
          </p>
        </div>
      )}

      {/* FORM MODAL */}
      {formOpen && (
        <TaskForm
          editingTask={editingTask}
          onClose={closeForm}
          onSaved={msg => { closeForm(); showToast(msg); }}
          targetCollection={formCollection}
        />
      )}

      {/* GÖREV HIZLI DÜZENLEME MODAL */}
      {quickEditTask && (
        <TaskQuickEditModal
          task={quickEditTask}
          onSave={handleQuickEditSave}
          onCancel={() => setQuickEditTask(null)}
        />
      )}

      {/* SİLME MODAL */}
      {deletingTask && (
        <DeleteModal
          task={deletingTask}
          collectionName={deletingCollection}
          onCancel={() => setDeletingTask(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}

// ─── Tasks tablosu (Mevcut Ödevler & Arşiv için ortak) ───────────────────────
function TaskTable({
  tasks, loading, tab, onEdit, onDelete, onArchive, onActivate, onGrade,
}: {
  tasks: Task[];
  loading: boolean;
  tab: "active" | "archive";
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
  onArchive: (t: Task) => void;
  onActivate: (t: Task) => void;
  onGrade: (t: Task) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-7 h-7 border-2 border-surface-100 border-t-base-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-surface-100 flex flex-col items-center justify-center py-20 text-surface-300">
        <AlertTriangle size={36} className="mb-3 opacity-30" />
        <p className="text-[14px] font-semibold">
          {tab === "active" ? "Aktif ödev bulunamadı." : "Arşivde kayıt yok."}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-surface-100 shadow-sm overflow-visible">
      {/* Başlık satırı */}
      <div className="flex items-center gap-4 px-5 py-3 bg-surface-50 border-b border-surface-100 rounded-t-3xl">
        <div className="w-36 shrink-0 xl:w-44">
          <span className="text-[12px] font-bold text-surface-600">Ödev Adı</span>
        </div>
        <div className="flex-1 min-w-0 hidden md:block">
          <span className="text-[12px] font-bold text-surface-600">Açıklama</span>
        </div>
        <div className="w-32 shrink-0 hidden lg:block">
          <span className="text-[12px] font-bold text-surface-600">Eğitmen</span>
        </div>
        <div className="w-24 shrink-0 hidden xl:block">
          <span className="text-[12px] font-bold text-surface-600">Şube</span>
        </div>
        <div className="w-20 shrink-0 hidden lg:block">
          <span className="text-[12px] font-bold text-surface-600">Grup</span>
        </div>
        <div className="w-20 shrink-0 hidden lg:block">
          <span className="text-[12px] font-bold text-surface-600">Seviye</span>
        </div>
        <div className="w-28 shrink-0 hidden lg:block">
          <span className="text-[12px] font-bold text-surface-600">Statü</span>
        </div>
        <div className="w-14 shrink-0 text-center">
          <span className="text-[12px] font-bold text-surface-600">Puan</span>
        </div>
        <div className="w-24 shrink-0 hidden lg:block">
          <span className="text-[12px] font-bold text-surface-600">Teslim</span>
        </div>
        <div className="w-20 shrink-0" />
        <div className="w-8 shrink-0" />
      </div>

      {tasks.map(task => (
        <TaskRow
          key={task.id}
          task={task}
          tab={tab}
          onEdit={onEdit}
          onDelete={onDelete}
          onArchive={onArchive}
          onActivate={onActivate}
          onGrade={onGrade}
        />
      ))}
    </div>
  );
}
