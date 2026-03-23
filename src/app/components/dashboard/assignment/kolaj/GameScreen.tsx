"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Layers, Settings, Check, Mail, FileDown,
  ChevronRight, FileText,
} from "lucide-react";
import { doc, onSnapshot, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useUser } from "@/app/context/UserContext";
import { PERMISSIONS } from "@/app/lib/constants";
import type { CollagePool, CollageItem } from "../pool/poolTypes";
import { generateKolajPdf } from "./generateKolajPdf";

// ─── Tipler ───────────────────────────────────────────────────────────────────

interface Student { id: string; name: string; lastName: string; email?: string; }
interface TaskData  { id: string; name: string; classId?: string; groupId?: string; level?: string; endDate?: string; }
interface DrawResult { category: string; item: CollageItem; }
interface StudentDraw { studentId: string; draws: DrawResult[]; }

type Phase = "idle" | "picking" | "ready" | "drawing" | "done";

const CAT_ORDER   = ["Gök", "Yer", "Obje 1", "Obje 2"];
const CARD_COLORS = ["#3a7bd5", "#689adf", "#5a9ed5", "#4a84c4"];

// ─── DroppedCard ──────────────────────────────────────────────────────────────

function DroppedCard({ draw, index }: { draw: DrawResult; index: number }) {
  const [dropped, setDropped] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDropped(true), 30 + index * 100);
    return () => clearTimeout(t);
  }, [index]);

  return (
    <div style={{
      width: 210, minHeight: 190, flexShrink: 0,
      background: "white",
      border: "1px solid #e2e8f0",
      borderBottom: `6px solid ${CARD_COLORS[index % 4]}`,
      borderRadius: 16,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "20px 14px", position: "relative", textAlign: "center",
      boxShadow: "0 4px 20px rgba(0,0,0,0.07)",
      opacity:   dropped ? 1 : 0,
      transform: dropped ? "translateY(0)" : "translateY(-44px)",
      transition: "opacity 0.5s ease, transform 0.6s cubic-bezier(0.175,0.885,0.32,1.275)",
    }}>
      <div style={{
        position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)",
        width: 26, height: 26, borderRadius: "50%",
        background: CARD_COLORS[index % 4], color: "white",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 900, fontSize: 12, border: "3px solid #f5f7fb",
      }}>
        {index + 1}
      </div>
      <p style={{ fontSize: 13, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
        {draw.category}
      </p>
      {draw.item.emoji && <div style={{ fontSize: 30, marginBottom: 9, lineHeight: 1 }}>{draw.item.emoji}</div>}
      <p style={{ fontSize: 18, fontWeight: 800, color: "#1e293b", lineHeight: 1.2 }}>
        {draw.item.name}
      </p>
    </div>
  );
}

// ─── StudentPanel ─────────────────────────────────────────────────────────────
// Picking animasyonu bu listede döner.

function StudentPanel({
  students, draws, catCount, taskLabel,
  onViewResult, pickHighlightId, drawingStudentId,
}: {
  students: Student[];
  draws: StudentDraw[];
  catCount: number;
  taskLabel: string;
  onViewResult: (studentId: string) => void;
  pickHighlightId: string | null;
  drawingStudentId: string | null;
}) {
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
          const draw       = draws.find(d => d.studentId === s.id);
          const isDone     = !!(draw && draw.draws.length >= catCount && catCount > 0);
          const isHighlit  = pickHighlightId === s.id;
          const isDrawing  = drawingStudentId === s.id;

          return (
            <div key={s.id} className="px-4 py-3" style={{
              borderBottom: "1px solid rgba(255,255,255,0.04)",
              background: isHighlit  ? "#689adf"
                        : isDrawing  ? "rgba(104,154,223,0.10)"
                        : "transparent",
              transition: "background 0.06s ease-out",
            }}>
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0" style={{
                  background: isHighlit  ? "rgba(255,255,255,0.25)"
                            : isDone     ? "rgba(74,148,98,0.25)"
                            : isDrawing  ? "rgba(104,154,223,0.25)"
                            : "rgba(255,255,255,0.06)",
                  color:      isHighlit  ? "white"
                            : isDone     ? "#68d391"
                            : isDrawing  ? "#689adf"
                            : "rgba(255,255,255,0.35)",
                  transition: "background 0.06s ease-out, color 0.06s ease-out",
                }}>
                  {isDone ? <Check size={12} strokeWidth={3} /> : s.name[0]}
                </div>

                <span className="flex-1 text-[13px] font-semibold truncate" style={{
                  color: isHighlit  ? "white"
                       : isDone     ? "rgba(255,255,255,0.6)"
                       : isDrawing  ? "white"
                       : "white",
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
                      style={{ background: "rgba(104,154,223,0.12)", color: "#689adf" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(104,154,223,0.28)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "rgba(104,154,223,0.12)")}
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

// ─── FinalOverlay ─────────────────────────────────────────────────────────────

function FinalOverlay({
  student, draw, task, onAdvance, onClose, isPastView, autoMailSent,
}: {
  student: Student;
  draw: StudentDraw;
  task: TaskData;
  onAdvance: () => void;
  onClose: () => void;
  isPastView?: boolean;
  autoMailSent?: boolean;
}) {
  const [visible,     setVisible]     = useState(false);
  const [sendingMail, setSendingMail] = useState(false);
  const [mailSent,    setMailSent]    = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  const deadline = task.endDate || (() => {
    const d = new Date(); d.setDate(d.getDate() + 14);
    return d.toLocaleDateString("tr-TR");
  })();

  const handlePrint = () => {
    const boxes = draw.draws.map((dr, i) => `
      <div style="background:#ecf0f1;padding:24px 16px;border-radius:14px;text-align:center;border-bottom:8px solid ${CARD_COLORS[i % 4]};">
        <div style="font-size:10px;color:#7f8c8d;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px">${dr.category}</div>
        ${dr.item.emoji ? `<div style="font-size:28px;margin-bottom:8px">${dr.item.emoji}</div>` : ""}
        <div style="font-size:18px;font-weight:900;color:#2c3e50;line-height:1.2">${dr.item.name}</div>
      </div>`).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Kolaj — ${student.name} ${student.lastName}</title>
      <style>*{box-sizing:border-box}body{font-family:system-ui,sans-serif;padding:40px;background:#fff;margin:0}</style>
    </head><body>
      <div style="text-align:center;margin-bottom:28px;border-bottom:3px solid #eee;padding-bottom:20px">
        <h1 style="font-size:24px;font-weight:900;color:#2c3e50;margin:0 0 4px">${student.name} ${student.lastName} — Kolaj Ödeviniz</h1>
        <span style="font-size:28px;font-weight:900;color:#27ae60;display:block;margin-top:8px">BAŞARILAR...</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px">${boxes}</div>
      <p style="text-align:right;font-size:13px;font-weight:700;color:#7f8c8d;margin:0">Teslim: ${deadline}</p>
    </body></html>`;

    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    document.body.appendChild(iframe);
    iframe.contentDocument?.write(html);
    iframe.contentDocument?.close();
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 1200);
  };

  const handleMail = async () => {
    if (!student.email) return;
    setSendingMail(true);
    try {
      const pdfBase64 = await generateKolajPdf({
        studentName:     student.name,
        studentLastName: student.lastName,
        taskName:        task.name,
        draws:           draw.draws,
        deadline,
      });
      await fetch("/api/send-kolaj", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to:              student.email,
          studentName:     student.name,
          studentLastName: student.lastName,
          taskName:        task.name,
          draws:           draw.draws,
          deadline,
          pdfBase64,
        }),
      });
      setMailSent(true);
    } finally {
      setSendingMail(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{
        background: visible ? "rgba(6,13,26,0.92)" : "rgba(6,13,26,0)",
        transition: "background 0.45s ease", backdropFilter: "blur(6px)",
      }}
    >
      <div className="w-full flex flex-col overflow-hidden"
        style={{
          maxWidth: 860, maxHeight: "90vh",
          background: "white", borderRadius: 24,
          boxShadow: "0 40px 100px rgba(0,0,0,0.65)",
          opacity:   visible ? 1 : 0,
          transform: visible ? "scale(1)" : "scale(0.90)",
          transition: "all 0.45s cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        <div className="px-10 pt-8 pb-5 text-center shrink-0" style={{ borderBottom: "3px solid #ecf0f1" }}>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: "#2c3e50", margin: "0 0 2px", textTransform: "uppercase" }}>
            {student.name} {student.lastName} — Kolaj Ödeviniz
          </h2>
          <span style={{ display: "block", fontSize: 30, fontWeight: 900, color: "#27ae60", marginTop: 6 }}>
            BAŞARILAR...
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-10 py-6">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
            {draw.draws.map((dr, i) => (
              <div key={dr.category} style={{
                background: "#ecf0f1", padding: "24px 14px", borderRadius: 16,
                textAlign: "center", borderBottom: `8px solid ${CARD_COLORS[i % 4]}`,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", minHeight: 170,
              }}>
                <p style={{ fontSize: 10, color: "#7f8c8d", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                  {dr.category}
                </p>
                {dr.item.emoji && <div style={{ fontSize: 28, marginBottom: 8 }}>{dr.item.emoji}</div>}
                <p style={{ fontSize: 17, fontWeight: 800, color: "#2c3e50", lineHeight: 1.2 }}>{dr.item.name}</p>
              </div>
            ))}
          </div>
          <p style={{ textAlign: "right", fontSize: 13, fontWeight: 700, color: "#7f8c8d", margin: 0 }}>
            Teslim: {deadline}
          </p>
        </div>

        <div className="px-10 py-3 flex justify-end gap-3 shrink-0" style={{ borderTop: "1px solid #eee" }}>
          <button onClick={handlePrint}
            className="flex items-center gap-2 px-4 h-9 rounded-xl text-[13px] font-bold cursor-pointer text-white"
            style={{ background: "#e74c3c" }}>
            <FileDown size={14} /> PDF İndir
          </button>
          {student.email && (
            autoMailSent || mailSent ? (
              <div className="flex items-center gap-2 px-4 h-9 rounded-xl text-[13px] font-bold text-white"
                style={{ background: "#27ae60" }}>
                <Check size={12} strokeWidth={3} /> Mail Gönderildi
              </div>
            ) : (
              <button onClick={handleMail} disabled={sendingMail}
                className="flex items-center gap-2 px-4 h-9 rounded-xl text-[13px] font-bold cursor-pointer text-white disabled:opacity-50"
                style={{ background: "#2980b9" }}>
                {sendingMail
                  ? <><div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> Gönderiliyor</>
                  : <><Mail size={14} /> Mail Gönder</>}
              </button>
            )
          )}
        </div>

        <div className="px-10 py-5 flex justify-center gap-6 shrink-0" style={{ borderTop: "1px solid #eee" }}>
          {!isPastView && (
            <button onClick={onAdvance}
              className="flex items-center gap-2 px-12 py-4 rounded-full text-[15px] font-black text-white cursor-pointer active:scale-95 transition-transform"
              style={{ background: "#27ae60", boxShadow: "0 8px 20px rgba(39,174,96,0.35)" }}>
              YENİ SEÇİM <ChevronRight size={18} strokeWidth={2.5} />
            </button>
          )}
          <button onClick={onClose}
            className="px-12 py-4 rounded-full text-[15px] font-bold cursor-pointer"
            style={{ background: "transparent", border: "3px solid #bdc3c7", color: "#7f8c8d" }}>
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── GameScreen ───────────────────────────────────────────────────────────────

export default function GameScreen({
  task, students,
}: {
  task: TaskData;
  students: Student[];
}) {
  const router = useRouter();
  const { hasPermission } = useUser();
  const isAdmin = hasPermission(PERMISSIONS.MANAGEMENT_PANEL);

  const [pool,        setPool]        = useState<CollagePool | null>(null);
  const [poolLoading, setPoolLoading] = useState(true);

  const [phase,             setPhase]             = useState<Phase>("idle");
  const [draws,             setDraws]             = useState<StudentDraw[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // Picking: sol listede dönen highlight ID'si
  const [pickHighlightId, setPickHighlightId] = useState<string | null>(null);
  const [nameVisible,     setNameVisible]     = useState(false);

  // Drawing
  const [slotText,      setSlotText]      = useState("");
  const [currentCatIdx, setCurrentCatIdx] = useState(0);
  const [isShuffling,   setIsShuffling]   = useState(false);

  // Modal
  const [showFinal,        setShowFinal]        = useState(false);
  const [viewingStudentId, setViewingStudentId] = useState<string | null>(null);
  const [autoMailSentFor,  setAutoMailSentFor]  = useState<Set<string>>(new Set());

  // Grup kodu
  const [groupCode, setGroupCode] = useState<string>("");

  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRefs  = useRef<ReturnType<typeof setTimeout>[]>([]);
  const drawsRef     = useRef<StudentDraw[]>([]);
  const autoPickRef  = useRef(false);

  const clearAll = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    timeoutRefs.current.forEach(t => clearTimeout(t));
    timeoutRefs.current = [];
  }, []);

  useEffect(() => () => clearAll(), [clearAll]);

  // drawsRef'i güncel tut (timeout callback'lerinde stale closure'dan kaçınmak için)
  useEffect(() => { drawsRef.current = draws; }, [draws]);

  // Grup kodunu çek
  useEffect(() => {
    if (!task.groupId) return;
    getDoc(doc(db, "groups", task.groupId)).then(snap => {
      if (snap.exists()) setGroupCode(snap.data().code ?? "");
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.groupId]);

  // Mevcut çekiliş sonuçlarını Firestore'dan yükle
  useEffect(() => {
    if (!task.id) return;
    getDoc(doc(db, "lottery_results", task.id)).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data.draws)) setDraws(data.draws as StudentDraw[]);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "lottery_configs", "collage"), snap => {
      setPool(snap.exists() ? (snap.data() as CollagePool) : null);
      setPoolLoading(false);
    });
    return () => unsub();
  }, []);

  const categories = useMemo(
    () => CAT_ORDER.filter(c => pool?.items.some(it => it.category === c) ?? false),
    [pool]
  );

  // Henüz tamamlanmamış öğrenciler
  const remainingStudents = useMemo(
    () => students.filter(s => {
      const d = draws.find(x => x.studentId === s.id);
      return !(d && d.draws.length >= categories.length && categories.length > 0);
    }),
    [students, draws, categories.length]
  );

  const allDone = students.length > 0 && categories.length > 0 && remainingStudents.length === 0;

  const selectedStudent = selectedStudentId ? students.find(s => s.id === selectedStudentId) : null;
  const selectedDraw    = draws.find(d => d.studentId === selectedStudentId);
  const drawnItems      = selectedDraw?.draws ?? [];

  // ─── "Başlat" → sol listede picking animasyonu ────────────────────────────

  const handleBeginPicking = useCallback(() => {
    if (remainingStudents.length === 0) return;
    clearAll();
    setPhase("picking");
    setPickHighlightId(null);
    setNameVisible(false);
    setSelectedStudentId(null);

    // Kazananı şimdi belirle ama gösterme
    const winner = remainingStudents[Math.floor(Math.random() * remainingStudents.length)];

    // Tek öğrenci kaldıysa döngüyü atla, direkt blink
    const cycleMs = remainingStudents.length === 1 ? 0 : 2800;

    const t0 = setTimeout(() => {
      if (remainingStudents.length > 1) {
        // Hızlı döngü — tüm listeyi karıştırıp döngüde göster
        let shuffled: Student[] = [];
        let shuffleIdx = 0;
        const reshuffle = () => {
          shuffled = [...remainingStudents].sort(() => Math.random() - 0.5);
          shuffleIdx = 0;
        };
        reshuffle();
        intervalRef.current = setInterval(() => {
          if (shuffleIdx >= shuffled.length) reshuffle();
          const candidate = shuffled[shuffleIdx++];
          setPickHighlightId(candidate.id);
        }, 90);
      }

      // cycleMs sonra aniden dur — yavaşlama yok
      const t1 = setTimeout(() => {
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }

        // Anında dur ve hemen 3× yanıp sön
        setPickHighlightId(winner.id);

        const BLINK = 110;
        for (let i = 0; i < 3; i++) {
          const toff = setTimeout(() => setPickHighlightId(null),      i * BLINK * 2);
          const ton  = setTimeout(() => setPickHighlightId(winner.id), i * BLINK * 2 + BLINK);
          timeoutRefs.current.push(toff, ton);
        }

        // Blink bitti → isim ortaya çıkar
        const revealT = setTimeout(() => {
          setPickHighlightId(winner.id);
          setSelectedStudentId(winner.id);
          const t2 = setTimeout(() => {
            setNameVisible(true);
            const t3 = setTimeout(() => setPhase("ready"), 800);
            timeoutRefs.current.push(t3);
          }, 300);
          timeoutRefs.current.push(t2);
        }, 3 * BLINK * 2 + 80);
        timeoutRefs.current.push(revealT);
      }, cycleMs);

      timeoutRefs.current.push(t1);
    }, 250);

    timeoutRefs.current.push(t0);
  }, [remainingStudents, clearAll]);

  // YENİ SEÇİM → idle'a geçince otomatik picking başlat
  useEffect(() => {
    if (phase === "idle" && autoPickRef.current && remainingStudents.length > 0) {
      autoPickRef.current = false;
      handleBeginPicking();
    }
  }, [phase, remainingStudents, handleBeginPicking]);

  // ─── "Ödevi Başlat" → tüm kategorileri otomatik çek ─────────────────────

  const handleStartDrawing = useCallback(() => {
    if (!selectedStudent || categories.length === 0 || !pool) return;
    clearAll();
    setPhase("drawing");
    setCurrentCatIdx(0);
    setIsShuffling(false);
    setSlotText("");
    setDraws(prev => prev.filter(d => d.studentId !== selectedStudent.id));

    const picks = categories.map(cat => {
      const items = pool.items.filter(it => it.category === cat);
      return { cat, item: items.length ? items[Math.floor(Math.random() * items.length)] : null };
    });

    let offset = 0;
    picks.forEach(({ cat, item }, idx) => {
      if (!item) return;
      const catItems  = pool.items.filter(it => it.category === cat);
      const pickedItem = item;

      const t1 = setTimeout(() => {
        setCurrentCatIdx(idx);
        setIsShuffling(true);
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(() => {
          setSlotText(catItems[Math.floor(Math.random() * catItems.length)].name);
        }, 60);
      }, offset);

      const t2 = setTimeout(() => {
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        setSlotText(pickedItem.name);
        setIsShuffling(false);
        setDraws(prev => {
          const newDraw: DrawResult = { category: cat, item: pickedItem };
          const existing = prev.find(d => d.studentId === selectedStudent.id);
          if (existing) {
            return prev.map(d =>
              d.studentId === selectedStudent.id
                ? { ...d, draws: [...d.draws, newDraw] } : d
            );
          }
          return [...prev, { studentId: selectedStudent.id, draws: [newDraw] }];
        });
      }, offset + 1800);

      timeoutRefs.current.push(t1, t2);
      offset += 2400;
    });

    const finalT = setTimeout(() => {
      // Tüm picks'i tamamlanmış StudentDraw olarak oluştur
      const completedDraw: StudentDraw = {
        studentId: selectedStudent.id,
        draws: picks.filter(p => p.item).map(p => ({ category: p.cat, item: p.item! })),
      };
      const newAllDraws = [
        ...drawsRef.current.filter(d => d.studentId !== selectedStudent.id),
        completedDraw,
      ];
      setDraws(newAllDraws);
      // Firestore'a kaydet
      setDoc(doc(db, "lottery_results", task.id), { taskId: task.id, draws: newAllDraws });

      // Otomatik mail gönder (PDF ekiyle — client-side üretim)
      if (selectedStudent.email) {
        const deadline = task.endDate || (() => {
          const d = new Date(); d.setDate(d.getDate() + 14);
          return d.toLocaleDateString("tr-TR");
        })();
        const sid = selectedStudent.id;
        generateKolajPdf({
          studentName:     selectedStudent.name,
          studentLastName: selectedStudent.lastName,
          taskName:        task.name,
          draws:           completedDraw.draws,
          deadline,
        }).then(pdfBase64 =>
          fetch("/api/send-kolaj", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to:              selectedStudent.email,
              studentName:     selectedStudent.name,
              studentLastName: selectedStudent.lastName,
              taskName:        task.name,
              draws:           completedDraw.draws,
              deadline,
              pdfBase64,
            }),
          })
        ).then(() => setAutoMailSentFor(prev => new Set([...prev, sid])))
          .catch(console.error);
      }

      setPickHighlightId(null);
      setPhase("done");
      setShowFinal(true);
    }, offset + 2200);
    timeoutRefs.current.push(finalT);
  }, [selectedStudent, categories, pool, clearAll, task.id]);

  // ─── Sonraki öğrenciye geç (YENİ SEÇİM / Devam Et) ──────────────────────

  const handleAdvance = useCallback(() => {
    clearAll();
    autoPickRef.current = true; // idle'a geçince picking otomatik başlasın
    setShowFinal(false);
    setViewingStudentId(null);
    setSelectedStudentId(null);
    setPickHighlightId(null);
    setIsShuffling(false);
    setSlotText("");
    setCurrentCatIdx(0);
    setNameVisible(false);
    setPhase("idle");
  }, [clearAll]);

  const handleClose = useCallback(() => {
    setShowFinal(false);
    setViewingStudentId(null);
  }, []);

  const handleViewResult = useCallback((studentId: string) => {
    setViewingStudentId(studentId);
    setShowFinal(true);
  }, []);

  // ─── Loading ─────────────────────────────────────────────────────────────

  if (poolLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f5f7fb" }}>
        <div className="w-6 h-6 border-2 rounded-full animate-spin"
          style={{ borderColor: "#e2e8f0", borderTopColor: "#689adf" }} />
      </div>
    );
  }

  const isPastView     = !!(viewingStudentId && viewingStudentId !== selectedStudentId);
  const overlayStudent = viewingStudentId ? students.find(s => s.id === viewingStudentId) : selectedStudent;
  const overlayDraw    = draws.find(d => d.studentId === overlayStudent?.id);

  const taskLabel = groupCode || task.classId || task.name;

  // Sol panelde drawing sırasında seçilen öğrenciyi vurgula
  const drawingStudentId = (phase === "drawing" || phase === "done") ? (selectedStudentId ?? null) : null;

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex" style={{ background: "#f5f7fb" }}>

      {/* Sol panel — animasyon burada döner */}
      <StudentPanel
        students={students}
        draws={draws}
        catCount={categories.length}
        taskLabel={taskLabel}
        onViewResult={handleViewResult}
        pickHighlightId={pickHighlightId}
        drawingStudentId={drawingStudentId}
      />

      {/* Sağ alan */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Üst bar */}
        <div className="flex items-center justify-between px-8 py-5 bg-white shrink-0"
          style={{ borderBottom: "1px solid #e8ecf2" }}>
          <button onClick={() => router.push("/dashboard")}
            className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-slate-700 transition-colors">
            <ArrowLeft size={15} />
            <span className="text-[12px] font-semibold">Ana Sayfa</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: "rgba(104,154,223,0.12)" }}>
              <Layers size={14} style={{ color: "#689adf" }} />
            </div>
            <span className="text-[14px] font-bold text-slate-800">{task.name}</span>
          </div>

          {isAdmin ? (
            <button onClick={() => router.push("/dashboard/admin/migrate")}
              className="flex items-center gap-2 px-4 h-8 rounded-xl text-[12px] font-bold cursor-pointer text-slate-400 hover:text-slate-700 transition-colors"
              style={{ border: "1px solid #e2e8f0" }}>
              <Settings size={13} /> Ayarlar
            </button>
          ) : <div className="w-20" />}
        </div>

        {/* İçerik */}
        <div className="flex-1 flex flex-col items-center justify-center px-8 py-10 overflow-y-auto">

          {/* IDLE — kimse belli değil */}
          {phase === "idle" && !allDone && (
            <div className="flex flex-col items-center gap-4 text-center">
              <p className="text-[15px] font-bold tracking-[0.4em] uppercase text-slate-400">
                Çekiliş Hazır
              </p>
              <p className="text-[15px] text-slate-500">
                Sıradaki katılımcıyı belirlemek için başlat'a bas.
              </p>
              <p className="text-[15px] font-semibold text-slate-400">
                {remainingStudents.length} katılımcı kaldı
              </p>
            </div>
          )}

          {/* PICKING — sol listede animasyon dönüyor, sağda bekleniyor */}
          {phase === "picking" && (
            <div className="flex flex-col items-center gap-5 text-center">
              <div className="flex gap-2 items-center">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full" style={{
                    background: "#689adf",
                    opacity: 0.4,
                    animation: `pulse 1s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
              <p className="text-[13px] font-semibold text-slate-400">Katılımcı seçiliyor...</p>
            </div>
          )}

          {/* READY — seçilen isim bounce animasyonuyla ortaya çıkar */}
          {phase === "ready" && selectedStudent && (
            <div className="flex flex-col items-center gap-10 text-center">
              <p className="text-[15px] font-bold tracking-[0.4em] uppercase text-slate-400"
                style={{ opacity: nameVisible ? 1 : 0, transition: "opacity 0.4s ease 0.7s" }}>
                Ödev Alacak Katılımcı
              </p>
              {nameVisible && (
                <div style={{ animation: "popIn 0.28s cubic-bezier(0.22,1,0.36,1) forwards" }}>
                  <h1 style={{
                    fontSize: "clamp(38px, 4.5vw, 60px)",
                    fontWeight: 900, color: "#1e293b",
                    letterSpacing: "-0.03em", lineHeight: 1.1,
                  }}>
                    {selectedStudent.name}
                    <br />
                    <span style={{ color: "#689adf" }}>{selectedStudent.lastName}</span>
                  </h1>
                </div>
              )}
            </div>
          )}

          {/* DRAWING / DONE — slot + düşen kartlar */}
          {(phase === "drawing" || (phase === "done" && !allDone)) && selectedStudent && (
            <div className="w-full flex flex-col items-center">
              <p className="text-[16px] font-black text-slate-700 mb-3" style={{ letterSpacing: "-0.01em" }}>
                {selectedStudent.name} {selectedStudent.lastName}
              </p>

              <p style={{
                fontSize: "clamp(26px, 3vw, 40px)", fontWeight: 900,
                color:      isShuffling ? "#cbd5e1" : "#1e293b",
                letterSpacing: "-0.02em", lineHeight: 1.2, textAlign: "center",
                transition: "color 0.1s", marginBottom: 12, minHeight: 50, padding: "0 32px",
              }}>
                {slotText || "—"}
              </p>

              {categories.length > 0 && (
                <div className="flex items-center gap-2 mb-8">
                  {categories.map((cat, i) => {
                    const drawn   = drawnItems.some(d => d.category === cat);
                    const current = i === currentCatIdx && phase === "drawing";
                    return (
                      <div key={cat} className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 px-4 h-9 rounded-full text-[13px] font-bold"
                          style={{
                            background: drawn ? "#dcfce7" : current ? "#dbeafe" : "#f1f5f9",
                            color:      drawn ? "#16a34a" : current ? "#2563eb" : "#94a3b8",
                            border:     `1px solid ${drawn ? "#bbf7d0" : current ? "#bfdbfe" : "#e2e8f0"}`,
                            transition: "all 0.3s",
                          }}>
                          {drawn && <Check size={9} strokeWidth={3} />}
                          {cat}
                        </div>
                        {i < categories.length - 1 && <div className="w-4 h-px bg-slate-200" />}
                      </div>
                    );
                  })}
                </div>
              )}

              {drawnItems.length > 0 && (
                <div style={{
                  width: "100%", borderTop: "2px dashed #e2e8f0",
                  paddingTop: 28, paddingLeft: 32, paddingRight: 32,
                  display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap",
                }}>
                  {drawnItems.map((dr, i) => (
                    <DroppedCard key={dr.category} draw={dr} index={i} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TÜMÜ TAMAMLANDI */}
          {allDone && (
            <div className="text-center">
              <div className="text-4xl mb-4">🎉</div>
              <p className="text-[18px] font-bold text-slate-700">Tüm katılımcılar tamamlandı!</p>
              <p className="text-[13px] text-slate-400 mt-2">Çekiliş başarıyla sonuçlandı.</p>
            </div>
          )}
        </div>

        {/* Alt buton */}
        <div className="shrink-0 flex justify-center items-center py-6 px-8 bg-white"
          style={{ borderTop: "1px solid #e8ecf2", minHeight: 88 }}>

          {phase === "idle" && !allDone && (
            <button onClick={handleBeginPicking}
              className="px-14 py-4 rounded-full text-[16px] font-black text-white cursor-pointer active:scale-95 transition-transform"
              style={{ background: "linear-gradient(135deg, #205297 0%, #3a7bd5 100%)", boxShadow: "0 8px 28px rgba(58,123,213,0.28)" }}>
              Başlat
            </button>
          )}

          {phase === "ready" && (
            <button onClick={handleStartDrawing}
              className="px-14 py-4 rounded-full text-[16px] font-black text-white cursor-pointer active:scale-95 transition-transform"
              style={{
                opacity:    nameVisible ? 1 : 0,
                transition: "opacity 0.4s ease 0.4s, transform 0.15s",
                background: "linear-gradient(135deg, #276749 0%, #38a169 100%)",
                boxShadow:  "0 8px 28px rgba(56,161,105,0.28)",
              }}>
              Ödevi Başlat
            </button>
          )}

          {phase === "done" && !showFinal && !allDone && (
            <button onClick={handleAdvance}
              className="flex items-center gap-3 px-14 py-4 rounded-full text-[16px] font-black text-white cursor-pointer active:scale-95 transition-transform"
              style={{ background: "linear-gradient(135deg, #205297 0%, #3a7bd5 100%)", boxShadow: "0 8px 28px rgba(58,123,213,0.28)" }}>
              Devam Et <ChevronRight size={18} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>

      {/* Global keyframes */}
      <style>{`
        @keyframes pulse {
          0%,100% { opacity:0.35; transform:scale(1); }
          50%      { opacity:1;    transform:scale(1.4); }
        }
        @keyframes popIn {
          0%   { transform:scale(0.04); opacity:0; }
          20%  { opacity:1; }
          55%  { transform:scale(1.08); }
          75%  { transform:scale(0.97); }
          100% { transform:scale(1);   opacity:1; }
        }
      `}</style>

      {/* Final overlay */}
      {showFinal && overlayStudent && overlayDraw && (
        <FinalOverlay
          student={overlayStudent}
          draw={overlayDraw}
          task={task}
          onAdvance={handleAdvance}
          onClose={handleClose}
          isPastView={isPastView}
          autoMailSent={autoMailSentFor.has(overlayStudent.id)}
        />
      )}
    </div>
  );
}
