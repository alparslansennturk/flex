"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/app/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
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
      // Grupları çek
      const groupSnap = await getDocs(
        query(collection(db, "groups"), where("status", "!=", "archived"))
      );
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
        getDocs(collection(db, "tasks")),
        getDocs(collection(db, "submissions")),
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

            {/* İçerik */}
            {loading ? (
              <div className="flex items-center justify-center py-24 text-surface-400">
                <Loader2 size={22} className="animate-spin" />
              </div>
            ) : groups.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-20 border border-dashed border-surface-200 rounded-2xl">
                <div className="w-14 h-14 rounded-2xl bg-surface-50 border border-surface-100 flex items-center justify-center">
                  <ClipboardList size={24} className="text-surface-300" />
                </div>
                <p className="text-[15px] font-bold text-surface-500">Henüz aktif grup yok</p>
                <p className="text-[13px] text-surface-400">Önce Sınıf Yönetimi'nden bir grup oluşturun.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {groups.map(g => (
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
                    onClick={() => router.push(`/dashboard/assignment-test/${g.id}`)}
                  />
                ))}
              </div>
            )}
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
