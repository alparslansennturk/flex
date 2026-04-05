// ─── FlexOS Merkezi Puan Hesaplama Motoru ─────────────────────────────────────

export interface ScoringSettings {
  leaderboard:         { minTaskDivisor: number; logBase: number; bonusMultiplier: number };
  certificateWeights:  { project: number; assignment: number };
  latePenalty:         { week1: number; week2: number; week3plus: number };
  difficultyXP:        { level1: number; level2: number; level3: number; level4: number };
}

export const DEFAULT_SCORING: ScoringSettings = {
  leaderboard:        { minTaskDivisor: 3, logBase: 2, bonusMultiplier: 1 },
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

/**
 * Öğrencinin gradedTasks haritasından unique görev istatistiklerini hesaplar.
 * XP event bazlı artırılmaz — her taskId için tek kayıt tutulur.
 */
export interface GradedTaskEntry {
  xp:        number;
  penalty:   number;
  seasonId?: string;  // hangi sezona ait (undefined = "season_1")
  classId?:  string;  // görevin ait olduğu sınıf (arşivden silinse bile XP korunur)
  endDate?:  string;  // görevin bitiş tarihi (arşivden silinse bile recency korunur)
  maxXp?:    number;  // görevin max kazanılabilir XP'si (arşivden silinse bile odevPuani hesaplanabilsin)
}

/**
 * Öğrencinin gradedTasks haritasından unique görev istatistiklerini hesaplar.
 * - isScoreHidden = true → soft reset uygulanmış, tüm değerler 0 döner
 * - activeSeasonId verilirse sadece o sezondaki görevler sayılır
 * - seasonId'siz eski kayıtlar "season_1" olarak kabul edilir
 */
/** NaN / Infinity güvenlik kalkanı */
export function safe(n: number): number {
  return isFinite(n) && !isNaN(n) ? n : 0;
}

/**
 * Logaritmik görev bonusu: 1 + (log_base(max(tasks,1)) × multiplier)
 * - logBase min 2 (daha küçük taban = daha agresif büyüme)
 * - bonusMultiplier min 0.1 (bonus etkisini ölçekler)
 */
export function calcTaskBonus(
  completedTasks: number,
  logBase: number = 2,
  bonusMultiplier: number = 1,
): number {
  const base = Math.max(logBase, 2);
  const mult = Math.max(bonusMultiplier, 0.1);
  return 1 + (Math.log(Math.max(completedTasks, 1)) / Math.log(base)) * mult;
}

/**
 * Temel skor = (totalXP / max(tasks, minTaskDivisor)) × taskBonus + (completedTasks × 3)
 * Son terim: görev sayısı arttıkça puan her zaman az da olsa artar.
 * settings opsiyonel — verilmezse DEFAULT_SCORING kullanılır
 */
export function calcScore(
  totalXP: number,
  completedTasks: number,
  settings?: ScoringSettings,
): number {
  const lb = settings?.leaderboard ?? DEFAULT_SCORING.leaderboard;
  const avg = totalXP / Math.max(completedTasks, lb.minTaskDivisor);
  return safe(avg * calcTaskBonus(completedTasks, lb.logBase, lb.bonusMultiplier) + completedTasks * 3);
}

/** Final skor: %70 genel + %30 son 30 gün */
export function calcFinalScore(generalScore: number, recentScore: number): number {
  return safe(generalScore * 0.7 + recentScore * 0.3);
}

export function computeStudentStats(
  gradedTasks:    Record<string, GradedTaskEntry> | undefined,
  isScoreHidden?: boolean,
  activeSeasonId?: string,
): { totalXP: number; completedTasks: number; latePenaltyTotal: number } {
  if (isScoreHidden) return { totalXP: 0, completedTasks: 0, latePenaltyTotal: 0 };
  const all = Object.values(gradedTasks ?? {});
  const entries = activeSeasonId
    ? all.filter(v => (v.seasonId ?? "season_1") === activeSeasonId)
    : all;
  return {
    totalXP:          entries.reduce((s, v) => s + (v.xp      ?? 0), 0),
    completedTasks:   entries.length,
    latePenaltyTotal: entries.reduce((s, v) => s + (v.penalty ?? 0), 0),
  };
}
