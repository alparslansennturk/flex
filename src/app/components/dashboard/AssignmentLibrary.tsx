"use client";

import { useState, useEffect, useRef } from "react";
import { LibraryBig, ChevronLeft, ChevronRight, PlusCircle, MoreHorizontal } from "lucide-react";
import { db } from "@/app/lib/firebase";
import { collection, onSnapshot, doc, updateDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { useUser } from "@/app/context/UserContext";
import { Task, getIcon } from "./taskTypes";
import { AssignActivateModal, AssignSelection } from "./AssignActivateModal";

// ---- TASK KÜTÜPHANESİ KARTI ----
function TaskLibraryCard({ task, onActivate, onRemove }: {
  task: Task;
  onActivate: (task: Task) => void;
  onRemove: (task: Task) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const iconNode = getIcon(task.icon, task.type, 20);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const handleActivate = async () => {
    setLoading(true);
    onActivate(task);
    setLoading(false);
  };

  return (
    <div className="min-w-[calc((100%-80px)/4.3)] snap-start bg-white p-6 rounded-[28px] border border-[#EEF0F3] flex flex-col justify-between h-[210px] transition-all duration-500 hover:shadow-[15px_40px_80px_-20px_rgba(16,41,76,0.08)] hover:-translate-y-2 cursor-pointer group">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-[#F7F8FA] text-[#8E95A3] rounded-xl flex items-center justify-center shrink-0">
          {iconNode}
        </div>
        <div className="truncate flex-1 min-w-0">
          <h5 className="text-[15px] font-bold text-[#10294C] mb-0.5 truncate">{task.name}</h5>
          <p className="text-[11px] text-[#8E95A3] line-clamp-2">{task.description || "Açıklama yok"}</p>
        </div>
        <div className="relative shrink-0" ref={menuRef}>
          <button
            onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[#F7F8FA] text-[#AEB4C0] hover:text-[#10294C] transition-all cursor-pointer"
          >
            <MoreHorizontal size={15} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 z-50 bg-white border border-[#E2E5EA] rounded-2xl shadow-xl overflow-hidden min-w-[140px]">
              <button
                onClick={e => { e.stopPropagation(); onActivate(task); setMenuOpen(false); }}
                className="w-full px-4 py-3 text-left text-[13px] font-bold text-[#10294C] hover:bg-[#F7F8FA] transition-colors cursor-pointer"
              >
                Aktife Al
              </button>
              <button
                onClick={e => { e.stopPropagation(); onRemove(task); setMenuOpen(false); }}
                className="w-full px-4 py-3 text-left text-[13px] font-bold text-red-500 hover:bg-red-50 transition-colors cursor-pointer border-t border-[#EEF0F3]"
              >
                Kaldır
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="border-t border-[#EEF0F3] my-4"></div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[#AEB4C0] italic font-semibold opacity-60">Tasarım atölyesi</span>
        <button
          onClick={handleActivate}
          disabled={loading}
          className="px-4 py-1.5 bg-[#F7F8FA] text-[#10294C] rounded-xl text-[11px] font-bold flex items-center gap-2 hover:bg-[#10294C] hover:text-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="w-3 h-3 border border-[#10294C]/30 border-t-[#10294C] rounded-full animate-spin" />
          ) : (
            <><PlusCircle size={14} /> Ekle</>
          )}
        </button>
      </div>
    </div>
  );
}

// ---- ANA BİLEŞEN ----
export default function AssignmentLibrary({ scrollRef, handleScroll }: any) {
  const [tasks, setTasks]                   = useState<Task[]>([]);
  const [hasOverflow, setHasOverflow]       = useState(false);
  const [assignModalTask, setAssignModalTask] = useState<Task | null>(null);
  const { user } = useUser();

  useEffect(() => {
    const uid = user?.uid;
    return onSnapshot(collection(db, "tasks"), snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Task));

      // Eğitmenin aktif kartları (DesignParkour ile aynı mantık)
      const myActive = all.filter(t =>
        t.isActive && !t.isHidden &&
        (t.ownedBy === uid || (!t.ownedBy && t.createdBy === uid))
      );

      // Ortak şablonlar: aktif edilmemiş, owned olmayan, gizli olmayan
      const sharedTemplates = all.filter(t => !t.isActive && !t.isHidden && !t.ownedBy);

      // İlk N şablon parkurda "ghost" olarak gösteriliyor → kütüphanede gösterme
      const ghostCount = Math.max(0, 3 - myActive.length);
      setTasks(sharedTemplates.slice(ghostCount));
    });
  }, [user?.uid]);

  // Scroll container taşıyor mu kontrol et
  useEffect(() => {
    const el = scrollRef?.current;
    if (!el) return;
    const check = () => setHasOverflow(el.scrollWidth > el.clientWidth + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tasks, scrollRef]);

  // Grup × seviye × tarih seçilince her grup için ayrı task oluştur
  const handleAssignConfirm = async (selections: AssignSelection[]) => {
    if (!assignModalTask) return;
    const t = assignModalTask;
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
        isActive:      true,
        isPaused:      false,
        isHidden:      false,
        templateId:    t.id,
        createdAt:     serverTimestamp(),
        createdBy:     user?.uid ?? null,
        createdByName: user ? `${user.name} ${user.surname}` : null,
        branch:        user?.branch ?? null,
        ownedBy:       user?.uid ?? null,
      });
    }
    setAssignModalTask(null);
  };

  const handleRemove = async (task: Task) => {
    await updateDoc(doc(db, "tasks", task.id), { isHidden: true });
  };

  // Kütüphanede kart yoksa section'ı gizle
  if (tasks.length === 0) return null;

  return (
    <section className="mt-[48px] mb-[64px] space-y-[24px]">
      <div className="flex items-center gap-3 text-[#8E95A3] px-2">
        <LibraryBig size={22} />
        <h3 className="text-[22px] font-bold text-[#8E95A3] cursor-default">Ödev kütüphanesi</h3>
      </div>
      <div className="relative overflow-visible">
        {hasOverflow && (
          <>
            <button onClick={() => handleScroll('left')} className="absolute -left-5 top-[140px] -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-xl border border-[#EEF0F3] hover:scale-110 active:scale-95 transition-all cursor-pointer text-[#10294C]"><ChevronLeft size={24} /></button>
            <button onClick={() => handleScroll('right')} className="absolute -right-5 top-[140px] -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-xl border border-[#EEF0F3] hover:scale-110 active:scale-95 transition-all cursor-pointer text-[#10294C]"><ChevronRight size={24} /></button>
          </>
        )}
        <div ref={scrollRef} className="flex gap-6 overflow-x-auto no-scrollbar scroll-smooth snap-x py-10 -my-10">
          {tasks.map(task => (
            <TaskLibraryCard
              key={task.id}
              task={task}
              onActivate={setAssignModalTask}
              onRemove={handleRemove}
            />
          ))}
        </div>
      </div>
      {assignModalTask && (
        <AssignActivateModal
          taskName={assignModalTask.name}
          onConfirm={handleAssignConfirm}
          onCancel={() => setAssignModalTask(null)}
        />
      )}
    </section>
  );
}
