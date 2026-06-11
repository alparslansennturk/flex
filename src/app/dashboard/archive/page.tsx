"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, where, orderBy, deleteDoc, doc, getDoc } from "firebase/firestore";
import { db, auth } from "@/app/lib/firebase";
import { useUser } from "@/app/context/UserContext";
import Sidebar from "@/app/components/layout/Sidebar";
import Header from "@/app/components/layout/Header";
import { Archive, ChevronDown, Users, Trash2, BookOpen, Layers, Smartphone, Download, ExternalLink } from "lucide-react";

// ─── Tipler ───────────────────────────────────────────────────────────────────

interface DrawResult { category: string; item: { name: string; emoji?: string } }
interface StudentDraw { studentId: string; draws: DrawResult[] }
interface Student { id: string; name: string; lastName: string }
interface KitapDriveFile { url: string; fileName: string }
interface ArchiveEntry {
  id: string;
  allIds: string[];
  groupId: string;
  groupName: string;
  taskId: string;
  taskName: string;
  type: string;
  completedAt: { seconds: number };
  draws: StudentDraw[];
  students: Student[];
  attachmentUrl?: string;
  attachmentName?: string;
  kitapDriveFiles?: Record<string, KitapDriveFile>;
  kolajDriveFiles?: Record<string, KitapDriveFile>;
  sosyalDriveFiles?: Record<string, KitapDriveFile>;
}
interface Group { id: string; code: string; branch?: string; session?: string; status?: string }

// ─── Ödev tipi ikonu ─────────────────────────────────────────────────────────

function TaskTypeIcon({ type }: { type: string }) {
  if (type === "kolaj") return <Layers size={15} className="text-blue-500" />;
  if (type === "kitap") return <BookOpen size={15} className="text-emerald-500" />;
  if (type === "sosyal-medya") return <Smartphone size={15} className="text-purple-500" />;
  return <Archive size={15} className="text-slate-400" />;
}

// ─── Tek ödev accordion ───────────────────────────────────────────────────────

function AssignmentAccordion({
  entry,
  onDelete,
  deletingId,
}: {
  entry: ArchiveEntry;
  onDelete: (entry: ArchiveEntry) => void;
  deletingId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const date = entry.completedAt
    ? new Date(entry.completedAt.seconds * 1000).toLocaleDateString("tr-TR", {
        day: "numeric", month: "long", year: "numeric",
      })
    : "—";

  const cats = entry.draws[0]?.draws.map(d => d.category) ?? [];

  return (
    <div className="border-b border-surface-100 last:border-0">
      {/* Başlık */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => e.key === "Enter" && setOpen(o => !o)}
        className="flex items-center gap-4 px-6 py-4 cursor-pointer hover:bg-slate-50/80 transition-colors"
      >
        <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
          <TaskTypeIcon type={entry.type} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold text-slate-800 truncate">{entry.taskName}</p>
          <p className="text-[12px] text-slate-400 mt-0.5">{date} · {entry.students.length} katılımcı</p>
        </div>

        <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
          {/* Detay butonu — her zaman */}
          <button
            onClick={() => router.push(`/dashboard/assignment/${entry.groupId}?taskId=${entry.taskId}`)}
            className="flex items-center gap-1.5 px-3 h-7 rounded-lg text-[12px] font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <ExternalLink size={12} />
            Detay
          </button>

          {/* İndir butonu — sadece dosya varsa */}
          {entry.attachmentUrl && (
            <a
              href={entry.attachmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={entry.attachmentName ?? "Dosyayı İndir"}
              className="flex items-center gap-1.5 px-3 h-7 rounded-lg text-[12px] font-semibold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
            >
              <Download size={12} />
              İndir
            </a>
          )}

          <button
            onClick={e => { e.stopPropagation(); onDelete(entry); }}
            disabled={deletingId === entry.taskId}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-40"
          >
            {deletingId === entry.taskId
              ? <span className="w-3 h-3 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" />
              : <Trash2 size={13} />}
          </button>
          <ChevronDown
            size={15}
            className={`text-slate-400 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
          />
        </div>
      </div>

      {/* Tablo — smooth accordion */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: open ? "1200px" : "0px", opacity: open ? 1 : 0 }}
      >
        <div className="border-t border-surface-100 overflow-x-auto pb-4">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left pl-8 pr-3 py-2.5 font-semibold text-slate-500">Öğrenci</th>
                {cats.map(cat => (
                  <th key={cat} className="text-left px-3 py-2.5 font-semibold text-slate-500 whitespace-nowrap">{cat}</th>
                ))}
                {["kitap", "kolaj", "sosyal-medya"].includes(entry.type) && (
                  <th className="text-right pl-3 pr-8 py-2.5 font-semibold text-slate-500 whitespace-nowrap">PDF</th>
                )}
              </tr>
            </thead>
            <tbody>
              {entry.students.map((student, i) => {
                const draw = entry.draws.find(d => d.studentId === student.id);
                const kitapFile  = entry.kitapDriveFiles?.[student.id];
                const kolajFile  = entry.kolajDriveFiles?.[student.id];
                const sosyalFile = entry.sosyalDriveFiles?.[student.id];
                const driveFile  = kitapFile ?? kolajFile ?? sosyalFile;
                return (
                  <tr key={student.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                    <td className="pl-8 pr-3 py-2 font-semibold text-slate-700 whitespace-nowrap">
                      {student.name} {student.lastName}
                    </td>
                    {cats.map(cat => {
                      const item = draw?.draws.find(d => d.category === cat);
                      return (
                        <td key={cat} className="px-3 py-2 text-slate-600 whitespace-nowrap">
                          {item
                            ? `${item.item.emoji ?? ""} ${item.item.name}`
                            : <span className="text-slate-300">—</span>}
                        </td>
                      );
                    })}
                    {["kitap", "kolaj", "sosyal-medya"].includes(entry.type) && (
                      <td className="pl-3 pr-8 py-2 text-right">
                        {driveFile ? (
                          <a
                            href={driveFile.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={driveFile.fileName}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors whitespace-nowrap"
                          >
                            <Download size={10} />
                            İndir
                          </a>
                        ) : (
                          <span className="text-slate-300 text-[11px]">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Grup accordion ───────────────────────────────────────────────────────────

function GroupAccordion({ group }: { group: Group }) {
  const [open,       setOpen]       = useState(false);
  const [entries,    setEntries]    = useState<ArchiveEntry[]>([]);
  const [loadState,  setLoadState]  = useState<"idle" | "loading" | "done">("idle");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (loadState !== "idle") return;
    setLoadState("loading");
    const q = query(
      collection(db, "assignment_archive"),
      where("groupId", "==", group.id),
      orderBy("completedAt", "desc")
    );
    const snap = await getDocs(q);
    const raw = snap.docs.map(d => ({ id: d.id, allIds: [d.id], ...d.data() } as ArchiveEntry));

    // Aynı taskId'ye ait session'ları birleştir
    const mergedMap = new Map<string, ArchiveEntry>();
    for (const entry of raw) {
      const existing = mergedMap.get(entry.taskId);
      if (existing) {
        existing.allIds.push(entry.id);
        const seenStudents = new Set(existing.students.map(s => s.id));
        for (const s of entry.students) {
          if (!seenStudents.has(s.id)) { existing.students.push(s); seenStudents.add(s.id); }
        }
        const seenDraws = new Set(existing.draws.map(d => d.studentId));
        for (const d of entry.draws) {
          if (!seenDraws.has(d.studentId)) { existing.draws.push(d); seenDraws.add(d.studentId); }
        }
      } else {
        mergedMap.set(entry.taskId, { ...entry, students: [...entry.students], draws: [...entry.draws] });
      }
    }

    const merged = Array.from(mergedMap.values());

    // Task dokümanlarından attachmentUrl + kitapDriveFiles çek (parallel)
    await Promise.all(
      merged.map(async entry => {
        try {
          const taskSnap = await getDoc(doc(db, "tasks", entry.taskId));
          if (taskSnap.exists()) {
            const data = taskSnap.data();
            if (data.attachmentUrl)     entry.attachmentUrl = data.attachmentUrl;
            if (data.attachmentName)    entry.attachmentName = data.attachmentName;
            if (data.kitapDriveFiles)   entry.kitapDriveFiles = data.kitapDriveFiles;
            if (data.kolajDriveFiles)   entry.kolajDriveFiles = data.kolajDriveFiles;
            if (data.sosyalDriveFiles)  entry.sosyalDriveFiles = data.sosyalDriveFiles;
          }
        } catch { /* non-fatal */ }
      })
    );

    setEntries(merged);
    setLoadState("done");
  }, [group.id, loadState]);

  const toggle = () => {
    if (!open) load();
    setOpen(o => !o);
  };

  const handleDelete = async (entry: ArchiveEntry) => {
    if (!confirm("Bu ödev ve tüm ilişkili verileri (arşiv, Drive dosyaları, teslimler) kalıcı olarak silinecek. Emin misiniz?")) return;
    setDeletingId(entry.taskId);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/tasks/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ taskId: entry.taskId }),
      });
      if (!res.ok) throw new Error("Silme başarısız");
      setEntries(prev => prev.filter(e => e.taskId !== entry.taskId));
    } catch {
      alert("Silme sırasında hata oluştu.");
    } finally {
      setDeletingId(null);
    }
  };

  const label = group.code || group.id;
  const subtitle = [group.branch, group.session].filter(Boolean).join(" · ");

  return (
    <div className="bg-white border border-surface-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Grup başlığı */}
      <button
        onClick={toggle}
        className="w-full flex items-center gap-4 px-6 py-5 cursor-pointer hover:bg-slate-50 transition-colors"
      >
        <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
          <Users size={18} className="text-blue-500" />
        </div>

        <div className="flex-1 text-left min-w-0">
          <p className="text-[16px] font-bold text-slate-800">{label}</p>
          {subtitle && <p className="text-[12px] text-slate-400 mt-0.5">{subtitle}</p>}
        </div>

        {loadState === "done" && (
          <span className="text-[12px] font-bold text-slate-400 tabular-nums shrink-0">
            {entries.length} ödev
          </span>
        )}

        <ChevronDown
          size={18}
          className={`text-slate-400 shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* İçerik */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: open ? "4000px" : "0px", opacity: open ? 1 : 0 }}
      >
        <div className="border-t border-surface-100">
          {loadState === "loading" && (
            <div className="flex items-center justify-center py-10">
              <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
            </div>
          )}

          {loadState === "done" && entries.length === 0 && (
            <div className="py-10 text-center text-slate-400">
              <Archive size={28} className="mx-auto mb-3 opacity-30" />
              <p className="text-[13px] font-semibold">Bu gruba ait arşiv kaydı yok</p>
            </div>
          )}

          {loadState === "done" && entries.map(entry => (
            <AssignmentAccordion
              key={entry.taskId}
              entry={entry}
              onDelete={handleDelete}
              deletingId={deletingId}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Ana sayfa ────────────────────────────────────────────────────────────────

export default function ArchivePage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    getDocs(collection(db, "groups")).then(snap => {
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Group))
        .filter(g => g.status === "active")
        .sort((a, b) => (a.code || "").localeCompare(b.code || ""));
      setGroups(list);
      setLoadingGroups(false);
    });
  }, [user]);

  if (loading || !user) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-[#F9FAFB] font-inter antialiased text-text-primary">
      <aside className="hidden lg:block h-full shrink-0 z-50 w-[280px] 2xl:w-[320px] bg-[#10294C]">
        <Sidebar />
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-full">
        <Header />

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-8 py-8">

            {/* Başlık */}
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <Archive size={18} className="text-blue-600" />
              </div>
              <div>
                <h2 className="text-[20px] font-bold text-slate-800">Ödev Arşivi</h2>
                <p className="text-[13px] text-slate-400">Tamamlanan çekilişler gruplara göre listelenir</p>
              </div>
            </div>

            {/* Grup accordion'ları */}
            {loadingGroups ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
              </div>
            ) : groups.length === 0 ? (
              <div className="text-center py-20 text-slate-400">
                <Users size={40} className="mx-auto mb-4 opacity-30" />
                <p className="text-[15px] font-semibold">Aktif grup bulunamadı</p>
              </div>
            ) : (
              <div className="space-y-3">
                {groups.map(g => (
                  <GroupAccordion key={g.id} group={g} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
