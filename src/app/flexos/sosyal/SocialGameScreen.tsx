"use client";

/**
 * FlexOS · Reklam Tasarımı (Sosyal Medya) çekiliş ekranı — canlıdaki
 * `assignment/social/SocialGameScreen.tsx` portu. Mekanik BİREBİR (picking →
 * hiyerarşik Sektör→Alt Sektör→Marka→Amaç seçimi + bağımsız Format seçimi →
 * 3 slot-reel görsel çekiliş → sonuç kartı), ama `KolajGameScreen.tsx`/
 * `BookGameScreen.tsx` ile aynı server-route deseni (client Firestore yazımı YOK):
 *  - Havuz: `GET /api/flexos/social-pool` (kendi kişisel kopyam)
 *  - Çekiliş kaydı: `POST /api/flexos/lottery-results` (kategori sabit "Reklam", tek draw)
 *  - Mail+PDF+Drive: `POST /api/flexos/lottery-results/mail` (`type:"sosyal"`)
 *
 * Basitleştirme (Kolaj/Kitap portlarındaki 2026-07-07 kararıyla AYNI, kapsam gereği):
 * canlıdaki ayrı "Arşive Kaydet"/"Ödevi Tamamla" akışı sadeleştirildi (toast +
 * yönlendirme) — sonuç aynı (`PATCH /api/flexos/assignments/[id]` ile `status:"published"`,
 * roster tamamlanınca zaten server-side `saveDraw` otomatik yapıyor).
 */
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Smartphone, Check, Mail, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { auth } from "@/app/lib/firebase";
import { usePickingEngine } from "./usePickingEngine";
import StudentPanel from "./StudentPanel";
import { SlotReel } from "./SlotReel";
import { generateSocialPdf, type SocialPdfData } from "./generateSocialPdf";
import type { Student, StudentDraw, SocialPool, SMBrand, SMFormat, SocialDrawItem } from "./types";

const ACCENT = "#a855f7";

async function authHeaders(): Promise<Record<string, string>> {
  const u = auth.currentUser;
  const token = u ? await u.getIdToken() : "";
  return { Authorization: `Bearer ${token}` };
}

function todayTR() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

function pickRandom<T>(arr: T[]): T | undefined {
  return arr.length ? arr[Math.floor(Math.random() * arr.length)] : undefined;
}

function ResultModal({
  student, draw, taskName, deadline, mailStatus, isPastView, noMoreStudents, onAdvance, onClose,
}: {
  student: Student;
  draw: SocialDrawItem;
  taskName: string;
  deadline: string;
  mailStatus: "idle" | "sending" | "sent" | "error";
  isPastView?: boolean;
  noMoreStudents?: boolean;
  onAdvance: () => void;
  onClose: () => void;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), 30); return () => clearTimeout(t); }, []);

  const tableRows = [
    { key: "Marka Kuralı", val: draw.brandRule || "—" },
    { key: "Amaç / Hedef", val: draw.purpose || "—" },
    { key: "Platform", val: draw.platform || "—" },
    { key: "İçerik Türü", val: draw.contentType || "—" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{
      background: visible ? "rgba(6,13,26,0.92)" : "rgba(6,13,26,0)", transition: "background 0.4s ease", backdropFilter: "blur(8px)",
    }}>
      <div style={{
        width: "100%", maxWidth: 640, maxHeight: "92vh", overflowY: "auto",
        background: "white", borderRadius: 20, boxShadow: "0 40px 100px rgba(0,0,0,0.65)",
        opacity: visible ? 1 : 0,
        transform: visible ? "scale(1) translateY(0)" : "scale(0.92) translateY(20px)",
        transition: "all 0.45s cubic-bezier(0.34,1.56,0.64,1)",
        fontFamily: "system-ui, sans-serif",
      }}>
        <div style={{ textAlign: "center", padding: "32px 40px 20px", borderBottom: "2px solid #f0f0f0" }}>
          <p style={{ fontSize: 20, fontWeight: 800, color: "#1B5EBF", letterSpacing: "0.04em", margin: "0 0 4px" }}>SOSYAL MEDYA YÖNETİMİ</p>
          <p style={{ fontSize: 12, color: "#888", letterSpacing: "0.15em", margin: 0, textTransform: "uppercase" }}>ÖDEV KARTI</p>
        </div>

        <div style={{ padding: "20px 40px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{ fontSize: 22, fontWeight: 800, color: "#111", margin: "0 0 4px" }}>Marka: {draw.brandName}</p>
            <p style={{ fontSize: 12, fontStyle: "italic", color: "#666", margin: 0 }}>Sektör: {draw.sectorDisplay}</p>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <p style={{ fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 2px" }}>Öğrenci</p>
            <p style={{ fontSize: 14, fontWeight: 800, color: "#111", margin: 0 }}>{student.name} {student.lastName}</p>
          </div>
        </div>

        <div style={{ margin: "0 40px 20px", border: "1px solid #ddd", borderRadius: 6, overflow: "hidden" }}>
          {tableRows.map((row, i) => (
            <div key={row.key} style={{ display: "flex", borderBottom: i < tableRows.length - 1 ? "1px solid #ddd" : "none" }}>
              <div style={{ width: 130, flexShrink: 0, padding: "10px 14px", background: "#f8f8f8", borderRight: "1px solid #ddd", fontSize: 11, fontWeight: 700, color: "#333", display: "flex", alignItems: "center" }}>
                {row.key}
              </div>
              <div style={{ flex: 1, padding: "10px 14px", fontSize: 13, color: "#222", lineHeight: 1.55 }}>{row.val}</div>
            </div>
          ))}
        </div>

        {!isPastView && (
          <div style={{
            margin: "0 40px 20px", padding: "10px 14px", borderRadius: 8,
            background: mailStatus === "sent" ? "#f0fdf4" : mailStatus === "error" ? "#fef2f2" : "#f8f9fa",
            border: `1px solid ${mailStatus === "sent" ? "#bbf7d0" : mailStatus === "error" ? "#fecaca" : "#e9ecef"}`,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            {mailStatus === "sending" && <div style={{ width: 13, height: 13, border: "2px solid #ccc", borderTopColor: "#666", borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0 }} />}
            {mailStatus === "sent" && <Check size={13} style={{ color: "#16a34a", flexShrink: 0 }} strokeWidth={3} />}
            {mailStatus === "error" && <Mail size={13} style={{ color: "#dc2626", flexShrink: 0 }} />}
            {mailStatus === "idle" && <Mail size={13} style={{ color: "#aaa", flexShrink: 0 }} />}
            <span style={{ fontSize: 12, color: mailStatus === "sent" ? "#15803d" : mailStatus === "error" ? "#dc2626" : "#666" }}>
              {mailStatus === "sending" ? "PDF hazırlanıyor, mail gönderiliyor..."
                : mailStatus === "sent" ? "PDF ekte gönderildi"
                : mailStatus === "error" ? "Mail gönderilemedi"
                : "Mail bekleniyor"}
            </span>
          </div>
        )}

        <div style={{ padding: "0 40px 20px", textAlign: "right" }}>
          <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>Oluşturulma Tarihi: {todayTR()}</p>
        </div>

        <div style={{ margin: "0 40px", height: 2, background: "linear-gradient(90deg, #1B5EBF, #a855f7)" }} />

        <div style={{ padding: "20px 40px 28px", display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "12px 28px", borderRadius: 12, background: "transparent", border: "2px solid #e2e8f0", color: "#666", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            Kapat
          </button>
          {!isPastView && (
            <button
              onClick={noMoreStudents ? onClose : onAdvance}
              style={{
                padding: "12px 32px", borderRadius: 12,
                background: noMoreStudents ? "#94a3b8" : "#1B5EBF",
                boxShadow: noMoreStudents ? "none" : "0 4px 14px rgba(27,94,191,0.30)",
                color: "white", fontSize: 14, fontWeight: 800, border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              {noMoreStudents ? "Bitti" : <>YENİ SEÇİM <ChevronRight size={15} strokeWidth={2.5} /></>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SocialGameScreen({
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

  const [pool, setPool] = useState<SocialPool | null>(null);
  const [poolLoading, setPoolLoading] = useState(true);
  const [draws, setDraws] = useState<StudentDraw[]>(initialDraws);

  const [finalIndexes, setFinalIndexes] = useState([0, 0, 0]);
  const [spinKey, setSpinKey] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [blinkSlots, setBlinkSlots] = useState(false);
  const [pendingDraw, setPendingDraw] = useState<SocialDrawItem | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [viewingStudentId, setViewingStudentId] = useState<string | null>(null);
  const [mailStatus, setMailStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [finalizing, setFinalizing] = useState(false);

  const poolRef = useRef<SocialPool | null>(null);
  const drawsRef = useRef<StudentDraw[]>(initialDraws);
  const timeoutRefs = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => { poolRef.current = pool; }, [pool]);
  useEffect(() => { drawsRef.current = draws; }, [draws]);
  useEffect(() => () => { timeoutRefs.current.forEach((t) => clearTimeout(t)); }, []);

  useEffect(() => {
    (async () => {
      const headers = await authHeaders();
      const res = await fetch("/api/flexos/social-pool", { headers });
      if (res.ok) {
        const data = await res.json() as { pool: SocialPool | null };
        setPool(data.pool);
      }
      setPoolLoading(false);
    })();
  }, []);

  const anaSektorler = useMemo(() => pool?.sectors.map((s) => s.name) ?? [], [pool]);
  const altSektorler = useMemo(() => pool?.sectors.flatMap((s) => s.subSectors).filter(Boolean) ?? [], [pool]);
  const markalar = useMemo(() => pool?.brands.map((b) => b.brandName) ?? [], [pool]);
  const poolReady = anaSektorler.length > 0 && altSektorler.length > 0 && markalar.length > 0;

  const remainingStudents = useMemo(
    () => students.filter((s) => !draws.some((d) => d.studentId === s.id)),
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

  const handleStartSpin = useCallback(() => {
    if (!selectedStudent || phase !== "ready" || !poolReady) return;
    const pool = poolRef.current;
    if (!pool) return;

    // Hiyerarşik seçim: Sektörleri karıştır, her birini dene — boş olanları atla.
    const shuffledSectors = [...pool.sectors].sort(() => Math.random() - 0.5);
    let chosenMainSector: (typeof pool.sectors)[0] | undefined;
    let chosenSubSector: string | undefined;
    let chosenBrand: SMBrand | undefined;

    for (const sector of shuffledSectors) {
      const validSubSectors = sector.subSectors.filter((sub) =>
        pool.brands.some((b) => b.mainSector === sector.name && b.subSector === sub),
      );
      if (!validSubSectors.length) continue;
      const sub = pickRandom(validSubSectors);
      if (!sub) continue;
      const eligibleBrands = pool.brands.filter((b) => b.mainSector === sector.name && b.subSector === sub);
      if (!eligibleBrands.length) continue;
      chosenMainSector = sector;
      chosenSubSector = sub;
      chosenBrand = pickRandom(eligibleBrands);
      break;
    }

    if (!chosenMainSector || !chosenSubSector || !chosenBrand) {
      toast.error("Geçerli bir Sektör/Marka kombinasyonu bulunamadı — Havuz Yönetimi'ni kontrol edin.");
      return;
    }

    const chosenPurpose = pickRandom(chosenBrand.purposes.length ? chosenBrand.purposes : pool.globalPurposes) ?? "";

    // Slot reel indeksleri sadece görsel — gerçek seçim yukarıda yapıldı.
    const mainIdx = anaSektorler.indexOf(chosenMainSector.name);
    const subIdx = altSektorler.indexOf(chosenSubSector);
    const brandIdx = markalar.indexOf(chosenBrand.brandName);
    setFinalIndexes([mainIdx >= 0 ? mainIdx : 0, subIdx >= 0 ? subIdx : 0, brandIdx >= 0 ? brandIdx : 0]);
    setSpinKey((prev) => prev + 1);
    setSpinning(true);
    setBlinkSlots(false);

    const student = selectedStudent;
    const mainSector = chosenMainSector;
    const subSector = chosenSubSector;
    const brand = chosenBrand;

    const t = setTimeout(() => {
      const format: SMFormat | undefined = pool.formats?.length ? pickRandom(pool.formats) : undefined;
      const draw: SocialDrawItem = {
        brandName: brand.brandName,
        sectorDisplay: `${brand.mainSector} / ${brand.subSector}`,
        brandRule: brand.brandRule ?? "",
        purpose: chosenPurpose,
        platform: format?.platform ?? "",
        contentType: format ? `${format.dim} (${format.type})` : "",
      };

      setPendingDraw(draw);
      setBlinkSlots(true);

      const completedDraw: StudentDraw = { studentId: student.id, draws: [{ category: "Reklam", item: draw }] };
      setDraws([...drawsRef.current.filter((d) => d.studentId !== student.id), completedDraw]);
      setMailStatus("idle");

      (async () => {
        try {
          const headers = await authHeaders();
          await fetch("/api/flexos/lottery-results", {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({
              assignmentId, studentId: student.id, studentName: student.name, studentLastName: student.lastName,
              draws: completedDraw.draws,
            }),
          });
        } catch (err) {
          console.error("[sosyal] çekiliş kaydı gönderilemedi:", err);
          toast.error("Çekiliş sonucu kaydedilemedi — bağlantınızı kontrol edin.");
        }

        try {
          setMailStatus("sending");
          const pdfData: SocialPdfData = {
            studentName: `${student.name} ${student.lastName}`.toUpperCase(),
            brandName: draw.brandName,
            sektorDisplay: draw.sectorDisplay,
            brandRule: draw.brandRule,
            purpose: draw.purpose,
            platform: draw.platform,
            contentType: draw.contentType,
            sharedRule: pool.sharedRule ?? "",
            date: todayTR(),
          };
          const pdfBase64 = await generateSocialPdf(pdfData);
          const headers = await authHeaders();
          const res = await fetch("/api/flexos/lottery-results/mail", {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "sosyal",
              studentName: student.name, studentLastName: student.lastName, studentId: student.id,
              assignmentId, groupCode, taskName, draws: completedDraw.draws, deadline, pdfBase64,
            }),
          });
          setMailStatus(res.ok ? "sent" : "error");
        } catch (err) {
          console.error("[sosyal] otomatik mail gönderilemedi:", err);
          setMailStatus("error");
        }
      })();

      const tModal = setTimeout(() => {
        setSpinning(false);
        setBlinkSlots(false);
        setShowResult(true);
      }, 1350);
      timeoutRefs.current.push(tModal);
    }, 7400);
    timeoutRefs.current.push(t);
  }, [selectedStudent, phase, poolReady, anaSektorler, altSektorler, markalar, assignmentId, groupCode, taskName, deadline]);

  const handleAdvance = useCallback(() => {
    setShowResult(false);
    setViewingStudentId(null);
    setSpinning(false);
    setBlinkSlots(false);
    setPendingDraw(null);
    resetToIdle(true);
  }, [resetToIdle]);

  const handleClose = useCallback(() => {
    setShowResult(false);
    setViewingStudentId(null);
  }, []);

  const handleViewResult = useCallback((studentId: string) => {
    setViewingStudentId(studentId);
    setShowResult(true);
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

  const overlayStudent = viewingStudentId ? students.find((s) => s.id === viewingStudentId) : selectedStudent;
  const overlayDraw = draws.find((d) => d.studentId === overlayStudent?.id)?.draws[0]?.item ?? pendingDraw;
  const isPastView = !!(viewingStudentId && viewingStudentId !== selectedStudentId);
  const drawingStudentId = (spinning || blinkSlots) ? (selectedStudentId ?? null) : null;

  return (
    <>
      <style>{`
        @keyframes nameBounce {
          0% { transform:scale(0.05); opacity:0; } 14% { transform:scale(1.32); opacity:1; }
          26% { transform:scale(0.78); } 38% { transform:scale(1.18); } 50% { transform:scale(0.88); }
          62% { transform:scale(1.08); } 72% { transform:scale(0.94); } 82% { transform:scale(1.03); }
          91% { transform:scale(0.98); } 100% { transform:scale(1.00); }
        }
        @keyframes dotPulse { 0%,80%,100%{transform:scale(0.6);opacity:0.4} 40%{transform:scale(1);opacity:1} }
        @keyframes smFadeIn { from{opacity:0} to{opacity:1} }
        @keyframes slotBlink { 0%,49.9%{opacity:1} 50%,100%{opacity:0.08} }
      `}</style>

      <div className="min-h-screen flex" style={{ background: "#0d1526" }}>
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

        <div className="flex-1 flex flex-col">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 32px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <button onClick={() => router.push("/flexos/egitmen-anasayfa")} style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(255,255,255,0.35)", background: "none", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
              <ArrowLeft size={16} /> Ana Sayfa
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 10, background: "rgba(168,85,247,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Smartphone size={15} style={{ color: ACCENT }} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.80)" }}>{taskName}</span>
            </div>
            <div style={{ width: 100 }} />
          </div>

          <div className="flex-1 flex flex-col items-center justify-center px-8 py-10 overflow-y-auto">
            {phase === "idle" && !spinning && !allDone && (
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.30)", textTransform: "uppercase", letterSpacing: "0.4em", marginBottom: 10 }}>Çekiliş Hazır</p>
                <p style={{ fontSize: 15, color: "rgba(255,255,255,0.40)" }}>Sıradaki katılımcıyı belirlemek için başlat&apos;a bas.</p>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.25)", marginTop: 8 }}>{remainingStudents.length} öğrenci bekliyor</p>
              </div>
            )}

            {phase === "picking" && (
              <div style={{ textAlign: "center" }}>
                <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16 }}>
                  {[0, 1, 2].map((i) => (
                    <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: ACCENT, animation: `dotPulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                  ))}
                </div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.40)" }}>Katılımcı seçiliyor...</p>
              </div>
            )}

            {phase === "ready" && selectedStudent && !spinning && (
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.45em", color: "rgba(255,255,255,0.28)", marginBottom: 20, opacity: nameVisible ? 1 : 0, transition: "opacity 0.4s ease 0.5s" }}>
                  Ödev Alacak Katılımcı
                </p>
                {nameVisible && (
                  <h1 style={{ fontSize: "clamp(42px, 5.5vw, 72px)", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.1, color: "white", margin: 0, animation: "nameBounce 1.2s cubic-bezier(0.25,0.46,0.45,0.94) forwards" }}>
                    <span style={{ color: "#ffffff" }}>{selectedStudent.name} </span>
                    <span style={{ color: "#c084fc" }}>{selectedStudent.lastName}</span>
                  </h1>
                )}
              </div>
            )}

            {spinning && selectedStudent && (
              <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 40 }}>
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.45em", color: "rgba(255,255,255,0.28)", marginBottom: 14 }}>Ödev Alacak Katılımcı</p>
                  <h2 style={{ fontSize: "clamp(24px, 2.8vw, 38px)", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.2, color: "white", margin: "0 0 8px", animation: "smFadeIn 0.35s ease" }}>
                    <span style={{ color: "#ffffff" }}>{selectedStudent.name} </span>
                    <span style={{ color: "#c084fc" }}>{selectedStudent.lastName}</span>
                  </h2>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "rgba(168,85,247,0.70)", letterSpacing: "0.04em" }}>Ödeviniz çekiliyor...</p>
                </div>

                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 28, padding: "40px 40px 32px", position: "relative", width: "100%", maxWidth: 820 }}>
                  <div style={{ position: "absolute", top: -18, left: "50%", transform: "translateX(-50%)", background: ACCENT, borderRadius: 100, padding: "6px 24px" }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "white", textTransform: "uppercase", letterSpacing: "0.12em" }}>Reklam Bulucu</span>
                  </div>
                  <div key={spinKey} style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 32, padding: "16px 0 8px", animation: blinkSlots ? "slotBlink 0.42s linear 3" : "none" }}>
                    <SlotReel items={anaSektorler} isSpinning={!blinkSlots} finalIndex={finalIndexes[0]} delay={1800} label="Ana Sektör" accentColor={ACCENT} />
                    <SlotReel items={altSektorler} isSpinning={!blinkSlots} finalIndex={finalIndexes[1]} delay={3200} label="Alt Sektör" accentColor={ACCENT} />
                    <SlotReel items={markalar} isSpinning={!blinkSlots} finalIndex={finalIndexes[2]} delay={4600} label="Marka" accentColor={ACCENT} />
                  </div>
                </div>
              </div>
            )}

            {allDone && (
              <div className="text-center flex flex-col items-center gap-5" style={{ paddingTop: 48 }}>
                <p className="text-[18px] font-bold" style={{ color: "rgba(255,255,255,0.9)" }}>Bu oturumun tüm katılımcıları tamamlandı!</p>
                <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.45)" }}>Ödev artık normal not girişi akışına düştü.</p>
                <button onClick={() => router.push("/flexos/egitmen-anasayfa")}
                  className="px-10 py-3.5 rounded-full text-[15px] font-bold text-white cursor-pointer active:scale-95 transition-transform"
                  style={{ background: "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)", boxShadow: "0 6px 20px rgba(168,85,247,0.25)" }}>
                  Ana Sayfaya Dön
                </button>
              </div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "24px 32px", borderTop: "1px solid rgba(255,255,255,0.07)", minHeight: 88, gap: 16 }}>
            {phase === "idle" && !spinning && !allDone && (
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <button onClick={beginPicking} style={{ padding: "16px 52px", borderRadius: 100, background: "linear-gradient(135deg, #7c3aed, #a855f7)", boxShadow: "0 8px 28px rgba(168,85,247,0.30)", color: "white", fontSize: 16, fontWeight: 800, border: "none", cursor: "pointer" }}>
                  Başlat
                </button>
                {draws.length > 0 && (
                  <button onClick={handleForceFinish} disabled={finalizing}
                    className="disabled:opacity-50"
                    style={{ padding: "16px 28px", borderRadius: 100, fontSize: 15, fontWeight: 700, background: "transparent", border: "2px solid rgba(248,113,113,0.30)", color: "rgba(248,113,113,0.70)", cursor: finalizing ? "wait" : "pointer" }}>
                    Ödevi Tamamla
                  </button>
                )}
              </div>
            )}

            {phase === "ready" && !spinning && (
              <button onClick={handleStartSpin} disabled={!poolReady}
                style={{
                  padding: "16px 52px", borderRadius: 100, background: "linear-gradient(135deg, #276749, #38a169)",
                  boxShadow: "0 8px 28px rgba(56,161,105,0.28)", color: "white", fontSize: 16, fontWeight: 800, border: "none",
                  cursor: poolReady ? "pointer" : "not-allowed", opacity: nameVisible ? 1 : 0, transition: "opacity 0.4s ease 0.4s",
                }}>
                Çekiliş Başlat
              </button>
            )}

            {spinning && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 32px", borderRadius: 100, background: "rgba(168,85,247,0.10)", border: "1.5px solid rgba(168,85,247,0.25)", color: "rgba(255,255,255,0.45)", fontSize: 14, fontWeight: 600 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  {[0, 1, 2].map((i) => (
                    <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: ACCENT, animation: `dotPulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                  ))}
                </div>
                Çekiliş yapılıyor...
              </div>
            )}
          </div>
        </div>
      </div>

      {showResult && overlayStudent && overlayDraw && (
        <ResultModal
          student={overlayStudent}
          draw={overlayDraw}
          taskName={taskName}
          deadline={deadline}
          mailStatus={isPastView ? "idle" : mailStatus}
          isPastView={isPastView}
          noMoreStudents={remainingStudents.length === 0}
          onAdvance={handleAdvance}
          onClose={handleClose}
        />
      )}
    </>
  );
}
