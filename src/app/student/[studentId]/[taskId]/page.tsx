"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, auth } from "@/app/lib/firebase";
import {
  doc, getDoc, collection, query, where,
  onSnapshot, orderBy, addDoc, updateDoc, deleteDoc, serverTimestamp,
} from "firebase/firestore";
import {
  ArrowLeft, Loader2, Upload, FileText, CheckCircle2,
  RotateCcw, Send, Clock, X, AlertCircle, Download, ExternalLink, Trash2,
  MoreHorizontal, Pencil,
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
  driveFileId?: string;
  fileUrl?: string;
  submittedAt: Date;
  isLate: boolean;
  daysLate?: number;
  feedback?: string;
  note?: string;
}

interface CommentItem {
  id: string;
  authorId: string;
  authorType: "teacher" | "student";
  authorName: string;
  text: string;
  createdAt: Date;
}

/* ── Helpers ── */

const ACCEPTED = [
  // Görseller
  "image/jpeg", "image/png", "image/gif", "image/webp",
  // Belgeler
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  // Video
  "video/mp4", "video/quicktime", "video/webm",
  // Arşiv
  "application/zip", "application/x-zip-compressed", ".zip", ".rar",
  // Tasarım dosyaları
  "image/vnd.adobe.photoshop", "application/photoshop", "application/x-photoshop", ".psd",
  "application/illustrator", "application/postscript", ".ai", ".eps",
].join(",");

const MAX_MB      = 250;
const CHUNK_SIZE  = 256 * 1024; // 256 KB

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
  const [file,          setFile]          = useState<File | null>(null);
  const [note,          setNote]          = useState("");
  const [uploading,     setUploading]     = useState(false);
  const [uploadError,   setUploadError]   = useState<string | null>(null);
  const [dragOver,      setDragOver]      = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadPhase,   setUploadPhase]   = useState<"idle" | "init" | "uploading" | "completing">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* Comments */
  const [comments,       setComments]       = useState<CommentItem[]>([]);
  const [commentText,    setCommentText]    = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadData(); }, [studentId, taskId]);

  /* Real-time submissions — eğitmen sildiğinde/güncellediğinde anlık yansır */
  useEffect(() => {
    const q = query(
      collection(db, "submissions"),
      where("studentId", "==", studentId),
      where("taskId",    "==", taskId),
    );
    const unsub = onSnapshot(q, snap => {
      const rows: SubmissionRow[] = snap.docs
        .map(d => {
          const data = d.data();
          return {
            id:           d.id,
            status:       data.status,
            iteration:    data.iteration ?? 1,
            fileName:      data.file?.fileName ?? "",
            mimeType:      data.file?.mimeType ?? "",
            fileSize:      data.file?.fileSize ?? 0,
            driveViewLink: data.file?.driveViewLink,
            driveFileId:   data.file?.driveFileId,
            fileUrl:       data.file?.fileUrl,
            submittedAt:  data.submittedAt?.toDate?.() ?? new Date(),
            isLate:       data.isLate ?? false,
            daysLate:     data.daysLate,
            feedback:     data.feedback,
            note:         data.note,
          };
        })
        .sort((a, b) => b.iteration - a.iteration);
      setSubmissions(rows);
    }, err => { if (err.code !== "permission-denied") console.error("[submissions-rt]", err); });
    return unsub;
  }, [studentId, taskId]);

  /* Real-time yorumlar — submission olmadan da çalışır */
  useEffect(() => {
    const q = query(
      collection(db, "tasks", taskId, "threads", studentId, "comments"),
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
    }, err => { if (err.code !== "permission-denied") console.error("[comments]", err); });
  }, [studentId, taskId]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  async function loadData() {
    setLoading(true);
    try {
      const [stuSnap, taskSnap] = await Promise.all([
        getDoc(doc(db, "students", studentId)),
        getDoc(doc(db, "tasks", taskId)),
      ]);

      if (stuSnap.exists()) {
        const sd = stuSnap.data();
        setStudent({ name: sd.name ?? "", lastName: sd.lastName ?? "", gender: sd.gender, avatarId: sd.avatarId, groupId: sd.groupId ?? "" });
      }

      if (taskSnap.exists()) {
        const td = taskSnap.data();
        setTask({ name: td.name ?? "", points: td.points ?? 0, endDate: td.endDate, description: td.description });
      }
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
    setUploadProgress(0);
    setUploadPhase("init");

    try {
      // 1. Auth token
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Oturum bulunamadı, lütfen tekrar giriş yapın.");

      // 2. Resumable session başlat (Vercel'de sadece küçük JSON geçer)
      const initRes = await fetch("/api/submissions/init-resumable-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          studentId,
          taskId,
          groupId:  student.groupId,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || "application/octet-stream",
        }),
      });

      if (!initRes.ok) {
        const json = await initRes.json().catch(() => ({}));
        throw new Error(json.error ?? "Upload başlatılamadı.");
      }

      const { uploadId, totalBytes } = await initRes.json() as {
        uploadId: string; totalBytes: number;
        currentUploads: number; maxUploads: number; uploadsRemaining: number;
      };

      // 3. Chunk'ları /api/submissions/upload-chunk üzerinden ilet
      //    Vercel → Google Drive (CORS yok, sessionUri browser'a gitmez)
      setUploadPhase("uploading");
      let uploadedBytes = 0;
      let driveFileId: string | null | undefined;
      const mimeType = file.type || "application/octet-stream";

      while (uploadedBytes < totalBytes) {
        const start = uploadedBytes;
        const end   = Math.min(start + CHUNK_SIZE, totalBytes);
        const chunk = file.slice(start, end);

        const chunkRes = await fetch("/api/submissions/upload-chunk", {
          method:  "POST",
          headers: {
            "Authorization":  `Bearer ${token}`,
            "x-upload-id":    uploadId,
            "content-range":  `bytes ${start}-${end - 1}/${totalBytes}`,
            "x-file-type":    mimeType,
          },
          body: chunk,
        });

        if (!chunkRes.ok) {
          const json = await chunkRes.json().catch(() => ({})) as { error?: string; detail?: string };
          throw new Error(json.detail ? `${json.error}: ${json.detail}` : (json.error ?? `Chunk upload başarısız (${chunkRes.status})`));
        }

        const result = await chunkRes.json() as {
          status: "incomplete" | "complete";
          uploadedBytes?: number;
          driveFileId?: string | null;
        };

        if (result.status === "complete") {
          driveFileId   = result.driveFileId;
          uploadedBytes = totalBytes;
        } else {
          // Drive'ın onayladığı offset'i kullan (varsa), yoksa end
          uploadedBytes = result.uploadedBytes ?? end;
        }

        setUploadProgress(Math.round((uploadedBytes / totalBytes) * 100));
      }

      // 4. Backend'e tamamlandığını bildir → submission oluşturulsun
      setUploadPhase("completing");
      const completeRes = await fetch("/api/submissions/complete-upload", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          uploadId,
          ...(driveFileId  ? { driveFileId }       : {}),
          ...(note.trim()  ? { note: note.trim() } : {}),
        }),
      });

      if (!completeRes.ok) {
        const json = await completeRes.json().catch(() => ({}));
        throw new Error(json.error ?? "Upload tamamlanamadı.");
      }

      setFile(null);
      setNote("");
      setUploadProgress(0);
      setUploadPhase("idle");
      await loadData();

    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Bilinmeyen hata.");
      setUploadPhase("idle");
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  }

  /* ── Comment ── */

  async function editComment(id: string, newText: string) {
    await updateDoc(
      doc(db, "tasks", taskId, "threads", studentId, "comments", id),
      { text: newText, editedAt: serverTimestamp() },
    );
  }

  async function deleteComment(id: string) {
    await deleteDoc(doc(db, "tasks", taskId, "threads", studentId, "comments", id));
  }

  async function sendComment() {
    if (!commentText.trim() || sendingComment || !student) return;
    setSendingComment(true);
    try {
      await addDoc(collection(db, "tasks", taskId, "threads", studentId, "comments"), {
        authorType: "student",
        authorId:   auth.currentUser?.uid ?? "",
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

  const latestSub        = submissions[0] ?? null;
  const canUpload        = !latestSub || latestSub.status === "revision";
  const dl               = deadlineMeta(task?.endDate);
  const isDueDatePassed  = dl?.danger === true;
  const hasTeacherGrade = !!latestSub?.feedback || (latestSub as any)?.grade !== undefined;
  const uploadLimit      = latestSub?.status === "revision" ? 8 : 5;
  const uploadUsed       = submissions.length;

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

                  {/* Başlık + upload counter */}
                  <div className="flex items-center justify-between">
                    <p className="text-[15px] font-bold text-text-primary">
                      {latestSub?.status === "revision" ? "Revize Dosyası Yükle" : "Ödev Yükle"}
                    </p>
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                      uploadUsed >= uploadLimit - 1
                        ? "bg-status-danger-50 text-status-danger-500"
                        : uploadUsed >= uploadLimit - 2
                        ? "bg-orange-50 text-orange-500"
                        : "bg-surface-100 text-surface-500"
                    }`}>
                      {uploadUsed}/{uploadLimit}
                    </span>
                  </div>

                  {/* Drop zone */}
                  <div
                    onDragOver={e => { e.preventDefault(); if (!uploading) setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => {
                      e.preventDefault();
                      setDragOver(false);
                      if (uploading) return;
                      const f = e.dataTransfer.files[0];
                      if (f) pickFile(f);
                    }}
                    onClick={() => { if (!uploading) fileInputRef.current?.click(); }}
                    className={`border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-4 transition-colors
                      ${uploading
                        ? "border-base-primary-200 bg-base-primary-50/50 cursor-default"
                        : dragOver
                        ? "border-base-primary-400 bg-base-primary-50 cursor-pointer"
                        : file
                        ? "border-status-success-500 bg-status-success-100/20 cursor-pointer"
                        : "border-surface-200 hover:border-base-primary-300 bg-surface-50 hover:bg-base-primary-50 cursor-pointer"
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

                    {uploading ? (
                      /* ── Progress state ── */
                      <div className="w-full px-8 flex flex-col items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-base-primary-50 flex items-center justify-center">
                          <Loader2 size={24} className="animate-spin text-base-primary-600" />
                        </div>
                        <div className="w-full space-y-2">
                          <div className="h-2 bg-surface-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-base-primary-600 rounded-full transition-all duration-200"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-[12px] text-surface-500 font-medium">
                              {uploadPhase === "init"
                                ? "Başlatılıyor..."
                                : uploadPhase === "completing"
                                ? "Kaydediliyor..."
                                : `${uploadProgress}%`}
                            </p>
                            {uploadPhase === "uploading" && (
                              <p className="text-[12px] text-surface-400">
                                {formatBytes(file ? file.size * uploadProgress / 100 : 0)} / {formatBytes(file?.size ?? 0)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : file ? (
                      /* ── Dosya seçildi ── */
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
                      /* ── Boş state ── */
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
                    disabled={uploading}
                    placeholder="Eğitmene not ekle (isteğe bağlı)..."
                    rows={3}
                    className="w-full resize-none rounded-xl border border-surface-200 px-4 py-3 body-sm
                      text-text-primary outline-none focus:border-base-primary-400 transition-colors bg-white
                      disabled:opacity-40 disabled:cursor-not-allowed"
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
                      <><Loader2 size={16} className="animate-spin" /> {
                        uploadPhase === "init"       ? "Başlatılıyor..." :
                        uploadPhase === "completing" ? "Kaydediliyor..." :
                        `Yükleniyor ${uploadProgress}%`
                      }</>
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
                    {submissions.map((sub, idx) => (
                      <HistoryRow
                        key={sub.id}
                        sub={sub}
                        isDueDatePassed={isDueDatePassed}
                        hasTeacherActivity={idx === 0 ? hasTeacherGrade : false}
                        onDelete={async (submissionId) => {
                          if (!window.confirm("Bu teslimi geri çekmek istediğine emin misin? Dosya Drive'dan da silinecek.")) return;
                          try {
                            const token = await auth.currentUser?.getIdToken();
                            const res = await fetch("/api/submissions/retract", {
                              method:  "POST",
                              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                              body:    JSON.stringify({ submissionId }),
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
                      />
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
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {comments.length === 0 ? (
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
                    myId={auth.currentUser?.uid ?? ""}
                    onEdit={editComment}
                    onDelete={deleteComment}
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
                placeholder="Eğitmene yorum yaz..."
                rows={2}
                className="flex-1 resize-none rounded-xl border border-surface-200 px-3 py-2.5 body-sm
                  text-text-primary outline-none focus:border-base-primary-400 transition-colors bg-white
                  disabled:opacity-40 disabled:cursor-not-allowed"
              />
              <button
                onClick={sendComment}
                disabled={!commentText.trim() || sendingComment}
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

function HistoryRow({
  sub,
  isDueDatePassed = false,
  hasTeacherActivity = false,
  onDelete,
}: {
  sub: SubmissionRow;
  isDueDatePassed?: boolean;
  hasTeacherActivity?: boolean;
  onDelete?: (submissionId: string) => void;
}) {
  const st = STATUS_UI[sub.status];
  const canDelete =
    (sub.status === "submitted" || sub.status === "revision") &&
    !isDueDatePassed &&
    !hasTeacherActivity;

  return (
    <div className="flex items-center gap-3 py-3 border-b border-surface-100 last:border-0">
      <div className="w-9 h-9 rounded-xl bg-surface-100 flex items-center justify-center shrink-0">
        <FileText size={16} className="text-surface-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="body-sm font-semibold text-text-primary truncate">{sub.fileName || "dosya"}</p>
        <p className="text-[11px] text-surface-400 mt-0.5">
          v{sub.iteration} · {fmtDate(sub.submittedAt)}
          {sub.isLate && sub.daysLate != null && (
            <span className="text-status-danger-500 font-medium"> · {sub.daysLate} gün geç</span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {sub.driveViewLink && (
          <a href={sub.driveViewLink} target="_blank" rel="noopener noreferrer"
            className="p-1.5 rounded-lg hover:bg-surface-100 transition-colors text-surface-400 hover:text-text-secondary">
            <ExternalLink size={13} />
          </a>
        )}
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
          sub.status === "revision"  ? "bg-blue-50 text-status-info" :
          sub.status === "completed" ? "bg-status-success-100 text-status-success-700" :
          "bg-surface-100 text-surface-500"
        }`}>
          {st.label}
        </span>
        {canDelete && onDelete && (
          <button
            onClick={() => onDelete(sub.id)}
            title="Teslimi geri çek"
            className="p-1.5 rounded-lg hover:bg-status-danger-50 transition-colors text-surface-300 hover:text-status-danger-500 cursor-pointer"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ── ThreadBubble ── */

function ThreadBubble({
  comment, studentName, myId = "", onEdit, onDelete,
}: {
  comment: CommentItem;
  studentName: string;
  myId?: string;
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

  const isStudent = comment.authorType === "student";
  const canAct    = !!myId && comment.authorId === myId;
  const parts     = comment.authorName.trim().split(" ");
  const initials  = ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();

  async function saveEdit() {
    const t = editText.trim();
    if (!t || t === comment.text) { setEditing(false); return; }
    await onEdit?.(comment.id, t);
    setEditing(false);
  }

  return (
    <div className={`flex gap-2.5 items-start group ${isStudent ? "flex-row-reverse" : ""}`}>
      <div className={`w-7 h-7 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 select-none ${
        isStudent ? "bg-base-primary-600 text-white" : "bg-surface-200 text-text-secondary"
      }`}>
        {initials}
      </div>
      <div className={`max-w-[80%] flex flex-col gap-0.5 ${isStudent ? "items-end" : "items-start"}`}>
        {/* İsim + menü */}
        <div className={`flex items-center gap-1 ${isStudent ? "flex-row-reverse" : ""}`}>
          <span className="text-[11px] font-semibold text-surface-400">
            {isStudent ? "Sen" : comment.authorName}
          </span>
          {canAct && !editing && (
            <div className="relative" ref={menuRef}>
              <button
                onMouseDown={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
                className="p-1 rounded-lg bg-surface-100 hover:bg-surface-200 text-surface-500 hover:text-surface-800 transition-colors cursor-pointer"
              >
                <MoreHorizontal size={13} />
              </button>
              {menuOpen && (
                <div
                  className={`absolute z-20 top-5 ${isStudent ? "right-0" : "left-0"} bg-white border border-surface-200 rounded-xl shadow-lg overflow-hidden min-w-[100px]`}
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

        {/* Balon / edit */}
        {editing ? (
          <div className="flex flex-col gap-1.5 w-full">
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
          <div className={`px-3.5 py-2.5 rounded-2xl body-sm leading-snug ${
            isStudent
              ? "bg-base-primary-600 text-white rounded-tr-sm"
              : "bg-surface-100 text-text-primary rounded-tl-sm"
          }`}>
            {comment.text}
          </div>
        )}
        <span className="text-[10px] text-surface-400">{fmtTime(comment.createdAt)}</span>
      </div>
    </div>
  );
}
