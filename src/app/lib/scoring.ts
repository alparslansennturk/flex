// ─── FlexOS Merkezi Puan Hesaplama Motoru ─────────────────────────────────────

export interface ScoringSettings {
  leaderboard:         { minTaskDivisor: number };
  certificateWeights:  { project: number; assignment: number };
  latePenalty:         { week1: number; week2: number; week3plus: number };
  difficultyXP:        { level1: number; level2: number; level3: number; level4: number };
}

export const DEFAULT_SCORING: ScoringSettings = {
  leaderboard:        { minTaskDivisor: 3 },
  certificateWeights: { project: 0.70, assignment: 0.30 },
  latePenalty:        { week1: 0.80, week2: 0.60, week3plus: 0.50 },
  difficultyXP:       { level1: 50, level2: 100, level3: 200, level4: 400 },
};

// Seviye → difficultyXP anahtarı eşlemesi
const LEVEL_KEY_MAP: Record<string, keyof ScoringSettings["difficultyXP"]> = {
  "Seviye-1": "level1",
  "Seviye-2": "level2",
  "Seviye-3": "level3",
  "Seviye-4": "level4",
};

/** Seviye adından temel XP değerini döndürür */
export function getLevelXP(
  level: string | undefined,
  settings: ScoringSettings,
): number {
  const key = level ? LEVEL_KEY_MAP[level] : undefined;
  return key ? settings.difficultyXP[key] : settings.difficultyXP.level1;
}

/** Kaç hafta geç teslim edildiğine göre ceza çarpanı döndürür */
export function getLatePenalty(weeksLate: number, settings: ScoringSettings): number {
  if (weeksLate <= 0) return 1.0;
  if (weeksLate === 1) return settings.latePenalty.week1;
  if (weeksLate === 2) return settings.latePenalty.week2;
  return settings.latePenalty.week3plus;
}

/** baseXP × latePenaltyMultiplier — tüm sistemde tek XP fonksiyonu */
export function calculateXP(
  level:      string | undefined,
  weeksLate:  number,
  settings:   ScoringSettings,
): number {
  return Math.round(getLevelXP(level, settings) * getLatePenalty(weeksLate, settings));
}

/** Leaderboard sıralama puanı: totalXP ÷ max(completedTasks, minTaskDivisor) */
export function calculateLeaderboardScore(
  totalXP:        number,
  completedTasks: number,
  settings:       ScoringSettings,
): number {
  return totalXP / Math.max(completedTasks, settings.leaderboard.minTaskDivisor);
}
