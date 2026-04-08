"use client";

import { useState, useEffect } from "react";
import { Smartphone } from "lucide-react";
import AssignmentScreen from "../shared/AssignmentScreen";
import SocialGameScreen from "./SocialGameScreen";

// ─── Sosyal medya introsu ─────────────────────────────────────────────────────

const SM_SHAPES = [
  { x: -140, y:  -80, w: 52, h: 52, r:  -8, c: "#a855f7", o: 0.50 },
  { x:  128, y:  -70, w: 40, h: 40, r:   6, c: "#7c3aed", o: 0.42 },
  { x:  155, y:   30, w: 56, h: 56, r:  -5, c: "#a855f7", o: 0.38 },
  { x:   85, y:  125, w: 44, h: 44, r:   9, c: "#9333ea", o: 0.48 },
  { x: -148, y:   65, w: 48, h: 48, r:  -7, c: "#7c3aed", o: 0.44 },
  { x: -155, y:  -22, w: 36, h: 36, r:   4, c: "#a855f7", o: 0.38 },
  { x:  -52, y:  145, w: 58, h: 58, r:  -6, c: "#9333ea", o: 0.50 },
  { x:   50, y: -145, w: 42, h: 42, r:   8, c: "#7c3aed", o: 0.44 },
  { x:  165, y:  -52, w: 34, h: 34, r:  -4, c: "#a855f7", o: 0.34 },
  { x: -160, y:   45, w: 50, h: 50, r:   7, c: "#9333ea", o: 0.38 },
  { x:   75, y:  158, w: 40, h: 40, r:  -9, c: "#7c3aed", o: 0.44 },
  { x:  -75, y: -152, w: 52, h: 52, r:   5, c: "#a855f7", o: 0.50 },
];

function SocialIntro({ onComplete }: { onComplete: () => void }) {
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
        background: "radial-gradient(ellipse at 50% 38%, #1a0a2e 0%, #060D1A 82%)",
        transform:  isOut ? "translateX(110%)" : "translateX(0)",
        transition: isOut ? "transform 0.55s cubic-bezier(0.7,0,1,1)" : "none",
      }}
    >
      {/* Mor glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 480, height: 480, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(168,85,247,0.22) 0%, transparent 65%)",
          transform: isIn ? "scale(1)" : "scale(0)",
          transition: "transform 1.1s cubic-bezier(0.22,1,0.36,1)",
        }}
      />

      {/* Şekiller — yuvarlak köşeli kareler (sosyal medya post formatı) */}
      {SM_SHAPES.map((sh, i) => (
        <div
          key={i}
          className="absolute pointer-events-none"
          style={{
            width:        sh.w,
            height:       sh.h,
            background:   sh.c,
            opacity:      isIn ? sh.o : 0,
            borderRadius: "12px",
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
          style={{ background: "rgba(168,85,247,0.16)", boxShadow: "0 0 90px rgba(168,85,247,0.20)" }}
        >
          <div
            className="w-18 h-18 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(168,85,247,0.28)" }}
          >
            <Smartphone size={38} strokeWidth={1.7} style={{ color: "#c084fc" }} />
          </div>
        </div>

        <div className="text-center">
          <p
            className="text-[11px] font-bold tracking-[0.5em] uppercase mb-3"
            style={{ color: "rgba(192,132,252,0.5)" }}
          >
            Sosyal Medya
          </p>
          <h1
            className="text-[56px] font-black text-white leading-none"
            style={{ letterSpacing: "-0.03em" }}
          >
            Reklam
          </h1>
          <h1
            className="text-[56px] font-black leading-none"
            style={{ letterSpacing: "-0.03em", color: "#c084fc" }}
          >
            Bulucu
          </h1>
        </div>
      </div>
    </div>
  );
}

// ─── Ana bileşen ──────────────────────────────────────────────────────────────

export default function SocialScreen({ taskId }: { taskId: string }) {
  return (
    <AssignmentScreen
      taskId={taskId}
      accentColor="#c084fc"
      topBarIcon={<Smartphone size={15} style={{ color: "#c084fc" }} />}
      renderIntro={onComplete => <SocialIntro onComplete={onComplete} />}
      renderGame={(task, students) => <SocialGameScreen task={task} students={students} />}
    />
  );
}
