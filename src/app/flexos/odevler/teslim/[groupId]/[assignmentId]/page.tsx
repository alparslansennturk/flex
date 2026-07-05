"use client";

/**
 * FlexOS · Ödev Teslimi — Teslim Detayı — canlıdaki
 * `dashboard/assignment/[groupId]/[assignmentId]/page.tsx` portu (master-detail).
 * BİLİNÇLİ FARK: notlandırma aksiyonları (Revize İste/Onayla, toplu işlem) YOK —
 * kullanıcı kararı: "notlandırma sistemini en son yapacağız, ödev verme/alma canlı
 * çalışsın şimdi." Bu sayfa SADECE görüntüleme + yorumlaşma. Ayrıca tam-ekran dosya
 * önizleme (`/preview` sayfası) portlanmadı — dosyalar Drive linkiyle açılıyor.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth } from "@/app/lib/firebase";
import { toast } from "sonner";
import {
  ArrowLeft, Loader2, FileText, ExternalLink, Send, Megaphone, MessageSquare,
} from "lucide-react";
import FlexSidebar from "../../../../_components/FlexSidebar";
import FlexHeader from "../../../../_components/FlexHeader";
import type { RosterItem } from "../../../../siniflar/_shared/groupDisplay";

type SubmissionStatus = "submitted" | "reviewing" | "revision" | "completed" | "retracted";

interface AssignmentDetail { id: string; title: string; description: string; dueDate?: string }
interface SubmissionRow { id: string; personId: string; status: SubmissionStatus; grade?: number; isLate: boolean }
interface FileRow { id: string; fileName: string; fileSize: number; driveViewLink: string; versionNo: number; createdAt: string }
interface CommentItem { id: string; authorUid: string; authorType: "trainer" | "student"; authorName: string; text: string; createdAt: string }

const STATUS_META: Record<SubmissionStatus, { label: string; cls: string }> = {
  submitted: { label: "Teslim Edildi", cls: "bg-status-success-100 text-status-success-700" },
  reviewing: { label: "İncelemede", cls: "bg-status-success-100 text-status-success-700" },
  revision: { label: "Revize Durumunda", cls: "bg-blue-50 text-blue-700" },
  completed: { label: "Tamamlandı", cls: "bg-status-success-100 text-status-success-700" },
  retracted: { label: "Geri Çekildi", cls: "bg-surface-100 text-surface-500" },
};

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
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

export default function OdevTeslimDetayPage() {
  const router = useRouter();
  const { groupId, assignmentId } = useParams<{ groupId: string; assignmentId: string }>();

  const [assignment, setAssignment] = useState<AssignmentDetail | null>(null);
  const [roster, setRoster] = useState<RosterItem[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingPersonId, setViewingPersonId] = useState<string | null>(null);

  const [files, setFiles] = useState<FileRow[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);

  const [commentTab, setCommentTab] = useState<"general" | "private">("private");
  const [generalComments, setGeneralComments] = useState<CommentItem[]>([]);
  const [threadComments, setThreadComments] = useState<CommentItem[]>([]);
  const [commentText, setCommentText] = useState("");
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await authHeaders();
      const [assignRes, rosterRes, subRes] = await Promise.all([
        fetch(`/api/flexos/assignments?groupId=${groupId}`, { headers }),
        fetch(`/api/flexos/groups/${groupId}/roster`, { headers }),
        fetch(`/api/flexos/submissions?assignmentId=${assignmentId}`, { headers }),
      ]);
      if (assignRes.ok) {
        const data = await assignRes.json() as { items: AssignmentDetail[] };
        setAssignment(data.items.find((a) => a.id === assignmentId) ?? null);
      }
      if (rosterRes.ok) setRoster((await rosterRes.json() as { items: RosterItem[] }).items);
      if (subRes.ok) setSubmissions((await subRes.json() as { items: SubmissionRow[] }).items);
    } finally {
      setLoading(false);
    }
  }, [groupId, assignmentId]);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  const loadGeneralComments = useCallback(async () => {
    const headers = await authHeaders();
    const res = await fetch(`/api/flexos/assignments/${assignmentId}/comments`, { headers });
    if (res.ok) setGeneralComments((await res.json() as { items: CommentItem[] }).items);
  }, [assignmentId]);

  const loadThreadComments = useCallback(async (personId: string) => {
    const headers = await authHeaders();
    const res = await fetch(`/api/flexos/assignments/${assignmentId}/comments/thread?personId=${personId}`, { headers });
    if (res.ok) setThreadComments((await res.json() as { items: CommentItem[] }).items);
  }, [assignmentId]);

  useEffect(() => { loadGeneralComments(); }, [loadGeneralComments]);

  async function selectPerson(personId: string) {
    setViewingPersonId(personId);
    setCommentTab("private");
    setThreadComments([]);
    setFiles([]);

    const sub = submissions.find((s) => s.personId === personId);
    if (sub) {
      setFilesLoading(true);
      try {
        const headers = await authHeaders();
        const res = await fetch(`/api/flexos/submissions/${sub.id}`, { headers });
        if (res.ok) {
          const data = await res.json() as { files: FileRow[] };
          setFiles(data.files.sort((a, b) => b.versionNo - a.versionNo));
        }
      } finally {
        setFilesLoading(false);
      }
    }
    await loadThreadComments(personId);
  }

  useEffect(() => { commentsEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [threadComments, generalComments, commentTab]);

  async function sendComment() {
    const text = commentText.trim();
    if (!text) return;
    setCommentText("");
    try {
      const headers = await authHeaders();
      const url = commentTab === "general"
        ? `/api/flexos/assignments/${assignmentId}/comments`
        : `/api/flexos/assignments/${assignmentId}/comments/thread`;
      const body = commentTab === "general" ? { text } : { personId: viewingPersonId, text };
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        toast.error(json.error ?? "Yorum gönderilemedi.");
        return;
      }
      if (commentTab === "general") await loadGeneralComments();
      else if (viewingPersonId) await loadThreadComments(viewingPersonId);
    } catch {
      toast.error("Bağlantı hatası, tekrar dene.");
    }
  }

  const rows = roster.map((r) => ({ roster: r, submission: submissions.find((s) => s.personId === r.personId) ?? null }));
  const teslimEdenler = rows.filter((r) => r.submission && (r.submission.status === "submitted" || r.submission.status === "reviewing" || r.submission.status === "completed"));
  const revizeVerilenler = rows.filter((r) => r.submission?.status === "revision");
  const teslimEtmeyenler = rows.filter((r) => !r.submission || r.submission.status === "retracted");

  const viewingRow = rows.find((r) => r.roster.personId === viewingPersonId);

  if (loading || !assignment) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-50">
        <Loader2 size={22} className="animate-spin text-surface-400" />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh", overflow: "hidden", background: "#EEF0F3" }}>
      <FlexSidebar active="odev-teslimi" />
      <div style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <FlexHeader
          left={
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push(`/flexos/odevler/teslim/${groupId}`)}
                className="w-9 h-9 rounded-xl border border-surface-200 bg-white flex items-center justify-center hover:bg-surface-50 transition-colors cursor-pointer shrink-0"
              >
                <ArrowLeft size={16} className="text-surface-700" />
              </button>
              <div>
                <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#1E222B" }}>{assignment.title}</h1>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "#8E95A3" }}>{submissions.length} / {roster.length} teslim</p>
              </div>
            </div>
          }
        />

        <div className="flex-1 flex min-h-0 overflow-hidden font-inter">
          {/* Sol: öğrenci listesi */}
          <div className="w-[360px] shrink-0 border-r border-surface-200 bg-white flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              <StudentGroup title="Teslim Edenler" rows={teslimEdenler} viewingPersonId={viewingPersonId} onSelect={selectPerson} />
              <StudentGroup title="Revize Verilenler" rows={revizeVerilenler} viewingPersonId={viewingPersonId} onSelect={selectPerson} />
              <StudentGroup title="Teslim Etmeyenler" rows={teslimEtmeyenler} viewingPersonId={viewingPersonId} onSelect={selectPerson} />
            </div>
          </div>

          {/* Sağ: detay */}
          <div className="flex-1 overflow-y-auto bg-surface-50">
            {!viewingRow ? (
              <div className="h-full flex items-center justify-center text-surface-400 text-[13px]">Bir öğrenci seçin</div>
            ) : (
              <div className="flex h-full min-h-0">
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {/* Öğrenci kartı */}
                  <div className="bg-white border border-surface-200 rounded-2xl p-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-[15px]" style={{ background: "linear-gradient(135deg,#FF8D28,#D66500)" }}>
                      {initials(viewingRow.roster.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-bold text-text-primary truncate">{viewingRow.roster.name}</p>
                      <p className="text-[12px] text-surface-400">{assignment.title}</p>
                    </div>
                    <span className={`text-[11px] font-semibold px-3 py-1 rounded-full ${viewingRow.submission ? STATUS_META[viewingRow.submission.status].cls : "bg-surface-100 text-surface-500"}`}>
                      {viewingRow.submission ? STATUS_META[viewingRow.submission.status].label : "Teslim Edilmedi"}
                    </span>
                  </div>

                  {/* Dosyalar */}
                  <div className="bg-white border border-surface-200 rounded-2xl p-5">
                    <p className="text-[11px] font-bold text-surface-400 uppercase tracking-widest mb-3">Dosyalar</p>
                    {filesLoading ? (
                      <div className="py-6 flex justify-center"><Loader2 size={16} className="animate-spin text-surface-400" /></div>
                    ) : files.length === 0 ? (
                      <p className="text-[13px] text-surface-400">Henüz dosya yok.</p>
                    ) : (
                      <div className="space-y-2">
                        {files.map((f) => (
                          <div key={f.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface-50 border border-surface-100">
                            <div className="w-8 h-8 rounded-lg bg-base-primary-50 flex items-center justify-center shrink-0">
                              <FileText size={14} className="text-base-primary-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-semibold text-text-primary truncate">{f.fileName}</p>
                              <p className="text-[11px] text-surface-400">v{f.versionNo} · {formatBytes(f.fileSize)} · {fmtTime(f.createdAt)}</p>
                            </div>
                            <a href={f.driveViewLink} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-surface-100 transition-colors text-surface-400 hover:text-text-secondary shrink-0">
                              <ExternalLink size={14} />
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Yorum paneli */}
                <div className="w-[340px] shrink-0 border-l border-surface-200 flex flex-col overflow-hidden bg-white">
                  <div className="shrink-0 flex border-b border-surface-100">
                    <button
                      onClick={() => setCommentTab("general")}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-[12px] font-semibold border-b-2 transition-colors cursor-pointer ${commentTab === "general" ? "border-base-primary-600 text-base-primary-600" : "border-transparent text-surface-400 hover:text-text-secondary"}`}
                    >
                      <Megaphone size={13} /> Duyuru
                    </button>
                    <button
                      onClick={() => setCommentTab("private")}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-[12px] font-semibold border-b-2 transition-colors cursor-pointer ${commentTab === "private" ? "border-base-primary-600 text-base-primary-600" : "border-transparent text-surface-400 hover:text-text-secondary"}`}
                    >
                      <MessageSquare size={13} /> {viewingRow.roster.name.split(" ")[0]}
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                    {(commentTab === "general" ? generalComments : threadComments).length === 0 ? (
                      <p className="text-[12px] text-surface-400 text-center mt-6">Henüz yorum yok.</p>
                    ) : (
                      (commentTab === "general" ? generalComments : threadComments).map((c) => (
                        <div key={c.id} className={`flex flex-col gap-0.5 ${c.authorType === "trainer" ? "items-end" : "items-start"}`}>
                          <span className="text-[10px] font-semibold text-surface-400">{c.authorType === "trainer" ? "Sen" : c.authorName}</span>
                          <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-[12.5px] leading-snug ${c.authorType === "trainer" ? "bg-base-primary-600 text-white rounded-tr-sm" : "bg-surface-100 text-text-primary rounded-tl-sm"}`}>
                            {c.text}
                          </div>
                          <span className="text-[10px] text-surface-400">{fmtTime(c.createdAt)}</span>
                        </div>
                      ))
                    )}
                    <div ref={commentsEndRef} />
                  </div>

                  <div className="shrink-0 border-t border-surface-100 px-3 py-3">
                    <div className="flex items-end gap-2">
                      <textarea
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendComment(); } }}
                        placeholder={commentTab === "general" ? "Tüm sınıfa duyuru yaz..." : "Öğrenciye özel yaz..."}
                        rows={2}
                        className="flex-1 resize-none rounded-xl border border-surface-200 px-3 py-2 text-[12.5px] text-text-primary outline-none focus:border-base-primary-400 transition-colors bg-white"
                      />
                      <button
                        onClick={sendComment}
                        disabled={!commentText.trim()}
                        className="w-9 h-9 rounded-xl bg-base-primary-600 text-white flex items-center justify-center hover:bg-base-primary-700 disabled:opacity-40 transition-colors cursor-pointer shrink-0"
                      >
                        <Send size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StudentGroup({ title, rows, viewingPersonId, onSelect }: {
  title: string;
  rows: { roster: RosterItem; submission: SubmissionRow | null }[];
  viewingPersonId: string | null;
  onSelect: (personId: string) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="py-2">
      <p className="px-4 py-2 text-[11px] font-bold text-surface-400 uppercase tracking-wide">{title} ({rows.length})</p>
      {rows.map(({ roster, submission }) => (
        <button
          key={roster.personId}
          onClick={() => onSelect(roster.personId)}
          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer ${viewingPersonId === roster.personId ? "bg-base-primary-50" : "hover:bg-surface-50"}`}
        >
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0" style={{ background: "linear-gradient(135deg,#6F74D8,#5E63C2)" }}>
            {initials(roster.name)}
          </div>
          <span className="flex-1 min-w-0 text-[13px] font-semibold text-text-primary truncate">{roster.name}</span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${submission ? STATUS_META[submission.status].cls : "bg-surface-100 text-surface-500"}`}>
            {submission ? STATUS_META[submission.status].label : "Teslim Edilmedi"}
          </span>
        </button>
      ))}
    </div>
  );
}
