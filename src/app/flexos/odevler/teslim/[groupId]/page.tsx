"use client";

/**
 * FlexOS · Ödev Teslimi — Grup Detay — canlıdaki `dashboard/assignment/[groupId]/page.tsx`
 * portu. "Öğrenciler" + "Ödevler" (accordion, teslim/bekleyen/revize istatistikleri) tabları.
 * BİLİNÇLİ FARKLAR: "Teslim Panosu" tab'ı yok (accordion + drill-down zaten aynı veriyi
 * kapsıyor); eğitmenin ödeve yeni dosya EKLEMESİ yok (canlıdaki `AttachmentManager`
 * `/api/instructor/init-file-upload` gibi FlexOS'a PORTLANMAYACAĞI FLEXOS.md'de zaten
 * belirtilen eski/denetlenmemiş bir yol kullanıyordu) — mevcut ekli dosyalar salt-okunur
 * gösterilir.
 */

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth } from "@/app/lib/firebase";
import {
  ArrowLeft, Loader2, BookOpen, ClipboardList, Search, Users,
  ChevronDown, Smile, Meh, RefreshCw, ArrowRight, FileText, ExternalLink,
} from "lucide-react";
import FlexSidebar from "../../../_components/FlexSidebar";
import FlexHeader from "../../../_components/FlexHeader";
import Footer from "@/app/components/layout/Footer";
import type { RosterItem } from "../../../siniflar/_shared/groupDisplay";

type MainTab = "students" | "assignments";
type Filter = "all" | "active" | "completed";

interface GroupInfo {
  code: string;
  branch: string;
  educationName: string;
  trainerName: string;
  enrolled: number;
}

interface AssignmentAttachment { fileName: string; webViewLink: string }

interface AssignmentItem {
  id: string;
  title: string;
  description: string;
  dueDate?: string;
  createdAt?: string;
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

  const [tab, setTab] = useState<MainTab>("assignments");
  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [roster, setRoster] = useState<RosterItem[]>([]);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentSearch, setStudentSearch] = useState("");

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
              totalStudents={group?.enrolled ?? 0}
              groupId={groupId}
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
    </div>
  );
}

/* ── Ödevler Tab ── */

function AssignmentsTab({ assignments, submissions, totalStudents, groupId }: {
  assignments: AssignmentItem[]; submissions: SubmissionRow[]; totalStudents: number; groupId: string;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const activeAssignments = assignments
    .filter((a) => { const d = a.dueDate ? new Date(a.dueDate) : null; return d ? d >= today : true; })
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  const completedAssignments = assignments
    .filter((a) => { const d = a.dueDate ? new Date(a.dueDate) : null; return !!d && d < today; })
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: "Tümü" },
    { key: "active", label: "Aktif Ödevler" },
    { key: "completed", label: "Tamamlananlar" },
  ];
  const showActive = filter === "all" || filter === "active";
  const showCompleted = filter === "all" || filter === "completed";

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
              <TaskAccordion key={a.id} assignment={a} submissions={submissions.filter((s) => s.assignmentId === a.id)} totalStudents={totalStudents} groupId={groupId} isActiveSection />
            ))}
          </div>
        </section>
      )}

      {showCompleted && completedAssignments.length > 0 && (
        <section>
          <h2 className="text-[18px] font-bold text-text-primary mb-3">Tamamlananlar</h2>
          <div className="space-y-3">
            {completedAssignments.map((a) => (
              <TaskAccordion key={a.id} assignment={a} submissions={submissions.filter((s) => s.assignmentId === a.id)} totalStudents={totalStudents} groupId={groupId} isActiveSection={false} />
            ))}
          </div>
        </section>
      )}

      {assignments.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-16 text-surface-400">
          <BookOpen size={22} />
          <p className="text-[13px] font-medium">Bu gruba ait ödev yok</p>
        </div>
      )}
    </div>
  );
}

function TaskAccordion({ assignment, submissions, totalStudents, groupId, isActiveSection }: {
  assignment: AssignmentItem; submissions: SubmissionRow[]; totalStudents: number; groupId: string; isActiveSection: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const teslimEdenler = submissions.filter((s) => s.status !== "revision" && s.status !== "retracted").length;
  const revize = submissions.filter((s) => s.status === "revision").length;
  const bekleyenler = Math.max(0, totalStudents - submissions.filter((s) => s.status !== "retracted").length);

  return (
    <div className="bg-white border border-surface-200 rounded-2xl overflow-hidden">
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
              {assignment.attachments.length > 0 ? (
                <div className="flex items-center flex-wrap gap-2">
                  {assignment.attachments.map((a, i) => (
                    <a
                      key={i}
                      href={a.webViewLink}
                      target="_blank" rel="noopener noreferrer"
                      style={{ height: 44 }}
                      className="flex items-center gap-2 bg-white border border-surface-200 rounded-xl px-3 max-w-[240px]"
                    >
                      <FileText size={13} className="text-surface-400 shrink-0" />
                      <span className="text-[12px] font-semibold text-text-primary truncate">{a.fileName}</span>
                      <ExternalLink size={12} className="text-surface-300 shrink-0 ml-auto" />
                    </a>
                  ))}
                </div>
              ) : <div />}

              <button
                onClick={() => router.push(`/flexos/odevler/teslim/${groupId}/${assignment.id}`)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[14px] font-semibold text-white cursor-pointer transition-colors"
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
