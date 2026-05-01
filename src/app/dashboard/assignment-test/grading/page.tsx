"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/app/lib/firebase";
import {
  collection, getDocs, query, where, onSnapshot, orderBy,
} from "firebase/firestore";
import { useUser } from "@/app/context/UserContext";
import Sidebar from "@/app/components/layout/Sidebar";
import Header from "@/app/components/layout/Header";
import SubmissionStatusBadge from "@/app/components/assignment-test/SubmissionStatusBadge";
import {
  GraduationCap, Loader2, Download, ExternalLink, CheckSquare, Square,
  Users, FileText, AlertCircle,
} from "lucide-react";
import type { SubmissionStatus } from "@/app/types/submission";

interface Group {
  id: string;
  code: string;
  submissionCount: number;
}

interface Student {
  id: string;
  name: string;
  lastName: string;
}

interface Task {
  id: string;
  name: string;
  groupId: string;
}

interface SubmissionDoc {
  id: string;
  studentId: string;
  taskId: string;
  groupId: string;
  status: SubmissionStatus;
  grade?: number;
  gradedBy?: string;
  submittedAt: Date;
  driveViewLink?: string;
}

interface GradingRow {
  studentId: string;
  studentName: string;
  submitted: boolean;
  submissionId?: string;
  status?: SubmissionStatus;
  grade?: number;
  submittedAt?: Date;
  driveViewLink?: string;
  taskId?: string;
  groupId?: string;
}

export default function GradingPage() {
  const { user, loading: authLoading } = useUser();
  const router = useRouter();

  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionDoc[]>([]);

  const [groupsLoading, setGroupsLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);

  const [pendingGrades, setPendingGrades] = useState<Record<string, string>>({});
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string[]>([]);

  const subUnsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  // Grupları ve genel submission sayılarını yükle
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [groupSnap, subSnap] = await Promise.all([
        getDocs(collection(db, "groups")),
        getDocs(collection(db, "submissions")),
      ]);

      const countMap: Record<string, number> = {};
      subSnap.docs.forEach(d => {
        const gid = d.data().groupId;
        if (gid) countMap[gid] = (countMap[gid] ?? 0) + 1;
      });

      const list: Group[] = groupSnap.docs.map(d => ({
        id: d.id,
        code: d.data().code ?? d.id,
        submissionCount: countMap[d.id] ?? 0,
      }));
      list.sort((a, b) => a.code.localeCompare(b.code, "tr"));
      setGroups(list);
      setGroupsLoading(false);
    })();
  }, [user]);

  // Grup seçilince öğrenci + task yükle, submission dinlemeye başla
  useEffect(() => {
    if (!selectedGroupId) return;

    setContentLoading(true);
    setStudents([]);
    setTasks([]);
    setSubmissions([]);
    setSelectedTaskId(null);
    setSelected([]);
    setPendingGrades({});

    if (subUnsubRef.current) { subUnsubRef.current(); subUnsubRef.current = null; }

    (async () => {
      const [stuSnap, taskSnap] = await Promise.all([
        getDocs(query(collection(db, "students"), where("groupId", "==", selectedGroupId))),
        getDocs(query(collection(db, "tasks"), where("groupId", "==", selectedGroupId))),
      ]);

      const stuList: Student[] = stuSnap.docs.map(d => ({
        id: d.id,
        name: d.data().name ?? "",
        lastName: d.data().lastName ?? "",
      }));
      stuList.sort((a, b) =>
        `${a.name} ${a.lastName}`.localeCompare(`${b.name} ${b.lastName}`, "tr")
      );
      setStudents(stuList);

      const taskList: Task[] = taskSnap.docs.map(d => ({
        id: d.id,
        name: d.data().name ?? "—",
        groupId: d.data().groupId,
      }));
      setTasks(taskList);
      if (taskList.length > 0) setSelectedTaskId(taskList[0].id);

      setContentLoading(false);
    })();

    // Real-time submissions
    const q = query(
      collection(db, "submissions"),
      where("groupId", "==", selectedGroupId),
      orderBy("submittedAt", "desc"),
    );
    subUnsubRef.current = onSnapshot(q, snap => {
      const docs: SubmissionDoc[] = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          studentId: data.studentId,
          taskId: data.taskId,
          groupId: data.groupId,
          status: data.status,
          grade: data.grade,
          gradedBy: data.gradedBy,
          submittedAt: data.submittedAt?.toDate?.() ?? new Date(),
          driveViewLink: data.file?.driveViewLink,
        };
      });
      setSubmissions(docs);

      // Grup sayısını güncelle
      setGroups(prev => prev.map(g =>
        g.id === selectedGroupId ? { ...g, submissionCount: docs.length } : g
      ));
    });

    return () => { if (subUnsubRef.current) subUnsubRef.current(); };
  }, [selectedGroupId]);

  // Rows: tüm öğrenciler × seçili task
  const rows = useMemo<GradingRow[]>(() => {
    if (!selectedTaskId) return [];
    return students.map(s => {
      const sub = submissions.find(
        sub => sub.studentId === s.id && sub.taskId === selectedTaskId
      );
      if (sub) {
        return {
          studentId: s.id,
          studentName: `${s.name} ${s.lastName}`.trim(),
          submitted: true,
          submissionId: sub.id,
          status: sub.status,
          grade: sub.grade,
          submittedAt: sub.submittedAt,
          driveViewLink: sub.driveViewLink,
          taskId: selectedTaskId,
          groupId: selectedGroupId ?? undefined,
        };
      }
      return {
        studentId: s.id,
        studentName: `${s.name} ${s.lastName}`.trim(),
        submitted: false,
      };
    });
  }, [students, submissions, selectedTaskId, selectedGroupId]);

  const submittedRows = rows.filter(r => r.submitted);
  const gradedRows = submittedRows.filter(r => r.grade != null);
  const avg = gradedRows.length > 0
    ? Math.round(gradedRows.reduce((s, r) => s + (r.grade ?? 0), 0) / gradedRows.length)
    : null;

  async function handleGradeUpdate(submissionId: string, grade: number) {
    setSavingIds(prev => new Set(prev).add(submissionId));
    try {
      await fetch(`/api/assignment-test/submissions/${submissionId}/grade`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grade, gradedBy: user?.uid }),
      });
      // onSnapshot otomatik güncelleyecek
    } finally {
      setSavingIds(prev => { const n = new Set(prev); n.delete(submissionId); return n; });
    }
  }

  async function handleGradeBlur(submissionId: string) {
    const val = pendingGrades[submissionId];
    if (val === undefined) return;
    const num = parseFloat(val);
    if (isNaN(num) || num < 0 || num > 100) {
      setPendingGrades(prev => { const n = { ...prev }; delete n[submissionId]; return n; });
      return;
    }
    await handleGradeUpdate(submissionId, num);
    setPendingGrades(prev => { const n = { ...prev }; delete n[submissionId]; return n; });
  }

  function handleExportCsv() {
    const selectedTask = tasks.find(t => t.id === selectedTaskId);
    const selectedGroup = groups.find(g => g.id === selectedGroupId);
    const header = "Öğrenci,Durum,Puan\n";
    const body = rows.map(r => [
      r.studentName,
      r.submitted ? (r.status ?? "") : "teslim_etmedi",
      r.grade ?? "",
    ].join(",")).join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${selectedGroup?.code ?? "grup"}-${selectedTask?.name ?? "odev"}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  }

  const allSubmittedSelected = submittedRows.length > 0 && submittedRows.every(r => selected.includes(r.submissionId!));
  const toggleAllSubmitted = () =>
    setSelected(allSubmittedSelected ? [] : submittedRows.map(r => r.submissionId!));

  if (authLoading || !user) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-[#F9FAFB] font-inter antialiased text-text-primary">

      {/* App Sidebar */}
      <aside className="hidden lg:block h-full shrink-0 z-50 w-[280px] 2xl:w-[320px] bg-[#10294C]">
        <Sidebar />
      </aside>

      {/* Grup Paneli */}
      <aside className="hidden md:flex flex-col h-full w-[220px] shrink-0 bg-white border-r border-surface-200">
        <div className="px-4 pt-5 pb-3 border-b border-surface-100">
          <p className="text-[11px] font-bold text-surface-400 uppercase tracking-wider">Gruplar</p>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {groupsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={16} className="animate-spin text-surface-300" />
            </div>
          ) : groups.map(g => (
            <button
              key={g.id}
              onClick={() => setSelectedGroupId(g.id)}
              className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors cursor-pointer ${
                selectedGroupId === g.id
                  ? "bg-base-primary-50 text-base-primary-700"
                  : "text-surface-700 hover:bg-surface-50"
              }`}
            >
              <span className={`text-[13px] font-semibold ${selectedGroupId === g.id ? "text-base-primary-700" : ""}`}>
                {g.code}
              </span>
              {g.submissionCount > 0 && (
                <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                  selectedGroupId === g.id
                    ? "bg-base-primary-100 text-base-primary-600"
                    : "bg-surface-100 text-surface-500"
                }`}>
                  {g.submissionCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </aside>

      {/* Ana İçerik */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <Header />

        <main className="flex-1 overflow-y-auto overflow-x-clip [scrollbar-gutter:stable]">
          {!selectedGroupId ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <div className="w-12 h-12 rounded-2xl bg-surface-100 flex items-center justify-center">
                <Users size={20} className="text-surface-400" />
              </div>
              <p className="text-[14px] font-bold text-surface-500">Soldaki listeden bir grup seç</p>
              <p className="text-[12px] text-surface-400">Öğrenciler ve ödev durumları burada görünecek</p>
            </div>
          ) : contentLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 size={22} className="animate-spin text-surface-300" />
            </div>
          ) : (
            <div className="w-[94%] mx-auto pt-6 pb-10 max-w-[1100px]">

              {/* Başlık + Aksiyonlar */}
              <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-base-primary-100 flex items-center justify-center">
                    <GraduationCap size={16} className="text-base-primary-600" />
                  </div>
                  <div>
                    <h1 className="text-[18px] font-bold text-base-primary-900">
                      {groups.find(g => g.id === selectedGroupId)?.code ?? "Grup"}
                    </h1>
                    <p className="text-[12px] text-surface-400">
                      {students.length} öğrenci · {submittedRows.length} teslim
                      {avg !== null && ` · ort. ${avg}/100`}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleExportCsv}
                  disabled={rows.length === 0}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-surface-200 text-[12px] font-bold text-surface-600 hover:bg-surface-50 transition-colors cursor-pointer disabled:opacity-40"
                >
                  <Download size={13} /> CSV İndir
                </button>
              </div>

              {/* Ödev Seçici */}
              {tasks.length > 1 && (
                <div className="flex items-center gap-1 mb-4 bg-surface-50 rounded-xl p-1 border border-surface-200 w-fit">
                  {tasks.map(t => (
                    <button
                      key={t.id}
                      onClick={() => { setSelectedTaskId(t.id); setSelected([]); }}
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all cursor-pointer ${
                        selectedTaskId === t.id
                          ? "bg-white text-base-primary-700 shadow-sm"
                          : "text-surface-500 hover:text-surface-700"
                      }`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              )}

              {tasks.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 border border-dashed border-surface-200 rounded-2xl">
                  <FileText size={20} className="text-surface-300" />
                  <p className="text-[13px] font-bold text-surface-400">Bu grupta henüz ödev yok</p>
                </div>
              ) : students.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 border border-dashed border-surface-200 rounded-2xl">
                  <AlertCircle size={20} className="text-surface-300" />
                  <p className="text-[13px] font-bold text-surface-400">Bu grupta öğrenci bulunamadı</p>
                </div>
              ) : (
                <div className="border border-surface-200 rounded-2xl overflow-hidden bg-white">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-surface-100 bg-surface-50">
                        <th className="px-4 py-3 w-10">
                          <button onClick={toggleAllSubmitted} className="text-surface-400 hover:text-base-primary-600 transition-colors cursor-pointer">
                            {allSubmittedSelected
                              ? <CheckSquare size={15} className="text-base-primary-600" />
                              : <Square size={15} />}
                          </button>
                        </th>
                        <th className="px-4 py-3 text-[12px] font-bold text-surface-500">Öğrenci</th>
                        <th className="px-4 py-3 text-[12px] font-bold text-surface-500">Durum</th>
                        <th className="px-4 py-3 text-[12px] font-bold text-surface-500">Teslim Tarihi</th>
                        <th className="px-4 py-3 text-[12px] font-bold text-surface-500">Puan</th>
                        <th className="px-4 py-3 w-16" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(row => (
                        <GradingRow
                          key={row.studentId}
                          row={row}
                          selected={selected}
                          savingIds={savingIds}
                          pendingGrades={pendingGrades}
                          onToggleSelect={id => setSelected(prev =>
                            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
                          )}
                          onGradeChange={(id, val) =>
                            setPendingGrades(prev => ({ ...prev, [id]: val }))
                          }
                          onGradeBlur={handleGradeBlur}
                          onDetail={() => row.submitted && row.submissionId &&
                            router.push(`/dashboard/assignment-test/${row.groupId}/${row.taskId}/${row.submissionId}`)
                          }
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ── Satır Komponenti ──────────────────────────────────────────────────────────

interface GradingRowProps {
  row: GradingRow;
  selected: string[];
  savingIds: Set<string>;
  pendingGrades: Record<string, string>;
  onToggleSelect: (id: string) => void;
  onGradeChange: (id: string, val: string) => void;
  onGradeBlur: (id: string) => Promise<void>;
  onDetail: () => void;
}

function GradingRow({
  row, selected, savingIds, pendingGrades,
  onToggleSelect, onGradeChange, onGradeBlur, onDetail,
}: GradingRowProps) {
  const subId = row.submissionId ?? "";
  const isSaving = savingIds.has(subId);
  const isSelected = selected.includes(subId);
  const gradeVal = pendingGrades[subId] ?? (row.grade != null ? String(row.grade) : "");

  return (
    <tr className={`border-b border-surface-50 last:border-0 transition-colors ${
      row.submitted ? "hover:bg-surface-50/50" : "bg-surface-50/30"
    }`}>
      {/* Checkbox */}
      <td className="px-4 py-3">
        {row.submitted ? (
          <button
            onClick={() => onToggleSelect(subId)}
            className="text-surface-300 hover:text-base-primary-600 transition-colors cursor-pointer"
          >
            {isSelected
              ? <CheckSquare size={15} className="text-base-primary-600" />
              : <Square size={15} />}
          </button>
        ) : (
          <div className="w-4" />
        )}
      </td>

      {/* Öğrenci */}
      <td className="px-4 py-3 text-[13px] font-bold text-text-primary">
        {row.studentName}
      </td>

      {/* Durum */}
      <td className="px-4 py-3">
        {row.submitted && row.status ? (
          <SubmissionStatusBadge status={row.status} />
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-surface-100 text-[11px] font-semibold text-surface-400">
            Teslim Etmedi
          </span>
        )}
      </td>

      {/* Tarih */}
      <td className="px-4 py-3 text-[12px] text-surface-500">
        {row.submitted && row.submittedAt
          ? new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "numeric" }).format(row.submittedAt)
          : "—"}
      </td>

      {/* Puan */}
      <td className="px-4 py-3">
        {row.submitted ? (
          <div className="relative">
            <input
              type="number"
              min={0}
              max={100}
              value={gradeVal}
              onChange={e => onGradeChange(subId, e.target.value)}
              onBlur={() => onGradeBlur(subId)}
              placeholder="—"
              className="w-16 h-8 px-2 rounded-lg border border-surface-200 text-[13px] font-bold text-center
                text-text-primary focus:border-base-primary-400 focus:outline-none focus:ring-1 focus:ring-base-primary-100
                transition-all [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            />
            {isSaving && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-lg">
                <div className="w-3 h-3 border-2 border-base-primary-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        ) : (
          <span className="text-[13px] text-surface-300 pl-2">—</span>
        )}
      </td>

      {/* Detay */}
      <td className="px-4 py-3 text-right">
        {row.submitted && row.driveViewLink ? (
          <button
            onClick={onDetail}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-surface-200 text-[11px] font-bold text-surface-600 hover:bg-surface-50 transition-colors cursor-pointer"
          >
            <ExternalLink size={11} /> Detay
          </button>
        ) : null}
      </td>
    </tr>
  );
}
