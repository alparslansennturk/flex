"use client";

/**
 * FlexOS · Ödev Teslimi — canlıdaki `src/app/dashboard/assignment/page.tsx` portu.
 * Grup kartları (GroupCard, birebir) + filtre tabları (Aktif Sınıflar/Arşiv/Tüm Sınıflar).
 * Kartta "session" alanı FlexOS'ta yok — yerine eğitim adı (educationName) gösterilir.
 * Tıklanınca grubun ödev listesine gider (sıradaki adım, henüz yok).
 */

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClipboardList, Loader2, Plus } from "lucide-react";
import { auth } from "@/app/lib/firebase";
import FlexSidebar from "../../_components/FlexSidebar";
import FlexHeader from "../../_components/FlexHeader";
import Footer from "@/app/components/layout/Footer";
import GroupCard from "../_components/GroupCard";
import type { GroupApiItem } from "../../siniflar/_shared/groupDisplay";
import { mapStatus } from "../../siniflar/_shared/groupDisplay";

interface AssignmentItem {
  id: string;
  groupId: string;
  status: string;
}

async function authHeaders(): Promise<Record<string, string>> {
  const u = auth.currentUser;
  const token = u ? await u.getIdToken() : "";
  return { Authorization: `Bearer ${token}` };
}

export default function OdevTeslimiPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<GroupApiItem[]>([]);
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({});
  const [submissionCounts, setSubmissionCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"active" | "archived" | "all">("active");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await authHeaders();

      const groupsRes = await fetch("/api/flexos/groups", { headers });
      const groupsJson = groupsRes.ok ? await groupsRes.json() as { items: GroupApiItem[] } : { items: [] };
      setGroups(groupsJson.items);

      const assignRes = await fetch("/api/flexos/assignments", { headers });
      const assignJson = assignRes.ok ? await assignRes.json() as { items: AssignmentItem[] } : { items: [] };
      const taskMap: Record<string, number> = {};
      for (const a of assignJson.items) {
        if (a.status !== "published") continue;
        taskMap[a.groupId] = (taskMap[a.groupId] ?? 0) + 1;
      }
      setTaskCounts(taskMap);

      const subCounts = await Promise.all(
        groupsJson.items.map(async (g) => {
          const res = await fetch(`/api/flexos/submissions?groupId=${g.id}`, { headers });
          const json = res.ok ? await res.json() as { items: unknown[] } : { items: [] };
          return [g.id, json.items.length] as const;
        }),
      );
      setSubmissionCounts(Object.fromEntries(subCounts));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleArchive(id: string, archive: boolean) {
    const headers = await authHeaders();
    const res = await fetch(`/api/flexos/groups/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ status: archive ? "archived" : "active" }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({})) as { error?: string };
      toast.error(json.error ?? "İşlem başarısız.");
      return;
    }
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, status: archive ? "archived" : "active" } : g)));
    toast.success(archive ? "Grup arşive alındı." : "Grup aktife alındı.");
  }

  // Ham `g.status` yerine `mapStatus` (GroupTable.tsx: CORE_ACTIVE_STATUSES/CORE_ARCHIVE_STATUSES
  // ile AYNI kural) — "active" olup `schedule.endDate`'i geçmiş veya domain'de "completed" olan
  // gruplar da (manuel arşivlenmemiş olsalar bile) "tamamlandı" sayılır, Aktif Sınıflar'da kalmaz.
  const filtered = groups.filter((g) => {
    const eff = mapStatus(g.status, g.schedule?.endDate);
    if (filter === "active") return eff === "açılacak" || eff === "aktif";
    if (filter === "archived") return eff === "tamamlandı" || eff === "iptal";
    return true;
  });

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

        <div style={{ padding: "30px 36px 72px", maxWidth: 1920, margin: "0 auto", width: "100%", boxSizing: "border-box", flex: 1 }}>
          <div className="mb-8 flex items-center bg-surface-50 w-fit p-1 rounded-xl border border-neutral-100 shadow-sm">
            {([
              { key: "active", label: "Aktif Sınıflar" },
              { key: "archived", label: "Arşiv" },
              { key: "all", label: "Tüm Sınıflar" },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-5 py-1.5 rounded-[10px] text-[13px] font-semibold transition-all cursor-pointer outline-none select-none ${
                  filter === tab.key
                    ? "bg-white text-base-primary-900 shadow-sm border border-neutral-100"
                    : "text-neutral-400 hover:text-neutral-600 border border-transparent"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24 text-surface-400">
              <Loader2 size={22} className="animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 border border-dashed border-surface-200 rounded-2xl">
              <div className="w-14 h-14 rounded-2xl bg-surface-50 border border-surface-100 flex items-center justify-center">
                <ClipboardList size={24} className="text-surface-300" />
              </div>
              <p className="text-[15px] font-bold text-surface-500">
                {filter === "archived" ? "Arşivde grup yok" : "Henüz aktif grup yok"}
              </p>
              <p className="text-[13px] text-surface-400">Önce Sınıflar&apos;dan bir grup oluşturun.</p>
            </div>
          ) : (
            <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fill, 330px)" }}>
              {filtered.map((g) => (
                <GroupCard
                  key={g.id}
                  id={g.id}
                  code={g.code}
                  session={g.educationName || g.sectionName || "-"}
                  branch={g.branch}
                  instructor={g.trainerName}
                  studentCount={g.enrolled}
                  activeTaskCount={taskCounts[g.id] ?? 0}
                  submissionCount={submissionCounts[g.id] ?? 0}
                  status={g.status}
                  onClick={() => router.push(`/flexos/odevler/teslim/${g.id}`)}
                  onArchive={handleArchive}
                />
              ))}
            </div>
          )}
        </div>

        <Footer mini containerClassName="w-full max-w-[1920px] mx-auto px-9" />
      </main>

      <button
        onClick={() => toast.info("Ödev Yönetimi sayfası yakında.")}
        title="Yeni Ödev"
        className="fixed bottom-8 right-8 w-14 h-14 rounded-full bg-base-primary-600 text-white shadow-lg shadow-base-primary-600/30
          hover:bg-base-primary-700 hover:shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all cursor-pointer
          flex items-center justify-center z-40"
      >
        <Plus size={22} />
      </button>
    </div>
  );
}
