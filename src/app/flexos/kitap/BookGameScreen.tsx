"use client";

/**
 * FlexOS · Kitap Dünyası çekiliş ekranı — canlıdaki `kitap/BookGameScreen.tsx` portu.
 * Mekanik BİREBİR (picking → tek "deste" carousel çekilişi → sonuç kartı), ama
 * `KolajGameScreen.tsx` ile aynı server-route deseni (client Firestore yazımı YOK):
 *  - Havuz: `GET /api/flexos/book-pool` (kendi kişisel kopyam)
 *  - Çekiliş kaydı: `POST /api/flexos/lottery-results` (kategori sabit "Kitap", tek draw)
 *  - Mail+PDF+Drive: `POST /api/flexos/lottery-results/mail` (`type:"kitap"`)
 *
 * Basitleştirme (Kolaj portundaki 2026-07-07 kararıyla AYNI, kapsam gereği): canlıdaki
 * ayrı "Arşive Kaydet"/"Ödevi Tamamla" siyah-overlay animasyon sekansı sadeleştirildi
 * (toast + yönlendirme) — sonuç aynı (`PATCH /api/flexos/assignments/[id]` ile
 * `status:"published"`).
 */
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, Check, Mail, FileDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { auth } from "@/app/lib/firebase";
import { usePickingEngine } from "./usePickingEngine";
import StudentPanel from "./StudentPanel";
import BookCarousel, { useCarouselSize } from "./BookCarousel";
import { generateKitapPdf } from "./generateKitapPdf";
import type { Student, StudentDraw, BookItem } from "./types";

const ACCENT = "#60a5fa";

async function authHeaders(): Promise<Record<string, string>> {
  const u = auth.currentUser;
  const token = u ? await u.getIdToken() : "";
  return { Authorization: `Bearer ${token}` };
}

function cn(...inputs: (string | false | null | undefined)[]) {
  return inputs.filter(Boolean).join(" ");
}

function BookResultModal({
  student, book, taskName, assignmentId, groupCode, deadline, onAdvance, onClose, isPastView, autoMailSent, noMoreStudents,
}: {
  student: Student;
  book: BookItem;
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

  // Kağıt gramajı: öğrenci/kitap başına sabit (%65 → 60gr, %35 → 70gr) — canlıyla aynı kozmetik hesap.
  const paperWeight = useMemo(() => (Math.random() < 0.65 ? 60 : 70), [student.id, book.id]);
  const paperThickness = paperWeight === 60 ? "0.08 mm" : "0.09 mm";

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const base64 = await generateKitapPdf({ book, deadline, paperWeight, paperThickness });
      const link = document.createElement("a");
      link.href = `data:application/pdf;base64,${base64}`;
      link.download = `kitap-${student.name}-${student.lastName}.pdf`;
      link.click();
    } finally {
      setDownloading(false);
    }
  };

  const handleResendMail = async () => {
    setSendingMail(true);
    try {
      const pdfBase64 = await generateKitapPdf({ book, deadline, paperWeight, paperThickness });
      const headers = await authHeaders();
      const res = await fetch("/api/flexos/lottery-results/mail", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "kitap",
          studentName: student.name, studentLastName: student.lastName, studentId: student.id,
          assignmentId, groupCode, taskName, draws: [{ category: "Kitap", item: book }], deadline, pdfBase64,
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
      background: visible ? "rgba(15,23,42,0.75)" : "rgba(15,23,42,0)", transition: "background 0.45s ease", backdropFilter: "blur(8px)",
    }}>
      <div className="w-full flex flex-col overflow-hidden" style={{
        maxWidth: 900, maxHeight: "92vh", background: "white", borderRadius: 24,
        boxShadow: "0 40px 120px rgba(0,0,0,0.55)", opacity: visible ? 1 : 0,
        transform: visible ? "scale(1) translateY(0)" : "scale(0.90) translateY(28px)", transition: "all 0.45s cubic-bezier(0.34,1.56,0.64,1)",
      }}>
        <div className="px-10 pt-8 pb-5 text-center shrink-0" style={{ borderBottom: "2px solid #ecf0f1", position: "relative" }}>
          <div style={{ position: "absolute", top: 20, right: 32, fontSize: 12, fontWeight: 700, color: "#94a3b8" }}>
            Teslim: {deadline}
          </div>
          <h2 style={{ fontSize: 17, fontWeight: 900, color: "#1e293b", textTransform: "uppercase", margin: "0 0 6px" }}>
            {student.name} {student.lastName} — Kitap Kapağı Ödeviniz
          </h2>
          <span style={{ display: "block", fontSize: 28, fontWeight: 900, color: "#2563eb" }}>BAŞARILAR...</span>
        </div>

        <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
          <div style={{ width: 270, flexShrink: 0, padding: "40px 32px 40px 52px", borderRight: "1px solid #e8ecf2", overflowY: "auto" }}>
            <p style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em", color: "#94a3b8", margin: "0 0 12px" }}>Atanan Kitap</p>
            <h3 style={{ fontSize: 20, fontWeight: 900, color: "#2563eb", margin: "0 0 5px", lineHeight: 1.2 }}>{book.title}</h3>
            <p style={{ fontSize: 13, fontStyle: "italic", color: "#475569", margin: "0 0 2px" }}>{book.author}</p>
            <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 22px" }}>{book.publisher}</p>

            {(book.genre || book.subGenre) && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 22 }}>
                {book.genre && <span style={{ padding: "4px 11px", borderRadius: 50, fontSize: 11, fontWeight: 700, background: "rgba(37,99,235,0.08)", color: "#2563eb" }}>{book.genre}</span>}
                {book.subGenre && <span style={{ padding: "4px 11px", borderRadius: 50, fontSize: 11, fontWeight: 600, background: "#f1f5f9", color: "#64748b" }}>{book.subGenre}</span>}
              </div>
            )}

            <div style={{ borderTop: "1px solid #e8ecf2", paddingTop: 20 }}>
              <p style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em", color: "#94a3b8", margin: "0 0 14px" }}>Teknik Özellikler</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {book.dimensions && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}><span style={{ color: "#64748b" }}>Kitap Ölçüsü</span><span style={{ fontWeight: 700, color: "#1e293b" }}>{book.dimensions}</span></div>}
                {book.pageCount && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}><span style={{ color: "#64748b" }}>Sayfa Sayısı</span><span style={{ fontWeight: 700, color: "#1e293b" }}>{book.pageCount} sf</span></div>}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}><span style={{ color: "#64748b" }}>Cilt Tipi</span><span style={{ fontWeight: 700, color: "#1e293b" }}>Amerikan Cilt</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}><span style={{ color: "#64748b" }}>Kağıt Gramajı</span><span style={{ fontWeight: 700, color: "#1e293b" }}>{paperWeight} gr.</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}><span style={{ color: "#64748b" }}>Yaprak Kalınlığı</span><span style={{ fontWeight: 700, color: "#1e293b" }}>{paperThickness}</span></div>
                {book.isbn && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}><span style={{ color: "#64748b" }}>ISBN No</span><span style={{ fontWeight: 700, color: "#1e293b", fontSize: 11 }}>{book.isbn}</span></div>}
              </div>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "40px 52px 40px 32px" }}>
            <p style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em", color: "#94a3b8", margin: "0 0 16px" }}>Arka Kapak Yazısı</p>
            <p style={{ fontSize: 14, lineHeight: 1.85, color: "#334155", whiteSpace: "pre-wrap", textAlign: "justify", margin: 0 }}>{book.backCover || "—"}</p>
          </div>
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
              style={{ background: noMoreStudents ? "#94a3b8" : "#2563eb", boxShadow: noMoreStudents ? "none" : "0 8px 20px rgba(37,99,235,0.35)", cursor: noMoreStudents ? "not-allowed" : "pointer", opacity: noMoreStudents ? 0.5 : 1 }}>
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

export default function BookGameScreen({
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
  const sz = useCarouselSize();

  const [pool, setPool] = useState<{ items: BookItem[] } | null>(null);
  const [poolLoading, setPoolLoading] = useState(true);
  const [draws, setDraws] = useState<StudentDraw[]>(initialDraws);

  const [currentBook, setCurrentBook] = useState<BookItem | null>(null);
  const [showCarousel, setShowCarousel] = useState(false);
  const [spinDone, setSpinDone] = useState(false);
  const [winnerRevealed, setWinnerRevealed] = useState(false);

  const [showFinal, setShowFinal] = useState(false);
  const [viewingStudentId, setViewingStudentId] = useState<string | null>(null);
  const [autoMailSentFor, setAutoMailSentFor] = useState<Set<string>>(new Set());
  const [finalizing, setFinalizing] = useState(false);

  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drawsRef = useRef<StudentDraw[]>(initialDraws);
  useEffect(() => { drawsRef.current = draws; }, [draws]);

  useEffect(() => () => {
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    if (modalTimerRef.current) clearTimeout(modalTimerRef.current);
  }, []);

  useEffect(() => {
    (async () => {
      const headers = await authHeaders();
      const res = await fetch("/api/flexos/book-pool", { headers });
      if (res.ok) {
        const data = await res.json() as { pool: { items: BookItem[] } | null };
        setPool(data.pool);
      }
      setPoolLoading(false);
    })();
  }, []);

  const usedBookIds = useMemo(() => draws.flatMap((d) => d.draws.map((dr) => dr.item.id)), [draws]);
  const availableBooks = useMemo(
    () => (pool?.items ?? []).filter((b) => !usedBookIds.includes(b.id)),
    [pool, usedBookIds],
  );

  const remainingStudents = useMemo(
    () => students.filter((s) => {
      const d = draws.find((x) => x.studentId === s.id);
      return !(d && d.draws.length >= 1);
    }),
    [students, draws],
  );

  const allDone = students.length > 0 && remainingStudents.length === 0;

  const { phase, pickHighlightId, selectedStudentId, nameVisible, beginPicking, resetToIdle } = usePickingEngine({
    remainingStudents,
    onStudentReady: () => {},
  });

  const selectedStudent = selectedStudentId ? students.find((s) => s.id === selectedStudentId) : null;

  const deadline = endDate ? new Date(endDate).toLocaleDateString("tr-TR") : (() => {
    const d = new Date(); d.setDate(d.getDate() + 14); return d.toLocaleDateString("tr-TR");
  })();

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
    if (drawsRef.current.some((d) => d.draws.some((dr) => dr.item.id === currentBook.id))) return;
    setSpinDone(true);

    const completedDraw: StudentDraw = { studentId: selectedStudent.id, draws: [{ category: "Kitap", item: currentBook }] };
    setDraws([...drawsRef.current.filter((d) => d.studentId !== selectedStudent.id), completedDraw]);

    (async () => {
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
        console.error("[kitap] çekiliş kaydı gönderilemedi:", err);
        toast.error("Çekiliş sonucu kaydedilemedi — bağlantınızı kontrol edin.");
      }

      try {
        const paperWeight = Math.random() < 0.65 ? 60 : 70;
        const paperThickness = paperWeight === 60 ? "0.08 mm" : "0.09 mm";
        const pdfBase64 = await generateKitapPdf({ book: currentBook, deadline, paperWeight, paperThickness });
        const headers = await authHeaders();
        const res = await fetch("/api/flexos/lottery-results/mail", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "kitap",
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
        console.error("[kitap] otomatik mail gönderilemedi:", err);
      }
    })();

    revealTimerRef.current = setTimeout(() => setWinnerRevealed(true), 1150);
    modalTimerRef.current = setTimeout(() => setShowFinal(true), 1500);
  }, [selectedStudent, currentBook, assignmentId, groupCode, taskName, deadline]);

  const handleAdvance = useCallback(() => {
    setShowFinal(false);
    setViewingStudentId(null);
    setCurrentBook(null);
    setShowCarousel(false);
    setSpinDone(false);
    setWinnerRevealed(false);
    resetToIdle(true);
  }, [resetToIdle]);

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
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0d1526" }}>
        <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: "rgba(255,255,255,0.1)", borderTopColor: ACCENT }} />
      </div>
    );
  }

  const isPastView = !!(viewingStudentId && viewingStudentId !== selectedStudentId);
  const overlayStudent = viewingStudentId ? students.find((s) => s.id === viewingStudentId) : selectedStudent;
  const overlayDraw = draws.find((d) => d.studentId === overlayStudent?.id);
  const overlayBook = overlayDraw?.draws[0]?.item ?? null;
  const drawingStudentId = (showCarousel || spinDone) ? (selectedStudentId ?? null) : null;

  return (
    <>
      <div className="min-h-screen flex" style={{ background: "#0d1526", opacity: finalizing ? 0.4 : 1 }}>
        <StudentPanel
          students={students}
          draws={draws}
          catCount={1}
          taskLabel={groupCode || taskName}
          onViewResult={handleViewResult}
          pickHighlightId={pickHighlightId}
          drawingStudentId={drawingStudentId}
          accentColor={ACCENT}
        />

        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between px-8 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <button onClick={() => router.push("/flexos/egitmen-anasayfa")} className="flex items-center gap-2 cursor-pointer transition-colors" style={{ color: "rgba(255,255,255,0.35)" }}>
              <ArrowLeft size={17} />
              <span className="text-[15px] font-semibold">Ana Sayfa</span>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: "rgba(96,165,250,0.14)" }}>
                <BookOpen size={14} style={{ color: ACCENT }} />
              </div>
              <span className="text-[14px] font-bold text-white">{taskName}</span>
            </div>
            <div className="w-20" />
          </div>

          <div className="flex-1 flex flex-col items-center justify-center px-8 py-10 overflow-y-auto">
            {phase === "idle" && !showCarousel && !allDone && (
              <div className="flex flex-col items-center gap-4 text-center">
                <p className="text-[15px] font-bold tracking-[0.4em] uppercase" style={{ color: "rgba(255,255,255,0.45)" }}>Çekiliş Hazır</p>
                <p className="text-[15px]" style={{ color: "rgba(255,255,255,0.75)" }}>Sıradaki katılımcıyı belirlemek için başlat&apos;a bas.</p>
                <p className="text-[15px] font-semibold" style={{ color: "rgba(255,255,255,0.65)" }}>{remainingStudents.length} öğrenci katılacak</p>
              </div>
            )}

            {phase === "picking" && (
              <div className="flex flex-col items-center gap-5 text-center">
                <div className="flex gap-2 items-center">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="w-2 h-2 rounded-full" style={{ background: ACCENT, opacity: 0.4, animation: `pulse 1s ease-in-out ${i * 0.2}s infinite` }} />
                  ))}
                </div>
                <p className="text-[13px] font-semibold" style={{ color: "rgba(255,255,255,0.4)" }}>Katılımcı seçiliyor...</p>
              </div>
            )}

            {phase === "ready" && selectedStudent && (
              <>
                <div className="text-center" style={{ marginTop: sz.nameMarginTop, marginBottom: sz.nameMarginBottom }}>
                  <p className="text-[11px] font-bold tracking-[0.45em] uppercase mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>Kitap Alacak Katılımcı</p>
                  <p style={{ fontSize: sz.nameFontSize, fontWeight: 900, letterSpacing: "-0.025em", opacity: nameVisible ? 1 : 0, transition: "opacity 0.4s ease 0.4s", margin: 0 }}>
                    <span style={{ color: "#ffffff" }}>{selectedStudent.name} </span>
                    <span style={{ color: "#f59e0b" }}>{selectedStudent.lastName}</span>
                  </p>
                  {spinDone && (
                    <p className="text-[11px] font-bold tracking-[0.45em] uppercase" style={{ color: "rgba(255,255,255,0.4)", margin: "14px 0 0" }}>Kitap Belirlendi</p>
                  )}
                </div>

                {showCarousel && currentBook && (
                  <BookCarousel
                    allBooks={pool?.items ?? []}
                    winnerBook={currentBook}
                    onSpinComplete={handleSpinComplete}
                    bookWidth={sz.BOOK_WIDTH}
                    carouselHeight={sz.carouselHeight}
                    carouselPadding={sz.carouselPadding}
                  />
                )}

                <div className={cn(sz.resultMtCls + " text-center transition-all duration-700", showCarousel && spinDone && winnerRevealed ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-8 opacity-0")}>
                  {currentBook && (
                    <div className={sz.resultSpaceCls}>
                      <span className="text-xs uppercase tracking-widest text-amber-400">Seçilen Kitap</span>
                      <h2 className={cn(sz.resultTitleCls, "font-semibold text-white")}>{currentBook.title}</h2>
                      <p className={cn(sz.resultAuthorCls, "text-white/60")}>{currentBook.author}</p>
                      <span className="mt-2 inline-block rounded-full bg-white/10 px-4 py-1 text-sm text-white/80">{currentBook.genre}</span>
                    </div>
                  )}
                </div>
              </>
            )}

            {allDone && (
              <div className="text-center flex flex-col items-center gap-5" style={{ paddingTop: 48 }}>
                <p className="text-[18px] font-bold" style={{ color: "rgba(255,255,255,0.9)" }}>Bu oturumun tüm katılımcıları tamamlandı!</p>
                <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.45)" }}>Ödev artık normal not girişi akışına düştü.</p>
                <button onClick={() => router.push("/flexos/egitmen-anasayfa")}
                  className="px-10 py-3.5 rounded-full text-[15px] font-bold text-white cursor-pointer active:scale-95 transition-transform"
                  style={{ background: "linear-gradient(135deg, #1e40af 0%, #2563eb 100%)", boxShadow: "0 6px 20px rgba(37,99,235,0.25)" }}>
                  Ana Sayfaya Dön
                </button>
              </div>
            )}
          </div>

          <div className="shrink-0 flex justify-center items-center py-6 px-8" style={{ borderTop: "1px solid rgba(255,255,255,0.07)", minHeight: 88 }}>
            {phase === "idle" && !showCarousel && !allDone && (
              <div className="flex items-center gap-4">
                <button onClick={beginPicking}
                  className="px-14 py-4 rounded-full text-[16px] font-black text-white cursor-pointer active:scale-95 transition-transform"
                  style={{ background: "linear-gradient(135deg, #1e40af 0%, #2563eb 100%)", boxShadow: "0 8px 28px rgba(37,99,235,0.28)" }}>
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

            {phase === "ready" && !showCarousel && nameVisible && (
              <button onClick={handleSpin}
                className="px-14 py-4 rounded-full text-[16px] font-black text-white cursor-pointer active:scale-95 transition-transform"
                style={{ background: "linear-gradient(135deg, #1e40af 0%, #2563eb 100%)", boxShadow: "0 8px 28px rgba(37,99,235,0.28)", letterSpacing: "0.06em" }}>
                ÇEVİR
              </button>
            )}

            {spinDone && !showFinal && !allDone && (
              <button onClick={handleAdvance}
                className="flex items-center gap-3 px-14 py-4 rounded-full text-[16px] font-black text-white cursor-pointer active:scale-95 transition-transform"
                style={{ background: "linear-gradient(135deg, #1e40af 0%, #2563eb 100%)", boxShadow: "0 8px 28px rgba(37,99,235,0.28)" }}>
                Devam Et <ChevronRight size={18} strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>

        <style>{`
          @keyframes pulse { 0%,100% { opacity:0.35; transform:scale(1); } 50% { opacity:1; transform:scale(1.4); } }
        `}</style>
      </div>

      {showFinal && overlayStudent && overlayBook && (
        <BookResultModal
          student={overlayStudent}
          book={overlayBook}
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
