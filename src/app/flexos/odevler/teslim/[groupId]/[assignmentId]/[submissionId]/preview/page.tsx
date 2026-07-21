"use client";

/**
 * FlexOS · Ödev Teslimi — Tam Ekran Önizleme — canlıdaki
 * `dashboard/assignment/[groupId]/[assignmentId]/[submissionId]/preview/page.tsx` portu.
 * Canlıdan FARK: dosya/durum/teslim verisi FlexOS API'leri üzerinden (Admin SDK, gated).
 * Chat SADECE (2026-07-13 kararı): `chats/{chatId}/messages`'ı client DOĞRUDAN Firestore
 * `onSnapshot` ile okur — canlı sistemdeki `tasks/{id}/threads/{studentId}/comments`
 * ile AYNI desen, gerçek anlıklık için (in-memory SSE broadcast route'lar arası modül
 * paylaşmadığı kanıtlandı, bkz. realtime-hub.ts). Yazma/düzenleme/silme YİNE API
 * üzerinden (Admin SDK) — mevcut yetki kontrolleri korunur, rules sadece OKUMA açar
 * (firestore.rules: trainerUid/studentUid eşleşmesi, yazma `if false`).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { collection, onSnapshot, orderBy, query, type Timestamp } from "firebase/firestore";
import dynamic from "next/dynamic";
import {
  ArrowLeft, Loader2, RotateCcw, CheckCircle2,
  Send, Download, FileText, MoreHorizontal, Pencil, Trash2,
} from "lucide-react";
import { auth, db } from "@/app/lib/firebase";

const PdfViewer = dynamic(() => import("@/app/components/shared/PdfViewer"), { ssr: false });
const ExcelViewer = dynamic(() => import("@/app/components/shared/ExcelViewer"), { ssr: false });
const EXCEL_MIME_TYPES = [
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

type SubmissionStatus = "submitted" | "reviewing" | "revision" | "completed" | "retracted";

interface SubmissionDetail { id: string; personId: string; status: SubmissionStatus; grade?: number; isLate: boolean; submittedAt: string }
/** ESKİ (Drive tabanlı) dosyalarda `storagePath` yok — o durumda mevcut Drive-iframe önizleme korunur. */
interface FileVersion { id: string; fileName: string; fileSize: number; mimeType: string; storagePath?: string; driveViewLink: string; versionNo: number; isLatest: boolean; createdAt: string }
interface CommentItem { id: string; authorUid: string; authorType: "trainer" | "student"; authorName: string; text: string; createdAt: Date }

const STATUS_MAP: Record<SubmissionStatus, { label: string; cls: string }> = {
  submitted: { label: "Teslim Edildi", cls: "bg-status-success-100 text-status-success-700 border-status-success-100" },
  reviewing: { label: "İncelemede", cls: "bg-status-success-100 text-status-success-700 border-status-success-100" },
  revision: { label: "Revize Durumunda", cls: "bg-blue-50 text-blue-700 border-blue-100" },
  completed: { label: "Tamamlandı", cls: "bg-status-success-100 text-status-success-700 border-status-success-100" },
  retracted: { label: "Geri Çekildi", cls: "bg-surface-100 text-surface-500 border-surface-200" },
};

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}
function fmtFull(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", weekday: "short" });
}
function fmtTime(d: Date) {
  return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}
function formatBytes(b: number) {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

async function authHeaders(): Promise<Record<string, string>> {
  const u = auth.currentUser;
  const token = u ? await u.getIdToken() : "";
  return { Authorization: `Bearer ${token}` };
}

function StudentAvatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.38, background: "linear-gradient(135deg,#FF8D28,#D66500)" }}
    >
      {initials(name)}
    </div>
  );
}

export default function SubmissionPreviewPage() {
  const router = useRouter();
  const { groupId, assignmentId, submissionId } = useParams<{ groupId: string; assignmentId: string; submissionId: string }>();

  const [myUid, setMyUid] = useState<string | null>(null);
  useEffect(() => { setMyUid(auth.currentUser?.uid ?? null); }, []);

  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [studentName, setStudentName] = useState("");
  const [taskName, setTaskName] = useState("");
  const [files, setFiles] = useState<FileVersion[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentText, setCommentText] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const commentsEndRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await authHeaders();
      const subRes = await fetch(`/api/flexos/submissions/${submissionId}`, { headers });
      if (!subRes.ok) return;
      const subData = await subRes.json() as { submission: SubmissionDetail; files: FileVersion[]; person: { firstName: string; lastName: string } | null };

      setSubmission(subData.submission);
      setStudentName(subData.person ? `${subData.person.firstName} ${subData.person.lastName}`.trim() : "");
      setFiles(subData.files);
      const latest = subData.files.find((f) => f.isLatest) ?? subData.files.at(-1);
      setActiveFileId((cur) => cur ?? latest?.id);

      if (subData.submission.personId) setChatId(`${assignmentId}_${subData.submission.personId}`);

      const assignRes = await fetch(`/api/flexos/assignments/${assignmentId}`, { headers });
      if (assignRes.ok) setTaskName((await assignRes.json() as { item: { title: string } }).item.title);
    } finally {
      setLoading(false);
    }
  }, [assignmentId, submissionId]);

  useEffect(() => { loadData(); }, [loadData]);

  // 2026-07-13 kararı: chat SADECE Firestore `onSnapshot` ile okunur — gerçek anlık,
  // canlıdaki `tasks/{id}/threads/{studentId}/comments` ile AYNI desen (bkz. chatId
  // useState, chatIdFor server tarafıyla BİREBİR aynı formülle hesaplanır: `${assignmentId}_${personId}`).
  const [chatId, setChatId] = useState<string | null>(null);
  useEffect(() => {
    if (!chatId || !submission?.personId) return;
    const personId = submission.personId;
    let cancelled = false;
    let unsub: (() => void) | undefined;
    (async () => {
      // Chat dokümanı garanti edilmeden `onSnapshot` "Missing or insufficient
      // permissions" atıyordu — rules'taki `get()` parent dokümanın VAR olmasını
      // gerektiriyor (2026-07-13 bug fix). İlk mesajdan ÖNCE bile çağrılmalı.
      try {
        const headers = await authHeaders();
        const ensureRes = await fetch(`/api/flexos/assignments/${assignmentId}/comments/thread/ensure?personId=${personId}`, { method: "POST", headers });
        if (!ensureRes.ok) console.error("[preview-chat] ensure başarısız:", ensureRes.status, await ensureRes.text().catch(() => ""));
      } catch (e) { console.error("[preview-chat] ensure hata:", e); }
      if (cancelled) return;
      const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"));
      unsub = onSnapshot(q, (snap) => {
        setComments(snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            authorUid: data.authorUid ?? "",
            authorType: data.authorType ?? "student",
            authorName: data.authorName ?? "",
            text: data.text ?? "",
            createdAt: (data.createdAt as Timestamp | undefined)?.toDate() ?? new Date(),
          };
        }));
      }, (err) => console.error("[preview-chat]", err));
    })();
    return () => { cancelled = true; unsub?.(); };
  }, [chatId, assignmentId, submission?.personId]);

  useEffect(() => { commentsEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [comments]);

  async function handleStatus(status: SubmissionStatus) {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/flexos/submissions/${submissionId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        toast.error(json.error ?? "Durum güncellenemedi.");
        return;
      }
      toast.success(status === "completed" ? "Teslim onaylandı!" : "Revizyon istendi.");
      setSubmission((prev) => (prev ? { ...prev, status } : prev));
    } finally {
      setActionLoading(false);
    }
  }

  async function sendComment() {
    const text = commentText.trim();
    if (!text || !submission) return;
    setCommentText("");
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/flexos/assignments/${assignmentId}/comments/thread`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ personId: submission.personId, text }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        toast.error(json.error ?? "Yorum gönderilemedi.");
        return;
      }
      // Refetch YOK — `chats/{chatId}/messages`'a `onSnapshot` zaten dinliyor,
      // mesaj Firestore'a yazılır yazılmaz otomatik görünür.
    } catch {
      toast.error("Bağlantı hatası, tekrar dene.");
    }
  }

  async function editComment(id: string, newText: string) {
    if (!chatId) return;
    const headers = await authHeaders();
    const res = await fetch(`/api/flexos/chats/${chatId}/messages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ text: newText }),
    });
    if (!res.ok) toast.error("Yorum düzenlenemedi.");
    // Local state güncellemeye gerek yok — onSnapshot zaten günceli yansıtır.
  }

  async function deleteComment(id: string) {
    if (!chatId) return;
    const headers = await authHeaders();
    const res = await fetch(`/api/flexos/chats/${chatId}/messages/${id}`, { method: "DELETE", headers });
    if (!res.ok) toast.error("Yorum silinemedi.");
  }

  const activeFile = files.find((f) => f.id === activeFileId) ?? files[0] ?? null;
  // YENİ (GCS, storagePath dolu) dosyalar mimeType'a göre gerçek önizleme kullanır — Drive'ın
  // format-dönüştürme sihri (`/view`→`/preview` iframe) GCS public URL'inde YOK. ESKİ (Drive
  // tabanlı, storagePath yok) dosyalar mevcut iframe davranışında kalır.
  const isGcsFile = !!activeFile?.storagePath;
  const isImage = activeFile?.mimeType.startsWith("image/") ?? false;
  const isPdf = activeFile?.mimeType === "application/pdf";
  const isExcel = !!activeFile && EXCEL_MIME_TYPES.includes(activeFile.mimeType);
  const previewUrl = !isGcsFile && activeFile?.driveViewLink ? activeFile.driveViewLink.replace("/view", "/preview") : null;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white font-inter antialiased text-text-primary">
      {/* Top bar */}
      <div className="shrink-0 h-[56px] border-b border-surface-200 bg-white flex items-center gap-4 px-5">
        <button
          onClick={() => router.push(`/flexos/odevler/teslim/${groupId}/${assignmentId}`)}
          className="flex items-center justify-center w-8 h-8 rounded-lg border border-surface-200 bg-surface-100 text-surface-600 hover:bg-surface-200 hover:text-surface-900 transition-all cursor-pointer shrink-0"
          title="Geri"
        >
          <ArrowLeft size={15} />
        </button>

        <div className="w-px h-5 bg-surface-200" />

        <StudentAvatar name={studentName || "?"} size={30} />

        <div className="min-w-0 flex items-center gap-2">
          <span className="text-[14px] font-bold text-text-primary truncate">{studentName}</span>
          {taskName && <span className="text-[12px] text-surface-400 truncate hidden sm:block">· {taskName}</span>}
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
                disabled={actionLoading || submission.status === "completed" || submission.status === "revision"}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-orange-200 bg-orange-50 text-orange-600 text-[12px] font-semibold hover:bg-orange-100 transition-colors cursor-pointer disabled:opacity-40"
              >
                <RotateCcw size={13} /> Revize İste
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

      {/* Main */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-surface-400">
          <Loader2 size={22} className="animate-spin" />
        </div>
      ) : !submission ? (
        <div className="flex-1 flex items-center justify-center text-[14px] text-surface-400">Teslim bulunamadı.</div>
      ) : (
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Sol: Dosya önizleme */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#1a1a1a]">
            <div className="flex-1 min-h-0 relative">
              {isGcsFile && isImage ? (
                <div className="h-full flex items-center justify-center p-6">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={activeFile.driveViewLink} alt={activeFile.fileName} className="max-w-full max-h-full object-contain rounded-lg" />
                </div>
              ) : isGcsFile && (isPdf || isExcel) ? (
                <div className="absolute inset-0 overflow-auto flex items-start justify-center p-6">
                  <div className="bg-white rounded-2xl p-4 w-full max-w-3xl">
                    {isPdf && <PdfViewer url={activeFile!.driveViewLink} />}
                    {isExcel && <ExcelViewer url={activeFile!.driveViewLink} />}
                  </div>
                </div>
              ) : previewUrl ? (
                <iframe src={previewUrl} className="absolute inset-0 w-full h-full border-0" allow="autoplay" />
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-4 text-white/40">
                  <FileText size={40} strokeWidth={1.2} />
                  <p className="text-[14px]">Önizleme mevcut değil</p>
                  {activeFile?.driveViewLink && (
                    <a
                      href={activeFile.driveViewLink}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 text-white/70 hover:bg-white/20 text-[13px] font-semibold transition-colors"
                    >
                      <Download size={14} /> Dosyayı İndir
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sağ: Sohbet */}
          <div className="w-[360px] shrink-0 border-l border-surface-200 flex flex-col overflow-hidden bg-white">
            <div className="shrink-0 px-5 py-3.5 border-b border-surface-100 flex items-center gap-3">
              <StudentAvatar name={studentName || "?"} size={34} />
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-text-primary leading-tight">{studentName}</p>
                <p className="text-[11px] text-surface-400">{fmtFull(submission.submittedAt)}</p>
              </div>
            </div>

            {files.length > 0 && (
              <div className="shrink-0 border-b border-surface-100 px-4 py-3">
                <p className="text-[11px] font-bold text-surface-400 uppercase tracking-wider mb-2">Gönderilen Dosyalar</p>
                <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                  {files.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setActiveFileId(f.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${f.id === activeFileId ? "bg-base-primary-50 border border-base-primary-200" : "bg-surface-50 border border-transparent hover:bg-surface-100"}`}
                    >
                      <FileText size={14} className={f.id === activeFileId ? "text-base-primary-600" : "text-surface-400"} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-semibold text-text-primary truncate">{f.fileName}</p>
                        <p className="text-[10px] text-surface-400">v{f.versionNo} · {formatBytes(f.fileSize)}</p>
                      </div>
                      {f.isLatest && (
                        <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-md">Son</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="shrink-0 px-5 pt-4 pb-2">
              <p className="text-[11px] font-bold text-surface-400 uppercase tracking-wider">Yorumlar</p>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-5">
              {comments.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-surface-400">
                  <p className="text-[13px] font-medium">Henüz mesaj yok</p>
                  <p className="text-[12px] text-center max-w-[200px] leading-relaxed">Öğrenciye geri bildirim vermek için aşağıya yaz.</p>
                </div>
              ) : (
                comments.map((c) => (
                  <ThreadMessage key={c.id} comment={c} myUid={myUid} onEdit={editComment} onDelete={deleteComment} />
                ))
              )}
              <div ref={commentsEndRef} />
            </div>

            <div className="shrink-0 border-t border-surface-100 px-4 pt-3 pb-6 flex items-end gap-2">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendComment(); } }}
                placeholder="Öğrenciye yorum yaz..."
                rows={2}
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
      )}
    </div>
  );
}

function ThreadMessage({
  comment, myUid, onEdit, onDelete,
}: {
  comment: CommentItem;
  myUid: string | null;
  onEdit: (id: string, newText: string) => Promise<void>;
  onDelete: (id: string) => void;
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

  const isMe = comment.authorUid === myUid;

  async function saveEdit() {
    const t = editText.trim();
    if (!t || t === comment.text) { setEditing(false); return; }
    await onEdit(comment.id, t);
    setEditing(false);
  }

  return (
    <div className={`flex flex-col gap-0.5 ${isMe ? "items-end" : "items-start"}`}>
      <div className={`flex items-center gap-1 ${isMe ? "flex-row-reverse" : ""}`}>
        <span className="text-[11px] font-semibold text-surface-400">{isMe ? "Sen" : comment.authorName}</span>
        {isMe && !editing && (
          <div className="relative" ref={menuRef}>
            <button
              onMouseDown={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
              className="p-1 rounded-lg bg-surface-100 hover:bg-surface-200 text-surface-500 hover:text-surface-800 transition-colors cursor-pointer"
            >
              <MoreHorizontal size={13} />
            </button>
            {menuOpen && (
              <div className={`absolute z-20 top-5 ${isMe ? "right-0" : "left-0"} bg-white border border-surface-200 rounded-xl shadow-lg overflow-hidden min-w-[100px]`}>
                <button
                  onClick={() => { setEditText(comment.text); setEditing(true); setMenuOpen(false); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-text-primary hover:bg-surface-50 transition-colors cursor-pointer"
                >
                  <Pencil size={11} /> Düzenle
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onDelete(comment.id); }}
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
        <div className="flex flex-col gap-1.5 w-full">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(); } }}
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
        <div className={`max-w-[260px] px-3.5 py-2.5 rounded-2xl text-[13px] leading-snug ${isMe ? "bg-base-primary-600 text-white rounded-tr-sm" : "bg-surface-100 text-text-primary rounded-tl-sm"}`}>
          {comment.text}
        </div>
      )}
      <span className="text-[10px] text-surface-400">{fmtTime(comment.createdAt)}</span>
    </div>
  );
}
