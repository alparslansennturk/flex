"use client";

/**
 * FlexOS · Öğrenci Dashboard — canlıdaki `/student/[studentId]/page.tsx` portu.
 * Görünüm/işleyiş birebir: filtre pilleri, accordion ödev listesi, "Duyurular" paneli.
 * Header artık eğitmen/admin sayfalarıyla AYNI paylaşımlı `FlexHeader` (2026-07-13,
 * eski ayrı `StudentHeader` kaldırıldı — yükseklik/hizalama tutarsızlığı vardı).
 * Sınıf Ligi yerine Eğitmen Ana Sayfa'daki "En Son Aktiviteler" panelinin birebir aynısı.
 * Backend: FlexOS Assignment/Submission/Comment domain'i (Faz 2+3).
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth } from "@/app/lib/firebase";
import {
  Loader2, BookOpen, ClipboardList, ChevronDown,
  CheckCircle2, RotateCcw, Clock, ArrowRight, FileText,
} from "lucide-react";
import StudentSidebar from "../_components/StudentSidebar";
import FlexHeader, { FlexPageContent, FLEX_CONTENT_MAX_WIDTH_COMPACT_CLASS } from "../../_components/FlexHeader";
import { ActivityFeed, type ActivityFeedItem } from "../../_components/ActivityFeed";
import ConnectWidget from "../../_components/ConnectWidget";

/* ── Types ── */

type SubmissionStatus = "submitted" | "reviewing" | "revision" | "completed" | "retracted";

interface AssignmentAttachment {
  fileName: string;
  webViewLink: string;
}

interface AssignmentItem {
  id: string;
  title: string;
  description: string;
  dueDate?: string;
  createdAt?: string;
  attachments: AssignmentAttachment[];
}

interface SubmissionInfo {
  status: SubmissionStatus;
  grade?: number;
}

interface AssignmentRow {
  assignment: AssignmentItem;
  submission: SubmissionInfo | null;
}

interface AnnouncementItem {
  id: string;
  assignmentId: string;
  text: string;
  authorName: string;
  createdAt: string;
}

type Filter = "all" | "active" | "completed";

/* ── Helpers ── */

function fmtDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", weekday: "short" });
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

const STATUS_META: Record<SubmissionStatus, { label: string; cls: string; icon: React.ReactNode }> = {
  submitted: { label: "Teslim Edildi", cls: "text-status-success-700", icon: <CheckCircle2 size={44} strokeWidth={1.4} className="text-status-success-500" /> },
  reviewing: { label: "İncelemede", cls: "text-status-success-700", icon: <Clock size={44} strokeWidth={1.4} className="text-status-success-500" /> },
  revision: { label: "Revize Bekleniyor", cls: "text-status-info", icon: <RotateCcw size={44} strokeWidth={1.4} className="text-status-info" /> },
  completed: { label: "Tamamlandı", cls: "text-status-success-700", icon: <CheckCircle2 size={44} strokeWidth={1.4} className="text-status-success-500" /> },
  retracted: { label: "Geri Çekildi", cls: "text-surface-400", icon: <Clock size={44} strokeWidth={1.4} className="text-surface-300" /> },
};

async function authHeaders(): Promise<Record<string, string>> {
  const u = auth.currentUser;
  const token = u ? await u.getIdToken() : "";
  return { Authorization: `Bearer ${token}` };
}

/* ── Page ── */

export default function FlexosStudentDashboard() {
  const { personId } = useParams<{ personId: string }>();

  const [me, setMe] = useState<{ name: string; groupCode?: string } | null>(null);
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedAnn, setSelectedAnn] = useState<AnnouncementItem | null>(null);

  useEffect(() => { loadData(); }, [personId]);

  async function loadData() {
    setLoading(true);
    try {
      const headers = await authHeaders();

      const meRes = await fetch(`/api/flexos/student/me?personId=${personId}`, { headers });
      if (meRes.ok) {
        const data = await meRes.json() as { person: { firstName: string; lastName: string }; group: { code: string } | null };
        setMe({ name: `${data.person.firstName} ${data.person.lastName}`.trim(), groupCode: data.group?.code });
      }

      const assignRes = await fetch(`/api/flexos/student/assignments?personId=${personId}`, { headers });
      if (assignRes.ok) {
        const data = await assignRes.json() as { items: AssignmentRow[] };
        setRows(data.items);
      }

      const annRes = await fetch(`/api/flexos/student/announcements?personId=${personId}`, { headers });
      if (annRes.ok) {
        const data = await annRes.json() as { items: { id: string; assignmentId: string; text: string; authorName: string; createdAt: string }[] };
        setAnnouncements(data.items.map((a) => ({ ...a })).reverse());
      }

      const activityRes = await fetch(`/api/flexos/student/activity?personId=${personId}`, { headers });
      if (activityRes.ok) {
        const data = await activityRes.json() as { items: ActivityFeedItem[] };
        setActivityLog(data.items);
      }
    } finally {
      setLoading(false);
    }
  }

  if (loading || !me) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-50">
        <Loader2 size={22} className="animate-spin text-surface-400" />
      </div>
    );
  }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const activeRows = rows
    .filter((r) => { const d = r.assignment.dueDate ? new Date(r.assignment.dueDate) : null; return !d || d >= today; })
    .sort((a, b) => (b.assignment.createdAt ?? "").localeCompare(a.assignment.createdAt ?? ""));
  const pastRows = rows
    .filter((r) => { const d = r.assignment.dueDate ? new Date(r.assignment.dueDate) : null; return !!d && d < today; })
    .sort((a, b) => (b.assignment.dueDate ?? "").localeCompare(a.assignment.dueDate ?? ""));

  const showActive = filter === "all" || filter === "active";
  const showPast = filter === "all" || filter === "completed";

  return (
    <div className="flex h-screen overflow-hidden bg-white font-inter antialiased text-text-primary">
      <StudentSidebar personId={personId} />

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Standart header (2026-07-13): eğitmen/admin sayfalarıyla AYNI paylaşımlı
            `FlexHeader` — önceki ayrı `StudentHeader` biraz farklı yükseklik/hizalama
            kullanıyordu, artık birebir aynı bileşen (displayNameOverride: `users/{uid}`
            legacy dokümanı FlexOS-only öğrenci hesaplarında hiç yok, Person'dan gelen
            isim doğrudan verilir). */}
        <FlexHeader
          greeting
          subtitle="Bugün ödevlerini kontrol etmeyi unutma."
          roleLabel={me.groupCode ? `${me.groupCode} · Öğrenci` : "Öğrenci"}
          maxWidthClassName={FLEX_CONTENT_MAX_WIDTH_COMPACT_CLASS}
          displayNameOverride={me.name}
        />
        <main className="flex-1 overflow-y-auto overflow-x-clip [scrollbar-gutter:stable]">
          {/* Merkezi genişlik (2026-07-13): Eğitmen Ana Sayfa'daki AYNI `FlexPageContent`
              (FLEX_CONTENT_MAX_WIDTH_COMPACT_CLASS) — önceki ayrı/elle yazılmış
              max-w değerleri (960/1200/1480) diğer FlexOS sayfalarıyla tutarsızdı. */}
          <FlexPageContent className="pt-7 pb-12">
            {/* Başlık + filtre pilleri iki sütunun ÜSTÜNDE, tam genişlik — böylece
                sağdaki aktivite paneli soldaki ödev kutusunun (border) tam başlangıcıyla
                hizalanır (2026-07-16: eskiden ayrı bir xl:pt-14 tahminiyle hizalanmaya
                çalışılıyordu, piksel kayması oluyordu). */}
            <div className="flex items-end gap-4 mb-7">
              <h1 className="text-[22px] font-bold text-base-primary-900 leading-tight">{me.groupCode || "Öğrenci Paneli"}</h1>
            </div>

            <div className="flex items-center gap-2 mb-7">
              {(["all", "active", "completed"] as Filter[]).map((f) => {
                const labels: Record<Filter, string> = { all: "Tümü", active: "Aktif Ödevler", completed: "Tamamlananlar" };
                return (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-4 py-1.5 rounded-full text-[13px] border transition-colors cursor-pointer
                      ${filter === f
                        ? "bg-white border-surface-300 text-text-primary font-semibold shadow-sm"
                        : "bg-transparent border-surface-200 text-surface-500 font-medium hover:border-surface-300 hover:text-surface-700"
                      }`}
                  >
                    {labels[f]}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col xl:flex-row gap-6 xl:gap-8 xl:items-start">

              {/* ══ Sol: Ödevler ══ */}
              <div className="flex-1 min-w-0">
                {showActive && activeRows.length > 0 && (
                  <section className="mb-8">
                    <h2 className="text-[18px] font-bold text-text-primary mb-3">Aktif Ödevler</h2>
                    <div className="space-y-3">
                      {activeRows.map((r) => (
                        <StudentTaskAccordion key={r.assignment.id} row={r} personId={personId} isActiveSection />
                      ))}
                    </div>
                  </section>
                )}

                {showPast && pastRows.length > 0 && (
                  <section>
                    <h2 className="text-[18px] font-bold text-text-primary mb-3">Tamamlananlar</h2>
                    <div className="space-y-3">
                      {pastRows.map((r) => (
                        <StudentTaskAccordion key={r.assignment.id} row={r} personId={personId} isActiveSection={false} />
                      ))}
                    </div>
                  </section>
                )}

                {rows.length === 0 && (
                  <div className="flex flex-col items-center gap-2 py-16 text-surface-400 rounded-2xl border border-dashed border-surface-200 bg-surface-50/60">
                    <BookOpen size={22} />
                    <p className="text-[13px] font-medium">Henüz ödev eklenmedi.</p>
                  </div>
                )}
              </div>

              {/* ══ Sağ: Aktiviteler + Duyurular ══ */}
              <aside className="w-full xl:w-[320px] shrink-0 flex flex-col gap-6 xl:sticky xl:top-7">
                <div className="h-[220px]">
                  <ActivityFeed items={activityLog} subtitle="Ödev ve teslim hareketlerin" />
                </div>

                <div className="bg-white rounded-2xl border border-[#E8ECF2] p-5">
                  <h2 className="text-[15px] font-bold text-text-primary mb-4">Duyurular</h2>
                  {announcements.length === 0 ? (
                    <p className="text-[13px] text-surface-400">Duyuru yok.</p>
                  ) : (
                    <div className="space-y-1">
                      {announcements.map((ann, i) => (
                        <button
                          key={ann.id}
                          onClick={() => setSelectedAnn(ann)}
                          className="w-full text-left flex gap-3 py-3 border-b border-surface-100 last:border-0 hover:bg-surface-50 rounded-xl px-2 transition-colors cursor-pointer"
                        >
                          <div className="flex flex-col items-center pt-1 shrink-0">
                            <div className="w-2 h-2 rounded-full bg-base-primary-300 shrink-0" />
                            {i < announcements.length - 1 && <div className="w-px flex-1 bg-surface-100 mt-1" />}
                          </div>
                          <div className="min-w-0 pb-2">
                            <p className="text-[13px] font-semibold text-text-primary leading-snug line-clamp-2">{ann.text}</p>
                            <p className="text-[11px] text-surface-400 mt-1">{ann.authorName} · {fmtCreatedAt(ann.createdAt)}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </aside>

            </div>
          </FlexPageContent>
        </main>
      </div>

      {selectedAnn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelectedAnn(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-3" onClick={(e) => e.stopPropagation()}>
            <p className="text-[15px] font-semibold text-text-primary leading-snug whitespace-pre-wrap">{selectedAnn.text}</p>
            <p className="text-[12px] text-surface-400">{selectedAnn.authorName} · {fmtCreatedAt(selectedAnn.createdAt)}</p>
            <button
              onClick={() => setSelectedAnn(null)}
              className="mt-2 w-full py-2 rounded-xl bg-surface-100 text-[13px] font-semibold text-text-secondary hover:bg-surface-200 transition-colors cursor-pointer"
            >
              Kapat
            </button>
          </div>
        </div>
      )}

      <ConnectWidget personId={personId} />
    </div>
  );
}

/* ── Accordion ── */

function StudentTaskAccordion({ row, personId, isActiveSection }: { row: AssignmentRow; personId: string; isActiveSection: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { assignment, submission } = row;
  const statusMeta = submission ? STATUS_META[submission.status] : null;

  return (
    <div className="bg-white border border-surface-200 rounded-2xl overflow-hidden">
      <div
        className="flex items-center justify-between px-6 py-4 cursor-pointer select-none hover:bg-surface-50/60 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isActiveSection ? "bg-designstudio-primary-500" : "bg-designstudio-secondary-500"}`}>
            <ClipboardList size={18} className="text-white" />
          </div>
          <span className="text-[16px] font-semibold text-text-primary">{assignment.title}</span>
        </div>

        <div className="flex items-center gap-3">
          {assignment.dueDate && <span className="text-[13px] text-surface-500">Teslim Tarihi: {fmtDate(assignment.dueDate)}</span>}
          {submission && !open && (
            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
              submission.status === "completed" ? "bg-status-success-100 text-status-success-700" :
              submission.status === "revision" ? "bg-blue-50 text-status-info" :
              "bg-surface-100 text-surface-500"
            }`}>
              {STATUS_META[submission.status].label}
            </span>
          )}
          <ChevronDown size={16} className={`text-surface-500 transition-transform duration-[350ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${open ? "rotate-180" : ""}`} />
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
              <div className="flex-1 flex items-center justify-center py-4">
                {statusMeta ? (
                  <div className="flex flex-col items-center gap-3 text-center">
                    {statusMeta.icon}
                    <p className={`text-[18px] font-bold ${statusMeta.cls}`}>{statusMeta.label}</p>
                    {submission!.grade != null && <p className="text-[16px] font-bold text-base-primary-700 mt-1">{submission!.grade} / 100</p>}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-center">
                    <Clock size={44} strokeWidth={1.4} className="text-surface-300" />
                    <p className="text-[16px] font-semibold text-surface-400">Henüz Teslim Edilmedi</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between mt-8">
              {assignment.attachments[0] ? (
                <a
                  href={assignment.attachments[0].webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-base-primary-50 border border-base-primary-100 rounded-xl hover:bg-base-primary-100 transition-colors px-4 py-3 max-w-[260px]"
                >
                  <div className="w-10 h-10 rounded-lg bg-base-primary-100 flex items-center justify-center shrink-0">
                    <FileText size={18} className="text-base-primary-600" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-base-primary-700 leading-tight truncate">{assignment.attachments[0].fileName || "Ödev Dosyası"}</p>
                    <p className="text-[11px] text-base-primary-400 mt-0.5">Ödev Dosyası · İndir</p>
                  </div>
                </a>
              ) : <div />}

              <button
                onClick={() => router.push(`/flexos/student/${personId}/${assignment.id}`)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[14px] font-semibold text-white cursor-pointer transition-colors"
                style={{ backgroundColor: "#5E63C2" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#4D52A6")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#5E63C2")}
              >
                Ödev Yükle
                <ArrowRight size={15} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
