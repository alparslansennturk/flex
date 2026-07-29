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
 *
 * DÜZENLEME (2026-07-29, teknik borç madde 19): dosya 830 satırdı, tek bileşende
 * hem veri çekme (bu dosya) hem sunum (AssignmentsTab/ArchivedAssignmentCard/
 * TaskAccordion) karışıktı. Sunum tarafı `_shared/`'a çıkarıldı — bu dosyada artık
 * SADECE veri çekme + sayfa iskeleti + Öğrenciler tab'ı kalıyor.
 */

import { useState, useCallback, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, Loader2, BookOpen, ClipboardList, Search, Users,
} from "lucide-react";
import FlexSidebar from "../../../_components/FlexSidebar";
import FlexHeader from "../../../_components/FlexHeader";
import Footer from "@/app/components/layout/Footer";
import type { RosterItem } from "../../../siniflar/_shared/groupDisplay";
import EditAssignmentModal, { type EditableAssignment } from "../../_shared/EditAssignmentModal";
import { authHeaders } from "@/app/lib/client/auth-headers";
import type { AssignmentItem, SubmissionRow } from "./_shared/types";
import { AssignmentsTab } from "./_shared/AssignmentsTab";

type MainTab = "students" | "assignments";

interface GroupInfo {
  code: string;
  branch: string;
  educationName: string;
  trainerName: string;
  enrolled: number;
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
              onStatusChanged={(assignmentId, status) => setAssignments((prev) => prev.map((a) => (a.id === assignmentId ? { ...a, status } : a)))}
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
