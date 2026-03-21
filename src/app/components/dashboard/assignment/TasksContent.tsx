"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/app/lib/firebase";
import { collection, deleteDoc, doc, getDocs, onSnapshot, query, orderBy, updateDoc } from "firebase/firestore";
import { Plus, Filter, X, CheckCircle2 } from "lucide-react";
import { Task, FilterTab } from "./taskTypes";
import { StatCard, TaskList, DeleteConfirmModal } from "./TaskCardManager";
import { useUser } from "@/app/context/UserContext";
import TaskForm from "./TaskForm";

export default function TasksContent() {
  const { user }                        = useUser();
  const [tasks, setTasks]               = useState<Task[]>([]);
  const [usersMap, setUsersMap]         = useState<Record<string, { name: string; branch: string }>>({});
  const [loading, setLoading]           = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("tumu");
  const [branchFilter, setBranchFilter] = useState("tumu");
  const [formOpen, setFormOpen]         = useState(false);
  const [editingTask, setEditingTask]   = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [toast, setToast]               = useState({ show: false, message: "" });

  useEffect(() => {
    const q = query(collection(db, "tasks"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
      setLoading(false);
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

  const handleSendToLibrary = async (task: Task) => {
    try {
      await updateDoc(doc(db, "tasks", task.id), { isActive: false, isHidden: false, isPaused: false, endDate: null });
      showToast(`"${task.name}" kütüphaneye gönderildi.`);
    } catch { showToast("İşlem sırasında hata oluştu."); }
  };

  const handleActivate = async (task: Task) => {
    try {
      await updateDoc(doc(db, "tasks", task.id), { isActive: true, isPaused: false, isHidden: false });
      showToast(`"${task.name}" aktife alındı.`);
    } catch { showToast("İşlem sırasında hata oluştu."); }
  };

  const enriched = tasks.map(t => ({
    ...t,
    // Eğitmen adı: önce ownedBy kullanıcısından, sonra createdByName alanından, son olarak createdBy'dan al
    createdByName: t.createdByName
      || (t.ownedBy   ? usersMap[t.ownedBy]?.name   : undefined)
      || (t.createdBy ? usersMap[t.createdBy]?.name  : undefined),
    branch: t.branch
      || (t.ownedBy   ? usersMap[t.ownedBy]?.branch  : undefined)
      || (t.createdBy ? usersMap[t.createdBy]?.branch : undefined),
  }));

  const filtered = enriched
    .filter(t => activeFilter === "tumu" || t.type === activeFilter)
    .filter(t => branchFilter === "tumu" || t.branch === branchFilter);

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
          <StatCard label="Toplam"   value={tasks.length}                                  color="text-base-primary-900" />
          <StatCard label="Ödev"     value={tasks.filter(t => t.type === "odev").length}   color="text-designstudio-secondary-500" />
          <StatCard label="Proje"    value={tasks.filter(t => t.type === "proje").length}  color="text-accent-turquoise-500" />
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
        <div className="ml-auto">
          <select
            value={branchFilter}
            onChange={e => setBranchFilter(e.target.value)}
            className="h-8 px-3 rounded-xl text-[12px] xl:text-[13px] font-bold border border-surface-100 bg-white text-surface-500 outline-none cursor-pointer hover:border-surface-300 transition-all"
          >
            <option value="tumu">Tüm Şubeler</option>
            <option value="Kadıköy Şb">Kadıköy Şb</option>
            <option value="Şirinevler Şb">Şirinevler Şb</option>
            <option value="Pendik Şb">Pendik Şb</option>
          </select>
        </div>
      </div>

      {/* LİSTE */}
      <div className="px-6 xl:px-8 2xl:px-12">
        <TaskList
          tasks={filtered}
          loading={loading}
          onEdit={openEdit}
          onDelete={(t) => setDeletingTask(t)}
          onCreateFirst={openCreate}
          onSendToLibrary={handleSendToLibrary}
          onActivate={handleActivate}
        />
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
