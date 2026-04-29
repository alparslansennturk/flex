"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/app/lib/firebase";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { useUser } from "@/app/context/UserContext";
import Sidebar from "@/app/components/layout/Sidebar";
import Header from "@/app/components/layout/Header";
import GroupCard from "@/app/components/assignment-test/GroupCard";
import { ClipboardList, Loader2, Plus } from "lucide-react";

interface GroupData {
  id: string;
  code: string;
  session: string;
  branch: string;
  instructor: string;
  students: number;
  status: string;
}

interface GroupStats {
  activeTaskCount: number;
  submissionCount: number;
}

export default function AssignmentTestPage() {
  const { user, loading: authLoading } = useUser();
  const router = useRouter();
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [stats, setStats] = useState<Record<string, GroupStats>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"active" | "archived" | "all">("active");

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  async function loadData() {
    setLoading(true);
    try {
      // Grupları çek (tüm durumlar — client-side filtreleme)
      const groupSnap = await getDocs(collection(db, "groups"));
      const groupList: GroupData[] = groupSnap.docs.map(d => ({
        id: d.id,
        code: d.data().code ?? "",
        session: d.data().session ?? "",
        branch: d.data().branch ?? "",
        instructor: d.data().instructor ?? "",
        students: d.data().students ?? 0,
        status: d.data().status ?? "active",
      }));
      setGroups(groupList);

      // Her grup için task ve submission sayıları
      const [taskSnap, subSnap] = await Promise.all([
        getDocs(collection(db, "tasks")).catch(() => ({ docs: [] })),
        getDocs(collection(db, "submissions")).catch(() => ({ docs: [] })),
      ]);

      const statsMap: Record<string, GroupStats> = {};
      groupList.forEach(g => {
        const activeTaskCount = taskSnap.docs.filter(
          d => d.data().groupId === g.id && d.data().isActive
        ).length;
        const submissionCount = subSnap.docs.filter(
          d => d.data().groupId === g.id
        ).length;
        statsMap[g.id] = { activeTaskCount, submissionCount };
      });
      setStats(statsMap);
    } finally {
      setLoading(false);
    }
  }

  async function handleArchive(id: string, archive: boolean) {
    await updateDoc(doc(db, "groups", id), { status: archive ? "archived" : "active" });
    setGroups(prev => prev.map(g => g.id === id ? { ...g, status: archive ? "archived" : "active" } : g));
  }

  if (authLoading || !user) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-[#F9FAFB] font-inter antialiased text-text-primary">
      <aside className="hidden lg:block h-full shrink-0 z-50 w-[280px] 2xl:w-[320px] bg-[#10294C]">
        <Sidebar />
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-full">
        <Header />

        <main className="flex-1 overflow-y-auto overflow-x-clip [scrollbar-gutter:stable]">
          <div className="w-[94%] mx-auto pt-6 pb-10 max-w-[1280px] xl:max-w-[1600px]">

            {/* Hero */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 rounded-xl bg-base-primary-100 flex items-center justify-center">
                  <ClipboardList size={18} className="text-base-primary-600" />
                </div>
                <h1 className="text-[22px] font-bold text-base-primary-900">Ödev Test</h1>
              </div>
              <p className="text-[14px] text-surface-500 ml-12">
                Grup bazında ödev takibi, teslim yönetimi ve değerlendirme
              </p>
            </div>

            {/* Context Bar */}
            <div className="mb-8 flex items-center bg-surface-50 w-fit p-1 rounded-xl border border-neutral-100 shadow-sm">
              {([
                { key: "active",   label: "Aktif Sınıflar" },
                { key: "archived", label: "Arşiv" },
                { key: "all",      label: "Tüm Sınıflar" },
              ] as const).map(tab => (
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

            {/* İçerik */}
            {loading ? (
              <div className="flex items-center justify-center py-24 text-surface-400">
                <Loader2 size={22} className="animate-spin" />
              </div>
            ) : (() => {
              const filtered = groups.filter(g =>
                filter === "active" ? g.status !== "archived" :
                filter === "archived" ? g.status === "archived" : true
              );
              return filtered.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-20 border border-dashed border-surface-200 rounded-2xl">
                  <div className="w-14 h-14 rounded-2xl bg-surface-50 border border-surface-100 flex items-center justify-center">
                    <ClipboardList size={24} className="text-surface-300" />
                  </div>
                  <p className="text-[15px] font-bold text-surface-500">
                    {filter === "archived" ? "Arşivde grup yok" : "Henüz aktif grup yok"}
                  </p>
                  <p className="text-[13px] text-surface-400">Önce Sınıf Yönetimi'nden bir grup oluşturun.</p>
                </div>
              ) : (
                <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fill, 330px)" }}>
                  {filtered.map(g => (
                    <GroupCard
                      key={g.id}
                      id={g.id}
                      code={g.code}
                      session={g.session}
                      branch={g.branch}
                      instructor={g.instructor}
                      studentCount={g.students}
                      activeTaskCount={stats[g.id]?.activeTaskCount ?? 0}
                      submissionCount={stats[g.id]?.submissionCount ?? 0}
                      status={g.status}
                      onClick={() => router.push(`/dashboard/assignment-test/${g.id}`)}
                      onArchive={handleArchive}
                    />
                  ))}
                </div>
              );
            })()}
          </div>
        </main>
      </div>

      {/* FAB */}
      <button
        onClick={() => router.push("/dashboard/tasks")}
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
