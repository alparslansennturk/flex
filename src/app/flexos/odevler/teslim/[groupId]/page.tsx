"use client";

/**
 * FlexOS · Ödev Teslimi — Grup Detay — canlıdaki `dashboard/assignment/[groupId]/page.tsx`
 * portu. "Öğrenciler" + "Ödevler" (accordion, teslim/bekleyen/revize istatistikleri) tabları.
 * BİLİNÇLİ FARK: "Teslim Panosu" tab'ı yok (accordion + drill-down zaten aynı veriyi kapsıyor).
 *
 * **"Ödevi Düzenle" (başlık/açıklama/tarih/durum) + "Dosya Yükle" EKLENDİ (2026-07-11):**
 * önceden bilerek eksikti (eski canlı upload yolu `/api/instructor/init-file-upload`
 * denetlenmemişti, PORTLANMADI) — ama `uploadAssignmentAttachment` (`odevler/_shared/`)
 * 2026-07-08'de zaten MODERN resumable-upload ile bu sorunu çözmüştü.
 *
 * **Dosya Yükle UI — canlıdaki `AttachmentManager`'ın (dashboard/assignment/[groupId])
 * BİREBİR portu (2026-07-11, ikinci düzeltme):** kullanıcı ekran görüntüsü + "sağa doğru
 * açılan panel + Google Drive + silme yok" bulgularıyla önceki basit sürüm (statik
 * dashed buton, silme yok, tek mod) yeniden yazıldı — "+" butonu sağa doğru genişleyen
 * bir panel açar (Bilgisayardan Yükle / Google Drive link yapıştır), yüklenen her
 * dosyanın X (sil) butonu var (`PATCH` ile attachments dizisi filtrelenip yazılır).
 * Google Drive modu canlıdaki gibi GERÇEK bir Drive picker DEĞİL — sadece bir link
 * yapıştırma alanı (canlı da öyle çalışıyordu, OAuth entegrasyonu yok).
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { auth } from "@/app/lib/firebase";
import { toast } from "sonner";
import {
  ArrowLeft, Loader2, BookOpen, ClipboardList, Search, Users,
  ChevronDown, Smile, Meh, RefreshCw, ArrowRight, FileText, ExternalLink, MoreHorizontal, Plus, Upload, X,
} from "lucide-react";
import FlexSidebar from "../../../_components/FlexSidebar";
import FlexHeader from "../../../_components/FlexHeader";
import Footer from "@/app/components/layout/Footer";
import { uploadAssignmentAttachment } from "../../_shared/uploadAssignmentAttachment";
import type { RosterItem } from "../../../siniflar/_shared/groupDisplay";
import EditAssignmentModal, { type EditableAssignment, type AssignmentStatus } from "../../_shared/EditAssignmentModal";

type MainTab = "students" | "assignments";
type Filter = "all" | "active" | "completed" | "archived";

interface GroupInfo {
  code: string;
  branch: string;
  educationName: string;
  trainerName: string;
  enrolled: number;
}

interface AssignmentAttachment { id: string; fileName: string; fileSize: number; mimeType: string; webViewLink: string }

interface AssignmentItem {
  id: string;
  title: string;
  description: string;
  dueDate?: string;
  createdAt?: string;
  status: AssignmentStatus;
  attachments: AssignmentAttachment[];
}

type SubmissionStatus = "submitted" | "reviewing" | "revision" | "completed" | "retracted";

interface SubmissionRow {
  id: string;
  assignmentId: string;
  personId: string;
  status: SubmissionStatus;
}

function fmtEndDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const datePart = d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  const weekday = d.toLocaleDateString("tr-TR", { weekday: "short" });
  return `${datePart} ${weekday}.`;
}
function fmtCreatedAt(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const weekday = d.toLocaleDateString("tr-TR", { weekday: "short" });
  return `${day}.${month}.${d.getFullYear()} ${weekday}.`;
}

async function authHeaders(): Promise<Record<string, string>> {
  const u = auth.currentUser;
  const token = u ? await u.getIdToken() : "";
  return { Authorization: `Bearer ${token}` };
}

export default function OdevTeslimiGroupPage() {
  const router = useRouter();
  const { groupId } = useParams<{ groupId: string }>();
  // Belirli bir ödevden geri dönülünce (Parkur/detay sayfası) o ödevin akordiyonu
  // otomatik açık gelsin diye — 2026-07-11 kullanıcı bulgusu: canlıda bu davranış vardı,
  // FlexOS'ta kaybolmuştu (geri oku hiçbir hint vermeden düz gruba dönüyordu).
  const focusAssignmentId = useSearchParams().get("assignmentId");

  const [tab, setTab] = useState<MainTab>("assignments");
  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [roster, setRoster] = useState<RosterItem[]>([]);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentSearch, setStudentSearch] = useState("");
  const [editingAssignment, setEditingAssignment] = useState<EditableAssignment | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await authHeaders();

      const groupsRes = await fetch("/api/flexos/groups", { headers });
      if (groupsRes.ok) {
        const data = await groupsRes.json() as { items: { id: string; code: string; branch: string; educationName: string; trainerName: string; enrolled: number }[] };
        const g = data.items.find((x) => x.id === groupId);
        if (g) setGroup({ code: g.code, branch: g.branch, educationName: g.educationName, trainerName: g.trainerName, enrolled: g.enrolled });
      }

      const rosterRes = await fetch(`/api/flexos/groups/${groupId}/roster`, { headers });
      if (rosterRes.ok) {
        const data = await rosterRes.json() as { items: RosterItem[] };
        setRoster(data.items);
      }

      const assignRes = await fetch(`/api/flexos/assignments?groupId=${groupId}`, { headers });
      if (assignRes.ok) {
        const data = await assignRes.json() as { items: AssignmentItem[] };
        setAssignments(data.items);
      }

      const subRes = await fetch(`/api/flexos/submissions?groupId=${groupId}`, { headers });
      if (subRes.ok) {
        const data = await subRes.json() as { items: SubmissionRow[] };
        setSubmissions(data.items);
      }
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredRoster = roster.filter((s) => s.name.toLowerCase().includes(studentSearch.toLowerCase()));

  const TABS: { key: MainTab; label: string; icon: React.ReactNode }[] = [
    { key: "students", label: "Öğrenciler", icon: <Users size={16} /> },
    { key: "assignments", label: "Ödevler", icon: <BookOpen size={16} /> },
  ];

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh", overflow: "hidden", background: "#EEF0F3" }}>
      <FlexSidebar active="odev-teslimi" />
      <main style={{ flex: 1, height: "100%", overflowY: "auto", background: "#EEF0F3", display: "flex", flexDirection: "column" }}>
        <FlexHeader
          icon={<ClipboardList size={20} color="#fff" />}
          title="Ödev Teslimi"
          subtitle="Grup bazında ödev takibi ve teslim yönetimi"
          roleLabel="Eğitmen"
        />

        <div style={{ padding: "30px 36px 72px", maxWidth: 1920, margin: "0 auto", width: "100%", boxSizing: "border-box", flex: 1 }} className="font-inter">
          <div className="flex items-end justify-between mb-7 flex-wrap gap-4">
            <div className="flex items-end flex-wrap gap-6">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.push("/flexos/odevler/teslim")}
                  className="w-10 h-10 rounded-[13px] bg-surface-200 hover:bg-surface-300 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                >
                  <ArrowLeft size={18} className="text-surface-700" />
                </button>
                <div>
                  {(group?.branch || group?.educationName) && (
                    <p className="text-[12px] font-medium text-surface-400">
                      {group?.branch ? `${group.branch} Şb.` : ""}{group?.branch && group?.educationName ? " • " : ""}{group?.educationName ?? ""}
                    </p>
                  )}
                  <h1 className="text-[22px] font-bold text-base-primary-900 leading-tight">{group?.code ?? ""}</h1>
                </div>
              </div>

              <div className="flex items-center border-b border-surface-200">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`flex items-center gap-2 px-5 py-2.5 text-[14px] font-semibold border-b-2 -mb-px transition-colors cursor-pointer
                      ${tab === t.key
                        ? "border-base-primary-600 text-base-primary-600 [&>svg]:text-base-primary-600"
                        : "border-transparent text-text-secondary hover:text-text-primary [&>svg]:text-text-secondary"
                      }`}
                  >
                    {t.icon}
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <p className="pb-2.5 text-[14px] text-text-secondary">Toplam: {group?.enrolled ?? 0} Öğrenci</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24 text-surface-400">
              <Loader2 size={22} className="animate-spin" />
            </div>
          ) : tab === "assignments" ? (
            <AssignmentsTab
              assignments={assignments}
              submissions={submissions}
              focusAssignmentId={focusAssignmentId}
              totalStudents={group?.enrolled ?? 0}
              groupId={groupId}
              onEdit={(a) => setEditingAssignment({ id: a.id, title: a.title, description: a.description, dueDate: a.dueDate, status: a.status, attachments: a.attachments })}
              onAttachmentsChanged={(assignmentId, attachments) => setAssignments((prev) => prev.map((a) => (a.id === assignmentId ? { ...a, attachments } : a)))}
              onDeleted={(assignmentId) => setAssignments((prev) => prev.filter((a) => a.id !== assignmentId))}
            />
          ) : (
            <div className="space-y-3">
              <div className="relative max-w-xs">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                <input
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Öğrenci ara..."
                  className="w-full pl-9 pr-4 h-9 rounded-xl border border-surface-200 bg-white text-[13px] text-text-primary outline-none focus:border-base-primary-400 transition-colors"
                />
              </div>
              <div className="border border-surface-200 rounded-2xl overflow-hidden bg-white">
                {filteredRoster.length === 0 ? (
                  <div className="py-10 text-center text-[13px] text-surface-400">Öğrenci bulunamadı</div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-surface-100 bg-surface-50">
                        <th className="px-5 py-3 text-[12px] font-bold text-surface-500">Ad Soyad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRoster.map((s) => (
                        <tr key={s.personId} className="border-b border-surface-50 last:border-0 hover:bg-surface-50/50 transition-colors">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-base-primary-100 flex items-center justify-center text-[12px] font-black text-base-primary-600">
                                {s.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                              </div>
                              <span className="text-[13px] font-bold text-text-primary">{s.name}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>

        <Footer mini containerClassName="w-full max-w-[1920px] mx-auto px-9" />
      </main>
      <EditAssignmentModal
        assignment={editingAssignment}
        onClose={() => setEditingAssignment(null)}
        onSaved={(updated) => {
          setEditingAssignment(null);
          setAssignments((prev) => prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)));
        }}
      />
    </div>
  );
}

/* ── Ödevler Tab ── */

function AssignmentsTab({ assignments, submissions, totalStudents, groupId, focusAssignmentId, onEdit, onAttachmentsChanged, onDeleted }: {
  assignments: AssignmentItem[]; submissions: SubmissionRow[]; totalStudents: number; groupId: string; focusAssignmentId: string | null; onEdit: (a: AssignmentItem) => void; onAttachmentsChanged: (assignmentId: string, attachments: AssignmentAttachment[]) => void; onDeleted: (assignmentId: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const today = new Date(); today.setHours(0, 0, 0, 0);
  // İptal edilen (arşivlenen) ödevler Aktif/Tamamlanan'a hiç karışmaz — eskiden bu ayrım
  // SADECE teslim tarihine bakıyordu, `status==="archived"` hiç kontrol edilmediği için
  // iptal edilmiş ama tarihi ileride olan bir ödev hâlâ "Aktif Ödevler"de listeleniyordu.
  // Arşivlenenler artık ayrı bir "Arşiv" sekmesinde, kalıcı silme aksiyonuyla görünüyor.
  const visibleAssignments = assignments.filter((a) => a.status !== "archived");
  const activeAssignments = visibleAssignments
    .filter((a) => { const d = a.dueDate ? new Date(a.dueDate) : null; return d ? d >= today : true; })
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  const completedAssignments = visibleAssignments
    .filter((a) => { const d = a.dueDate ? new Date(a.dueDate) : null; return !!d && d < today; })
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  const archivedAssignments = assignments
    .filter((a) => a.status === "archived")
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: "Tümü" },
    { key: "active", label: "Aktif Ödevler" },
    { key: "completed", label: "Tamamlananlar" },
    { key: "archived", label: "Arşiv" },
  ];
  const showActive = filter === "all" || filter === "active";
  const showCompleted = filter === "all" || filter === "completed";
  const showArchived = filter === "archived";

  return (
    <div>
      <div className="w-full rounded-2xl mb-6" style={{ height: 220, backgroundColor: "#F91079" }} />

      <div className="flex items-center gap-2 mb-7">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-1.5 rounded-full text-[13px] border transition-colors cursor-pointer
              ${filter === f.key
                ? "bg-white border-surface-300 text-text-primary font-semibold shadow-sm"
                : "bg-transparent border-surface-200 text-surface-500 font-medium hover:border-surface-300 hover:text-surface-700"
              }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {showActive && activeAssignments.length > 0 && (
        <section className="mb-8">
          <h2 className="text-[18px] font-bold text-text-primary mb-3">Aktif Ödevler</h2>
          <div className="space-y-3">
            {activeAssignments.map((a) => (
              <TaskAccordion key={a.id} assignment={a} submissions={submissions.filter((s) => s.assignmentId === a.id)} totalStudents={totalStudents} groupId={groupId} isActiveSection initialOpen={a.id === focusAssignmentId} onEdit={onEdit} onAttachmentsChanged={onAttachmentsChanged} />
            ))}
          </div>
        </section>
      )}

      {showCompleted && completedAssignments.length > 0 && (
        <section>
          <h2 className="text-[18px] font-bold text-text-primary mb-3">Tamamlananlar</h2>
          <div className="space-y-3">
            {completedAssignments.map((a) => (
              <TaskAccordion key={a.id} assignment={a} submissions={submissions.filter((s) => s.assignmentId === a.id)} totalStudents={totalStudents} groupId={groupId} isActiveSection={false} initialOpen={a.id === focusAssignmentId} onEdit={onEdit} onAttachmentsChanged={onAttachmentsChanged} />
            ))}
          </div>
        </section>
      )}

      {showArchived && (
        archivedAssignments.length > 0 ? (
          <section>
            <h2 className="text-[18px] font-bold text-text-primary mb-3">Arşiv</h2>
            <div className="space-y-3">
              {archivedAssignments.map((a) => (
                <ArchivedAssignmentCard key={a.id} assignment={a} onDeleted={onDeleted} />
              ))}
            </div>
          </section>
        ) : (
          <div className="flex flex-col items-center gap-2 py-16 text-surface-400">
            <BookOpen size={22} />
            <p className="text-[13px] font-medium">Arşivlenmiş ödev yok</p>
          </div>
        )
      )}

      {!showArchived && assignments.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-16 text-surface-400">
          <BookOpen size={22} />
          <p className="text-[13px] font-medium">Bu gruba ait ödev yok</p>
        </div>
      )}
    </div>
  );
}

/** Arşivlenmiş (iptal edilmiş) ödev kartı — sadece görüntüleme + kalıcı silme, teslim/dosya
 *  yönetimi yok (TaskAccordion'un aksine, iptal edilmiş bir ödevde bunların anlamı kalmıyor). */
function ArchivedAssignmentCard({ assignment, onDeleted }: { assignment: AssignmentItem; onDeleted: (assignmentId: string) => void }) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm("Bu ödevi KALICI olarak silmek istediğine emin misin? Bu işlem geri alınamaz.")) return;
    setDeleting(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/flexos/assignments/${assignment.id}`, { method: "DELETE", headers });
      if (!res.ok) { toast.error("Ödev silinemedi."); return; }
      toast.success("Ödev kalıcı olarak silindi.");
      onDeleted(assignment.id);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-surface-200 p-4 flex items-center justify-between gap-4 opacity-80">
      <div className="min-w-0">
        <p className="text-[14px] font-bold text-text-primary truncate">{assignment.title}</p>
        {assignment.dueDate && <p className="text-[12px] text-surface-400 mt-0.5">{fmtEndDate(assignment.dueDate)}</p>}
      </div>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="shrink-0 h-8 px-4 rounded-full text-[12px] font-semibold border border-status-danger-200 text-status-danger-500 hover:bg-status-danger-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {deleting ? "Siliniyor…" : "Kalıcı Sil"}
      </button>
    </div>
  );
}

function TaskAccordion({ assignment, submissions, totalStudents, groupId, isActiveSection, initialOpen, onEdit, onAttachmentsChanged }: {
  assignment: AssignmentItem; submissions: SubmissionRow[]; totalStudents: number; groupId: string; isActiveSection: boolean; initialOpen?: boolean; onEdit: (a: AssignmentItem) => void; onAttachmentsChanged: (assignmentId: string, attachments: AssignmentAttachment[]) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(!!initialOpen);
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Dosya Yükle — canlıdaki AttachmentManager portu (bkz. dosya başı yorumu).
  const [expanding, setExpanding] = useState(false);
  const [driveMode, setDriveMode] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [driveLink, setDriveLink] = useState("");
  const [driveName, setDriveName] = useState("");
  const [attachError, setAttachError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function saveAttachments(next: AssignmentAttachment[]) {
    const headers = await authHeaders();
    const res = await fetch(`/api/flexos/assignments/${assignment.id}`, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ attachments: next }),
    });
    if (!res.ok) throw new Error("Kaydedilemedi.");
    onAttachmentsChanged(assignment.id, next);
  }

  async function handleFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (!files.length) return;
    setUploading(true);
    setAttachError("");
    try {
      const uploaded: AssignmentAttachment[] = [];
      // Sıralı yükleme — canlıdaki gibi (klasör oluşturma thread-safe değil).
      for (const file of files) {
        const attachment = await uploadAssignmentAttachment(assignment.id, file, (pct) => setUploadProgress(Math.round(pct * 0.9)));
        uploaded.push(attachment);
      }
      setUploadProgress(95);
      await saveAttachments([...assignment.attachments, ...uploaded]);
      setUploadProgress(100);
      setExpanding(false);
      setDriveMode(false);
    } catch (err: unknown) {
      setAttachError(err instanceof Error ? err.message : "Yükleme başarısız.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  async function handleDriveSave() {
    const url = driveLink.trim();
    if (!url) return;
    // Google Drive "modu" canlıda da gerçek bir picker değil — sadece link yapıştırma.
    // driveFileId/fileSize/mimeType yok (gerçek yükleme değil, referans link).
    const newAttachment: AssignmentAttachment = {
      id: `drive-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      fileName: driveName.trim() || "Google Drive Dosyası",
      fileSize: 0,
      mimeType: "application/vnd.google-apps.drive-link",
      webViewLink: url,
    };
    try {
      await saveAttachments([...assignment.attachments, newAttachment]);
      setExpanding(false);
      setDriveMode(false);
      setDriveLink("");
      setDriveName("");
    } catch {
      toast.error("Kaydedilemedi.");
    }
  }

  async function handleRemoveAttachment(attachmentId: string) {
    try {
      await saveAttachments(assignment.attachments.filter((a) => a.id !== attachmentId));
    } catch {
      toast.error("Silinemedi.");
    }
  }

  function toggleExpand() {
    const next = !expanding;
    setExpanding(next);
    if (!next) { setDriveMode(false); setAttachError(""); }
  }

  const hasFiles = assignment.attachments.length > 0;

  // Kartın TÜMÜNE sürükle-bırak — canlıdaki davranış: panel açıkken (expanding=true,
  // "uploadActive") kartın HERHANGİ bir noktasına dosya sürüklenince mavi glow border
  // çıkar, bırakınca otomatik yüklenir. 2026-07-11 DÜZELTME: ilk denemede canlıdaki gibi
  // imperatif DOM stiliyle (ref.current.style.x=...) yazılmıştı ama ÇALIŞMADI (kullanıcı
  // testinde hiç border çıkmadı) — modal'daki (ÇALIŞAN, kanıtlı) `useState` deseniyle
  // değiştirildi, daha güvenilir.
  const [isDragOver, setIsDragOver] = useState(false);
  useEffect(() => { if (!expanding) setIsDragOver(false); }, [expanding]);

  // Belirli bir ödevden geri dönülünce (bkz. OdevTeslimiGroupPage focusAssignmentId)
  // sadece açık gelmesi yetmez, görünür alana da kaydırılmalı — sayfada çok ödev varsa
  // açık kart ekran dışında kalabilir.
  useEffect(() => {
    if (initialOpen) rootRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const teslimEdenler = submissions.filter((s) => s.status !== "revision" && s.status !== "retracted").length;
  const revize = submissions.filter((s) => s.status === "revision").length;
  const bekleyenler = Math.max(0, totalStudents - submissions.filter((s) => s.status !== "retracted").length);

  return (
    <div
      ref={rootRef}
      className="rounded-2xl transition-shadow duration-150"
      style={isDragOver ? { boxShadow: "0 0 0 3px #6366f1, 0 0 0 6px rgba(99,102,241,0.15)" } : undefined}
      // 2026-07-11 (2. düzeltme): "+" ile paneli önce açmak ZORUNLU değilmiş — kullanıcı
      // canlıda paneli hiç açmadan, kapalı/dinlenme durumundaki karta bile dosya
      // sürükleyince mavi hale çıkıp otomatik yüklendiğini belirtti. `expanding` şartı
      // kaldırıldı — kart HER ZAMAN geçerli bir drop hedefi, drop anında panel de
      // (ilerleme çubuğu görünsün diye) otomatik açılıyor.
      onDragEnter={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragOver={(e) => { e.preventDefault(); }}
      onDragLeave={(e) => {
        if (e.clientX === 0 && e.clientY === 0) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const inside = e.clientX > rect.left && e.clientX < rect.right && e.clientY > rect.top && e.clientY < rect.bottom;
        if (!inside) setIsDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        // Akordiyon kapalıyken sürüklenip bırakılırsa da AÇILIR — aksi halde ilerleme
        // çubuğu görünmez, kullanıcı yüklemenin gerçekten başladığını göremez.
        if (e.dataTransfer.files.length) { setOpen(true); setExpanding(true); void handleFiles(e.dataTransfer.files); }
      }}
    >
    <div className={`bg-white border rounded-2xl overflow-hidden transition-colors duration-150 ${isDragOver ? "border-[#6366f1]" : "border-surface-200"}`}>
      <div
        className="flex items-center justify-between px-6 py-4 cursor-pointer select-none hover:bg-surface-50/60 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isActiveSection ? "bg-designstudio-primary-500" : "bg-designstudio-secondary-500"}`}>
            <ClipboardList size={18} className="text-white" />
          </div>
          <span className="text-[16px] font-semibold text-text-primary truncate">{assignment.title}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {assignment.dueDate && <span className="text-[13px] text-surface-500">Teslim: {fmtEndDate(assignment.dueDate)}</span>}
          {/* 3-nokta menü → Ödevi Düzenle (başlık/açıklama/tarih/durum). Dosya yükleme
              BURADA DEĞİL — aşağıdaki açık gövdede, canlıdaki AttachmentManager gibi. */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-100 text-surface-400 hover:text-text-primary transition-all cursor-pointer"
            >
              <MoreHorizontal size={15} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-8 z-50 bg-white border border-surface-200 rounded-2xl shadow-xl overflow-hidden min-w-[150px]" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => { setMenuOpen(false); onEdit(assignment); }}
                  className="w-full px-4 py-2.5 text-left text-[13px] font-bold text-text-primary hover:bg-surface-50 transition-colors cursor-pointer"
                >
                  Ödevi Düzenle
                </button>
              </div>
            )}
          </div>
          <ChevronDown size={15} className={`text-surface-500 transition-transform duration-[320ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${open ? "rotate-180" : ""}`} />
        </div>
      </div>

      {open && (
        <>
          <div className="h-px bg-surface-100" />
          <div className="p-6">
            {assignment.createdAt && (
              <p className="text-[13px] text-surface-500 mb-4">
                Eklenme Tarihi:&nbsp;<span className="font-semibold text-text-secondary">{fmtCreatedAt(assignment.createdAt)}</span>
              </p>
            )}

            <div className="flex items-start gap-10 mb-5">
              <div className="w-[60%] shrink-0 min-w-0">
                <p className="text-[14px] lg:text-[15px] xl:text-[16px] font-normal text-text-primary leading-relaxed whitespace-pre-line">
                  {assignment.description}
                </p>
              </div>
              <div className="flex-1 flex items-center justify-center gap-10">
                <StatBlock icon={<Smile size={32} strokeWidth={1.5} className="text-emerald-500" />} label="Teslim Edenler" count={teslimEdenler} />
                <StatBlock icon={<Meh size={32} strokeWidth={1.5} className="text-surface-500" />} label="Bekleyenler" count={bekleyenler} />
                <StatBlock icon={<RefreshCw size={32} strokeWidth={1.5} className="text-designstudio-primary-500" />} label="Revize İstenenler" count={revize} />
              </div>
            </div>

            <div className="flex flex-wrap items-end justify-between gap-3 mt-5">
              {/* Dosya yönetimi — canlıdaki AttachmentManager BİREBİR portu. */}
              <div className="flex items-center flex-wrap gap-2">
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => { const files = e.target.files; if (files) void handleFiles(files); e.target.value = ""; }} />

                <button
                  onClick={toggleExpand}
                  disabled={uploading}
                  style={hasFiles ? {
                    height: 44, width: 44, flexShrink: 0, borderRadius: 12,
                    border: `1px solid ${expanding ? "#6366f1" : "#a5b4fc"}`,
                    backgroundColor: expanding ? "#6366f1" : "#eef2ff",
                    color: expanding ? "#ffffff" : "#4f46e5",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "background-color 150ms, border-color 150ms, color 150ms",
                    cursor: "pointer",
                  } : { height: 44, flexShrink: 0 }}
                  className={`transition-colors duration-150 cursor-pointer disabled:opacity-50 ${!hasFiles
                    ? `flex items-center gap-2 px-4 rounded-xl border border-dashed ${expanding ? "border-base-primary-400 bg-base-primary-50 text-base-primary-600" : "border-surface-300 bg-white text-surface-400 hover:border-base-primary-300 hover:text-base-primary-500"}`
                    : ""}`}
                >
                  <motion.span animate={{ rotate: expanding ? 45 : 0 }} transition={{ type: "tween", duration: 0.18, ease: "easeInOut" }} className="flex items-center justify-center">
                    <Plus size={14} strokeWidth={2.5} />
                  </motion.span>
                  {!hasFiles && <span className="text-[13px] font-semibold leading-none">Dosya Yükle</span>}
                </button>

                <AnimatePresence>
                  {expanding && (
                    <motion.div
                      key="upload-panel"
                      initial={{ width: 0, opacity: 0 }} animate={{ width: 290, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
                      transition={{ type: "tween", duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                      style={{ height: 44, overflow: "hidden", flexShrink: 0 }}
                    >
                      {uploading ? (
                        <div style={{ height: 44, minWidth: 180 }} className="flex flex-col justify-center px-4 border border-surface-200 rounded-xl bg-white whitespace-nowrap">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[11px] font-semibold text-surface-400">{uploadProgress < 90 ? "Yükleniyor" : uploadProgress < 100 ? "Tamamlanıyor" : "Bitti"}</span>
                            <span className="text-[11px] font-bold text-surface-600">{uploadProgress}%</span>
                          </div>
                          <div className="h-[3px] rounded-full bg-surface-100 overflow-hidden">
                            <div className="h-full rounded-full bg-base-primary-500 transition-[width] duration-300" style={{ width: `${uploadProgress}%` }} />
                          </div>
                        </div>
                      ) : driveMode ? (
                        <div style={{ height: 44 }} className="flex items-center gap-2 w-full">
                          <input
                            value={driveLink}
                            onChange={(e) => setDriveLink(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") void handleDriveSave(); }}
                            placeholder="Google Drive linki..."
                            autoFocus
                            style={{ height: 44 }}
                            className="flex-1 min-w-0 px-3 rounded-xl border border-surface-200 text-[12px] outline-none focus:border-base-primary-400 transition-colors bg-white"
                          />
                          <button onClick={() => void handleDriveSave()} disabled={!driveLink.trim()} style={{ height: 44, flexShrink: 0 }} className="px-3 bg-base-primary-700 text-white text-[12px] font-bold rounded-xl disabled:opacity-40 cursor-pointer hover:bg-base-primary-800 transition-colors whitespace-nowrap">
                            Ekle
                          </button>
                          <button onClick={() => { setDriveMode(false); setDriveLink(""); setDriveName(""); }} style={{ height: 44, width: 44, flexShrink: 0 }} className="flex items-center justify-center bg-surface-100 text-surface-500 rounded-xl cursor-pointer hover:bg-surface-200 transition-colors">
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div
                          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false); }}
                          onDrop={(e) => { e.preventDefault(); setDragOver(false); void handleFiles(e.dataTransfer.files); }}
                          style={{ height: 44 }}
                          className={`w-full flex items-center gap-1 px-2 border border-dashed rounded-xl transition-colors whitespace-nowrap ${dragOver ? "border-base-primary-400 bg-base-primary-50" : "border-surface-300 bg-white"}`}
                        >
                          <button onClick={() => fileInputRef.current?.click()} className="h-full flex items-center gap-2 px-3 rounded-lg text-[12px] font-semibold text-text-secondary hover:bg-surface-100 transition-colors cursor-pointer">
                            <Upload size={13} className="text-surface-400 shrink-0" />
                            {dragOver ? "Bırakın..." : "Bilgisayardan Yükle"}
                          </button>
                          <div className="w-px h-5 bg-surface-200 shrink-0" />
                          <button onClick={() => setDriveMode(true)} className="h-full flex items-center gap-2 px-3 rounded-lg text-[12px] font-semibold text-text-secondary hover:bg-surface-100 transition-colors cursor-pointer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/icons/google-drive.svg" width={13} height={13} alt="" className="shrink-0" />
                            Google Drive
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {assignment.attachments.map((a) => (
                  <div key={a.id} style={{ height: 44 }} className="flex items-center gap-2 bg-white border border-surface-200 rounded-xl px-3 max-w-[240px]">
                    {a.mimeType === "application/vnd.google-apps.drive-link"
                      /* eslint-disable-next-line @next/next/no-img-element */
                      ? <img src="/icons/google-drive.svg" width={13} height={13} alt="" className="shrink-0" />
                      : <FileText size={13} className="text-surface-400 shrink-0" />}
                    <span className="text-[12px] font-semibold text-text-primary truncate">{a.fileName}</span>
                    <a href={a.webViewLink} target="_blank" rel="noopener noreferrer" className="p-0.5 text-surface-300 hover:text-base-primary-600 transition-colors shrink-0 ml-auto">
                      <ExternalLink size={12} />
                    </a>
                    <button onClick={() => void handleRemoveAttachment(a.id)} className="p-0.5 text-surface-300 hover:text-status-danger-500 transition-colors cursor-pointer shrink-0">
                      <X size={12} />
                    </button>
                  </div>
                ))}

                {attachError && <span className="text-[11px] font-semibold text-status-danger-500">{attachError}</span>}
              </div>

              <button
                onClick={() => router.push(`/flexos/odevler/teslim/${groupId}/${assignment.id}`)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[14px] font-semibold text-white cursor-pointer transition-colors shrink-0"
                style={{ backgroundColor: "#5E63C2" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#4D52A6")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#5E63C2")}
              >
                Teslim Durumu
                <ArrowRight size={15} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
    </div>
  );
}

function StatBlock({ icon, label, count }: { icon: React.ReactNode; label: string; count: number }) {
  return (
    <div className="flex flex-col items-center">
      {icon}
      <p className="mt-1 text-[14px] font-medium text-text-primary text-center leading-tight">{label}</p>
      <p className="mt-2 text-[32px] font-bold text-text-secondary leading-none">{count}</p>
    </div>
  );
}
