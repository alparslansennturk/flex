"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/app/lib/firebase";
import { collection, getDocs, doc, getDoc, query, where, updateDoc } from "firebase/firestore";
import { useUser } from "@/app/context/UserContext";
import Sidebar from "@/app/components/layout/Sidebar";
import Header from "@/app/components/layout/Header";
import SubmissionTable from "@/app/components/assignment-test/SubmissionTable";
import {
  ArrowLeft, Loader2, BookOpen, ClipboardList, MoreVertical,
  Search, Users, ChevronDown, Smile, Meh, RefreshCw, ArrowRight,
  Upload, ExternalLink, X,
} from "lucide-react";
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

function parseDate(val: any): Date | null {
  if (!val) return null;
  if (val?.toDate) return val.toDate();           // Firestore Timestamp
  if (typeof val === "string" || typeof val === "number") return new Date(val);
  return null;
}

function formatEndDate(dateVal: any) {
  const d = parseDate(dateVal);
  if (!d || isNaN(d.getTime())) return "";
  const datePart = d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  const weekday  = d.toLocaleDateString("tr-TR", { weekday: "short" });
  return `${datePart} ${weekday}.`;
}

function formatCreatedAt(createdAt: any): string {
  if (!createdAt) return "";
  const d: Date = createdAt?.toDate?.() ?? new Date(createdAt);
  const day     = String(d.getDate()).padStart(2, "0");
  const month   = String(d.getMonth() + 1).padStart(2, "0");
  const year    = d.getFullYear();
  const weekday = d.toLocaleDateString("tr-TR", { weekday: "short" });
  return `${day}.${month}.${year} ${weekday}.`;
}

export default function GroupDetailPage() {
  const { user, loading: authLoading } = useUser();
  const router  = useRouter();
  const params  = useParams<{ groupId: string }>();
  const groupId = params.groupId;

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
                    onClick={() => router.push("/dashboard/assignment-test")}
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
                    basePath={`/dashboard/assignment-test/${groupId}/submissions`}
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
  tasks, submissions, totalStudents, groupId,
}: {
  tasks: Task[];
  submissions: SubmissionRow[];
  totalStudents: number;
  groupId: string;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const today          = new Date(); today.setHours(0, 0, 0, 0);
  // Aktif: deadline yakın olan en üstte
  const activeTasks    = tasks
    .filter(t => { const d = parseDate(t.endDate); return d ? d >= today : false; })
    .sort((a, b) => (parseDate(a.endDate)?.getTime() ?? 0) - (parseDate(b.endDate)?.getTime() ?? 0));

  // Tamamlananlar: en son biten (en yakın geçmiş deadline) en üstte
  const completedTasks = tasks
    .filter(t => { const d = parseDate(t.endDate); return !d || d < today; })
    .sort((a, b) => (parseDate(b.endDate)?.getTime() ?? 0) - (parseDate(a.endDate)?.getTime() ?? 0));

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
  task, submissions, totalStudents, groupId, isActiveSection,
}: {
  task: Task;
  submissions: SubmissionRow[];
  totalStudents: number;
  groupId: string;
  isActiveSection: boolean;
}) {
  const router        = useRouter();
  const [open, setOpen] = useState(false);

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

  return (
    <div className="bg-white border border-surface-200 rounded-2xl overflow-hidden">

      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 cursor-pointer select-none hover:bg-surface-50/60 transition-colors"
        onClick={() => setOpen(v => !v)}
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
            <div className="flex flex-wrap items-center justify-between gap-3 mt-5 sm:mt-8">
              {/* Dosya yönetimi */}
              <AttachmentManager
                taskId={task.id}
                initialUrl={task.attachmentUrl}
                initialName={task.attachmentName}
                initialType={task.attachmentType}
                groupName={task.classId}
                instructorName={task.createdByName}
                taskName={task.name}
              />

              {/* Ödev Detay butonu */}
              <button
                onClick={() => router.push(`/dashboard/assignment-test/${groupId}/${task.id}`)}
                className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-[12px] sm:text-[14px] font-semibold text-white cursor-pointer transition-colors"
                style={{ backgroundColor: "#5E63C2" }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#4D52A6")}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#5E63C2")}
              >
                Ödev Detay
                <ArrowRight size={13} strokeWidth={2.5} className="sm:hidden" />
                <ArrowRight size={15} strokeWidth={2.5} className="hidden sm:block" />
              </button>
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

function AttachmentManager({ taskId, initialUrl, initialName, initialType, groupName, instructorName, taskName }: {
  taskId: string;
  initialUrl?: string;
  initialName?: string;
  initialType?: string;
  groupName?: string;
  instructorName?: string;
  taskName?: string;
}) {
  const [attachment, setAttachment] = useState<{ url: string; name: string; type: string } | null>(
    initialUrl ? { url: initialUrl, name: initialName ?? "Ödev Dosyası", type: initialType ?? "upload" } : null
  );
  const [mode,      setMode]      = useState<"idle" | "choosing" | "drive">("idle");
  const [driveLink, setDriveLink] = useState<string>("");
  const [driveName, setDriveName] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const save = async (type: string, url: string, name: string) => {
    await updateDoc(doc(db, "tasks", taskId), { attachmentType: type, attachmentUrl: url, attachmentName: name });
    setAttachment({ url, name, type });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setMode("idle");
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      // Klasör hiyerarşisi: gruplar / [grup] / [eğitmen] / [ödev adı]
      const segments = ["gruplar"];
      if (groupName)     segments.push(groupName);
      if (instructorName) segments.push(instructorName);
      if (taskName)      segments.push(taskName);
      fd.append("folderPath", JSON.stringify(segments));
      const res  = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json() as { webViewLink?: string; fileName?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Yükleme başarısız");
      await save("upload", data.webViewLink!, data.fileName ?? file.name);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Yükleme başarısız");
    } finally {
      setUploading(false);
    }
  };

  const handleDriveSave = async () => {
    const url = driveLink.trim();
    if (!url) return;
    const name = driveName.trim() || "Google Drive Dosyası";
    await save("drive", url, name);
    setMode("idle");
    setDriveLink("");
    setDriveName("");
  };

  const handleRemove = async () => {
    await updateDoc(doc(db, "tasks", taskId), { attachmentType: null, attachmentUrl: null, attachmentName: null });
    setAttachment(null);
  };

  /* Tek return — erken return yapma, React DOM reconciliation sorununu önler */
  return (
    <div>
      {/* Gizli dosya input — her zaman aynı pozisyonda */}
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />

      {/* Var olan dosya kartı */}
      {attachment && (
        <div className="flex items-center bg-white border border-surface-200 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 gap-2.5">
          <div>
            <p className="text-[12px] sm:text-[13px] font-bold text-text-primary leading-tight truncate max-w-[160px]">
              {attachment.name}
            </p>
            <p className="text-[10px] sm:text-[11px] text-surface-500 mt-0.5">Ödev Dosyası</p>
          </div>
          <div className="w-px self-stretch bg-surface-200 mx-2" />
          <a href={attachment.url} target="_blank" rel="noopener noreferrer"
            className="text-surface-400 hover:text-base-primary-600 transition-colors p-1">
            <ExternalLink size={16} />
          </a>
          <button onClick={handleRemove}
            className="text-surface-300 hover:text-status-danger-500 transition-colors cursor-pointer p-1">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Yükleniyor */}
      {!attachment && uploading && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-white border border-surface-200 rounded-xl text-surface-400">
          <Loader2 size={14} className="animate-spin" />
          <span className="text-[12px] font-medium">Yükleniyor...</span>
        </div>
      )}

      {/* Drive link girişi */}
      {!attachment && !uploading && mode === "drive" && (
        <div className="flex flex-col gap-2 bg-white border border-surface-200 rounded-xl p-3 min-w-[300px]">
          <input
            value={driveName}
            onChange={e => setDriveName(e.target.value)}
            placeholder="Dosya adı (isteğe bağlı)"
            className="w-full h-8 px-3 rounded-lg border border-surface-200 text-[12px] outline-none focus:border-base-primary-400 transition-colors"
          />
          <div className="flex gap-2">
            <input
              value={driveLink}
              onChange={e => setDriveLink(e.target.value)}
              placeholder="Google Drive linki..."
              className="flex-1 h-8 px-3 rounded-lg border border-surface-200 text-[12px] outline-none focus:border-base-primary-400 transition-colors"
            />
            <button onClick={handleDriveSave} disabled={!driveLink.trim()}
              className="px-3 h-8 bg-base-primary-700 text-white text-[11px] font-bold rounded-lg disabled:opacity-40 cursor-pointer hover:bg-base-primary-800 transition-colors shrink-0">
              Ekle
            </button>
            <button onClick={() => setMode("idle")}
              className="px-2 h-8 bg-surface-100 text-surface-600 rounded-lg cursor-pointer hover:bg-surface-200 transition-colors shrink-0">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* İki seçenek */}
      {!attachment && !uploading && mode === "choosing" && (
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-surface-200 rounded-xl text-[12px] font-semibold text-text-secondary hover:border-base-primary-300 hover:text-base-primary-600 transition-colors cursor-pointer">
            <Upload size={13} /> Bilgisayardan Yükle
          </button>
          <button onClick={() => setMode("drive")}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-surface-200 rounded-xl text-[12px] font-semibold text-text-secondary hover:border-base-primary-300 hover:text-base-primary-600 transition-colors cursor-pointer">
            <img src="/icons/google-drive.svg" width={14} height={14} alt="" /> Google Drive
          </button>
          <button onClick={() => setMode("idle")}
            className="text-surface-400 hover:text-surface-600 transition-colors cursor-pointer p-1">
            <X size={15} />
          </button>
          {error && <p className="w-full text-[11px] text-status-danger-500">{error}</p>}
        </div>
      )}

      {/* Boş — ekle butonu */}
      {!attachment && !uploading && mode === "idle" && (
        <button onClick={() => setMode("choosing")}
          className="flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 bg-white border border-dashed border-surface-300 rounded-xl text-[11px] sm:text-[12px] font-semibold text-surface-400 hover:border-base-primary-300 hover:text-base-primary-500 transition-colors cursor-pointer">
          <Upload size={13} /> Ödev Dosyası Ekle
        </button>
      )}
    </div>
  );
}

function GoogleDriveIcon() {
  return <img src="/icons/google-drive.svg" width={32} height={32} alt="Google Drive" />;
}
