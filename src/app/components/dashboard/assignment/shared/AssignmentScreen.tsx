"use client";

import { useState, useEffect, useCallback, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Users, ChevronRight } from "lucide-react";
import { db } from "@/app/lib/firebase";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import type { Student, TaskData } from "./types";

// ─── Props ────────────────────────────────────────────────────────────────────

interface AssignmentScreenProps {
  taskId: string;
  /** Her ödevde farklı — kendi intro bileşenini render eder */
  renderIntro: (onComplete: () => void) => ReactNode;
  /** Oyun ekranı — task + öğrenciler hazır olunca çağrılır */
  renderGame: (task: TaskData, students: Student[]) => ReactNode;
  /** Giriş ekranındaki vurgu rengi (checkbox, buton, spinner) */
  accentColor: string;
  /** Giriş ekranı üst bar ikonu */
  topBarIcon?: ReactNode;
}

// ─── Giriş ekranı — tüm ödevlerde ortak ──────────────────────────────────────

function EntryScreen({
  task,
  accentColor,
  topBarIcon,
  onStart,
  drawnStudentIds,
}: {
  task: TaskData;
  accentColor: string;
  topBarIcon?: ReactNode;
  onStart: (students: Student[]) => void;
  drawnStudentIds: string[];
}) {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    if (!task.groupId) { setLoading(false); return; }
    getDocs(query(collection(db, "students"), where("groupId", "==", task.groupId)))
      .then(snap => {
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
        // Tamamlanmamışları üste, tamamlananları alta sırala
        const sorted = [
          ...all.filter(s => !drawnStudentIds.includes(s.id)),
          ...all.filter(s =>  drawnStudentIds.includes(s.id)),
        ];
        setStudents(sorted);
        // Varsayılan seçim: sadece henüz çekilişe girmemiş öğrenciler
        setSelected(new Set(sorted.filter(s => !drawnStudentIds.includes(s.id)).map(s => s.id)));
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.groupId]);

  const toggle = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const selectableStudents = students.filter(s => !drawnStudentIds.includes(s.id));
  const allSelected = selectableStudents.length > 0 && selectableStudents.every(s => selected.has(s.id));
  const toggleAll   = () =>
    setSelected(allSelected ? new Set() : new Set(selectableStudents.map(s => s.id)));

  const handleStart = () => {
    const list = students.filter(s => selected.has(s.id));
    if (list.length > 0) onStart(list);
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "linear-gradient(150deg, #060D1A 0%, #0D1F38 55%, #060D1A 100%)" }}
    >
      {/* Üst bar */}
      <div className="flex items-center justify-between px-8 py-6 border-b border-white/6">
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 cursor-pointer"
          style={{ color: "rgba(255,255,255,0.35)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.8)")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
        >
          <ArrowLeft size={17} />
          <span className="text-[15px] font-semibold">Ana Sayfa</span>
        </button>

        <div className="flex items-center gap-3">
          {topBarIcon && (
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: `${accentColor}22` }}
            >
              {topBarIcon}
            </div>
          )}
          <div>
            <p className="text-[13px] font-bold text-white">{task.name}</p>
            <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.30)" }}>
              {[task.classId, task.level].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>

        <div className="w-28" />
      </div>

      {/* İçerik */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-12">
        <div className="w-full max-w-lg">

          {/* Başlık */}
          <div className="text-center mb-10">
            <p
              className="text-[11px] font-bold tracking-[0.45em] uppercase mb-3"
              style={{ color: accentColor }}
            >
              Çekiliş Hazırlığı
            </p>
            <h2
              className="text-[34px] font-black text-white"
              style={{ letterSpacing: "-0.03em" }}
            >
              Katılımcıları Seç
            </h2>
            <p className="text-[13px] mt-2" style={{ color: "rgba(255,255,255,0.30)" }}>
              O an olmayan öğrencileri seçme — sonra eklenip çekilebilirler.
            </p>
          </div>

          {/* Öğrenci listesi */}
          <div
            className="w-full overflow-hidden mb-8"
            style={{
              background:   "rgba(255,255,255,0.04)",
              border:       "1px solid rgba(255,255,255,0.08)",
              borderRadius: "var(--radius-24)",
            }}
          >
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div className="flex items-center gap-2">
                <Users size={14} style={{ color: "rgba(255,255,255,0.30)" }} />
                <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.30)" }}>
                  Öğrenciler
                </span>
              </div>
              {selectableStudents.length > 0 && (
                <button
                  onClick={toggleAll}
                  className="text-[12px] font-bold cursor-pointer transition-opacity hover:opacity-70"
                  style={{ color: accentColor }}
                >
                  {allSelected ? "Tümünü Kaldır" : "Tümünü Seç"}
                </button>
              )}
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-44">
                <div
                  className="w-6 h-6 border-2 rounded-full animate-spin"
                  style={{ borderColor: "rgba(255,255,255,0.08)", borderTopColor: accentColor }}
                />
              </div>
            ) : students.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-44 gap-3">
                <Users size={28} style={{ color: "rgba(255,255,255,0.15)" }} />
                <p className="text-[13px] font-medium text-center" style={{ color: "rgba(255,255,255,0.25)" }}>
                  Bu gruba henüz öğrenci eklenmemiş
                </p>
              </div>
            ) : (
              <div>
                {/* Çizgi: tamamlananlar varsa ve tamamlanmamış + tamamlanmış karışıksa */}
                {students.map((s, i) => {
                  const isDrawn = drawnStudentIds.includes(s.id);
                  const isSel   = selected.has(s.id);
                  const isFirstDrawn = isDrawn && !drawnStudentIds.includes(students[i - 1]?.id ?? "");

                  if (isDrawn) {
                    return (
                      <div key={s.id}>
                        {isFirstDrawn && selectableStudents.length > 0 && (
                          <div
                            className="flex items-center gap-3 px-6 py-2"
                            style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
                          >
                            <div className="flex-1 h-px" style={{ background: "rgba(56,161,105,0.2)" }} />
                            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(56,161,105,0.5)" }}>
                              Tamamlandı
                            </span>
                            <div className="flex-1 h-px" style={{ background: "rgba(56,161,105,0.2)" }} />
                          </div>
                        )}
                        <div
                          className="w-full flex items-center gap-4 px-6 py-3.5"
                          style={{
                            borderTop:  (i === 0 || isFirstDrawn) ? "none" : "1px solid rgba(255,255,255,0.04)",
                            background: "transparent",
                          }}
                        >
                          <div
                            className="w-5 h-5 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: "rgba(56,161,105,0.18)", border: "1.5px solid rgba(56,161,105,0.4)" }}
                          >
                            <Check size={10} style={{ color: "#4ade80" }} strokeWidth={3} />
                          </div>
                          <span className="text-[14px] font-semibold flex-1" style={{ color: "rgba(255,255,255,0.20)" }}>
                            {s.name} {s.lastName}
                          </span>
                          <span
                            className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
                            style={{ background: "rgba(56,161,105,0.12)", color: "rgba(74,222,128,0.55)" }}
                          >
                            Tamamlandı
                          </span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={s.id}
                      onClick={() => toggle(s.id)}
                      className="w-full flex items-center gap-4 px-6 py-3.5 text-left cursor-pointer"
                      style={{
                        borderTop:  i === 0 ? "none" : "1px solid rgba(255,255,255,0.05)",
                        background: isSel ? `${accentColor}12` : "transparent",
                      }}
                      onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = isSel ? `${accentColor}12` : "transparent"; }}
                    >
                      <div
                        className="w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all"
                        style={{
                          borderColor: isSel ? accentColor : "rgba(255,255,255,0.18)",
                          background:  isSel ? accentColor : "transparent",
                        }}
                      >
                        {isSel && <Check size={10} className="text-white" strokeWidth={3} />}
                      </div>
                      <span
                        className="text-[14px] font-semibold"
                        style={{ color: isSel ? "rgba(255,255,255,0.90)" : "rgba(255,255,255,0.38)" }}
                      >
                        {s.name} {s.lastName}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Başlat butonu */}
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={handleStart}
              disabled={selected.size === 0}
              className="flex items-center gap-3 px-10 h-14 rounded-2xl text-[15px] font-black text-white transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: accentColor,
                boxShadow:  `0 8px 32px ${accentColor}50`,
              }}
            >
              Ödev Ekranına Geç
              <ChevronRight size={18} strokeWidth={2.5} />
            </button>
            {selected.size > 0 && (
              <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.22)" }}>
                {selected.size} öğrenci katılıyor
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Ana bileşen ──────────────────────────────────────────────────────────────

export default function AssignmentScreen({
  taskId,
  renderIntro,
  renderGame,
  accentColor,
  topBarIcon,
}: AssignmentScreenProps) {
  const router = useRouter();
  const [phase,           setPhase]           = useState<"intro" | "entry" | "game">("intro");
  const [task,            setTask]            = useState<TaskData | null>(null);
  const [taskLoading,     setTaskLoading]     = useState(true);
  const [participants,    setParticipants]    = useState<Student[]>([]);
  const [drawnStudentIds, setDrawnStudentIds] = useState<string[]>([]);

  useEffect(() => {
    if (!taskId) { setTaskLoading(false); return; }
    getDoc(doc(db, "tasks", taskId))
      .then(async snap => {
        if (!snap.exists()) return;
        const taskData = { id: snap.id, ...snap.data() } as TaskData;

        if (taskData.status === "completed" || taskData.status === "archived" || taskData.status === "published") {
          router.replace(`/dashboard/grading?taskId=${snap.id}`);
          return;
        }

        setTask(taskData);

        // Mevcut çekiliş sonuçlarını yükle — tamamlanan öğrenci ID'lerini belirle
        const resultSnap = await getDoc(doc(db, "lottery_results", taskId));
        if (resultSnap.exists()) {
          const data = resultSnap.data();
          if (Array.isArray(data.draws)) {
            setDrawnStudentIds(data.draws.map((d: { studentId: string }) => d.studentId));
          }
        }
      })
      .finally(() => setTaskLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  // Her zaman önce EntryScreen göster (arşivden dönünce de dahil)
  const handleIntroComplete = useCallback(() => {
    setPhase("entry");
  }, []);

  const handleStart = useCallback((students: Student[]) => {
    setParticipants(students);
    setPhase("game");
  }, []);

  // Intro her zaman önce gösterilir (task yüklenirken de)
  if (phase === "intro") return <>{renderIntro(handleIntroComplete)}</>;

  if (!taskLoading && !task) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: "#060D1A" }}>
        <p className="text-white/40 text-[14px]">Ödev bulunamadı.</p>
        <button
          onClick={() => router.push("/dashboard")}
          className="text-[13px] font-bold cursor-pointer"
          style={{ color: accentColor, background: "none", border: "none" }}
        >
          Ana sayfaya dön
        </button>
      </div>
    );
  }

  if (taskLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#060D1A" }}>
        <div
          className="w-6 h-6 border-2 rounded-full animate-spin"
          style={{ borderColor: "rgba(255,255,255,0.08)", borderTopColor: accentColor }}
        />
      </div>
    );
  }

  if (phase === "entry") {
    return (
      <EntryScreen
        task={task!}
        accentColor={accentColor}
        topBarIcon={topBarIcon}
        onStart={handleStart}
        drawnStudentIds={drawnStudentIds}
      />
    );
  }

  return <>{renderGame(task!, participants)}</>;
}
