"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Layers, ArrowLeft, Settings, Check, Users, ChevronRight } from "lucide-react";
import { db } from "@/app/lib/firebase";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { useUser } from "@/app/context/UserContext";
import { PERMISSIONS } from "@/app/lib/constants";

// ─── Tipler ──────────────────────────────────────────────────────────────────

interface Student {
  id: string;
  name: string;
  surname: string;
  email?: string;
}

interface TaskData {
  id: string;
  name: string;
  classId?: string;
  groupId?: string;
  level?: string;
  endDate?: string;
}

// ─── Intro süslemeleri ───────────────────────────────────────────────────────

const BOTANICAL = [
  { x: -145, y:  -85, w: 68, h: 28, r: -35, c: "#3a7bd5", o: 0.55 },
  { x:  135, y:  -72, w: 52, h: 22, r:  45, c: "#689adf", o: 0.45 },
  { x:  162, y:   32, w: 72, h: 30, r:  15, c: "#3a7bd5", o: 0.40 },
  { x:   92, y:  132, w: 56, h: 24, r:  60, c: "#92b6e8", o: 0.50 },
  { x: -152, y:   72, w: 62, h: 26, r: -50, c: "#689adf", o: 0.45 },
  { x: -162, y:  -22, w: 46, h: 20, r:  20, c: "#3a7bd5", o: 0.40 },
  { x:  -52, y:  152, w: 72, h: 28, r: -25, c: "#92b6e8", o: 0.52 },
  { x:   57, y: -152, w: 50, h: 22, r:  55, c: "#689adf", o: 0.45 },
  { x:  172, y:  -52, w: 46, h: 20, r:  35, c: "#3a7bd5", o: 0.36 },
  { x: -167, y:   52, w: 62, h: 26, r: -60, c: "#92b6e8", o: 0.40 },
  { x:   82, y:  167, w: 50, h: 22, r:  25, c: "#689adf", o: 0.46 },
  { x:  -82, y: -157, w: 66, h: 28, r: -40, c: "#3a7bd5", o: 0.52 },
  { x:   -5, y: -168, w: 44, h: 18, r:  10, c: "#689adf", o: 0.35 },
  { x:  -95, y:   30, w: 38, h: 16, r: -70, c: "#92b6e8", o: 0.30 },
];

// ─── Intro ───────────────────────────────────────────────────────────────────

function KolajIntro({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<"enter" | "hold" | "exit">("enter");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"),   60);
    const t2 = setTimeout(() => setPhase("exit"), 2100);
    const t3 = setTimeout(onComplete,             2650);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onComplete]);

  const isIn  = phase !== "enter";
  const isOut = phase === "exit";

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden select-none"
      style={{
        background: "radial-gradient(ellipse at 50% 38%, #10294c 0%, #060D1A 82%)",
        transform:  isOut ? "translateX(110%)" : "translateX(0)",
        transition: isOut ? "transform 0.55s cubic-bezier(0.7,0,1,1)" : "none",
      }}
    >
      {/* Yeşil glow */}
      <div
        className="absolute w-120 h-120 rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(74,148,98,0.22) 0%, transparent 65%)",
          transform:  isIn ? "scale(1)" : "scale(0)",
          transition: "transform 1.1s cubic-bezier(0.22,1,0.36,1)",
        }}
      />

      {/* Botanik şekiller */}
      {BOTANICAL.map((sh, i) => (
        <div
          key={i}
          className="absolute pointer-events-none"
          style={{
            width:        sh.w,
            height:       sh.h,
            background:   sh.c,
            opacity:      isIn ? sh.o : 0,
            borderRadius: "50% 12% 50% 12%",
            left:  `calc(50% - ${sh.w / 2}px)`,
            top:   `calc(50% - ${sh.h / 2}px)`,
            transform: isIn
              ? `translate(${sh.x}px, ${sh.y}px) rotate(${sh.r}deg) scale(1)`
              : `translate(0px, 0px) rotate(${sh.r}deg) scale(0)`,
            transition: isIn
              ? `transform 0.9s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.035}s, opacity 0.7s ease ${i * 0.035}s`
              : "none",
          }}
        />
      ))}

      {/* İkon + başlık */}
      <div
        className="relative z-10 flex flex-col items-center gap-8"
        style={{
          transform:  isIn ? "scale(1) translateY(0)" : "scale(0.28) translateY(70px)",
          opacity:    isIn ? 1 : 0,
          transition: "all 0.7s cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        <div
          className="w-28 h-28 rounded-3xl flex items-center justify-center"
          style={{
            background:  "rgba(74,148,98,0.16)",
            boxShadow:   "0 0 90px rgba(74,148,98,0.20)",
          }}
        >
          <div
            className="w-18 h-18 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(74,148,98,0.28)" }}
          >
            <Layers size={38} strokeWidth={1.7} style={{ color: "#689adf" }} />
          </div>
        </div>

        <div className="text-center">
          <p
            className="text-[11px] font-bold tracking-[0.5em] uppercase mb-3"
            style={{ color: "rgba(168,213,186,0.5)" }}
          >
            Tasarım Atölyesi
          </p>
          <h1
            className="text-[56px] font-black text-white leading-none"
            style={{ letterSpacing: "-0.03em" }}
          >
            Kolaj
          </h1>
          <h1
            className="text-[56px] font-black leading-none"
            style={{ letterSpacing: "-0.03em", color: "#689adf" }}
          >
            Bahçesi
          </h1>
        </div>
      </div>
    </div>
  );
}

// ─── Giriş ekranı ────────────────────────────────────────────────────────────

function EntryScreen({
  task,
  onStart,
}: {
  task: TaskData;
  onStart: (students: Student[]) => void;
}) {
  const router = useRouter();
  const [students,  setStudents]  = useState<Student[]>([]);
  const [selected,  setSelected]  = useState<Set<string>>(new Set());
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    if (!task.groupId) { setLoading(false); return; }
    getDocs(query(collection(db, "students"), where("groupId", "==", task.groupId)))
      .then(snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
        setStudents(list);
        setSelected(new Set(list.map(s => s.id)));
      })
      .finally(() => setLoading(false));
  }, [task.groupId]);

  const toggle = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const allSelected = students.length > 0 && selected.size === students.length;
  const toggleAll   = () =>
    setSelected(allSelected ? new Set() : new Set(students.map(s => s.id)));

  const handleStart = () => onStart(students.filter(s => selected.has(s.id)));

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "linear-gradient(150deg, #060D1A 0%, #0D1F38 55%, #060D1A 100%)" }}
    >
      {/* Üst bar */}
      <div className="flex items-center justify-between px-8 py-6 border-b border-white/[0.06]">
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 cursor-pointer transition-colors"
          style={{ color: "rgba(255,255,255,0.35)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.8)")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
        >
          <ArrowLeft size={15} />
          <span className="text-[13px] font-semibold">Ana Sayfa</span>
        </button>

        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(74,148,98,0.18)" }}
          >
            <Layers size={15} style={{ color: "#689adf" }} />
          </div>
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
              style={{ color: "#689adf" }}
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
            {/* Liste başlığı */}
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div className="flex items-center gap-2">
                <Users size={14} style={{ color: "rgba(255,255,255,0.30)" }} />
                <span
                  className="text-[11px] font-bold uppercase tracking-wide"
                  style={{ color: "rgba(255,255,255,0.30)" }}
                >
                  Öğrenciler
                </span>
              </div>
              {students.length > 0 && (
                <button
                  onClick={toggleAll}
                  className="text-[12px] font-bold cursor-pointer transition-opacity hover:opacity-70"
                  style={{ color: "#689adf" }}
                >
                  {allSelected ? "Tümünü Kaldır" : "Tümünü Seç"}
                </button>
              )}
            </div>

            {/* Liste gövdesi */}
            {loading ? (
              <div className="flex items-center justify-center h-44">
                <div
                  className="w-6 h-6 border-2 rounded-full animate-spin"
                  style={{ borderColor: "rgba(255,255,255,0.08)", borderTopColor: "#689adf" }}
                />
              </div>
            ) : students.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-44 gap-3">
                <Users size={28} style={{ color: "rgba(255,255,255,0.15)" }} />
                <p
                  className="text-[13px] font-medium text-center"
                  style={{ color: "rgba(255,255,255,0.25)" }}
                >
                  Bu gruba henüz öğrenci eklenmemiş
                </p>
              </div>
            ) : (
              <div>
                {students.map((s, i) => {
                  const isSel = selected.has(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => toggle(s.id)}
                      className="w-full flex items-center gap-4 px-6 py-3.5 text-left cursor-pointer transition-colors"
                      style={{
                        borderTop:       i === 0 ? "none" : "1px solid rgba(255,255,255,0.05)",
                        background:      isSel ? "rgba(74,148,98,0.07)" : "transparent",
                      }}
                      onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = isSel ? "rgba(74,148,98,0.07)" : "transparent"; }}
                    >
                      <div
                        className="w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all"
                        style={{
                          borderColor: isSel ? "#3a7bd5" : "rgba(255,255,255,0.18)",
                          background:  isSel ? "#3a7bd5" : "transparent",
                        }}
                      >
                        {isSel && <Check size={10} className="text-white" strokeWidth={3} />}
                      </div>
                      <span
                        className="text-[14px] font-semibold transition-colors"
                        style={{ color: isSel ? "rgba(255,255,255,0.90)" : "rgba(255,255,255,0.38)" }}
                      >
                        {s.name} {s.surname}
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
              className="flex items-center gap-3 px-10 h-14 rounded-2xl text-[15px] font-black text-white transition-all active:scale-95 cursor-pointer"
              style={{
                background:  "linear-gradient(135deg, #205297 0%, #3a7bd5 100%)",
                boxShadow:   "0 8px 32px rgba(74,148,98,0.32)",
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

// ─── Oyun ekranı (stub) ───────────────────────────────────────────────────────

function GameScreen({
  task,
  students,
}: {
  task: TaskData;
  students: Student[];
}) {
  const router = useRouter();
  const { hasPermission } = useUser();
  const isAdmin = hasPermission(PERMISSIONS.MANAGEMENT_PANEL);

  return (
    <div
      className="min-h-screen flex"
      style={{ background: "#060D1A" }}
    >
      {/* Sol: öğrenci listesi */}
      <div
        className="w-72 flex flex-col shrink-0"
        style={{ borderRight: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div
          className="px-6 py-5"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <p
            className="text-[11px] font-bold tracking-[0.45em] uppercase"
            style={{ color: "rgba(255,255,255,0.25)" }}
          >
            Katılımcılar
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {students.length === 0 ? (
            <div className="px-6 py-10 text-center text-[13px]" style={{ color: "rgba(255,255,255,0.18)" }}>
              Öğrenci yok
            </div>
          ) : (
            students.map(s => (
              <div
                key={s.id}
                className="flex items-center gap-3 px-6 py-3"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-black text-white shrink-0"
                  style={{ background: "rgba(74,148,98,0.18)" }}
                >
                  {s.name[0]}
                </div>
                <span className="text-[13px] font-semibold truncate" style={{ color: "rgba(255,255,255,0.55)" }}>
                  {s.name} {s.surname}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Sağ: çekiliş alanı */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Üst bar */}
        <div
          className="flex items-center justify-between px-8 py-5"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-2 cursor-pointer transition-colors"
            style={{ color: "rgba(255,255,255,0.30)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.30)")}
          >
            <ArrowLeft size={15} />
            <span className="text-[12px] font-semibold">Ana Sayfa</span>
          </button>

          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(74,148,98,0.18)" }}
            >
              <Layers size={14} style={{ color: "#689adf" }} />
            </div>
            <span className="text-[14px] font-bold text-white">{task.name}</span>
          </div>

          {isAdmin ? (
            <button
              onClick={() => router.push("/dashboard/admin/migrate")}
              className="flex items-center gap-2 px-4 h-8 rounded-xl text-[12px] font-bold cursor-pointer transition-all"
              style={{
                color:       "rgba(255,255,255,0.40)",
                border:      "1px solid rgba(255,255,255,0.10)",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = "rgba(255,255,255,0.75)";
                e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = "rgba(255,255,255,0.40)";
                e.currentTarget.style.background = "transparent";
              }}
            >
              <Settings size={13} />
              Ayarlar
            </button>
          ) : (
            <div className="w-20" />
          )}
        </div>

        {/* Çekiliş alanı — yapım aşamasında */}
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[14px]" style={{ color: "rgba(255,255,255,0.15)" }}>
            Çekiliş ekranı yakında...
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Ana bileşen ─────────────────────────────────────────────────────────────

export default function KolajScreen({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [phase,        setPhase]        = useState<"intro" | "entry" | "game">("intro");
  const [task,         setTask]         = useState<TaskData | null>(null);
  const [taskLoading,  setTaskLoading]  = useState(true);
  const [participants, setParticipants] = useState<Student[]>([]);

  useEffect(() => {
    if (!taskId) { setTaskLoading(false); return; }
    getDoc(doc(db, "tasks", taskId))
      .then(snap => {
        if (snap.exists()) setTask({ id: snap.id, ...snap.data() } as TaskData);
      })
      .finally(() => setTaskLoading(false));
  }, [taskId]);

  const handleIntroComplete = useCallback(() => setPhase("entry"), []);
  const handleStart         = useCallback((students: Student[]) => {
    setParticipants(students);
    setPhase("game");
  }, []);

  // Intro her zaman önce gösterilir (task yüklenirken de)
  if (phase === "intro") return <KolajIntro onComplete={handleIntroComplete} />;

  // Task bulunamadıysa
  if (!taskLoading && !task) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4"
        style={{ background: "#060D1A" }}
      >
        <p className="text-white/40 text-[14px]">Ödev bulunamadı.</p>
        <button
          onClick={() => router.push("/dashboard")}
          className="text-[13px] font-bold cursor-pointer"
          style={{ color: "#689adf" }}
        >
          Ana sayfaya dön
        </button>
      </div>
    );
  }

  // Task yükleniyorsa
  if (taskLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#060D1A" }}
      >
        <div
          className="w-6 h-6 border-2 rounded-full animate-spin"
          style={{ borderColor: "rgba(255,255,255,0.08)", borderTopColor: "#689adf" }}
        />
      </div>
    );
  }

  if (phase === "entry") return <EntryScreen task={task!} onStart={handleStart} />;
  return <GameScreen task={task!} students={participants} />;
}
