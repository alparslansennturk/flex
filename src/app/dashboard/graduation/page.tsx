"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  GraduationCap,
  Search,
  RotateCcw,
  ChevronDown,
} from "lucide-react";
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
  serverTimestamp,
  deleteField,
  increment,
} from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useUser } from "@/app/context/UserContext";
import { ROLES } from "@/app/lib/constants";
import Sidebar from "../../components/layout/Sidebar";
import Header from "../../components/layout/Header";
import Footer from "../../components/layout/Footer";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Student {
  id: string;
  name: string;
  lastName: string;
  email?: string;
  gender?: string;
  avatarId?: number | string;
  groupId: string;
  groupCode: string;
  branch?: string;
  status: "active" | "passive";
  graduatedBy?: string;
  graduatedAt?: { toDate: () => Date } | null;
  lastGroupCode?: string;
  lastGroupId?: string;
}

interface Instructor {
  id: string;
  displayName: string;
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({
  gender,
  avatarId,
  size = 36,
}: {
  gender?: string;
  avatarId?: number | string;
  size?: number;
}) {
  const g = gender === "female" ? "female" : "male";
  const n = Number(avatarId);
  const id = n > 0 ? n : 1;
  return (
    <div
      className="rounded-full border border-surface-200 overflow-hidden bg-surface-50 shrink-0"
      style={{ width: size, height: size }}
    >
      <img
        src={`/avatars/${g}/${id}.svg`}
        alt=""
        className="w-full h-full object-cover"
        onError={(e) => {
          (e.target as HTMLImageElement).src = "/avatars/male/1.svg";
        }}
      />
    </div>
  );
}

// ─── Student Row ──────────────────────────────────────────────────────────────

function StudentRow({
  student,
  isGraduate,
  canGraduate,
  canUndo,
  onGraduate,
  onUndo,
}: {
  student: Student;
  isGraduate: boolean;
  canGraduate: boolean;
  canUndo: boolean;
  onGraduate: (s: Student) => void;
  onUndo: (s: Student) => void;
}) {
  const graduatedDate =
    student.graduatedAt?.toDate
      ? new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(
          student.graduatedAt.toDate()
        )
      : null;

  const displayGroup = isGraduate
    ? student.lastGroupCode || student.groupCode
    : student.groupCode;

  return (
    <tr className="border-b border-surface-50 last:border-0 hover:bg-surface-50 transition-colors group">
      {/* Öğrenci */}
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <Avatar gender={student.gender} avatarId={student.avatarId} size={36} />
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-text-primary leading-none truncate">
              {student.name} {student.lastName}
            </p>
            <p className="text-[11px] text-text-tertiary mt-0.5 truncate">
              {student.email || "—"}
            </p>
          </div>
        </div>
      </td>

      {/* Şube */}
      <td className="px-6 py-4 hidden md:table-cell">
        <span className="text-[12px] text-text-secondary">{student.branch || "—"}</span>
      </td>

      {/* Grup */}
      <td className="px-6 py-4">
        <span className="text-[12px] font-medium text-text-secondary">{displayGroup}</span>
      </td>

      {/* Mezuniyet Tarihi (sadece mezunlar sekmesi) */}
      {isGraduate && (
        <td className="px-6 py-4 hidden lg:table-cell">
          <span className="text-[11px] text-text-tertiary">{graduatedDate || "—"}</span>
        </td>
      )}

      {/* Aksiyon */}
      <td className="px-6 py-4 text-right">
        {isGraduate ? (
          canUndo && (
            <button
              onClick={() => onUndo(student)}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-text-tertiary hover:text-status-danger-500 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
            >
              <RotateCcw size={12} />
              Geri Al
            </button>
          )
        ) : (
          canGraduate && (
            <button
              onClick={() => onGraduate(student)}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#3A7BD5] hover:text-[#2867BD] transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
            >
              <GraduationCap size={12} />
              Mezun Et
            </button>
          )
        )}
      </td>
    </tr>
  );
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

function ConfirmDialog({
  student,
  isUndo,
  processing,
  onConfirm,
  onCancel,
}: {
  student: Student;
  isUndo: boolean;
  processing: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-20 border border-surface-200 p-6 w-full max-w-sm shadow-xl mx-4">
        <div className="flex flex-col items-center text-center gap-3 mb-6">
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center ${
              isUndo ? "bg-surface-100" : "bg-designstudio-primary-50"
            }`}
          >
            {isUndo ? (
              <RotateCcw size={22} className="text-text-secondary" />
            ) : (
              <GraduationCap size={22} className="text-[#FF8D28]" />
            )}
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-text-primary">
              {isUndo ? "Mezuniyeti Geri Al" : "Mezun Et"}
            </h3>
            <p className="text-[12px] text-text-tertiary mt-1 leading-relaxed">
              {isUndo
                ? `${student.name} ${student.lastName} aktif öğrencilere geri alınacak.`
                : `${student.name} ${student.lastName} mezun edilecek.`}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={processing}
            className="flex-1 h-9 rounded-10 border border-surface-200 text-[12px] font-semibold text-text-secondary hover:bg-surface-50 transition-colors cursor-pointer disabled:opacity-50"
          >
            İptal
          </button>
          <button
            onClick={onConfirm}
            disabled={processing}
            className={`flex-1 h-9 rounded-10 text-[12px] font-semibold text-white transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 ${
              isUndo
                ? "bg-text-secondary hover:bg-text-primary"
                : "bg-[#FF8D28] hover:bg-[#E07820]"
            }`}
          >
            {processing ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : isUndo ? (
              "Geri Al"
            ) : (
              "Mezun Et"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <GraduationCap size={40} className="text-surface-200" />
      <p className="text-[13px] font-semibold text-text-placeholder">{message}</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GraduationPage() {
  const { user } = useUser();
  const isAdmin = user?.roles?.includes(ROLES.ADMIN) ?? false;
  const uid = user?.uid ?? "";

  const [activeTab, setActiveTab] = useState<"active" | "graduates">("active");
  const [search, setSearch] = useState("");
  const [instructorFilter, setInstructorFilter] = useState("all");

  // Data
  const [myGroupIds, setMyGroupIds] = useState<string[]>([]);
  const [activeStudents, setActiveStudents] = useState<Student[]>([]);
  const [graduates, setGraduates] = useState<Student[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);

  // Loading
  const [loadingGroups, setLoadingGroups] = useState(!isAdmin);
  const [loadingActive, setLoadingActive] = useState(true);
  const [loadingGraduates, setLoadingGraduates] = useState(true);

  // Confirm
  const [confirmStudent, setConfirmStudent] = useState<Student | null>(null);
  const [confirmMode, setConfirmMode] = useState<"graduate" | "undo">("graduate");
  const [processing, setProcessing] = useState(false);

  // Footer compat
  const [, setFooterTab] = useState("graduation");

  // ── Eğitmen: kendi aktif grup ID'lerini çek ──────────────────────────────
  useEffect(() => {
    if (isAdmin || !uid) {
      setLoadingGroups(false);
      return;
    }
    const q = query(
      collection(db, "groups"),
      where("instructorId", "==", uid),
      where("status", "==", "active")
    );
    return onSnapshot(q, (snap) => {
      setMyGroupIds(snap.docs.map((d) => d.id));
      setLoadingGroups(false);
    });
  }, [uid, isAdmin]);

  // ── Aktif öğrenciler ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!uid || loadingGroups) return;

    if (isAdmin) {
      const q = query(
        collection(db, "students"),
        where("status", "==", "active")
      );
      return onSnapshot(q, (snap) => {
        setActiveStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Student)));
        setLoadingActive(false);
      });
    }

    // Eğitmen: kendi gruplarındaki aktif öğrenciler
    if (myGroupIds.length === 0) {
      setActiveStudents([]);
      setLoadingActive(false);
      return;
    }

    const q = query(
      collection(db, "students"),
      where("groupId", "in", myGroupIds.slice(0, 30)),
      where("status", "==", "active")
    );
    return onSnapshot(q, (snap) => {
      setActiveStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Student)));
      setLoadingActive(false);
    });
  }, [uid, isAdmin, myGroupIds, loadingGroups]);

  // ── Mezunlar ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!uid) return;

    if (isAdmin) {
      const q = query(
        collection(db, "students"),
        where("status", "==", "passive")
      );
      return onSnapshot(q, (snap) => {
        setGraduates(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Student)));
        setLoadingGraduates(false);
      });
    }

    // Eğitmen: sadece kendi mezun ettiği öğrenciler
    const q = query(
      collection(db, "students"),
      where("status", "==", "passive"),
      where("graduatedBy", "==", uid)
    );
    return onSnapshot(q, (snap) => {
      setGraduates(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Student)));
      setLoadingGraduates(false);
    });
  }, [uid, isAdmin]);

  // ── Admin: eğitmen listesi ────────────────────────────────────────────────
  useEffect(() => {
    if (!isAdmin) return;
    return onSnapshot(collection(db, "users"), (snap) => {
      const list: Instructor[] = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as any))
        .filter(
          (u) =>
            u.roles?.includes("instructor") ||
            u.role === "instructor" ||
            u.isInstructor === true
        )
        .map((u) => ({
          id: u.id,
          displayName: u.name
            ? `${u.name} ${u.surname || ""}`.trim()
            : u.email || "İsimsiz",
        }));
      setInstructors(list);
    });
  }, [isAdmin]);

  // ── Filtrelenmiş listeler ─────────────────────────────────────────────────
  const filteredActive = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return activeStudents;
    return activeStudents.filter((st) =>
      `${st.name} ${st.lastName}`.toLowerCase().includes(s)
    );
  }, [activeStudents, search]);

  const filteredGraduates = useMemo(() => {
    const s = search.trim().toLowerCase();
    return graduates.filter((st) => {
      const nameMatch = !s || `${st.name} ${st.lastName}`.toLowerCase().includes(s);
      const instructorMatch =
        instructorFilter === "all" || st.graduatedBy === instructorFilter;
      return nameMatch && instructorMatch;
    });
  }, [graduates, search, instructorFilter]);

  // ── Mezun et ──────────────────────────────────────────────────────────────
  const handleGraduate = useCallback(
    async (student: Student) => {
      if (processing) return;
      setProcessing(true);
      try {
        await updateDoc(doc(db, "students", student.id), {
          status: "passive",
          graduatedBy: uid,
          graduatedAt: serverTimestamp(),
          lastGroupCode: student.groupCode,
          lastGroupId: student.groupId,
          groupCode: `Mezun (${student.groupCode})`,
          groupId: "unassigned",
          updatedAt: new Date(),
        });
        if (student.groupId && student.groupId !== "unassigned") {
          await updateDoc(doc(db, "groups", student.groupId), {
            students: increment(-1),
          });
        }
      } catch (e) {
        console.error("Mezun etme hatası:", e);
      }
      setProcessing(false);
      setConfirmStudent(null);
    },
    [uid, processing]
  );

  // ── Mezuniyeti geri al ────────────────────────────────────────────────────
  const handleUndo = useCallback(
    async (student: Student) => {
      if (processing) return;
      setProcessing(true);
      try {
        const lastGroupId = student.lastGroupId || "unassigned";
        await updateDoc(doc(db, "students", student.id), {
          status: "active",
          groupCode: student.lastGroupCode || student.groupCode,
          groupId: lastGroupId,
          graduatedBy: deleteField(),
          graduatedAt: deleteField(),
          lastGroupCode: deleteField(),
          lastGroupId: deleteField(),
          updatedAt: new Date(),
        });
        if (lastGroupId && lastGroupId !== "unassigned") {
          await updateDoc(doc(db, "groups", lastGroupId), {
            students: increment(1),
          });
        }
      } catch (e) {
        console.error("Geri alma hatası:", e);
      }
      setProcessing(false);
      setConfirmStudent(null);
    },
    [processing]
  );

  // ── Helpers ───────────────────────────────────────────────────────────────
  const isLoading = activeTab === "active" ? loadingActive : loadingGraduates;
  const list = activeTab === "active" ? filteredActive : filteredGraduates;

  const openConfirm = (student: Student, mode: "graduate" | "undo") => {
    setConfirmStudent(student);
    setConfirmMode(mode);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="flex h-screen overflow-hidden bg-surface-50 font-inter antialiased text-text-primary">
        {/* Sidebar */}
        <aside className="hidden lg:block h-full shrink-0 z-50 transition-all duration-300 w-70 2xl:w-[320px] bg-[#10294C]">
          <Sidebar />
        </aside>

        {/* İçerik */}
        <div className="flex-1 flex flex-col min-w-0 relative h-full">
          <Header />

          <main className="flex-1 w-full overflow-y-auto overflow-x-clip [scrollbar-gutter:stable]">
            <div className="w-[94%] mx-auto py-8 max-w-7xl xl:max-w-400 2xl:max-w-480">

              {/* ── HEADER BAR ─────────────────────────────────────────── */}
              <div className="bg-base-primary-500 rounded-20 px-6 py-5 mb-6 flex items-center gap-5">
                <div className="flex items-center gap-3 shrink-0">
                  <div className="w-10 h-10 rounded-16 bg-white/20 flex items-center justify-center">
                    <GraduationCap size={20} className="text-white" />
                  </div>
                  <div>
                    <h1 className="text-[20px] font-bold text-white leading-tight">Mezuniyet</h1>
                    <p className="text-[11px] text-white/60 font-medium">
                      {isAdmin ? "Tüm öğrenciler" : "Sınıflarımdaki öğrenciler"}
                    </p>
                  </div>
                </div>

                <div className="w-px h-10 bg-white/20 shrink-0" />

                <div className="flex items-center gap-7">
                  <div className="text-center">
                    <p className="text-[18px] font-bold text-white tabular-nums leading-none">
                      {loadingActive ? "—" : activeStudents.length}
                    </p>
                    <p className="text-[10px] text-white/60 font-medium mt-0.5">Aktif</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[18px] font-bold text-white tabular-nums leading-none">
                      {loadingGraduates ? "—" : graduates.length}
                    </p>
                    <p className="text-[10px] text-white/60 font-medium mt-0.5">Mezun</p>
                  </div>
                </div>
              </div>

              {/* ── KONTROLLER ─────────────────────────────────────────── */}
              <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                {/* Tab toggle */}
                <div className="flex items-center gap-0.5 bg-surface-100 rounded-10 p-0.5">
                  {(["active", "graduates"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => { setActiveTab(tab); setSearch(""); }}
                      className={`text-[12px] font-semibold px-4 h-8 rounded-8 transition-all cursor-pointer whitespace-nowrap ${
                        activeTab === tab
                          ? "bg-white text-text-primary shadow-sm"
                          : "text-text-tertiary hover:text-text-primary"
                      }`}
                    >
                      {tab === "active" ? "Aktif Öğrenciler" : "Mezunlar"}
                    </button>
                  ))}
                </div>

                {/* Sağ: filtreler + arama */}
                <div className="flex items-center gap-2">
                  {/* Admin: eğitmen filtresi — sadece Mezunlar sekmesinde */}
                  {isAdmin && activeTab === "graduates" && (
                    <div className="relative">
                      <select
                        value={instructorFilter}
                        onChange={(e) => setInstructorFilter(e.target.value)}
                        className="h-8 pl-3 pr-8 rounded-10 bg-white border border-surface-200 text-text-primary text-[12px] font-medium outline-none cursor-pointer appearance-none"
                      >
                        <option value="all">Tüm Sınıflar</option>
                        {instructors.map((ins) => (
                          <option key={ins.id} value={ins.id}>
                            {ins.displayName}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={12}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
                      />
                    </div>
                  )}

                  {/* Arama */}
                  <div className="relative">
                    <Search
                      size={13}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
                    />
                    <input
                      type="text"
                      placeholder="Öğrenci ara..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="h-8 pl-8 pr-3 rounded-10 bg-white border border-surface-200 text-[12px] text-text-primary placeholder:text-text-placeholder outline-none focus:border-base-primary-500 transition-colors w-48"
                    />
                  </div>
                </div>
              </div>

              {/* ── TABLO ──────────────────────────────────────────────── */}
              <div
                className="bg-white rounded-20 border border-surface-200 overflow-hidden"
                style={{ boxShadow: "0 4px 40px rgba(0,0,0,0.04)" }}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center h-48">
                    <div className="w-6 h-6 border-2 border-surface-100 border-t-[#3A7BD5] rounded-full animate-spin" />
                  </div>
                ) : list.length === 0 ? (
                  <EmptyState
                    message={
                      search
                        ? "Aramanızla eşleşen öğrenci bulunamadı."
                        : activeTab === "active"
                        ? "Aktif öğrenci bulunmuyor."
                        : "Henüz mezun öğrenci yok."
                    }
                  />
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-surface-100">
                        <th className="text-left text-[11px] font-semibold text-text-tertiary px-6 py-4">
                          Öğrenci
                        </th>
                        <th className="text-left text-[11px] font-semibold text-text-tertiary px-6 py-4 hidden md:table-cell">
                          Şube
                        </th>
                        <th className="text-left text-[11px] font-semibold text-text-tertiary px-6 py-4">
                          Grup
                        </th>
                        {activeTab === "graduates" && (
                          <th className="text-left text-[11px] font-semibold text-text-tertiary px-6 py-4 hidden lg:table-cell">
                            Mezuniyet Tarihi
                          </th>
                        )}
                        <th className="px-6 py-4 w-28" />
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((student) => {
                        // Eğitmen: sadece kendi öğrencilerini mezun/geri alabilir
                        const canGraduate = isAdmin || true; // aktif öğrenciler zaten filtrelenmiş
                        const canUndo = isAdmin || student.graduatedBy === uid;
                        return (
                          <StudentRow
                            key={student.id}
                            student={student}
                            isGraduate={activeTab === "graduates"}
                            canGraduate={canGraduate}
                            canUndo={canUndo}
                            onGraduate={(s) => openConfirm(s, "graduate")}
                            onUndo={(s) => openConfirm(s, "undo")}
                          />
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

            </div>
          </main>

          <Footer setActiveTab={setFooterTab} />
        </div>
      </div>

      {/* Confirm Dialog */}
      {confirmStudent && (
        <ConfirmDialog
          student={confirmStudent}
          isUndo={confirmMode === "undo"}
          processing={processing}
          onCancel={() => !processing && setConfirmStudent(null)}
          onConfirm={() => {
            if (confirmMode === "graduate") handleGraduate(confirmStudent);
            else handleUndo(confirmStudent);
          }}
        />
      )}
    </>
  );
}
