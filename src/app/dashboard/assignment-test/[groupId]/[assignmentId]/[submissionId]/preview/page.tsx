"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/app/lib/firebase";
import {
  doc, getDoc, getDocs, collection, query, where,
  onSnapshot, orderBy, addDoc, serverTimestamp,
} from "firebase/firestore";
import { useUser } from "@/app/context/UserContext";
import {
  ArrowLeft, Loader2, RotateCcw, CheckCircle2,
  Send, Download, FileText, ChevronLeft, ChevronRight,
} from "lucide-react";
import type { Submission, SubmissionStatus } from "@/app/types/submission";

/* ── Types ── */

interface CommentItem {
  id: string;
  authorId: string;
  authorType: "teacher" | "student";
  authorName: string;
  text: string;
  createdAt: Date;
}

interface FileVersion {
  id: string;
  driveFileId: string;
  driveViewLink?: string;
  fileUrl: string;
  fileName: string;
  mimeType?: string;
  fileSize: number;
  versionNo: number;
  isLatest: boolean;
  uploadedAt: Date;
}

/* ── Helpers ── */

function fmtFull(d: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", weekday: "short",
  }).format(d);
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

const STATUS_MAP: Record<SubmissionStatus, { label: string; cls: string }> = {
  submitted: { label: "Teslim Edildi", cls: "bg-status-success-100 text-status-success-700 border-status-success-100" },
  reviewing: { label: "İncelemede",   cls: "bg-status-success-100 text-status-success-700 border-status-success-100" },
  revision:  { label: "Revize",       cls: "bg-blue-50 text-status-info border-blue-100" },
  completed: { label: "Tamamlandı",   cls: "bg-status-success-100 text-status-success-700 border-status-success-100" },
};

/* ── Avatar ── */

function StudentAvatar({ gender, avatarId, size = 36 }: { gender?: string; avatarId?: number; size?: number }) {
  const g  = gender === "female" ? "female" : "male";
  const id = Number(avatarId) || 1;
  return (
    <img
      src={`/avatars/${g}/${id}.svg`}
      alt=""
      style={{ width: size, height: size }}
      className="rounded-full object-cover shrink-0 bg-surface-100"
      onError={e => { (e.target as HTMLImageElement).src = `/avatars/${g}/1.svg`; }}
    />
  );
}

/* ── Page ── */

export default function SubmissionPreviewPage() {
  const { user, loading: authLoading } = useUser();
  const router = useRouter();
  const params = useParams<{ groupId: string; assignmentId: string; submissionId: string }>();
  const { groupId, assignmentId, submissionId } = params;

  /* Data */
  const [submission,      setSubmission]      = useState<Submission | null>(null);
  const [studentName,     setStudentName]     = useState("");
  const [studentGender,   setStudentGender]   = useState<string>("male");
  const [studentAvatarId, setStudentAvatarId] = useState<number>(1);
  const [taskName,        setTaskName]        = useState("");
  const [files,           setFiles]           = useState<FileVersion[]>([]);
  const [activeFileId,    setActiveFileId]    = useState<string | undefined>();
  const [loading,         setLoading]         = useState(true);

  /* Comments — sadece özel thread */
  const [comments,       setComments]       = useState<CommentItem[]>([]);
  const [commentText,    setCommentText]    = useState("");
  const [sendingComment, setSendingComment] = useState(false);

  /* Actions */
  const [actionLoading, setActionLoading] = useState(false);
  const [toast,         setToast]         = useState<{ msg: string; ok: boolean } | null>(null);

  const commentsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!authLoading && !user) router.push("/login"); }, [user, authLoading, router]);
  useEffect(() => { if (user) loadData(); }, [user, submissionId]);

  /* Real-time: öğrenci–eğitmen thread */
  useEffect(() => {
    if (!submissionId) return;
    const q = query(
      collection(db, "submissions", submissionId, "comments"),
      orderBy("createdAt", "asc"),
    );
    return onSnapshot(q, snap => {
      setComments(snap.docs.map(d => ({
        id:         d.id,
        authorId:   d.data().authorId   ?? "",
        authorType: d.data().authorType ?? "teacher",
        authorName: d.data().authorName ?? "—",
        text:       d.data().text ?? d.data().body ?? "",
        createdAt:  d.data().createdAt?.toDate?.() ?? new Date(),
      })));
    });
  }, [submissionId]);

  /* Yeni yorum gelince en alta kaydır */
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  /* ── Data ── */

  async function loadData() {
    setLoading(true);
    try {
      const subSnap = await getDoc(doc(db, "submissions", submissionId));
      if (!subSnap.exists()) return;
      const sd = subSnap.data();

      const [taskSnap, studentSnap, filesSnap] = await Promise.all([
        getDoc(doc(db, "tasks", sd.taskId)),
        getDoc(doc(db, "students", sd.studentId)),
        getDocs(query(
          collection(db, "submission_files"),
          where("submissionId", "==", submissionId),
        )),
      ]);

      setSubmission({
        id: subSnap.id,
        studentId: sd.studentId, taskId: sd.taskId, groupId: sd.groupId,
        iteration: sd.iteration ?? 1,
        file: {
          driveFileId:   sd.file?.driveFileId   ?? "",
          driveViewLink: sd.file?.driveViewLink ?? "",
          fileUrl:       sd.file?.fileUrl       ?? "",
          fileName:      sd.file?.fileName      ?? "",
          fileSize:      sd.file?.fileSize      ?? 0,
          mimeType:      sd.file?.mimeType      ?? "",
        },
        note: sd.note, status: sd.status, feedback: sd.feedback,
        gradedBy: sd.gradedBy, grade: sd.grade,
        isLate: sd.isLate ?? false, daysLate: sd.daysLate,
        submittedAt: sd.submittedAt?.toDate?.()  ?? new Date(),
        reviewedAt:  sd.reviewedAt?.toDate?.(),
        completedAt: sd.completedAt?.toDate?.(),
        updatedAt:   sd.updatedAt?.toDate?.()    ?? new Date(),
      });

      if (studentSnap.exists()) {
        const st = studentSnap.data();
        setStudentName(`${st.name ?? ""} ${st.lastName ?? ""}`.trim());
        setStudentGender(st.gender ?? "male");
        setStudentAvatarId(st.avatarId ?? 1);
      }
      if (taskSnap.exists()) setTaskName(taskSnap.data().name ?? "");

      const versionList: FileVersion[] = filesSnap.docs
        .map(d => ({
          id:           d.id,
          driveFileId:  d.data().driveFileId  ?? "",
          driveViewLink: d.data().driveViewLink,
          fileUrl:      d.data().fileUrl      ?? "",
          fileName:     d.data().fileName     ?? "",
          mimeType:     d.data().mimeType,
          fileSize:     d.data().fileSize     ?? 0,
          versionNo:    d.data().versionNo    ?? 1,
          isLatest:     d.data().isLatest     ?? false,
          uploadedAt:   d.data().uploadedAt?.toDate?.() ?? new Date(),
        }))
        .sort((a, b) => a.versionNo - b.versionNo);

      const effectiveFiles = versionList.length > 0 ? versionList : [{
        id: "main",
        driveFileId:  sd.file?.driveFileId  ?? "",
        driveViewLink: sd.file?.driveViewLink,
        fileUrl:      sd.file?.fileUrl      ?? "",
        fileName:     sd.file?.fileName     ?? "",
        mimeType:     sd.file?.mimeType,
        fileSize:     sd.file?.fileSize     ?? 0,
        versionNo: 1, isLatest: true,
        uploadedAt: sd.submittedAt?.toDate?.() ?? new Date(),
      }];

      setFiles(effectiveFiles);
      const latest = effectiveFiles.find(f => f.isLatest) ?? effectiveFiles[effectiveFiles.length - 1];
      setActiveFileId(latest?.id);
    } finally {
      setLoading(false);
    }
  }

  /* ── Actions ── */

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleStatus(status: SubmissionStatus) {
    if (!user || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/assignment-test/submissions/${submissionId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, authorId: user.uid }),
      });
      if (!res.ok) throw new Error();
      showToast(status === "completed" ? "Teslim onaylandı!" : "Revizyon istendi.", true);
      await loadData();
    } catch {
      showToast("İşlem başarısız.", false);
    } finally {
      setActionLoading(false);
    }
  }

  async function sendComment() {
    if (!user || !commentText.trim() || sendingComment) return;
    setSendingComment(true);
    const authorName = `${user.name ?? ""} ${user.surname ?? ""}`.trim() || "Eğitmen";
    try {
      await addDoc(collection(db, "submissions", submissionId, "comments"), {
        authorId:   user.uid,
        authorType: "teacher",
        authorName,
        text:       commentText.trim(),
        createdAt:  serverTimestamp(),
      });
      setCommentText("");
    } finally {
      setSendingComment(false);
    }
  }

  /* ── Derived ── */

  const activeFile = files.find(f => f.id === activeFileId) ?? files[0] ?? null;
  const previewUrl = activeFile?.driveViewLink
    ? activeFile.driveViewLink.replace("/view", "/preview")
    : null;

  if (authLoading || !user) return null;

  /* ── Render ── */

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white font-inter antialiased text-text-primary">

      {/* ── Top bar ── */}
      <div className="shrink-0 h-[56px] border-b border-surface-200 bg-white flex items-center gap-4 px-5">
        <button
          onClick={() => router.push(`/dashboard/assignment-test/${groupId}/${assignmentId}`)}
          className="flex items-center gap-1.5 text-[13px] font-semibold text-surface-500 hover:text-base-primary-600 transition-colors cursor-pointer shrink-0"
        >
          <ArrowLeft size={15} /> Geri
        </button>

        <div className="w-px h-5 bg-surface-200" />

        <StudentAvatar gender={studentGender} avatarId={studentAvatarId} size={30} />

        <div className="min-w-0 flex items-center gap-2">
          <span className="text-[14px] font-bold text-text-primary truncate">{studentName}</span>
          {taskName && (
            <span className="text-[12px] text-surface-400 truncate hidden sm:block">· {taskName}</span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2 shrink-0">
          {submission && (
            <span className={`px-3 py-1 rounded-full text-[12px] font-semibold border ${STATUS_MAP[submission.status].cls}`}>
              {STATUS_MAP[submission.status].label}
            </span>
          )}
          {submission && (
            <>
              <button
                onClick={() => handleStatus("revision")}
                disabled={actionLoading || submission.status === "completed"}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-orange-200 bg-orange-50 text-orange-600 text-[12px] font-semibold hover:bg-orange-100 transition-colors cursor-pointer disabled:opacity-40"
              >
                <RotateCcw size={13} /> Revizyon İste
              </button>
              <button
                onClick={() => handleStatus("completed")}
                disabled={actionLoading || submission.status === "completed"}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 text-white text-[12px] font-semibold hover:bg-emerald-600 transition-colors cursor-pointer disabled:opacity-40"
              >
                <CheckCircle2 size={13} /> Onayla
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Main split ── */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-surface-400">
          <Loader2 size={22} className="animate-spin" />
        </div>
      ) : !submission ? (
        <div className="flex-1 flex items-center justify-center text-[14px] text-surface-400">
          Teslim bulunamadı.
        </div>
      ) : (
        <div className="flex-1 flex min-h-0 overflow-hidden">

          {/* ── Sol: Dosya önizleme ── */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#1a1a1a]">

            {/* Versiyon bar */}
            {files.length > 1 && (
              <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-[#111] border-b border-white/10">
                <button
                  onClick={() => {
                    const idx = files.findIndex(f => f.id === activeFileId);
                    if (idx > 0) setActiveFileId(files[idx - 1].id);
                  }}
                  disabled={files[0].id === activeFileId}
                  className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-white/60 hover:bg-white/20 disabled:opacity-30 cursor-pointer"
                >
                  <ChevronLeft size={14} />
                </button>
                {files.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setActiveFileId(f.id)}
                    className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer
                      ${f.id === activeFileId
                        ? "bg-white text-[#1a1a1a]"
                        : "text-white/60 hover:text-white hover:bg-white/10"
                      }`}
                  >
                    v{f.versionNo}
                  </button>
                ))}
                <button
                  onClick={() => {
                    const idx = files.findIndex(f => f.id === activeFileId);
                    if (idx < files.length - 1) setActiveFileId(files[idx + 1].id);
                  }}
                  disabled={files[files.length - 1].id === activeFileId}
                  className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-white/60 hover:bg-white/20 disabled:opacity-30 cursor-pointer"
                >
                  <ChevronRight size={14} />
                </button>
                {activeFile?.fileUrl && (
                  <a
                    href={activeFile.fileUrl}
                    download={activeFile.fileName}
                    className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/10 text-white/60 hover:bg-white/20 hover:text-white text-[11px] font-semibold transition-colors"
                  >
                    <Download size={12} /> İndir
                  </a>
                )}
              </div>
            )}

            {/* Önizleme */}
            <div className="flex-1 min-h-0">
              {previewUrl ? (
                <iframe src={previewUrl} className="w-full h-full border-0" allow="autoplay" />
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-4 text-white/40">
                  <FileText size={40} strokeWidth={1.2} />
                  <p className="text-[14px]">Önizleme mevcut değil</p>
                  {activeFile?.fileUrl && (
                    <a
                      href={activeFile.fileUrl}
                      download
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 text-white/70 hover:bg-white/20 text-[13px] font-semibold transition-colors"
                    >
                      <Download size={14} /> Dosyayı İndir
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Sağ: Öğrenci–Eğitmen Konuşması ── */}
          <div className="w-[360px] shrink-0 border-l border-surface-200 flex flex-col overflow-hidden bg-white">

            {/* Başlık */}
            <div className="shrink-0 px-5 py-3.5 border-b border-surface-100 flex items-center gap-3">
              <StudentAvatar gender={studentGender} avatarId={studentAvatarId} size={34} />
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-text-primary leading-tight">{studentName}</p>
                <p className="text-[11px] text-surface-400">{fmtFull(submission.submittedAt)}</p>
              </div>
              {submission.note && (
                <div
                  title={submission.note}
                  className="ml-auto w-6 h-6 rounded-full bg-surface-100 flex items-center justify-center text-surface-400 cursor-default shrink-0"
                >
                  <span className="text-[11px]">i</span>
                </div>
              )}
            </div>

            {/* Thread */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {comments.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-surface-400">
                  <p className="text-[13px] font-medium">Henüz mesaj yok</p>
                  <p className="text-[12px] text-center max-w-[200px] leading-relaxed">
                    Öğrenciye geri bildirim vermek için aşağıya yaz.
                  </p>
                </div>
              ) : (
                comments.map(c => <ThreadMessage key={c.id} comment={c} myId={user.uid} />)
              )}
              <div ref={commentsEndRef} />
            </div>

            {/* Input */}
            <div className="shrink-0 border-t border-surface-100 px-4 py-3 flex items-end gap-2">
              <textarea
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendComment(); }
                }}
                placeholder="Öğrenciye yorum yaz..."
                rows={2}
                className="flex-1 resize-none rounded-xl border border-surface-200 px-3 py-2.5 text-[13px] text-text-primary outline-none focus:border-base-primary-400 transition-colors bg-white"
              />
              <button
                onClick={sendComment}
                disabled={!commentText.trim() || sendingComment}
                className="w-9 h-9 rounded-xl bg-base-primary-600 text-white flex items-center justify-center hover:bg-base-primary-700 disabled:opacity-40 transition-colors cursor-pointer shrink-0"
              >
                {sendingComment
                  ? <Loader2 size={14} className="animate-spin" />
                  : <Send size={14} />
                }
              </button>
            </div>
          </div>

        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-2xl text-white text-[13px] font-bold shadow-xl z-50
          ${toast.ok ? "bg-emerald-500" : "bg-red-500"}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

/* ── ThreadMessage ── */

function ThreadMessage({ comment, myId }: { comment: CommentItem; myId: string }) {
  const isMe      = comment.authorId === myId;
  const isTeacher = comment.authorType === "teacher";

  /* İlk harf baş harfleri */
  const parts    = comment.authorName.trim().split(" ");
  const initials = ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();

  return (
    <div className={`flex gap-2.5 items-start ${isMe ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div className={`w-7 h-7 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 select-none
        ${isTeacher
          ? "bg-base-primary-600 text-white"
          : "bg-surface-200 text-surface-600"
        }`}
      >
        {initials}
      </div>

      {/* Balon */}
      <div className={`max-w-[78%] ${isMe ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
        <span className={`text-[11px] font-semibold text-surface-400 ${isMe ? "text-right" : "text-left"}`}>
          {isMe ? "Sen" : comment.authorName}
        </span>
        <div className={`px-3.5 py-2.5 rounded-2xl text-[13px] leading-snug
          ${isMe
            ? "bg-base-primary-600 text-white rounded-tr-sm"
            : "bg-surface-100 text-text-primary rounded-tl-sm"
          }`}
        >
          {comment.text}
        </div>
        <span className="text-[10px] text-surface-400">
          {fmtTime(comment.createdAt)}
        </span>
      </div>
    </div>
  );
}
