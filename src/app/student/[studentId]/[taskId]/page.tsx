"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/app/lib/firebase";
import {
  doc, getDoc, getDocs, collection, query, where,
  onSnapshot, orderBy, addDoc, serverTimestamp,
} from "firebase/firestore";
import {
  ArrowLeft, Loader2, Upload, FileText, CheckCircle2,
  RotateCcw, Send, Clock, X, AlertCircle,
} from "lucide-react";
import StudentSidebar from "@/app/components/student/StudentSidebar";
import type { SubmissionStatus } from "@/app/types/submission";

/* ── Types ── */

interface Student {
  name: string;
  lastName: string;
  gender?: string;
  avatarId?: number;
  groupId: string;
}

interface Task {
  name: string;
  points: number;
  endDate?: string;
  description?: string;
}

interface SubmissionRow {
  id: string;
  status: SubmissionStatus;
  iteration: number;
  fileName: string;
  mimeType: string;
  fileSize: number;
  driveViewLink?: string;
  submittedAt: Date;
  isLate: boolean;
  daysLate?: number;
  feedback?: string;
  note?: string;
}

interface CommentItem {
  id: string;
  authorType: "teacher" | "student";
  authorName: string;
  text: string;
  createdAt: Date;
}

/* ── Helpers ── */

const ACCEPTED = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "video/mp4", "video/quicktime", "video/webm",
].join(",");

const MAX_MB = 50;

const STATUS_UI: Record<SubmissionStatus, { label: string; cls: string }> = {
  submitted: { label: "Teslim Edildi",     cls: "bg-status-success-100 text-status-success-700 border-status-success-100" },
  reviewing: { label: "İncelemede",        cls: "bg-status-success-100 text-status-success-700 border-status-success-100" },
  revision:  { label: "Revize Bekleniyor", cls: "bg-blue-50 text-status-info border-blue-100" },
  completed: { label: "Tamamlandı",        cls: "bg-status-success-100 text-status-success-700 border-status-success-100" },
};

function fmtDate(d: Date): string {
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

function formatBytes(b: number): string {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function deadlineMeta(endDate?: string) {
  if (!endDate) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const end   = new Date(endDate); end.setHours(0, 0, 0, 0);
  const diff  = Math.round((end.getTime() - today.getTime()) / 86400000);
  if (diff < 0)   return { text: `${Math.abs(diff)} gün önce bitti`, danger: true, warn: false };
  if (diff === 0) return { text: "Bugün son gün",                    danger: false, warn: true  };
  if (diff <= 3)  return { text: `${diff} gün kaldı`,               danger: false, warn: true  };
  return           { text: `${diff} gün kaldı`,                      danger: false, warn: false };
}

/* ── Avatar ── */

function StudentAvatar({ gender, avatarId, size = 30 }: { gender?: string; avatarId?: number; size?: number }) {
  const g  = gender === "female" ? "female" : "male";
  const id = Number(avatarId) || 1;
  return (
    <img
      src={`/avatars/${g}/${id}.svg`}
      alt=""
      style={{ width: size, height: size }}
      className="rounded-full object-cover bg-surface-100 shrink-0"
      onError={e => { (e.target as HTMLImageElement).src = `/avatars/${g}/1.svg`; }}
    />
  );
}

/* ── Page ── */

export default function StudentTaskDetailPage() {
  const { studentId, taskId } = useParams<{ studentId: string; taskId: string }>();
  const router = useRouter();

  const [student,     setStudent]     = useState<Student | null>(null);
  const [task,        setTask]        = useState<Task | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [loading,     setLoading]     = useState(true);

  /* Upload */
  const [file,        setFile]        = useState<File | null>(null);
  const [note,        setNote]        = useState("");
  const [uploading,   setUploading]   = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver,    setDragOver]    = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* Comments */
  const [comments,       setComments]       = useState<CommentItem[]>([]);
  const [commentText,    setCommentText]    = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadData(); }, [studentId, taskId]);

  /* Real-time yorumlar */
  useEffect(() => {
    const latestSub = submissions[0] ?? null;
    if (!latestSub) return;
    const q = query(
      collection(db, "submissions", latestSub.id, "comments"),
      orderBy("createdAt", "asc"),
    );
    return onSnapshot(q, snap => {
      setComments(snap.docs.map(d => ({
        id:         d.id,
        authorType: d.data().authorType ?? "teacher",
        authorName: d.data().authorName ?? "—",
        text:       d.data().text ?? d.data().body ?? "",
        createdAt:  d.data().createdAt?.toDate?.() ?? new Date(),
      })));
    });
  }, [submissions]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  async function loadData() {
    setLoading(true);
    try {
      const [stuSnap, taskSnap, subSnap] = await Promise.all([
        getDoc(doc(db, "students", studentId)),
        getDoc(doc(db, "tasks", taskId)),
        getDocs(query(
          collection(db, "submissions"),
          where("studentId", "==", studentId),
          where("taskId",    "==", taskId),
        )),
      ]);

      if (stuSnap.exists()) {
        const sd = stuSnap.data();
        setStudent({ name: sd.name ?? "", lastName: sd.lastName ?? "", gender: sd.gender, avatarId: sd.avatarId, groupId: sd.groupId ?? "" });
      }

      if (taskSnap.exists()) {
        const td = taskSnap.data();
        setTask({ name: td.name ?? "", points: td.points ?? 0, endDate: td.endDate, description: td.description });
      }

      const rows: SubmissionRow[] = subSnap.docs
        .map(d => {
          const data = d.data();
          return {
            id:           d.id,
            status:       data.status,
            iteration:    data.iteration ?? 1,
            fileName:     data.file?.fileName ?? "",
            mimeType:     data.file?.mimeType ?? "",
            fileSize:     data.file?.fileSize ?? 0,
            driveViewLink: data.file?.driveViewLink,
            submittedAt:  data.submittedAt?.toDate?.() ?? new Date(),
            isLate:       data.isLate ?? false,
            daysLate:     data.daysLate,
            feedback:     data.feedback,
            note:         data.note,
          };
        })
        .sort((a, b) => b.iteration - a.iteration);

      setSubmissions(rows);
    } finally {
      setLoading(false);
    }
  }

  /* ── Upload ── */

  const validateFile = useCallback((f: File): string | null => {
    if (f.size > MAX_MB * 1024 * 1024) return `Dosya ${MAX_MB} MB'dan büyük olamaz.`;
    return null;
  }, []);

  function pickFile(f: File) {
    const err = validateFile(f);
    if (err) { setUploadError(err); return; }
    setUploadError(null);
    setFile(f);
  }

  async function handleSubmit() {
    if (!file || !student || !task || uploading) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("studentId", studentId);
      fd.append("taskId",    taskId);
      fd.append("groupId",   student.groupId);
      fd.append("file",      file);
      if (note.trim()) fd.append("note", note.trim());

      const res = await fetch("/api/submit", { method: "POST", body: fd });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Yükleme başarısız.");
      }
      setFile(null);
      setNote("");
      await loadData();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Bilinmeyen hata.");
    } finally {
      setUploading(false);
    }
  }

  /* ── Comment ── */

  async function sendComment() {
    const latestSub = submissions[0] ?? null;
    if (!commentText.trim() || sendingComment || !latestSub || !student) return;
    setSendingComment(true);
    try {
      await addDoc(collection(db, "submissions", latestSub.id, "comments"), {
        authorType: "student",
        authorName: `${student.name} ${student.lastName}`.trim(),
        text:       commentText.trim(),
        createdAt:  serverTimestamp(),
      });
      setCommentText("");
    } finally {
      setSendingComment(false);
    }
  }

  /* ── Derived ── */

  const latestSub = submissions[0] ?? null;
  const canUpload = !latestSub || latestSub.status === "revision";
  const dl        = deadlineMeta(task?.endDate);

  if (loading || !student || !task) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-50">
        <Loader2 size={22} className="animate-spin text-surface-400" />
      </div>
    );
  }

  const studentFullName = `${student.name} ${student.lastName}`.trim();

  return (
    <div className="flex h-screen overflow-hidden bg-white font-inter antialiased text-text-primary">

      {/* ── Sidebar ── */}
      <aside className="hidden lg:flex h-full shrink-0 z-50 w-[280px] 2xl:w-[320px] bg-base-primary-900 flex-col">
        <StudentSidebar />
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">

        {/* Top bar */}
        <header className="shrink-0 h-14 bg-white border-b border-surface-200 flex items-center gap-3 px-6">
          <button
            onClick={() => router.push(`/student/${studentId}`)}
            className="flex items-center gap-1.5 body-sm font-semibold text-surface-500 hover:text-base-primary-600 transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft size={15} /> Geri
          </button>

          <div className="w-px h-5 bg-surface-200" />

          <StudentAvatar gender={student.gender} avatarId={student.avatarId} size={30} />

          <div className="min-w-0 flex-1 flex items-center gap-2.5">
            <span className="text-[14px] font-bold text-text-primary truncate">{task.name}</span>
            {task.points > 0 && (
              <span className="text-[12px] text-surface-400 shrink-0 hidden sm:block">{task.points} puan</span>
            )}
            {dl && (
              <span className={`body-sm shrink-0 hidden md:block ${
                dl.danger ? "text-status-danger-500 font-semibold" :
                dl.warn   ? "text-status-warning font-medium" :
                "text-surface-400"
              }`}>· {dl.text}</span>
            )}
          </div>

          {latestSub && (
            <span className={`text-[11px] font-semibold px-3 py-1 rounded-full border shrink-0 ${STATUS_UI[latestSub.status].cls}`}>
              {STATUS_UI[latestSub.status].label}
            </span>
          )}
        </header>

        {/* İçerik */}
        <div className="flex-1 flex min-h-0 overflow-hidden">

          {/* ════ Orta: Upload + Geçmiş ════ */}
          <div className="flex-1 overflow-y-auto bg-surface-50">
            <div className="min-h-full flex items-center justify-center py-8 px-8">
            <div className="w-full max-w-2xl xl:max-w-3xl space-y-5">

              {/* Revize bildirimi */}
              {latestSub?.status === "revision" && (
                <div className="bg-blue-50 border border-blue-100 rounded-2xl px-6 py-5 flex gap-3">
                  <RotateCcw size={18} className="text-status-info shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[14px] font-bold text-status-info">Revize İstendi</p>
                    {latestSub.feedback && (
                      <p className="body-sm text-text-secondary mt-1 leading-relaxed">{latestSub.feedback}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Tamamlandı bildirimi */}
              {latestSub?.status === "completed" && (
                <div className="bg-status-success-100 border border-status-success-100 rounded-2xl px-6 py-5 flex gap-3">
                  <CheckCircle2 size={18} className="text-status-success-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[14px] font-bold text-status-success-700">Ödev Tamamlandı</p>
                    {task.points > 0 && (
                      <p className="body-sm text-status-success-700/70 mt-0.5">{task.points} puan kazandın.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Bekliyor bildirimi */}
              {(latestSub?.status === "submitted" || latestSub?.status === "reviewing") && (
                <div className="bg-white border border-surface-200 rounded-2xl px-6 py-5 flex gap-3">
                  <Clock size={18} className="text-surface-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[14px] font-bold text-text-secondary">Eğitmen İnceliyor</p>
                    <p className="body-sm text-surface-400 mt-0.5">Teslimini aldık. Eğitmen inceleme yapıyor.</p>
                  </div>
                </div>
              )}

              {/* ── Upload alanı ── */}
              {canUpload && (
                <div className="bg-white border border-surface-200 rounded-2xl p-6 space-y-5">
                  <p className="text-[15px] font-bold text-text-primary">
                    {latestSub?.status === "revision" ? "Revize Dosyası Yükle" : "Ödev Yükle"}
                  </p>

                  {/* Drop zone — büyütülmüş */}
                  <div
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => {
                      e.preventDefault();
                      setDragOver(false);
                      const f = e.dataTransfer.files[0];
                      if (f) pickFile(f);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-4 cursor-pointer transition-colors
                      ${dragOver
                        ? "border-base-primary-400 bg-base-primary-50"
                        : file
                        ? "border-status-success-500 bg-status-success-100/20"
                        : "border-surface-200 hover:border-base-primary-300 bg-surface-50 hover:bg-base-primary-50"
                      }`}
                    style={{ minHeight: "clamp(220px, 30vh, 380px)" }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={ACCEPTED}
                      className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f); }}
                    />

                    {file ? (
                      <>
                        <div className="w-16 h-16 rounded-2xl bg-status-success-100 flex items-center justify-center">
                          <FileText size={28} className="text-status-success-700" />
                        </div>
                        <div className="text-center">
                          <p className="text-[15px] font-semibold text-text-primary">{file.name}</p>
                          <p className="body-sm text-surface-400 mt-1">{formatBytes(file.size)}</p>
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); setFile(null); setUploadError(null); }}
                          className="flex items-center gap-1.5 body-sm text-surface-400 hover:text-status-danger-500 transition-colors cursor-pointer"
                        >
                          <X size={13} /> Kaldır
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center">
                          <Upload size={28} className="text-surface-400" />
                        </div>
                        <div className="text-center">
                          <p className="text-[15px] font-semibold text-text-secondary">
                            Dosyayı buraya sürükle veya tıkla seç
                          </p>
                          <p className="body-sm text-surface-400 mt-1.5">
                            PDF, Resim, Word, PowerPoint, Video · Maks {MAX_MB} MB
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Not */}
                  <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Eğitmene not ekle (isteğe bağlı)..."
                    rows={3}
                    className="w-full resize-none rounded-xl border border-surface-200 px-4 py-3 body-sm
                      text-text-primary outline-none focus:border-base-primary-400 transition-colors bg-white"
                  />

                  {uploadError && (
                    <div className="flex items-center gap-2 body-sm text-status-danger-500">
                      <AlertCircle size={14} /> {uploadError}
                    </div>
                  )}

                  <button
                    onClick={handleSubmit}
                    disabled={!file || uploading}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl
                      bg-base-primary-600 text-white text-[14px] font-bold
                      hover:bg-base-primary-700 transition-colors cursor-pointer
                      disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {uploading ? (
                      <><Loader2 size={16} className="animate-spin" /> Yükleniyor...</>
                    ) : (
                      <><Upload size={16} /> Teslim Et</>
                    )}
                  </button>
                </div>
              )}

              {/* Geçmiş teslimler */}
              {submissions.length > 0 && (
                <div className="bg-white border border-surface-200 rounded-2xl p-6">
                  <p className="text-[12px] font-bold text-surface-400 uppercase tracking-widest mb-4">
                    Teslim Geçmişi
                  </p>
                  <div className="space-y-3">
                    {submissions.map(sub => (
                      <HistoryRow key={sub.id} sub={sub} />
                    ))}
                  </div>
                </div>
              )}

            </div>
            </div>
          </div>

          {/* ════ Sağ: Yorumlar ════ */}
          <div className="w-[320px] shrink-0 border-l border-surface-200 flex flex-col overflow-hidden bg-white">

            <div className="shrink-0 px-5 py-4 border-b border-surface-100">
              <p className="text-[13px] font-bold text-text-primary">Yorumlar</p>
              {!latestSub && (
                <p className="body-sm text-surface-400 mt-0.5">Teslim ettikten sonra aktif olur.</p>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {!latestSub ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-surface-400 text-center">
                  <p className="body-sm max-w-[180px] leading-relaxed">
                    Teslim yaptıktan sonra eğitmenle yazışabilirsin.
                  </p>
                </div>
              ) : comments.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-surface-400">
                  <p className="body-sm font-medium">Henüz yorum yok</p>
                  <p className="text-[12px] text-center max-w-[180px] leading-relaxed">
                    Eğitmenin yorum yazdığında burada görünecek.
                  </p>
                </div>
              ) : (
                comments.map(c => (
                  <ThreadBubble
                    key={c.id}
                    comment={c}
                    studentName={studentFullName}
                  />
                ))
              )}
              <div ref={commentsEndRef} />
            </div>

            <div className="shrink-0 border-t border-surface-100 px-4 py-3 flex items-end gap-2">
              <textarea
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendComment(); }
                }}
                disabled={!latestSub}
                placeholder={latestSub ? "Eğitmene yorum yaz..." : "Teslim gerekiyor..."}
                rows={2}
                className="flex-1 resize-none rounded-xl border border-surface-200 px-3 py-2.5 body-sm
                  text-text-primary outline-none focus:border-base-primary-400 transition-colors bg-white
                  disabled:opacity-40 disabled:cursor-not-allowed"
              />
              <button
                onClick={sendComment}
                disabled={!commentText.trim() || sendingComment || !latestSub}
                className="w-9 h-9 rounded-xl bg-base-primary-600 text-white flex items-center justify-center
                  hover:bg-base-primary-700 disabled:opacity-40 transition-colors cursor-pointer shrink-0"
              >
                {sendingComment
                  ? <Loader2 size={14} className="animate-spin" />
                  : <Send size={14} />
                }
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

/* ── HistoryRow ── */

function HistoryRow({ sub }: { sub: SubmissionRow }) {
  const st = STATUS_UI[sub.status];
  return (
    <div className="flex items-center gap-3 py-3 border-b border-surface-100 last:border-0">
      <div className="w-9 h-9 rounded-xl bg-surface-100 flex items-center justify-center shrink-0">
        <FileText size={16} className="text-surface-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="body-sm font-semibold text-text-primary truncate">{sub.fileName || "dosya"}</p>
        <p className="text-[11px] text-surface-400 mt-0.5">
          v{sub.iteration} · {fmtDate(sub.submittedAt)}
          {sub.isLate && <span className="text-status-danger-500 font-medium"> · {sub.daysLate} gün geç</span>}
        </p>
      </div>
      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
        sub.status === "revision"  ? "bg-blue-50 text-status-info" :
        sub.status === "completed" ? "bg-status-success-100 text-status-success-700" :
        "bg-surface-100 text-surface-500"
      }`}>
        {st.label}
      </span>
    </div>
  );
}

/* ── ThreadBubble ── */

function ThreadBubble({ comment, studentName }: { comment: CommentItem; studentName: string }) {
  const isStudent = comment.authorType === "student";
  const parts     = comment.authorName.trim().split(" ");
  const initials  = ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();

  return (
    <div className={`flex gap-2.5 items-start ${isStudent ? "flex-row-reverse" : ""}`}>
      <div className={`w-7 h-7 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 select-none ${
        isStudent ? "bg-base-primary-600 text-white" : "bg-surface-200 text-text-secondary"
      }`}>
        {initials}
      </div>
      <div className={`max-w-[80%] flex flex-col gap-0.5 ${isStudent ? "items-end" : "items-start"}`}>
        <span className="text-[11px] font-semibold text-surface-400">
          {isStudent ? "Sen" : comment.authorName}
        </span>
        <div className={`px-3.5 py-2.5 rounded-2xl body-sm leading-snug ${
          isStudent
            ? "bg-base-primary-600 text-white rounded-tr-sm"
            : "bg-surface-100 text-text-primary rounded-tl-sm"
        }`}>
          {comment.text}
        </div>
        <span className="text-[10px] text-surface-400">{fmtTime(comment.createdAt)}</span>
      </div>
    </div>
  );
}
