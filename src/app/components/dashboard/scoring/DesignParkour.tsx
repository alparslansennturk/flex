"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Route, Clock, ChevronRight, MoreHorizontal, AlertTriangle, CheckCircle2, ClipboardList, Palette, Check, Users } from "lucide-react";
import { db, auth } from "@/app/lib/firebase";
import { collection, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, query, where, getDocs, getDoc, writeBatch, deleteField, deleteDoc } from "firebase/firestore";
import { useUser } from "@/app/context/UserContext";
import { Task, getIcon, TaskType } from "../assignment/taskTypes";
import { PERMISSIONS } from "@/app/lib/constants";
import { AssignActivateModal, AssignSelection } from "../assignment/AssignActivateModal";

const GROUPS = ["Grup 101", "Grup 102", "Grup 103"];
const LEVELS = ["Seviye 1", "Seviye 2", "Seviye 3"];

// ─── Design Intro ─────────────────────────────────────────────────────────────

const DESIGN_SHAPES = [
  { x: -120, y:  -90, s: 8, r: 45 }, { x:  110, y:  -85, s: 6, r: 30 },
  { x:  150, y:   30, s: 9, r: 60 }, { x:   90, y:  120, s: 7, r: 15 },
  { x: -140, y:   70, s: 6, r: 75 }, { x: -155, y:  -20, s: 5, r: 20 },
  { x:  -50, y:  140, s: 7, r: 50 }, { x:   55, y: -140, s: 5, r: 40 },
  { x:  170, y:  -50, s: 5, r: 35 }, { x: -165, y:   50, s: 6, r: 55 },
  { x:   75, y:  160, s: 5, r: 25 }, { x:  -75, y: -145, s: 8, r: 65 },
];

export function DesignIntro({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<"enter" | "hold" | "exit">("enter");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"),  60);
    const t2 = setTimeout(() => setPhase("exit"), 1700);
    const t3 = setTimeout(onComplete,             2250);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onComplete]);

  const isIn  = phase !== "enter";
  const isOut = phase === "exit";

  return (
    <div
      className="fixed inset-0 z-9999 flex flex-col items-center justify-center overflow-hidden select-none"
      style={{
        background: "radial-gradient(ellipse at 50% 40%, #3D1A6E 0%, #0D0820 80%)",
        transform:  isOut ? "translateX(110%)" : "translateX(0)",
        transition: isOut ? "transform 0.55s cubic-bezier(0.7,0,1,1)" : "none",
      }}
    >
      {/* Violet glow */}
      <div
        className="absolute w-120 h-120 rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(168,85,247,0.28) 0%, transparent 65%)",
          transform:  isIn ? "scale(1)" : "scale(0)",
          transition: "transform 1s cubic-bezier(0.22,1,0.36,1)",
        }}
      />

      {/* Icon + title */}
      <div
        className="relative z-10 flex flex-col items-center gap-8"
        style={{
          transform:  isIn ? "scale(1) translateY(0)" : "scale(0.3) translateY(60px)",
          opacity:    isIn ? 1 : 0,
          transition: "all 0.65s cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        <div
          className="w-28 h-28 rounded-3xl flex items-center justify-center"
          style={{ background: "rgba(168,85,247,0.18)", boxShadow: "0 0 80px rgba(168,85,247,0.25)" }}
        >
          <div className="w-18 h-18 rounded-2xl flex items-center justify-center" style={{ background: "rgba(168,85,247,0.30)" }}>
            <Palette size={38} className="text-[#A855F7]" strokeWidth={1.8} />
          </div>
        </div>

        <div className="text-center">
          <p className="text-[11px] font-bold text-white/40 tracking-[0.5em] uppercase mb-3">Hoş Geldiniz</p>
          <h1 className="text-[56px] font-black text-white leading-none" style={{ letterSpacing: "-0.03em" }}>
            Tasarım
          </h1>
          <h1 className="text-[56px] font-black leading-none" style={{ letterSpacing: "-0.03em", color: "#A855F7" }}>
            Atölyesi
          </h1>
        </div>
      </div>

      {/* Dönen kare şekiller */}
      {DESIGN_SHAPES.map((sh, i) => (
        <div
          key={i}
          className="absolute pointer-events-none"
          style={{
            width:        sh.s,
            height:       sh.s,
            background:   i % 3 === 0 ? "#A855F7" : i % 3 === 1 ? "#E879F9" : "rgba(255,255,255,0.7)",
            borderRadius: 2,
            left:         "calc(50% - 4px)",
            top:          "calc(50% - 64px)",
            transform:    isIn
              ? `translate(${sh.x}px, ${sh.y}px) rotate(${sh.r}deg) scale(1)`
              : "translate(0,0) rotate(0deg) scale(0)",
            opacity:    isIn ? 0.8 : 0,
            transition: `transform ${0.6 + i * 0.02}s cubic-bezier(0.22,1,0.36,1) ${i * 0.02}s, opacity 0.3s ease`,
          }}
        />
      ))}
    </div>
  );
}

// Tip bazlı parkur renkleri
const PARKOUR_STYLE: Record<TaskType, { gradient: string; tagBg: string; tagText: string; label: string }> = {
  odev:     { gradient: "bg-gradient-to-b from-pink-500 to-[#B80E57]",  tagBg: "bg-pink-100",   tagText: "text-pink-700",   label: "Ödev" },
  proje:    { gradient: "bg-gradient-to-b from-[#FF8D28] to-[#D35400]", tagBg: "bg-orange-100", tagText: "text-orange-600", label: "Proje" },
  etkinlik: { gradient: "bg-gradient-to-b from-[#1CB5AE] to-[#0E5D59]", tagBg: "bg-cyan-100",   tagText: "text-cyan-700",   label: "Etkinlik" },
};

// ---- PLACEHOLDER KART ----
function PlaceholderParkourCard() {
  return (
    <div className="bg-white/50 p-7 rounded-24 border border-dashed border-[#E2E5EA] flex flex-col justify-between h-full cursor-default opacity-40">
      <div className="flex justify-between items-start mb-5">
        <div className="w-12 h-12 bg-[#F7F8FA] radius-12 shrink-0" />
        <span className="px-4 py-1.5 rounded-full text-[11px] font-bold bg-[#F7F8FA] text-[#AEB4C0]">—</span>
      </div>
      <div className="mb-5">
        <div className="h-5 w-36 bg-[#F7F8FA] rounded-lg mb-2" />
        <div className="h-3 w-full bg-[#F7F8FA] rounded mb-1.5" />
        <div className="h-3 w-3/4 bg-[#F7F8FA] rounded" />
      </div>
      <div className="bg-[#F7F8FA] rounded-2xl p-3.5 flex justify-between mb-6 border border-[#EEF0F3]">
        <div className="flex flex-col gap-1.5">
          <div className="h-2.5 w-8 bg-[#E2E5EA] rounded" />
          <div className="h-3 w-12 bg-[#E2E5EA] rounded" />
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="h-2.5 w-16 bg-[#E2E5EA] rounded" />
          <div className="h-3 w-10 bg-[#E2E5EA] rounded" />
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-[#F7F8FA] pt-5">
        <span className="text-[11px] text-[#AEB4C0] italic font-semibold opacity-60">Tasarım atölyesi</span>
        <button disabled className="px-5 h-10 flex items-center gap-2 rounded-xl text-[13px] font-bold bg-[#E2E5EA] text-[#AEB4C0] cursor-not-allowed">
          Ödev ver <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ---- GHOST KART (templates koleksiyonu — 3-dot menüden başlatılır) ----
function GhostParkourCard({ task, canManage, onActivate }: {
  task: Task;
  canManage: boolean;
  onActivate: (task: Task) => void;
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

  const style    = PARKOUR_STYLE[task.type] ?? PARKOUR_STYLE.odev;
  const iconNode = getIcon(task.icon, task.type, 22);

  return (
    <div className="bg-white p-7 rounded-24 border border-dashed border-[#D0D5DE] flex flex-col justify-between h-full cursor-default opacity-90">
      <div className="flex justify-between items-start mb-5">
        <div className={`w-12 h-12 ${style.gradient} radius-12 flex items-center justify-center text-white shadow-lg shrink-0`}>
          {iconNode}
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-4 py-1.5 rounded-full text-[11px] font-bold ${style.tagBg} ${style.tagText}`}>{style.label}</span>
          {canManage && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(v => !v)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#F7F8FA] text-[#AEB4C0] hover:text-[#10294C] transition-all cursor-pointer"
              >
                <MoreHorizontal size={16} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-9 z-50 bg-white border border-[#E2E5EA] rounded-2xl shadow-xl overflow-hidden min-w-[175px]">
                  <button
                    onClick={() => { onActivate(task); setMenuOpen(false); }}
                    className="w-full px-4 py-2 text-left text-[13px] font-bold text-[#10294C] hover:bg-[#F7F8FA] transition-colors cursor-pointer"
                  >
                    Ödevi Başlat
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="mb-5">
        <h4 className="text-[20px] text-[#10294C] font-bold mb-1.5 leading-tight">{task.name}</h4>
        <p className="text-[13px] text-[#8E95A3] leading-relaxed line-clamp-2">{task.description || "Açıklama yok"}</p>
      </div>
      <div className="bg-[#F7F8FA] rounded-2xl p-3.5 flex justify-between mb-6 border border-[#EEF0F3]">
        <div className="flex flex-col"><span className="text-[11px] text-[#8E95A3]">Durum</span><span className="text-[13px] font-bold mt-0.5 text-[#AEB4C0]">Pasif</span></div>
        <div className="flex flex-col items-end"><span className="text-[11px] text-[#8E95A3]">Teslim süresi</span><span className="text-[13px] font-bold text-[#AEB4C0] mt-0.5">—</span></div>
      </div>
      <div className="flex items-center justify-between border-t border-[#F7F8FA] pt-5">
        <span className="text-[11px] text-[#AEB4C0] italic font-semibold">Tasarım atölyesi</span>
        <button disabled className="px-5 h-10 flex items-center gap-2 rounded-xl text-[13px] font-bold bg-[#E2E5EA] text-[#AEB4C0] cursor-not-allowed">
          Ödev ver <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ---- TASK KARTI (aktif) ----
function TaskParkourCard({ task, canManage, isBorrowed = false, onActivateBorrowed, onEdit, onComplete, onCancel, onDetail }: {
  task: Task;
  canManage: boolean;
  isBorrowed?: boolean;
  onActivateBorrowed: (task: Task) => void;
  onEdit: (task: Task) => void;
  onComplete: (task: Task) => void;
  onCancel: (task: Task) => void;
  onDetail: (task: Task) => void;
}) {
  const router = useRouter();
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

  const getDuration = (): string | null => {
    if (!task.endDate) return "Süresiz";
    const end = new Date(task.endDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return null;
    if (diff === 0) return "Bugün!";
    if (diff <= 3) return `Son ${diff} Gün`;
    const days = ["Paz", "Pts", "Sal", "Çar", "Per", "Cum", "Cts"];
    const dd = String(end.getDate()).padStart(2, "0");
    const mm = String(end.getMonth() + 1).padStart(2, "0");
    const yyyy = end.getFullYear();
    const dayName = days[end.getDay()];
    return `${dd}.${mm}.${yyyy} ${dayName}.`;
  };

  const duration    = getDuration();
  const isExpired   = duration === null;
  const isNoDate    = !task.endDate;
  const isCompleted   = task.status === "completed";
  const needsGrading  = isCompleted && !task.isGraded;
  const isFullyDone   = isCompleted && !!task.isGraded;
  const isDisabled    = !isCompleted && (isBorrowed || isExpired || isNoDate);

  // Notlandırma tamamlandıysa kart şablon (ghost) pozisyonuna döner
  if (isFullyDone) {
    return <GhostParkourCard task={task} canManage={canManage} onActivate={onActivateBorrowed} />;
  }
  const style       = PARKOUR_STYLE[task.type] ?? PARKOUR_STYLE.odev;
  const iconNode    = getIcon(task.icon, task.type, 22);

  const statusText = isCompleted
    ? "Tamamlandı"
    : isBorrowed
      ? "Pasif"
      : isExpired
        ? "Süresi Doldu"
        : isNoDate
          ? "Pasif"
          : "Aktif";

  const statusColor = isCompleted
    ? "text-[#009F3E]"
    : (!isDisabled)
      ? "text-[#009F3E]"
      : "text-[#AEB4C0]";

  return (
    <div className={`bg-white p-7 rounded-24 border border-[#CDD2DA] flex flex-col justify-between transition-all duration-300 hover:shadow-[15px_30px_60px_-15px_rgba(16,41,76,0.08)] hover:-translate-y-1 h-full cursor-default group ${isExpired && !isCompleted ? "opacity-60" : ""}`}>
      <div className="flex justify-between items-start mb-5">
        <div className={`w-12 h-12 ${style.gradient} radius-12 flex items-center justify-center text-white shadow-lg shrink-0`}>
          {iconNode}
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-4 py-1.5 rounded-full text-[11px] font-bold ${style.tagBg} ${style.tagText}`}>
            {style.label}
          </span>
          {canManage && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(v => !v)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#F7F8FA] text-[#AEB4C0] hover:text-[#10294C] transition-all cursor-pointer"
              >
                <MoreHorizontal size={16} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-9 z-50 bg-white border border-[#E2E5EA] rounded-2xl shadow-xl overflow-hidden min-w-[175px]">
                  {isBorrowed ? (
                    <button
                      onClick={() => { onActivateBorrowed(task); setMenuOpen(false); }}
                      className="w-full px-4 py-2 text-left text-[13px] font-bold text-[#10294C] hover:bg-[#F7F8FA] transition-colors cursor-pointer"
                    >
                      Aktifleştir
                    </button>
                  ) : (
                    <>
                      {!isCompleted && (
                        <button
                          onClick={() => { onComplete(task); setMenuOpen(false); }}
                          className="w-full px-4 py-2 text-left text-[13px] font-bold text-[#009F3E] hover:bg-green-50 transition-colors cursor-pointer"
                        >
                          Ödevi Bitir
                        </button>
                      )}
                      <button
                        onClick={() => { onCancel(task); setMenuOpen(false); }}
                        className={`w-full px-4 py-2 text-left text-[13px] font-bold text-red-500 hover:bg-red-50 transition-colors cursor-pointer ${!isCompleted ? "border-t border-[#EEF0F3]" : ""}`}
                      >
                        Ödevi İptal Et
                      </button>
                      {!isCompleted && (
                        <button
                          onClick={() => { onEdit(task); setMenuOpen(false); }}
                          className="w-full px-4 py-2 text-left text-[13px] font-bold text-[#10294C] hover:bg-[#F7F8FA] transition-colors cursor-pointer border-t border-[#EEF0F3]"
                        >
                          Ödevi Düzenle
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mb-5">
        <h4 className="text-[20px] text-[#10294C] font-bold mb-1.5 leading-tight">
          {task.name}
          {(task.classId || task.level) && (
            <span className="text-[14px] font-semibold text-[#8E95A3] ml-1.5">
              ({[task.classId, task.level].filter(Boolean).join(" | ")})
            </span>
          )}
        </h4>
        <p className="text-[13px] text-[#8E95A3] leading-relaxed line-clamp-2">
          {task.description || "Açıklama yok"}
        </p>
      </div>

      <div className="bg-[#F7F8FA] rounded-2xl p-3.5 flex justify-between mb-6 border border-[#EEF0F3]">
        <div className="flex flex-col">
          <span className="text-[11px] text-[#8E95A3]">Durum</span>
          <span className={`text-[13px] font-bold mt-0.5 ${statusColor}`}>{statusText}</span>
        </div>
        <div className="flex flex-col items-end">
          {needsGrading ? (
            <>
              <span className="text-[11px] text-[#8E95A3]">Bekliyor</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <ClipboardList size={12} className="text-[#009F3E]" />
                <span className="text-[13px] font-bold text-[#009F3E]">Not Girişi</span>
              </div>
            </>
          ) : (
            <>
              <span className="text-[11px] text-[#8E95A3]">Teslim süresi</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Clock size={12} className={isExpired && !isCompleted ? "text-red-400" : "text-[#10294C]"} />
                <span className={`text-[13px] font-bold ${isExpired && !isCompleted ? "text-red-400" : "text-[#10294C]"}`}>
                  {isExpired && !isCompleted ? "Süre Doldu" : (duration ?? "Süresiz")}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-[#F7F8FA] pt-5">
        <span className="text-[11px] text-[#AEB4C0] italic font-semibold opacity-60">Tasarım atölyesi</span>
        {isCompleted ? (
          <div className="relative">
            {needsGrading && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#009F3E] rounded-full animate-ping opacity-75" />
            )}
            {task.isGraded ? (
              <button
                disabled
                className="px-5 h-10 flex items-center gap-2 rounded-xl text-[13px] font-bold bg-[#E2E5EA] text-[#AEB4C0] cursor-not-allowed"
              >
                Tamamlandı
              </button>
            ) : (
              <button
                onClick={() => router.push(`/dashboard/grading?taskId=${task.id}`)}
                className="px-5 h-10 flex items-center gap-2 rounded-xl text-[13px] font-bold transition-all active:scale-95 bg-[#009F3E] text-white hover:bg-[#007F32] cursor-pointer"
              >
                Not Girişi Yap <ChevronRight size={16} />
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={() => onDetail(task)}
            className="px-5 h-10 flex items-center gap-2 rounded-xl text-[13px] font-bold transition-all active:scale-95 bg-[#6F74D8] text-white hover:bg-[#5E63C2] cursor-pointer"
          >
            Ödev Detay <ChevronRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

// ---- ÖDEV BİTİR MODAL (turuncu) ----
function CompleteConfirmModal({ task, onCancel, onConfirm }: {
  task: Task; onCancel: () => void; onConfirm: () => void;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);
  const handleCancel  = () => { setVisible(false); setTimeout(onCancel, 280); };
  const handleConfirm = () => { setVisible(false); setTimeout(onConfirm, 280); };

  return (
    <div className={`fixed inset-0 z-[700] flex items-center justify-center p-6 transition-all duration-300 ${visible ? "visible" : "invisible"}`}>
      <div className={`absolute inset-0 bg-base-primary-900/40 backdrop-blur-md transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`} onClick={handleCancel} />
      <div className={`relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 flex flex-col items-center gap-5 text-center transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${visible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"}`}>
        <div className="w-14 h-14 rounded-full bg-orange-50 flex items-center justify-center">
          <CheckCircle2 size={26} className="text-orange-500" />
        </div>
        <div>
          <p className="text-[17px] font-bold text-base-primary-900 mb-1">Ödevi bitir</p>
          <p className="text-[13px] text-surface-500">
            <span className="font-bold text-base-primary-700">"{task.name}"</span> ödevi tamamlandı olarak işaretlenecek. Emin misiniz?
          </p>
        </div>
        <div className="flex gap-3 w-full">
          <button onClick={handleCancel} className="flex-1 h-11 rounded-xl border border-surface-200 text-[13px] font-bold text-surface-600 hover:bg-surface-50 transition-all cursor-pointer">Vazgeç</button>
          <button onClick={handleConfirm} className="flex-1 h-11 rounded-xl bg-orange-500 text-white text-[13px] font-bold hover:bg-orange-600 active:scale-95 transition-all cursor-pointer">Bitir</button>
        </div>
      </div>
    </div>
  );
}

// ---- ÖDEV İPTAL MODAL (kırmızı) ----
function CancelConfirmModal({ task, onCancel, onConfirm }: {
  task: Task; onCancel: () => void; onConfirm: () => void;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);
  const handleCancel  = () => { setVisible(false); setTimeout(onCancel, 280); };
  const handleConfirm = () => { setVisible(false); setTimeout(onConfirm, 280); };

  return (
    <div className={`fixed inset-0 z-[700] flex items-center justify-center p-6 transition-all duration-300 ${visible ? "visible" : "invisible"}`}>
      <div className={`absolute inset-0 bg-base-primary-900/40 backdrop-blur-md transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`} onClick={handleCancel} />
      <div className={`relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 flex flex-col items-center gap-5 text-center transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${visible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"}`}>
        <div className="w-14 h-14 rounded-full bg-status-danger-50 flex items-center justify-center">
          <AlertTriangle size={26} className="text-status-danger-500" />
        </div>
        <div>
          <p className="text-[17px] font-bold text-base-primary-900 mb-1">Ödevi iptal et</p>
          <p className="text-[13px] text-surface-500">
            <span className="font-bold text-base-primary-700">"{task.name}"</span> ödevi iptal edilecek ve arşive taşınacak. Emin misiniz?
          </p>
        </div>
        <div className="flex gap-3 w-full">
          <button onClick={handleCancel} className="flex-1 h-11 rounded-xl border border-surface-200 text-[13px] font-bold text-surface-600 hover:bg-surface-50 transition-all cursor-pointer">Vazgeç</button>
          <button onClick={handleConfirm} className="flex-1 h-11 rounded-xl bg-status-danger-500 text-white text-[13px] font-bold hover:bg-status-danger-700 active:scale-95 transition-all cursor-pointer">İptal Et</button>
        </div>
      </div>
    </div>
  );
}

// ---- ÖDEV DÜZENLE MODAL ----
interface EditGroup { id: string; code: string; branch?: string; status?: string; }

function TaskEditModal({ task, onSave, onCancel }: {
  task: Task;
  onSave: (groupId: string, classId: string, groupBranch: string, level: string, endDate: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [selectedGroupId, setSelectedGroupId] = useState(task.groupId ?? "");
  const [level,           setLevel]           = useState(task.level   ?? "");
  const [endDate,         setEndDate]         = useState(task.endDate  ?? "");
  const [loading,         setLoading]         = useState(false);
  const [visible,         setVisible]         = useState(false);
  const [groups,          setGroups]          = useState<EditGroup[]>([]);
  const [groupsLoading,   setGroupsLoading]   = useState(true);
  const [busyGroupIds,    setBusyGroupIds]    = useState<string[]>([]);

  const { user } = useUser();

  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  useEffect(() => {
    const uid = user?.uid;
    if (!uid) { setGroupsLoading(false); return; }
    const q = query(collection(db, "groups"), where("instructorId", "==", uid));
    const unsub = onSnapshot(q, async snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as EditGroup));
      const active = all.filter(g => g.status === "active");
      setGroups(active);
      // groupId yoksa classId üzerinden eşle
      if (!task.groupId && task.classId) {
        const match = active.find(g => g.code === task.classId);
        if (match) setSelectedGroupId(match.id);
      }
      // Aynı şablondan ödev almış diğer grupları bul (bu task hariç)
      if (task.templateId) {
        const taskSnap = await getDocs(query(collection(db, "tasks"), where("templateId", "==", task.templateId)));
        const busy = taskSnap.docs
          .filter(d => d.id !== task.id)
          .map(d => d.data().groupId as string)
          .filter(Boolean);
        setBusyGroupIds(busy);
      }
      setGroupsLoading(false);
    });
    return () => unsub();
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCancel = () => { setVisible(false); setTimeout(onCancel, 280); };
  const handleSave   = async () => {
    const g = groups.find(gr => gr.id === selectedGroupId);
    if (!g) return;
    setLoading(true);
    await onSave(g.id, g.code, g.branch ?? "", level, endDate);
    setVisible(false);
    setLoading(false);
  };

  const today = new Date().toISOString().split("T")[0];
  const canSubmit = !!selectedGroupId && !!level && !!endDate;

  return (
    <div className={`fixed inset-0 z-800 flex items-center justify-center p-6 transition-all duration-300 ${visible ? "visible" : "invisible"}`}>
      <div className={`absolute inset-0 bg-base-primary-900/40 backdrop-blur-md transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`} onClick={handleCancel} />
      <div className={`relative bg-white rounded-16 shadow-2xl w-full max-w-md p-8 flex flex-col gap-5 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${visible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"}`}>
        <div>
          <p className="text-[17px] font-bold text-base-primary-900 mb-1">Ödevi Düzenle</p>
          <p className="text-[13px] text-surface-500">
            <span className="font-bold text-base-primary-700">"{task.name}"</span> — grup, seviye ve tarihi güncelle.
          </p>
        </div>

        {/* Grup */}
        <div>
          <p className="text-[12px] font-bold text-surface-500 uppercase tracking-wide mb-2">Grup Seçimi</p>
          {groupsLoading ? (
            <div className="flex items-center justify-center h-24 bg-surface-50 rounded-12 border border-surface-100">
              <div className="w-5 h-5 border-2 border-surface-200 border-t-base-primary-500 rounded-full animate-spin" />
            </div>
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-24 bg-surface-50 rounded-12 border border-surface-100 gap-2">
              <Users size={20} className="text-surface-300" />
              <p className="text-[12px] text-surface-400 font-medium text-center">Size atanmış aktif grup bulunamadı</p>
            </div>
          ) : (
            <div className="max-h-28 overflow-y-auto rounded-12 border border-surface-200 divide-y divide-surface-100">
              {groups.map(g => {
                const isSelected = selectedGroupId === g.id;
                const isBusy    = busyGroupIds.includes(g.id);
                return (
                  <button
                    key={g.id}
                    onClick={() => { if (!isBusy) setSelectedGroupId(g.id); }}
                    disabled={isBusy}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      isBusy
                        ? "bg-surface-50 cursor-not-allowed opacity-50"
                        : isSelected
                        ? "bg-base-primary-50 cursor-pointer"
                        : "bg-white hover:bg-surface-50 cursor-pointer"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? "bg-base-primary-900 border-base-primary-900" : "border-surface-300"}`}>
                      {isSelected && <Check size={9} className="text-white" strokeWidth={3} />}
                    </div>
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <span className="w-20 text-[11px] font-medium text-surface-400 shrink-0 truncate">{g.branch ?? ""}</span>
                      <span className="text-surface-200 text-[10px] shrink-0">—</span>
                      <span className={`text-[12px] font-bold truncate ${isSelected ? "text-base-primary-900" : isBusy ? "text-surface-400" : "text-surface-700"}`}>{g.code}</span>
                      {isBusy && <span className="text-[10px] text-surface-400 font-medium ml-auto shrink-0">✓</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Seviye */}
        <div>
          <p className="text-[12px] font-bold text-surface-500 uppercase tracking-wide mb-2">Seviye</p>
          <div className="grid grid-cols-3 gap-2">
            {LEVELS.map(l => (
              <button key={l} onClick={() => setLevel(l)}
                className={`py-2 rounded-xl text-[12px] font-bold transition-all cursor-pointer border ${
                  level === l
                    ? "bg-base-primary-900 text-white border-base-primary-900"
                    : "bg-white border-surface-200 text-surface-600 hover:border-base-primary-400 hover:text-base-primary-700"
                }`}
              >{l}</button>
            ))}
          </div>
        </div>

        {/* Bitiş Tarihi */}
        <div>
          <p className="text-[12px] font-bold text-surface-500 uppercase tracking-wide mb-2">Bitiş Tarihi</p>
          <input
            type="date"
            value={endDate}
            min={today}
            onChange={e => setEndDate(e.target.value)}
            className="w-full h-12 px-4 rounded-xl border border-surface-200 bg-surface-50 text-[14px] text-text-primary font-medium outline-none focus:border-base-primary-500 focus:bg-white transition-all cursor-pointer"
          />
        </div>

        <div className="flex gap-3">
          <button onClick={handleCancel} className="flex-1 h-11 rounded-xl border border-surface-200 text-[13px] font-bold text-surface-600 hover:bg-surface-50 transition-all cursor-pointer">Vazgeç</button>
          <button onClick={handleSave} disabled={!canSubmit || loading} className="flex-1 h-11 rounded-xl bg-base-primary-900 text-white text-[13px] font-bold hover:bg-base-primary-800 active:scale-95 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center">
            {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- ANA BİLEŞEN ----
export default function DesignParkour() {
  const router = useRouter();
  // Tüm task'ları state'e al — filter render'da yapılır (closure sorunu önlenir)
  const [allTasks,      setAllTasks]      = useState<Task[]>([]);
  const [templates,     setTemplates]     = useState<Task[]>([]);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [reactivateTask, setReactivateTask] = useState<Task | null>(null);
  const [ghostModalTask, setGhostModalTask] = useState<Task | null>(null);
  const [completeConfirmTask, setCompleteConfirmTask] = useState<Task | null>(null);
  const [cancelConfirmTask,   setCancelConfirmTask]   = useState<Task | null>(null);

  const { hasPermission, isTrainer, user } = useUser();
  const canManage  = hasPermission(PERMISSIONS.ASSIGNMENT_MANAGE) || isTrainer();

  // tasks koleksiyonu — closure sorunu yok: filter render'da yapılıyor
  useEffect(() => {
    return onSnapshot(collection(db, "tasks"), snap => {
      setAllTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
    });
  }, []);

  // templates koleksiyonu
  useEffect(() => {
    return onSnapshot(collection(db, "templates"), snap => {
      setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
    });
  }, []);

  // Render'da filtrele — uid için hem context hem auth kullan
  const myUid = user?.uid ?? auth.currentUser?.uid;
  const templatesMap = useMemo(
    () => Object.fromEntries(templates.map(t => [t.id, t])),
    [templates],
  );
  const activeTasks = allTasks
    .filter(t =>
      t.isActive === true && !t.isHidden &&
      t.status !== "archived" &&
      !t.isGraded &&
      myUid != null &&
      (t.ownedBy === myUid || (!t.ownedBy && t.createdBy === myUid))
    )
    .map(t =>
      t.templateId && templatesMap[t.templateId]?.icon != null
        ? { ...t, icon: templatesMap[t.templateId].icon }
        : t
    );

  // ---- Handlers ----
  const handleComplete = async (task: Task) => {
    const todayStr = new Date().toISOString().split("T")[0];
    const updates: Record<string, unknown> = { status: "completed" };
    // endDate ileri tarihli ise bugüne çek; aksi takdirde mevcut tarih korunur
    if (!task.endDate || task.endDate > todayStr) {
      updates.endDate = todayStr;
    }
    await updateDoc(doc(db, "tasks", task.id), updates);
  };

  const handleCancelTask = async (task: Task) => {
    // Kaydedilmiş puanları öğrencilerden geri al
    const taskRef = doc(db, "tasks", task.id);
    const taskSnap = await getDoc(taskRef);
    if (taskSnap.exists()) {
      const grades: Record<string, { submitted?: boolean; xp?: number }> = (taskSnap.data() as any).grades ?? {};
      const toClean = Object.entries(grades)
        .filter(([, g]) => g?.submitted && (g?.xp ?? 0) > 0)
        .map(([sid]) => sid);
      if (toClean.length > 0) {
        const batch = writeBatch(db);
        toClean.forEach(sid => batch.update(doc(db, "students", sid), { [`gradedTasks.${task.id}`]: deleteField() }));
        await batch.commit();
      }
    }
    // Görevi tamamen sil
    await deleteDoc(taskRef);
  };

  const handleReactivateConfirm = async (selections: AssignSelection[]) => {
    if (!reactivateTask || selections.length === 0) return;
    const { classId, groupId, groupBranch, groupModule, level, endDate } = selections[0];
    // Grafik 2 şablonu → Grafik 1 sınıfına verilirse seviye otomatik Seviye 1'e düşer
    const effectiveLevel = (reactivateTask.module === "GRAFIK_2" && groupModule === "GRAFIK_1") ? "Seviye 1" : (level || null);
    await updateDoc(doc(db, "tasks", reactivateTask.id), { classId, groupId, groupBranch, level: effectiveLevel, endDate, groupModule: groupModule ?? null, isPaused: false, isActive: true });
    setReactivateTask(null);
  };

  const handleEditConfirm = async (groupId: string, classId: string, groupBranch: string, level: string, endDate: string) => {
    if (!editTask) return;
    await updateDoc(doc(db, "tasks", editTask.id), { groupId, classId, groupBranch, level, endDate });
    setEditTask(null);
  };

  // Ghost kart → AssignActivateModal → klon oluştur
  const handleGhostActivate = async (selections: AssignSelection[]) => {
    if (!ghostModalTask) return;
    const t = ghostModalTask;
    const uid = user?.uid ?? auth.currentUser?.uid ?? null;
    for (const { classId, groupId, groupBranch, groupModule, level, endDate } of selections) {
      // Grafik 2 şablonu → Grafik 1 sınıfına verilirse seviye otomatik Seviye 1'e düşer
      const effectiveLevel = (t.module === "GRAFIK_2" && groupModule === "GRAFIK_1") ? "Seviye 1" : (level || null);
      await addDoc(collection(db, "tasks"), {
        name:           t.name,
        description:    t.description ?? null,
        type:           t.type ?? null,
        points:         t.points ?? null,
        icon:           t.icon ?? null,
        module:         t.module ?? null,
        groupModule:    groupModule ?? null,
        classId,
        groupId,
        groupBranch,
        level:          effectiveLevel,
        endDate,
        status:         "active",
        isActive:       true,
        isPaused:       false,
        isHidden:       false,
        templateId:     t.id,
        assignmentType: t.assignmentType ?? null,
        createdAt:      serverTimestamp(),
        createdBy:      uid,
        createdByName:  user ? `${user.name} ${user.surname}` : null,
        branch:         groupBranch || user?.branch || null,
        ownedBy:        uid,
      });
    }
    setGhostModalTask(null);
  };

  // Sıralama: aktif → pasif → tamamlanan; grup içinde createdAt DESC (kararlı sıra)
  const sortedActiveTasks = [...activeTasks].sort((a, b) => {
    const groupOf = (t: Task): number => {
      if (t.status === "completed") return 2;
      if (t.isPaused || !t.endDate) return 1;
      return 0;
    };
    const ga = groupOf(a);
    const gb = groupOf(b);
    if (ga !== gb) return ga - gb;
    // Grup içi: en yeni solda — createdAt'a göre azalan
    const aT = (a as any).createdAt?.toMillis?.() ?? 0;
    const bT = (b as any).createdAt?.toMillis?.() ?? 0;
    return bT - aT;
  });

  // Ghost slot: henüz başlatılmamış şablonlar (rastgele seçilir)
  const myActiveTemplateIds = new Set(
    activeTasks.filter(t => t.templateId).map(t => t.templateId!)
  );
  const ghostCount = Math.max(0, 3 - activeTasks.length);
  const availableGhosts = templates.filter(t => !myActiveTemplateIds.has(t.id) && !t.isHidden);
  // Şablon listesi değiştiğinde bir kez karıştır (her render'da değişmemesi için id'ye göre sabit sıralama)
  const ghostTasks = [...availableGhosts]
    .sort((a, b) => {
      // Basit deterministik karıştırma: id'lerin toplamından türetilen sabit sıra
      const ha = Array.from(a.id).reduce((s, c) => s + c.charCodeAt(0), 0);
      const hb = Array.from(b.id).reduce((s, c) => s + c.charCodeAt(0), 0);
      return (ha % 7) - (hb % 7);
    })
    .slice(0, ghostCount);
  const placeholderCount = Math.max(0, ghostCount - ghostTasks.length);

  return (
    <section className="mt-[48px] space-y-[24px]">
      <div className="flex items-center gap-3 text-[#10294C] px-2">
        <Route size={22} className="text-[#FF8D28]" />
        <h3 className="text-[22px] font-bold cursor-default">Tasarım parkuru</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {sortedActiveTasks.map(task => (
          <TaskParkourCard
            key={task.id}
            task={task}
            canManage={canManage}
            onActivateBorrowed={() => {}}
            onEdit={setEditTask}
            onComplete={setCompleteConfirmTask}
            onCancel={setCancelConfirmTask}
            onDetail={t => {
              const route = t.assignmentType === "kitap"       ? "kitap"
                          : t.assignmentType === "kolaj"       ? "kolaj"
                          : t.assignmentType === "sosyal_medya" ? "sosyalmedya"
                          : null;
              if (route) router.push(`/dashboard/${route}?taskId=${t.id}`);
            }}
          />
        ))}
        {ghostTasks.map(task => (
          <GhostParkourCard
            key={`ghost-${task.id}`}
            task={task}
            canManage={canManage}
            onActivate={setGhostModalTask}
          />
        ))}
        {Array.from({ length: placeholderCount }).map((_, i) => (
          <PlaceholderParkourCard key={`ph-${i}`} />
        ))}
      </div>

      {reactivateTask && (
        <AssignActivateModal
          taskName={reactivateTask.name}
          templateId={reactivateTask.templateId}
          onConfirm={handleReactivateConfirm}
          onCancel={() => setReactivateTask(null)}
        />
      )}
      {editTask && (
        <TaskEditModal
          task={editTask}
          onSave={handleEditConfirm}
          onCancel={() => setEditTask(null)}
        />
      )}
      {ghostModalTask && (
        <AssignActivateModal
          taskName={ghostModalTask.name}
          templateId={ghostModalTask.id}
          templateLevel={ghostModalTask.level}
          onConfirm={handleGhostActivate}
          onCancel={() => setGhostModalTask(null)}
        />
      )}
      {completeConfirmTask && (
        <CompleteConfirmModal
          task={completeConfirmTask}
          onCancel={() => setCompleteConfirmTask(null)}
          onConfirm={() => { handleComplete(completeConfirmTask); setCompleteConfirmTask(null); }}
        />
      )}
      {cancelConfirmTask && (
        <CancelConfirmModal
          task={cancelConfirmTask}
          onCancel={() => setCancelConfirmTask(null)}
          onConfirm={() => { handleCancelTask(cancelConfirmTask); setCancelConfirmTask(null); }}
        />
      )}
    </section>
  );
}
