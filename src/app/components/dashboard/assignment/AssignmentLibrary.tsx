"use client";

import { useState, useEffect, useRef } from "react";
import { LibraryBig, ChevronLeft, ChevronRight, PlusCircle, MoreHorizontal, User, Globe, Sparkles } from "lucide-react";
import { db } from "@/app/lib/firebase";
import { collection, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, getDocs, query, where } from "firebase/firestore";
import { auth } from "@/app/lib/firebase";
import { useUser } from "@/app/context/UserContext";
import { Task, getIcon } from "./taskTypes";
import { AssignActivateModal, AssignSelection } from "./AssignActivateModal";
import { NotificationService } from "@/app/lib/services/NotificationService";

type LibraryTab = "personal" | "global";

const TAB_CONFIG: { key: LibraryTab; label: string; icon: React.ReactNode; emptyMsg: string }[] = [
  { key: "personal", label: "Kişisel", icon: <User size={14} />,  emptyMsg: "Henüz kişisel şablonunuz yok." },
  { key: "global",   label: "Global",  icon: <Globe size={14} />, emptyMsg: "Henüz global şablon yok." },
];

// ---- TASK KÜTÜPHANESİ KARTI ----
function TaskLibraryCard({ task, onStartAssignment, onRemove }: {
  task: Task;
  onStartAssignment: (task: Task) => void;
  onRemove: (task: Task) => void;
}) {
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

  return (
    <div className="min-w-[calc((100%-80px)/4.3)] snap-start bg-white p-6 rounded-20 border border-[#EEF0F3] flex flex-col justify-between h-[210px] transition-all duration-500 hover:shadow-[15px_40px_80px_-20px_rgba(16,41,76,0.08)] hover:-translate-y-2 cursor-pointer group">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-[#F7F8FA] text-[#8E95A3] rounded-xl flex items-center justify-center shrink-0">
          {iconNode}
        </div>
        <div className="truncate flex-1 min-w-0">
          <h5 className="text-[15px] font-bold text-[#10294C] mb-0.5 truncate">{task.name}</h5>
          <p className="text-[11px] text-[#8E95A3] line-clamp-2">{task.subtitle || task.description || "Açıklama yok"}</p>
        </div>
        {/* 3-dot menü */}
        <div className="relative shrink-0" ref={menuRef}>
          <button
            onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[#F7F8FA] text-[#AEB4C0] hover:text-[#10294C] transition-all cursor-pointer"
          >
            <MoreHorizontal size={15} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 z-50 bg-white border border-[#E2E5EA] rounded-2xl shadow-xl overflow-hidden min-w-[155px]">
              <button
                onClick={e => { e.stopPropagation(); onStartAssignment(task); setMenuOpen(false); }}
                className="w-full px-4 py-3 text-left text-[13px] font-bold text-[#10294C] hover:bg-[#F7F8FA] transition-colors cursor-pointer"
              >
                Ödevi Başlat
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
      <div className="border-t border-[#EEF0F3] my-4" />
      <div className="flex items-center justify-between">
        {task.scope === "gamified" ? (
          <span className="flex items-center gap-1 text-[10px] font-bold text-purple-500 bg-purple-50 px-2 py-0.5 rounded-full">
            <Sparkles size={10} /> Oyunlaştırılmış
          </span>
        ) : (
          <span className="text-[10px] text-[#AEB4C0] italic font-semibold opacity-60">Global</span>
        )}
        <button
          onClick={() => onStartAssignment(task)}
          className="px-4 py-1.5 bg-[#F7F8FA] text-[#10294C] rounded-xl text-[11px] font-bold flex items-center gap-2 hover:bg-[#10294C] hover:text-white transition-all cursor-pointer"
        >
          <PlusCircle size={14} /> Ödevi Başlat
        </button>
      </div>
    </div>
  );
}

// ---- ANA BİLEŞEN ----
export default function AssignmentLibrary({ scrollRef, handleScroll }: any) {
  const [templates, setTemplates]             = useState<Task[]>([]);
  const [activeTab, setActiveTab]             = useState<LibraryTab>("personal");
  const [hasOverflow, setHasOverflow]         = useState(false);
  const [assignModalTask, setAssignModalTask] = useState<Task | null>(null);
  const { user } = useUser();

  useEffect(() => {
    return onSnapshot(collection(db, "templates"), snap => {
      setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
    });
  }, []);

  useEffect(() => {
    const el = scrollRef?.current;
    if (!el) return;
    const check = () => setHasOverflow(el.scrollWidth > el.clientWidth + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [templates, activeTab, scrollRef]);

  const uid = user?.uid ?? auth.currentUser?.uid;

  const visibleTemplates = templates.filter(t => {
    if (t.isHidden) return false;
    if (activeTab === "personal") return t.scope === "personal" && t.createdBy === uid;
    // global: standart + gamified birlikte; scope yazılmamış eski şablonlar da buraya düşer
    return t.scope === "global" || t.scope === "gamified" || !t.scope;
  });

  const handleRemove = async (task: Task) => {
    await updateDoc(doc(db, "templates", task.id), { isHidden: true });
  };

  const tabConfig = TAB_CONFIG.find(t => t.key === activeTab)!;

  return (
    <section className="mt-[48px] mb-[64px] space-y-[24px]">
      {/* Başlık + sekmeler */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3 text-[#5C6370]">
          <LibraryBig size={22} />
          <h3 className="text-[22px] font-bold text-[#5C6370] cursor-default">Ödev kütüphanesi</h3>
        </div>
        <div className="flex items-center bg-[#F7F8FA] p-1 rounded-xl border border-[#EEF0F3] gap-0.5">
          {TAB_CONFIG.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-[10px] text-[12px] font-bold transition-all cursor-pointer outline-none select-none ${
                activeTab === tab.key
                  ? "bg-white text-[#10294C] shadow-sm border border-[#EEF0F3]"
                  : "text-[#8E95A3] hover:text-[#10294C]"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Kart listesi */}
      {visibleTemplates.length === 0 ? (
        <div className="flex items-center justify-center h-32 rounded-2xl border border-dashed border-[#D0D5DE] text-[#8E95A3] text-[13px] font-medium">
          {tabConfig.emptyMsg}
        </div>
      ) : (
        <div className="relative overflow-visible">
          {hasOverflow && (
            <>
              <button onClick={() => handleScroll('left')}  className="absolute -left-5  top-[140px] -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-xl border border-[#EEF0F3] hover:scale-110 active:scale-95 transition-all cursor-pointer text-[#10294C]"><ChevronLeft  size={24} /></button>
              <button onClick={() => handleScroll('right')} className="absolute -right-5 top-[140px] -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-xl border border-[#EEF0F3] hover:scale-110 active:scale-95 transition-all cursor-pointer text-[#10294C]"><ChevronRight size={24} /></button>
            </>
          )}
          <div ref={scrollRef} className="flex gap-6 overflow-x-auto no-scrollbar scroll-smooth snap-x py-10 -my-10">
            {visibleTemplates.map(task => (
              <TaskLibraryCard
                key={task.id}
                task={task}
                onStartAssignment={setAssignModalTask}
                onRemove={handleRemove}
              />
            ))}
          </div>
        </div>
      )}

      {assignModalTask && (
        <AssignActivateModal
          taskName={assignModalTask.name}
          templateId={assignModalTask.id}
          templateLevel={assignModalTask.level}
          templateScope={assignModalTask.scope}
          onConfirm={async (selections: AssignSelection[]) => {
            const t = assignModalTask;
            for (const { classId, groupId, groupBranch, groupModule, level, endDate } of selections) {
              const effectiveLevel = (t.module === "GRAFIK_2" && groupModule === "GRAFIK_1") ? "Seviye 1" : (level || null);
              const taskRef = await addDoc(collection(db, "tasks"), {
                name:          t.name,
                subtitle:      t.subtitle ?? null,
                description:   t.description ?? null,
                type:          t.type,
                points:        t.points ?? null,
                icon:           t.icon ?? null,
                assignmentType: t.assignmentType ?? null,
                module:        t.module ?? null,
                groupModule:   groupModule ?? null,
                classId,
                groupId,
                groupBranch,
                level:         effectiveLevel,
                endDate,
                status:         "active",
                isActive:      true,
                isPaused:      false,
                isHidden:      false,
                templateId:    t.id,
                createdAt:     serverTimestamp(),
                createdBy:     user?.uid ?? null,
                createdByName: user ? `${user.name} ${user.surname}` : null,
                branch:        groupBranch || user?.branch || null,
                ownedBy:       user?.uid ?? null,
              });

              const senderId = user?.uid ?? auth.currentUser?.uid;
              if (senderId) {
                (async () => {
                  try {
                    const snap = await getDocs(
                      query(collection(db, "students"), where("groupId", "==", groupId))
                    );
                    const activeStudents = snap.docs
                      .filter(d => d.data().status !== "passive")
                      .map(d => ({ docId: d.id, authUid: d.data().authUid as string | undefined }))
                      .filter((s): s is { docId: string; authUid: string } => !!s.authUid);

                    if (!activeStudents.length) return;

                    const fmtDate = endDate
                      ? new Date(endDate).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })
                      : null;
                    const preview = fmtDate ? `Son teslim tarihin: ${fmtDate}.` : "Yeni bir ödev eklendi.";

                    for (const { docId, authUid } of activeStudents) {
                      await NotificationService.dispatch({
                        eventId:   `assign_${taskRef.id}_${docId}`,
                        notifType: "assignment",
                        audience:  { type: "users", userIds: [authUid] },
                        senderId,
                        title:     `Yeni Ödev: ${t.name}`,
                        preview,
                        actionUrl: "/",
                        entityId:  taskRef.id,
                      });
                    }
                  } catch (err) {
                    console.error("[AssignmentLibrary] Bildirim gönderilemedi:", err);
                  }
                })();
              }

              if (!t.assignmentType) {
                (async () => {
                  try {
                    const token = await auth.currentUser?.getIdToken();
                    if (!token) return;
                    await fetch("/api/task-assigned", {
                      method: "POST",
                      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                      body: JSON.stringify({ groupId, taskName: t.name, taskSubtitle: t.subtitle ?? null, endDate }),
                    });
                  } catch (err) {
                    console.error("[AssignmentLibrary] Mail gönderilemedi:", err);
                  }
                })();
              }
            }
            setAssignModalTask(null);
          }}
          onCancel={() => setAssignModalTask(null)}
        />
      )}
    </section>
  );
}
