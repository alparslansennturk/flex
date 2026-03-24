"use client";

import { useState, useEffect } from "react";
import { BookOpen } from "lucide-react";
import AssignmentScreen from "../shared/AssignmentScreen";
import BookGameScreen from "./BookGameScreen";

// ─── Kitap introsu için şekiller (kitap/sırt formunda dikdörtgenler) ──────────

const BOOK_SHAPES = [
  { x: -145, y:  -85, w: 56, h: 72, r: -8,  c: "#1e40af", o: 0.55 },
  { x:  130, y:  -75, w: 44, h: 58, r:  6,  c: "#2563eb", o: 0.45 },
  { x:  158, y:   28, w: 60, h: 78, r: -5,  c: "#1d4ed8", o: 0.40 },
  { x:   88, y:  128, w: 48, h: 62, r:  9,  c: "#3b82f6", o: 0.50 },
  { x: -150, y:   68, w: 52, h: 68, r: -7,  c: "#2563eb", o: 0.45 },
  { x: -158, y:  -25, w: 40, h: 52, r:  4,  c: "#1e40af", o: 0.40 },
  { x:  -55, y:  148, w: 60, h: 76, r: -6,  c: "#3b82f6", o: 0.52 },
  { x:   52, y: -148, w: 44, h: 56, r:  8,  c: "#2563eb", o: 0.45 },
  { x:  168, y:  -55, w: 38, h: 50, r: -4,  c: "#1d4ed8", o: 0.36 },
  { x: -162, y:   48, w: 52, h: 66, r:  7,  c: "#3b82f6", o: 0.40 },
  { x:   78, y:  162, w: 44, h: 58, r: -9,  c: "#2563eb", o: 0.46 },
  { x:  -78, y: -155, w: 56, h: 72, r:  5,  c: "#1e40af", o: 0.52 },
  { x:   -5, y: -165, w: 36, h: 48, r: -3,  c: "#2563eb", o: 0.35 },
  { x:  -92, y:   28, w: 32, h: 42, r:  6,  c: "#3b82f6", o: 0.30 },
];

// ─── Kitap introsu ────────────────────────────────────────────────────────────

function BookIntro({ onComplete }: { onComplete: () => void }) {
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
        background: "radial-gradient(ellipse at 50% 38%, #0f1f45 0%, #060D1A 82%)",
        transform:  isOut ? "translateX(110%)" : "translateX(0)",
        transition: isOut ? "transform 0.55s cubic-bezier(0.7,0,1,1)" : "none",
      }}
    >
      {/* Mavi glow */}
      <div
        className="absolute w-120 h-120 rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(37,99,235,0.22) 0%, transparent 65%)",
          transform:  isIn ? "scale(1)" : "scale(0)",
          transition: "transform 1.1s cubic-bezier(0.22,1,0.36,1)",
        }}
      />

      {/* Kitap şekilleri */}
      {BOOK_SHAPES.map((sh, i) => (
        <div
          key={i}
          className="absolute pointer-events-none"
          style={{
            width:        sh.w,
            height:       sh.h,
            background:   sh.c,
            opacity:      isIn ? sh.o : 0,
            borderRadius: "3px 3px 4px 4px",
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
          style={{ background: "rgba(37,99,235,0.16)", boxShadow: "0 0 90px rgba(37,99,235,0.20)" }}
        >
          <div
            className="w-18 h-18 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(37,99,235,0.28)" }}
          >
            <BookOpen size={38} strokeWidth={1.7} style={{ color: "#60a5fa" }} />
          </div>
        </div>

        <div className="text-center">
          <p className="text-[11px] font-bold tracking-[0.5em] uppercase mb-3" style={{ color: "rgba(147,197,253,0.5)" }}>
            Okuma Atölyesi
          </p>
          <h1 className="text-[56px] font-black text-white leading-none" style={{ letterSpacing: "-0.03em" }}>
            Kitap
          </h1>
          <h1 className="text-[56px] font-black leading-none" style={{ letterSpacing: "-0.03em", color: "#60a5fa" }}>
            Dünyası
          </h1>
        </div>
      </div>
    </div>
  );
}

// ─── Ana bileşen ──────────────────────────────────────────────────────────────

export default function BookScreen({ taskId }: { taskId: string }) {
  return (
    <AssignmentScreen
      taskId={taskId}
      accentColor="#60a5fa"
      topBarIcon={<BookOpen size={15} style={{ color: "#60a5fa" }} />}
      renderIntro={onComplete => <BookIntro onComplete={onComplete} />}
      renderGame={(task, students) => <BookGameScreen task={task} students={students} />}
    />
  );
}
