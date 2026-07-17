"use client";

/**
 * FlexOS · Ödev Detay + Yükleme — canlıdaki `/student/[studentId]/[taskId]/page.tsx` portu.
 * Görünüm/işleyiş birebir: drag-drop, 256KB chunk'lı resumable upload, teslim geçmişi,
 * geri çekme, sağda 1:1 yorum paneli. Backend: FlexOS Submission/Comment domain'i (Faz 2+3).
 * Ödev/teslim durumu HÂLÂ polling (6sn) — chat 2026-07-13'ten beri `chats/{chatId}/messages`
 * üzerinden DOĞRUDAN Firestore `onSnapshot` ile okunuyor (gerçek anlık, canlıdaki
 * `tasks/{id}/threads/{studentId}/comments` ile AYNI desen — bkz. firestore.rules).
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { auth, db } from "@/app/lib/firebase";
import { collection, onSnapshot, orderBy, query, type Timestamp } from "firebase/firestore";
import { toast } from "sonner";
import {
  ArrowLeft, Loader2, Upload, FileText, CheckCircle2,
  RotateCcw, Send, Clock, X, Download, ExternalLink, Trash2,
  MoreHorizontal, Pencil,
} from "lucide-react";
import StudentSidebar from "../../_components/StudentSidebar";

/* ── Types ── */

type SubmissionStatus = "submitted" | "reviewing" | "revision" | "completed" | "retracted";

interface AssignmentDetail {
  id: string;
  title: string;
  description: string;
  dueDate?: string;
  groupId: string;
  attachments: { fileName: string; webViewLink: string }[];
}

interface SubmissionDetail {
  id: string;
  status: SubmissionStatus;
  iteration: number;
  grade?: number;
  isLate: boolean;
}

interface FileRow {
  id: string;
  fileName: string;
  fileSize: number;
  driveViewLink: string;
  versionNo: number;
  createdAt: string;
}

interface CommentItem {
  id: string;
  authorUid: string;
  authorType: "trainer" | "student";
  authorName: string;
  text: string;
  createdAt: string;
}

const STATUS_UI: Record<SubmissionStatus, { label: string; cls: string }> = {
  submitted: { label: "Teslim Edildi", cls: "bg-status-success-100 text-status-success-700 border-status-success-100" },
  reviewing: { label: "İncelemede", cls: "bg-status-success-100 text-status-success-700 border-status-success-100" },
  revision: { label: "Revize Durumunda", cls: "bg-blue-50 text-blue-700 border-blue-100" },
  completed: { label: "Tamamlandı", cls: "bg-status-success-100 text-status-success-700 border-status-success-100" },
  retracted: { label: "Geri Çekildi", cls: "bg-surface-100 text-surface-500 border-surface-200" },
};

const ACCEPTED = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "video/mp4", "video/quicktime", "video/webm",
  "application/zip", "application/x-zip-compressed",
].join(",");

const MAX_MB = 250;
const CHUNK_SIZE = 256 * 1024;
const POLL_MS = 6000;

type JobStatus = "pending" | "uploading" | "success" | "error";
interface UploadJobState { file: File; status: JobStatus; progress: number; error?: string }

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
}
function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}
function formatBytes(b: number): string {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
function deadlineMeta(dueDate?: string) {
  if (!dueDate) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const end = new Date(dueDate); end.setHours(0, 0, 0, 0);
  const diff = Math.round((end.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return { text: `${Math.abs(diff)} gün önce bitti`, danger: true, warn: false };
  if (diff === 0) return { text: "Bugün son gün", danger: false, warn: true };
  if (diff <= 3) return { text: `${diff} gün kaldı`, danger: false, warn: true };
  return { text: `${diff} gün kaldı`, danger: false, warn: false };
}

async function authHeaders(): Promise<Record<string, string>> {
  const u = auth.currentUser;
  const token = u ? await u.getIdToken() : "";
  return { Authorization: `Bearer ${token}` };
}

/* ── Page ── */

export default function FlexosStudentAssignmentDetail() {
  const { personId, assignmentId } = useParams<{ personId: string; assignmentId: string }>();
  const router = useRouter();

  const [assignment, setAssignment] = useState<AssignmentDetail | null>(null);
  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [pickedFiles, setPickedFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadJobs, setUploadJobs] = useState<UploadJobState[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentText, setCommentText] = useState("");
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const loadDetail = useCallback(async () => {
    const headers = await authHeaders();
    const res = await fetch(`/api/flexos/student/assignments/${assignmentId}?personId=${personId}`, { headers });
    if (!res.ok) return;
    const data = await res.json() as { assignment: AssignmentDetail; submission: SubmissionDetail | null; files: FileRow[] };
    setAssignment(data.assignment);
    setSubmission(data.submission);
    setFiles(data.files.sort((a, b) => b.versionNo - a.versionNo));
  }, [assignmentId, personId]);

  useEffect(() => {
    (async () => { setLoading(true); await loadDetail(); setLoading(false); })();
  }, [loadDetail]);

  /* Ödev/teslim durumu polling — 6sn'de bir tazele, sekme arka plandaysa durdur
     (Firestore kota bilinci). Chat BURADA DEĞİL — aşağıdaki onSnapshot'ta. */
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    function start() {
      if (timer) return;
      timer = setInterval(() => { loadDetail(); }, POLL_MS);
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function onVisibility() { if (document.visibilityState === "visible") start(); else stop(); }
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { stop(); document.removeEventListener("visibilitychange", onVisibility); };
  }, [loadDetail]);

  // Chat — `chats/{chatId}/messages`'ı DOĞRUDAN Firestore `onSnapshot` ile dinler
  // (2026-07-13 kararı, bkz. dosya başı yorumu). `chatId` server'daki `chatIdFor` ile
  // BİREBİR aynı formülle hesaplanır: `${assignmentId}_${personId}`.
  useEffect(() => {
    const chatId = `${assignmentId}_${personId}`;
    let cancelled = false;
    let unsub: (() => void) | undefined;
    (async () => {
      // Chat dokümanı garanti edilmeden `onSnapshot` "Missing or insufficient permissions"
      // atıyordu — rules'taki `get()` parent dokümanın VAR olmasını gerektiriyor
      // (2026-07-13 bug fix). İlk mesajdan ÖNCE bile çağrılmalı.
      try {
        const headers = await authHeaders();
        const ensureRes = await fetch(`/api/flexos/student/assignments/${assignmentId}/thread/ensure?personId=${personId}`, { method: "POST", headers });
        if (!ensureRes.ok) console.error("[student-thread-chat] ensure başarısız:", ensureRes.status, await ensureRes.text().catch(() => ""));
      } catch (e) { console.error("[student-thread-chat] ensure hata:", e); }
      if (cancelled) return;
      const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"));
      unsub = onSnapshot(q, (snap) => {
        setComments(snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            authorUid: data.authorUid ?? "",
            authorType: data.authorType ?? "trainer",
            authorName: data.authorName ?? "",
            text: data.text ?? "",
            createdAt: ((data.createdAt as Timestamp | undefined)?.toDate() ?? new Date()).toISOString(),
          };
        }));
      }, (err) => console.error("[student-thread-chat]", err));
    })();
    return () => { cancelled = true; unsub?.(); };
  }, [assignmentId, personId]);

  useEffect(() => { commentsEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [comments]);

  /* ── Upload ── */

  function pickFiles(incoming: FileList | File[]) {
    const valid = Array.from(incoming).filter((f) => f.size <= MAX_MB * 1024 * 1024);
    setPickedFiles((prev) => [...prev, ...valid]);
  }
  function removeFile(index: number) {
    setPickedFiles((prev) => prev.filter((_, i) => i !== index));
  }
  function updateJob(index: number, patch: Partial<UploadJobState>) {
    setUploadJobs((prev) => prev.map((j, i) => (i === index ? { ...j, ...patch } : j)));
  }

  async function uploadSingleFile(file: File, index: number, currentNote: string) {
    updateJob(index, { status: "uploading", progress: 0 });
    try {
      const headers = await authHeaders();
      const initRes = await fetch("/api/flexos/submissions/init-resumable-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          personId, assignmentId,
          fileName: file.name, fileSize: file.size,
          mimeType: file.type || "application/octet-stream",
        }),
      });
      if (!initRes.ok) {
        const json = await initRes.json().catch(() => ({})) as { error?: string };
        throw new Error(json.error ?? "Upload başlatılamadı.");
      }
      const { uploadId } = await initRes.json() as { uploadId: string };

      let uploadedBytes = 0;
      const totalBytes = file.size;
      let driveFileId: string | undefined;
      const mimeType = file.type || "application/octet-stream";

      while (uploadedBytes < totalBytes) {
        const start = uploadedBytes;
        const end = Math.min(start + CHUNK_SIZE, totalBytes);
        const chunk = file.slice(start, end);

        const chunkRes = await fetch("/api/flexos/submissions/upload-chunk", {
          method: "POST",
          headers: { ...headers, "x-upload-id": uploadId, "content-range": `bytes ${start}-${end - 1}/${totalBytes}`, "x-file-type": mimeType },
          body: chunk,
        });
        if (!chunkRes.ok) {
          const json = await chunkRes.json().catch(() => ({})) as { error?: string };
          throw new Error(json.error ?? `Chunk yükleme başarısız (${chunkRes.status})`);
        }
        const result = await chunkRes.json() as { status: string; uploadedBytes?: number; driveFileId?: string };
        if (result.status === "complete") { driveFileId = result.driveFileId; uploadedBytes = totalBytes; }
        else uploadedBytes = result.uploadedBytes ?? end;
        updateJob(index, { progress: Math.round((uploadedBytes / totalBytes) * 100) });
      }

      const completeRes = await fetch("/api/flexos/submissions/complete-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ uploadId, ...(driveFileId ? { driveFileId } : {}), ...(currentNote.trim() ? { note: currentNote.trim() } : {}) }),
      });
      if (!completeRes.ok) {
        const json = await completeRes.json().catch(() => ({})) as { error?: string };
        throw new Error(json.error ?? "Upload tamamlanamadı.");
      }

      updateJob(index, { status: "success", progress: 100 });
    } catch (err: unknown) {
      updateJob(index, { status: "error", error: err instanceof Error ? err.message : "Bilinmeyen hata." });
    }
  }

  async function handleSubmit() {
    if (pickedFiles.length === 0 || isUploading) return;
    setIsUploading(true);
    const currentNote = note;
    setUploadJobs(pickedFiles.map((f) => ({ file: f, status: "pending", progress: 0 })));

    const MAX = 4;
    for (let i = 0; i < pickedFiles.length; i += MAX) {
      await Promise.all(pickedFiles.slice(i, i + MAX).map((f, offset) => uploadSingleFile(f, i + offset, currentNote)));
    }

    setIsUploading(false);
    setPickedFiles([]);
    setNote("");
    setUploadJobs([]);
    await loadDetail();
    toast.success("Ödev teslim edildi.");
  }

  async function handleDeleteFile(fileId: string) {
    if (!submission) return;
    if (!window.confirm("Bu dosyayı silmek istediğine emin misin? Drive'dan da silinecek.")) return;
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/flexos/submissions/delete-file", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ submissionId: submission.id, fileId }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        toast.error(json.error ?? "Silme başarısız.");
        return;
      }
      await loadDetail();
      toast.success("Dosya silindi.");
    } catch {
      toast.error("Bağlantı hatası, tekrar dene.");
    }
  }

  async function handleRetract() {
    if (!submission) return;
    if (!window.confirm("Bu teslimi geri çekmek istediğine emin misin? Dosyalar Drive'dan da silinecek.")) return;
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/flexos/submissions/retract", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ submissionId: submission.id }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        toast.error(json.error ?? "Geri çekme başarısız.");
        return;
      }
      await loadDetail();
      toast.success("Teslim geri çekildi.");
    } catch {
      toast.error("Bağlantı hatası, tekrar dene.");
    }
  }

  async function sendComment() {
    const text = commentText.trim();
    if (!text) return;
    setCommentText("");
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/flexos/student/assignments/${assignmentId}/thread`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ personId, text }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        toast.error(json.error ?? "Yorum gönderilemedi.");
        return;
      }
      // Refetch YOK — `chats/{chatId}/messages`'a `onSnapshot` zaten dinliyor.
    } catch {
      toast.error("Bağlantı hatası, tekrar dene.");
    }
  }

  async function editComment(id: string, newText: string) {
    const headers = await authHeaders();
    await fetch(`/api/flexos/chats/${assignmentId}_${personId}/messages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ text: newText }),
    });
  }

  async function deleteComment(id: string) {
    const headers = await authHeaders();
    await fetch(`/api/flexos/chats/${assignmentId}_${personId}/messages/${id}`, { method: "DELETE", headers });
  }

  /* ── Derived ── */

  const dl = deadlineMeta(assignment?.dueDate);
  const isDueDatePassed = dl?.danger === true;
  const hasGrade = submission?.grade !== undefined;
  const uploadLimit = submission?.status === "revision" ? 8 : submission?.status === "completed" ? 0 : 5;
  const uploadUsed = files.length;
  const canUpload = uploadUsed < uploadLimit;

  if (loading || !assignment) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-50">
        <Loader2 size={22} className="animate-spin text-surface-400" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white font-inter antialiased text-text-primary">
      <StudentSidebar personId={personId} />

      {/* 2026-07-18 kullanıcı isteği: ödev detayı sert bir "pop" ile değil, hafif bir
          fade+slide-up ile açılsın — modallarda kullanılan AYNI framer-motion değerleri
          (0.22s, cubic-bezier [0.4,0,0.2,1], bkz. OdevOlusturModal.tsx/EditAssignmentModal.tsx). */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
        className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <header className="shrink-0 h-14 bg-white border-b border-surface-200 flex items-center gap-3 px-6">
          <button
            onClick={() => router.push(`/flexos/student/${personId}`)}
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-surface-200 bg-neutral-200 text-neutral-600 hover:bg-neutral-300 hover:text-neutral-900 hover:border-neutral-400 transition-all cursor-pointer shrink-0"
            title="Geri"
          >
            <ArrowLeft size={15} />
          </button>
          <div className="w-px h-5 bg-surface-200" />
          <div className="min-w-0 flex-1 flex items-center gap-2.5">
            <span className="text-[14px] font-bold text-text-primary truncate">{assignment.title}</span>
            {dl && (
              <span className={`text-[12px] shrink-0 hidden md:block ${dl.danger ? "text-status-danger-500 font-semibold" : dl.warn ? "text-status-warning font-medium" : "text-surface-400"}`}>
                · {dl.text}
              </span>
            )}
          </div>
          {submission && (
            <span className={`text-[11px] font-semibold px-3 py-1 rounded-full border shrink-0 ${STATUS_UI[submission.status].cls}`}>
              {STATUS_UI[submission.status].label}
            </span>
          )}
        </header>

        <div className="flex-1 flex min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto bg-surface-50">
            <div className="min-h-full flex items-center justify-center py-8 px-8">
              <div className="w-full max-w-2xl xl:max-w-3xl space-y-5">

                {submission?.status === "revision" && (
                  <div className="bg-blue-50 border border-blue-100 rounded-2xl px-6 py-5 flex gap-3">
                    <RotateCcw size={18} className="text-status-info shrink-0 mt-0.5" />
                    <p className="text-[14px] font-bold text-status-info">Revize İstendi — yeni bir dosya yükleyebilirsin.</p>
                  </div>
                )}
                {submission?.status === "completed" && (
                  <div className="bg-status-success-100 border border-status-success-100 rounded-2xl px-6 py-5 flex gap-3">
                    <CheckCircle2 size={18} className="text-status-success-700 shrink-0 mt-0.5" />
                    <p className="text-[14px] font-bold text-status-success-700">Ödev Tamamlandı{submission.grade != null ? ` — ${submission.grade}/100` : ""}</p>
                  </div>
                )}
                {(submission?.status === "submitted" || submission?.status === "reviewing") && (
                  <div className="bg-white border border-surface-200 rounded-2xl px-6 py-5 flex gap-3">
                    <Clock size={18} className="text-surface-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[14px] font-bold text-text-secondary">Eğitmen İnceliyor</p>
                      <p className="text-[13px] text-surface-400 mt-0.5">Teslimini aldık. Eğitmen inceleme yapıyor.</p>
                    </div>
                  </div>
                )}

                {assignment.attachments[0] && (
                  <div className="bg-white border border-surface-200 rounded-2xl px-6 py-4">
                    <p className="text-[11px] font-bold text-surface-400 uppercase tracking-widest mb-3">Ödev Dosyası</p>
                    <a
                      href={assignment.attachments[0].webViewLink}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 px-4 py-3 bg-surface-50 border border-surface-200 rounded-xl hover:border-base-primary-300 hover:bg-base-primary-50 transition-colors"
                    >
                      <div className="w-9 h-9 rounded-xl bg-base-primary-100 flex items-center justify-center shrink-0">
                        <Download size={16} className="text-base-primary-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-text-primary truncate">{assignment.attachments[0].fileName}</p>
                        <p className="text-[11px] text-surface-400">İndir / Görüntüle</p>
                      </div>
                      <ExternalLink size={14} className="text-surface-400 shrink-0" />
                    </a>
                  </div>
                )}

                {canUpload && (
                  <div className="bg-white border border-surface-200 rounded-2xl p-6 space-y-5">
                    <div className="flex items-center justify-between">
                      <p className="text-[15px] font-bold text-text-primary">
                        {submission?.status === "revision" ? "Revize Dosyası Yükle" : "Ödev Yükle"}
                      </p>
                      <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                        uploadUsed >= uploadLimit - 1 ? "bg-status-danger-50 text-status-danger-500" :
                        uploadUsed >= uploadLimit - 2 ? "bg-orange-50 text-orange-500" :
                        "bg-surface-100 text-surface-500"
                      }`}>
                        {uploadUsed}/{uploadLimit}
                      </span>
                    </div>

                    <div
                      onDragOver={(e) => { e.preventDefault(); if (!isUploading) setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => { e.preventDefault(); setDragOver(false); if (!isUploading) pickFiles(e.dataTransfer.files); }}
                      onClick={() => { if (!isUploading) fileInputRef.current?.click(); }}
                      className={`border-2 border-dashed rounded-2xl flex flex-col transition-colors ${
                        isUploading ? "border-base-primary-200 bg-base-primary-50/50 cursor-default" :
                        dragOver ? "border-base-primary-400 bg-base-primary-50 cursor-pointer" :
                        pickedFiles.length > 0 ? "border-status-success-400 bg-status-success-100/20 cursor-pointer" :
                        "border-surface-200 hover:border-base-primary-300 bg-surface-50 hover:bg-base-primary-50 cursor-pointer"
                      }`}
                      style={{ minHeight: "clamp(140px, 18vh, 240px)" }}
                    >
                      <input
                        ref={fileInputRef} type="file" accept={ACCEPTED} multiple className="hidden"
                        onChange={(e) => { if (e.target.files) pickFiles(e.target.files); e.target.value = ""; }}
                      />

                      {!isUploading && pickedFiles.length === 0 && (
                        <div className="flex flex-col items-center justify-center flex-1 gap-4 p-8">
                          <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center">
                            <Upload size={28} className="text-surface-400" />
                          </div>
                          <div className="text-center">
                            <p className="text-[15px] font-semibold text-text-secondary">Dosyayı buraya sürükle veya tıkla seç</p>
                            <p className="text-[13px] text-surface-400 mt-1.5">PDF, Resim, Word, PowerPoint, Video · Maks {MAX_MB} MB</p>
                          </div>
                        </div>
                      )}

                      {(pickedFiles.length > 0 || isUploading) && (
                        <div className="p-4 space-y-2 flex-1" onClick={(e) => e.stopPropagation()}>
                          {(isUploading ? uploadJobs : pickedFiles.map((f) => ({ file: f, status: "pending" as JobStatus, progress: 0, error: undefined }))).map((job, i) => (
                            <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-surface-100">
                              <div className="w-9 h-9 rounded-xl bg-base-primary-50 flex items-center justify-center shrink-0">
                                <FileText size={16} className="text-base-primary-600" />
                              </div>
                              <div className="flex-1 min-w-0 space-y-1">
                                <p className="text-[13px] font-semibold text-text-primary truncate">{job.file.name}</p>
                                {isUploading ? (
                                  job.status === "success" ? (
                                    <p className="text-[11px] text-status-success-500 font-semibold">Tamamlandı ✓</p>
                                  ) : job.status === "error" ? (
                                    <p className="text-[11px] text-status-danger-500">{job.error}</p>
                                  ) : (
                                    <div className="space-y-0.5">
                                      <div className="w-full h-1.5 bg-surface-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-base-primary-600 rounded-full transition-all duration-200" style={{ width: `${job.progress}%` }} />
                                      </div>
                                      <p className="text-[10px] text-surface-400">{job.status === "pending" ? "Sırada..." : `${job.progress}%`}</p>
                                    </div>
                                  )
                                ) : <p className="text-[11px] text-surface-400">{formatBytes(job.file.size)}</p>}
                              </div>
                              {!isUploading && (
                                <button onClick={() => removeFile(i)} className="text-surface-300 hover:text-status-danger-500 transition-colors cursor-pointer shrink-0">
                                  <X size={15} />
                                </button>
                              )}
                              {isUploading && job.status === "success" && <CheckCircle2 size={15} className="text-status-success-500 shrink-0" />}
                            </div>
                          ))}
                          {!isUploading && (
                            <button
                              onClick={() => fileInputRef.current?.click()}
                              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-surface-200 text-[12px] font-medium text-surface-400 hover:border-base-primary-300 hover:text-base-primary-500 transition-colors cursor-pointer"
                            >
                              <Upload size={12} /> Dosya ekle
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <textarea
                      value={note} onChange={(e) => setNote(e.target.value)} disabled={isUploading}
                      placeholder="Eğitmene not ekle (isteğe bağlı)..." rows={3}
                      className="w-full resize-none rounded-xl border border-surface-200 px-4 py-3 text-[13px] text-text-primary outline-none focus:border-base-primary-400 transition-colors bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                    />

                    <button
                      onClick={handleSubmit}
                      disabled={pickedFiles.length === 0 || isUploading}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-base-primary-600 text-white text-[14px] font-bold hover:bg-base-primary-700 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isUploading ? (<><Loader2 size={16} className="animate-spin" /> Yükleniyor...</>) : (<><Upload size={16} /> {pickedFiles.length > 1 ? `${pickedFiles.length} Dosyayı Teslim Et` : "Teslim Et"}</>)}
                    </button>
                  </div>
                )}

                {files.length > 0 && (
                  <div className="bg-white border border-surface-200 rounded-2xl p-6">
                    <p className="text-[12px] font-bold text-surface-400 uppercase tracking-widest mb-4">Teslim Geçmişi</p>
                    <div className="space-y-3">
                      {files.map((f) => {
                        const canDelete = submission != null && (submission.status === "submitted" || submission.status === "revision") && !isDueDatePassed && !hasGrade;
                        return (
                          <div key={f.id} className="flex items-center gap-3 py-3 border-b border-surface-100 last:border-0">
                            <div className="w-9 h-9 rounded-xl bg-surface-100 flex items-center justify-center shrink-0">
                              <FileText size={16} className="text-surface-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-semibold text-text-primary truncate">{f.fileName || "dosya"}</p>
                              <p className="text-[11px] text-surface-400 mt-0.5">
                                v{f.versionNo} · {fmtDate(f.createdAt)}
                                {submission?.isLate && <span className="text-status-danger-500 font-medium"> · geç</span>}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {f.driveViewLink && (
                                <a href={f.driveViewLink} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-surface-100 transition-colors text-surface-400 hover:text-text-secondary">
                                  <ExternalLink size={13} />
                                </a>
                              )}
                              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-status-success-100 text-status-success-700">Teslim Edildi</span>
                              {canDelete && (
                                <button onClick={() => handleDeleteFile(f.id)} title="Dosyayı sil" className="p-1.5 rounded-lg hover:bg-status-danger-50 transition-colors text-surface-300 hover:text-status-danger-500 cursor-pointer">
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {submission && (submission.status === "submitted" || submission.status === "revision") && !isDueDatePassed && !hasGrade && (
                      <button
                        onClick={handleRetract}
                        className="mt-4 w-full py-2.5 rounded-xl border border-status-danger-200 text-[13px] font-semibold text-status-danger-500 hover:bg-status-danger-50 transition-colors cursor-pointer"
                      >
                        Teslimi Geri Çek
                      </button>
                    )}
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
                  <p className="text-[13px] font-medium">Henüz yorum yok</p>
                  <p className="text-[12px] text-center max-w-[180px] leading-relaxed">Eğitmenin yorum yazdığında burada görünecek.</p>
                </div>
              ) : (
                comments.map((c) => (
                  <ThreadBubble key={c.id} comment={c} myUid={auth.currentUser?.uid ?? ""} onEdit={editComment} onDelete={deleteComment} />
                ))
              )}
              <div ref={commentsEndRef} />
            </div>
            <div className="shrink-0 border-t border-surface-100 px-4 py-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendComment(); } }}
                  placeholder="Eğitmene yorum yaz..." rows={2}
                  className="flex-1 resize-none rounded-xl border border-surface-200 px-3 py-2.5 text-[13px] text-text-primary outline-none focus:border-base-primary-400 transition-colors bg-white"
                />
                <button
                  onClick={sendComment}
                  disabled={!commentText.trim()}
                  className="w-9 h-9 rounded-xl bg-base-primary-600 text-white flex items-center justify-center hover:bg-base-primary-700 disabled:opacity-40 transition-colors cursor-pointer shrink-0"
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ── ThreadBubble ── */

function ThreadBubble({ comment, myUid, onEdit, onDelete }: {
  comment: CommentItem; myUid: string;
  onEdit: (id: string, newText: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.text);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const isStudent = comment.authorType === "student";
  const canAct = !!myUid && comment.authorUid === myUid;
  const parts = comment.authorName.trim().split(" ");
  const initials = ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();

  async function saveEdit() {
    const t = editText.trim();
    if (!t || t === comment.text) { setEditing(false); return; }
    await onEdit(comment.id, t);
    setEditing(false);
  }

  return (
    <div className={`flex gap-2.5 items-start group ${isStudent ? "flex-row-reverse" : ""}`}>
      <div className={`w-7 h-7 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 select-none ${isStudent ? "bg-base-primary-600 text-white" : "bg-surface-200 text-text-secondary"}`}>
        {initials}
      </div>
      <div className={`max-w-[80%] flex flex-col gap-0.5 ${isStudent ? "items-end" : "items-start"}`}>
        <div className={`flex items-center gap-1 ${isStudent ? "flex-row-reverse" : ""}`}>
          <span className="text-[11px] font-semibold text-surface-400">{isStudent ? "Sen" : comment.authorName}</span>
          {canAct && !editing && (
            <div className="relative" ref={menuRef}>
              <button onMouseDown={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }} className="p-1 rounded-lg bg-surface-100 hover:bg-surface-200 text-surface-500 hover:text-surface-800 transition-colors cursor-pointer">
                <MoreHorizontal size={13} />
              </button>
              {menuOpen && (
                <div className={`absolute z-20 top-5 ${isStudent ? "right-0" : "left-0"} bg-white border border-surface-200 rounded-xl shadow-lg overflow-hidden min-w-[100px]`}>
                  <button onClick={() => { setEditText(comment.text); setEditing(true); setMenuOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-text-primary hover:bg-surface-50 transition-colors cursor-pointer">
                    <Pencil size={11} /> Düzenle
                  </button>
                  <button onClick={() => { setMenuOpen(false); onDelete(comment.id); }} className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-status-danger-600 hover:bg-status-danger-50 transition-colors cursor-pointer">
                    <Trash2 size={11} /> Sil
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {editing ? (
          <div className="flex flex-col gap-1.5 w-full">
            <textarea
              value={editText} onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(); } }}
              rows={2} autoFocus
              className="w-full resize-none rounded-xl border border-base-primary-300 px-3 py-2 text-[13px] text-text-primary outline-none focus:border-base-primary-500 bg-white"
            />
            <div className="flex gap-1">
              <button onClick={() => setEditing(false)} className="px-2.5 py-1 text-[11px] rounded-lg bg-surface-100 text-text-secondary hover:bg-surface-200 transition-colors cursor-pointer">İptal</button>
              <button onClick={saveEdit} className="px-2.5 py-1 text-[11px] rounded-lg bg-base-primary-600 text-white hover:bg-base-primary-700 transition-colors cursor-pointer">Kaydet</button>
            </div>
          </div>
        ) : (
          <div className={`px-3.5 py-2.5 rounded-2xl text-[13px] leading-snug ${isStudent ? "bg-base-primary-600 text-white rounded-tr-sm" : "bg-surface-100 text-text-primary rounded-tl-sm"}`}>
            {comment.text}
          </div>
        )}
        <span className="text-[10px] text-surface-400">{fmtTime(comment.createdAt)}</span>
      </div>
    </div>
  );
}
