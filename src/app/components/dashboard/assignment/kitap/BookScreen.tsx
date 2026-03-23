"use client";

import { useState, useEffect } from "react";
import { BookOpen } from "lucide-react";
import AssignmentScreen from "../shared/AssignmentScreen";
import BookGameScreen from "./BookGameScreen";

// ─── Slot kitap verileri ──────────────────────────────────────────────────────
// Renk paleti orijinal BOOK_SHAPES'ten alındı

const SLOT_BOOKS = [
  { c: "#1e3a6e" },
  { c: "#2563eb" },
  { c: "#1d4ed8" },
  { c: "#3b82f6" },
  { c: "#1e3a6e" }, // merkez (index 4)
  { c: "#2563eb" },
  { c: "#1d4ed8" },
  { c: "#3b82f6" },
  { c: "#1e3a6e" },
];

const BOOK_W    = 220;
const BOOK_H    = 360;
const BOOK_GAP  = 28;
const BOOK_STEP = BOOK_W + BOOK_GAP;
const CTR_IDX   = 4;

// ease-in-out cubic: yavaş → hızlı → yavaş
function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ─── Kitap introsu ────────────────────────────────────────────────────────────

type Phase = "init" | "spin" | "pulse" | "zoom" | "title" | "exit";

function BookIntro({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase]   = useState<Phase>("init");
  const [stripX, setStripX] = useState(3000);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const w      = window.innerWidth;
    const startX = w + 280;
    const endX   = w / 2 - CTR_IDX * BOOK_STEP - BOOK_W / 2;
    const dur    = 3600; // ms — slot dönüş süresi (uzun, yumuşak)

    setStripX(startX);

    let startTs: number | null = null;
    let raf: number;

    const tick = (ts: number) => {
      if (!startTs) startTs = ts;
      const t = Math.min((ts - startTs) / dur, 1);
      setStripX(startX + (endX - startX) * easeInOutCubic(t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    const raf0 = requestAnimationFrame(() => { raf = requestAnimationFrame(tick); });

    const t1 = setTimeout(() => setPhase("spin"),  60);
    const t2 = setTimeout(() => setPhase("pulse"), 3800);
    const t3 = setTimeout(() => setPhase("zoom"),  4750);
    const t4 = setTimeout(() => setPhase("title"), 5550);
    const t5 = setTimeout(() => setPhase("exit"),  6700);
    const t6 = setTimeout(onComplete,              7200);

    return () => {
      cancelAnimationFrame(raf0);
      cancelAnimationFrame(raf);
      [t1, t2, t3, t4, t5, t6].forEach(clearTimeout);
    };
  }, [onComplete]);

  const isExit  = phase === "exit";
  const isPulse = phase === "pulse";
  const isZoom  = phase === "zoom" || phase === "title" || phase === "exit";
  const isTitle = phase === "title" || phase === "exit";

  return (
    <>
      <style>{`
        @keyframes bkPulse {
          0%,100% { transform: scale(1)    translateY(0);     filter: brightness(1);   }
          50%      { transform: scale(1.09) translateY(-7px);  filter: brightness(1.6); }
        }
        @keyframes bkDrop {
          0%   { transform: scale(1)    translateY(0px);  }
          28%  { transform: scale(0.95) translateY(52px); }
          55%  { transform: scale(1.28) translateY(-22px);}
          72%  { transform: scale(1.18) translateY(-8px); }
          86%  { transform: scale(1.22) translateY(-14px);}
          100% { transform: scale(1.20) translateY(-11px);}
        }
        @keyframes titleUp {
          from { transform: translateY(30px); opacity: 0; }
          to   { transform: translateY(0px);  opacity: 1; }
        }
      `}</style>

      <div
        className="fixed inset-0 z-9999 flex items-center justify-center overflow-hidden select-none"
        style={{
          background: "radial-gradient(ellipse at 50% 50%, #0e1f4a 0%, #060D1A 72%)",
          transform:  isExit ? "translateX(110%)" : "translateX(0)",
          transition: isExit ? "transform 0.55s cubic-bezier(0.7,0,1,1)" : "none",
        }}
      >
        {/* Arka glow */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(circle at 50% 50%, rgba(37,99,235,0.13) 0%, transparent 58%)",
        }} />

        {/* ── Slot şeridi ── */}
        <div
          className="absolute overflow-hidden"
          style={{ width: "100%", height: BOOK_H + 80, top: "50%", transform: "translateY(-50%)" }}
        >
          <div
            style={{
              position: "absolute",
              top: 40,
              height: BOOK_H,
              display: "flex",
              alignItems: "center",
              gap: BOOK_GAP,
              transform: `translateX(${stripX}px)`,
              willChange: "transform",
            }}
          >
            {SLOT_BOOKS.map((bk, i) => {
              const isC = i === CTR_IDX;
              return (
                <div
                  key={i}
                  style={{
                    width:       BOOK_W,
                    height:      BOOK_H,
                    flexShrink:  0,
                    borderRadius: "3px 4px 4px 3px",
                    background: bk.c,
                    border: isC
                      ? "1px solid rgba(96,165,250,0.45)"
                      : "1px solid rgba(255,255,255,0.07)",
                    boxShadow: isC
                      ? "0 0 70px rgba(96,165,250,0.35), 6px 12px 32px rgba(0,0,0,0.75)"
                      : "4px 8px 22px rgba(0,0,0,0.55)",
                    opacity:    isZoom && !isC ? 0.35 : 1,
                    filter:     isZoom && !isC ? "blur(1px)" : "none",
                    transition: isZoom ? "opacity 0.35s ease, filter 0.35s ease" : "none",
                    animation:  isC && isPulse
                      ? "bkPulse 0.36s ease-in-out 3"
                      : isC && isZoom
                      ? "bkDrop 0.95s cubic-bezier(0.34,1.56,0.64,1) forwards"
                      : undefined,
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {/* İnce sırt şeridi */}
                  <div style={{
                    position: "absolute", left: 0, top: 0, bottom: 0, width: 8,
                    background: "rgba(0,0,0,0.45)", borderRadius: "3px 0 0 3px",
                  }} />
                  {/* Hafif parlama */}
                  <div style={{
                    position: "absolute", inset: 0,
                    background: "linear-gradient(148deg, rgba(255,255,255,0.07) 0%, transparent 50%)",
                  }} />
                  {/* Merkez kitap ikonu */}
                  {isC && (
                    <div style={{
                      position: "absolute", inset: 0, display: "flex",
                      alignItems: "center", justifyContent: "center",
                      opacity: 0.45,
                    }}>
                      <BookOpen size={52} strokeWidth={1.1} style={{ color: "#93c5fd" }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Kitap Dünyası yazısı ── */}
        {isTitle && (
          <div
            className="absolute text-center pointer-events-none"
            style={{
              top:       "50%",
              left:      "50%",
              transform: `translate(-50%, calc(50% + ${BOOK_H / 2 + 24}px))`,
              animation: "titleUp 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards",
            }}
          >
            <p style={{
              color: "rgba(147,197,253,0.5)", fontSize: 11, fontWeight: 700,
              letterSpacing: "0.45em", textTransform: "uppercase", marginBottom: 8,
            }}>
              Okuma Atölyesi
            </p>
            <div style={{
              fontSize: 44, fontWeight: 900, letterSpacing: "-0.025em", lineHeight: 1.1,
            }}>
              <span style={{ color: "#fff" }}>Kitap </span>
              <span style={{ color: "#60a5fa" }}>Dünyası</span>
            </div>
          </div>
        )}
      </div>
    </>
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
