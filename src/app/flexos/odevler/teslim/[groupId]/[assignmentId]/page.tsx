"use client";

/**
 * FlexOS · Ödev Teslimi — Teslim Detayı — canlıdaki
 * `dashboard/assignment/[groupId]/[assignmentId]/page.tsx` portu (master-detail).
 *
 * **"Revize İste"/"Onayla" BİTTİ (2026-07-08):** canlıdaki `handleSingleStatus`'un
 * karşılığı — `PATCH /api/flexos/submissions/[id]/status` (zaten Faz 2'den beri var
 * olan endpoint, sadece bu UI'dan hiç çağrılmıyordu). "Revize İste" → `status:"revision"`
 * (öğrencinin yükleme hakkı otomatik 8'e çıkar, `getMaxUploads` zaten böyleydi) + öğrenciye
 * bildirim ("Revize İstendi"). "Onayla" → `status:"completed"` + bildirim ("Ödeviniz
 * Onaylandı! 🎉"). **Toplu işlem de eklendi** (aynı gün) — canlıdaki checkbox+dropdown
 * (`bulkSetStatus`) birebir: sol paneldeki öğrenci satırlarına checkbox, üstte "Toplu
 * İşlem" dropdown'ı (Teslim Edildi/Tamamlandı/Revize — seçili tüm öğrencilere paralel
 * `PATCH .../status`).
 *
 * Ayrıca tam-ekran dosya önizleme (`/preview` sayfası) portlanmadı — dosyalar Drive
 * linkiyle açılıyor.
 */

import { useEffect, useState, useCallback, useRef, useMemo, type ReactNode } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { auth, db } from "@/app/lib/firebase";
import { collection, onSnapshot, orderBy, query, type Timestamp } from "firebase/firestore";
import { toast } from "sonner";
import {
  ArrowLeft, Loader2, FileText, ExternalLink, Send, Megaphone, MessageSquare, RotateCcw, CheckCircle2, ChevronDown,
  Upload, MessageCircle, AlertTriangle, Trash2,
} from "lucide-react";
import FlexSidebar from "../../../../_components/FlexSidebar";
import FlexHeader from "../../../../_components/FlexHeader";
import type { RosterItem } from "../../../../siniflar/_shared/groupDisplay";

type SubmissionStatus = "submitted" | "reviewing" | "revision" | "completed" | "retracted";

interface AssignmentDetail { id: string; title: string; description: string; dueDate?: string }
interface SubmissionRow {
  id: string; personId: string; status: SubmissionStatus; grade?: number; isLate: boolean;
  submittedAt: string; lastSubmittedAt: string; updatedAt?: string; iteration: number; note?: string;
}
interface ActivityEntry { id: string; icon: ReactNode; iconBg: string; label: string; subtitle?: string; at: string }
interface FileRow { id: string; fileName: string; fileSize: number; driveViewLink: string; versionNo: number; createdAt: string }
interface CommentItem { id: string; authorUid: string; authorType: "trainer" | "student"; authorName: string; text: string; createdAt: string }

// Öğrenci avatarları — sistem paletinden dönen tek renk (odev-notu/page.tsx'teki
// GROUP_COLORS ile AYNI 6 renk, tutarlılık için).
const AVATAR_COLORS = ["#3A7BD5", "#FF8D28", "#009F3E", "#7C3AED", "#1CB5AE", "#F91079"];

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
  const searchParams = useSearchParams();

  const [assignment, setAssignment] = useState<AssignmentDetail | null>(null);
  const [roster, setRoster] = useState<RosterItem[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingPersonId, setViewingPersonId] = useState<string | null>(null);

  const [files, setFiles] = useState<FileRow[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [deleteFileTarget, setDeleteFileTarget] = useState<{ submissionId: string; fileId: string; fileName: string } | null>(null);
  const [deletingFile, setDeletingFile] = useState(false);

  const [commentTab, setCommentTab] = useState<"general" | "private">("private");
  const [generalComments, setGeneralComments] = useState<CommentItem[]>([]);
  const [threadComments, setThreadComments] = useState<CommentItem[]>([]);
  const [commentText, setCommentText] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  const bulkMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!bulkMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (bulkMenuRef.current && !bulkMenuRef.current.contains(e.target as Node)) setBulkMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [bulkMenuOpen]);

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

  // Varsayılan seçim (2026-07-22 kullanıcı isteği): bildirimden `?personId=` ile
  // gelinince (postThreadCommentAsStudent'in actionUrl'i, comment-service.ts) o öğrenci
  // açılır — yoksa EN SON teslim eden öğrenci, kimse teslim etmemişse listedeki ilk öğrenci.
  const autoSelectedRef = useRef(false);
  useEffect(() => {
    if (loading || autoSelectedRef.current || roster.length === 0) return;
    const queryPersonId = searchParams.get("personId");
    if (queryPersonId && roster.some((r) => r.personId === queryPersonId)) {
      autoSelectedRef.current = true;
      void selectPerson(queryPersonId);
      return;
    }
    autoSelectedRef.current = true;
    const mostRecent = submissions
      .filter((s) => s.status !== "retracted")
      .slice()
      .sort((a, b) => new Date(b.lastSubmittedAt).getTime() - new Date(a.lastSubmittedAt).getTime())[0];
    const defaultPersonId = mostRecent?.personId ?? roster[0]?.personId;
    if (defaultPersonId) void selectPerson(defaultPersonId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, roster, submissions, searchParams]);

  const loadGeneralComments = useCallback(async () => {
    const headers = await authHeaders();
    const res = await fetch(`/api/flexos/assignments/${assignmentId}/comments`, { headers });
    if (res.ok) setGeneralComments((await res.json() as { items: CommentItem[] }).items);
  }, [assignmentId]);

  useEffect(() => { loadGeneralComments(); }, [loadGeneralComments]);

  // 2026-07-13 kararı: 1:1 thread SADECE Firestore `onSnapshot` ile okunur (gerçek anlık,
  // canlıdaki `tasks/{id}/threads/{studentId}/comments` ile AYNI desen) — `comments.changed`
  // broadcast + SSE denendi ama route'lar arası modül paylaşmadığı kanıtlandı (realtime-hub.ts).
  // Duyuru (general) sekmesi kapsam dışı, API+polling yerine dokunulmadı (chat DEĞİL, tek-yönlü duyuru).
  const chatId = viewingPersonId ? `${assignmentId}_${viewingPersonId}` : null;
  useEffect(() => {
    if (!chatId || !viewingPersonId) { setThreadComments([]); return; }
    const personId = viewingPersonId;
    let cancelled = false;
    let unsub: (() => void) | undefined;
    (async () => {
      // Chat dokümanı garanti edilmeden `onSnapshot` "Missing or insufficient permissions"
      // atıyordu — rules'taki `get()` parent dokümanın VAR olmasını gerektiriyor
      // (2026-07-13 bug fix). İlk mesajdan ÖNCE bile çağrılmalı.
      try {
        const headers = await authHeaders();
        const ensureRes = await fetch(`/api/flexos/assignments/${assignmentId}/comments/thread/ensure?personId=${personId}`, { method: "POST", headers });
        if (!ensureRes.ok) console.error("[teslim-thread-chat] ensure başarısız:", ensureRes.status, await ensureRes.text().catch(() => ""));
      } catch (e) { console.error("[teslim-thread-chat] ensure hata:", e); }
      if (cancelled) return;
      const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"));
      unsub = onSnapshot(q, (snap) => {
        setThreadComments(snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            authorUid: data.authorUid ?? "",
            authorType: data.authorType ?? "student",
            authorName: data.authorName ?? "",
            text: data.text ?? "",
            createdAt: ((data.createdAt as Timestamp | undefined)?.toDate() ?? new Date()).toISOString(),
          };
        }));
      }, (err) => console.error("[teslim-thread-chat]", err));
    })();
    return () => { cancelled = true; unsub?.(); };
  }, [chatId, assignmentId, viewingPersonId]);

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
    // threadComments YOK burada — `chatId` state'i `viewingPersonId`'den türetiliyor,
    // onSnapshot effect'i otomatik devreye girer.
  }

  /** Dosya sil (eğitmen) — 2026-07-22, preview sayfasındaki `deleteFileAsStaff`
   * endpoint'inin AYNISI: storage'dan da gerçekten siler, `completed` teslimde reddedilir.
   * Onay native `confirm()` DEĞİL, tasarım sistemindeki modal (bkz. yonetim/page.tsx
   * "Şablon silme onayı" ile AYNI desen — kullanıcı isteği). */
  async function confirmDeleteFile() {
    if (!deleteFileTarget) return;
    setDeletingFile(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/flexos/submissions/${deleteFileTarget.submissionId}/files/${deleteFileTarget.fileId}`, { method: "DELETE", headers });
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        toast.error(json.error ?? "Dosya silinemedi.");
        return;
      }
      const remaining = files.filter((f) => f.id !== deleteFileTarget.fileId);
      setFiles(remaining);
      // Backend son aktif dosya silinince submission.status'u "retracted"e çekiyor
      // (2026-07-22) — dosyasız bir teslimde Onayla/Revize İste butonları kalmasın.
      if (remaining.length === 0) {
        setSubmissions((prev) => prev.map((s) => (s.id === deleteFileTarget.submissionId ? { ...s, status: "retracted" as SubmissionStatus } : s)));
      }
      toast.success("Dosya silindi.");
      setDeleteFileTarget(null);
    } catch {
      toast.error("Bağlantı hatası, tekrar dene.");
    } finally {
      setDeletingFile(false);
    }
  }

  // 2026-07-22 kaldırıldı: Yorumlar artık sabit küçük bir chat kutusu değil, sayfanın
  // doğal akışında (bkz. Yorumlar kartı) — her yorum değişiminde (ilk yükleme dahil)
  // scrollIntoView TÜM sayfayı en alta kaydırıyordu ("sayfa yenilenince aşağı kayıyor" bug'ı).

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
      // Duyuru sekmesi hâlâ API+state — thread ("private") sekmesi ise `onSnapshot`
      // zaten dinliyor, mesaj Firestore'a yazılır yazılmaz otomatik görünür.
      if (commentTab === "general") await loadGeneralComments();
    } catch {
      toast.error("Bağlantı hatası, tekrar dene.");
    }
  }

  /** "Revize İste"/"Onayla" — canlıdaki `handleSingleStatus`'un karşılığı
   * (`PATCH /api/flexos/submissions/[id]/status`, zaten var olan endpoint). */
  async function updateStatus(submissionId: string, status: SubmissionStatus) {
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
      toast.success(status === "revision" ? "Revize istendi." : "Ödev onaylandı.");
      await loadOverview();
    } catch {
      toast.error("Bağlantı hatası, tekrar dene.");
    } finally {
      setActionLoading(false);
    }
  }

  function toggleCheck(personId: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(personId)) next.delete(personId); else next.add(personId);
      return next;
    });
  }

  // Bölüm başlığındaki checkbox — 2026-07-11 kullanıcı isteği: "Teslim Edenler"/
  // "Teslim Etmeyenler" başlığının solundaki checkbox'a basınca O BÖLÜMDEKİ tüm
  // öğrenciler seçilsin. Hepsi zaten seçiliyse tersine çevirir (hepsini kaldırır).
  function toggleCheckAll(personIds: string[]) {
    setCheckedIds((prev) => {
      const allChecked = personIds.length > 0 && personIds.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allChecked) personIds.forEach((id) => next.delete(id));
      else personIds.forEach((id) => next.add(id));
      return next;
    });
  }

  /** Toplu işlem — canlıdaki `bulkSetStatus`'un karşılığı (seçili öğrencilerin
   * teslimlerine aynı durumu paralel uygular). */
  async function bulkSetStatus(status: SubmissionStatus) {
    if (checkedIds.size === 0) return;
    setBulkMenuOpen(false);
    setActionLoading(true);
    try {
      const headers = await authHeaders();
      const targets = [...checkedIds]
        .map((personId) => submissions.find((s) => s.personId === personId))
        .filter((s): s is SubmissionRow => !!s);
      await Promise.all(
        targets.map((sub) =>
          fetch(`/api/flexos/submissions/${sub.id}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...headers },
            body: JSON.stringify({ status }),
          }),
        ),
      );
      setCheckedIds(new Set());
      await loadOverview();
      toast.success(`${targets.length} teslim güncellendi.`);
    } catch {
      toast.error("Bağlantı hatası, tekrar dene.");
    } finally {
      setActionLoading(false);
    }
  }

  const rows = roster.map((r) => ({ roster: r, submission: submissions.find((s) => s.personId === r.personId) ?? null }));
  const teslimEdenler = rows.filter((r) => r.submission && (r.submission.status === "submitted" || r.submission.status === "reviewing" || r.submission.status === "completed"));
  const revizeVerilenler = rows.filter((r) => r.submission?.status === "revision");
  const teslimEtmeyenler = rows.filter((r) => !r.submission || r.submission.status === "retracted");

  const viewingRow = rows.find((r) => r.roster.personId === viewingPersonId);

  // Aktivite (2026-07-22 kullanıcı isteği) — canlıdaki `SubmissionTimeline`'ın (ayrı
  // `submission_timeline` event-log koleksiyonu) karşılığı DEĞİL — FlexOS'ta böyle bir
  // log yok, bu yüzden zaten elimizde olan verilerden (dosya versiyonları, özel yorumlar,
  // teslimin güncel durumu) türetilmiş bir zaman çizelgesi.
  const activityEntries: ActivityEntry[] = useMemo(() => {
    const entries: ActivityEntry[] = [];
    files.forEach((f) => entries.push({
      id: `file-${f.id}`,
      icon: <Upload size={14} />,
      iconBg: "bg-blue-100 text-blue-600",
      label: f.versionNo > 1 ? `Yeniden teslim edildi (v${f.versionNo})` : "Ödev yüklendi",
      subtitle: f.fileName,
      at: f.createdAt,
    }));
    threadComments.forEach((c) => entries.push({
      id: `comment-${c.id}`,
      icon: <MessageCircle size={14} />,
      iconBg: "bg-surface-100 text-surface-600",
      label: c.authorType === "trainer" ? "Yorum yapıldı (Sen)" : "Yorum yapıldı",
      subtitle: c.text,
      at: c.createdAt,
    }));
    const sub = viewingRow?.submission;
    if (sub?.status === "revision") {
      entries.push({ id: "status-revision", icon: <AlertTriangle size={14} />, iconBg: "bg-orange-100 text-orange-600", label: "Revize istendi", at: sub.updatedAt ?? sub.submittedAt });
    } else if (sub?.status === "completed") {
      entries.push({ id: "status-completed", icon: <CheckCircle2 size={14} />, iconBg: "bg-emerald-100 text-emerald-600", label: "Onaylandı", at: sub.updatedAt ?? sub.submittedAt });
    }
    return entries.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  }, [files, threadComments, viewingRow?.submission]);

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
      {/* 2026-07-18 kullanıcı isteği: öğrenci tarafındaki ödev detayıyla AYNI framer-motion
          açılış (fade+slide-up, 0.22s, modallardaki AYNI cubic-bezier). */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
        style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}
      >
        <FlexHeader
          left={
            <div className="flex items-center gap-3">
              <button
                // Geri dönünce hangi ödeve bakıyorduysa o ödevin akordiyonu Ödevler
                // sekmesinde otomatik açık gelsin diye assignmentId hint'i taşınıyor
                // (2026-07-11 kullanıcı bulgusu — canlıdaki davranış).
                onClick={() => router.push(`/flexos/odevler/teslim/${groupId}?assignmentId=${assignmentId}`)}
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
            {/* Toplu işlem — canlıdaki dropdown'ın birebir karşılığı (2026-07-08 eklendi). */}
            <div className="shrink-0 px-4 py-3 border-b border-surface-100 flex justify-end">
              <div className="relative" ref={bulkMenuRef}>
                <button
                  onClick={() => setBulkMenuOpen((v) => !v)}
                  disabled={checkedIds.size === 0 || actionLoading}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold border transition-colors cursor-pointer ${checkedIds.size > 0 ? "border-base-primary-300 text-base-primary-700 bg-base-primary-50 hover:bg-base-primary-100" : "border-surface-200 text-surface-400 bg-surface-50 cursor-not-allowed"}`}
                >
                  {checkedIds.size > 0 ? `${checkedIds.size} seçili` : "Seçiniz"}
                  <ChevronDown size={12} />
                </button>
                {bulkMenuOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-surface-200 rounded-2xl shadow-xl z-50 overflow-hidden py-1.5">
                    <p className="px-4 pt-2 pb-1.5 text-[10px] font-bold text-surface-500 uppercase tracking-widest">Toplu İşlem</p>
                    {([
                      { label: "Teslim Edildi İşaretle", status: "submitted" as SubmissionStatus },
                      { label: "Tamamlandı İşaretle", status: "completed" as SubmissionStatus },
                      { label: "Revize Gönder", status: "revision" as SubmissionStatus },
                    ]).map(({ label, status }) => (
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
            <div className="flex-1 overflow-y-auto">
              <StudentGroup title="Teslim Edenler" rows={teslimEdenler} viewingPersonId={viewingPersonId} checkedIds={checkedIds} onSelect={selectPerson} onToggleCheck={toggleCheck} onToggleAll={toggleCheckAll} />
              <StudentGroup title="Revize Verilenler" rows={revizeVerilenler} viewingPersonId={viewingPersonId} checkedIds={checkedIds} onSelect={selectPerson} onToggleCheck={toggleCheck} onToggleAll={toggleCheckAll} />
              <StudentGroup title="Teslim Etmeyenler" rows={teslimEtmeyenler} viewingPersonId={viewingPersonId} checkedIds={checkedIds} onSelect={selectPerson} onToggleCheck={toggleCheck} onToggleAll={toggleCheckAll} />
            </div>
          </div>

          {/* Sağ: detay */}
          <div className="flex-1 overflow-y-auto bg-surface-50">
            {!viewingRow ? (
              <div className="h-full flex items-center justify-center text-surface-400 text-[13px]">Bir öğrenci seçin</div>
            ) : (
              <div className="p-6 space-y-4">
                  {/* Üst: Öğrenci bilgi kartı (sol) + Mevcut Durum kartı (sağ, 300px) —
                      canlıdaki grid-cols-[1fr_300px] üst bloğun birebir karşılığı. */}
                  <div className="grid grid-cols-[1fr_300px] gap-4 items-stretch">
                    {/* Öğrenci bilgi kartı — legacy'deki (dashboard/assignment/.../page.tsx
                        satır 750-796) birebir karşılığı: üstte avatar+isim+durum rozeti,
                        altında teslim özeti (iterasyon/tarih/geç gün), en altta Öğrenci Notu
                        kutusu (flex-1 — sağdaki "Mevcut Durum" kartıyla aynı yüksekliğe gerer). */}
                    <div className="min-w-0 bg-white border border-surface-200 rounded-2xl p-5 flex flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-[15px] shrink-0" style={{ background: "linear-gradient(135deg,#FF8D28,#D66500)" }}>
                            {initials(viewingRow.roster.name)}
                          </div>
                          <div className="min-w-0">
                            <h2 className="text-[16px] font-bold text-text-primary leading-tight truncate">{viewingRow.roster.name}</h2>
                            <p className="text-[12px] text-surface-500 mt-0.5 truncate">{assignment.title}</p>
                          </div>
                        </div>
                        {viewingRow.submission && (
                          <span className={`shrink-0 text-[11px] font-semibold px-3 py-1 rounded-full ${STATUS_META[viewingRow.submission.status].cls}`}>
                            {STATUS_META[viewingRow.submission.status].label}
                          </span>
                        )}
                      </div>

                      {/* Teslim durumu/tarihi sağdaki "Mevcut Durum" kartında zaten var —
                          burada tekrar etmek yerine öğrencinin e-posta adresi (2026-07-22). */}
                      {viewingRow.roster.email && (
                        <p className="mt-3 text-[12px] text-surface-500 truncate">{viewingRow.roster.email}</p>
                      )}

                      <div className="mt-3 flex-1 px-4 py-3 bg-surface-50 rounded-xl border border-surface-100">
                        <p className="text-[11px] font-bold text-surface-500 mb-1">Öğrenci Notu</p>
                        {viewingRow.submission?.note ? (
                          <p className="text-[13px] text-text-secondary italic">&ldquo;{viewingRow.submission.note}&rdquo;</p>
                        ) : (
                          <p className="text-[13px] text-surface-400 italic">Not girilmemiş</p>
                        )}
                      </div>
                    </div>

                    {/* Mevcut Durum kartı */}
                    <div className="bg-white border border-surface-200 rounded-2xl p-5 space-y-3">
                      <p className="text-[11px] font-bold text-surface-500 uppercase tracking-wider">Mevcut Durum</p>
                      <span className={`inline-flex items-center gap-1.5 text-[12px] font-bold px-3 py-1 rounded-full ${viewingRow.submission ? STATUS_META[viewingRow.submission.status].cls : "bg-surface-100 text-surface-500"}`}>
                        {viewingRow.submission ? STATUS_META[viewingRow.submission.status].label : "Teslim Edilmedi"}
                      </span>
                      <div>
                        <p className="text-[11px] text-surface-500">Teslim Tarihi</p>
                        <p className="text-[13px] font-semibold text-text-primary mt-0.5">
                          {viewingRow.submission ? fmtTime(viewingRow.submission.lastSubmittedAt) : "—"}
                        </p>
                      </div>
                      {/* "Revize İste"/"Onayla" — canlıdaki handleSingleStatus'un birebir karşılığı
                          (2026-07-08 kararı: bilerek ertelenen notlandırma aksiyonu şimdi eklendi).
                          2026-07-22: dosyasız bir teslimde bu butonlar hiç gösterilmiyor — hem
                          "retracted" durumu hem `files.length` kontrolü BİRLİKTE (backend fix'inden
                          ÖNCE silinmiş, status'u hâlâ eski kalan bozuk kayıtlara karşı savunma). */}
                      {viewingRow.submission && viewingRow.submission.status !== "retracted" && files.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-surface-100">
                          <button
                            onClick={() => updateStatus(viewingRow.submission!.id, "revision")}
                            disabled={actionLoading || viewingRow.submission.status === "completed" || viewingRow.submission.status === "revision"}
                            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-[12px] font-bold hover:bg-blue-100 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <RotateCcw size={13} /> Revize İste
                          </button>
                          <button
                            onClick={() => updateStatus(viewingRow.submission!.id, "completed")}
                            disabled={actionLoading || viewingRow.submission.status === "completed"}
                            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-status-success-500 text-white text-[12px] font-bold hover:bg-status-success-700 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <CheckCircle2 size={13} /> Onayla
                          </button>
                        </div>
                      )}
                    </div>
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
                            {viewingRow.submission && viewingRow.submission.status !== "completed" && (
                              <button
                                onClick={() => setDeleteFileTarget({ submissionId: viewingRow.submission!.id, fileId: f.id, fileName: f.fileName })}
                                title="Dosyayı sil"
                                className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-surface-400 hover:text-red-600 shrink-0 cursor-pointer"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Tam-ekran önizleme (2026-07-13 port) — canlıdaki "Dosya" kartının
                        altındaki TEK "Detay Gör" butonunun BİREBİR karşılığı (dosya satırı
                        başına değil, mevcut teslimin tamamı için tek buton). */}
                    {viewingRow.submission && files.length > 0 && (
                      <div className="flex justify-end mt-4">
                        <button
                          onClick={() => router.push(`/flexos/odevler/teslim/${groupId}/${assignmentId}/${viewingRow.submission!.id}/preview`)}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-status-success-500 text-white text-[13px] font-semibold hover:bg-status-success-700 transition-colors cursor-pointer"
                        >
                          <ExternalLink size={14} /> Detay Gör
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Aktivite (2026-07-22 legacy port) — dosya yükleme, yorum, durum
                      olaylarının zaman sırasına göre birleştirilmiş görünümü. */}
                  <div className="bg-white border border-surface-200 rounded-2xl p-5">
                    <p className="text-[11px] font-bold text-surface-400 uppercase tracking-widest mb-3">Aktivite</p>
                    {activityEntries.length === 0 ? (
                      <p className="text-[13px] text-surface-400 text-center py-2">Henüz aktivite yok.</p>
                    ) : (
                      <div className="space-y-0">
                        {activityEntries.map((entry, i) => (
                          <div key={entry.id} className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${entry.iconBg}`}>
                                {entry.icon}
                              </div>
                              {i < activityEntries.length - 1 && <div className="w-px flex-1 bg-surface-100 my-1" />}
                            </div>
                            <div className={`flex-1 min-w-0 ${i < activityEntries.length - 1 ? "pb-4" : "pb-0"}`}>
                              <div className="flex items-baseline gap-2 flex-wrap">
                                <span className="text-[13px] font-bold text-text-primary">{entry.label}</span>
                                <span className="text-[11px] text-surface-400">{fmtTime(entry.at)}</span>
                              </div>
                              {entry.subtitle && (
                                <div className="mt-1 px-3 py-1.5 bg-surface-50 rounded-lg border border-surface-100">
                                  <p className="text-[12px] text-text-secondary truncate">{entry.subtitle}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Yorumlar — 2026-07-22 düzeltme: sabit yükseklikli/iç scroll'lu kutu DEĞİL,
                      diğer kartlar gibi doğal akışta, içerik kadar yer kaplıyor. */}
                  <div className="bg-white border border-surface-200 rounded-2xl overflow-hidden">
                    <div className="flex border-b border-surface-100">
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

                    <div className="px-4 py-4 space-y-3">
                      {(commentTab === "general" ? generalComments : threadComments).length === 0 ? (
                        <p className="text-[12px] text-surface-400 text-center py-4">Henüz yorum yok.</p>
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
                    </div>

                    <div className="border-t border-surface-100 px-3 py-3">
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
      </motion.div>

      {/* Dosya silme onayı — yonetim/page.tsx "Şablon silme onayı" ile AYNI desen. */}
      {deleteFileTarget && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0F1A30]/45 p-4" onClick={() => !deletingFile && setDeleteFileTarget(null)}>
          <div className="bg-white rounded-[18px] shadow-2xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6.5 pt-6.5 pb-5">
              <div className="w-12 h-12 rounded-xl bg-[#FFECEC] text-[#D93636] flex items-center justify-center mb-4">
                <Trash2 size={22} />
              </div>
              <h3 className="text-[18px] font-extrabold text-[#1E222B] tracking-tight">Dosyayı sil</h3>
              <p className="text-[14px] text-[#6F7B87] mt-2 leading-relaxed">
                <span className="font-bold text-[#1E222B]">{deleteFileTarget.fileName}</span> dosyasını kalıcı olarak silmek üzeresiniz. Bu işlem geri alınamaz.
              </p>
            </div>
            <div className="flex gap-2.5 justify-end px-6.5 pb-5.5">
              <button onClick={() => setDeleteFileTarget(null)} disabled={deletingFile} className="px-5 py-2.5 rounded-xl border border-[#E2E5EA] bg-white text-[#414B59] text-[14px] font-semibold hover:bg-[#F7F8FA] transition-colors cursor-pointer disabled:opacity-50">Vazgeç</button>
              <button onClick={confirmDeleteFile} disabled={deletingFile} className="flex items-center gap-2 px-5 py-2.5 rounded-xl border-none bg-[#D93636] text-white text-[14px] font-bold cursor-pointer transition-all disabled:opacity-60" style={{ boxShadow: "0 8px 18px -8px rgba(217,54,54,.6)" }}>
                {deletingFile ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Evet, sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StudentGroup({ title, rows, viewingPersonId, checkedIds, onSelect, onToggleCheck, onToggleAll }: {
  title: string;
  rows: { roster: RosterItem; submission: SubmissionRow | null }[];
  viewingPersonId: string | null;
  checkedIds: Set<string>;
  onSelect: (personId: string) => void;
  onToggleCheck: (personId: string) => void;
  onToggleAll: (personIds: string[]) => void;
}) {
  if (rows.length === 0) return null;
  const personIds = rows.map((r) => r.roster.personId);
  const allChecked = personIds.every((id) => checkedIds.has(id));
  return (
    <div className="py-2">
      {/* 2026-07-11 kullanıcı düzeltmeleri: uppercase kaldırıldı, font-bold→semibold,
          11px→14px (lg/xl'de biraz büyür), solda "hepsini seç" checkbox'ı eklendi. */}
      <div className="flex items-center gap-2.5 px-4 py-2">
        <input
          type="checkbox"
          checked={allChecked}
          onChange={() => onToggleAll(personIds)}
          className="shrink-0 w-4 h-4 rounded cursor-pointer accent-base-primary-600"
        />
        <p className="text-[14px] lg:text-[15px] font-semibold text-surface-500 tracking-wide">{title} ({rows.length})</p>
      </div>
      {rows.map(({ roster, submission }, i) => (
        <div
          key={roster.personId}
          onClick={() => onSelect(roster.personId)}
          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer ${viewingPersonId === roster.personId ? "bg-base-primary-50" : "hover:bg-surface-50"}`}
        >
          <input
            type="checkbox"
            checked={checkedIds.has(roster.personId)}
            onClick={(e) => e.stopPropagation()}
            onChange={() => onToggleCheck(roster.personId)}
            className="shrink-0 w-4 h-4 rounded cursor-pointer accent-base-primary-600"
          />
          {/* ÖNCEDEN sabit tek gradyan — HERKES aynı maviydi (2026-07-11 kullanıcı bulgusu:
              "avatarlar hepsi mavi, random olsun istemiştim"). Sistem paletinden dönen tek renk. */}
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0" style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>
            {initials(roster.name)}
          </div>
          <span className="flex-1 min-w-0 text-[13px] font-semibold text-text-primary truncate">{roster.name}</span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${submission ? STATUS_META[submission.status].cls : "bg-surface-100 text-surface-500"}`}>
            {submission ? STATUS_META[submission.status].label : "Teslim Edilmedi"}
          </span>
        </div>
      ))}
    </div>
  );
}
