"use client";

import React, {
  createContext, useContext, useEffect, useState, useCallback,
} from "react";
import { db } from "@/app/lib/firebase";
import {
  doc, onSnapshot, setDoc, collection, getDocs, updateDoc, serverTimestamp,
} from "firebase/firestore";
import {
  ScoringSettings, DEFAULT_SCORING, calculateXP,
} from "@/app/lib/scoring";

const SCORING_DOC = () => doc(db, "settings", "scoring");

interface ScoringContextType {
  settings:       ScoringSettings;
  loading:        boolean;
  saveSettings:   (s: ScoringSettings) => Promise<void>;
  recalculateAll: (s: ScoringSettings) => Promise<{ updated: number }>;
}

const ScoringContext = createContext<ScoringContextType>({
  settings:       DEFAULT_SCORING,
  loading:        true,
  saveSettings:   async () => {},
  recalculateAll: async () => ({ updated: 0 }),
});

export function ScoringProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<ScoringSettings>(DEFAULT_SCORING);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(SCORING_DOC(), snap => {
      if (snap.exists()) setSettings(snap.data() as ScoringSettings);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  /**
   * Tüm notlanmış görevlerin grades verisinden her öğrencinin
   * toplam puanını yeni ayarlara göre yeniden hesaplar.
   * students koleksiyonundaki points alanını günceller.
   */
  const recalculateAll = useCallback(async (newSettings: ScoringSettings) => {
    const [tasksSnap, studentsSnap] = await Promise.all([
      getDocs(collection(db, "tasks")),
      getDocs(collection(db, "students")),
    ]);

    // Her öğrenci için tüm notlanmış görevlerden XP topla
    const studentXP: Record<string, number> = {};

    tasksSnap.docs.forEach(d => {
      const task = d.data();
      if (!task.isGraded || !task.grades) return;

      Object.entries(
        task.grades as Record<string, { submitted: boolean; weeksLate: number }>
      ).forEach(([studentId, grade]) => {
        if (!grade.submitted) return;
        const xp = calculateXP(task.level, grade.weeksLate ?? 0, newSettings);
        studentXP[studentId] = (studentXP[studentId] ?? 0) + xp;
      });
    });

    // Öğrenci puanlarını güncelle
    const updates = studentsSnap.docs
      .filter(d => studentXP[d.id] !== undefined)
      .map(d => updateDoc(doc(db, "students", d.id), { points: studentXP[d.id] }));

    await Promise.all(updates);
    return { updated: updates.length };
  }, []);

  const saveSettings = useCallback(async (newSettings: ScoringSettings) => {
    await setDoc(SCORING_DOC(), { ...newSettings, updatedAt: serverTimestamp() });
    await recalculateAll(newSettings);
  }, [recalculateAll]);

  return (
    <ScoringContext.Provider value={{ settings, loading, saveSettings, recalculateAll }}>
      {children}
    </ScoringContext.Provider>
  );
}

export const useScoring = () => useContext(ScoringContext);
