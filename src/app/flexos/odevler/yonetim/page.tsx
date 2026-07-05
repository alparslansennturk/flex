"use client";

/**
 * FlexOS · Ödev Yönetimi — grup kartları (Ödev Teslimi ile aynı `GroupCard`, aynı
 * grup istatistikleri), tıklanınca o grubun ödev CRUD ekranına gider. Canlıdaki
 * `TaskManagementPanel.tsx` (1095 satır, iki bağımsız ödev-oluşturma yolundan biri)
 * BİREBİR portlanmadı — kullanıcı kararı: "sonradan revize edeceğiz zaten, şimdilik
 * yap" → FlexOS'un TEK canonical `assignTask`/`updateAssignment` servisine bağlı
 * sade bir CRUD ekranı kuruldu, legacy panelin dağınık yapısı taşınmadı.
 */

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClipboardList, Loader2 } from "lucide-react";
import { auth } from "@/app/lib/firebase";
import FlexSidebar from "../../_components/FlexSidebar";
import FlexHeader from "../../_components/FlexHeader";
import Footer from "@/app/components/layout/Footer";
import GroupCard from "../_components/GroupCard";
import type { GroupApiItem } from "../../siniflar/_shared/groupDisplay";

interface AssignmentItem { id: string; groupId: string; status: string }

async function authHeaders(): Promise<Record<string, string>> {
  const u = auth.currentUser;
  const token = u ? await u.getIdToken() : "";
  return { Authorization: `Bearer ${token}` };
}

export default function OdevYonetimiPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<GroupApiItem[]>([]);
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({});
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
      for (const a of assignJson.items) taskMap[a.groupId] = (taskMap[a.groupId] ?? 0) + 1;
      setTaskCounts(taskMap);
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
    if (!res.ok) { toast.error("İşlem başarısız."); return; }
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, status: archive ? "archived" : "active" } : g)));
  }

  const filtered = groups.filter((g) =>
    filter === "active" ? g.status !== "archived" :
    filter === "archived" ? g.status === "archived" : true,
  );

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh", overflow: "hidden", background: "#EEF0F3" }}>
      <FlexSidebar active="odev-yonetimi" />
      <main style={{ flex: 1, height: "100%", overflowY: "auto", background: "#EEF0F3", display: "flex", flexDirection: "column" }}>
        <FlexHeader
          icon={<ClipboardList size={20} color="#fff" />}
          title="Ödev Yönetimi"
          subtitle="Grup bazında ödev oluştur, düzenle ve yayınla"
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
              <ClipboardList size={24} className="text-surface-300" />
              <p className="text-[15px] font-bold text-surface-500">{filter === "archived" ? "Arşivde grup yok" : "Henüz aktif grup yok"}</p>
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
                  submissionCount={0}
                  status={g.status}
                  onClick={() => router.push(`/flexos/odevler/yonetim/${g.id}`)}
                  onArchive={handleArchive}
                />
              ))}
            </div>
          )}
        </div>

        <Footer mini containerClassName="w-full max-w-[1920px] mx-auto px-9" />
      </main>
    </div>
  );
}
