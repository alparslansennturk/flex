"use client";

import { useState, useEffect, useRef } from "react";
import { Route, Clock, ChevronRight, MoreHorizontal } from "lucide-react";
import { db } from "@/app/lib/firebase";
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { useUser } from "@/app/context/UserContext";
import { Task, getIcon, TaskType } from "./taskTypes";
import { PERMISSIONS } from "@/app/lib/constants";
import { ActivateDateModal } from "./TaskCardManager";

// Tip bazlı parkur renkleri — proje: turuncu, etkinlik: yeşil
const PARKOUR_STYLE: Record<TaskType, { gradient: string; tagBg: string; tagText: string; label: string }> = {
  odev:     { gradient: "bg-gradient-to-b from-pink-500 to-[#B80E57]",  tagBg: "bg-pink-100",   tagText: "text-pink-700",   label: "Ödev" },
  proje:    { gradient: "bg-gradient-to-b from-[#FF8D28] to-[#D35400]", tagBg: "bg-orange-100", tagText: "text-orange-600", label: "Proje" },
  etkinlik: { gradient: "bg-gradient-to-b from-[#1CB5AE] to-[#0E5D59]", tagBg: "bg-cyan-100",   tagText: "text-cyan-700",   label: "Etkinlik" },
};

// ---- PLACEHOLDER KART (kütüphanede hiç kart yoksa yer tutucu) ----
function PlaceholderParkourCard() {
  return (
    <div className="bg-white/50 p-7 rounded-[32px] border border-dashed border-[#E2E5EA] flex flex-col justify-between h-full cursor-default opacity-40">
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

// ---- TASK KARTI (aktif veya ödünç alınmış) ----
function TaskParkourCard({ task, canManage, isBorrowed = false, canPause = true, canRemove = false, onSendToLibrary, onTogglePause, onRemove, onActivateBorrowed, onChangeDate }: {
  task: Task;
  canManage: boolean;
  isBorrowed?: boolean;
  canPause?: boolean;
  canRemove?: boolean;
  onSendToLibrary: (task: Task) => void;
  onTogglePause: (task: Task) => void;
  onRemove: (task: Task) => void;
  onActivateBorrowed: (task: Task) => void;
  onChangeDate: (task: Task) => void;
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

  const duration  = getDuration();
  const isExpired = duration === null;
  const isNoDate  = !task.endDate;
  // Tarihi yoksa, ödünç alınmışsa, pasife alınmışsa veya süresi dolmuşsa → disabled
  const isDisabled = isBorrowed || isExpired || !!task.isPaused || isNoDate;
  const style      = PARKOUR_STYLE[task.type] ?? PARKOUR_STYLE.odev;
  const iconNode   = getIcon(task.icon, task.type, 22);

  const statusText  = isBorrowed ? "Pasif" : isExpired ? "Süresi Doldu" : (task.isPaused || isNoDate) ? "Pasif" : "Aktif";
  const statusColor = (!isDisabled) ? "text-[#009F3E]" : "text-[#AEB4C0]";

  return (
    <div className={`bg-white p-7 rounded-[32px] border border-[#E2E5EA] flex flex-col justify-between transition-all duration-300 hover:shadow-[15px_30px_60px_-15px_rgba(16,41,76,0.08)] hover:-translate-y-1 h-full cursor-default group ${isExpired ? "opacity-60" : ""}`}>
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
                    // Ödünç alınmış kart: sadece aktifleştir
                    <button
                      onClick={() => { onActivateBorrowed(task); setMenuOpen(false); }}
                      className="w-full px-4 py-3 text-left text-[13px] font-bold text-[#10294C] hover:bg-[#F7F8FA] transition-colors cursor-pointer"
                    >
                      Aktifleştir
                    </button>
                  ) : (
                    // Normal aktif kart: tam menü
                    <>
                      <button
                        onClick={() => { onSendToLibrary(task); setMenuOpen(false); }}
                        className="w-full px-4 py-3 text-left text-[13px] font-bold text-[#10294C] hover:bg-[#F7F8FA] transition-colors cursor-pointer"
                      >
                        Kütüphaneye Gönder
                      </button>
                      <button
                        onClick={() => { onTogglePause(task); setMenuOpen(false); }}
                        disabled={!canPause && !task.isPaused && !!task.endDate}
                        className={`w-full px-4 py-3 text-left text-[13px] font-bold transition-colors border-t border-[#EEF0F3] ${(!canPause && !task.isPaused && !!task.endDate) ? "text-[#AEB4C0] cursor-not-allowed opacity-50" : "text-[#10294C] hover:bg-[#F7F8FA] cursor-pointer"}`}
                      >
                        {(task.isPaused || !task.endDate) ? "Aktife Al" : "Pasife Al"}
                      </button>
                      {task.endDate && (
                        <button
                          onClick={() => { onChangeDate(task); setMenuOpen(false); }}
                          className="w-full px-4 py-3 text-left text-[13px] font-bold text-[#10294C] hover:bg-[#F7F8FA] transition-colors cursor-pointer border-t border-[#EEF0F3]"
                        >
                          Tarihi Değiştir
                        </button>
                      )}
                      {canRemove && (
                        <button
                          onClick={() => { onRemove(task); setMenuOpen(false); }}
                          className="w-full px-4 py-3 text-left text-[13px] font-bold text-red-500 hover:bg-red-50 transition-colors cursor-pointer border-t border-[#EEF0F3]"
                        >
                          Kaldır
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
        <h4 className="text-[20px] text-[#10294C] font-bold mb-1.5 leading-tight">{task.name}</h4>
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
          <span className="text-[11px] text-[#8E95A3]">Teslim süresi</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Clock size={12} className={isExpired ? "text-red-400" : "text-[#10294C]"} />
            <span className={`text-[13px] font-bold ${isExpired ? "text-red-400" : "text-[#10294C]"}`}>
              {isExpired ? "Süre Doldu" : (duration ?? "Süresiz")}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-[#F7F8FA] pt-5">
        <span className="text-[11px] text-[#AEB4C0] italic font-semibold opacity-60">Tasarım atölyesi</span>
        <button
          disabled={isDisabled}
          className={`px-5 h-10 flex items-center gap-2 rounded-xl text-[13px] font-bold transition-all active:scale-95 ${isDisabled ? "bg-[#E2E5EA] text-[#AEB4C0] cursor-not-allowed" : "bg-[#6F74D8] text-white hover:bg-[#5E63C2] cursor-pointer"}`}
        >
          Ödev ver <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ---- ANA BİLEŞEN ----
export default function DesignParkour() {
  const [activeTasks,    setActiveTasks]    = useState<Task[]>([]);
  const [libraryTasks,   setLibraryTasks]   = useState<Task[]>([]);
  const [dateModalTask,  setDateModalTask]  = useState<Task | null>(null);
  const [changeDateTask, setChangeDateTask] = useState<Task | null>(null);
  const { hasPermission, isTrainer, isAdmin, user } = useUser();
  const canManage   = hasPermission(PERMISSIONS.ASSIGNMENT_MANAGE) || isTrainer();
  const isAdminVal  = isAdmin();

  useEffect(() => {
    return onSnapshot(collection(db, "tasks"), snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Task));

      // Aktif kartlar: admin tümünü görür, eğitmen sadece kendi klonlarını (ownedBy) + eski kartları (backward compat)
      const myActive = all.filter(t =>
        t.isActive && !t.isHidden &&
        (isAdminVal || t.ownedBy === user?.uid || (!t.ownedBy && t.createdBy === user?.uid))
      );
      setActiveTasks(myActive);

      // Bu eğitmenin aktif olarak kullandığı şablon ID'leri
      const myActiveTemplateIds = new Set(
        myActive.filter(t => t.templateId).map(t => t.templateId!)
      );

      // Borrowed slot için: sadece ortak şablonlar (ownedBy yok), aktif edilmemiş olanlar
      setLibraryTasks(all.filter(t =>
        !t.isActive && !t.isHidden && !t.ownedBy && !myActiveTemplateIds.has(t.id)
      ));
    });
  }, [isAdminVal, user?.uid]);

  const handleSendToLibrary = async (task: Task) => {
    if (task.ownedBy && task.templateId) {
      // Kütüphaneden klonlanmış kart → sil (orijinal şablon zaten kütüphanede)
      await deleteDoc(doc(db, "tasks", task.id));
    } else {
      // Eğitmenin kendi oluşturduğu kart ya da admin kartı → pasife al
      await updateDoc(doc(db, "tasks", task.id), { isActive: false, isPaused: false, isHidden: false, endDate: null });
    }
  };
  const handleRemove = async (task: Task) => {
    if (task.ownedBy) {
      await deleteDoc(doc(db, "tasks", task.id));
    } else {
      await updateDoc(doc(db, "tasks", task.id), { isActive: false, isPaused: false, isHidden: true, endDate: null });
    }
  };

  const handleTogglePause = (task: Task) => {
    if (!task.endDate) { setDateModalTask(task); return; }
    // Pasife alırken tarihi sıfırla
    updateDoc(doc(db, "tasks", task.id), task.isPaused
      ? { isPaused: false }
      : { isPaused: true, endDate: null }
    );
  };

  const claimFields = () => ({
    createdBy:      user?.uid ?? null,
    createdByName:  user ? `${user.name} ${user.surname}` : null,
    branch:         user?.branch ?? null,
    ownedBy:        user?.uid ?? null,
  });

  const handleActivateBorrowed = (task: Task) => {
    if (!task.endDate) { setDateModalTask(task); return; }
    addDoc(collection(db, "tasks"), {
      name: task.name, description: task.description, type: task.type,
      points: task.points, icon: task.icon ?? null,
      endDate: task.endDate, isActive: true, isPaused: false, isHidden: false,
      templateId: task.id, createdAt: serverTimestamp(), ...claimFields(),
    });
  };

  const handleDateConfirm = async (date: string) => {
    if (!dateModalTask) return;
    await addDoc(collection(db, "tasks"), {
      name: dateModalTask.name, description: dateModalTask.description, type: dateModalTask.type,
      points: dateModalTask.points, icon: dateModalTask.icon ?? null,
      endDate: date, isActive: true, isPaused: false, isHidden: false,
      templateId: dateModalTask.id, createdAt: serverTimestamp(), ...claimFields(),
    });
    setDateModalTask(null);
  };

  const handleChangeDateConfirm = async (date: string) => {
    if (!changeDateTask) return;
    await updateDoc(doc(db, "tasks", changeDateTask.id), { endDate: date, isPaused: false });
    setChangeDateTask(null);
  };

  // Aktif kartlar: tarihli+aktif önce, tarihsiz/pasif sona
  const sortedActiveTasks = [...activeTasks].sort((a, b) => {
    const aPassive = !!a.isPaused || !a.endDate;
    const bPassive = !!b.isPaused || !b.endDate;
    return Number(aPassive) - Number(bPassive);
  });

  // Aktif < 3 ise kütüphaneden ödünç al
  const borrowedCount = Math.max(0, 3 - activeTasks.length);
  const borrowedTasks = libraryTasks.slice(0, borrowedCount);
  // Kütüphanede de yeterli kart yoksa iskelet doldur
  const placeholderCount = Math.max(0, 3 - activeTasks.length - borrowedTasks.length);

  return (
    <section className="mt-[48px] space-y-[24px]">
      <div className="flex items-center gap-3 text-[#10294C] px-2">
        <Route size={22} className="text-[#FF8D28]" />
        <h3 className="text-[22px] font-bold cursor-default">Tasarım parkuru</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Aktif kartlar — ilk 3 pasife alınabilir, sonrakiler kütüphaneye gönderilebilir */}
        {sortedActiveTasks.map((task, i) => (
          <TaskParkourCard
            key={task.id}
            task={task}
            canManage={canManage}
            canPause={i < 3}
            canRemove={isAdminVal}
            onSendToLibrary={handleSendToLibrary}
            onTogglePause={handleTogglePause}
            onRemove={handleRemove}
            onActivateBorrowed={handleActivateBorrowed}
            onChangeDate={setChangeDateTask}
          />
        ))}
        {/* Ödünç alınmış — disabled, 3-noktada "Aktifleştir" */}
        {borrowedTasks.map(task => (
          <TaskParkourCard
            key={`borrowed-${task.id}`}
            task={task}
            canManage={canManage}
            isBorrowed
            canRemove={isAdminVal}
            onSendToLibrary={handleSendToLibrary}
            onTogglePause={handleTogglePause}
            onRemove={handleRemove}
            onActivateBorrowed={handleActivateBorrowed}
            onChangeDate={setChangeDateTask}
          />
        ))}
        {/* İskelet — hiç kart yoksa */}
        {Array.from({ length: placeholderCount }).map((_, i) => (
          <PlaceholderParkourCard key={`ph-${i}`} />
        ))}
      </div>
      {dateModalTask && (
        <ActivateDateModal
          onConfirm={handleDateConfirm}
          onCancel={() => setDateModalTask(null)}
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
    </section>
  );
}
