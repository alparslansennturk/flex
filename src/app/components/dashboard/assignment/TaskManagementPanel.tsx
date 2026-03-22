"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/app/lib/firebase";
import {
  collection, deleteDoc, doc, deleteField, getDoc, getDocs, onSnapshot,
  query, orderBy, where, limit, updateDoc, writeBatch, addDoc, serverTimestamp,
} from "firebase/firestore";
import {
  Plus, Edit2, Trash2, MoreHorizontal, X, CheckCircle2,
  Star, CalendarDays, AlertTriangle, Check,
  Database, RotateCcw, Eye, EyeOff, Flame,
} from "lucide-react";
import ScoringSettingsPanel from "../scoring/ScoringSettingsPanel";
import { Task } from "./taskTypes";
import { DeleteConfirmModal } from "./TaskCardManager";
import TaskForm from "./TaskForm";
import { auth } from "@/app/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useScoring } from "@/app/context/ScoringContext";
import AssignmentPoolPanel from "./pool/AssignmentPoolPanel";

type AdminTab = "templates" | "active" | "archive" | "scoring" | "pools";

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
    <div className={`fixed inset-0 z-800 flex items-center justify-center p-6 transition-all duration-300 ${visible ? "visible" : "invisible"}`}>
      <div
        className={`absolute inset-0 bg-base-primary-900/40 backdrop-blur-md transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
        onClick={handleCancel}
      />
      <div className={`relative bg-white rounded-16 shadow-2xl w-full max-w-md p-8 flex flex-col gap-5 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${visible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"}`}>
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
      <div className="flex-2 min-w-0 hidden md:block">
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
  task, tab, onEdit, onDelete, onArchive, onActivate, onGrade, onSendToGrading,
}: {
  task: Task;
  tab: "active" | "archive";
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
  onArchive: (t: Task) => void;
  onActivate: (t: Task) => void;
  onGrade: (t: Task) => void;
  onSendToGrading: (t: Task) => void;
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
          <div className="absolute right-0 top-9 z-50 bg-white border border-surface-100 rounded-2xl shadow-xl overflow-hidden min-w-43.75">
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
              <>
                <button
                  onClick={() => { onActivate(task); setMenuOpen(false); }}
                  className="w-full px-4 py-2.5 text-left text-[13px] font-bold text-status-success-600 hover:bg-status-success-50 transition-colors cursor-pointer"
                >
                  Aktife Al
                </button>
                <div className="border-t border-surface-100" />
                <button
                  onClick={() => { onSendToGrading(task); setMenuOpen(false); }}
                  className="w-full px-4 py-2.5 text-left text-[13px] font-bold text-base-primary-600 hover:bg-surface-50 transition-colors cursor-pointer"
                >
                  Not Alanına Gönder
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── UNHIDE SCORES MODAL ─────────────────────────────────────────────────────
function UnhideScoresModal({ onCancel, onSuccess }: { onCancel: () => void; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);
  const [error,   setError]   = useState("");
  const [visible, setVisible] = useState(false);

  const { revertSeason } = useScoring();

  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  const handleCancel = () => { setVisible(false); setTimeout(onCancel, 280); };

  const handleUnhide = async () => {
    setLoading(true); setError("");
    try {
      // 1. Tüm öğrencilerin gizleme bayrağını kaldır
      const snap = await getDocs(
        query(collection(db, "students"), where("isScoreHidden", "==", true))
      );
      if (!snap.empty) {
        for (let i = 0; i < snap.docs.length; i += 500) {
          const batch = writeBatch(db);
          snap.docs.slice(i, i + 500).forEach(d => {
            batch.update(d.ref, { isScoreHidden: false });
          });
          await batch.commit();
        }
      }
      // 2. Sezon sayacını geri al → eski gradedTasks kayıtları tekrar görünür
      await revertSeason();

      setDone(true);
      setTimeout(() => { setVisible(false); setTimeout(onSuccess, 280); }, 2000);
    } catch { setError("İşlem sırasında hata oluştu."); }
    finally { setLoading(false); }
  };

  return (
    <div className={`fixed inset-0 z-900 flex items-center justify-center p-6 transition-all duration-300 ${visible ? "visible" : "invisible"}`}>
      <div
        className={`absolute inset-0 bg-base-primary-900/30 backdrop-blur-md transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
        onClick={handleCancel}
      />
      <div className={`relative bg-white rounded-24 shadow-2xl w-full max-w-md p-8 flex flex-col gap-6 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${visible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"}`}>
        {done ? (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-16 h-16 rounded-full bg-status-success-50 flex items-center justify-center">
              <CheckCircle2 size={32} className="text-status-success-500" />
            </div>
            <p className="text-[17px] font-bold text-text-primary">Puanlar Açıldı</p>
            <p className="text-[13px] text-text-tertiary text-center">Gizlenen tüm öğrenci puanları tekrar görünür.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-16 bg-[#FFF9EB] flex items-center justify-center shrink-0">
                <Eye size={18} className="text-[#FFB020]" />
              </div>
              <div>
                <h2 className="text-[17px] font-bold text-text-primary leading-none">Gizli Puanları Aç</h2>
                <p className="text-[12px] text-text-tertiary mt-0.5">isScoreHidden=true olan tüm öğrenciler etkilenir</p>
              </div>
            </div>

            <div className="bg-[#FFF9EB] rounded-16 p-4 border border-[#FFE8A0]">
              <p className="text-[13px] text-[#C98A00]">
                Eğitmenin "Puanları Sıfırla" işlemiyle gizlenen tüm öğrenci puanları tekrar
                leaderboard'da görünür hale gelir. Herhangi bir veri silinmez.
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-status-danger-50 rounded-xl px-4 py-2.5 border border-status-danger-100">
                <AlertTriangle size={14} className="text-status-danger-500 shrink-0" />
                <span className="text-[13px] font-bold text-status-danger-500">{error}</span>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={handleCancel} className="flex-1 h-11 rounded-xl border border-surface-200 text-[13px] font-bold text-surface-600 hover:bg-surface-50 transition-all cursor-pointer">
                Vazgeç
              </button>
              <button
                onClick={handleUnhide}
                disabled={loading}
                className="flex-1 h-11 rounded-xl bg-[#FFB020] text-white text-[13px] font-bold hover:bg-[#E09A00] active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <><Eye size={14} />Puanları Aç</>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── ADMIN HARD RESET MODAL ──────────────────────────────────────────────────
function HardResetModal({ onCancel, onSuccess, seasonId }: { onCancel: () => void; onSuccess: () => void; seasonId: string }) {
  const [step,     setStep]     = useState<1 | 2>(1);
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [done,     setDone]     = useState(false);
  const [visible,  setVisible]  = useState(false);

  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  const handleCancel = () => { setVisible(false); setTimeout(onCancel, 280); };
  const confirmReady = password.trim().length > 0;

  const handleReset = async () => {
    if (!password.trim()) { setError("Şifrenizi girin."); return; }
    setLoading(true); setError("");
    try {
      const user = auth.currentUser;
      if (!user || !user.email) throw new Error("no-user");
      await signInWithEmailAndPassword(auth, user.email, password);

      // 1. Tüm öğrencileri çek
      const allSnap = await getDocs(collection(db, "students"));

      // 2. Yedek dokümanı oluştur (seasonId dahil)
      const backupRef = await addDoc(collection(db, "scores_backup"), {
        createdAt:    serverTimestamp(),
        createdBy:    user.uid,
        studentCount: allSnap.docs.length,
        seasonId,
      });

      // 3. Yedek girdilerini batch ile kaydet
      for (let i = 0; i < allSnap.docs.length; i += 500) {
        const batch = writeBatch(db);
        allSnap.docs.slice(i, i + 500).forEach(d => {
          const data = d.data() as any;
          batch.set(doc(collection(db, "scores_backup_entries")), {
            backupId:      backupRef.id,
            studentId:     d.id,
            gradedTasks:   data.gradedTasks   ?? {},
            isScoreHidden: data.isScoreHidden  ?? false,
          });
        });
        await batch.commit();
      }

      // 3b. Son 5 yedeği koru — fazlasını sil
      const allBackupsSnap = await getDocs(
        query(collection(db, "scores_backup"), orderBy("createdAt", "desc"))
      );
      const excess = allBackupsSnap.docs.slice(5);
      for (const old of excess) {
        const oldEntries = await getDocs(
          query(collection(db, "scores_backup_entries"), where("backupId", "==", old.id))
        );
        const delBatch = writeBatch(db);
        oldEntries.docs.forEach(e => delBatch.delete(e.ref));
        delBatch.delete(old.ref);
        await delBatch.commit();
      }

      // 4. Hard reset: gradedTasks temizle, isScoreHidden kaldır, rankChange sıfırla
      for (let i = 0; i < allSnap.docs.length; i += 500) {
        const batch = writeBatch(db);
        allSnap.docs.slice(i, i + 500).forEach(d => {
          batch.update(d.ref, { gradedTasks: {}, isScoreHidden: false, rankChange: 0 });
        });
        await batch.commit();
      }

      setDone(true);
      setTimeout(() => { setVisible(false); setTimeout(onSuccess, 280); }, 2000);
    } catch (e: any) {
      console.error("[HardResetModal] hata:", e);
      const code = e?.code ?? "";
      if (
        code === "auth/wrong-password" ||
        code === "auth/invalid-credential" ||
        code === "auth/invalid-login-credentials"
      ) {
        setError("Şifre hatalı. Tekrar deneyin.");
      } else if (e?.message === "no-user") {
        setError("Oturum bilgisi bulunamadı.");
      } else {
        setError("Şifre yanlış veya işlem sırasında hata oluştu.");
      }
    } finally { setLoading(false); }
  };

  return (
    <div className={`fixed inset-0 z-900 flex items-center justify-center p-6 transition-all duration-300 ${visible ? "visible" : "invisible"}`}>
      <div
        className={`absolute inset-0 bg-red-950/40 backdrop-blur-md transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
        onClick={handleCancel}
      />
      <div className={`relative bg-white rounded-24 shadow-2xl w-full max-w-lg p-8 flex flex-col gap-6 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${visible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"}`}>

        {done ? (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-16 h-16 rounded-full bg-status-success-50 flex items-center justify-center">
              <CheckCircle2 size={32} className="text-status-success-500" />
            </div>
            <p className="text-[17px] font-bold text-text-primary">Fabrika Ayarı Uygulandı</p>
            <p className="text-[13px] text-text-tertiary text-center">
              Tüm öğrenci puanları silindi. Yedek başarıyla oluşturuldu.
            </p>
          </div>

        ) : step === 1 ? (
          <>
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="w-16 h-16 rounded-24 bg-status-danger-50 flex items-center justify-center">
                <Flame size={32} className="text-status-danger-500" />
              </div>
              <h2 className="text-[20px] font-bold text-text-primary">FABRİKA AYARI</h2>
              <p className="text-[13px] font-bold text-status-danger-500">TÜM PUANLARI KALICI OLARAK SİL</p>
            </div>

            <div className="bg-status-danger-50 rounded-16 p-4 border border-status-danger-100 space-y-2.5">
              <p className="text-[12px] font-bold text-status-danger-700 uppercase tracking-wide">Bu işlem şunları yapacaktır:</p>
              <ul className="space-y-1.5 text-[13px] text-status-danger-600">
                <li className="flex items-start gap-2"><span className="mt-0.5 shrink-0">•</span>Tüm öğrencilerin kazanılan XP ve görev kayıtları silinecek</li>
                <li className="flex items-start gap-2"><span className="mt-0.5 shrink-0">•</span>Tüm sıralama ve ceza bilgileri sıfırlanacak</li>
                <li className="flex items-start gap-2"><span className="mt-0.5 shrink-0">•</span>Öğrenci bilgileri ve ödevler <strong>etkilenmez</strong></li>
              </ul>
              <div className="flex items-center gap-2 pt-1.5 border-t border-status-danger-100">
                <Database size={13} className="text-status-success-600 shrink-0" />
                <p className="text-[11px] font-bold text-status-success-600">
                  İşlem öncesi otomatik yedek oluşturulur — geri yükleme mümkündür.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={handleCancel} className="flex-1 h-11 rounded-xl border border-surface-200 text-[13px] font-bold text-surface-600 hover:bg-surface-50 transition-all cursor-pointer">
                Vazgeç
              </button>
              <button onClick={() => setStep(2)} className="flex-1 h-11 rounded-xl bg-status-danger-500 text-white text-[13px] font-bold hover:bg-status-danger-600 active:scale-95 transition-all cursor-pointer">
                Devam Et →
              </button>
            </div>
          </>

        ) : (
          <>
            <div className="text-center">
              <h2 className="text-[17px] font-bold text-text-primary">Son Onay</h2>
              <p className="text-[13px] text-text-tertiary mt-1">Bu işlem geri alınamaz — lütfen dikkatlice okuyun</p>
            </div>

            {/* Şifre */}
            <div>
              <p className="text-[12px] font-bold text-surface-600 mb-2">Hesap şifreniz</p>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 px-4 pr-10 rounded-xl border border-surface-200 bg-surface-50 text-[14px] outline-none focus:border-status-danger-400 focus:bg-white transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-3 text-surface-300 hover:text-surface-500 cursor-pointer"
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-status-danger-50 rounded-xl px-4 py-2.5 border border-status-danger-100">
                <AlertTriangle size={14} className="text-status-danger-500 shrink-0" />
                <span className="text-[13px] font-bold text-status-danger-500">{error}</span>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setStep(1); setPassword(""); setError(""); }}
                className="flex-1 h-11 rounded-xl border border-surface-200 text-[13px] font-bold text-surface-600 hover:bg-surface-50 transition-all cursor-pointer"
              >
                ← Geri
              </button>
              <button
                onClick={handleReset}
                disabled={!confirmReady || loading}
                className="flex-1 h-11 rounded-xl bg-status-danger-500 text-white text-[13px] font-bold hover:bg-status-danger-600 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : "Fabrika Ayarını Uygula"
                }
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── RESTORE MODAL ─────────────────────────────────────────────────────────────
function RestoreModal({ onCancel, onSuccess }: { onCancel: () => void; onSuccess: () => void }) {
  const [backups,  setBackups]  = useState<{ id: string; createdAt: any; studentCount: number; seasonId?: string }[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const [done,     setDone]     = useState(false);
  const [error,    setError]    = useState("");
  const [visible,  setVisible]  = useState(false);

  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  useEffect(() => {
    (async () => {
      try {
        const q    = query(collection(db, "scores_backup"), orderBy("createdAt", "desc"), limit(5));
        const snap = await getDocs(q);
        setBackups(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
      } catch { setError("Yedek bilgisi yüklenemedi."); }
      finally { setLoading(false); }
    })();
  }, []);

  const handleCancel = () => { setVisible(false); setTimeout(onCancel, 280); };

  const handleRestore = async (backupId: string) => {
    setApplying(backupId); setError("");
    try {
      const entriesSnap = await getDocs(
        query(collection(db, "scores_backup_entries"), where("backupId", "==", backupId))
      );
      for (let i = 0; i < entriesSnap.docs.length; i += 500) {
        const batch = writeBatch(db);
        entriesSnap.docs.slice(i, i + 500).forEach(d => {
          const data = d.data() as any;
          batch.update(doc(db, "students", data.studentId), {
            gradedTasks:   data.gradedTasks   ?? {},
            isScoreHidden: data.isScoreHidden  ?? false,
            rankChange:    0,
          });
        });
        await batch.commit();
      }
      setDone(true);
      setTimeout(() => { setVisible(false); setTimeout(onSuccess, 280); }, 2000);
    } catch { setError("Geri yükleme sırasında hata oluştu."); }
    finally { setApplying(null); }
  };

  const fmt = (ts: any) => {
    if (!ts?.toDate) return "—";
    return ts.toDate().toLocaleString("tr-TR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className={`fixed inset-0 z-900 flex items-center justify-center p-6 transition-all duration-300 ${visible ? "visible" : "invisible"}`}>
      <div
        className={`absolute inset-0 bg-base-primary-900/30 backdrop-blur-md transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
        onClick={handleCancel}
      />
      <div className={`relative bg-white rounded-24 shadow-2xl w-full max-w-md p-8 flex flex-col gap-6 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${visible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"}`}>

        {done ? (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-16 h-16 rounded-full bg-status-success-50 flex items-center justify-center">
              <CheckCircle2 size={32} className="text-status-success-500" />
            </div>
            <p className="text-[17px] font-bold text-text-primary">Puanlar Geri Yüklendi</p>
            <p className="text-[13px] text-text-tertiary text-center">Yedekten başarıyla geri yüklendi. Sıralama trendleri sıfırlandı.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-16 bg-base-primary-50 flex items-center justify-center shrink-0">
                <RotateCcw size={18} className="text-base-primary-500" />
              </div>
              <div>
                <h2 className="text-[17px] font-bold text-text-primary leading-none">Puanları Geri Yükle</h2>
                <p className="text-[12px] text-text-tertiary mt-0.5">Son 5 yedek — bir tanesini seç ve uygula</p>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-surface-100 border-t-base-primary-500 rounded-full animate-spin" />
              </div>
            ) : backups.length === 0 ? (
              <div className="bg-surface-50 rounded-16 p-5 text-center">
                <Database size={28} className="text-surface-200 mx-auto mb-2" />
                <p className="text-[13px] font-semibold text-text-tertiary">Henüz yedek bulunamadı</p>
                <p className="text-[12px] text-text-disabled mt-1">İlk Fabrika Ayarı sonrası yedek oluşacak</p>
              </div>
            ) : (
              <div className="space-y-2">
                {backups.map((b, idx) => (
                  <div key={b.id} className="flex items-center gap-3 bg-surface-50 rounded-16 p-3.5 border border-surface-100">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        {idx === 0 && (
                          <span className="text-[10px] font-bold text-base-primary-500 bg-base-primary-100 px-2 py-0.5 rounded-lg shrink-0">Son</span>
                        )}
                        <p className="text-[13px] font-bold text-base-primary-900 truncate">{fmt(b.createdAt)}</p>
                      </div>
                      <p className="text-[11px] text-surface-400">{b.studentCount} öğrenci{b.seasonId ? ` · ${b.seasonId}` : ""}</p>
                    </div>
                    <button
                      onClick={() => handleRestore(b.id)}
                      disabled={applying !== null}
                      className="shrink-0 flex items-center gap-1.5 h-8 px-3.5 rounded-xl bg-base-primary-900 text-white text-[12px] font-bold hover:bg-base-primary-800 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {applying === b.id
                        ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        : <><RotateCcw size={12} />Geri Yükle</>}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 bg-status-danger-50 rounded-xl px-4 py-2.5 border border-status-danger-100">
                <AlertTriangle size={14} className="text-status-danger-500 shrink-0" />
                <span className="text-[13px] font-bold text-status-danger-500">{error}</span>
              </div>
            )}

            <button onClick={handleCancel} className="h-11 rounded-xl border border-surface-200 text-[13px] font-bold text-surface-600 hover:bg-surface-50 transition-all cursor-pointer">
              Kapat
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── ANA BİLEŞEN ─────────────────────────────────────────────────────────────
export default function TaskManagementPanel() {
  const router = useRouter();
  const { activeSeasonId } = useScoring();
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

  // Admin modals
  const [showHardReset, setShowHardReset] = useState(false);
  const [showRestore,   setShowRestore]   = useState(false);
  const [showUnhide,    setShowUnhide]    = useState(false);

  // Archive bulk select
  const [selectedArchiveIds, setSelectedArchiveIds] = useState<Set<string>>(new Set());
  const toggleArchiveSelect = (id: string) =>
    setSelectedArchiveIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleSelectAll = (ids: string[]) =>
    setSelectedArchiveIds(prev => prev.size === ids.length ? new Set() : new Set(ids));

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

  // Görev arşivden aktife alınırken gradedTasks kaydını sil (gerçek geri alma)
  const buildActivateBatch = async (task: Task) => {
    const taskRef = doc(db, "tasks", task.id);
    if (!task.isGraded) {
      await updateDoc(taskRef, { status: "active", isActive: true, isPaused: false });
      return;
    }
    const taskSnap = await getDoc(taskRef);
    const data = taskSnap.exists() ? (taskSnap.data() as any) : {};
    const grades: Record<string, { submitted?: boolean }> = data.grades ?? {};
    const batch = writeBatch(db);
    Object.entries(grades).forEach(([sid, g]) => {
      if (!g.submitted) return;
      batch.update(doc(db, "students", sid), { [`gradedTasks.${task.id}`]: deleteField() });
    });
    batch.update(taskRef, { grades: {}, isGraded: false, gradedAt: null, status: "active", isActive: true, isPaused: false });
    await batch.commit();
  };

  const handleActivate = async (task: Task) => {
    try {
      await buildActivateBatch(task);
      showToast(`"${task.name}" aktife alındı.`);
    } catch { showToast("İşlem sırasında hata oluştu."); }
  };

  // Arşivden not alanına gönder — eski gradedTasks KORUNUR, sadece task belgesi sıfırlanır
  const handleSendToGrading = async (task: Task) => {
    try {
      await updateDoc(doc(db, "tasks", task.id), {
        status:   "completed",
        isGraded: false,
        isActive: false,
        grades:   {},
        gradedAt: null,
      });
      showToast(`"${task.name}" not alanına gönderildi.`);
    } catch { showToast("İşlem sırasında hata oluştu."); }
  };

  // Arşivden seçilenleri sil
  const handleBulkDeleteArchive = async (ids: string[]) => {
    if (ids.length === 0) return;
    try {
      for (let i = 0; i < ids.length; i += 500) {
        const batch = writeBatch(db);
        ids.slice(i, i + 500).forEach(id => batch.delete(doc(db, "tasks", id)));
        await batch.commit();
      }
      setSelectedArchiveIds(new Set());
      showToast(`${ids.length} görev arşivden silindi.`);
    } catch { showToast("Silme sırasında hata oluştu."); }
  };

  const handleGrade = (task: Task) => {
    router.push(`/dashboard/grading?taskId=${task.id}`);
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
    { id: "scoring",   label: "Puan Yönetimi"    },
    { id: "pools",     label: "Ödev Havuzları"   },
  ];

  const enrichedActive   = activeTasks.map(enrichTask);
  const enrichedArchived = archivedTasks.map(enrichTask);


  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-480 mx-auto px-8 mt-6 animate-in fade-in duration-500">

      {/* TOAST */}
      {toast.show && (
        <div className="fixed top-12 right-12 z-200 animate-in fade-in slide-in-from-right duration-300">
          <div className="bg-white border border-surface-100 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-16 p-5 flex items-center gap-4 min-w-75">
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
          <div className="bg-white rounded-16 border border-surface-100 shadow-sm overflow-visible">
            {/* Başlık satırı */}
            <div className="flex items-center gap-4 px-5 py-3 bg-surface-50 border-b border-surface-100 rounded-t-16">
              <div className="flex-1 min-w-0">
                <span className="text-[12px] font-bold text-surface-600">Kart Adı</span>
              </div>
              <div className="flex-2 min-w-0 hidden md:block">
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
            onSendToGrading={handleSendToGrading}
          />
        </div>
      )}

      {/* ── ARŞİV ───────────────────────────────────────────────────────────── */}
      {adminTab === "archive" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[20px] font-bold text-base-primary-900 leading-none mb-1">Arşiv</h2>
              <p className="text-[13px] text-surface-400">Arşivlenen ödevler. ({enrichedArchived.length} kayıt)</p>
            </div>
            {enrichedArchived.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleSelectAll(enrichedArchived.map(t => t.id))}
                  className="h-8 px-3 rounded-xl border border-surface-200 text-[12px] font-bold text-surface-600 hover:bg-surface-50 transition-all cursor-pointer"
                >
                  {selectedArchiveIds.size === enrichedArchived.length ? "Seçimi Kaldır" : "Tümünü Seç"}
                </button>
                {selectedArchiveIds.size > 0 && (
                  <button
                    onClick={() => handleBulkDeleteArchive(Array.from(selectedArchiveIds))}
                    className="h-8 px-3 rounded-xl bg-status-danger-500 text-white text-[12px] font-bold hover:bg-status-danger-600 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash2 size={12} /> {selectedArchiveIds.size} Görevi Sil
                  </button>
                )}
              </div>
            )}
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
            onSendToGrading={handleSendToGrading}
            selectedIds={selectedArchiveIds}
            onToggleSelect={toggleArchiveSelect}
          />
        </div>
      )}

      {/* ── PUANLAMA ────────────────────────────────────────────────────────── */}
      {adminTab === "scoring" && (
        <div className="space-y-8">
          <ScoringSettingsPanel />

          {/* ── VERİ YÖNETİMİ ─────────────────────────────────────────────── */}
          <div className="space-y-4">
            <div>
              <h2 className="text-[18px] font-bold text-base-primary-900 leading-none mb-1">Veri Yönetimi</h2>
              <p className="text-[13px] text-surface-400">Puan gizleme, yedek ve fabrika ayarı işlemleri</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Gizli Puanları Aç */}
              <div className="bg-white rounded-24 border border-surface-100 shadow-sm p-6 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-2xl bg-[#FFF9EB] flex items-center justify-center shrink-0">
                    <Eye size={16} className="text-[#FFB020]" />
                  </div>
                  <div>
                    <p className="text-[15px] font-bold text-base-primary-900 leading-none">Gizli Puanları Aç</p>
                    <p className="text-[12px] text-surface-400 mt-0.5">Eğitmen soft reset'i geri al</p>
                  </div>
                </div>
                <p className="text-[12px] text-surface-500 leading-relaxed">
                  Eğitmenin "Puanları Sıfırla" işlemiyle gizlenen öğrenci puanlarını tekrar görünür yapar.
                  Veri silinmez, yalnızca gizleme bayrağı kaldırılır.
                </p>
                <button
                  onClick={() => setShowUnhide(true)}
                  className="mt-auto h-10 rounded-xl bg-[#FFF9EB] border border-[#FFE8A0] text-[13px] font-bold text-[#C98A00] hover:bg-[#FFE8A0] transition-all cursor-pointer"
                >
                  Gizli Puanları Aç
                </button>
              </div>

              {/* Yedekler */}
              <div className="bg-white rounded-24 border border-surface-100 shadow-sm p-6 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-2xl bg-base-primary-50 flex items-center justify-center shrink-0">
                    <Database size={16} className="text-base-primary-500" />
                  </div>
                  <div>
                    <p className="text-[15px] font-bold text-base-primary-900 leading-none">Yedekten Geri Yükle</p>
                    <p className="text-[12px] text-surface-400 mt-0.5">Hard reset sonrası veri kurtarma</p>
                  </div>
                </div>
                <p className="text-[12px] text-surface-500 leading-relaxed">
                  Fabrika Ayarı öncesi alınan yedeği geri yükler. Son 5 yedek saklanır. Geri yükle sonrası
                  sıralama trendleri sıfırlanır.
                </p>
                <button
                  onClick={() => setShowRestore(true)}
                  className="mt-auto h-10 rounded-xl bg-base-primary-50 border border-base-primary-100 text-[13px] font-bold text-base-primary-600 hover:bg-base-primary-100 transition-all cursor-pointer"
                >
                  Yedekleri Görüntüle
                </button>
              </div>
            </div>

            {/* Fabrika Ayarı */}
            <div className="bg-white rounded-24 border border-status-danger-100 shadow-sm p-6 flex items-center gap-6">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-9 h-9 rounded-2xl bg-status-danger-50 flex items-center justify-center shrink-0">
                  <Flame size={16} className="text-status-danger-500" />
                </div>
                <div>
                  <p className="text-[15px] font-bold text-base-primary-900 leading-none">Fabrika Ayarı</p>
                  <p className="text-[12px] text-surface-400 mt-0.5">
                    Tüm öğrenci puanlarını kalıcı olarak siler — işlem öncesi otomatik yedek oluşturulur
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowHardReset(true)}
                className="shrink-0 flex items-center gap-2 h-10 px-5 rounded-xl bg-status-danger-500 text-white text-[13px] font-bold hover:bg-status-danger-600 active:scale-95 transition-all cursor-pointer shadow-sm"
              >
                <Flame size={13} /> Fabrika Ayarı
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ÖDEV HAVUZLARI ──────────────────────────────────────────────────── */}
      {adminTab === "pools" && (
        <AssignmentPoolPanel />
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

      {/* UNHIDE MODAL */}
      {showUnhide && (
        <UnhideScoresModal
          onCancel={() => setShowUnhide(false)}
          onSuccess={() => { setShowUnhide(false); showToast("Gizli puanlar açıldı."); }}
        />
      )}

      {/* HARD RESET MODAL */}
      {showHardReset && (
        <HardResetModal
          seasonId={activeSeasonId}
          onCancel={() => setShowHardReset(false)}
          onSuccess={() => { setShowHardReset(false); showToast("Fabrika ayarı uygulandı — tüm puanlar silindi."); }}
        />
      )}

      {/* RESTORE MODAL */}
      {showRestore && (
        <RestoreModal
          onCancel={() => setShowRestore(false)}
          onSuccess={() => { setShowRestore(false); showToast("Puanlar yedekten geri yüklendi."); }}
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
  tasks, loading, tab, onEdit, onDelete, onArchive, onActivate, onGrade, onSendToGrading,
  selectedIds, onToggleSelect,
}: {
  tasks: Task[];
  loading: boolean;
  tab: "active" | "archive";
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
  onArchive: (t: Task) => void;
  onActivate: (t: Task) => void;
  onGrade: (t: Task) => void;
  onSendToGrading: (t: Task) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
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
      <div className="bg-white rounded-16 border border-surface-100 flex flex-col items-center justify-center py-20 text-surface-300">
        <AlertTriangle size={36} className="mb-3 opacity-30" />
        <p className="text-[14px] font-semibold">
          {tab === "active" ? "Aktif ödev bulunamadı." : "Arşivde kayıt yok."}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-16 border border-surface-100 shadow-sm overflow-visible">
      {/* Başlık satırı */}
      <div className="flex items-center gap-4 px-5 py-3 bg-surface-50 border-b border-surface-100 rounded-t-16">
        {tab === "archive" && onToggleSelect && <div className="w-4 shrink-0" />}
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
        <div key={task.id} className="flex items-center">
          {tab === "archive" && onToggleSelect && (
            <div className="pl-5 shrink-0">
              <input
                type="checkbox"
                checked={selectedIds?.has(task.id) ?? false}
                onChange={() => onToggleSelect(task.id)}
                className="w-4 h-4 rounded accent-status-danger-500 cursor-pointer"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <TaskRow
              task={task}
              tab={tab}
              onEdit={onEdit}
              onDelete={onDelete}
              onArchive={onArchive}
              onActivate={onActivate}
              onGrade={onGrade}
              onSendToGrading={onSendToGrading}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
