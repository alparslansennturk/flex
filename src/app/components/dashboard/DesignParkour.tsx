"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Route, Clock, ChevronRight, MoreHorizontal, AlertTriangle, CheckCircle2, ClipboardList } from "lucide-react";
import { db, auth } from "@/app/lib/firebase";
import { collection, onSnapshot, doc, updateDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { useUser } from "@/app/context/UserContext";
import { Task, getIcon, TaskType } from "./taskTypes";
import { PERMISSIONS } from "@/app/lib/constants";
import { ActivateDateModal } from "./TaskCardManager";
import { AssignActivateModal, AssignSelection } from "./AssignActivateModal";

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
        <div className="w-12 h-12 bg-[#F7F8FA] rounded-[14px] shrink-0" />
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
    <div className="bg-white/70 p-7 rounded-24 border border-dashed border-[#D0D5DE] flex flex-col justify-between h-full cursor-default opacity-70">
      <div className="flex justify-between items-start mb-5">
        <div className={`w-12 h-12 ${style.gradient} rounded-[14px] flex items-center justify-center text-white shadow-lg shrink-0 opacity-60`}>
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
                    className="w-full px-4 py-3 text-left text-[13px] font-bold text-[#10294C] hover:bg-[#F7F8FA] transition-colors cursor-pointer"
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
        <span className="text-[11px] text-[#AEB4C0] italic font-semibold opacity-60">Tasarım atölyesi</span>
        <button disabled className="px-5 h-10 flex items-center gap-2 rounded-xl text-[13px] font-bold bg-[#E2E5EA] text-[#AEB4C0] cursor-not-allowed">
          Ödev ver <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ---- TASK KARTI (aktif) ----
function TaskParkourCard({ task, canManage, isBorrowed = false, onActivateBorrowed, onChangeDate, onComplete, onCancel }: {
  task: Task;
  canManage: boolean;
  isBorrowed?: boolean;
  onActivateBorrowed: (task: Task) => void;
  onChangeDate: (task: Task) => void;
  onComplete: (task: Task) => void;
  onCancel: (task: Task) => void;
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
    return `Son ${diff} Gün`;
  };

  const duration    = getDuration();
  const isExpired   = duration === null;
  const isNoDate    = !task.endDate;
  const isCompleted   = task.status === "completed";
  const needsGrading  = isCompleted && !task.isGraded;
  const isDisabled    = !isCompleted && (isBorrowed || isExpired || isNoDate);
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
    <div className={`bg-white p-7 rounded-24 border border-[#E2E5EA] flex flex-col justify-between transition-all duration-300 hover:shadow-[15px_30px_60px_-15px_rgba(16,41,76,0.08)] hover:-translate-y-1 h-full cursor-default group ${isExpired && !isCompleted ? "opacity-60" : ""}`}>
      <div className="flex justify-between items-start mb-5">
        <div className={`w-12 h-12 ${style.gradient} rounded-[14px] flex items-center justify-center text-white shadow-lg shrink-0`}>
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
                      className="w-full px-4 py-3 text-left text-[13px] font-bold text-[#10294C] hover:bg-[#F7F8FA] transition-colors cursor-pointer"
                    >
                      Aktifleştir
                    </button>
                  ) : (
                    <>
                      {!isCompleted && (
                        <button
                          onClick={() => { onComplete(task); setMenuOpen(false); }}
                          className="w-full px-4 py-3 text-left text-[13px] font-bold text-[#009F3E] hover:bg-green-50 transition-colors cursor-pointer"
                        >
                          Ödevi Bitir
                        </button>
                      )}
                      <button
                        onClick={() => { onCancel(task); setMenuOpen(false); }}
                        className={`w-full px-4 py-3 text-left text-[13px] font-bold text-red-500 hover:bg-red-50 transition-colors cursor-pointer ${!isCompleted ? "border-t border-[#EEF0F3]" : ""}`}
                      >
                        Ödevi İptal Et
                      </button>
                      {task.endDate && !isCompleted && (
                        <button
                          onClick={() => { onChangeDate(task); setMenuOpen(false); }}
                          className="w-full px-4 py-3 text-left text-[13px] font-bold text-[#10294C] hover:bg-[#F7F8FA] transition-colors cursor-pointer border-t border-[#EEF0F3]"
                        >
                          Tarihi Değiştir
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
            <button
              onClick={() => router.push(`/dashboard/grading?taskId=${task.id}`)}
              className="px-5 h-10 flex items-center gap-2 rounded-xl text-[13px] font-bold transition-all active:scale-95 bg-[#009F3E] text-white hover:bg-[#007F32] cursor-pointer"
            >
              Not Girişi Yap <ChevronRight size={16} />
            </button>
          </div>
        ) : (
          <button
            disabled={isDisabled}
            className={`px-5 h-10 flex items-center gap-2 rounded-xl text-[13px] font-bold transition-all active:scale-95 ${isDisabled ? "bg-[#E2E5EA] text-[#AEB4C0] cursor-not-allowed" : "bg-[#6F74D8] text-white hover:bg-[#5E63C2] cursor-pointer"}`}
          >
            Ödev ver <ChevronRight size={16} />
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

// ---- ANA BİLEŞEN ----
export default function DesignParkour() {
  // Tüm task'ları state'e al — filter render'da yapılır (closure sorunu önlenir)
  const [allTasks,      setAllTasks]      = useState<Task[]>([]);
  const [templates,     setTemplates]     = useState<Task[]>([]);
  const [changeDateTask, setChangeDateTask] = useState<Task | null>(null);
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
  const activeTasks = allTasks.filter(t =>
    t.isActive === true && !t.isHidden &&
    t.status !== "archived" &&
    myUid != null &&
    (t.ownedBy === myUid || (!t.ownedBy && t.createdBy === myUid))
  );

  // ---- Handlers ----
  const handleComplete = async (task: Task) => {
    await updateDoc(doc(db, "tasks", task.id), { status: "completed" });
  };

  const handleCancelTask = async (task: Task) => {
    await updateDoc(doc(db, "tasks", task.id), { status: "archived", isActive: false });
  };

  const handleReactivateConfirm = async (selections: AssignSelection[]) => {
    if (!reactivateTask || selections.length === 0) return;
    const { classId, level, endDate } = selections[0];
    await updateDoc(doc(db, "tasks", reactivateTask.id), { classId, level, endDate, isPaused: false, isActive: true });
    setReactivateTask(null);
  };

  const handleChangeDateConfirm = async (date: string) => {
    if (!changeDateTask) return;
    await updateDoc(doc(db, "tasks", changeDateTask.id), { endDate: date, isPaused: false });
    setChangeDateTask(null);
  };

  // Ghost kart → AssignActivateModal → klon oluştur
  const handleGhostActivate = async (selections: AssignSelection[]) => {
    if (!ghostModalTask) return;
    const t = ghostModalTask;
    const uid = user?.uid ?? auth.currentUser?.uid ?? null;
    for (const { classId, level, endDate } of selections) {
      await addDoc(collection(db, "tasks"), {
        name:          t.name,
        description:   t.description,
        type:          t.type,
        points:        t.points,
        icon:          t.icon ?? null,
        classId,
        level,
        endDate,
        status:        "active",
        isActive:      true,
        isPaused:      false,
        isHidden:      false,
        templateId:    t.id,
        createdAt:     serverTimestamp(),
        createdBy:     uid,
        createdByName: user ? `${user.name} ${user.surname}` : null,
        branch:        user?.branch ?? null,
        ownedBy:       uid,
      });
    }
    setGhostModalTask(null);
  };

  // Sıralama: tamamlananlar sona, tarihli+aktif önce
  const sortedActiveTasks = [...activeTasks].sort((a, b) => {
    const aCompleted = a.status === "completed";
    const bCompleted = b.status === "completed";
    if (aCompleted !== bCompleted) return Number(aCompleted) - Number(bCompleted);
    const aPassive = !!a.isPaused || !a.endDate;
    const bPassive = !!b.isPaused || !b.endDate;
    return Number(aPassive) - Number(bPassive);
  });

  // Ghost slot: henüz başlatılmamış şablonlar
  const myActiveTemplateIds = new Set(
    activeTasks.filter(t => t.templateId).map(t => t.templateId!)
  );
  const ghostCount       = Math.max(0, 3 - activeTasks.length);
  const ghostTasks       = templates.filter(t => !myActiveTemplateIds.has(t.id) && !t.isHidden).slice(0, ghostCount);
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
            onChangeDate={setChangeDateTask}
            onComplete={setCompleteConfirmTask}
            onCancel={setCancelConfirmTask}
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
          onConfirm={handleReactivateConfirm}
          onCancel={() => setReactivateTask(null)}
        />
      )}
      {changeDateTask && (
        <ActivateDateModal
          title="Tarihi Değiştir"
          subtitle="Kartın bitiş tarihini güncelleyin. Pasifse otomatik aktife alınır."
          confirmLabel="Kaydet"
          initialDate={changeDateTask.endDate ?? ""}
          onConfirm={handleChangeDateConfirm}
          onCancel={() => setChangeDateTask(null)}
        />
      )}
      {ghostModalTask && (
        <AssignActivateModal
          taskName={ghostModalTask.name}
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
