"use client";

import React, { useState, useEffect } from "react";
import { Star, CalendarDays, Trash2, Edit2, AlertTriangle, Palette, Plus } from "lucide-react";
import { Task, TYPE_GRADIENT, TypeBadge, getIcon } from "./taskTypes";

// --- STAT KARTI ---
export function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-3xl border border-surface-100 px-6 py-5 flex flex-col gap-1">
      <p className="text-[11px] font-bold text-surface-400 uppercase tracking-wider">{label}</p>
      <p className={`text-[30px] font-bold leading-none ${color}`}>{value}</p>
    </div>
  );
}

// --- TASK SATIRI ---
export function TaskRow({ task, onEdit, onDelete }: {
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
      <div className={`w-9 h-9 rounded-xl ${gradient} flex items-center justify-center text-white shadow-sm shrink-0`}>
        {iconNode}
      </div>
      <div className="flex items-center gap-2.5 w-55 shrink-0 xl:w-65">
        <span className="text-[14px] font-bold text-base-primary-900 truncate">{task.name}</span>
        <TypeBadge type={task.type} />
      </div>
      <p className="flex-1 text-[13px] text-surface-500 truncate min-w-0 hidden md:block">
        {task.description || <span className="italic text-surface-300">Açıklama yok</span>}
      </p>
      <div className="flex items-center gap-1 shrink-0 w-16 justify-center">
        <Star size={12} className="text-designstudio-primary-500 fill-designstudio-primary-500" />
        <span className="text-[13px] font-bold text-surface-700">{task.points}</span>
      </div>
      <div className="shrink-0 w-28 hidden lg:flex items-center gap-1.5 text-[12px] font-medium text-surface-400">
        {task.endDate ? (
          <><CalendarDays size={12} /><span>{formatDate(task.endDate)}</span></>
        ) : (
          <span className="italic text-surface-300">Tarih yok</span>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => onEdit(task)}
          className="w-8 h-8 flex items-center justify-center rounded-xl text-surface-400 hover:bg-base-primary-50 hover:text-base-primary-500 transition-all cursor-pointer" title="Düzenle">
          <Edit2 size={14} />
        </button>
        <button onClick={() => onDelete(task)}
          className="w-8 h-8 flex items-center justify-center rounded-xl text-surface-400 hover:bg-status-danger-50 hover:text-status-danger-500 transition-all cursor-pointer" title="Sil">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// --- SİL ONAY MODALİ ---
export function DeleteConfirmModal({ task, onCancel, onConfirm }: {
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

// --- TASK LİSTESİ ---
export function TaskList({ tasks, loading, onEdit, onDelete, onCreateFirst }: {
  tasks: Task[];
  loading: boolean;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
  onCreateFirst: () => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-surface-100 border-t-base-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-surface-300">
        <Palette size={48} className="mb-4 opacity-40" />
        <p className="text-[15px] font-semibold mb-3">Henüz kart yok</p>
        <button onClick={onCreateFirst}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-50 text-surface-500 text-[13px] font-bold hover:text-surface-700 transition-all cursor-pointer">
          <Plus size={14} /> İlk kartı oluştur
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-surface-100 overflow-hidden shadow-sm">
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
      {tasks.map(task => (
        <TaskRow key={task.id} task={task} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}
