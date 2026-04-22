"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/app/lib/firebase";
import { collection, getDocs, doc, getDoc, query, where } from "firebase/firestore";
import { useUser } from "@/app/context/UserContext";
import Sidebar from "@/app/components/layout/Sidebar";
import Header from "@/app/components/layout/Header";
import SubmissionTable from "@/app/components/assignment-test/SubmissionTable";
import SubmissionStatusBadge from "@/app/components/assignment-test/SubmissionStatusBadge";
import { ArrowLeft, Loader2, Users, BookOpen, Search, Plus } from "lucide-react";
import type { Submission } from "@/app/types/submission";
import type { Task } from "@/app/components/dashboard/assignment/taskTypes";

type Tab = "students" | "submissions" | "tasks";

interface Student {
  id: string;
  name: string;
  lastName: string;
  points: number;
  status: string;
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

export default function GroupDetailPage() {
  const { user, loading: authLoading } = useUser();
  const router = useRouter();
  const params = useParams<{ groupId: string }>();
  const groupId = params.groupId;

  const [tab, setTab] = useState<Tab>("submissions");
  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
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
      const [groupSnap, studentSnap, subSnap, taskSnap] = await Promise.all([
        getDoc(doc(db, "groups", groupId)),
        getDocs(query(collection(db, "students"), where("groupId", "==", groupId))),
        getDocs(query(collection(db, "submissions"), where("groupId", "==", groupId))),
        getDocs(query(collection(db, "tasks"), where("groupId", "==", groupId))),
      ]);

      if (groupSnap.exists()) {
        const g = groupSnap.data();
        setGroup({ code: g.code, session: g.session, branch: g.branch, instructor: g.instructor, students: g.students });
      }

      const studentList: Student[] = studentSnap.docs.map(d => ({
        id: d.id,
        name: d.data().name ?? "",
        lastName: d.data().lastName ?? "",
        points: d.data().points ?? 0,
        status: d.data().status ?? "active",
      }));
      setStudents(studentList);

      const studentMap: Record<string, string> = {};
      studentList.forEach(s => { studentMap[s.id] = `${s.name} ${s.lastName}`; });

      const subRows: SubmissionRow[] = subSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          studentId: data.studentId,
          taskId: data.taskId,
          groupId: data.groupId,
          iteration: data.iteration ?? 1,
          file: {
            driveFileId: data.file?.driveFileId ?? "",
            driveViewLink: data.file?.driveViewLink ?? "",
            fileUrl: data.file?.fileUrl ?? "",
            fileName: data.file?.fileName ?? "",
            fileSize: data.file?.fileSize ?? 0,
            mimeType: data.file?.mimeType ?? "",
          },
          note: data.note,
          status: data.status,
          feedback: data.feedback,
          gradedBy: data.gradedBy,
          grade: data.grade,
          isLate: data.isLate ?? false,
          daysLate: data.daysLate,
          submittedAt: data.submittedAt?.toDate?.() ?? new Date(),
          reviewedAt: data.reviewedAt?.toDate?.(),
          completedAt: data.completedAt?.toDate?.(),
          updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
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

  const activeTasks = tasks.filter(t => t.isActive);

  if (authLoading || !user) return null;

  const TABS: { key: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: "students",    label: "Öğrenciler", icon: <Users size={15} />,    count: students.length },
    { key: "submissions", label: "Teslimler",  icon: null,                   count: submissions.length },
    { key: "tasks",       label: "Ödevler",    icon: <BookOpen size={15} />, count: tasks.length },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-[#F9FAFB] font-inter antialiased text-text-primary">
      <aside className="hidden lg:block h-full shrink-0 z-50 w-[280px] 2xl:w-[320px] bg-[#10294C]">
        <Sidebar />
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-full">
        <Header />

        <main className="flex-1 overflow-y-auto overflow-x-clip [scrollbar-gutter:stable]">
          <div className="w-[94%] mx-auto pt-6 pb-10 max-w-[1280px] xl:max-w-[1600px]">

            {/* Geri + Başlık */}
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={() => router.push("/dashboard/assignment-test")}
                className="w-9 h-9 rounded-xl border border-surface-200 flex items-center justify-center hover:bg-surface-100 transition-colors cursor-pointer"
              >
                <ArrowLeft size={16} className="text-surface-500" />
              </button>
              <div>
                <p className="text-[11px] font-bold text-surface-400 uppercase tracking-wider">
                  {group?.branch} · {group?.session}
                </p>
                <h1 className="text-[20px] font-bold text-base-primary-900">{group?.code ?? groupId}</h1>
              </div>
              <div className="ml-auto flex items-center gap-2 text-[13px] text-surface-500">
                <Users size={14} />
                {group?.students ?? 0} öğrenci
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-0 border-b border-surface-200 mb-6">
              {TABS.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-2 px-5 py-3 text-[13px] font-bold border-b-2 -mb-px transition-colors cursor-pointer
                    ${tab === t.key
                      ? "border-base-primary-600 text-base-primary-600"
                      : "border-transparent text-surface-500 hover:text-surface-700"
                    }`}
                >
                  {t.icon}
                  {t.label}
                  {t.count !== undefined && (
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black
                      ${tab === t.key ? "bg-base-primary-100 text-base-primary-600" : "bg-surface-100 text-surface-500"}`}>
                      {t.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-24 text-surface-400">
                <Loader2 size={22} className="animate-spin" />
              </div>
            ) : (
              <>
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

                {/* TAB: Teslimler */}
                {tab === "submissions" && (
                  <SubmissionTable
                    rows={submissions}
                    basePath={`/dashboard/assignment-test/${groupId}/submissions`}
                  />
                )}

                {/* TAB: Ödevler */}
                {tab === "tasks" && (
                  <div className="space-y-3">
                    {tasks.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 py-12 border border-dashed border-surface-200 rounded-2xl">
                        <BookOpen size={20} className="text-surface-300" />
                        <p className="text-[13px] font-bold text-surface-400">Bu gruba ait ödev yok</p>
                        <button
                          onClick={() => router.push("/dashboard/tasks")}
                          className="flex items-center gap-1.5 px-4 py-2 mt-2 bg-base-primary-600 text-white rounded-xl text-[13px] font-bold hover:bg-base-primary-700 transition-colors cursor-pointer"
                        >
                          <Plus size={14} /> Ödev Ekle
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {tasks.map(task => {
                          const taskSubCount = submissions.filter(s => s.taskId === task.id).length;
                          const isActive = !!task.isActive;
                          return (
                            <div
                              key={task.id}
                              onClick={() => router.push(`/dashboard/assignment-test/${groupId}/${task.id}`)}
                              className="bg-white border border-surface-200 rounded-2xl p-5 cursor-pointer
                                hover:shadow-md hover:border-base-primary-300 hover:-translate-y-0.5 transition-all duration-200"
                            >
                              <div className="flex items-start justify-between gap-3 mb-3">
                                <h3 className="text-[14px] font-bold text-text-primary leading-snug flex-1">{task.name}</h3>
                                <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold border
                                  ${isActive
                                    ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                                    : "bg-surface-100 text-surface-500 border-surface-200"
                                  }`}>
                                  {isActive ? "Aktif" : "Pasif"}
                                </span>
                              </div>
                              {task.endDate && (
                                <p className="text-[11px] text-surface-400 mb-2">
                                  Son: {new Date(task.endDate).toLocaleDateString("tr-TR")}
                                </p>
                              )}
                              <div className="flex items-center justify-between">
                                <p className="text-[12px] text-surface-500">
                                  <span className="font-bold text-base-primary-700">{taskSubCount}</span>/{group?.students ?? 0} teslim
                                </p>
                                {group?.students ? (
                                  <div className="w-24 h-1.5 bg-surface-100 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-base-primary-400 rounded-full transition-all"
                                      style={{ width: `${Math.min(100, (taskSubCount / group.students) * 100)}%` }}
                                    />
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
