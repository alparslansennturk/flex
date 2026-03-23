"use client";

import { Check, FileText } from "lucide-react";
import type { Student, StudentDraw } from "./types";

interface Props {
  students: Student[];
  draws: StudentDraw[];
  catCount: number;
  taskLabel: string;
  onViewResult: (studentId: string) => void;
  pickHighlightId: string | null;
  drawingStudentId: string | null;
  accentColor?: string;
}

export default function StudentPanel({
  students, draws, catCount, taskLabel,
  onViewResult, pickHighlightId, drawingStudentId,
  accentColor = "#689adf",
}: Props) {
  const accentRgb = accentColor.startsWith("#")
    ? `${parseInt(accentColor.slice(1,3),16)},${parseInt(accentColor.slice(3,5),16)},${parseInt(accentColor.slice(5,7),16)}`
    : "104,154,223";
  return (
    <div className="w-72 flex flex-col shrink-0" style={{ background: "#060D1A", borderRight: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="px-5 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <p className="text-[15px] font-black truncate" style={{ color: "rgba(255,255,255,0.82)", letterSpacing: "-0.01em" }}>
          {taskLabel || "—"}
        </p>
        <p className="text-[13px] font-semibold mt-1" style={{ color: "rgba(255,255,255,0.40)" }}>
          Katılımcılar
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {students.map(s => {
          const draw      = draws.find(d => d.studentId === s.id);
          const isDone    = !!(draw && draw.draws.length >= catCount && catCount > 0);
          const isHighlit = pickHighlightId === s.id;
          const isDrawing = drawingStudentId === s.id;

          return (
            <div key={s.id} className="px-4 py-3" style={{
              borderBottom: "1px solid rgba(255,255,255,0.04)",
              background: isHighlit ? accentColor : isDrawing ? `rgba(${accentRgb},0.10)` : "transparent",
              transition: "background 0.06s ease-out",
            }}>
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0" style={{
                  background: isHighlit ? "rgba(255,255,255,0.25)"
                            : isDone    ? "rgba(74,148,98,0.25)"
                            : isDrawing ? `rgba(${accentRgb},0.25)`
                            : "rgba(255,255,255,0.06)",
                  color:     isHighlit ? "white"
                            : isDone   ? "#68d391"
                            : isDrawing ? accentColor
                            : "rgba(255,255,255,0.35)",
                  transition: "background 0.06s ease-out, color 0.06s ease-out",
                }}>
                  {isDone ? <Check size={12} strokeWidth={3} /> : s.name[0]}
                </div>

                <span className="flex-1 text-[13px] font-semibold truncate" style={{
                  color: isHighlit ? "white" : isDone ? "rgba(255,255,255,0.6)" : "white",
                  transition: "color 0.06s ease-out",
                }}>
                  {s.name} {s.lastName}
                </span>

                {isDone && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Check size={12} strokeWidth={3} style={{ color: "#68d391" }} />
                    <button
                      onClick={() => onViewResult(s.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer"
                      style={{ background: `rgba(${accentRgb},0.12)`, color: accentColor }}
                      onMouseEnter={e => (e.currentTarget.style.background = `rgba(${accentRgb},0.28)`)}
                      onMouseLeave={e => (e.currentTarget.style.background = `rgba(${accentRgb},0.12)`)}
                    >
                      <FileText size={12} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
