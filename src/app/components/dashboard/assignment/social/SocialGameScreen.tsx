"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  doc, getDoc, setDoc, addDoc, collection,
  getDocs, query, where, updateDoc, serverTimestamp,
} from "firebase/firestore";
import { ArrowLeft, Smartphone, Check, Mail, ChevronRight } from "lucide-react";
import { db } from "@/app/lib/firebase";
import type { Student, TaskData, StudentDraw } from "../shared/types";
import SharedStudentPanel from "../shared/StudentPanel";
import { SlotReel } from "./SlotReel";
import type { SocialMediaPool, SMBrand, SMFormat } from "../pool/poolTypes";
import { generateSocialPdf, type SocialPdfData } from "./generateSocialPdf";

const ACCENT = "#a855f7";

// ─── Tipler ───────────────────────────────────────────────────────────────────

type Phase = "idle" | "picking" | "ready" | "spinning" | "result";

interface FullSMDraw {
  studentId:     string;
  anaSector:     string;
  altSector:     string;
  marka:         string;
  sektorDisplay: string;
  brandRule:     string;
  purpose:       string;
  platform:      string;
  contentType:   string;
}

// ─── Yardımcılar ─────────────────────────────────────────────────────────────

function todayTR() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

function pickRandom<T>(arr: T[]): T | undefined {
  return arr.length ? arr[Math.floor(Math.random() * arr.length)] : undefined;
}

// ─── Ana bileşen ──────────────────────────────────────────────────────────────

export default function SocialGameScreen({ task, students }: { task: TaskData; students: Student[] }) {
  const router = useRouter();

  const [poolData,          setPoolData]          = useState<SocialMediaPool | null>(null);
  const [draws,             setDraws]             = useState<FullSMDraw[]>([]);
  const [phase,             setPhase]             = useState<Phase>("idle");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [pickHighlightId,   setPickHighlightId]   = useState<string | null>(null);
  const [nameVisible,       setNameVisible]       = useState(false);
  const [finalIndexes,      setFinalIndexes]      = useState([0, 0, 0]);
  const [spinKey,           setSpinKey]           = useState(0);
  const [showResult,        setShowResult]        = useState(false);
  const [showInlineResult,  setShowInlineResult]  = useState(false);
  const [pendingDraw,       setPendingDraw]       = useState<FullSMDraw | null>(null);
  const [mailStatus,        setMailStatus]        = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [autoMailSentFor,   setAutoMailSentFor]   = useState<Set<string>>(new Set());
  const [groupStudentCount, setGroupStudentCount] = useState(0);
  const [archiving,         setArchiving]         = useState(false);
  const [archived,          setArchived]          = useState(false);
  const [confirmFinish,     setConfirmFinish]     = useState(false);
  const [finalizing,        setFinalizing]        = useState(false);
  const [finalized,         setFinalized]         = useState(false);

  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRefs  = useRef<ReturnType<typeof setTimeout>[]>([]);
  const autoPickRef  = useRef(false);
  const poolRef      = useRef<SocialMediaPool | null>(null);
  const drawsRef     = useRef<FullSMDraw[]>([]);

  useEffect(() => { poolRef.current  = poolData; }, [poolData]);
  useEffect(() => { drawsRef.current = draws;    }, [draws]);

  const clearAll = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    timeoutRefs.current.forEach(t => clearTimeout(t));
    timeoutRefs.current = [];
  }, []);

  useEffect(() => () => clearAll(), [clearAll]);

  // Pool yükle
  useEffect(() => {
    getDoc(doc(db, "lottery_configs", "socialMedia")).then(snap => {
      if (snap.exists()) setPoolData(snap.data() as SocialMediaPool);
    });
  }, []);

  // Mevcut çekiliş sonuçlarını yükle
  useEffect(() => {
    if (!task.id) return;
    getDoc(doc(db, "lottery_results", task.id)).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data.draws)) setDraws(data.draws as FullSMDraw[]);
      }
    });
  }, [task.id]);

  // Grup öğrenci sayısı
  useEffect(() => {
    if (!task.groupId) return;
    getDocs(query(collection(db, "students"), where("groupId", "==", task.groupId)))
      .then(snap => setGroupStudentCount(snap.size));
  }, [task.groupId]);

  // Reel listeleri
  const anaSektorler = useMemo(() => poolData?.sectors.map(s => s.name) ?? [], [poolData]);
  const altSektorler = useMemo(
    () => poolData?.sectors.flatMap(s => s.subSectors).filter(Boolean) ?? [],
    [poolData],
  );
  const markalar     = useMemo(() => poolData?.brands.map(b => b.brandName) ?? [], [poolData]);
  const poolReady    = anaSektorler.length > 0 && altSektorler.length > 0 && markalar.length > 0;

  const drawnIds          = draws.map(d => d.studentId);
  const remainingStudents = useMemo(
    () => students.filter(s => !drawnIds.includes(s.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [students, draws],
  );
  const allDone        = students.length > 0 && remainingStudents.length === 0;
  const allGroupDone   = groupStudentCount > 0 && draws.length >= groupStudentCount;
  const selectedStudent = selectedStudentId ? students.find(s => s.id === selectedStudentId) : null;

  // StudentPanel için dönüşüm
  const studentDraws: StudentDraw[] = draws.map(d => ({
    studentId: d.studentId,
    draws: [
      { category: "Ana Sektör", item: { name: d.anaSector } },
      { category: "Alt Sektör", item: { name: d.altSector } },
      { category: "Marka",      item: { name: d.marka } },
    ],
  }));

  // ─── Picking animasyonu (kolaj ile aynı) ─────────────────────────────────────

  const handleBeginPicking = useCallback(() => {
    if (remainingStudents.length === 0) return;
    clearAll();
    setPhase("picking");
    setPickHighlightId(null);
    setNameVisible(false);
    setSelectedStudentId(null);
    setShowResult(false);
    setShowInlineResult(false);
    setPendingDraw(null);
    setMailStatus("idle");

    const winner   = remainingStudents[Math.floor(Math.random() * remainingStudents.length)];
    const cycleMs  = remainingStudents.length === 1 ? 0 : 2800;

    const t0 = setTimeout(() => {
      if (remainingStudents.length > 1) {
        let shuffled: Student[] = [];
        let shuffleIdx = 0;
        const reshuffle = () => { shuffled = [...remainingStudents].sort(() => Math.random() - 0.5); shuffleIdx = 0; };
        reshuffle();
        intervalRef.current = setInterval(() => {
          if (shuffleIdx >= shuffled.length) reshuffle();
          setPickHighlightId(shuffled[shuffleIdx++].id);
        }, 90);
      }

      const t1 = setTimeout(() => {
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        setPickHighlightId(winner.id);

        const BLINK = 110;
        for (let i = 0; i < 3; i++) {
          const toff = setTimeout(() => setPickHighlightId(null),       i * BLINK * 2);
          const ton  = setTimeout(() => setPickHighlightId(winner.id),  i * BLINK * 2 + BLINK);
          timeoutRefs.current.push(toff, ton);
        }

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

  // idle'a geçince otomatik picking (sonraki öğrenci için)
  useEffect(() => {
    if (phase === "idle" && autoPickRef.current && remainingStudents.length > 0 && !showResult) {
      autoPickRef.current = false;
      handleBeginPicking();
    }
  }, [phase, remainingStudents, handleBeginPicking, showResult]);

  // ─── Çekiliş başlat ──────────────────────────────────────────────────────────

  const handleStartSpin = useCallback(() => {
    if (!selectedStudent || phase !== "ready" || !poolReady) return;
    clearAll();

    const newIndexes = [
      Math.floor(Math.random() * anaSektorler.length),
      Math.floor(Math.random() * altSektorler.length),
      Math.floor(Math.random() * markalar.length),
    ];
    setFinalIndexes(newIndexes);
    setSpinKey(prev => prev + 1);
    setPhase("spinning");

    const student = selectedStudent; // closure için kopyala

    // Son reel: delay=4600ms + ~2340ms slowdown ≈ 6940ms → 7400ms'de güvenli
    const t = setTimeout(() => {
      const pool = poolRef.current;
      const brandName = markalar[newIndexes[2]] ?? "—";
      const brand: SMBrand | undefined = pool?.brands.find(b => b.brandName === brandName);
      const purposes = brand?.purposes?.length ? brand.purposes : (pool?.globalPurposes ?? []);
      const purpose  = pickRandom(purposes) ?? "";
      const format: SMFormat | undefined = pool?.formats?.length ? pickRandom(pool.formats) : undefined;

      const draw: FullSMDraw = {
        studentId:     student.id,
        anaSector:     anaSektorler[newIndexes[0]] ?? "—",
        altSector:     altSektorler[newIndexes[1]] ?? "—",
        marka:         brandName,
        sektorDisplay: brand ? `${brand.mainSector} / ${brand.subSector}` : `${anaSektorler[newIndexes[0]]} / ${altSektorler[newIndexes[1]]}`,
        brandRule:     brand?.brandRule ?? "",
        purpose,
        platform:      format?.platform ?? "",
        contentType:   format ? `${format.dim} (${format.type})` : "",
      };

      // Önce inline sonuçları göster
      setPendingDraw(draw);
      setShowInlineResult(true);

      // Firestore'a kaydet
      const newDraws = [...drawsRef.current, draw];
      setDraws(newDraws);
      setDoc(doc(db, "lottery_results", task.id), {
        draws: newDraws, groupId: task.groupId ?? "", lastUpdated: serverTimestamp(),
      });
      addDoc(collection(db, "assignment_archive"), {
        taskId: task.id, taskName: task.name, type: "sosyal-medya",
        classId: task.classId ?? "", groupId: task.groupId ?? "",
        completedAt: serverTimestamp(),
        students: [{ id: student.id, name: student.name, lastName: student.lastName }],
        draws: [{
          studentId: student.id,
          draws: [
            { category: "Ana Sektör", item: { name: draw.anaSector } },
            { category: "Alt Sektör", item: { name: draw.altSector } },
            { category: "Marka",      item: { name: draw.marka } },
          ],
        }],
      });

      // Tüm grup tamamlandıysa görevi kapat
      if (groupStudentCount > 0 && newDraws.length >= groupStudentCount) {
        updateDoc(doc(db, "tasks", task.id), { status: "completed", isActive: true });
      }

      // 4sn bekle → modal + mail
      const tModal = setTimeout(() => {
        setPhase("result");
        setShowResult(true);
      }, 4000);
      timeoutRefs.current.push(tModal);

      // Mail otomatik gönder (inline gösterimle birlikte)
      if (student.email) {
        setMailStatus("sending");
        const sid = student.id;
        const pdfData: SocialPdfData = {
          studentName:   `${student.name} ${student.lastName}`.toUpperCase(),
          brandName:     draw.marka,
          sektorDisplay: draw.sektorDisplay,
          brandRule:     draw.brandRule,
          purpose:       draw.purpose,
          platform:      draw.platform,
          contentType:   draw.contentType,
          sharedRule:    pool?.sharedRule ?? "",
          date:          todayTR(),
        };
        generateSocialPdf(pdfData)
          .then(pdfBase64 =>
            fetch("/api/send-sosyal", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                to:          student.email,
                studentName: `${student.name} ${student.lastName}`,
                brandName:   draw.marka,
                pdfBase64,
              }),
            })
          )
          .then(res => {
            setMailStatus(res.ok ? "sent" : "error");
            if (res.ok) setAutoMailSentFor(prev => new Set([...prev, sid]));
          })
          .catch(() => setMailStatus("error"));
      }
    }, 7400);
    timeoutRefs.current.push(t);
  }, [selectedStudent, phase, poolReady, anaSektorler, altSektorler, markalar, task, groupStudentCount]);

  // ─── Devam / Kapat ───────────────────────────────────────────────────────────

  const handleAdvance = useCallback(() => {
    clearAll();
    autoPickRef.current = true;
    setShowResult(false);
    setShowInlineResult(false);
    setSelectedStudentId(null);
    setPickHighlightId(null);
    setNameVisible(false);
    setSpinKey(prev => prev + 1);
    setPhase("idle");
  }, [clearAll]);

  const handleClose = useCallback(() => {
    setShowResult(false);
    setShowInlineResult(false);
    setPhase("idle");
    setSelectedStudentId(null);
    setPickHighlightId(null);
    setNameVisible(false);
  }, []);

  // Sadece arşive yedekle — task status'a dokunmaz, 3 sn sonra /dashboard'a döner
  const handleArchive = useCallback(async () => {
    if (archiving || archived) return;
    setArchiving(true);
    try {
      await addDoc(collection(db, "assignment_archive"), {
        groupId:     task.groupId ?? "",
        taskId:      task.id,
        taskName:    task.name,
        type:        "sosyal-medya",
        completedAt: serverTimestamp(),
        students:    students.map(s => ({ id: s.id, name: s.name, lastName: s.lastName })),
        draws: drawsRef.current.map(d => ({
          studentId: d.studentId,
          draws: [
            { category: "Ana Sektör", item: { name: d.anaSector } },
            { category: "Alt Sektör", item: { name: d.altSector } },
            { category: "Marka",      item: { name: d.marka } },
          ],
        })),
      });
      if (groupStudentCount > 0 && drawsRef.current.length >= groupStudentCount) {
        await updateDoc(doc(db, "tasks", task.id), { status: "completed", isActive: true });
      }
      setArchived(true);
      setTimeout(() => router.push("/dashboard"), 3000);
    } finally {
      setArchiving(false);
    }
  }, [task, archiving, archived, students, groupStudentCount, router]);

  const handleFinalizeTask = useCallback(async () => {
    if (finalizing || finalized) return;
    setFinalizing(true);
    try {
      if (!archived) {
        await addDoc(collection(db, "assignment_archive"), {
          groupId:     task.groupId ?? "",
          taskId:      task.id,
          taskName:    task.name,
          type:        "sosyal-medya",
          completedAt: serverTimestamp(),
          students:    students.map(s => ({ id: s.id, name: s.name, lastName: s.lastName })),
          draws: drawsRef.current.map(d => ({
            studentId: d.studentId,
            draws: [
              { category: "Ana Sektör", item: { name: d.anaSector } },
              { category: "Alt Sektör", item: { name: d.altSector } },
              { category: "Marka",      item: { name: d.marka } },
            ],
          })),
        });
      }
      await updateDoc(doc(db, "tasks", task.id), { status: "completed", isActive: true });
      setFinalized(true);
      setTimeout(() => router.push("/dashboard"), 2000);
    } finally {
      setFinalizing(false);
    }
  }, [task, archived, students, finalizing, finalized, router]);

  // ─── Render ───────────────────────────────────────────────────────────────────

  const drawingStudentId = phase === "spinning" ? (selectedStudentId ?? null) : null;

  return (
    <>
      {/* ── CSS animasyonları ── */}
      <style>{`
        @keyframes nameBounce {
          0%   { transform:scale(0.05); opacity:0; }
          14%  { transform:scale(1.32); opacity:1; }
          26%  { transform:scale(0.78); }
          38%  { transform:scale(1.18); }
          50%  { transform:scale(0.88); }
          62%  { transform:scale(1.08); }
          72%  { transform:scale(0.94); }
          82%  { transform:scale(1.03); }
          91%  { transform:scale(0.98); }
          100% { transform:scale(1.00); }
        }
        @keyframes dotPulse {
          0%,80%,100%{transform:scale(0.6);opacity:0.4}
          40%{transform:scale(1);opacity:1}
        }
        @keyframes smFadeIn { from{opacity:0} to{opacity:1} }
      `}</style>

      <div className="min-h-screen flex" style={{ background: "#0d1526" }}>

        {/* Sol panel */}
        <SharedStudentPanel
          students={students}
          draws={studentDraws}
          catCount={3}
          taskLabel={task.name}
          onViewResult={() => {}}
          pickHighlightId={pickHighlightId}
          drawingStudentId={drawingStudentId}
          accentColor={ACCENT}
        />

        {/* Sağ — oyun alanı */}
        <div className="flex-1 flex flex-col">

          {/* Üst bar */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "20px 32px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
          }}>
            <button
              onClick={() => router.push("/dashboard")}
              style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(255,255,255,0.35)", background: "none", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600 }}
            >
              <ArrowLeft size={16} /> Ana Sayfa
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 10, background: "rgba(168,85,247,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Smartphone size={15} style={{ color: ACCENT }} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.80)" }}>{task.name}</span>
            </div>
            <div style={{ width: 100 }} />
          </div>

          {/* İçerik */}
          <div className="flex-1 flex flex-col items-center justify-center px-8 py-10 overflow-y-auto">

            {/* IDLE */}
            {phase === "idle" && !allDone && (
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.30)", textTransform: "uppercase", letterSpacing: "0.4em", marginBottom: 10 }}>
                  Çekiliş Hazır
                </p>
                <p style={{ fontSize: 15, color: "rgba(255,255,255,0.40)" }}>
                  Sıradaki katılımcıyı belirlemek için başlat'a bas.
                </p>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.25)", marginTop: 8 }}>
                  {remainingStudents.length} öğrenci bekliyor
                </p>
              </div>
            )}

            {/* PICKING */}
            {phase === "picking" && (
              <div style={{ textAlign: "center" }}>
                <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 8, height: 8, borderRadius: "50%", background: ACCENT,
                      animation: `dotPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.40)" }}>
                  Katılımcı seçiliyor...
                </p>
              </div>
            )}

            {/* READY */}
            {phase === "ready" && selectedStudent && (
              <div style={{ textAlign: "center" }}>
                <p style={{
                  fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.45em",
                  color: "rgba(255,255,255,0.28)", marginBottom: 20,
                  opacity: nameVisible ? 1 : 0, transition: "opacity 0.4s ease 0.5s",
                }}>
                  Ödev Alacak Katılımcı
                </p>
                {nameVisible && (
                  <h1 style={{
                    fontSize: "clamp(42px, 5.5vw, 72px)",
                    fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.1,
                    color: "white", margin: 0,
                    animation: "nameBounce 1.2s cubic-bezier(0.25,0.46,0.45,0.94) forwards",
                  }}>
                    <span style={{ color: "#ffffff" }}>{selectedStudent.name} </span>
                    <span style={{ color: "#c084fc" }}>{selectedStudent.lastName}</span>
                  </h1>
                )}
              </div>
            )}

            {/* SPINNING */}
            {phase === "spinning" && selectedStudent && (
              <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 40 }}>
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.45em", color: "rgba(255,255,255,0.28)", marginBottom: 14 }}>
                    Ödev Alacak Katılımcı
                  </p>
                  <h2 style={{
                    fontSize: "clamp(24px, 2.8vw, 38px)",
                    fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.2,
                    color: "white", margin: "0 0 8px",
                    animation: "smFadeIn 0.35s ease",
                  }}>
                    <span style={{ color: "#ffffff" }}>{selectedStudent.name} </span>
                    <span style={{ color: "#c084fc" }}>{selectedStudent.lastName}</span>
                  </h2>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "rgba(168,85,247,0.70)", letterSpacing: "0.04em" }}>
                    Ödeviniz çekiliyor...
                  </p>
                </div>

                <div style={{
                  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 28, padding: "40px 40px 32px", position: "relative",
                  width: "100%", maxWidth: 820,
                }}>
                  <div style={{
                    position: "absolute", top: -18, left: "50%", transform: "translateX(-50%)",
                    background: ACCENT, borderRadius: 100, padding: "6px 24px",
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "white", textTransform: "uppercase", letterSpacing: "0.12em" }}>
                      Reklam Bulucu
                    </span>
                  </div>

                  <div key={spinKey} style={{
                    display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 32,
                    padding: "16px 0 8px",
                  }}>
                    <SlotReel items={anaSektorler} isSpinning={true} finalIndex={finalIndexes[0]} delay={1800} label="Ana Sektör" accentColor={ACCENT} />
                    <SlotReel items={altSektorler} isSpinning={true} finalIndex={finalIndexes[1]} delay={3200} label="Alt Sektör" accentColor={ACCENT} />
                    <SlotReel items={markalar}     isSpinning={true} finalIndex={finalIndexes[2]} delay={4600} label="Marka" accentColor={ACCENT} />
                  </div>
                </div>

                {/* Inline sonuçlar — reeller durduktan sonra */}
                {showInlineResult && pendingDraw && (
                  <div style={{
                    width: "100%", maxWidth: 820,
                    background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.25)",
                    borderRadius: 16, padding: "20px 28px",
                    display: "flex", flexWrap: "wrap", gap: "12px 32px",
                    animation: "smFadeIn 0.5s ease",
                  }}>
                    {[
                      { label: "Marka",       val: pendingDraw.marka },
                      { label: "Sektör",      val: pendingDraw.sektorDisplay },
                      { label: "Amaç",        val: pendingDraw.purpose },
                      { label: "Platform",    val: pendingDraw.platform },
                      { label: "İçerik",      val: pendingDraw.contentType },
                    ].map(r => (
                      <div key={r.label} style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 140 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(168,85,247,0.6)" }}>
                          {r.label}
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>
                          {r.val || "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TÜMÜ TAMAMLANDI */}
            {allDone && (
              <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 20, paddingTop: 48 }}>
                <p style={{ fontSize: 18, fontWeight: 800, color: "rgba(255,255,255,0.80)" }}>
                  Bu oturumun tüm katılımcıları tamamlandı!
                </p>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.38)" }}>
                  Sonuçları arşive kaydedin veya ödevi tamamen kapatın.
                </p>

                {/* Arşive Kaydet */}
                <button
                  onClick={handleArchive}
                  disabled={archiving || archived}
                  style={{
                    padding: "14px 40px", borderRadius: 100,
                    background: "linear-gradient(135deg, #205297, #3a7bd5)",
                    boxShadow: "0 6px 20px rgba(58,123,213,0.25)",
                    color: "white", fontSize: 15, fontWeight: 800, border: "none",
                    cursor: archiving || archived ? "not-allowed" : "pointer",
                    opacity: archiving || archived ? 0.7 : 1,
                    transition: "opacity 0.2s",
                  }}
                >
                  {archiving ? "Kaydediliyor..." : archived ? "Arşive Kaydedildi ✓" : "Arşive Kaydet"}
                </button>

                {/* Ödevi Tamamla */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginTop: 4 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.22)", margin: 0 }}>
                    veya
                  </p>
                  {!confirmFinish ? (
                    <button
                      onClick={() => setConfirmFinish(true)}
                      style={{ fontSize: 14, fontWeight: 700, color: "rgba(248,113,113,0.70)", background: "none", border: "none", cursor: "pointer" }}
                    >
                      Ödevi Tamamla ve Ana Sayfaya Git →
                    </button>
                  ) : (
                    <div style={{
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                      padding: 16, borderRadius: 16,
                      background: "rgba(254,226,226,0.08)", border: "1px solid rgba(248,113,113,0.25)",
                    }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(252,165,165,0.90)", margin: 0 }}>
                        Ödev kapatılsın ve ana sayfaya dönülsün mü?
                      </p>
                      <p style={{ fontSize: 11, color: "rgba(252,165,165,0.55)", margin: 0 }}>
                        Eksik öğrenciler olsa bile ödev artık aktif olmayacak.
                      </p>
                      <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                        <button
                          onClick={() => { setConfirmFinish(false); handleFinalizeTask(); }}
                          style={{ padding: "8px 20px", borderRadius: 10, background: "#e53e3e", color: "white", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}
                        >
                          Evet, Tamamla
                        </button>
                        <button
                          onClick={() => setConfirmFinish(false)}
                          style={{ padding: "8px 20px", borderRadius: 10, background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.50)", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}
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

          {/* Alt buton alanı */}
          <div style={{
            display: "flex", justifyContent: "center", alignItems: "center",
            padding: "24px 32px",
            borderTop: "1px solid rgba(255,255,255,0.07)",
            minHeight: 88, gap: 16,
          }}>

            {/* idle → Başlat */}
            {phase === "idle" && !allDone && (
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <button
                  onClick={handleBeginPicking}
                  style={{
                    padding: "16px 52px", borderRadius: 100,
                    background: `linear-gradient(135deg, #7c3aed, #a855f7)`,
                    boxShadow: `0 8px 28px rgba(168,85,247,0.30)`,
                    color: "white", fontSize: 16, fontWeight: 800, border: "none", cursor: "pointer",
                  }}
                >
                  Başlat
                </button>
                {draws.length > 0 && !confirmFinish && (
                  <button
                    onClick={() => setConfirmFinish(true)}
                    style={{
                      padding: "16px 28px", borderRadius: 100, fontSize: 15, fontWeight: 700,
                      background: "transparent", border: "2px solid rgba(248,113,113,0.30)", color: "rgba(248,113,113,0.70)", cursor: "pointer",
                    }}
                  >
                    Ödevi Tamamla
                  </button>
                )}
                {confirmFinish && (
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.40)" }}>Eksik öğrencilerle kapat?</span>
                    <button onClick={() => { setConfirmFinish(false); handleFinalizeTask(); }}
                      style={{ padding: "10px 20px", borderRadius: 10, background: "#e53e3e", color: "white", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}>
                      Evet
                    </button>
                    <button onClick={() => setConfirmFinish(false)}
                      style={{ padding: "10px 20px", borderRadius: 10, background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}>
                      İptal
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ready → Çekiliş Başlat */}
            {phase === "ready" && (
              <button
                onClick={handleStartSpin}
                disabled={!poolReady}
                style={{
                  padding: "16px 52px", borderRadius: 100,
                  background: `linear-gradient(135deg, #276749, #38a169)`,
                  boxShadow: `0 8px 28px rgba(56,161,105,0.28)`,
                  color: "white", fontSize: 16, fontWeight: 800, border: "none",
                  cursor: poolReady ? "pointer" : "not-allowed",
                  opacity: nameVisible ? 1 : 0,
                  transition: "opacity 0.4s ease 0.4s",
                }}
              >
                Çekiliş Başlat
              </button>
            )}

            {/* spinning → bekleniyor */}
            {phase === "spinning" && (
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "16px 32px", borderRadius: 100,
                background: "rgba(168,85,247,0.10)", border: "1.5px solid rgba(168,85,247,0.25)",
                color: "rgba(255,255,255,0.45)", fontSize: 14, fontWeight: 600,
              }}>
                <div style={{ display: "flex", gap: 6 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 7, height: 7, borderRadius: "50%", background: ACCENT,
                      animation: `dotPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
                Çekiliş yapılıyor...
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Sonuç ekranı overlay */}
      {showResult && pendingDraw && selectedStudent && (
        <ResultOverlay
          draw={pendingDraw}
          student={selectedStudent}
          task={task}
          mailStatus={mailStatus}
          noMoreStudents={remainingStudents.filter(s => s.id !== selectedStudent.id).length === 0}
          onAdvance={handleAdvance}
          onClose={handleClose}
        />
      )}
    </>
  );
}

// ─── Sonuç Overlay ────────────────────────────────────────────────────────────

function ResultOverlay({
  draw, student, task, mailStatus, noMoreStudents, onAdvance, onClose,
}: {
  draw: FullSMDraw;
  student: Student;
  task: TaskData;
  mailStatus: "idle" | "sending" | "sent" | "error";
  noMoreStudents: boolean;
  onAdvance: () => void;
  onClose: () => void;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), 30); return () => clearTimeout(t); }, []);

  const tableRows = [
    { key: "Marka Kuralı",  val: draw.brandRule   || "—" },
    { key: "Amaç / Hedef",  val: draw.purpose     || "—" },
    { key: "Platform",      val: draw.platform    || "—" },
    { key: "İçerik Türü",   val: draw.contentType || "—" },
  ];

  const deadline = task.endDate
    ? (() => { const [y, m, d] = task.endDate!.split("-"); return `${d}.${m}.${y}`; })()
    : todayTR();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{
        background:  visible ? "rgba(6,13,26,0.92)"  : "rgba(6,13,26,0)",
        transition:  "background 0.4s ease",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        style={{
          width: "100%", maxWidth: 640,
          maxHeight: "92vh", overflowY: "auto",
          background: "white", borderRadius: 20,
          boxShadow: "0 40px 100px rgba(0,0,0,0.65)",
          opacity:   visible ? 1 : 0,
          transform: visible ? "scale(1) translateY(0)" : "scale(0.92) translateY(20px)",
          transition: "all 0.45s cubic-bezier(0.34,1.56,0.64,1)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Başlık */}
        <div style={{ textAlign: "center", padding: "32px 40px 20px", borderBottom: "2px solid #f0f0f0" }}>
          <p style={{ fontSize: 20, fontWeight: 800, color: "#1B5EBF", letterSpacing: "0.04em", margin: "0 0 4px" }}>
            SOSYAL MEDYA YÖNETİMİ
          </p>
          <p style={{ fontSize: 12, color: "#888", letterSpacing: "0.15em", margin: 0, textTransform: "uppercase" }}>
            ÖDEV KARTI
          </p>
        </div>

        {/* Marka + öğrenci */}
        <div style={{ padding: "20px 40px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{ fontSize: 22, fontWeight: 800, color: "#111", margin: "0 0 4px" }}>
              Marka: {draw.marka}
            </p>
            <p style={{ fontSize: 12, fontStyle: "italic", color: "#666", margin: 0 }}>
              Sektör: {draw.sektorDisplay}
            </p>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <p style={{ fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 2px" }}>Öğrenci</p>
            <p style={{ fontSize: 14, fontWeight: 800, color: "#111", margin: 0 }}>
              {student.name} {student.lastName}
            </p>
          </div>
        </div>

        {/* Tablo */}
        <div style={{ margin: "0 40px 20px", border: "1px solid #ddd", borderRadius: 6, overflow: "hidden" }}>
          {tableRows.map((row, i) => (
            <div key={row.key} style={{
              display: "flex",
              borderBottom: i < tableRows.length - 1 ? "1px solid #ddd" : "none",
            }}>
              <div style={{
                width: 130, flexShrink: 0, padding: "10px 14px",
                background: "#f8f8f8", borderRight: "1px solid #ddd",
                fontSize: 11, fontWeight: 700, color: "#333",
                display: "flex", alignItems: "center",
              }}>
                {row.key}
              </div>
              <div style={{ flex: 1, padding: "10px 14px", fontSize: 13, color: "#222", lineHeight: 1.55 }}>
                {row.val}
              </div>
            </div>
          ))}
        </div>

        {/* Mail durumu */}
        {student.email && (
          <div style={{
            margin: "0 40px 20px",
            padding: "10px 14px",
            borderRadius: 8,
            background: mailStatus === "sent" ? "#f0fdf4" : mailStatus === "error" ? "#fef2f2" : "#f8f9fa",
            border: `1px solid ${mailStatus === "sent" ? "#bbf7d0" : mailStatus === "error" ? "#fecaca" : "#e9ecef"}`,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            {mailStatus === "sending" && <div style={{ width: 13, height: 13, border: "2px solid #ccc", borderTopColor: "#666", borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0 }} />}
            {mailStatus === "sent"    && <Check size={13} style={{ color: "#16a34a", flexShrink: 0 }} strokeWidth={3} />}
            {mailStatus === "error"   && <Mail  size={13} style={{ color: "#dc2626", flexShrink: 0 }} />}
            {mailStatus === "idle"    && <Mail  size={13} style={{ color: "#aaa", flexShrink: 0 }} />}
            <span style={{ fontSize: 12, color: mailStatus === "sent" ? "#15803d" : mailStatus === "error" ? "#dc2626" : "#666" }}>
              {mailStatus === "sending" ? "PDF hazırlanıyor, mail gönderiliyor..."
               : mailStatus === "sent"  ? `PDF ekte gönderildi → ${student.email}`
               : mailStatus === "error" ? "Mail gönderilemedi"
               : student.email}
            </span>
          </div>
        )}

        {/* Teslim tarihi */}
        <div style={{ padding: "0 40px 20px", textAlign: "right" }}>
          <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>
            Oluşturulma Tarihi: {todayTR()}
          </p>
        </div>

        {/* Alt çizgi */}
        <div style={{ margin: "0 40px", height: 2, background: "linear-gradient(90deg, #1B5EBF, #a855f7)" }} />

        {/* Butonlar */}
        <div style={{ padding: "20px 40px 28px", display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "12px 28px", borderRadius: 12,
              background: "transparent", border: "2px solid #e2e8f0",
              color: "#666", fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}
          >
            Kapat
          </button>
          <button
            onClick={noMoreStudents ? onClose : onAdvance}
            style={{
              padding: "12px 32px", borderRadius: 12,
              background: noMoreStudents ? "#94a3b8" : "#1B5EBF",
              boxShadow: noMoreStudents ? "none" : "0 4px 14px rgba(27,94,191,0.30)",
              color: "white", fontSize: 14, fontWeight: 800, border: "none",
              cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            {noMoreStudents ? "Bitti" : <>YENİ SEÇİM <ChevronRight size={15} strokeWidth={2.5} /></>}
          </button>
        </div>
      </div>
    </div>
  );
}
