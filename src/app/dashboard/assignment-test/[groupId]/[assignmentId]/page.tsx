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
import { ArrowLeft, Calendar, Users, FileText, Loader2, MessageCircle } from "lucide-react";
import type { Submission, SubmissionStatus } from "@/app/types/submission";

interface SubmissionRow extends Submission {
  studentName: string;
}

interface TaskInfo {
  name: string;
  description: string;
  endDate?: string;
  points: number;
  isActive: boolean;
}

export default function AssignmentDetailPage() {
  const { user, loading: authLoading } = useUser();
  const router = useRouter();
  const params = useParams<{ groupId: string; assignmentId: string }>();
  const { groupId, assignmentId } = params;

  const [task, setTask] = useState<TaskInfo | null>(null);
  const [groupStudentCount, setGroupStudentCount] = useState(0);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user, groupId, assignmentId]);

  async function updateStatus(ids: string[], status: SubmissionStatus) {
    await Promise.all(
      ids.map(id =>
        fetch(`/api/assignment-test/submissions/${id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, authorId: user?.uid }),
        })
      )
    );
    await loadData();
  }

  async function loadData() {
    setLoading(true);
    try {
      const [taskSnap, groupSnap, subSnap] = await Promise.all([
        getDoc(doc(db, "tasks", assignmentId)),
        getDoc(doc(db, "groups", groupId)),
        getDocs(query(collection(db, "submissions"), where("taskId", "==", assignmentId))),
      ]);

      if (taskSnap.exists()) {
        const d = taskSnap.data();
        setTask({ name: d.name, description: d.description, endDate: d.endDate, points: d.points, isActive: !!d.isActive });
      }

      const stuCount = groupSnap.exists() ? (groupSnap.data().students ?? 0) : 0;
      setGroupStudentCount(stuCount);

      // Öğrenci isimleri için students çek
      const studentIds = [...new Set(subSnap.docs.map(d => d.data().studentId as string))];
      const studentMap: Record<string, string> = {};
      if (studentIds.length > 0) {
        const stuSnap = await getDocs(
          query(collection(db, "students"), where("__name__", "in", studentIds.slice(0, 30)))
        );
        stuSnap.docs.forEach(d => {
          studentMap[d.id] = `${d.data().name ?? ""} ${d.data().lastName ?? ""}`.trim();
        });
      }

      const rows: SubmissionRow[] = subSnap.docs.map(d => {
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
      setSubmissions(rows);
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || !user) return null;

  // İstatistikler
  const statusCount = (s: SubmissionStatus) => submissions.filter(r => r.status === s).length;
  const total = submissions.length;
  const completedCount = statusCount("completed");
  const revisionCount = statusCount("revision");
  const submittedCount = statusCount("submitted") + statusCount("reviewing");
  const completionRate = groupStudentCount > 0 ? Math.round((total / groupStudentCount) * 100) : 0;

  return (
    <div className="flex h-screen overflow-hidden bg-[#F9FAFB] font-inter antialiased text-text-primary">
      <aside className="hidden lg:block h-full shrink-0 z-50 w-[280px] 2xl:w-[320px] bg-[#10294C]">
        <Sidebar />
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-full">
        <Header />

        <main className="flex-1 overflow-y-auto overflow-x-clip [scrollbar-gutter:stable]">
          <div className="w-[94%] mx-auto pt-6 pb-10 max-w-[1280px] xl:max-w-[1600px]">

            {/* Geri */}
            <button
              onClick={() => router.push(`/dashboard/assignment-test/${groupId}`)}
              className="flex items-center gap-2 text-[13px] font-bold text-surface-500 hover:text-base-primary-600 transition-colors mb-5 cursor-pointer"
            >
              <ArrowLeft size={15} /> Gruba Dön
            </button>

            {loading ? (
              <div className="flex items-center justify-center py-24 text-surface-400">
                <Loader2 size={22} className="animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">

                {/* Sol: Brief + Teslimler */}
                <div className="space-y-6">
                  {/* Brief */}
                  {task && (
                    <div className="bg-white border border-surface-200 rounded-2xl p-6">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div>
                          <h1 className="text-[20px] font-bold text-base-primary-900">{task.name}</h1>
                          {task.description && (
                            <p className="text-[14px] text-surface-500 mt-1.5 leading-relaxed">{task.description}</p>
                          )}
                        </div>
                        <span className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-bold border
                          ${task.isActive
                            ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                            : "bg-surface-100 text-surface-500 border-surface-200"
                          }`}>
                          {task.isActive ? "Aktif" : "Pasif"}
                        </span>
                      </div>

                      <div className="flex items-center gap-5 flex-wrap text-[12px] text-surface-500">
                        {task.endDate && (
                          <div className="flex items-center gap-1.5">
                            <Calendar size={13} />
                            <span>Bitiş: {new Date(task.endDate).toLocaleDateString("tr-TR")}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <Users size={13} />
                          <span>{total}/{groupStudentCount} teslim (%{completionRate})</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <FileText size={13} />
                          <span>{task.points} puan</span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      {groupStudentCount > 0 && (
                        <div className="mt-4">
                          <div className="w-full h-2 bg-surface-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-base-primary-500 rounded-full transition-all duration-500"
                              style={{ width: `${completionRate}%` }}
                            />
                          </div>
                          <p className="text-[11px] text-surface-400 mt-1 text-right">%{completionRate} teslim oranı</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Teslimler tablosu */}
                  <div>
                    <h2 className="text-[15px] font-bold text-text-primary mb-3">Teslimler</h2>
                    <SubmissionTable
                      rows={submissions}
                      basePath={`/dashboard/assignment-test/${groupId}/${assignmentId}`}
                      onBulkRevision={ids => updateStatus(ids, "revision")}
                      onBulkApprove={ids => updateStatus(ids, "completed")}
                    />
                  </div>
                </div>

                {/* Sağ: İstatistikler */}
                <div className="space-y-4">
                  <div className="bg-white border border-surface-200 rounded-2xl p-5">
                    <h3 className="text-[13px] font-bold text-surface-500 mb-4 uppercase tracking-wider">İstatistikler</h3>
                    <div className="space-y-3">
                      <StatRow label="Teslim Edildi" value={submittedCount} total={total} color="bg-blue-400" />
                      <StatRow label="Revizyon" value={revisionCount} total={total} color="bg-orange-400" />
                      <StatRow label="Tamamlandı" value={completedCount} total={total} color="bg-emerald-400" />
                    </div>
                  </div>

                  <div className="bg-white border border-surface-200 rounded-2xl p-5">
                    <h3 className="text-[13px] font-bold text-surface-500 mb-3 uppercase tracking-wider">Hızlı İşlem</h3>
                    <div className="space-y-2">
                      <button
                        onClick={() => {
                          const ids = submissions.filter(s => s.status === "submitted").map(s => s.id);
                          if (ids.length) updateStatus(ids, "reviewing");
                        }}
                        className="w-full px-4 py-2.5 rounded-xl border border-surface-200 text-[13px] font-bold text-surface-600
                          hover:bg-surface-50 transition-colors cursor-pointer text-left"
                      >
                        Tümünü İncele
                      </button>
                      <button
                        onClick={() => {
                          const ids = submissions.filter(s => s.status === "reviewing").map(s => s.id);
                          if (ids.length) updateStatus(ids, "completed");
                        }}
                        className="w-full px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-[13px] font-bold
                          hover:bg-emerald-600 transition-colors cursor-pointer text-left"
                      >
                        İncelemeleri Onayla
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function StatRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[12px] font-medium text-surface-600">{label}</span>
        <span className="text-[13px] font-bold text-text-primary">{value}</span>
      </div>
      <div className="w-full h-1.5 bg-surface-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
