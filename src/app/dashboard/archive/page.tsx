"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, where, orderBy, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useUser } from "@/app/context/UserContext";
import Sidebar from "@/app/components/layout/Sidebar";
import Header from "@/app/components/layout/Header";
import { Archive, ChevronDown, ChevronRight, Users, Trash2 } from "lucide-react";

interface DrawResult { category: string; item: { name: string; emoji?: string } }
interface StudentDraw { studentId: string; draws: DrawResult[] }
interface Student { id: string; name: string; lastName: string }
interface ArchiveEntry {
  id: string;
  groupId: string;
  groupName: string;
  taskId: string;
  taskName: string;
  type: string;
  completedAt: { seconds: number };
  draws: StudentDraw[];
  students: Student[];
}
interface Group { id: string; code: string; branch?: string; session?: string; status?: string }

export default function ArchivePage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [entries, setEntries] = useState<ArchiveEntry[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  // Grupları yükle
  useEffect(() => {
    if (!user) return;
    getDocs(collection(db, "groups")).then(snap => {
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Group))
        .filter(g => g.status === "active");
      setGroups(list);
      if (list.length > 0) setSelectedGroupId(list[0].id);
    });
  }, [user]);

  // Seçili grubun arşivini yükle
  useEffect(() => {
    if (!selectedGroupId) return;
    setLoadingEntries(true);
    setEntries([]);
    setExpandedId(null);
    const q = query(
      collection(db, "assignment_archive"),
      where("groupId", "==", selectedGroupId),
      orderBy("completedAt", "desc")
    );
    getDocs(q).then(snap => {
      setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() } as ArchiveEntry)));
      setLoadingEntries(false);
    });
  }, [selectedGroupId]);

  const handleDelete = async (entryId: string) => {
    if (!confirm("Bu arşiv kaydını silmek istediğinize emin misiniz?")) return;
    setDeletingId(entryId);
    try {
      await deleteDoc(doc(db, "assignment_archive", entryId));
      setEntries(prev => prev.filter(e => e.id !== entryId));
    } finally { setDeletingId(null); }
  };

  if (loading || !user) return null;

  const selectedGroup = groups.find(g => g.id === selectedGroupId);
  const categories = entries[0]?.draws[0]?.draws.map(d => d.category) ?? [];

  return (
    <div className="flex h-screen overflow-hidden bg-[#F9FAFB] font-inter antialiased text-text-primary">
      <aside className="hidden lg:block h-full shrink-0 z-50 w-[280px] 2xl:w-[320px] bg-[#10294C]">
        <Sidebar />
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-full">
        <Header />

        <div className="flex-1 flex overflow-hidden">

          {/* Sol: Grup listesi */}
          <div className="w-64 shrink-0 bg-white border-r border-surface-200 flex flex-col">
            <div className="px-5 py-5 border-b border-surface-200">
              <p className="text-[13px] font-bold text-slate-400 uppercase tracking-widest">Gruplar</p>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              {groups.length === 0 && (
                <p className="text-[13px] text-slate-400 text-center mt-8">Grup bulunamadı</p>
              )}
              {groups.map(g => (
                <button
                  key={g.id}
                  onClick={() => setSelectedGroupId(g.id)}
                  className={`w-full text-left flex items-center gap-3 px-5 py-3 transition-colors cursor-pointer ${
                    selectedGroupId === g.id
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Users size={15} className="shrink-0" />
                  <span className="text-[14px] font-semibold truncate">{g.code || g.id}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sağ: Arşiv içeriği */}
          <div className="flex-1 overflow-y-auto p-8">

            {/* Başlık */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <Archive size={18} className="text-blue-600" />
              </div>
              <div>
                <h2 className="text-[18px] font-bold text-slate-800">Ödev Arşivi</h2>
                <p className="text-[13px] text-slate-400">{selectedGroup?.code || "—"}</p>
              </div>
            </div>

            {loadingEntries && (
              <div className="flex items-center justify-center py-20">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {!loadingEntries && entries.length === 0 && (
              <div className="text-center py-20 text-slate-400">
                <Archive size={40} className="mx-auto mb-4 opacity-30" />
                <p className="text-[15px] font-semibold">Bu gruba ait arşiv kaydı yok</p>
                <p className="text-[13px] mt-1">Çekiliş tamamlandığında buraya kaydedilecek</p>
              </div>
            )}

            <div className="space-y-3">
              {entries.map(entry => {
                const isExpanded = expandedId === entry.id;
                const date = entry.completedAt
                  ? new Date(entry.completedAt.seconds * 1000).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })
                  : "—";
                const cats = entry.draws[0]?.draws.map(d => d.category) ?? [];

                return (
                  <div key={entry.id} className="bg-white border border-surface-200 rounded-2xl overflow-hidden">
                    {/* Oturum başlık */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                      onKeyDown={e => e.key === "Enter" && setExpandedId(isExpanded ? null : entry.id)}
                      className="w-full flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                          <Archive size={16} className="text-blue-500" />
                        </div>
                        <div className="text-left">
                          <p className="text-[15px] font-bold text-slate-800">{entry.taskName}</p>
                          <p className="text-[12px] text-slate-400">{date} · {entry.students.length} katılımcı</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={e => { e.stopPropagation(); handleDelete(entry.id); }}
                          disabled={deletingId === entry.id}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-40"
                        >
                          {deletingId === entry.id
                            ? <span className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" />
                            : <Trash2 size={14} />}
                        </button>
                        {isExpanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                      </div>
                    </div>

                    {/* Tablo */}
                    {isExpanded && (
                      <div className="border-t border-surface-200 overflow-x-auto">
                        <table className="w-full text-[13px]">
                          <thead>
                            <tr className="bg-slate-50">
                              <th className="text-left px-6 py-3 font-semibold text-slate-500">Öğrenci</th>
                              {cats.map(cat => (
                                <th key={cat} className="text-left px-4 py-3 font-semibold text-slate-500">{cat}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {entry.students.map((student, i) => {
                              const draw = entry.draws.find(d => d.studentId === student.id);
                              return (
                                <tr key={student.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                                  <td className="px-6 py-3 font-semibold text-slate-700">
                                    {student.name} {student.lastName}
                                  </td>
                                  {cats.map(cat => {
                                    const item = draw?.draws.find(d => d.category === cat);
                                    return (
                                      <td key={cat} className="px-4 py-3 text-slate-600">
                                        {item ? `${item.item.emoji ?? ""} ${item.item.name}` : <span className="text-slate-300">—</span>}
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
