import { useState, useRef, useCallback, useEffect } from "react";
import type { Student } from "./types";

interface Options {
  remainingStudents: Student[];
  /** Picking animasyonu tamamlanıp isim ortaya çıkınca çağrılır */
  onStudentReady: (student: Student) => void;
}

export type PickingPhase = "idle" | "picking" | "ready";

export function usePickingEngine({ remainingStudents, onStudentReady }: Options) {
  const [phase,            setPhase]           = useState<PickingPhase>("idle");
  const [pickHighlightId,  setPickHighlightId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [nameVisible,      setNameVisible]     = useState(false);

  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRefs   = useRef<ReturnType<typeof setTimeout>[]>([]);
  const autoPickRef   = useRef(false);

  const clearAll = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    timeoutRefs.current.forEach(t => clearTimeout(t));
    timeoutRefs.current = [];
  }, []);

  useEffect(() => () => clearAll(), [clearAll]);

  const beginPicking = useCallback(() => {
    if (remainingStudents.length === 0) return;
    clearAll();
    setPhase("picking");
    setPickHighlightId(null);
    setNameVisible(false);
    setSelectedStudentId(null);

    const winner  = remainingStudents[Math.floor(Math.random() * remainingStudents.length)];
    const cycleMs = remainingStudents.length === 1 ? 0 : 2800;

    const t0 = setTimeout(() => {
      if (remainingStudents.length > 1) {
        let shuffled: Student[] = [];
        let shuffleIdx = 0;
        const reshuffle = () => {
          shuffled = [...remainingStudents].sort(() => Math.random() - 0.5);
          shuffleIdx = 0;
        };
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
            const t3 = setTimeout(() => {
              setPhase("ready");
              onStudentReady(winner);
            }, 800);
            timeoutRefs.current.push(t3);
          }, 300);
          timeoutRefs.current.push(t2);
        }, 3 * BLINK * 2 + 80);
        timeoutRefs.current.push(revealT);
      }, cycleMs);

      timeoutRefs.current.push(t1);
    }, 250);

    timeoutRefs.current.push(t0);
  }, [remainingStudents, clearAll, onStudentReady]);

  // YENİ SEÇİM → idle'a dönünce otomatik picking başlat
  const resetToIdle = useCallback(() => {
    clearAll();
    autoPickRef.current = true;
    setPhase("idle");
    setPickHighlightId(null);
    setNameVisible(false);
    setSelectedStudentId(null);
  }, [clearAll]);

  useEffect(() => {
    if (phase === "idle" && autoPickRef.current && remainingStudents.length > 0) {
      autoPickRef.current = false;
      beginPicking();
    }
  }, [phase, remainingStudents, beginPicking]);

  return {
    phase,
    pickHighlightId,
    selectedStudentId,
    nameVisible,
    beginPicking,
    resetToIdle,
    clearAll,
    intervalRef,
    timeoutRefs,
  };
}
