"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { db, auth } from "@/app/lib/firebase";
import { collection, getDocs, doc, getDoc, query, where, updateDoc } from "firebase/firestore";
import { useUser } from "@/app/context/UserContext";
import Sidebar from "@/app/components/layout/Sidebar";
import Header from "@/app/components/layout/Header";
import SubmissionTable from "@/app/components/assignment-test/SubmissionTable";
import {
  ArrowLeft, Loader2, BookOpen, ClipboardList, MoreVertical,
  Search, Users, ChevronDown, Smile, Meh, RefreshCw, ArrowRight,
  Upload, ExternalLink, X, Plus, FileText,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Submission } from "@/app/types/submission";
import type { Task } from "@/app/components/dashboard/assignment/taskTypes";

type MainTab = "students" | "assignments" | "submissions";
type Filter  = "all" | "active" | "completed";

interface Student {
  id: string;
  name: string;
  lastName: string;
  points: number;
}

interface GroupInfo {
  code: string;
  session: string;
  branch: string;
  instructor: string;
  students: number;
}

interface SubmissionRow extends Submission {
  studentName: string;
}

type FirestoreDate = { toDate?: () => Date } | Date | string | number | null | undefined;

function parseDate(val: FirestoreDate): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === "string" || typeof val === "number") return new Date(val);
  if (typeof val === "object" && val.toDate) return val.toDate();
  return null;
}

function formatEndDate(dateVal: FirestoreDate) {
  const d = parseDate(dateVal);
  if (!d || isNaN(d.getTime())) return "";
  const datePart = d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  const weekday  = d.toLocaleDateString("tr-TR", { weekday: "short" });
  return `${datePart} ${weekday}.`;
}

function formatCreatedAt(createdAt: FirestoreDate): string {
  if (!createdAt) return "";
  const d: Date = parseDate(createdAt) ?? new Date();
  const day     = String(d.getDate()).padStart(2, "0");
  const month   = String(d.getMonth() + 1).padStart(2, "0");
  const year    = d.getFullYear();
  const weekday = d.toLocaleDateString("tr-TR", { weekday: "short" });
  return `${day}.${month}.${year} ${weekday}.`;
}

export default function GroupDetailPage() {
  const { user, loading: authLoading } = useUser();
  const router       = useRouter();
  const params       = useParams<{ groupId: string }>();
  const groupId      = params.groupId;
  const searchParams = useSearchParams();
  const defaultOpenTaskId = searchParams.get("taskId");

  const [tab,           setTab]           = useState<MainTab>("assignments");
  const [group,         setGroup]         = useState<GroupInfo | null>(null);
  const [students,      setStudents]      = useState<Student[]>([]);
  const [submissions,   setSubmissions]   = useState<SubmissionRow[]>([]);
  const [tasks,         setTasks]         = useState<Task[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [studentSearch, setStudentSearch] = useState("");

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || !groupId) return;
    loadData();
  }, [user, groupId]);

  async function loadData() {
    setLoading(true);
    try {
      // Grup bilgisi + öğrenciler her zaman yüklenir
      const [groupSnap, studentSnap] = await Promise.all([
        getDoc(doc(db, "groups", groupId)),
        getDocs(query(collection(db, "students"), where("groupId", "==", groupId))),
      ]);

      if (groupSnap.exists()) {
        const g = groupSnap.data();
        setGroup({ code: g.code, session: g.session, branch: g.branch, instructor: g.instructor, students: g.students });
      }

      // Submissions ve tasks — permission hatası olursa sessiz geç
      const [subSnap, taskSnap] = await Promise.all([
        getDocs(query(collection(db, "submissions"), where("groupId", "==", groupId))).catch(() => ({ docs: [] })),
        getDocs(query(collection(db, "tasks"),       where("groupId", "==", groupId))).catch(() => ({ docs: [] })),
      ]);

      const studentList: Student[] = studentSnap.docs.map(d => ({
        id: d.id, name: d.data().name ?? "", lastName: d.data().lastName ?? "", points: d.data().points ?? 0,
      }));
      setStudents(studentList);

      const studentMap: Record<string, string> = {};
      studentList.forEach(s => { studentMap[s.id] = `${s.name} ${s.lastName}`; });

      const subRows: SubmissionRow[] = subSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id, studentId: data.studentId, taskId: data.taskId, groupId: data.groupId,
          iteration: data.iteration ?? 1,
          file: {
            driveFileId: data.file?.driveFileId ?? "", driveViewLink: data.file?.driveViewLink ?? "",
            fileUrl: data.file?.fileUrl ?? "", fileName: data.file?.fileName ?? "",
            fileSize: data.file?.fileSize ?? 0, mimeType: data.file?.mimeType ?? "",
          },
          note: data.note, status: data.status, feedback: data.feedback,
          gradedBy: data.gradedBy, grade: data.grade, isLate: data.isLate ?? false,
          daysLate: data.daysLate,
          submittedAt: data.submittedAt?.toDate?.() ?? new Date(),
          reviewedAt:  data.reviewedAt?.toDate?.(),
          completedAt: data.completedAt?.toDate?.(),
          updatedAt:   data.updatedAt?.toDate?.() ?? new Date(),
          studentName: studentMap[data.studentId] ?? "—",
        };
      });
      setSubmissions(subRows);

      const taskList: Task[] = taskSnap.docs.map(d => ({ id: d.id, ...d.data() } as Task));
      setTasks(taskList);
    } finally {
      setLoading(false);
    }
  }

  const filteredStudents = students.filter(s =>
    `${s.name} ${s.lastName}`.toLowerCase().includes(studentSearch.toLowerCase())
  );

  if (authLoading || !user) return null;

  const TABS: { key: MainTab; label: string; icon: React.ReactNode }[] = [
    { key: "students",    label: "Öğrenciler",   icon: <Users size={16} /> },
    { key: "assignments", label: "Ödevler",       icon: <BookOpen size={16} /> },
    { key: "submissions", label: "Teslim Panosu", icon: <ClipboardList size={16} /> },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-white font-inter antialiased text-text-primary">
      <aside className="hidden lg:block h-full shrink-0 z-50 w-[280px] 2xl:w-[320px] bg-base-primary-900">
        <Sidebar />
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-full">
        <Header />

        <main className="flex-1 overflow-y-auto overflow-x-clip [scrollbar-gutter:stable]">
          <div className="w-[94%] mx-auto pt-7 pb-12 max-w-[960px] xl:max-w-[1200px] 2xl:max-w-[1480px]">

            {/* Başlık satırı */}
            <div className="flex items-end justify-between mb-7">

              <div className="flex items-end">
                {/* Geri + grup bilgisi */}
                <div className="flex items-center gap-4 mr-24">
                  <button
                    onClick={() => router.push("/dashboard/assignment")}
                    className="w-10 h-10 rounded-[13px] bg-surface-200 hover:bg-surface-300 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  >
                    <ArrowLeft size={18} className="text-surface-700" />
                  </button>
                  <div>
                    {(group?.branch || group?.session) && (
                      <p className="text-[12px] font-medium text-surface-400">
                        {group.branch ? `${group.branch} Şb.` : ""}{group.branch && group.session ? " • " : ""}{group?.session ?? ""}
                      </p>
                    )}
                    <h1 className="text-[22px] font-bold text-base-primary-900 leading-tight">
                      {group?.code ?? ""}
                    </h1>
                  </div>
                </div>

                {/* Tab grubu */}
                <div className="flex items-center border-b border-surface-200">
                  {TABS.map(t => (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key)}
                      className={`flex items-center gap-2 px-5 py-2.5 text-[14px] font-semibold border-b-2 -mb-px transition-colors cursor-pointer
                        ${tab === t.key
                          ? "border-base-primary-600 text-base-primary-600 [&>svg]:text-base-primary-600"
                          : "border-transparent text-text-secondary hover:text-text-primary [&>svg]:text-text-secondary"
                        }`}
                    >
                      {t.icon}
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sağ: öğrenci sayısı */}
              <p className="pb-2.5 text-[14px] text-text-secondary">
                Toplam: {group?.students ?? 0} Öğrenci
              </p>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-24 text-surface-400">
                <Loader2 size={22} className="animate-spin" />
              </div>
            ) : (
              <>
                {/* TAB: Ödevler */}
                {tab === "assignments" && (
                  <AssignmentsTab
                    tasks={tasks}
                    submissions={submissions}
                    totalStudents={group?.students ?? 0}
                    groupId={groupId}
                    defaultOpenTaskId={defaultOpenTaskId ?? undefined}
                  />
                )}

                {/* TAB: Öğrenciler */}
                {tab === "students" && (
                  <div className="space-y-3">
                    <div className="relative max-w-xs">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                      <input
                        value={studentSearch}
                        onChange={e => setStudentSearch(e.target.value)}
                        placeholder="Öğrenci ara..."
                        className="w-full pl-9 pr-4 h-9 rounded-xl border border-surface-200 bg-white text-[13px] text-text-primary outline-none focus:border-base-primary-400 transition-colors"
                      />
                    </div>
                    <div className="border border-surface-200 rounded-2xl overflow-hidden bg-white">
                      {filteredStudents.length === 0 ? (
                        <div className="py-10 text-center text-[13px] text-surface-400">Öğrenci bulunamadı</div>
                      ) : (
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-surface-100 bg-surface-50">
                              <th className="px-5 py-3 text-[12px] font-bold text-surface-500">Ad Soyad</th>
                              <th className="px-5 py-3 text-[12px] font-bold text-surface-500 text-right">Puan</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredStudents.map(s => (
                              <tr key={s.id} className="border-b border-surface-50 last:border-0 hover:bg-surface-50/50 transition-colors">
                                <td className="px-5 py-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-base-primary-100 flex items-center justify-center text-[12px] font-black text-base-primary-600">
                                      {s.name[0]}{s.lastName[0]}
                                    </div>
                                    <span className="text-[13px] font-bold text-text-primary">{s.name} {s.lastName}</span>
                                  </div>
                                </td>
                                <td className="px-5 py-3 text-right">
                                  <span className="text-[14px] font-black text-base-primary-700">{s.points}</span>
                                  <span className="text-[11px] text-surface-400 ml-1">puan</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB: Teslim Panosu */}
                {tab === "submissions" && (
                  <SubmissionTable
                    rows={submissions}
                    basePath={`/dashboard/assignment/${groupId}/submissions`}
                  />
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

/* ── Ödevler Tab ─────────────────────────────────────────────── */

function AssignmentsTab({
  tasks, submissions, totalStudents, groupId, defaultOpenTaskId,
}: {
  tasks: Task[];
  submissions: SubmissionRow[];
  totalStudents: number;
  groupId: string;
  defaultOpenTaskId?: string;
}) {
  const [filter,             setFilter]             = useState<Filter>("all");
  const [activeUploadTaskId, setActiveUploadTaskId] = useState<string | null>(null);

  const today          = new Date(); today.setHours(0, 0, 0, 0);
  // Aktif: deadline yakın olan en üstte
  const activeTasks    = tasks
    .filter(t => { const d = parseDate(t.endDate); return d ? d >= today : false; })
    .sort((a, b) => (parseDate(b.createdAt)?.getTime() ?? 0) - (parseDate(a.createdAt)?.getTime() ?? 0));

  const completedTasks = tasks
    .filter(t => { const d = parseDate(t.endDate); return !d || d < today; })
    .sort((a, b) => (parseDate(b.createdAt)?.getTime() ?? 0) - (parseDate(a.createdAt)?.getTime() ?? 0));

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all",       label: "Tümü" },
    { key: "active",    label: "Aktif Ödevler" },
    { key: "completed", label: "Tamamlananlar" },
  ];

  const showActive    = filter === "all" || filter === "active";
  const showCompleted = filter === "all" || filter === "completed";

  return (
    <div>
      {/* Pembe banner */}
      <div className="w-full rounded-2xl mb-6" style={{ height: 220, backgroundColor: "#F91079" }} />

      {/* Filtre pilleri */}
      <div className="flex items-center gap-2 mb-7">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-1.5 rounded-full text-[13px] border transition-colors cursor-pointer
              ${filter === f.key
                ? "bg-white border-surface-300 text-text-primary font-semibold shadow-sm"
                : "bg-transparent border-surface-200 text-surface-500 font-medium hover:border-surface-300 hover:text-surface-700"
              }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Aktif Ödevler */}
      {showActive && activeTasks.length > 0 && (
        <section className="mb-8">
          <h2 className="text-[15px] sm:text-[18px] font-bold text-text-primary mb-3">Aktif Ödevler</h2>
          <div className="space-y-3">
            {activeTasks.map(task => (
              <TaskAccordion
                key={task.id}
                task={task}
                submissions={submissions.filter(s => s.taskId === task.id)}
                totalStudents={totalStudents}
                groupId={groupId}
                isActiveSection={true}
                defaultOpen={task.id === defaultOpenTaskId}
                activeUploadTaskId={activeUploadTaskId}
                setActiveUploadTaskId={setActiveUploadTaskId}
              />
            ))}
          </div>
        </section>
      )}

      {/* Tamamlananlar */}
      {showCompleted && completedTasks.length > 0 && (
        <section>
          <h2 className="text-[15px] sm:text-[18px] font-bold text-text-primary mb-3">Tamamlananlar</h2>
          <div className="space-y-3">
            {completedTasks.map(task => (
              <TaskAccordion
                key={task.id}
                task={task}
                submissions={submissions.filter(s => s.taskId === task.id)}
                totalStudents={totalStudents}
                groupId={groupId}
                isActiveSection={false}
                defaultOpen={task.id === defaultOpenTaskId}
                activeUploadTaskId={activeUploadTaskId}
                setActiveUploadTaskId={setActiveUploadTaskId}
              />
            ))}
          </div>
        </section>
      )}

      {tasks.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-16 text-surface-400">
          <BookOpen size={22} />
          <p className="text-[13px] font-medium">Bu gruba ait ödev yok</p>
        </div>
      )}
    </div>
  );
}

/* ── Accordion Kart ──────────────────────────────────────────── */

function TaskAccordion({
  task, submissions, totalStudents, groupId, isActiveSection, defaultOpen = false,
  activeUploadTaskId, setActiveUploadTaskId,
}: {
  task: Task;
  submissions: SubmissionRow[];
  totalStudents: number;
  groupId: string;
  isActiveSection: boolean;
  defaultOpen?: boolean;
  activeUploadTaskId: string | null;
  setActiveUploadTaskId: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  // Öğrenci başına en son teslim (iteration en yüksek)
  const latestByStudent = new Map<string, SubmissionRow>();
  for (const s of submissions) {
    const cur = latestByStudent.get(s.studentId);
    if (!cur || (s.iteration ?? 0) > (cur.iteration ?? 0)) {
      latestByStudent.set(s.studentId, s);
    }
  }
  const uniqueSubs    = [...latestByStudent.values()];
  const teslimEdenler = uniqueSubs.filter(s => s.status !== "revision").length;
  const revize        = uniqueSubs.filter(s => s.status === "revision").length;
  const bekleyenler   = Math.max(0, totalStudents - latestByStudent.size);

  const descHeading = task.subtitle || null;
  const descBody    = task.description || null;

  const uploadActive   = activeUploadTaskId === task.id;
  const dropHandlerRef = useRef<((files: FileList) => void) | null>(null);
  const wrapperRef     = useRef<HTMLDivElement>(null);
  const innerRef       = useRef<HTMLDivElement>(null);

  const setDragStyle = (on: boolean) => {
    if (!wrapperRef.current || !innerRef.current) return;
    wrapperRef.current.style.boxShadow = on
      ? "0 0 0 3px #6366f1, 0 0 0 6px rgba(99,102,241,0.15)"
      : "";
    innerRef.current.style.borderColor = on ? "#6366f1" : "";
  };

  // uploadActive false olunca DOM glowu temizle (başka accordion açıldığında)
  useEffect(() => {
    if (!uploadActive) setDragStyle(false);
  }, [uploadActive]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={wrapperRef}
      className="rounded-2xl"
      onDragEnter={(e) => {
        if (!uploadActive) return;  // Panel kapalıysa tamamen yok say
        e.preventDefault();
        setDragStyle(true);
      }}
      onDragOver={(e) => {
        if (!uploadActive) return;
        e.preventDefault();
      }}
      onDragLeave={(e) => {
        if (!uploadActive) return;
        if (e.clientX === 0 && e.clientY === 0) return;
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const inside =
          e.clientX > rect.left && e.clientX < rect.right &&
          e.clientY > rect.top  && e.clientY < rect.bottom;
        if (!inside) setDragStyle(false);
      }}
      onDrop={(e) => {
        if (!uploadActive) return;
        e.preventDefault();
        setDragStyle(false);
        if (e.dataTransfer.files.length) dropHandlerRef.current?.(e.dataTransfer.files);
      }}
    >
    <div ref={innerRef} className="bg-white border border-surface-200 rounded-2xl overflow-hidden transition-colors duration-150">

      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 cursor-pointer select-none hover:bg-surface-50/60 transition-colors"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (!next) {
            setDragStyle(false);
            setActiveUploadTaskId(prev => prev === task.id ? null : prev);
          }
        }}
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className={`w-7 h-7 sm:w-9 sm:h-9 rounded-full flex items-center justify-center shrink-0 ${isActiveSection ? "bg-designstudio-primary-500" : "bg-designstudio-secondary-500"}`}>
            <ClipboardList size={14} className="text-text-inverse sm:hidden" />
            <ClipboardList size={18} className="text-text-inverse hidden sm:block" />
          </div>
          <span className="text-[13px] sm:text-[15px] lg:text-[16px] font-semibold text-text-primary truncate">{task.name}</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {task.endDate && (
            <span className="hidden sm:block text-[12px] sm:text-[13px] text-surface-500">
              Teslim: {formatEndDate(task.endDate)}
            </span>
          )}
          <ChevronDown
            size={15}
            className={`text-surface-500 transition-transform duration-[320ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${open ? "rotate-180" : ""}`}
          />
          <button
            onClick={e => e.stopPropagation()}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-surface-400 hover:bg-surface-100 hover:text-surface-600 transition-colors cursor-pointer"
          >
            <MoreVertical size={14} />
          </button>
        </div>
      </div>

      {/* Accordion gövdesi */}
      <div
        style={{
          display: "grid",
          gridTemplateRows: open ? "1fr" : "0fr",
          transition: "grid-template-rows 320ms cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <div style={{ overflow: "hidden", minHeight: 0 }}>
          <div className="h-px bg-surface-100" />

          <div className="p-4 sm:p-6">

            {/* Satır 1: Eklenme tarihi */}
            {task.createdAt && (
              <p className="text-[11px] sm:text-[13px] text-surface-500 mb-3 sm:mb-4">
                Eklenme Tarihi:&nbsp;
                <span className="font-semibold text-text-secondary">{formatCreatedAt(task.createdAt)}</span>
              </p>
            )}

            {/* Satır 2: Açıklama (sol) + Stats (sağ) */}
            <div className="flex flex-col md:flex-row items-start gap-5 md:gap-10 mb-4 sm:mb-5">

              {/* Sol: açıklama metni */}
              <div className="w-full md:w-[60%] shrink-0 min-w-0">
                {descHeading ? (
                  <p className="text-[14px] sm:text-[16px] md:text-[18px] font-medium text-text-primary mb-1.5 sm:mb-2">{descHeading}</p>
                ) : null}
                {descBody ? (
                  <p className="text-[12px] sm:text-[13px] lg:text-[14px] xl:text-[15px] font-normal text-text-primary leading-relaxed whitespace-pre-line">
                    {descBody}
                  </p>
                ) : null}
              </div>

              {/* Sağ: 3 stat blok */}
              <div className="w-full md:flex-1 flex items-center justify-start md:justify-center gap-5 sm:gap-7 md:gap-10">
                <StatBlock
                  icon={<Smile size={24} strokeWidth={1.5} className="text-emerald-500 sm:hidden" />}
                  iconLg={<Smile size={32} strokeWidth={1.5} className="text-emerald-500 hidden sm:block" />}
                  label="Teslim Edenler"
                  count={teslimEdenler}
                />
                <StatBlock
                  icon={<Meh size={24} strokeWidth={1.5} className="text-surface-500 sm:hidden" />}
                  iconLg={<Meh size={32} strokeWidth={1.5} className="text-surface-500 hidden sm:block" />}
                  label="Bekleyenler"
                  count={bekleyenler}
                />
                <StatBlock
                  icon={<RefreshCw size={24} strokeWidth={1.5} className="text-designstudio-primary-500 sm:hidden" />}
                  iconLg={<RefreshCw size={32} strokeWidth={1.5} className="text-designstudio-primary-500 hidden sm:block" />}
                  label="Revize İstenenler"
                  count={revize}
                />
              </div>
            </div>

            {/* Satır 3: Eğitmen adı */}
            {task.createdByName && (
              <p className="text-[12px] sm:text-[14px] font-bold text-text-primary">{task.createdByName}</p>
            )}

            {/* Satır 4: Dosya alanı (sol) + Ödev Detay butonu (sağ) */}
            <div className="flex flex-wrap items-end justify-between gap-3 mt-5 sm:mt-8">
              {/* Dosya yönetimi */}
              <AttachmentManager
                taskId={task.id}
                initialAttachments={task.attachments}
                initialUrl={task.attachmentUrl}
                initialName={task.attachmentName}
                initialType={task.attachmentType}
                groupName={task.classId}
                instructorName={task.createdByName}
                taskName={task.name}
                dropHandlerRef={dropHandlerRef}
                onExpandChange={(open) => {
                  if (open) {
                    setActiveUploadTaskId(task.id);
                  } else {
                    setDragStyle(false);
                    setActiveUploadTaskId(prev => prev === task.id ? null : prev);
                  }
                }}
                isUploadActive={uploadActive}
              />

              {/* Teslim Durumu butonu */}
              <button
                onClick={() => router.push(`/dashboard/assignment/${groupId}/${task.id}`)}
                className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-[12px] sm:text-[14px] font-semibold text-white cursor-pointer transition-colors"
                style={{ backgroundColor: "#5E63C2" }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#4D52A6")}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#5E63C2")}
              >
                Teslim Durumu
                <ArrowRight size={13} strokeWidth={2.5} className="sm:hidden" />
                <ArrowRight size={15} strokeWidth={2.5} className="hidden sm:block" />
              </button>
            </div>

            {/* Hint */}
            <p className="mt-3 text-[11px] text-surface-400 select-none">
              Dosya eklemek için{" "}
              <span className="font-semibold text-surface-500">Dosya Yükle</span>
              {" "}butonuna bas veya kartın üzerine sürükle bırak.
            </p>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}

function StatBlock({ icon, iconLg, label, count }: { icon: React.ReactNode; iconLg?: React.ReactNode; label: string; count: number }) {
  return (
    <div className="flex flex-col items-center">
      {icon}
      {iconLg}
      <p className="mt-1 text-[11px] sm:text-[13px] xl:text-[14px] font-medium text-text-primary text-center leading-tight">{label}</p>
      <p className="mt-1 sm:mt-2 text-[22px] sm:text-[28px] lg:text-[32px] font-bold text-text-secondary leading-none">{count}</p>
    </div>
  );
}

/* ── Attachment Manager (eğitmen ödev dosyası yönetimi) ──────── */

type AttachmentItem = { url: string; name: string; type: "upload" | "drive" };

function AttachmentManager({
  taskId, initialAttachments, initialUrl, initialName, initialType,
  groupName, instructorName, taskName, dropHandlerRef, onExpandChange, isUploadActive,
}: {
  taskId: string;
  initialAttachments?: AttachmentItem[];
  initialUrl?: string;
  initialName?: string;
  initialType?: string;
  groupName?: string;
  instructorName?: string;
  taskName?: string;
  dropHandlerRef?: React.MutableRefObject<((files: FileList) => void) | null>;
  onExpandChange?: (open: boolean) => void;
  isUploadActive?: boolean;
}) {
  const initItems: AttachmentItem[] = initialAttachments?.length
    ? initialAttachments
    : initialUrl
      ? [{ url: initialUrl, name: initialName ?? "Ödev Dosyası", type: (initialType ?? "upload") as "upload" | "drive" }]
      : [];

  const [items,          setItems]          = useState<AttachmentItem[]>(initItems);
  const [expanding,      setExpanding]      = useState(false);
  const [driveMode,      setDriveMode]      = useState(false);
  const [dragOver,       setDragOver]       = useState(false);
  const [uploading,      setUploading]      = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [driveLink,      setDriveLink]      = useState("");
  const [driveName,      setDriveName]      = useState("");
  const [error,          setError]          = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasFiles = items.length > 0;

  // Accordion-level drag handler'ı her render'da güncelle (stale closure yok)
  useEffect(() => {
    if (dropHandlerRef) dropHandlerRef.current = (files) => void handleFiles(files);
  });

  // Başka accordion aktif olunca paneli kapat
  useEffect(() => {
    if (!isUploadActive && expanding) {
      setExpanding(false);
      setDriveMode(false);
      setError("");
    }
  }, [isUploadActive]);

  const saveAll = async (next: AttachmentItem[]) => {
    await updateDoc(doc(db, "tasks", taskId), {
      attachments: next,
      attachmentType: null, attachmentUrl: null, attachmentName: null,
    });
    setItems(next);
  };

  const uploadOne = async (file: File): Promise<AttachmentItem> => {
    const CHUNK_SIZE = 262144;
    const buffer     = await file.arrayBuffer();
    const bytes      = new Uint8Array(buffer);
    const totalBytes = bytes.byteLength;
    const mimeType   = file.type || "application/octet-stream";
    const segments   = ["Gruplar"];
    if (groupName)      segments.push(groupName);
    segments.push("Eğitmen");
    if (instructorName) segments.push(instructorName);
    if (taskName)       segments.push(taskName);

    const initToken = await auth.currentUser?.getIdToken();
    const initRes   = await fetch("/api/instructor/init-file-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${initToken ?? ""}` },
      body: JSON.stringify({ fileName: file.name, fileSize: totalBytes, mimeType, folderPath: segments }),
    });
    if (!initRes.ok) { const e = await initRes.json().catch(() => ({})) as { error?: string }; throw new Error(e.error ?? "Yükleme başlatılamadı"); }
    const { uploadId } = await initRes.json() as { uploadId: string };

    const totalChunks = Math.ceil(totalBytes / CHUNK_SIZE);
    let driveFileId: string | null = null;
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end   = Math.min(start + CHUNK_SIZE, totalBytes);
      const chunkToken = await auth.currentUser?.getIdToken();
      const chunkRes   = await fetch("/api/submissions/upload-chunk", {
        method: "POST",
        headers: { Authorization: `Bearer ${chunkToken ?? ""}`, "x-upload-id": uploadId, "content-range": `bytes ${start}-${end - 1}/${totalBytes}`, "x-file-type": mimeType },
        body: bytes.slice(start, end),
      });
      if (!chunkRes.ok) { const e = await chunkRes.json().catch(() => ({})) as { error?: string }; throw new Error(e.error ?? "Chunk hatası"); }
      const cd = await chunkRes.json() as { driveFileId?: string };
      if (cd.driveFileId) driveFileId = cd.driveFileId;
      setUploadProgress(Math.round((end / totalBytes) * 90));
    }

    setUploadProgress(95);
    const completeToken = await auth.currentUser?.getIdToken();
    const completeRes   = await fetch("/api/instructor/complete-file-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${completeToken ?? ""}` },
      body: JSON.stringify({ uploadId, driveFileId }),
    });
    if (!completeRes.ok) { const e = await completeRes.json().catch(() => ({})) as { error?: string }; throw new Error(e.error ?? "Tamamlama hatası"); }
    const data = await completeRes.json() as { webViewLink: string; fileName: string };
    setUploadProgress(100);
    return { url: data.webViewLink, name: data.fileName, type: "upload" };
  };

  const handleFiles = async (fileList: FileList | File[]) => {
    const arr = Array.from(fileList);
    if (!arr.length) return;
    setUploading(true);
    setError("");
    try {
      // Sıralı yükleme — race condition önleme (ensureFolderPath thread-safe değil)
      const newItems: AttachmentItem[] = [];
      for (const file of arr) newItems.push(await uploadOne(file));
      await saveAll([...items, ...newItems]);
      setExpanding(false);
      setDriveMode(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Yükleme başarısız");
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    e.target.value = "";
    void handleFiles(files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    void handleFiles(e.dataTransfer.files);
  };

  const handleDriveSave = async () => {
    const url = driveLink.trim();
    if (!url) return;
    await saveAll([...items, { url, name: driveName.trim() || "Google Drive Dosyası", type: "drive" }]);
    setExpanding(false);
    setDriveMode(false);
    setDriveLink("");
    setDriveName("");
  };

  const handleRemove = (idx: number) => void saveAll(items.filter((_, i) => i !== idx));

  const toggleExpand = () => {
    const next = !expanding;
    setExpanding(next);
    onExpandChange?.(next);
    if (!next) { setDriveMode(false); setError(""); }
  };

  return (
    <div className="flex items-center flex-wrap gap-2">
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />

      {/* ── Buton + panel + chip'ler — tek satırda, flex-wrap ile doğal kırılma ── */}

      {/* Tetikleyici buton */}
      <button
        onClick={toggleExpand}
        disabled={uploading}
        style={hasFiles ? {
          height: 44, width: 44, flexShrink: 0,
          borderRadius: 12,
          border: `1px solid ${expanding ? "#6366f1" : "#a5b4fc"}`,
          backgroundColor: expanding ? "#6366f1" : "#eef2ff",
          color: expanding ? "#ffffff" : "#4f46e5",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "background-color 150ms, border-color 150ms, color 150ms",
          cursor: "pointer",
        } : { height: 44, flexShrink: 0 }}
        className={`transition-colors duration-150 cursor-pointer disabled:opacity-50
          ${!hasFiles
            ? `flex items-center gap-2 px-4 rounded-xl border border-dashed
               ${expanding
                 ? "border-base-primary-400 bg-base-primary-50 text-base-primary-600"
                 : "border-surface-300 bg-white text-surface-400 hover:border-base-primary-300 hover:text-base-primary-500"
               }`
            : ""
          }`}
      >
        <motion.span
          animate={{ rotate: expanding ? 45 : 0 }}
          transition={{ type: "tween", duration: 0.18, ease: "easeInOut" }}
          className="flex items-center justify-center"
        >
          <Plus size={14} strokeWidth={2.5} />
        </motion.span>
        {!hasFiles && (
          <span className="text-[13px] font-semibold leading-none">Dosya Yükle</span>
        )}
      </button>

      {/* Sağa kayan panel — tween, overshoot yok */}
      <AnimatePresence>
        {expanding && (
          <motion.div
            key="upload-panel"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 290, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: "tween", duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            style={{ height: 44, overflow: "hidden", flexShrink: 0 }}
          >
            {uploading ? (
              <div style={{ height: 44, minWidth: 180 }} className="flex flex-col justify-center px-4 border border-surface-200 rounded-xl bg-white whitespace-nowrap">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[11px] font-semibold text-surface-400">
                    {uploadProgress < 90 ? "Yükleniyor" : uploadProgress < 100 ? "Tamamlanıyor" : "Bitti"}
                  </span>
                  <span className="text-[11px] font-bold text-surface-600">{uploadProgress}%</span>
                </div>
                <div className="h-[3px] rounded-full bg-surface-100 overflow-hidden">
                  <div className="h-full rounded-full bg-base-primary-500 transition-[width] duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            ) : driveMode ? (
              <div style={{ height: 44 }} className="flex items-center gap-2 w-full">
                <input
                  value={driveLink}
                  onChange={e => setDriveLink(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") void handleDriveSave(); }}
                  placeholder="Google Drive linki..."
                  autoFocus
                  style={{ height: 44 }}
                  className="flex-1 min-w-0 px-3 rounded-xl border border-surface-200 text-[12px] outline-none focus:border-base-primary-400 transition-colors bg-white"
                />
                <button
                  onClick={() => void handleDriveSave()}
                  disabled={!driveLink.trim()}
                  style={{ height: 44, flexShrink: 0 }}
                  className="px-3 bg-base-primary-700 text-white text-[12px] font-bold rounded-xl disabled:opacity-40 cursor-pointer hover:bg-base-primary-800 transition-colors whitespace-nowrap"
                >
                  Ekle
                </button>
                <button
                  onClick={() => { setDriveMode(false); setDriveLink(""); setDriveName(""); }}
                  style={{ height: 44, width: 44, flexShrink: 0 }}
                  className="flex items-center justify-center bg-surface-100 text-surface-500 rounded-xl cursor-pointer hover:bg-surface-200 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false); }}
                onDrop={handleDrop}
                style={{ height: 44 }}
                className={`w-full flex items-center gap-1 px-2 border border-dashed rounded-xl transition-colors whitespace-nowrap
                  ${dragOver ? "border-base-primary-400 bg-base-primary-50" : "border-surface-300 bg-white"}`}
              >
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="h-full flex items-center gap-2 px-3 rounded-lg text-[12px] font-semibold text-text-secondary hover:bg-surface-100 transition-colors cursor-pointer"
                >
                  <Upload size={13} className="text-surface-400 shrink-0" />
                  {dragOver ? "Bırakın..." : "Bilgisayardan Yükle"}
                </button>
                <div className="w-px h-5 bg-surface-200 shrink-0" />
                <button
                  onClick={() => setDriveMode(true)}
                  className="h-full flex items-center gap-2 px-3 rounded-lg text-[12px] font-semibold text-text-secondary hover:bg-surface-100 transition-colors cursor-pointer"
                >
                  <img src="/icons/google-drive.svg" width={13} height={13} alt="" className="shrink-0" />
                  Google Drive
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {items.map((a, idx) => (
        <div key={idx} style={{ height: 44 }} className="flex items-center gap-2 bg-white border border-surface-200 rounded-xl px-3 max-w-[240px]">
          {a.type === "drive"
            ? <img src="/icons/google-drive.svg" width={13} height={13} alt="" className="shrink-0" />
            : <FileText size={13} className="text-surface-400 shrink-0" />
          }
          <span className="text-[12px] font-semibold text-text-primary truncate">{a.name}</span>
          <a href={a.url} target="_blank" rel="noopener noreferrer"
            className="p-0.5 text-surface-300 hover:text-base-primary-600 transition-colors shrink-0 ml-auto">
            <ExternalLink size={12} />
          </a>
          <button onClick={() => handleRemove(idx)}
            className="p-0.5 text-surface-300 hover:text-status-danger-500 transition-colors cursor-pointer shrink-0">
            <X size={12} />
          </button>
        </div>
      ))}

      {/* Hata mesajı */}
      {error && <p className="w-full text-[11px] text-status-danger-500">{error}</p>}
    </div>
  );
}
