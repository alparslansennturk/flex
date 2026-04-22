"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/app/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { useUser } from "@/app/context/UserContext";
import Sidebar from "@/app/components/layout/Sidebar";
import Header from "@/app/components/layout/Header";
import GradingTable from "@/app/components/assignment-test/GradingTable";
import { GraduationCap, Loader2, Download, CheckCircle2 } from "lucide-react";
import type { Submission, SubmissionStatus } from "@/app/types/submission";

interface GradingRow extends Submission {
  studentName: string;
  groupCode: string;
  taskName: string;
}

export default function GradingPage() {
  const { user, loading: authLoading } = useUser();
  const router = useRouter();

  const [rows, setRows] = useState<GradingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupFilter, setGroupFilter] = useState("all");
  const [groups, setGroups] = useState<{ id: string; code: string }[]>([]);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  async function loadData() {
    setLoading(true);
    try {
      const [subSnap, stuSnap, groupSnap, taskSnap] = await Promise.all([
        getDocs(collection(db, "submissions")),
        getDocs(collection(db, "students")),
        getDocs(collection(db, "groups")),
        getDocs(collection(db, "tasks")),
      ]);

      const studentMap: Record<string, string> = {};
      stuSnap.docs.forEach(d => {
        studentMap[d.id] = `${d.data().name ?? ""} ${d.data().lastName ?? ""}`.trim();
      });

      const groupMap: Record<string, string> = {};
      const groupList: { id: string; code: string }[] = [];
      groupSnap.docs.forEach(d => {
        const code = d.data().code ?? d.id;
        groupMap[d.id] = code;
        groupList.push({ id: d.id, code });
      });
      setGroups(groupList);

      const taskMap: Record<string, string> = {};
      taskSnap.docs.forEach(d => {
        taskMap[d.id] = d.data().name ?? "—";
      });

      const gradingRows: GradingRow[] = subSnap.docs.map(d => {
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
          groupCode: groupMap[data.groupId] ?? "—",
          taskName: taskMap[data.taskId] ?? "—",
        };
      });
      setRows(gradingRows);
    } finally {
      setLoading(false);
    }
  }

  const filteredRows = useMemo(() =>
    groupFilter === "all" ? rows : rows.filter(r => r.groupId === groupFilter),
    [rows, groupFilter]
  );

  async function handleGradeUpdate(submissionId: string, grade: number) {
    await fetch(`/api/assignment-test/submissions/${submissionId}/grade`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grade, gradedBy: user?.uid }),
    });
    setRows(prev => prev.map(r => r.id === submissionId ? { ...r, grade } : r));
  }

  async function handleBulkApprove(ids: string[]) {
    await Promise.all(ids.map(id =>
      fetch(`/api/assignment-test/submissions/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" as SubmissionStatus, authorId: user?.uid }),
      })
    ));
    setRows(prev => prev.map(r => ids.includes(r.id) ? { ...r, status: "completed" as SubmissionStatus } : r));
  }

  function handleExportCsv() {
    const header = "Öğrenci,Grup,Ödev,Durum,Tarih,Puan\n";
    const body = filteredRows.map(r =>
      [
        r.studentName,
        r.groupCode,
        r.taskName,
        r.status,
        new Date(r.submittedAt).toLocaleDateString("tr-TR"),
        r.grade ?? "",
      ].join(",")
    ).join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `not-girisi-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  }

  // Özet istatistikler
  const totalCount = filteredRows.length;
  const completedCount = filteredRows.filter(r => r.status === "completed").length;
  const revisionCount = filteredRows.filter(r => r.status === "revision").length;
  const pendingCount = filteredRows.filter(r => r.status === "submitted" || r.status === "reviewing").length;
  const gradedRows = filteredRows.filter(r => r.grade != null);
  const avgGrade = gradedRows.length > 0
    ? Math.round(gradedRows.reduce((s, r) => s + (r.grade ?? 0), 0) / gradedRows.length)
    : null;

  if (authLoading || !user) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-[#F9FAFB] font-inter antialiased text-text-primary">
      <aside className="hidden lg:block h-full shrink-0 z-50 w-[280px] 2xl:w-[320px] bg-[#10294C]">
        <Sidebar />
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-full">
        <Header />

        <main className="flex-1 overflow-y-auto overflow-x-clip [scrollbar-gutter:stable]">
          <div className="w-[94%] mx-auto pt-6 pb-10 max-w-[1280px] xl:max-w-[1600px]">

            {/* Hero */}
            <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-base-primary-100 flex items-center justify-center">
                  <GraduationCap size={18} className="text-base-primary-600" />
                </div>
                <div>
                  <h1 className="text-[20px] font-bold text-base-primary-900">Merkezi Not Girişi</h1>
                  <p className="text-[13px] text-surface-500">Tüm gruplardaki teslimler</p>
                </div>
              </div>

              {/* Grup filtresi */}
              <select
                value={groupFilter}
                onChange={e => setGroupFilter(e.target.value)}
                className="h-9 px-3 rounded-xl border border-surface-200 bg-white text-[13px] font-medium text-text-primary outline-none focus:border-base-primary-400 cursor-pointer"
              >
                <option value="all">Tüm Gruplar</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.code}</option>
                ))}
              </select>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-24 text-surface-400">
                <Loader2 size={22} className="animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6">

                {/* Sol: tablo */}
                <div>
                  <GradingTable
                    rows={filteredRows}
                    onGradeUpdate={handleGradeUpdate}
                    onBulkApprove={handleBulkApprove}
                    onExportCsv={handleExportCsv}
                  />
                </div>

                {/* Sağ: özet paneli */}
                <div className="space-y-4 lg:sticky lg:top-6 self-start">
                  <div className="bg-white border border-surface-200 rounded-2xl p-5">
                    <p className="text-[11px] font-bold text-surface-400 uppercase tracking-wider mb-4">Özet</p>
                    <div className="space-y-3">
                      <SummaryRow label="Toplam Teslim" value={totalCount} />
                      <SummaryRow label="Tamamlandı" value={completedCount} color="text-emerald-600" />
                      <SummaryRow label="Revizyon" value={revisionCount} color="text-orange-500" />
                      <SummaryRow label="Beklemede" value={pendingCount} color="text-blue-500" />
                      {avgGrade !== null && (
                        <div className="pt-3 border-t border-surface-100">
                          <div className="flex items-baseline justify-between">
                            <span className="text-[12px] font-medium text-surface-500">Ortalama Puan</span>
                            <span className="text-[22px] font-black text-base-primary-700">{avgGrade}</span>
                          </div>
                          <p className="text-[11px] text-surface-400 text-right">/ 100</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={handleExportCsv}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-surface-200
                      text-[13px] font-bold text-surface-600 hover:bg-surface-50 transition-colors cursor-pointer"
                  >
                    <Download size={15} /> CSV İndir
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, color = "text-text-primary" }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] font-medium text-surface-500">{label}</span>
      <span className={`text-[15px] font-bold ${color}`}>{value}</span>
    </div>
  );
}
