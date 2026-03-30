"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail, FileDown, Check, ChevronRight, BookOpen } from "lucide-react";
import {
  doc, getDoc, setDoc, addDoc, collection, serverTimestamp,
  getDocs, query, where, updateDoc,
} from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import type { BookPool, BookItem } from "../pool/poolTypes";
import type { Student, TaskData, StudentDraw } from "../shared/types";
import StudentPanel from "../shared/StudentPanel";
import { usePickingEngine } from "../shared/usePickingEngine";

// ─── Tipler ───────────────────────────────────────────────────────────────────

interface BookStudentDraw {
  studentId: string;
  book: BookItem;
}

// ─── Carousel sabitleri ───────────────────────────────────────────────────────

const CARD_W     = 110;
const CARD_H     = 160;
const CARD_GAP   = 10;
const SLOT_W     = CARD_W + CARD_GAP;
const VISIBLE    = 5;
const VIEWPORT_W = VISIBLE * CARD_W + (VISIBLE - 1) * CARD_GAP; // 590
const TRACK_REPS = 8;
const SPIN_MS    = 4800;

// ─── Easing ───────────────────────────────────────────────────────────────────

function easeInOutExpo(t: number) {
  if (t === 0 || t === 1) return t;
  return t < 0.5
    ? Math.pow(2, 20 * t - 10) / 2
    : (2 - Math.pow(2, -20 * t + 10)) / 2;
}

// ─── SpinnerCard ──────────────────────────────────────────────────────────────

const SPINNER_COLORS = ["#2563eb", "#1d4ed8", "#3b82f6", "#1e40af", "#2563eb", "#1d4ed8"];

function SpinnerCard({ book, colorIdx, blurred = true }: { book: BookItem; colorIdx: number; blurred?: boolean }) {
  const bg = SPINNER_COLORS[colorIdx % SPINNER_COLORS.length];
  return (
    <div style={{
      width: CARD_W, height: CARD_H,
      flexShrink: 0,
      borderRadius: 10,
      background: bg,
      border: "1px solid rgba(255,255,255,0.10)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "12px 8px",
      gap: 6,
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Kitap sırtı şeridi */}
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0,
        width: 7, borderRadius: "10px 0 0 10px", background: "rgba(0,0,0,0.40)",
      }} />
      {/* Parlama */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(145deg, rgba(255,255,255,0.09) 0%, transparent 50%)",
      }} />
      <BookOpen size={22} strokeWidth={1.4} style={{ color: "rgba(255,255,255,0.55)", position: "relative" }} />
      <p style={{
        fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.88)",
        textAlign: "center", lineHeight: 1.3,
        margin: 0, padding: "0 4px", position: "relative",
        filter: blurred ? "blur(2.5px)" : "none",
        transition: "filter 0.5s ease",
      }}>
        {book.title}
      </p>
      {book.author && (
        <p style={{
          fontSize: 7.5, fontWeight: 500, color: "rgba(255,255,255,0.55)",
          textAlign: "center", lineHeight: 1.2, fontStyle: "italic",
          margin: 0, padding: "0 4px", position: "relative",
          filter: blurred ? "blur(2px)" : "none",
          transition: "filter 0.5s ease",
        }}>
          {book.author}
        </p>
      )}
    </div>
  );
}

// ─── BookCarousel — spin + pulse + zoom, tek bileşen ─────────────────────────

function BookCarousel({
  allBooks, winnerBook, onSpinComplete, spinDone, revealed,
}: {
  allBooks: BookItem[];
  winnerBook: BookItem;
  onSpinComplete: () => void;
  spinDone: boolean;
  revealed: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const rafRef   = useRef<number | null>(null);
  const track = useMemo(() => {
    const arr: BookItem[] = [];
    for (let i = 0; i < TRACK_REPS; i++) arr.push(...allBooks);
    return arr;
  }, [allBooks]);

  const targetTrackIdx = useMemo(() => {
    const base = allBooks.findIndex(b => b.id === winnerBook.id);
    return Math.floor(TRACK_REPS / 2) * allBooks.length + (base >= 0 ? base : 0);
  }, [allBooks, winnerBook]);

  const targetX = useMemo(
    () => -(targetTrackIdx * SLOT_W + CARD_W / 2 - VIEWPORT_W / 2),
    [targetTrackIdx],
  );

  // Spin animasyonu — yalnızca mount'ta çalışır
  useEffect(() => {
    const startTime = performance.now();
    const animate = (now: number) => {
      const t     = Math.min((now - startTime) / SPIN_MS, 1);
      const eased = easeInOutExpo(t);
      if (trackRef.current) {
        trackRef.current.style.transform = `translateX(${targetX * eased}px)`;
      }
      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        onSpinComplete();
      }
    };
    const delay = setTimeout(() => { rafRef.current = requestAnimationFrame(animate); }, 150);
    return () => {
      clearTimeout(delay);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // spinDone olunca track'i dondur
  useEffect(() => {
    if (spinDone && trackRef.current) {
      trackRef.current.style.transform = `translateX(${targetX}px)`;
    }
  }, [spinDone, targetX]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{
        width: VIEWPORT_W, height: CARD_H + 16,
        overflow: spinDone ? "visible" : "hidden", position: "relative",
        display: "flex", alignItems: "center",
      }}>
        {/* Kenar maskeleri — sadece spin sırasında */}
        {!spinDone && (
          <>
            <div style={{
              position: "absolute", left: 0, top: 0, bottom: 0, width: 80, zIndex: 2, pointerEvents: "none",
              background: "linear-gradient(to right, #f5f7fb, transparent)",
            }} />
            <div style={{
              position: "absolute", right: 0, top: 0, bottom: 0, width: 80, zIndex: 2, pointerEvents: "none",
              background: "linear-gradient(to left, #f5f7fb, transparent)",
            }} />
            <div style={{
              position: "absolute", left: "50%", transform: "translateX(-50%)",
              top: 8, bottom: 8, width: CARD_W + 6, borderRadius: 12,
              border: "2px dashed #cbd5e1", zIndex: 1, pointerEvents: "none",
            }} />
          </>
        )}

        {/* Track — asla unmount olmaz */}
       {/* Track — asla unmount olmaz */}
        <div ref={trackRef} style={{ display: "flex", gap: CARD_GAP, willChange: "transform", flexShrink: 0 }}>
          {track.map((book, i) => {
            const offset   = i - targetTrackIdx;
            const isCenter = offset === 0;
            const isSide   = spinDone && !isCenter;

            // Hızlı, tok ve AŞAĞI DOĞRU yaylanan animasyon (Pulse beklemesi yok)
            const cardAnimation = spinDone && isCenter
              ? "bkSmoothDrop 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards"
              : "none";

            return (
              <div
                key={`${book.id}-${i}`}
                style={{
                  flexShrink: 0,
                  visibility: spinDone && Math.abs(offset) > 2 ? "hidden" : "visible",
                  opacity: isSide ? 0 : 1,
                  transform: isSide ? "scale(0.8)" : "scale(1)",
                  transition: isSide ? "all 0.5s ease" : "none",
                  animation: cardAnimation,
                  transformOrigin: "top center", // AŞAĞI DOĞRU büyüme için kilit ayar
                  zIndex: isCenter ? 10 : 1,
                }}
              >
                <SpinnerCard
                  book={book}
                  colorIdx={i}
                  blurred={!(spinDone && isCenter)} // Durduğu an netleşsin
                />
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}

// ─── BookResultModal ──────────────────────────────────────────────────────────

function BookResultModal({
  student, book, task, onAdvance, onClose, isPastView, noMoreStudents,
}: {
  student: Student;
  book: BookItem;
  task: TaskData;
  onAdvance: () => void;
  onClose: () => void;
  isPastView?: boolean;
  noMoreStudents?: boolean;
}) {
  const [visible,     setVisible]     = useState(false);
  const [sendingMail, setSendingMail] = useState(false);
  const [mailSent,    setMailSent]    = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  // Otomatik mail — modal açılınca öğrencinin maili varsa gönder
  useEffect(() => {
    if (visible && student.email && !isPastView && !mailSent) {
      handleMail();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const deadline = task.endDate || (() => {
    const d = new Date(); d.setDate(d.getDate() + 14);
    return d.toLocaleDateString("tr-TR");
  })();

  const handlePrint = () => {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Kitap Kapağı — ${student.name} ${student.lastName}</title>
      <style>
        *{box-sizing:border-box}
        body{font-family:system-ui,sans-serif;padding:48px;background:#fff;margin:0;color:#1e293b}
        .header{text-align:center;border-bottom:2px solid #e2e8f0;padding-bottom:24px;margin-bottom:32px;position:relative}
        .header h1{font-size:19px;font-weight:900;text-transform:uppercase;margin:0 0 6px}
        .congrats{font-size:26px;font-weight:900;color:#2563eb}
        .deadline{position:absolute;top:0;right:0;font-size:12px;font-weight:700;color:#94a3b8}
        .body{display:flex;gap:0}
        .left{width:230px;flex-shrink:0;padding-right:28px;border-right:1px solid #e2e8f0}
        .right{flex:1;padding-left:28px}
        .micro{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.12em;color:#94a3b8;margin:0 0 10px}
        .book-title{font-size:20px;font-weight:900;color:#2563eb;margin:0 0 5px;line-height:1.2}
        .author{font-size:13px;font-style:italic;color:#475569;margin:0 0 2px}
        .publisher{font-size:11px;color:#94a3b8;margin:0 0 22px}
        .specs{border-top:1px solid #e2e8f0;padding-top:16px}
        .spec-row{display:flex;justify-content:space-between;font-size:11px;margin-bottom:6px}
        .spec-key{color:#64748b}.spec-val{font-weight:700;color:#1e293b}
        .back-text{font-size:13px;line-height:1.8;color:#334155;text-align:justify;white-space:pre-wrap}
      </style>
    </head><body>
      <div class="header">
        <div class="deadline">Teslim: ${deadline}</div>
        <h1>${student.name} ${student.lastName} — Kitap Kapağı Ödeviniz</h1>
        <div class="congrats">BAŞARILAR...</div>
      </div>
      <div class="body">
        <div class="left">
          <div class="micro">Atanan Kitap</div>
          <div class="book-title">${book.title}</div>
          <div class="author">${book.author}</div>
          <div class="publisher">${book.publisher ?? ""}</div>
          <div class="specs">
            <div class="micro">Teknik Özellikler</div>
            ${book.dimensions ? `<div class="spec-row"><span class="spec-key">Kitap Ölçüsü</span><span class="spec-val">${book.dimensions}</span></div>` : ""}
            ${book.pageCount  ? `<div class="spec-row"><span class="spec-key">Sayfa Sayısı</span><span class="spec-val">${book.pageCount} sf</span></div>` : ""}
            ${book.isbn       ? `<div class="spec-row"><span class="spec-key">ISBN No</span><span class="spec-val">${book.isbn}</span></div>` : ""}
          </div>
        </div>
        <div class="right">
          <div class="micro">Arka Kapak Yazısı</div>
          <div class="back-text">${(book.backCover ?? "").replace(/\n/g, "<br>")}</div>
        </div>
      </div>
    </body></html>`;

    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.srcdoc = html;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1200);
    };
  };

  const handleMail = async () => {
    if (!student.email) return;
    setSendingMail(true);
    try {
      await fetch("/api/send-kitap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: student.email,
          studentName: student.name,
          studentLastName: student.lastName,
          taskName: task.name,
          book, deadline,
        }),
      });
      setMailSent(true);
    } finally {
      setSendingMail(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{
        background: visible ? "rgba(15,23,42,0.75)" : "rgba(15,23,42,0)",
        transition: "background 0.45s ease",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        className="w-full flex flex-col overflow-hidden"
        style={{
          maxWidth: 900, maxHeight: "92vh",
          background: "white", borderRadius: 24,
          boxShadow: "0 40px 120px rgba(0,0,0,0.55)",
          opacity:   visible ? 1 : 0,
          transform: visible ? "scale(1) translateY(0)" : "scale(0.90) translateY(28px)",
          transition: "all 0.45s cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "40px 52px 32px",
          borderBottom: "2px solid #ecf0f1",
          textAlign: "center",
          position: "relative",
          flexShrink: 0,
        }}>
          <div style={{
            position: "absolute", top: 20, right: 32,
            fontSize: 12, fontWeight: 700, color: "#94a3b8",
          }}>
            Teslim: {deadline}
          </div>
          <h2 style={{
            fontSize: 17, fontWeight: 900, color: "#1e293b",
            textTransform: "uppercase", margin: "0 0 6px",
          }}>
            {student.name} {student.lastName} — Kitap Kapağı Ödeviniz
          </h2>
          <span style={{
            display: "block", fontSize: 28, fontWeight: 900, color: "#2563eb",
          }}>
            BAŞARILAR...
          </span>
        </div>

        {/* Body */}
        <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>

          {/* Sol kolon */}
          <div style={{
            width: 270, flexShrink: 0,
            padding: "40px 32px 40px 52px",
            borderRight: "1px solid #e8ecf2",
            overflowY: "auto",
          }}>
            <p style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em", color: "#94a3b8", margin: "0 0 12px" }}>
              Atanan Kitap
            </p>
            <h3 style={{ fontSize: 20, fontWeight: 900, color: "#2563eb", margin: "0 0 5px", lineHeight: 1.2 }}>
              {book.title}
            </h3>
            <p style={{ fontSize: 13, fontStyle: "italic", color: "#475569", margin: "0 0 2px" }}>
              {book.author}
            </p>
            <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 22px" }}>
              {book.publisher}
            </p>

            {(book.genre || book.subGenre) && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 22 }}>
                {book.genre && (
                  <span style={{
                    padding: "4px 11px", borderRadius: 50, fontSize: 11, fontWeight: 700,
                    background: "rgba(37,99,235,0.08)", color: "#2563eb",
                  }}>{book.genre}</span>
                )}
                {book.subGenre && (
                  <span style={{
                    padding: "4px 11px", borderRadius: 50, fontSize: 11, fontWeight: 600,
                    background: "#f1f5f9", color: "#64748b",
                  }}>{book.subGenre}</span>
                )}
              </div>
            )}

            <div style={{ borderTop: "1px solid #e8ecf2", paddingTop: 20 }}>
              <p style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em", color: "#94a3b8", margin: "0 0 14px" }}>
                Teknik Özellikler
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {book.dimensions && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: "#64748b" }}>Kitap Ölçüsü</span>
                    <span style={{ fontWeight: 700, color: "#1e293b" }}>{book.dimensions}</span>
                  </div>
                )}
                {book.pageCount && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: "#64748b" }}>Sayfa Sayısı</span>
                    <span style={{ fontWeight: 700, color: "#1e293b" }}>{book.pageCount} sf</span>
                  </div>
                )}
                {book.isbn && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: "#64748b" }}>ISBN No</span>
                    <span style={{ fontWeight: 700, color: "#1e293b", fontSize: 11 }}>{book.isbn}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sağ kolon — arka kapak */}
          <div style={{ flex: 1, overflowY: "auto", padding: "40px 52px 40px 32px" }}>
            <p style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em", color: "#94a3b8", margin: "0 0 16px" }}>
              Arka Kapak Yazısı
            </p>
            <p style={{
              fontSize: 14, lineHeight: 1.85, color: "#334155",
              whiteSpace: "pre-wrap", textAlign: "justify", margin: 0,
            }}>
              {book.backCover || "—"}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "20px 52px",
          borderTop: "1px solid #eee",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handlePrint} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "0 16px", height: 38, borderRadius: 10,
              background: "#e74c3c", color: "white",
              fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none",
            }}>
              <FileDown size={13} /> PDF İndir
            </button>
            {student.email && (
              mailSent ? (
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "0 16px", height: 38, borderRadius: 10,
                  background: "#27ae60", color: "white", fontSize: 13, fontWeight: 700,
                }}>
                  <Check size={12} strokeWidth={3} /> Mail Gönderildi
                </div>
              ) : (
                <button onClick={handleMail} disabled={sendingMail} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "0 16px", height: 38, borderRadius: 10,
                  background: "#2980b9", color: "white",
                  fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none",
                  opacity: sendingMail ? 0.55 : 1,
                }}>
                  {sendingMail ? (
                    <><div style={{
                      width: 12, height: 12, borderRadius: "50%",
                      border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white",
                      animation: "bkSpin 0.8s linear infinite",
                    }} /> Gönderiliyor</>
                  ) : (
                    <><Mail size={13} /> Mail Gönder</>
                  )}
                </button>
              )
            )}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            {!isPastView && (
              <button
                onClick={noMoreStudents ? undefined : onAdvance}
                disabled={noMoreStudents}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "0 26px", height: 42, borderRadius: 50,
                  background: noMoreStudents ? "#94a3b8" : "#2563eb",
                  color: "white",
                  fontSize: 14, fontWeight: 900,
                  cursor: noMoreStudents ? "not-allowed" : "pointer",
                  border: "none",
                  boxShadow: noMoreStudents ? "none" : "0 6px 18px rgba(37,99,235,0.30)",
                  opacity: noMoreStudents ? 0.5 : 1,
                }}>
                YENİ SEÇİM <ChevronRight size={15} strokeWidth={2.5} />
              </button>
            )}
            <button onClick={onClose} style={{
              padding: "0 22px", height: 42, borderRadius: 50,
              background: "transparent", border: "2px solid #dde2e8",
              color: "#94a3b8", fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}>
              Kapat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Ana bileşen ──────────────────────────────────────────────────────────────

export default function BookGameScreen({ task, students }: { task: TaskData; students: Student[] }) {
  const router = useRouter();

  const [pool,        setPool]        = useState<BookPool | null>(null);
  const [poolLoading, setPoolLoading] = useState(true);

  const [bookDraws,        setBookDraws]        = useState<BookStudentDraw[]>([]);
  const [currentBook,      setCurrentBook]      = useState<BookItem | null>(null);
  const [showCarousel,     setShowCarousel]     = useState(false);
  const [spinDone,         setSpinDone]         = useState(false);
  const [winnerRevealed,   setWinnerRevealed]   = useState(false);
  const [showModal,        setShowModal]        = useState(false);
  const [drawingStudentId, setDrawingStudentId] = useState<string | null>(null);
  const [previewDraw,      setPreviewDraw]      = useState<BookStudentDraw | null>(null);

  const [archived,          setArchived]          = useState(false);
  const [archiving,         setArchiving]         = useState(false);
  const [finalizing,        setFinalizing]        = useState(false);
  const [finalized,         setFinalized]         = useState(false);
  const [confirmFinish,     setConfirmFinish]     = useState(false);
  const [groupStudentCount, setGroupStudentCount] = useState(0);

  const modalTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getDoc(doc(db, "lottery_configs", "book")).then(snap => {
      if (snap.exists()) setPool(snap.data() as BookPool);
      setPoolLoading(false);
    });
  }, []);

  // Gruptaki toplam öğrenci sayısını yükle (otomatik tamamlama kontrolü için)
  useEffect(() => {
    if (!task.groupId) return;
    getDocs(query(collection(db, "students"), where("groupId", "==", task.groupId)))
      .then(snap => setGroupStudentCount(snap.size));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.groupId]);

  useEffect(() => {
    if (!pool) return;
    getDoc(doc(db, "lottery_results", task.id)).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.draws) setBookDraws(data.draws);
      }
    });
  }, [pool, task.id]);

  useEffect(() => () => {
    if (modalTimerRef.current)  clearTimeout(modalTimerRef.current);
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
  }, []);

  const prevShowModalRef = useRef(false);

  const drawnStudentIds   = bookDraws.map(d => d.studentId);
  const remainingStudents = students.filter(s => !drawnStudentIds.includes(s.id));
  const allDone      = remainingStudents.length === 0 && students.length > 0;
  // Gruptaki TÜM öğrenciler çekilişe katıldıysa true
  const allGroupDone = groupStudentCount > 0 && bookDraws.length >= groupStudentCount;

  const usedBookIds    = bookDraws.map(d => d.book.id);
  const availableBooks = (pool?.items ?? []).filter(b => !usedBookIds.includes(b.id));

  const { phase, pickHighlightId, selectedStudentId, nameVisible, beginPicking, resetToIdle } =
    usePickingEngine({
      remainingStudents,
      onStudentReady: (student) => setDrawingStudentId(student.id),
    });

  const selectedStudent = selectedStudentId
    ? students.find(s => s.id === selectedStudentId) ?? null
    : null;

  const resetGameState = useCallback(() => {
    setCurrentBook(null);
    setShowCarousel(false);
    setSpinDone(false);
    setWinnerRevealed(false);
    setShowModal(false);
    setDrawingStudentId(null);
    if (modalTimerRef.current)  clearTimeout(modalTimerRef.current);
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
  }, []);

  const handleSpin = useCallback(() => {
    if (!selectedStudent || availableBooks.length === 0) return;
    const book = availableBooks[Math.floor(Math.random() * availableBooks.length)];
    setCurrentBook(book);
    setShowCarousel(true);
    setSpinDone(false);
    setWinnerRevealed(false);
  }, [selectedStudent, availableBooks]);

  const handleSpinComplete = useCallback(() => {
    if (!selectedStudent || !currentBook) return;
    // Çift kayıt güvencesi: aynı kitap daha önce atanmışsa kaydetme
    if (bookDraws.some(d => d.book.id === currentBook.id)) return;
    setSpinDone(true);
    const newDraw: BookStudentDraw = { studentId: selectedStudent.id, book: currentBook };
    const updated = [...bookDraws, newDraw];
    setBookDraws(updated);
    setDoc(doc(db, "lottery_results", task.id), {
      draws: updated, groupId: task.groupId ?? "", lastUpdated: serverTimestamp(),
    });
    // 3 pulse (~1.1s) sonra kitabı büyüt
    revealTimerRef.current = setTimeout(() => setWinnerRevealed(true), 1150);
    // 3sn sonra modal
    modalTimerRef.current = setTimeout(() => setShowModal(true), 3000);
  }, [selectedStudent, currentBook, bookDraws, task]);

  // Kapat → sadece sıfırla, kullanıcı "Başlat"a basar
  const handleClose = useCallback(() => {
    resetGameState();
    resetToIdle(false);
  }, [resetGameState, resetToIdle]);

  // Yeni Seçim → sıfırla + otomatik çekiliş başlat
  const handleNewPick = useCallback(() => {
    resetGameState();
    resetToIdle(true);
  }, [resetGameState, resetToIdle]);

  const studentDraws: StudentDraw[] = bookDraws.map(d => ({
    studentId: d.studentId,
    draws: [{ category: "Kitap", item: { name: d.book.title, emoji: "📚" } }],
  }));

  // Sadece arşive yedekle — task status'a dokunmaz, 3 sn sonra /dashboard'a döner
  const handleArchive = useCallback(async () => {
    if (!task.groupId || archiving || archived) return;
    setArchiving(true);
    try {
      const existing = await getDocs(
        query(collection(db, "assignment_archive"), where("taskId", "==", task.id))
      );
      if (existing.empty) {
        await addDoc(collection(db, "assignment_archive"), {
          groupId: task.groupId, taskId: task.id,
          taskName: task.name, type: "kitap",
          completedAt: serverTimestamp(),
          draws: studentDraws,
          students: students.map(s => ({ id: s.id, name: s.name, lastName: s.lastName })),
        });
      }
      setArchived(true);
      setTimeout(() => router.push("/dashboard"), 3000);
    } finally {
      setArchiving(false);
    }
  }, [task, archiving, archived, students, studentDraws, router]);

  // Ödevi gerçekten kapat: status → "completed", not girişine yönlendir
  const handleFinalizeTask = useCallback(async () => {
    if (finalizing || finalized) return;
    setFinalizing(true);
    try {
      if (!archived && task.groupId) {
        const existing = await getDocs(
          query(collection(db, "assignment_archive"), where("taskId", "==", task.id))
        );
        if (existing.empty) {
          await addDoc(collection(db, "assignment_archive"), {
            groupId: task.groupId, taskId: task.id,
            taskName: task.name, type: "kitap",
            completedAt: serverTimestamp(),
            draws: studentDraws,
            students: students.map(s => ({ id: s.id, name: s.name, lastName: s.lastName })),
          });
        }
      }
      await updateDoc(doc(db, "tasks", task.id), { status: "completed", isActive: true });
      setFinalized(true);
      setTimeout(() => router.push("/dashboard"), 2000);
    } finally {
      setFinalizing(false);
    }
  }, [task, archived, students, studentDraws, finalizing, finalized, router]);

  // Otomatik tamamlama: SADECE son öğrencinin modal'ı kapandıktan sonra tetikle
  useEffect(() => {
    if (prevShowModalRef.current && !showModal && allGroupDone && !finalized && !finalizing) {
      handleFinalizeTask();
    }
    prevShowModalRef.current = showModal;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showModal, allGroupDone, finalized, finalizing]);

  if (poolLoading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#f5f7fb" }}>
      <div className="w-6 h-6 border-2 rounded-full animate-spin"
        style={{ borderColor: "#e2e8f0", borderTopColor: "#2563eb" }} />
    </div>
  );

  if (!pool || pool.items.length === 0) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: "#f5f7fb" }}>
      <p style={{ color: "#94a3b8", fontSize: 14 }}>Kitap havuzu boş veya yüklenmemiş.</p>
      <button onClick={() => router.push("/dashboard")}
        style={{ color: "#2563eb", fontSize: 13, fontWeight: 700, cursor: "pointer", background: "none", border: "none" }}>
        Ana sayfaya dön
      </button>
    </div>
  );

  const overlayActive = finalizing || finalized || archiving || archived;

  return (
    <>
    <div style={{ display: "flex", height: "100vh", background: "#f5f7fb", overflow: "hidden", opacity: overlayActive ? 0 : 1 }}>

      {/* Sol: Öğrenci paneli */}
      <StudentPanel
        students={students}
        draws={studentDraws}
        catCount={1}
        taskLabel={task.name}
        onViewResult={id => {
          const d = bookDraws.find(x => x.studentId === id);
          if (d) setPreviewDraw(d);
        }}
        pickHighlightId={pickHighlightId}
        drawingStudentId={drawingStudentId}
        accentColor="#2563eb"
      />

      {/* Sağ: Oyun alanı */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative" }}>

        {/* Üst bar */}
        <div style={{
          padding: "18px 32px",
          borderBottom: "1px solid #e8ecf2",
          background: "white",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <button
            onClick={() => router.push("/dashboard")}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              color: "#94a3b8", background: "none", border: "none",
              cursor: "pointer", fontSize: 15, fontWeight: 600,
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "#475569")}
            onMouseLeave={e => (e.currentTarget.style.color = "#94a3b8")}
          >
            <ArrowLeft size={17} />
            Ana Sayfa
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>📚</span>
            <div>
              <p style={{ color: "#1e293b", fontWeight: 800, fontSize: 15, margin: 0 }}>
                Kitap Seçimi
              </p>
              <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>
                {bookDraws.length} / {students.length} tamamlandı
              </p>
            </div>
          </div>

          <div style={{ width: 120 }} />
        </div>

        {/* Ana alan */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center",
          paddingTop: 64, paddingBottom: 32,
          paddingLeft: 48, paddingRight: 48,
          gap: 16, overflowY: "auto",
        }}>

          {/* IDLE */}
          {phase === "idle" && !allDone && (
            <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <p style={{
                fontSize: 11, fontWeight: 700, letterSpacing: "0.45em",
                textTransform: "uppercase", color: "#94a3b8", margin: 0,
              }}>
                Çekiliş Hazır
              </p>
              <p style={{ fontSize: 15, color: "#64748b", margin: 0 }}>
                Sıradaki katılımcıyı belirlemek için başlat&apos;a bas.
              </p>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#64748b", margin: 0 }}>
                {remainingStudents.length} öğrenci katılacak
              </p>
            </div>
          )}

          {/* PICKING */}
          {phase === "picking" && (
            <div style={{ textAlign: "center" }}>
              <p style={{
                fontSize: 11, fontWeight: 700, letterSpacing: "0.45em",
                textTransform: "uppercase", color: "#94a3b8", marginBottom: 18,
              }}>
                Katılımcı Seçiliyor
              </p>
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 9, height: 9, borderRadius: "50%", background: "#2563eb",
                    animation: `bkPulse 1s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}

          {/* READY */}
          {phase === "ready" && selectedStudentId && (
            <>
             {/* Öğrenci ismi */}
              <div style={{ textAlign: "center", marginTop: 32, marginBottom: 32 }}> {/* 60 yerine 32 yaptık */}
                <p style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: "0.45em",
                  textTransform: "uppercase", color: "#94a3b8",
                  margin: "0 0 14px",
                }}>
                  Kitap Alacak Katılımcı
                </p>
                <p style={{
                  fontSize:      44,
                  fontWeight:    900,
                  letterSpacing: "-0.025em",
                  opacity:       nameVisible ? 1 : 0,
                  animation:     nameVisible ? "nameBounce 0.75s ease forwards" : "none",
                  margin:        0,
                }}>
                  <span style={{ color: "#1e293b" }}>{selectedStudent?.name} </span>
                  <span style={{ color: "#2563eb" }}>{selectedStudent?.lastName}</span>
                </p>
                {spinDone && (
                  <p style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: "0.45em",
                    textTransform: "uppercase", color: "#94a3b8",
                    margin: "14px 0 0", animation: "bkFadeIn 0.4s ease",
                  }}>
                    Kitap Belirlendi
                  </p>
                )}
              </div>

              {/* Carousel — spin + pulse + zoom, hiç unmount olmaz */}
              {showCarousel && currentBook && (
                <BookCarousel
                  allBooks={pool?.items ?? []}
                  winnerBook={currentBook}
                  onSpinComplete={handleSpinComplete}
                  spinDone={spinDone}
                  revealed={winnerRevealed}
                />
              )}
            </>
          )}

          {/* DONE — sadece idle fazında göster, carousel/spin sırasında gizle */}
          {allDone && phase === "idle" && (
            <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginTop: 48 }}>
              <p style={{ color: "#1e293b", fontSize: 20, fontWeight: 900, margin: 0 }}>
                Bu oturumun tüm katılımcıları tamamlandı!
              </p>
              <p style={{ color: "#64748b", fontSize: 13 }}>
                Sonuçları arşive kaydedin veya ödevi tamamen kapatın.
              </p>

              {/* Arşive Kaydet */}
              <button
                onClick={handleArchive}
                disabled={archiving || archived}
                style={{
                  marginTop: 8, padding: "13px 40px", borderRadius: 50,
                  background: "#2563eb", color: "white",
                  fontWeight: 700, fontSize: 15, border: "none",
                  cursor: archiving || archived ? "not-allowed" : "pointer",
                  boxShadow: "0 6px 20px rgba(37,99,235,0.25)",
                  opacity: archiving ? 0.6 : 1,
                }}
              >
                {archiving ? "Kaydediliyor..." : archived ? "Arşive Kaydedildi ✓" : "Arşive Kaydet"}
              </button>

              {/* Ödevi Tamamla */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginTop: 4 }}>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#94a3b8", margin: 0 }}>veya</p>
                {!confirmFinish ? (
                  <button
                    onClick={() => setConfirmFinish(true)}
                    style={{ color: "#e53e3e", background: "none", border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
                  >
                    Ödevi Tamamla ve Ana Sayfaya Git →
                  </button>
                ) : (
                  <div style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                    padding: "14px 20px", borderRadius: 16,
                    background: "#fff5f5", border: "1px solid #fed7d7",
                  }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#c53030", margin: 0 }}>
                      Ödev kapatılsın ve ana sayfaya dönülsün mü?
                    </p>
                    <p style={{ fontSize: 11, color: "#e53e3e", margin: 0 }}>Eksik öğrenciler olsa bile ödev artık aktif olmayacak.</p>
                    <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                      <button
                        onClick={() => { setConfirmFinish(false); handleFinalizeTask(); }}
                        style={{ padding: "8px 20px", borderRadius: 10, background: "#e53e3e", color: "white", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}
                      >
                        Evet, Tamamla
                      </button>
                      <button
                        onClick={() => setConfirmFinish(false)}
                        style={{ padding: "8px 20px", borderRadius: 10, background: "#f1f5f9", color: "#64748b", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}
                      >
                        İptal
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Alt buton */}
        <div style={{
          padding: "20px 40px",
          borderTop: "1px solid #e8ecf2",
          background: "white",
          display: "flex", justifyContent: "center", alignItems: "center",
          minHeight: 88,
        }}>
          {phase === "idle" && !allDone && (
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <button onClick={beginPicking} style={{
                padding: "16px 60px", borderRadius: 50,
                background: "#2563eb", color: "white",
                fontWeight: 900, fontSize: 16, border: "none", cursor: "pointer",
                boxShadow: "0 8px 24px rgba(37,99,235,0.28)",
              }}>
                Başlat
              </button>

              {!confirmFinish ? (
                <button
                  onClick={() => setConfirmFinish(true)}
                  disabled={bookDraws.length === 0}
                  style={{
                    padding: "16px 24px", borderRadius: 50,
                    color:      bookDraws.length === 0 ? "#cbd5e1" : "#e53e3e",
                    background: bookDraws.length === 0 ? "#f8fafc" : "#fff5f5",
                    border:     `2px solid ${bookDraws.length === 0 ? "#e2e8f0" : "#fed7d7"}`,
                    fontSize: 15, fontWeight: 900,
                    cursor: bookDraws.length === 0 ? "not-allowed" : "pointer",
                  }}
                >
                  Ödevi Tamamla
                </button>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>Eksik öğrencilerle ödev kapatılsın mı?</span>
                  <button
                    onClick={() => { setConfirmFinish(false); handleFinalizeTask(); }}
                    style={{ padding: "8px 16px", borderRadius: 10, background: "#e53e3e", color: "white", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}
                  >
                    Evet, Tamamla
                  </button>
                  <button
                    onClick={() => setConfirmFinish(false)}
                    style={{ padding: "8px 16px", borderRadius: 10, background: "#f1f5f9", color: "#64748b", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}
                  >
                    İptal
                  </button>
                </div>
              )}
            </div>
          )}

          {phase === "ready" && !showCarousel && nameVisible && (
            <button onClick={handleSpin} style={{
              padding: "16px 60px", borderRadius: 50,
              background: "#2563eb", color: "white",
              fontWeight: 900, fontSize: 18, border: "none", cursor: "pointer",
              boxShadow: "0 8px 24px rgba(37,99,235,0.28)",
              letterSpacing: "0.06em",
              animation: "bkFadeIn 0.35s ease",
            }}>
              ÇEVİR
            </button>
          )}
        </div>

       <style>{`
          @keyframes bkPulse    { 0%,100%{opacity:0.3;transform:scale(1)} 50%{opacity:1;transform:scale(1.6)} }
          @keyframes bkSpin     { to{transform:rotate(360deg)} }
          @keyframes bkFadeIn   { from{opacity:0} to{opacity:1} }
          @keyframes nameBounce {
            0%   { transform:scale(0.05); opacity:0; }
            45%  { transform:scale(1.22); opacity:1; }
            65%  { transform:scale(0.90); }
            82%  { transform:scale(1.07); }
            100% { transform:scale(1.00); }
          }
          @keyframes bkSmoothDrop {
            0%   { transform: scale(1) translateY(0); }
            40%  { transform: scale(1.95) translateY(12px); } /* Hafifçe isme binmeden aşağı büyüme */
            60%  { transform: scale(1.75) translateY(6px); }  /* Pürüzsüz geri yaylanma */
            80%  { transform: scale(1.85) translateY(10px); } /* Hafif ikinci sekme */
            100% { transform: scale(1.80) translateY(8px); }  /* Tok bir şekilde yerine oturma */
          }
        `}</style>
      </div>

    </div>

    {/* Sonuç modal */}
    {showModal && selectedStudent && currentBook && (
      <BookResultModal
        student={selectedStudent}
        book={currentBook}
        task={task}
        onAdvance={handleNewPick}
        onClose={handleClose}
        noMoreStudents={remainingStudents.length === 0}
      />
    )}

    {/* Geçmiş önizleme */}
    {previewDraw && (
      <BookResultModal
        student={students.find(s => s.id === previewDraw.studentId)!}
        book={previewDraw.book}
        task={task}
        onAdvance={() => {}}
        onClose={() => setPreviewDraw(null)}
        isPastView
      />
    )}

    {/* ARŞİV OVERLAY */}
    {(archiving || archived) && !finalizing && !finalized && (
      <div style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "#000",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 16,
      }}>
        {archiving && !archived ? (
          <div style={{
            width: 48, height: 48, borderRadius: "50%",
            border: "3px solid rgba(255,255,255,0.15)", borderTopColor: "#60a5fa",
            animation: "bkSpin 0.8s linear infinite",
          }} />
        ) : (
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "rgba(56,161,105,0.22)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 32,
          }}>✓</div>
        )}
        <div style={{ textAlign: "center", marginTop: 32 }}>
          <p style={{ color: "#fff", fontSize: 20, fontWeight: 800, margin: 0 }}>
            {archiving && !archived ? "Kaydediliyor..." : "İşlem Başarılı!"}
          </p>
          {archived && (
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, marginTop: 8 }}>
              Ana sayfaya yönlendiriliyorsunuz...
            </p>
          )}
        </div>
      </div>
    )}

    {/* FİNALİZE OVERLAY */}
    {(finalizing || finalized) && (
      <div style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "#000",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 16,
      }}>
        {finalizing && !finalized ? (
          <div style={{
            width: 48, height: 48, borderRadius: "50%",
            border: "3px solid rgba(255,255,255,0.15)", borderTopColor: "#60a5fa",
            animation: "bkSpin 0.8s linear infinite",
          }} />
        ) : (
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "rgba(56,161,105,0.22)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 32,
          }}>✓</div>
        )}
        <div style={{ textAlign: "center", marginTop: 32 }}>
          <p style={{ color: "#fff", fontSize: 20, fontWeight: 800, margin: 0 }}>
            {finalizing && !finalized ? "Tamamlanıyor..." : "Ödev Tamamlandı!"}
          </p>
          {finalized && (
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, marginTop: 8 }}>
              Ana sayfaya yönlendiriliyorsunuz...
            </p>
          )}
        </div>
      </div>
    )}
    </>
  );
}
