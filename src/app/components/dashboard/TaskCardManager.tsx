"use client";

import React, { useState, useEffect, useRef } from "react";
import { Star, CalendarDays, Trash2, Edit2, AlertTriangle, Palette, Plus, MoreHorizontal, CheckCircle2, XCircle } from "lucide-react";
import { Task, TYPE_GRADIENT, TypeBadge, getIcon } from "./taskTypes";

// --- BİTİŞ TARİHİ MODAL ---
export function ActivateDateModal({ onConfirm, onCancel, title = "Bitiş tarihi seç", subtitle = "Bu kart aktife alınmadan önce bir bitiş tarihi belirlenmeli.", confirmLabel = "Aktife Al", initialDate = "" }: {
  onConfirm: (date: string) => void;
  onCancel: () => void;
  title?: string;
  subtitle?: string;
  confirmLabel?: string;
  initialDate?: string;
}) {
  const [visible, setVisible] = useState(false);
  const [date, setDate] = useState(initialDate);
  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  const handleCancel  = () => { setVisible(false); setTimeout(onCancel, 280); };
  const handleConfirm = () => { if (!date) return; setVisible(false); setTimeout(() => onConfirm(date), 280); };

  return (
    <div className={`fixed inset-0 z-800 flex items-center justify-center p-6 transition-all duration-300 ${visible ? "visible" : "invisible"}`}>
      <div className={`absolute inset-0 bg-base-primary-900/40 backdrop-blur-md transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`} onClick={handleCancel} />
      <div className={`relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 flex flex-col gap-5 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${visible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"}`}>
        <div>
          <p className="text-[17px] font-bold text-base-primary-900 mb-1">{title}</p>
          <p className="text-[13px] text-surface-500">{subtitle}</p>
        </div>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-full h-12 px-4 rounded-xl border border-surface-200 bg-surface-50 text-[14px] text-text-primary font-medium outline-none focus:border-base-primary-500 focus:bg-white transition-all cursor-pointer"
        />
        <div className="flex gap-3">
          <button onClick={handleCancel} className="flex-1 h-11 rounded-xl border border-surface-200 text-[13px] font-bold text-surface-600 hover:bg-surface-50 transition-all cursor-pointer">Vazgeç</button>
          <button onClick={handleConfirm} disabled={!date} className="flex-1 h-11 rounded-xl bg-base-primary-900 text-white text-[13px] font-bold hover:bg-base-primary-800 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

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
export function TaskRow({ task, onEdit, onDelete, onSendToLibrary, onActivate }: {
  task: Task;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
  onSendToLibrary: (t: Task) => void;
  onActivate: (t: Task) => void;
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
      <div className="flex items-center gap-2.5 w-60 shrink-0 xl:w-80">
        <span className="text-[14px] xl:text-[15px] font-bold text-base-primary-900 truncate">{task.name}</span>
        <TypeBadge type={task.type} />
      </div>
      <p className="flex-1 min-w-0 text-[13px] xl:text-[14px] text-surface-500 truncate hidden md:block">
        {task.description || <span className="italic text-surface-300">Açıklama yok</span>}
      </p>
      <div className="shrink-0 w-32 hidden xl:block truncate">
        <span className="text-[12px] xl:text-[13px] font-medium text-surface-600 truncate block">{task.createdByName || "—"}</span>
      </div>
      <div className="shrink-0 w-24 hidden xl:block truncate">
        <span className="text-[12px] xl:text-[13px] font-medium text-surface-400 truncate block">{task.branch || "—"}</span>
      </div>
      <div className="flex items-center justify-center shrink-0 w-8" title={task.isHidden ? "Sadece yönetim listesinde" : "Ana ekranda görünür"}>
        {task.isHidden
          ? <XCircle size={15} className="text-status-danger-400" />
          : <CheckCircle2 size={15} className="text-status-success-500" />
        }
      </div>
      <div className="flex items-center gap-1 shrink-0 w-16 justify-center">
        <Star size={12} className="text-designstudio-primary-500 fill-designstudio-primary-500" />
        <span className="text-[13px] xl:text-[14px] font-bold text-surface-700">{task.points}</span>
      </div>
      <div className="shrink-0 w-28 hidden lg:flex items-center gap-1.5 text-[12px] xl:text-[13px] font-medium text-surface-400">
        {task.endDate ? (
          <><CalendarDays size={12} /><span>{formatDate(task.endDate)}</span></>
        ) : (
          <span className="italic text-surface-300">Tarih yok</span>
        )}
      </div>
      {/* Düzenle / Sil — her zaman görünür, hover'da koyulaşır */}
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={() => onEdit(task)}
          className="w-8 h-8 flex items-center justify-center rounded-xl text-surface-300 hover:bg-base-primary-50 hover:text-base-primary-500 transition-all cursor-pointer" title="Düzenle">
          <Edit2 size={14} />
        </button>
        <button onClick={() => onDelete(task)}
          className="w-8 h-8 flex items-center justify-center rounded-xl text-surface-300 hover:bg-status-danger-50 hover:text-status-danger-500 transition-all cursor-pointer" title="Sil">
          <Trash2 size={14} />
        </button>
      </div>
      {/* 3-nokta menü — durum aksiyonları */}
      <div className="relative shrink-0" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(v => !v)}
          className="w-8 h-8 flex items-center justify-center rounded-xl text-surface-400 hover:bg-surface-100 hover:text-surface-700 transition-all cursor-pointer"
          title="Seçenekler"
        >
          <MoreHorizontal size={16} />
        </button>
        {menuOpen && (() => {
          // Aktif → aktife al disabled, kütüphaneye gönder aktif
          // Kütüphanede (pasif+görünür) → aktife al aktif, kütüphaneye gönder disabled
          // Gizli (hidden) → her ikisi de aktif
          const activateDisabled  = !!task.isActive;
          const libraryDisabled   = !task.isActive && !task.isHidden;
          return (
            <div className="absolute right-0 top-9 z-50 bg-white border border-surface-100 rounded-2xl shadow-xl overflow-hidden min-w-[175px]">
              <button
                onClick={() => { if (!activateDisabled) { onActivate(task); setMenuOpen(false); } }}
                disabled={activateDisabled}
                className={`w-full px-4 py-2.5 text-left text-[13px] font-bold transition-colors ${activateDisabled ? "text-surface-300 cursor-not-allowed" : "text-base-primary-900 hover:bg-surface-50 cursor-pointer"}`}
              >
                Aktife Al
              </button>
              <button
                onClick={() => { if (!libraryDisabled) { onSendToLibrary(task); setMenuOpen(false); } }}
                disabled={libraryDisabled}
                className={`w-full px-4 py-2.5 text-left text-[13px] font-bold transition-colors border-t border-surface-100 ${libraryDisabled ? "text-surface-300 cursor-not-allowed" : "text-base-primary-900 hover:bg-surface-50 cursor-pointer"}`}
              >
                Kütüphaneye Gönder
              </button>
            </div>
          );
        })()}
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
export function TaskList({ tasks, loading, onEdit, onDelete, onCreateFirst, onSendToLibrary, onActivate }: {
  tasks: Task[];
  loading: boolean;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
  onCreateFirst: () => void;
  onSendToLibrary: (t: Task) => void;
  onActivate: (t: Task) => void;
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
    <div className="bg-white rounded-3xl border border-surface-100 shadow-sm">
      <div className="flex items-center gap-4 px-5 py-3 bg-surface-50 border-b border-surface-100 rounded-t-3xl overflow-hidden">
        <div className="w-9 shrink-0" />
        <div className="w-60 shrink-0 xl:w-80">
          <span className="text-[11px] xl:text-[12px] font-bold text-surface-400">Kart Adı</span>
        </div>
        <div className="flex-1 min-w-0 hidden md:block">
          <span className="text-[11px] xl:text-[12px] font-bold text-surface-400">Açıklama</span>
        </div>
        <div className="w-32 hidden xl:block shrink-0">
          <span className="text-[11px] xl:text-[12px] font-bold text-surface-400">Eğitmen</span>
        </div>
        <div className="w-24 hidden xl:block shrink-0">
          <span className="text-[11px] xl:text-[12px] font-bold text-surface-400">Şube</span>
        </div>
        <div className="w-8 shrink-0" />
        <div className="w-16 text-center shrink-0">
          <span className="text-[11px] xl:text-[12px] font-bold text-surface-400">Puan</span>
        </div>
        <div className="w-28 hidden lg:block">
          <span className="text-[11px] xl:text-[12px] font-bold text-surface-400">Teslim</span>
        </div>
        <div className="w-18 shrink-0" />
        <div className="w-8 shrink-0" />
      </div>
      {tasks.map(task => (
        <TaskRow
          key={task.id}
          task={task}
          onEdit={onEdit}
          onDelete={onDelete}
          onSendToLibrary={onSendToLibrary}
          onActivate={onActivate}
        />
      ))}
    </div>
  );
}
