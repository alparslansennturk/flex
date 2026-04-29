"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, auth } from "@/app/lib/firebase";
import {
  collection, getDocs, doc, getDoc, query, where,
  onSnapshot, orderBy, addDoc, updateDoc, deleteDoc, serverTimestamp,
} from "firebase/firestore";
import { useUser } from "@/app/context/UserContext";
import Sidebar from "@/app/components/layout/Sidebar";
import Header from "@/app/components/layout/Header";
import {
  ArrowLeft, Loader2, Check, ChevronDown, FileText,
  ExternalLink, Send, Lock, Users, Download, Trash2, MoreHorizontal, Pencil,
} from "lucide-react";
import type { Submission, SubmissionStatus } from "@/app/types/submission";

/* ── Types ── */

interface Student {
  id: string;
  name: string;
  lastName: string;
  gender?: "male" | "female";
  avatarId?: number;
}

interface TaskInfo { name: string; points: number; isActive: boolean; }

interface SubmissionRow extends Submission { studentName: string; }

interface CommentItem {
  id: string;
  commentType: "general" | "private";
  authorId: string;
  authorType: "teacher" | "student";
  authorName: string;
  text: string;
  createdAt: Date;
}

/* ── Helpers ── */

function fmtDateTime(val: any): string {
  if (!val) return "—";
  const d: Date = val?.toDate ? val.toDate() : val instanceof Date ? val : new Date(val);
  return d.toLocaleDateString("tr-TR", {
    day: "numeric", month: "long", year: "numeric", weekday: "short",
  });
}

function fmtTime(val: Date): string {
  return val.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

function mimeToLabel(mime: string): string {
  if (!mime) return "Dosya";
  if (mime.startsWith("image/")) return "Resim";
  if (mime === "application/pdf") return "PDF";
  if (mime.includes("word")) return "Belge";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "Sunum";
  if (mime.includes("spreadsheet") || mime.includes("excel")) return "Tablo";
  if (mime.startsWith("video/")) return "Video";
  return "Dosya";
}

const STATUS_LABEL: Record<SubmissionStatus, string> = {
  submitted: "Teslim Edildi",
  reviewing: "İncelemede",
  revision:  "Revize",
  completed: "Tamamlandı",
};

const STATUS_COLOR: Record<SubmissionStatus, string> = {
  submitted: "text-status-success-500",
  reviewing: "text-status-success-500",
  revision:  "text-status-info",
  completed: "text-status-success-700",
};

/* ── Avatar (SVG sistemi) ── */

function StudentAvatar({
  gender, avatarId, size = "md",
}: {
  gender?: string; avatarId?: number; size?: "sm" | "md" | "lg";
}) {
  const g  = gender === "female" ? "female" : "male";
  const id = Number(avatarId) || 1;
  const sz = { sm: "w-8 h-8", md: "w-10 h-10", lg: "w-12 h-12" }[size];
  return (
    <img
      src={`/avatars/${g}/${id}.svg`}
      alt=""
      className={`${sz} rounded-full object-cover shrink-0 bg-surface-100`}
      onError={e => { (e.target as HTMLImageElement).src = `/avatars/${g}/1.svg`; }}
    />
  );
}

/* ── CheckBox ── */

function CheckBox({ checked, indeterminate = false }: { checked: boolean; indeterminate?: boolean }) {
  return (
    <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all shrink-0
      ${checked || indeterminate
        ? "bg-base-primary-600 border-base-primary-600"
        : "border-surface-300 hover:border-base-primary-400 bg-white"
      }`}
    >
      {checked      && <Check size={10} className="text-white" strokeWidth={3} />}
      {indeterminate && !checked && <div className="w-2 h-0.5 bg-white rounded-full" />}
    </div>
  );
}

/* ── Page ── */

export default function AssignmentDetailPage() {
  const { user, loading: authLoading } = useUser();
  const router  = useRouter();
  const params  = useParams<{ groupId: string; assignmentId: string }>();
  const { groupId, assignmentId } = params;

  const [task,        setTask]        = useState<TaskInfo | null>(null);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [loading,     setLoading]     = useState(true);

  const [viewingId,     setViewingId]     = useState<string | null>(null);
  const [checkedIds,    setCheckedIds]    = useState<Set<string>>(new Set());
  const [dropdownOpen,  setDropdownOpen]  = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  /* Yorum state */
  const [activeTab,       setActiveTab]       = useState<"general" | "private">("general");
  const [generalComments, setGeneralComments] = useState<CommentItem[]>([]);
  const [privateComments, setPrivateComments] = useState<CommentItem[]>([]);
  const [commentText,     setCommentText]     = useState("");
  const [sendingComment,  setSendingComment]  = useState(false);

  const dropdownRef   = useRef<HTMLDivElement>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!authLoading && !user) router.push("/login"); }, [user, authLoading, router]);
  useEffect(() => { if (user) loadData(); }, [user, groupId, assignmentId]);

  /* Real-time submissions — öğrenci teslim ettiğinde eğitmen sayfası otomatik güncellenir */
  useEffect(() => {
    if (!user || allStudents.length === 0) return;
    const studentMap: Record<string, string> = {};
    allStudents.forEach(s => { studentMap[s.id] = `${s.name} ${s.lastName}`.trim(); });

    const q = query(collection(db, "submissions"), where("taskId", "==", assignmentId));
    const unsub = onSnapshot(q, snap => {
      const rows: SubmissionRow[] = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id, studentId: data.studentId, taskId: data.taskId, groupId: data.groupId,
          iteration: data.iteration ?? 1,
          file: {
            driveFileId:   data.file?.driveFileId   ?? "",
            driveViewLink: data.file?.driveViewLink ?? "",
            fileUrl:       data.file?.fileUrl       ?? "",
            fileName:      data.file?.fileName      ?? "",
            fileSize:      data.file?.fileSize      ?? 0,
            mimeType:      data.file?.mimeType      ?? "",
          },
          note: data.note, status: data.status, feedback: data.feedback,
          gradedBy: data.gradedBy, grade: data.grade,
          isLate: data.isLate ?? false, daysLate: data.daysLate,
          submittedAt:  data.submittedAt?.toDate?.()  ?? new Date(),
          reviewedAt:   data.reviewedAt?.toDate?.(),
          completedAt:  data.completedAt?.toDate?.(),
          updatedAt:    data.updatedAt?.toDate?.()    ?? new Date(),
          studentName:  studentMap[data.studentId]    ?? "—",
        };
      });
      setSubmissions(rows);
    }, err => {
      if (err.code !== "permission-denied") console.error("[submissions-rt]", err);
    });
    return unsub;
  }, [user, assignmentId, allStudents]);

  /* Dropdown dışı tıklamada kapat */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* Yorum yükleme — seçili öğrenci veya submission değişince */
  useEffect(() => {
    setGeneralComments([]);
    setPrivateComments([]);

    const unsubs: (() => void)[] = [];

    /* Genel yorumlar — tasks/{assignmentId}/comments */
    const qGeneral = query(
      collection(db, "tasks", assignmentId, "comments"),
      orderBy("createdAt", "asc"),
    );
    unsubs.push(onSnapshot(qGeneral, snap => {
      setGeneralComments(snap.docs.map(d => ({
        id: d.id,
        commentType: "general" as const,
        authorId:   d.data().authorId   ?? "",
        authorType: d.data().authorType ?? "teacher",
        authorName: d.data().authorName ?? "—",
        text:       d.data().text       ?? "",
        createdAt:  d.data().createdAt?.toDate?.() ?? new Date(),
      })));
    }, err => { if (err.code !== "permission-denied") console.error("[general-comments]", err); }));

    /* Özel yorumlar — tasks/{taskId}/threads/{studentId}/comments */
    if (viewingId) {
      const qPrivate = query(
        collection(db, "tasks", assignmentId, "threads", viewingId, "comments"),
        orderBy("createdAt", "asc"),
      );
      unsubs.push(onSnapshot(qPrivate, snap => {
        setPrivateComments(snap.docs.map(d => ({
          id: d.id,
          commentType: "private" as const,
          authorId:   d.data().authorId   ?? "",
          authorType: d.data().authorType ?? "teacher",
          authorName: d.data().authorName ?? "—",
          text:       d.data().text ?? d.data().body ?? "",
          createdAt:  d.data().createdAt?.toDate?.() ?? new Date(),
        })));
      }, err => { if (err.code !== "permission-denied") console.error("[private-comments]", err); }));
    }

    return () => unsubs.forEach(u => u());
  }, [viewingId, assignmentId]);

  /* Yorum listesi değişince en alta kaydır */
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [generalComments, privateComments, activeTab]);

  /* ── Data ── */

  async function loadData() {
    setLoading(true);
    try {
      const [taskSnap, subSnap, stuSnap] = await Promise.all([
        getDoc(doc(db, "tasks", assignmentId)),
        getDocs(query(collection(db, "submissions"), where("taskId", "==", assignmentId))),
        getDocs(query(collection(db, "students"), where("groupId", "==", groupId))),
      ]);

      if (taskSnap.exists()) {
        const d = taskSnap.data();
        setTask({ name: d.name, points: d.points, isActive: !!d.isActive });
      }

      const students: Student[] = stuSnap.docs.map(d => ({
        id:       d.id,
        name:     d.data().name     ?? "",
        lastName: d.data().lastName ?? "",
        gender:   d.data().gender   ?? "male",
        avatarId: d.data().avatarId ?? 1,
      }));
      setAllStudents(students);

      const studentMap: Record<string, string> = {};
      students.forEach(s => { studentMap[s.id] = `${s.name} ${s.lastName}`.trim(); });

      const rows: SubmissionRow[] = subSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id, studentId: data.studentId, taskId: data.taskId, groupId: data.groupId,
          iteration: data.iteration ?? 1,
          file: {
            driveFileId:   data.file?.driveFileId   ?? "",
            driveViewLink: data.file?.driveViewLink ?? "",
            fileUrl:       data.file?.fileUrl       ?? "",
            fileName:      data.file?.fileName      ?? "",
            fileSize:      data.file?.fileSize      ?? 0,
            mimeType:      data.file?.mimeType      ?? "",
          },
          note: data.note, status: data.status, feedback: data.feedback,
          gradedBy: data.gradedBy, grade: data.grade,
          isLate: data.isLate ?? false, daysLate: data.daysLate,
          submittedAt:  data.submittedAt?.toDate?.()  ?? new Date(),
          reviewedAt:   data.reviewedAt?.toDate?.(),
          completedAt:  data.completedAt?.toDate?.(),
          updatedAt:    data.updatedAt?.toDate?.()    ?? new Date(),
          studentName:  studentMap[data.studentId]    ?? "—",
        };
      });
      setSubmissions(rows);
    } finally {
      setLoading(false);
    }
  }

  /* ── Helpers ── */

  const getLatestSub = (studentId: string): SubmissionRow | null =>
    submissions
      .filter(s => s.studentId === studentId)
      .sort((a, b) => b.iteration - a.iteration)[0] ?? null;

  const getAllSubs = (studentId: string): SubmissionRow[] =>
    submissions
      .filter(s => s.studentId === studentId)
      .sort((a, b) => a.iteration - b.iteration);

  const grouped = {
    submitted: allStudents.filter(s => {
      const st = getLatestSub(s.id)?.status;
      return st === "submitted" || st === "reviewing" || st === "completed";
    }),
    revision: allStudents.filter(s => getLatestSub(s.id)?.status === "revision"),
    pending:  allStudents.filter(s => !getLatestSub(s.id)),
  };

  /* ── Checkbox ── */

  function toggleCheck(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setCheckedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleGroup(ids: string[]) {
    const allChecked = ids.every(id => checkedIds.has(id));
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (allChecked) ids.forEach(id => next.delete(id));
      else ids.forEach(id => next.add(id));
      return next;
    });
  }

  /* ── Bulk status ── */

  async function bulkSetStatus(status: SubmissionStatus) {
    if (!user || checkedIds.size === 0) return;
    setDropdownOpen(false);
    setActionLoading(true);
    try {
      await Promise.all(
        [...checkedIds].map(studentId => {
          const sub = getLatestSub(studentId);
          if (!sub) return Promise.resolve();
          return fetch(`/api/assignment-test/submissions/${sub.id}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status, authorId: user.uid }),
          });
        })
      );
      setCheckedIds(new Set());
      await loadData();
    } finally {
      setActionLoading(false);
    }
  }

  /* ── Yorum düzenle / sil ── */

  async function editComment(id: string, newText: string) {
    if (!viewingId) return;
    await updateDoc(
      doc(db, "tasks", assignmentId, "threads", viewingId, "comments", id),
      { text: newText, editedAt: serverTimestamp() },
    );
  }

  async function deleteComment(id: string) {
    if (!viewingId) return;
    await deleteDoc(doc(db, "tasks", assignmentId, "threads", viewingId, "comments", id));
  }

  /* ── Yorum gönder ── */

  async function sendComment() {
    if (!user || !commentText.trim() || sendingComment) return;
    setSendingComment(true);
    const authorName = `${user.name ?? ""} ${user.surname ?? ""}`.trim() || "Eğitmen";
    try {
      if (activeTab === "general") {
        /* Genel → tasks/{assignmentId}/comments */
        await addDoc(collection(db, "tasks", assignmentId, "comments"), {
          commentType: "general",
          authorId:   user.uid,
          authorType: "teacher",
          authorName,
          text:       commentText.trim(),
          createdAt:  serverTimestamp(),
        });
      } else {
        /* Özel → tasks/{assignmentId}/threads/{studentId}/comments */
        if (!viewingId) return;
        await addDoc(collection(db, "tasks", assignmentId, "threads", viewingId, "comments"), {
          commentType: "private",
          authorId:   user.uid,
          authorType: "teacher",
          authorName,
          text:       commentText.trim(),
          createdAt:  serverTimestamp(),
        });
      }
      setCommentText("");
    } finally {
      setSendingComment(false);
    }
  }

  /* ── Derived ── */

  const viewingStudent = allStudents.find(s => s.id === viewingId) ?? null;
  const viewingSub     = viewingId ? getLatestSub(viewingId) : null;
  const viewingAllSubs = viewingId ? getAllSubs(viewingId) : [];

  const visibleComments = activeTab === "general" ? generalComments : privateComments;

  if (authLoading || !user) return null;

  /* ── Render ── */

  return (
    <div className="flex h-screen overflow-hidden bg-white font-inter antialiased text-text-primary">
      <aside className="hidden lg:block h-full shrink-0 z-50 w-[280px] 2xl:w-[320px] bg-base-primary-900">
        <Sidebar />
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Header />

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-surface-400">
            <Loader2 size={22} className="animate-spin" />
          </div>
        ) : (
          <div className="flex-1 flex min-h-0 overflow-hidden">

            {/* ════════════ Sol Panel ════════════ */}
            <aside className="w-[360px] shrink-0 border-r border-surface-200 flex flex-col overflow-hidden bg-white">

              {/* Başlık */}
              <div className="px-5 pt-5 pb-4 border-b border-surface-100">
                <button
                  onClick={() => router.push(`/dashboard/assignment-test/${groupId}`)}
                  className="flex items-center gap-1.5 text-[12px] text-surface-400 hover:text-surface-600 transition-colors mb-3 cursor-pointer"
                >
                  <ArrowLeft size={13} /> Geri
                </button>

                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold text-text-primary leading-snug line-clamp-2">
                      {task?.name}
                    </p>
                    <p className="text-[12px] text-surface-400 mt-1">
                      {allStudents.length - grouped.pending.length} / {allStudents.length} teslim
                    </p>
                  </div>

                  {/* Toplu işlem dropdown */}
                  <div className="relative shrink-0" ref={dropdownRef}>
                    <button
                      onClick={() => setDropdownOpen(v => !v)}
                      disabled={checkedIds.size === 0 || actionLoading}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold border transition-colors
                        ${checkedIds.size > 0
                          ? "border-base-primary-300 text-base-primary-700 bg-base-primary-50 hover:bg-base-primary-100 cursor-pointer"
                          : "border-surface-200 text-surface-400 bg-surface-50 cursor-not-allowed"
                        }`}
                    >
                      {checkedIds.size > 0 ? `${checkedIds.size} seçili` : "Seçiniz"}
                      <ChevronDown size={12} />
                    </button>

                    {dropdownOpen && (
                      <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-surface-200 rounded-2xl shadow-xl z-50 overflow-hidden py-1.5">
                        <p className="px-4 pt-2 pb-1.5 text-[10px] font-bold text-surface-400 uppercase tracking-widest">
                          Toplu İşlem
                        </p>
                        {([
                          { label: "Teslim Edildi İşaretle", status: "submitted" },
                          { label: "Tamamlandı İşaretle",    status: "completed" },
                          { label: "Revize Gönder",          status: "revision"  },
                        ] as { label: string; status: SubmissionStatus }[]).map(({ label, status }) => (
                          <button
                            key={status}
                            onClick={() => bulkSetStatus(status)}
                            className="w-full text-left px-4 py-2.5 text-[13px] text-text-primary hover:bg-surface-50 transition-colors cursor-pointer"
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Öğrenci listesi */}
              <div className="flex-1 overflow-y-auto py-2 px-3">
                <StudentGroup
                  label="Teslim Edenler"
                  students={grouped.submitted}
                  viewingId={viewingId}
                  checkedIds={checkedIds}
                  getLatestSub={getLatestSub}
                  onView={setViewingId}
                  onToggleCheck={toggleCheck}
                  onToggleGroup={toggleGroup}
                />
                <StudentGroup
                  label="Teslim Etmeyenler"
                  students={grouped.pending}
                  viewingId={viewingId}
                  checkedIds={checkedIds}
                  getLatestSub={getLatestSub}
                  onView={setViewingId}
                  onToggleCheck={toggleCheck}
                  onToggleGroup={toggleGroup}
                />
                <StudentGroup
                  label="Revize Verilenler"
                  students={grouped.revision}
                  viewingId={viewingId}
                  checkedIds={checkedIds}
                  getLatestSub={getLatestSub}
                  onView={setViewingId}
                  onToggleCheck={toggleCheck}
                  onToggleGroup={toggleGroup}
                />
              </div>
            </aside>

            {/* ════════════ Sağ Panel ════════════ */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-surface-50">

              {!viewingStudent ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-[13px] text-surface-400">Sol listeden bir öğrenci seçin.</p>
                </div>
              ) : (
                <>
                  {/* Öğrenci header */}
                  <div className="px-7 py-4 border-b border-surface-200 bg-white flex items-center justify-between gap-4 shrink-0">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <StudentAvatar
                        gender={viewingStudent.gender}
                        avatarId={viewingStudent.avatarId}
                        size="lg"
                      />
                      <div className="min-w-0">
                        <h2 className="text-[17px] font-bold text-text-primary leading-tight">
                          {viewingStudent.name} {viewingStudent.lastName}
                        </h2>
                        {viewingSub ? (
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className={`text-[12px] font-semibold ${STATUS_COLOR[viewingSub.status]}`}>
                              {STATUS_LABEL[viewingSub.status]}
                            </span>
                            <span className="text-surface-300">·</span>
                            <span className="text-[12px] text-surface-400">
                              {fmtDateTime(viewingSub.submittedAt)}
                            </span>
                            {viewingSub.isLate && (
                              <>
                                <span className="text-surface-300">·</span>
                                <span className="text-[12px] text-red-500 font-semibold">
                                  {viewingSub.daysLate} gün geç
                                </span>
                              </>
                            )}
                          </div>
                        ) : (
                          <p className="text-[12px] text-status-danger-500 mt-0.5 font-medium">Henüz teslim yapmadı</p>
                        )}
                      </div>
                    </div>

                    {viewingSub && (
                      <button
                        onClick={() =>
                          router.push(
                            `/dashboard/assignment-test/${groupId}/${assignmentId}/${viewingSub.id}/preview`
                          )
                        }
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-base-primary-600 text-white text-[13px] font-semibold hover:bg-base-primary-700 transition-colors cursor-pointer shrink-0"
                      >
                        <ExternalLink size={14} /> Tam Ekran
                      </button>
                    )}
                  </div>

                  {/* Dosya içeriği */}
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    {!viewingSub ? (
                      <div className="h-full flex items-center justify-center">
                        <div className="flex flex-col items-center gap-3 text-surface-400">
                          <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center">
                            <FileText size={28} strokeWidth={1.5} />
                          </div>
                          <p className="text-[15px] font-semibold text-surface-500">Teslim Edilmedi</p>
                          <p className="text-[12px] text-surface-400 text-center max-w-[200px]">
                            Bu öğrenci henüz ödevi teslim etmedi.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 space-y-3">
                        {viewingAllSubs.map((sub, i) => (
                          <div key={sub.id} className="bg-white border border-surface-200 rounded-2xl p-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-surface-100 flex items-center justify-center shrink-0">
                              <FileText size={18} className="text-surface-400" strokeWidth={1.5} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-semibold text-text-primary truncate">
                                {sub.file.fileName || "dosya"}
                              </p>
                              <p className="text-[11px] text-surface-400 mt-0.5">
                                {mimeToLabel(sub.file.mimeType)} · {sub.file.fileSize ? `${(sub.file.fileSize / 1024).toFixed(0)} KB` : ""} · v{sub.iteration} · {fmtDateTime(sub.submittedAt)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {sub.file.driveViewLink && (
                                <a
                                  href={sub.file.driveViewLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-surface-200 text-surface-600 text-[12px] font-semibold hover:bg-surface-50 transition-colors"
                                >
                                  <ExternalLink size={12} /> Drive
                                </a>
                              )}
                              {sub.file.fileUrl && (
                                <a
                                  href={sub.file.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-base-primary-600 text-white text-[12px] font-semibold hover:bg-base-primary-700 transition-colors"
                                >
                                  <Download size={12} /> İndir
                                </a>
                              )}
                              <button
                                onClick={async () => {
                                  if (!window.confirm(`v${sub.iteration} teslimini silmek istediğine emin misin? Drive'dan da silinecek.`)) return;
                                  try {
                                    const token = await auth.currentUser?.getIdToken();
                                    const res = await fetch("/api/submissions/retract", {
                                      method:  "POST",
                                      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                      body:    JSON.stringify({ submissionId: sub.id }),
                                    });
                                    if (!res.ok) {
                                      const json = await res.json().catch(() => ({})) as { error?: string };
                                      alert(json.error ?? "Silme başarısız.");
                                      return;
                                    }
                                    await loadData();
                                  } catch {
                                    alert("Bağlantı hatası, tekrar dene.");
                                  }
                                }}
                                title="Teslimi sil"
                                className="p-1.5 rounded-lg hover:bg-status-danger-50 transition-colors text-surface-300 hover:text-status-danger-500 cursor-pointer"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                        {viewingSub.note && (
                          <div className="p-4 bg-white border border-surface-200 rounded-2xl">
                            <p className="text-[11px] font-bold text-surface-400 uppercase tracking-wider mb-1.5">Öğrenci Notu</p>
                            <p className="text-[13px] text-text-primary leading-relaxed">{viewingSub.note}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ════ Yorum Paneli ════ */}
                  <div className="shrink-0 border-t border-surface-200 bg-white flex flex-col overflow-hidden" style={{ height: 300 }}>

                    {/* Tab başlıkları */}
                    <div className="flex border-b border-surface-100 px-6 shrink-0">
                      {([
                        { key: "general", label: "Genel",                                                   icon: <Users size={12} /> },
                        { key: "private", label: viewingStudent ? `${viewingStudent.name} ${viewingStudent.lastName}`.trim() : "Özel", icon: <Lock  size={12} /> },
                      ] as const).map(({ key, label, icon }) => (
                        <button
                          key={key}
                          onClick={() => setActiveTab(key)}
                          className={`flex items-center gap-1.5 py-3 px-1 mr-6 text-[12px] font-semibold border-b-2 -mb-px transition-colors
                            ${activeTab === key
                              ? "border-base-primary-600 text-base-primary-700"
                              : "border-transparent text-surface-400 hover:text-surface-600"
                            }`}
                        >
                          {icon} {label}
                        </button>
                      ))}
                    </div>

                    {/* Yorum listesi */}
                    <div className="flex-1 overflow-y-auto px-6 py-3 space-y-4">
                      {visibleComments.length === 0 ? (
                        <p className="text-[12px] text-surface-400 text-center py-4">
                          {activeTab === "general" ? "Henüz genel yorum yok." : "Henüz yorum yok."}
                        </p>
                      ) : (
                        visibleComments.map(c => (
                          <CommentRow key={c.id} comment={c} myId={user.uid} onEdit={editComment} onDelete={deleteComment} />
                        ))
                      )}
                      <div ref={commentsEndRef} />
                    </div>

                    {/* Yorum input */}
                    <div className="shrink-0 px-4 pb-3 pt-2.5 border-t border-surface-100 flex items-end gap-2">
                      <textarea
                        value={commentText}
                        onChange={e => setCommentText(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            sendComment();
                          }
                        }}
                        placeholder={
                          activeTab === "general"
                            ? "Tüm sınıfa yorum ekle..."
                            : "Öğrenciye özel yorum yaz..."
                        }
                        rows={2}
                        className="flex-1 resize-none rounded-xl border border-surface-200 px-3 py-2 text-[13px] text-text-primary outline-none focus:border-base-primary-400 transition-colors bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <button
                        onClick={sendComment}
                        disabled={!commentText.trim() || sendingComment || (activeTab === "private" && !viewingId)}
                        className="w-9 h-9 rounded-xl bg-base-primary-600 text-white flex items-center justify-center hover:bg-base-primary-700 disabled:opacity-40 transition-colors cursor-pointer shrink-0"
                      >
                        {sendingComment
                          ? <Loader2 size={14} className="animate-spin" />
                          : <Send size={14} />
                        }
                      </button>
                    </div>
                  </div>
                </>
              )}
            </main>

          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════ Sub-components ════════════ */

/* ── CommentRow ── */

function CommentRow({
  comment, myId, onEdit, onDelete,
}: {
  comment: CommentItem;
  myId: string;
  onEdit?: (id: string, newText: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing,  setEditing]  = useState(false);
  const [editText, setEditText] = useState(comment.text);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const isMe     = comment.authorId === myId;
  const parts    = comment.authorName.trim().split(" ");
  const initials = ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();

  async function saveEdit() {
    const t = editText.trim();
    if (!t || t === comment.text) { setEditing(false); return; }
    await onEdit?.(comment.id, t);
    setEditing(false);
  }

  return (
    <div className="flex gap-2.5 items-start group">
      <div className="w-7 h-7 rounded-full bg-base-primary-100 text-base-primary-700 text-[11px] font-semibold flex items-center justify-center shrink-0 mt-0.5 select-none">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[12px] font-semibold text-text-primary">
            {isMe ? "Sen" : comment.authorName}
          </span>
          <span className="text-[10px] text-surface-400">{fmtTime(comment.createdAt)}</span>
          {isMe && !editing && (
            <div className="relative ml-auto" ref={menuRef}>
              <button
                onMouseDown={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
                className="p-1 rounded-lg bg-surface-100 hover:bg-surface-200 text-surface-500 hover:text-surface-800 transition-colors cursor-pointer"
              >
                <MoreHorizontal size={14} />
              </button>
              {menuOpen && (
                <div
                  className="absolute z-20 right-0 top-5 bg-white border border-surface-200 rounded-xl shadow-lg overflow-hidden min-w-[100px]"
                >
                  <button
                    onClick={() => { setEditText(comment.text); setEditing(true); setMenuOpen(false); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-text-primary hover:bg-surface-50 transition-colors cursor-pointer"
                  >
                    <Pencil size={11} /> Düzenle
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); onDelete?.(comment.id); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-status-danger-600 hover:bg-status-danger-50 transition-colors cursor-pointer"
                  >
                    <Trash2 size={11} /> Sil
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        {editing ? (
          <div className="flex flex-col gap-1.5">
            <textarea
              value={editText}
              onChange={e => setEditText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(); } }}
              rows={2}
              autoFocus
              className="w-full resize-none rounded-xl border border-base-primary-300 px-3 py-2 text-[13px] text-text-primary outline-none focus:border-base-primary-500 bg-white"
            />
            <div className="flex gap-1">
              <button onClick={() => setEditing(false)} className="px-2.5 py-1 text-[11px] rounded-lg bg-surface-100 text-text-secondary hover:bg-surface-200 transition-colors cursor-pointer">İptal</button>
              <button onClick={saveEdit} className="px-2.5 py-1 text-[11px] rounded-lg bg-base-primary-600 text-white hover:bg-base-primary-700 transition-colors cursor-pointer">Kaydet</button>
            </div>
          </div>
        ) : (
          <p className="text-[13px] text-text-secondary leading-snug">{comment.text}</p>
        )}
      </div>
    </div>
  );
}

/* ── FileCard ── */

function FileCard({
  sub, groupId, assignmentId, onNavigate,
}: {
  sub: SubmissionRow;
  groupId: string;
  assignmentId: string;
  onNavigate: (path: string) => void;
}) {
  const isImage    = sub.file.mimeType?.startsWith("image/");
  const thumbnailUrl = isImage && sub.file.driveFileId
    ? `https://drive.google.com/thumbnail?id=${sub.file.driveFileId}&sz=w120`
    : null;

  return (
    <div className="bg-white border border-surface-200 rounded-2xl p-4 flex items-center gap-4 hover:border-surface-300 transition-colors">
      <div className="w-14 h-14 rounded-xl bg-surface-100 overflow-hidden shrink-0 flex items-center justify-center">
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <FileText size={22} className="text-surface-400" strokeWidth={1.5} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-text-primary truncate">
          {sub.file.fileName || "dosya"}
        </p>
        <p className="text-[11px] text-surface-400 mt-0.5">
          {mimeToLabel(sub.file.mimeType)} · v{sub.iteration} · {fmtDateTime(sub.submittedAt)}
        </p>
      </div>
      <button
        onClick={() =>
          onNavigate(`/dashboard/assignment-test/${groupId}/${assignmentId}/${sub.id}/preview`)
        }
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-base-primary-200 text-base-primary-600 text-[12px] font-semibold hover:bg-base-primary-50 transition-colors cursor-pointer shrink-0"
      >
        <ExternalLink size={12} /> Detayı Gör
      </button>
    </div>
  );
}

/* ── StudentGroup ── */

function StudentGroup({
  label, students, viewingId, checkedIds, getLatestSub, onView, onToggleCheck, onToggleGroup,
}: {
  label: string;
  students: Student[];
  viewingId: string | null;
  checkedIds: Set<string>;
  getLatestSub: (id: string) => SubmissionRow | null;
  onView: (id: string) => void;
  onToggleCheck: (id: string, e: React.MouseEvent) => void;
  onToggleGroup: (ids: string[]) => void;
}) {
  if (students.length === 0) return null;

  const ids         = students.map(s => s.id);
  const allChecked  = ids.every(id => checkedIds.has(id));
  const someChecked = ids.some(id => checkedIds.has(id));

  return (
    <div className="mb-4">
      <div
        onClick={() => onToggleGroup(ids)}
        className="flex items-center gap-2.5 px-2 py-2 cursor-pointer rounded-lg hover:bg-surface-50 transition-colors"
      >
        <CheckBox checked={allChecked} indeterminate={someChecked && !allChecked} />
        <span className="text-[14px] font-semibold flex-1 text-text-primary">
          {label}
        </span>
        <span className="text-[11px] text-surface-400 font-medium">{students.length}</span>
      </div>

      {students.map(s => {
        const sub       = getLatestSub(s.id);
        const isViewing = s.id === viewingId;
        const isChecked = checkedIds.has(s.id);

        return (
          <div
            key={s.id}
            onClick={() => onView(s.id)}
            className={`flex items-center gap-2.5 px-2 py-2 rounded-xl transition-colors cursor-pointer mb-0.5
              ${isViewing ? "bg-base-primary-50" : "hover:bg-surface-50"}`}
          >
            <div onClick={e => onToggleCheck(s.id, e)}>
              <CheckBox checked={isChecked} />
            </div>

            <StudentAvatar gender={s.gender} avatarId={s.avatarId} size="sm" />

            <span className={`flex-1 text-[13px] font-medium truncate ${
              isViewing ? "text-base-primary-700" : "text-text-secondary"
            }`}>
              {s.name} {s.lastName}
            </span>

            {sub ? (
              <span className={`text-[11px] font-semibold shrink-0 ${STATUS_COLOR[sub.status]}`}>
                {STATUS_LABEL[sub.status]}
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-status-danger-500 shrink-0">
                Teslim Edilmedi
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
