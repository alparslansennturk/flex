"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/app/lib/firebase";
import {
  doc, getDoc, getDocs, collection, query, where, onSnapshot, orderBy,
} from "firebase/firestore";
import {
  Loader2, BookOpen, ClipboardList, ChevronDown, MoreVertical,
  CheckCircle2, RotateCcw, Clock, ArrowRight, FileText,
} from "lucide-react";
import StudentSidebar from "@/app/components/student/StudentSidebar";
import StudentLeagueWidget from "@/app/components/student/StudentLeagueWidget";
import StudentHeader from "@/app/components/layout/StudentHeader";
import type { SubmissionStatus } from "@/app/types/submission";

/* ── Types ── */

interface Student {
  name: string;
  lastName: string;
  gender?: string;
  avatarId?: number;
  groupId: string;
  groupCode?: string;
}

type FirestoreDate = { toDate?: () => Date } | Date | string | number | null | undefined;

interface TaskRow {
  id: string;
  name: string;
  points: number;
  endDate?: FirestoreDate;
  createdAt?: FirestoreDate;
  subtitle?: string;
  description?: string;
  createdByName?: string;
  isActive: boolean;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentType?: string;
  file?: {
    driveFileId?: string;
    driveViewLink?: string;
    fileUrl?: string;
    fileName?: string;
  };
}

interface SubInfo {
  id: string;
  status: SubmissionStatus;
  iteration: number;
  grade?: number;
  feedback?: string;
  isLate: boolean;
  daysLate?: number;
  submittedAt?: Date;
}

type Filter = "all" | "active" | "completed";

interface AnnouncementItem {
  id: string;
  taskId: string;
  taskName: string;
  text: string;
  authorName: string;
  createdAt: Date;
}

/* ── Helpers ── */

function isImageFile(name: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp)$/i.test(name);
}

function parseDate(val: FirestoreDate): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === "string" || typeof val === "number") return new Date(val);
  if (typeof val === "object" && val.toDate) return val.toDate();
  return null;
}

function fmtEndDate(val: FirestoreDate): string {
  const d = parseDate(val);
  if (!d || isNaN(d.getTime())) return "";
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", weekday: "short" });
}

function fmtCreatedAt(val: FirestoreDate): string {
  const d = parseDate(val);
  if (!d) return "";
  const day     = String(d.getDate()).padStart(2, "0");
  const month   = String(d.getMonth() + 1).padStart(2, "0");
  const year    = d.getFullYear();
  const weekday = d.toLocaleDateString("tr-TR", { weekday: "short" });
  return `${day}.${month}.${year} ${weekday}.`;
}

const STATUS_META: Record<SubmissionStatus, { label: string; cls: string; icon: React.ReactNode }> = {
  submitted: {
    label: "Teslim Edildi",
    cls:   "text-status-success-700",
    icon:  <CheckCircle2 size={44} strokeWidth={1.4} className="text-status-success-500" />,
  },
  reviewing: {
    label: "İncelemede",
    cls:   "text-status-success-700",
    icon:  <Clock size={44} strokeWidth={1.4} className="text-status-success-500" />,
  },
  revision: {
    label: "Revize Bekleniyor",
    cls:   "text-status-info",
    icon:  <RotateCcw size={44} strokeWidth={1.4} className="text-status-info" />,
  },
  completed: {
    label: "Tamamlandı",
    cls:   "text-status-success-700",
    icon:  <CheckCircle2 size={44} strokeWidth={1.4} className="text-status-success-500" />,
  },
};

/* ── Page ── */

export default function StudentDashboard() {
  const { studentId } = useParams<{ studentId: string }>();
  const router = useRouter();

  const [student,       setStudent]       = useState<Student | null>(null);
  const [tasks,         setTasks]         = useState<TaskRow[]>([]);
  const [subMap,        setSubMap]        = useState<Record<string, SubInfo>>({});
  const [loading,       setLoading]       = useState(true);
  const [filter,        setFilter]        = useState<Filter>("all");
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [selectedAnn,   setSelectedAnn]   = useState<AnnouncementItem | null>(null);

  useEffect(() => { loadData(); }, [studentId]);

  /* Duyurular: tasks/{taskId}/comments'ten general yorumları çek */
  useEffect(() => {
    if (tasks.length === 0) return;
    const taskNameMap: Record<string, string> = {};
    tasks.forEach(t => { taskNameMap[t.id] = t.name; });
    Promise.all(
      tasks.map(t =>
        getDocs(query(
          collection(db, "tasks", t.id, "comments"),
          orderBy("createdAt", "asc"),
        )).then(snap =>
          snap.docs
            .filter(d => !d.data().commentType || d.data().commentType === "general")
            .map(d => ({
              id:         d.id,
              taskId:     t.id,
              taskName:   t.name,
              text:       d.data().text ?? "",
              authorName: d.data().authorName ?? "Eğitmen",
              createdAt:  d.data().createdAt?.toDate?.() ?? new Date(),
            } as AnnouncementItem))
        )
      )
    ).then(results => {
      const all = results.flat().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setAnnouncements(all);
    }).catch(() => {});
  }, [tasks]);

  useEffect(() => {
    if (!student?.groupId) return;
    const q = query(collection(db, "tasks"), where("groupId", "==", student.groupId));
    const unsub = onSnapshot(q, snap => {
      setTasks(snap.docs.map(d => ({
        id:            d.id,
        name:          d.data().name          ?? "",
        points:        d.data().points        ?? 0,
        endDate:       d.data().endDate,
        createdAt:     d.data().createdAt,
        subtitle:      d.data().subtitle,
        description:   d.data().description,
        createdByName: d.data().createdByName,
        isActive:        d.data().isActive ?? true,
        attachmentUrl:   d.data().attachmentUrl  ?? undefined,
        attachmentName:  d.data().attachmentName ?? undefined,
        attachmentType:  d.data().attachmentType ?? undefined,
        file:            d.data().file ?? undefined,
      })));
    });
    return unsub;
  }, [student?.groupId]);

  async function loadData() {
    setLoading(true);
    try {
      const stuSnap = await getDoc(doc(db, "students", studentId));
      if (!stuSnap.exists()) return;
      const sd = stuSnap.data();
      const student: Student = {
        name:      sd.name      ?? "",
        lastName:  sd.lastName  ?? "",
        gender:    sd.gender,
        avatarId:  sd.avatarId,
        groupId:   sd.groupId   ?? "",
        groupCode: sd.groupCode ?? "",
      };
      setStudent(student);

      try {
        const subSnap = await getDocs(query(collection(db, "submissions"), where("studentId", "==", studentId)));
        const map: Record<string, SubInfo> = {};
        subSnap.docs.forEach(d => {
          const data = d.data();
          const curr = map[data.taskId];
          if (!curr || data.iteration > curr.iteration) {
            map[data.taskId] = {
              id:          d.id,
              status:      data.status,
              iteration:   data.iteration ?? 1,
              grade:       data.grade,
              feedback:    data.feedback,
              isLate:      data.isLate ?? false,
              daysLate:    data.daysLate,
              submittedAt: data.submittedAt?.toDate?.() ?? undefined,
            };
          }
        });
        setSubMap(map);
      } catch (subErr: unknown) {
        console.warn("[StudentDashboard] Submissions yüklenemedi:", (subErr as { code?: string }).code);
      }
    } finally {
      setLoading(false);
    }
  }

  if (loading || !student) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-50">
        <Loader2 size={22} className="animate-spin text-surface-400" />
      </div>
    );
  }

  const today        = new Date(); today.setHours(0, 0, 0, 0);
  // Aktif: en son sisteme eklenen en üstte
  const activeTasks  = tasks
    .filter(t => { const d = parseDate(t.endDate); return d ? d >= today : !!t.isActive; })
    .sort((a, b) => (parseDate(b.createdAt)?.getTime() ?? 0) - (parseDate(a.createdAt)?.getTime() ?? 0));

  // Tamamlananlar: en son biten (en yakın geçmiş deadline) en üstte (azalan endDate)
  const pastTasks    = tasks
    .filter(t => { const d = parseDate(t.endDate); return d ? d < today : false; })
    .sort((a, b) => (parseDate(b.endDate)?.getTime() ?? 0) - (parseDate(a.endDate)?.getTime() ?? 0));

  const showActive   = filter === "all" || filter === "active";
  const showPast     = filter === "all" || filter === "completed";


  const studentFullName = `${student.name} ${student.lastName}`.trim();

  return (
    <div className="flex h-screen overflow-hidden bg-white font-inter antialiased text-text-primary">

      {/* ── Sidebar ── */}
      <aside className="hidden lg:flex h-full shrink-0 z-50 w-[280px] 2xl:w-[320px] bg-base-primary-900">
        <StudentSidebar />
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <StudentHeader
          studentName={studentFullName}
          groupCode={student.groupCode}
          gender={student.gender}
          avatarId={student.avatarId}
        />
        <main className="flex-1 overflow-y-auto overflow-x-clip [scrollbar-gutter:stable]">
          <div className="w-[94%] mx-auto pt-7 pb-12 max-w-[960px] xl:max-w-[1200px] 2xl:max-w-[1480px]">

            {/* ── İki kolon: sol içerik + sağ duyurular ── */}
            <div className="flex gap-8 items-start">

              {/* ══ Sol: Banner + Ödevler ══ */}
              <div className="flex-1 min-w-0">

                {/* Üst başlık */}
                <div className="flex items-end gap-4 mb-7">
                  <div>
                    <h1 className="text-[22px] font-bold text-base-primary-900 leading-tight">{student.groupCode || "Öğrenci Paneli"}</h1>
                  </div>
                </div>

                {/* Template banner */}
                <div
                  className="w-full rounded-2xl mb-6 overflow-hidden bg-surface-200"
                  style={{ height: 240 }}
                >
                  <img
                    src="/assets/templates/desgin-studio-templale-01.jpg"
                    alt=""
                    className="w-full h-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>

                {/* Filtre pilleri */}
                <div className="flex items-center gap-2 mb-7">
                  {(["all", "active", "completed"] as Filter[]).map(f => {
                    const labels: Record<Filter, string> = {
                      all: "Tümü", active: "Aktif Ödevler", completed: "Tamamlananlar",
                    };
                    return (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-1.5 rounded-full text-[13px] border transition-colors cursor-pointer
                          ${filter === f
                            ? "bg-white border-surface-300 text-text-primary font-semibold shadow-sm"
                            : "bg-transparent border-surface-200 text-surface-500 font-medium hover:border-surface-300 hover:text-surface-700"
                          }`}
                      >
                        {labels[f]}
                      </button>
                    );
                  })}
                </div>

                {/* Aktif Ödevler */}
                {showActive && activeTasks.length > 0 && (
                  <section className="mb-8">
                    <h2 className="text-[18px] font-bold text-text-primary mb-3">Aktif Ödevler</h2>
                    <div className="space-y-3">
                      {activeTasks.map(task => (
                        <StudentTaskAccordion
                          key={task.id}
                          task={task}
                          sub={subMap[task.id] ?? null}
                          studentId={studentId}
                          isActiveSection
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* Tamamlananlar */}
                {showPast && pastTasks.length > 0 && (
                  <section>
                    <h2 className="text-[18px] font-bold text-text-primary mb-3">Tamamlananlar</h2>
                    <div className="space-y-3">
                      {pastTasks.map(task => (
                        <StudentTaskAccordion
                          key={task.id}
                          task={task}
                          sub={subMap[task.id] ?? null}
                          studentId={studentId}
                          isActiveSection={false}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {tasks.length === 0 && (
                  <div className="flex flex-col items-center gap-2 py-16 text-surface-400">
                    <BookOpen size={22} />
                    <p className="text-[13px] font-medium">Henüz ödev eklenmedi.</p>
                  </div>
                )}
              </div>

              {/* ══ Sağ: Lig + Duyurular ══ */}
              <aside className="w-72 shrink-0 sticky top-7 hidden xl:flex xl:flex-col xl:gap-6 xl:pt-14">

                {/* Sınıf Ligi */}
                <div className="bg-white border border-surface-200 rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-2 px-5 pt-5 pb-4 border-b border-surface-100">
                    <span className="text-[15px] font-bold text-text-primary">Sınıf Ligi</span>
                  </div>
                  <div className="px-2 py-2">
                    <StudentLeagueWidget groupId={student.groupId} groupCode={student.groupCode} light />
                  </div>
                </div>

                {/* Duyurular */}
                <div>
                <h2 className="text-[15px] font-bold text-text-primary mb-4">Duyurular</h2>
                {announcements.length === 0 ? (
                  <p className="text-[13px] text-surface-400">Duyuru yok.</p>
                ) : (
                  <div className="space-y-1">
                    {announcements.map((ann, i) => (
                      <button
                        key={ann.id}
                        onClick={() => setSelectedAnn(ann)}
                        className="w-full text-left flex gap-3 py-3 border-b border-surface-100 last:border-0 hover:bg-surface-50 rounded-xl px-2 transition-colors cursor-pointer"
                      >
                        <div className="flex flex-col items-center pt-1 shrink-0">
                          <div className="w-2 h-2 rounded-full bg-base-primary-300 shrink-0" />
                          {i < announcements.length - 1 && (
                            <div className="w-px flex-1 bg-surface-100 mt-1" />
                          )}
                        </div>
                        <div className="min-w-0 pb-2">
                          <p className="text-[12px] text-surface-400 font-medium mb-0.5">{ann.taskName}</p>
                          <p className="text-[13px] font-semibold text-text-primary leading-snug line-clamp-2">
                            {ann.text}
                          </p>
                          <p className="text-[11px] text-surface-400 mt-1">
                            {ann.authorName} · {fmtCreatedAt(ann.createdAt)}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                </div>
              </aside>

            </div>
          </div>
        </main>
      </div>

      {/* Duyuru detay modalı */}
      {selectedAnn && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSelectedAnn(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-3"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-[11px] font-bold text-surface-400 uppercase tracking-wider">{selectedAnn.taskName}</p>
            <p className="text-[15px] font-semibold text-text-primary leading-snug whitespace-pre-wrap">{selectedAnn.text}</p>
            <p className="text-[12px] text-surface-400">{selectedAnn.authorName} · {fmtCreatedAt(selectedAnn.createdAt)}</p>
            <button
              onClick={() => setSelectedAnn(null)}
              className="mt-2 w-full py-2 rounded-xl bg-surface-100 text-[13px] font-semibold text-text-secondary hover:bg-surface-200 transition-colors cursor-pointer"
            >
              Kapat
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Student Task Accordion ── */

function StudentTaskAccordion({
  task, sub, studentId, isActiveSection,
}: {
  task: TaskRow;
  sub: SubInfo | null;
  studentId: string;
  isActiveSection: boolean;
}) {
  const router          = useRouter();
  const [open, setOpen] = useState(false);
  const bodyRef         = useRef<HTMLDivElement>(null);
  const [bodyHeight, setBodyHeight] = useState(0);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBodyHeight(el.offsetHeight));
    ro.observe(el);
    setBodyHeight(el.offsetHeight);
    return () => ro.disconnect();
  }, []);

  const statusMeta = sub ? STATUS_META[sub.status] : null;

  const DESC_HEADING = task.subtitle || null;
  const DESC_BODY    = task.description || null;

  return (
    <div className="bg-white border border-surface-200 rounded-2xl overflow-hidden">

      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 cursor-pointer select-none hover:bg-surface-50/60 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
            isActiveSection ? "bg-designstudio-primary-500" : "bg-designstudio-secondary-500"
          }`}>
            <ClipboardList size={18} className="text-white" />
          </div>
          <span className="text-[16px] font-semibold text-text-primary">{task.name}</span>
        </div>

        <div className="flex items-center gap-3">
          {task.endDate && (
            <span className="text-[13px] text-surface-500">
              Teslim Tarihi: {fmtEndDate(task.endDate)}
            </span>
          )}
          {/* Öğrencinin durumu küçük badge (kapalıyken) */}
          {sub && !open && (
            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
              sub.status === "completed" ? "bg-status-success-100 text-status-success-700" :
              sub.status === "revision"  ? "bg-blue-50 text-status-info" :
              "bg-surface-100 text-surface-500"
            }`}>
              {STATUS_META[sub.status].label}
            </span>
          )}
          <ChevronDown
            size={16}
            className={`text-surface-500 transition-transform duration-[350ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${open ? "rotate-180" : ""}`}
          />
        </div>
      </div>

      {/* Accordion gövdesi */}
      <div style={{
        height: open ? bodyHeight : 0,
        overflow: "hidden",
        transition: "height 350ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}>
        <div ref={bodyRef}>
          <div className="h-px bg-surface-100" />

          <div className="p-6">

            {/* Eklenme tarihi */}
            {task.createdAt && (
              <p className="text-[13px] text-surface-500 mb-4">
                Eklenme Tarihi:&nbsp;
                <span className="font-semibold text-text-secondary">{fmtCreatedAt(task.createdAt)}</span>
              </p>
            )}

            {/* Açıklama (sol) + Öğrenci durumu (sağ) */}
            <div className="flex items-start gap-10 mb-5">

              {/* Sol: açıklama — %60 */}
              <div className="w-[60%] shrink-0 min-w-0">
                <p className="text-[18px] font-medium text-text-primary mb-2">{DESC_HEADING}</p>
                <p className="text-[14px] lg:text-[15px] xl:text-[16px] font-normal text-text-primary leading-relaxed whitespace-pre-line">
                  {DESC_BODY}
                </p>
              </div>

              {/* Sağ: öğrencinin kendi durumu — %40 */}
              <div className="flex-1 flex items-center justify-center py-4">
                {statusMeta ? (
                  <div className="flex flex-col items-center gap-3 text-center">
                    {statusMeta.icon}
                    <div>
                      <p className={`text-[18px] font-bold ${statusMeta.cls}`}>
                        {statusMeta.label}
                      </p>
                      {sub!.grade != null && (
                        <p className="text-[16px] font-bold text-base-primary-700 mt-1">
                          {sub!.grade} / 100
                        </p>
                      )}
                    </div>
                    {task.points > 0 && (
                      <p className="text-[12px] text-surface-400 font-medium">{task.points} puan</p>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-center">
                    <Clock size={44} strokeWidth={1.4} className="text-surface-300" />
                    <div>
                      <p className="text-[16px] font-semibold text-surface-400">Henüz Teslim Edilmedi</p>
                      {task.points > 0 && (
                        <p className="text-[12px] text-surface-400 mt-1">{task.points} puan</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Eğitmen adı */}
            {task.createdByName && (
              <p className="text-[14px] font-bold text-text-primary">{task.createdByName}</p>
            )}

            {/* Alt satır: dosya kartı (sol) + Ödev Yükle butonu (sağ) */}
            <div className="flex items-center justify-between mt-8">
              {/* Eğitmen dosya kartı */}
              {task.attachmentUrl ? (
                <a
                  href={task.attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-base-primary-50 border border-base-primary-100 rounded-xl hover:bg-base-primary-100 transition-colors px-4 py-3 max-w-[260px] group"
                >
                  <div className="w-10 h-10 rounded-lg bg-base-primary-100 flex items-center justify-center shrink-0">
                    <FileText size={18} className="text-base-primary-600" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-base-primary-700 leading-tight truncate">
                      {task.attachmentName || "Ödev Dosyası"}
                    </p>
                    <p className="text-[11px] text-base-primary-400 mt-0.5">Ödev Dosyası · İndir</p>
                  </div>
                </a>
              ) : (
                <div />
              )}

              {/* Ödev Detay butonu */}
              <button
                onClick={() => router.push(`/student/${studentId}/${task.id}`)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[14px] font-semibold text-white cursor-pointer transition-colors"
                style={{ backgroundColor: "#5E63C2" }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#4D52A6")}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#5E63C2")}
              >
                Ödev Yükle
                <ArrowRight size={15} strokeWidth={2.5} />
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
