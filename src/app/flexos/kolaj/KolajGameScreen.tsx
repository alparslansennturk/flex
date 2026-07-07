"use client";

/**
 * FlexOS · Kolaj Bahçesi çekiliş ekranı — canlıdaki `kolaj/GameScreen.tsx` portu.
 * Mekanik BİREBİR (picking → 4 kategori slot çekilişi → sonuç kartı), ama Firestore
 * client yazımları yerine sunucu route'ları kullanılıyor (`flexos_*` server-only rules
 * kararına uygun — client Firestore listener/yazım YOK):
 *  - Havuz: `GET /api/flexos/collage-pool` (kendi kişisel kopyam, bir kereliğine yüklenir)
 *  - Çekiliş kaydı: `POST /api/flexos/lottery-results` (LotteryResult+Archive+status-flip
 *    hepsi TEK route'ta, server-side — canlıdaki 3 ayrı client `setDoc` çağrısı yerine)
 *  - Mail+PDF+Drive: `POST /api/flexos/lottery-results/mail` (PDF client'ta üretilir,
 *    e-posta adresi PII olduğu için CLIENT'A HİÇ GÖNDERİLMEZ — server-side resolve edilir)
 *
 * Basitleştirme (bilinçli, kapsam gereği): canlıdaki ayrı "Arşive Kaydet"/"Ödevi
 * Tamamla" siyah-overlay animasyon sekansı sadeleştirildi — sonuç aynı (erken kapatma
 * `PATCH /api/flexos/assignments/[id]` ile `status:"published"`), sadece kozmetik geçiş
 * daha basit (toast + yönlendirme).
 */
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Layers, Check, Mail, FileDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { auth } from "@/app/lib/firebase";
import { usePickingEngine } from "./usePickingEngine";
import StudentPanel from "./StudentPanel";
import { generateKolajPdf } from "./generateKolajPdf";
import type { Student, StudentDraw, DrawResult, CollageItem } from "./types";

const CAT_ORDER = ["Gök", "Yer", "Obje 1", "Obje 2"] as const;
const CARD_COLORS = ["#3a7bd5", "#689adf", "#5a9ed5", "#4a84c4"];

async function authHeaders(): Promise<Record<string, string>> {
  const u = auth.currentUser;
  const token = u ? await u.getIdToken() : "";
  return { Authorization: `Bearer ${token}` };
}

function DroppedCard({ draw, index }: { draw: DrawResult; index: number }) {
  const [dropped, setDropped] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDropped(true), 30 + index * 120);
    return () => clearTimeout(t);
  }, [index]);
  const accent = CARD_COLORS[index % 4];
  return (
    <div style={{
      width: 175, minHeight: 192, flexShrink: 0, background: "white",
      border: "1px solid #e8ecf2", borderBottom: `7px solid ${accent}`, borderRadius: 14,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "28px 16px 20px", position: "relative", textAlign: "center",
      boxShadow: "0 4px 20px rgba(0,0,0,0.07)", opacity: dropped ? 1 : 0,
      animation: dropped ? "cardDrop 0.4s cubic-bezier(0.34,1.4,0.64,1) forwards" : "none",
    }}>
      <div style={{
        position: "absolute", top: 18, left: "50%", transform: "translateX(-50%)",
        width: 22, height: 22, borderRadius: "50%", background: accent,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 900, fontSize: 11, color: "white", boxShadow: `0 2px 8px ${accent}55`,
      }}>
        {index + 1}
      </div>
      <p style={{ fontSize: 11, color: accent, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
        {draw.category}
      </p>
      {draw.item.emoji && <div style={{ fontSize: 32, marginBottom: 10, lineHeight: 1 }}>{draw.item.emoji}</div>}
      <p style={{ fontSize: 17, fontWeight: 800, color: "#1e293b", lineHeight: 1.25 }}>{draw.item.name}</p>
    </div>
  );
}

function FinalOverlay({
  student, draw, taskName, assignmentId, groupCode, deadline, onAdvance, onClose, isPastView, autoMailSent, noMoreStudents,
}: {
  student: Student;
  draw: StudentDraw;
  taskName: string;
  assignmentId: string;
  groupCode: string;
  deadline: string;
  onAdvance: () => void;
  onClose: () => void;
  isPastView?: boolean;
  autoMailSent?: boolean;
  noMoreStudents?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [sendingMail, setSendingMail] = useState(false);
  const [mailSent, setMailSent] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), 30); return () => clearTimeout(t); }, []);

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const base64 = await generateKolajPdf({ studentName: student.name, studentLastName: student.lastName, taskName, draws: draw.draws, deadline });
      const link = document.createElement("a");
      link.href = `data:application/pdf;base64,${base64}`;
      link.download = `kolaj-${student.name}-${student.lastName}.pdf`;
      link.click();
    } finally {
      setDownloading(false);
    }
  };

  const handleResendMail = async () => {
    setSendingMail(true);
    try {
      const pdfBase64 = await generateKolajPdf({ studentName: student.name, studentLastName: student.lastName, taskName, draws: draw.draws, deadline });
      const headers = await authHeaders();
      const res = await fetch("/api/flexos/lottery-results/mail", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName: student.name, studentLastName: student.lastName, studentId: student.id,
          assignmentId, groupCode, taskName, draws: draw.draws, deadline, pdfBase64,
        }),
      });
      if (res.ok) { setMailSent(true); toast.success("Mail gönderildi."); }
      else { const data = await res.json().catch(() => ({})) as { error?: string }; toast.error(data.error ?? "Mail gönderilemedi."); }
    } finally {
      setSendingMail(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{
      background: visible ? "rgba(6,13,26,0.92)" : "rgba(6,13,26,0)", transition: "background 0.45s ease", backdropFilter: "blur(6px)",
    }}>
      <div className="w-full flex flex-col overflow-hidden" style={{
        maxWidth: 860, maxHeight: "90vh", background: "white", borderRadius: 24,
        boxShadow: "0 40px 100px rgba(0,0,0,0.65)", opacity: visible ? 1 : 0,
        transform: visible ? "scale(1)" : "scale(0.90)", transition: "all 0.45s cubic-bezier(0.34,1.56,0.64,1)",
      }}>
        <div className="px-10 pt-8 pb-5 text-center shrink-0" style={{ borderBottom: "3px solid #ecf0f1" }}>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: "#2c3e50", margin: "0 0 2px", textTransform: "uppercase" }}>
            {student.name} {student.lastName} — Kolaj Ödeviniz
          </h2>
          <span style={{ display: "block", fontSize: 30, fontWeight: 900, color: "#27ae60", marginTop: 6 }}>BAŞARILAR...</span>
        </div>

        <div className="flex-1 overflow-y-auto px-10 py-6">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
            {draw.draws.map((dr, i) => (
              <div key={dr.category} style={{
                background: "#ecf0f1", padding: "24px 14px", borderRadius: 16, textAlign: "center",
                borderBottom: `8px solid ${CARD_COLORS[i % 4]}`, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", minHeight: 170,
              }}>
                <p style={{ fontSize: 10, color: "#7f8c8d", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>{dr.category}</p>
                {dr.item.emoji && <div style={{ fontSize: 28, marginBottom: 8 }}>{dr.item.emoji}</div>}
                <p style={{ fontSize: 17, fontWeight: 800, color: "#2c3e50", lineHeight: 1.2 }}>{dr.item.name}</p>
              </div>
            ))}
          </div>
          <p style={{ textAlign: "right", fontSize: 13, fontWeight: 700, color: "#7f8c8d", margin: 0 }}>Teslim: {deadline}</p>
        </div>

        <div className="px-10 py-3 flex justify-center gap-3 shrink-0" style={{ borderTop: "1px solid #eee" }}>
          <button onClick={handleDownloadPdf} disabled={downloading}
            className="flex items-center gap-2 px-4 h-9 rounded-xl text-[13px] font-bold cursor-pointer text-white disabled:opacity-60"
            style={{ background: "#e74c3c" }}>
            <FileDown size={14} /> {downloading ? "Hazırlanıyor…" : "PDF İndir"}
          </button>
          {autoMailSent || mailSent ? (
            <div className="flex items-center gap-2 px-4 h-9 rounded-xl text-[13px] font-bold text-white" style={{ background: "#27ae60" }}>
              <Mail size={13} /> Mail Gönderildi
            </div>
          ) : (
            <button onClick={handleResendMail} disabled={sendingMail}
              className="flex items-center gap-2 px-4 h-9 rounded-xl text-[13px] font-bold cursor-pointer text-white disabled:opacity-60"
              style={{ background: "#2980b9" }}>
              <Mail size={14} /> {sendingMail ? "Gönderiliyor…" : "Mail Gönder"}
            </button>
          )}
        </div>

        <div className="px-10 py-5 flex justify-center gap-6 shrink-0" style={{ borderTop: "1px solid #eee" }}>
          {!isPastView && (
            <button onClick={noMoreStudents ? undefined : onAdvance} disabled={noMoreStudents}
              className="flex items-center gap-2 px-12 py-4 rounded-full text-[15px] font-black text-white transition-transform"
              style={{ background: noMoreStudents ? "#94a3b8" : "#27ae60", boxShadow: noMoreStudents ? "none" : "0 8px 20px rgba(39,174,96,0.35)", cursor: noMoreStudents ? "not-allowed" : "pointer", opacity: noMoreStudents ? 0.5 : 1 }}>
              YENİ SEÇİM <ChevronRight size={18} strokeWidth={2.5} />
            </button>
          )}
          <button onClick={onClose} className="px-12 py-4 rounded-full text-[15px] font-bold cursor-pointer" style={{ background: "transparent", border: "3px solid #bdc3c7", color: "#7f8c8d" }}>
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}

export default function KolajGameScreen({
  assignmentId, groupCode, taskName, endDate, students, initialDraws,
}: {
  assignmentId: string;
  groupCode: string;
  taskName: string;
  endDate?: string;
  students: Student[];
  initialDraws: StudentDraw[];
}) {
  const router = useRouter();

  const [pool, setPool] = useState<{ items: CollageItem[] } | null>(null);
  const [poolLoading, setPoolLoading] = useState(true);
  const [draws, setDraws] = useState<StudentDraw[]>(initialDraws);

  const [slotText, setSlotText] = useState("");
  const [currentCatIdx, setCurrentCatIdx] = useState(0);
  const [isShuffling, setIsShuffling] = useState(false);
  const [drawPhase, setDrawPhase] = useState<"idle" | "drawing" | "done">("idle");

  const [showFinal, setShowFinal] = useState(false);
  const [viewingStudentId, setViewingStudentId] = useState<string | null>(null);
  const [autoMailSentFor, setAutoMailSentFor] = useState<Set<string>>(new Set());
  const [finalizing, setFinalizing] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRefs = useRef<ReturnType<typeof setTimeout>[]>([]);
  const drawsRef = useRef<StudentDraw[]>(initialDraws);
  useEffect(() => { drawsRef.current = draws; }, [draws]);

  const clearDrawTimers = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    timeoutRefs.current.forEach((t) => clearTimeout(t));
    timeoutRefs.current = [];
  }, []);
  useEffect(() => () => clearDrawTimers(), [clearDrawTimers]);

  useEffect(() => {
    (async () => {
      const headers = await authHeaders();
      const res = await fetch("/api/flexos/collage-pool", { headers });
      if (res.ok) {
        const data = await res.json() as { pool: { items: CollageItem[] } | null };
        setPool(data.pool);
      }
      setPoolLoading(false);
    })();
  }, []);

  const categories = useMemo(
    () => CAT_ORDER.filter((c) => pool?.items.some((it) => it.category === c) ?? false),
    [pool],
  );

  const remainingStudents = useMemo(
    () => students.filter((s) => {
      const d = draws.find((x) => x.studentId === s.id);
      return !(d && d.draws.length >= categories.length && categories.length > 0);
    }),
    [students, draws, categories.length],
  );

  const allDone = students.length > 0 && categories.length > 0 && remainingStudents.length === 0;

  const { phase, pickHighlightId, selectedStudentId, nameVisible, beginPicking, resetToIdle } = usePickingEngine({
    remainingStudents,
    onStudentReady: () => {},
  });

  const selectedStudent = selectedStudentId ? students.find((s) => s.id === selectedStudentId) : null;
  const selectedDraw = draws.find((d) => d.studentId === selectedStudentId);
  const drawnItems = selectedDraw?.draws ?? [];

  const deadline = endDate ? new Date(endDate).toLocaleDateString("tr-TR") : (() => {
    const d = new Date(); d.setDate(d.getDate() + 14); return d.toLocaleDateString("tr-TR");
  })();

  const handleStartDrawing = useCallback(() => {
    if (!selectedStudent || categories.length === 0 || !pool) return;
    clearDrawTimers();
    setDrawPhase("drawing");
    setCurrentCatIdx(0);
    setIsShuffling(false);
    setSlotText("");
    setDraws((prev) => prev.filter((d) => d.studentId !== selectedStudent.id));

    const picks = categories.map((cat) => {
      const items = pool.items.filter((it) => it.category === cat);
      return { cat, item: items.length ? items[Math.floor(Math.random() * items.length)] : null };
    });

    let offset = 0;
    picks.forEach(({ cat, item }, idx) => {
      if (!item) return;
      const catItems = pool.items.filter((it) => it.category === cat);
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
        setDraws((prev) => {
          const newDraw: DrawResult = { category: cat, item: pickedItem };
          const existing = prev.find((d) => d.studentId === selectedStudent.id);
          if (existing) return prev.map((d) => (d.studentId === selectedStudent.id ? { ...d, draws: [...d.draws, newDraw] } : d));
          return [...prev, { studentId: selectedStudent.id, draws: [newDraw] }];
        });
      }, offset + 1800);

      timeoutRefs.current.push(t1, t2);
      offset += 2400;
    });

    const finalT = setTimeout(async () => {
      const completedDraw: StudentDraw = {
        studentId: selectedStudent.id,
        draws: picks.filter((p) => p.item).map((p) => ({ category: p.cat, item: p.item! })),
      };
      setDraws([...drawsRef.current.filter((d) => d.studentId !== selectedStudent.id), completedDraw]);

      try {
        const headers = await authHeaders();
        await fetch("/api/flexos/lottery-results", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            assignmentId,
            studentId: selectedStudent.id,
            studentName: selectedStudent.name,
            studentLastName: selectedStudent.lastName,
            draws: completedDraw.draws,
          }),
        });
      } catch (err) {
        console.error("[kolaj] çekiliş kaydı gönderilemedi:", err);
        toast.error("Çekiliş sonucu kaydedilemedi — bağlantınızı kontrol edin.");
      }

      // Otomatik mail (PDF client-side üretilir, e-posta server-side resolve edilir).
      (async () => {
        try {
          const pdfBase64 = await generateKolajPdf({
            studentName: selectedStudent.name,
            studentLastName: selectedStudent.lastName,
            taskName,
            draws: completedDraw.draws,
            deadline,
          });
          const headers = await authHeaders();
          const res = await fetch("/api/flexos/lottery-results/mail", {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({
              studentName: selectedStudent.name,
              studentLastName: selectedStudent.lastName,
              studentId: selectedStudent.id,
              assignmentId,
              groupCode,
              taskName,
              draws: completedDraw.draws,
              deadline,
              pdfBase64,
            }),
          });
          if (res.ok) setAutoMailSentFor((prev) => new Set([...prev, selectedStudent.id]));
        } catch (err) {
          console.error("[kolaj] otomatik mail gönderilemedi:", err);
        }
      })();

      setDrawPhase("done");
      setShowFinal(true);
    }, offset + 2200);
    timeoutRefs.current.push(finalT);
  }, [selectedStudent, categories, pool, clearDrawTimers, assignmentId, groupCode, taskName, deadline]);

  const handleAdvance = useCallback(() => {
    clearDrawTimers();
    setShowFinal(false);
    setViewingStudentId(null);
    setIsShuffling(false);
    setSlotText("");
    setCurrentCatIdx(0);
    setDrawPhase("idle");
    resetToIdle(true);
  }, [clearDrawTimers, resetToIdle]);

  const handleClose = useCallback(() => {
    setShowFinal(false);
    setViewingStudentId(null);
  }, []);

  const handleViewResult = useCallback((studentId: string) => {
    setViewingStudentId(studentId);
    setShowFinal(true);
  }, []);

  const handleForceFinish = useCallback(async () => {
    setFinalizing(true);
    try {
      const headers = await authHeaders();
      await fetch(`/api/flexos/assignments/${assignmentId}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "published" }),
      });
      toast.success("Ödev kapatıldı.");
      router.push("/flexos/egitmen-anasayfa");
    } finally {
      setFinalizing(false);
    }
  }, [assignmentId, router]);

  if (poolLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f5f7fb" }}>
        <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: "#e2e8f0", borderTopColor: "#689adf" }} />
      </div>
    );
  }

  const isPastView = !!(viewingStudentId && viewingStudentId !== selectedStudentId);
  const overlayStudent = viewingStudentId ? students.find((s) => s.id === viewingStudentId) : selectedStudent;
  const overlayDraw = draws.find((d) => d.studentId === overlayStudent?.id);
  const drawingStudentId = (drawPhase === "drawing" || drawPhase === "done") ? (selectedStudentId ?? null) : null;

  return (
    <>
      <div className="min-h-screen flex" style={{ background: "#f5f7fb", opacity: finalizing ? 0.4 : 1 }}>
        <StudentPanel
          students={students}
          draws={draws}
          catCount={categories.length}
          taskLabel={groupCode || taskName}
          onViewResult={handleViewResult}
          pickHighlightId={pickHighlightId}
          drawingStudentId={drawingStudentId}
        />

        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between px-8 py-5 bg-white shrink-0" style={{ borderBottom: "1px solid #e8ecf2" }}>
            <button onClick={() => router.push("/flexos/egitmen-anasayfa")} className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-slate-700 transition-colors">
              <ArrowLeft size={17} />
              <span className="text-[15px] font-semibold">Ana Sayfa</span>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: "rgba(104,154,223,0.12)" }}>
                <Layers size={14} style={{ color: "#689adf" }} />
              </div>
              <span className="text-[14px] font-bold text-slate-800">{taskName}</span>
            </div>
            <div className="w-20" />
          </div>

          <div className="flex-1 flex flex-col items-center justify-center px-8 py-10 overflow-y-auto">
            {phase === "idle" && drawPhase === "idle" && !allDone && (
              <div className="flex flex-col items-center gap-4 text-center">
                <p className="text-[15px] font-bold tracking-[0.4em] uppercase text-slate-400">Çekiliş Hazır</p>
                <p className="text-[15px] text-slate-500">Sıradaki katılımcıyı belirlemek için başlat&apos;a bas.</p>
                <p className="text-[15px] font-semibold text-slate-400">{remainingStudents.length} öğrenci katılacak</p>
              </div>
            )}

            {phase === "picking" && (
              <div className="flex flex-col items-center gap-5 text-center">
                <div className="flex gap-2 items-center">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="w-2 h-2 rounded-full" style={{ background: "#689adf", opacity: 0.4, animation: `pulse 1s ease-in-out ${i * 0.2}s infinite` }} />
                  ))}
                </div>
                <p className="text-[13px] font-semibold text-slate-400">Katılımcı seçiliyor...</p>
              </div>
            )}

            {phase === "ready" && selectedStudent && (
              <div className="flex flex-col items-center gap-10 text-center">
                <p className="text-[15px] font-bold tracking-[0.4em] uppercase text-slate-400" style={{ opacity: nameVisible ? 1 : 0, transition: "opacity 0.4s ease 0.7s" }}>
                  Ödev Alacak Katılımcı
                </p>
                {nameVisible && (
                  <div style={{ animation: "popIn 0.28s cubic-bezier(0.22,1,0.36,1) forwards" }}>
                    <h1 style={{ fontSize: "clamp(38px, 4.5vw, 60px)", fontWeight: 900, color: "#1e293b", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
                      {selectedStudent.name} <span style={{ color: "#689adf" }}>{selectedStudent.lastName}</span>
                    </h1>
                  </div>
                )}
              </div>
            )}

            {(drawPhase === "drawing" || (drawPhase === "done" && !allDone)) && selectedStudent && (
              <div className="w-full flex flex-col items-center">
                <p className="text-[16px] font-black text-slate-700 mb-3" style={{ letterSpacing: "-0.01em" }}>
                  {selectedStudent.name} {selectedStudent.lastName}
                </p>
                <p style={{
                  fontSize: "clamp(26px, 3vw, 40px)", fontWeight: 900, color: isShuffling ? "#cbd5e1" : "#1e293b",
                  letterSpacing: "-0.02em", lineHeight: 1.2, textAlign: "center", transition: "color 0.1s", marginBottom: 12, minHeight: 50, padding: "0 32px",
                }}>
                  {slotText || "—"}
                </p>
                {categories.length > 0 && (
                  <div className="flex items-center gap-2 mb-8">
                    {categories.map((cat, i) => {
                      const drawn = drawnItems.some((d) => d.category === cat);
                      const current = i === currentCatIdx && drawPhase === "drawing";
                      return (
                        <div key={cat} className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 px-4 h-9 rounded-full text-[13px] font-bold" style={{
                            background: drawn ? "#dcfce7" : current ? "#dbeafe" : "#f1f5f9",
                            color: drawn ? "#16a34a" : current ? "#2563eb" : "#94a3b8",
                            border: `1px solid ${drawn ? "#bbf7d0" : current ? "#bfdbfe" : "#e2e8f0"}`, transition: "all 0.3s",
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
                  <div style={{ width: "100%", borderTop: "2px dashed #e2e8f0", paddingTop: 28, paddingLeft: 32, paddingRight: 32, display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
                    {drawnItems.map((dr, i) => <DroppedCard key={dr.category} draw={dr} index={i} />)}
                  </div>
                )}
              </div>
            )}

            {allDone && (
              <div className="text-center flex flex-col items-center gap-5" style={{ paddingTop: 48 }}>
                <p className="text-[18px] font-bold text-slate-700">Bu oturumun tüm katılımcıları tamamlandı!</p>
                <p className="text-[13px] text-slate-400">Ödev artık normal not girişi akışına düştü.</p>
                <button onClick={() => router.push("/flexos/egitmen-anasayfa")}
                  className="px-10 py-3.5 rounded-full text-[15px] font-bold text-white cursor-pointer active:scale-95 transition-transform"
                  style={{ background: "linear-gradient(135deg, #205297 0%, #3a7bd5 100%)", boxShadow: "0 6px 20px rgba(58,123,213,0.25)" }}>
                  Ana Sayfaya Dön
                </button>
              </div>
            )}
          </div>

          <div className="shrink-0 flex justify-center items-center py-6 px-8 bg-white" style={{ borderTop: "1px solid #e8ecf2", minHeight: 88 }}>
            {phase === "idle" && drawPhase === "idle" && !allDone && (
              <div className="flex items-center gap-4">
                <button onClick={beginPicking}
                  className="px-14 py-4 rounded-full text-[16px] font-black text-white cursor-pointer active:scale-95 transition-transform"
                  style={{ background: "linear-gradient(135deg, #205297 0%, #3a7bd5 100%)", boxShadow: "0 8px 28px rgba(58,123,213,0.28)" }}>
                  Başlat
                </button>
                {draws.length > 0 && (
                  <button onClick={handleForceFinish} disabled={finalizing}
                    className="px-6 py-4 rounded-full text-[15px] font-black transition-all disabled:opacity-50"
                    style={{ color: "#e53e3e", background: "#fff5f5", border: "2px solid #fed7d7", cursor: finalizing ? "wait" : "pointer" }}>
                    Ödevi Tamamla
                  </button>
                )}
              </div>
            )}

            {phase === "ready" && (
              <button onClick={handleStartDrawing}
                className="px-14 py-4 rounded-full text-[16px] font-black text-white cursor-pointer active:scale-95 transition-transform"
                style={{ opacity: nameVisible ? 1 : 0, transition: "opacity 0.4s ease 0.4s, transform 0.15s", background: "linear-gradient(135deg, #276749 0%, #38a169 100%)", boxShadow: "0 8px 28px rgba(56,161,105,0.28)" }}>
                Ödevi Başlat
              </button>
            )}

            {drawPhase === "done" && !showFinal && !allDone && (
              <button onClick={handleAdvance}
                className="flex items-center gap-3 px-14 py-4 rounded-full text-[16px] font-black text-white cursor-pointer active:scale-95 transition-transform"
                style={{ background: "linear-gradient(135deg, #205297 0%, #3a7bd5 100%)", boxShadow: "0 8px 28px rgba(58,123,213,0.28)" }}>
                Devam Et <ChevronRight size={18} strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>

        <style>{`
          @keyframes pulse { 0%,100% { opacity:0.35; transform:scale(1); } 50% { opacity:1; transform:scale(1.4); } }
          @keyframes cardDrop { 0% { opacity:0; transform: scale(0.88) translateY(-16px); filter: blur(3px); } 100% { opacity:1; transform: scale(1) translateY(0); filter: blur(0); } }
          @keyframes popIn { 0% { transform:scale(0.04); opacity:0; } 20% { opacity:1; } 55% { transform:scale(1.08); } 75% { transform:scale(0.97); } 100% { transform:scale(1); opacity:1; } }
        `}</style>
      </div>

      {showFinal && overlayStudent && overlayDraw && (
        <FinalOverlay
          student={overlayStudent}
          draw={overlayDraw}
          taskName={taskName}
          assignmentId={assignmentId}
          groupCode={groupCode}
          deadline={deadline}
          onAdvance={handleAdvance}
          onClose={handleClose}
          isPastView={isPastView}
          autoMailSent={autoMailSentFor.has(overlayStudent.id)}
          noMoreStudents={remainingStudents.length === 0}
        />
      )}
    </>
  );
}
