"use client";

import { useState, useEffect } from "react";
import { Layers } from "lucide-react";
import AssignmentScreen from "../shared/AssignmentScreen";
import GameScreen from "./GameScreen";

// ─── Kolaj introsu için süslemeler ───────────────────────────────────────────

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

// ─── Kolaj introsu ────────────────────────────────────────────────────────────

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
          style={{ background: "rgba(74,148,98,0.16)", boxShadow: "0 0 90px rgba(74,148,98,0.20)" }}
        >
          <div
            className="w-18 h-18 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(74,148,98,0.28)" }}
          >
            <Layers size={38} strokeWidth={1.7} style={{ color: "#689adf" }} />
          </div>
        </div>

        <div className="text-center">
          <p className="text-[11px] font-bold tracking-[0.5em] uppercase mb-3" style={{ color: "rgba(168,213,186,0.5)" }}>
            Tasarım Atölyesi
          </p>
          <h1 className="text-[56px] font-black text-white leading-none" style={{ letterSpacing: "-0.03em" }}>
            Kolaj
          </h1>
          <h1 className="text-[56px] font-black leading-none" style={{ letterSpacing: "-0.03em", color: "#689adf" }}>
            Bahçesi
          </h1>
        </div>
      </div>
    </div>
  );
}

// ─── Ana bileşen ──────────────────────────────────────────────────────────────

export default function KolajScreen({ taskId }: { taskId: string }) {
  return (
    <AssignmentScreen
      taskId={taskId}
      accentColor="#689adf"
      topBarIcon={<Layers size={15} style={{ color: "#689adf" }} />}
      renderIntro={onComplete => <KolajIntro onComplete={onComplete} />}
      renderGame={(task, students) => <GameScreen task={task} students={students} />}
    />
  );
}
