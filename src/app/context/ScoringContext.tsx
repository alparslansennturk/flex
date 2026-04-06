"use client";

import React, {
  createContext, useContext, useEffect, useState, useCallback,
} from "react";
import { db } from "@/app/lib/firebase";
import {
  doc, onSnapshot, setDoc, getDoc, collection, getDocs, serverTimestamp, writeBatch,
} from "firebase/firestore";
import {
  ScoringSettings, DEFAULT_SCORING, calculateXP, getLevelXP,
} from "@/app/lib/scoring";

const SCORING_DOC = () => doc(db, "settings", "scoring");

interface ScoringContextType {
  settings:       ScoringSettings;
  activeSeasonId: string;
  loading:        boolean;
  saveSettings:   (s: ScoringSettings) => Promise<void>;
  recalculateAll: (s: ScoringSettings) => Promise<{ updated: number }>;
  bumpSeason:     () => Promise<string>;  // Yeni sezon başlat (soft reset)
  revertSeason:   () => Promise<void>;    // Önceki sezona dön (soft reset geri al)
}

const ScoringContext = createContext<ScoringContextType>({
  settings:       DEFAULT_SCORING,
  activeSeasonId: "season_1",
  loading:        true,
  saveSettings:   async () => {},
  recalculateAll: async () => ({ updated: 0 }),
  bumpSeason:     async () => "season_1",
  revertSeason:   async () => {},
});

export function ScoringProvider({ children }: { children: React.ReactNode }) {
  const [settings,       setSettings]       = useState<ScoringSettings>(DEFAULT_SCORING);
  const [activeSeasonId, setActiveSeasonId] = useState("season_1");
  const [loading,        setLoading]        = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(SCORING_DOC(), snap => {
      if (snap.exists()) {
        const data = snap.data() as any;
        // Firestore belgesi eksik alan içerebilir (ör. sadece seasonCounter varsa)
        // — her zaman DEFAULT_SCORING ile iç içe merge et
        setSettings({
          leaderboard:        { ...DEFAULT_SCORING.leaderboard,        ...(data.leaderboard        ?? {}) },
          certificateWeights: { ...DEFAULT_SCORING.certificateWeights, ...(data.certificateWeights ?? {}) },
          latePenalty:        { ...DEFAULT_SCORING.latePenalty,        ...(data.latePenalty        ?? {}) },
          difficultyXP:       { ...DEFAULT_SCORING.difficultyXP,       ...(data.difficultyXP       ?? {}) },
        });
        setActiveSeasonId(data.activeSeasonId ?? "season_1");
      }
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  /**
   * Soft reset: yeni bir sezon başlatır.
   * Yeni görevler bu seasonId ile kaydedilir → eski veriler leaderboard'da görünmez.
   * Geri yüklenebilir: revertSeason() ile önceki sezona dönülebilir.
   */
  const bumpSeason = useCallback(async (): Promise<string> => {
    const snap = await getDoc(SCORING_DOC());
    const current: number = snap.exists() ? ((snap.data() as any).seasonCounter ?? 1) : 1;
    const next = current + 1;
    const newSeasonId = `season_${next}`;
    await setDoc(SCORING_DOC(), { seasonCounter: next, activeSeasonId: newSeasonId }, { merge: true });
    return newSeasonId;
  }, []);

  /**
   * Soft reset'i geri al: bir önceki sezona döner.
   * "Gizli Puanları Aç" işlemiyle birlikte çağrılır — eski puanlar tekrar görünür.
   */
  const revertSeason = useCallback(async (): Promise<void> => {
    const snap = await getDoc(SCORING_DOC());
    const current: number = snap.exists() ? ((snap.data() as any).seasonCounter ?? 1) : 1;
    if (current <= 1) return; // zaten ilk sezondayız, geri alınacak bir şey yok
    const prev = current - 1;
    await setDoc(SCORING_DOC(), { seasonCounter: prev, activeSeasonId: `season_${prev}` }, { merge: true });
  }, []);

  /**
   * Ayarlar değiştiğinde tüm öğrencilerin gradedTasks haritasını
   * yeni XP değerleriyle günceller (seasonId korunur).
   */
  const recalculateAll = useCallback(async (newSettings: ScoringSettings) => {
    const [tasksSnap, studentsSnap] = await Promise.all([
      getDocs(collection(db, "tasks")),
      getDocs(collection(db, "students")),
    ]);

    // Mevcut seasonId'leri koru
    const studentGradedTasks: Record<string, Record<string, any>> = {};
    studentsSnap.docs.forEach(d => {
      studentGradedTasks[d.id] = (d.data() as any).gradedTasks ?? {};
    });

    // Görevlerden yeni XP değerlerini hesapla
    const newEntries: Record<string, Record<string, any>> = {};

    tasksSnap.docs.forEach(d => {
      const task = d.data() as any;
      if (!task.isGraded || !task.grades) return;
      const baseXP = getLevelXP(task.level, newSettings);

      Object.entries(
        task.grades as Record<string, { submitted: boolean; weeksLate: number }>
      ).forEach(([sid, grade]) => {
        if (!grade.submitted) return;
        const xp      = calculateXP(task.level, grade.weeksLate ?? 0, newSettings);
        const penalty = Math.max(baseXP - xp, 0);
        const existing = studentGradedTasks[sid]?.[d.id] ?? {};
        if (!newEntries[sid]) newEntries[sid] = {};
        // Mevcut tüm alanları koru (classId, endDate, maxXp, seasonId) — sadece xp ve penalty güncelle
        newEntries[sid][d.id] = {
          ...existing,
          xp,
          penalty,
          maxXp: baseXP,
        };
      });
    });

    // Batch update
    const sids = Object.keys(newEntries);
    for (let i = 0; i < sids.length; i += 500) {
      const batch = writeBatch(db);
      sids.slice(i, i + 500).forEach(sid => {
        const updates: Record<string, any> = {};
        Object.entries(newEntries[sid]).forEach(([taskId, entry]) => {
          updates[`gradedTasks.${taskId}`] = entry;
        });
        batch.update(doc(db, "students", sid), updates);
      });
      await batch.commit();
    }

    return { updated: sids.length };
  }, []);

  const saveSettings = useCallback(async (newSettings: ScoringSettings) => {
    // activeSeasonId ve seasonCounter alanlarını koruyarak kaydet
    const snap = await getDoc(SCORING_DOC());
    const extra = snap.exists()
      ? { activeSeasonId: (snap.data() as any).activeSeasonId ?? "season_1", seasonCounter: (snap.data() as any).seasonCounter ?? 1 }
      : { activeSeasonId: "season_1", seasonCounter: 1 };
    await setDoc(SCORING_DOC(), { ...newSettings, ...extra, updatedAt: serverTimestamp() });
    await recalculateAll(newSettings);
  }, [recalculateAll]);

  return (
    <ScoringContext.Provider value={{ settings, activeSeasonId, loading, saveSettings, recalculateAll, bumpSeason, revertSeason }}>
      {children}
    </ScoringContext.Provider>
  );
}

export const useScoring = () => useContext(ScoringContext);
