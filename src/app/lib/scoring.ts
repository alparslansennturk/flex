// ─── FlexOS Merkezi Puan Hesaplama Motoru ─────────────────────────────────────

export interface ScoringSettings {
  leaderboard:         { minTaskDivisor: number; logBase: number; bonusMultiplier: number };
  certificateWeights:  { project: number; assignment: number };
  latePenalty:         { week1: number; week2: number; week3plus: number };
  difficultyXP:        { level1: number; level2: number; level3: number; level4: number };
}

export const DEFAULT_SCORING: ScoringSettings = {
  leaderboard:        { minTaskDivisor: 3, logBase: 2, bonusMultiplier: 0.85 },
  certificateWeights: { project: 0.70, assignment: 0.30 },
  latePenalty:        { week1: 0.80, week2: 0.60, week3plus: 0.50 },
  difficultyXP:       { level1: 100, level2: 200, level3: 300, level4: 400 },
};

// Seviye → difficultyXP anahtarı eşlemesi
// Yeni format (boşluklu) ve eski format (tireli) her ikisi de desteklenir
const LEVEL_KEY_MAP: Record<string, keyof ScoringSettings["difficultyXP"]> = {
  "Seviye 1": "level1",
  "Seviye 2": "level2",
  "Seviye 3": "level3",
  // Eski format — geriye dönük uyumluluk (mevcut kartlar için)
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
  xp:          number;
  penalty:     number;
  seasonId?:   string;  // hangi sezona ait (undefined = "season_1")
  classId?:    string;  // görevin ait olduğu sınıf (arşivden silinse bile XP korunur)
  endDate?:    string;  // görevin bitiş tarihi / deadline
  completedAt?: string; // öğrencinin teslim ettiği / puanın verildiği tarih (YYYY-MM-DD) — aylık hesaplamada kullanılır
  maxXp?:      number;  // görevin max kazanılabilir XP'si (arşivden silinse bile odevPuani hesaplanabilsin)
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
 * Ana puan formülü — tüm sistemde tek kaynak.
 *
 * adjustedXP      = totalXP + tasks × 3
 * averageXP       = adjustedXP / max(tasks, minTaskDivisor)
 * bonus           = 1 + log2(tasks) × bonusMultiplier
 * completionRate  = 0.55 + 0.45 × (tasks / totalAssignedTasks)  [varsayılan: 1.0]
 * progressBonus   = tasks × 5
 * score           = (averageXP × bonus) × completionRate + progressBonus
 *
 * Garantiler:
 * - Her ek görev puanı en az ~5 puan artırır (progressBonus)
 * - completedTasks > totalAssignedTasks olamaz (Math.max ile kırpılır)
 * settings opsiyonel — verilmezse DEFAULT_SCORING kullanılır
 * totalAssignedTasks opsiyonel — verilmezse completedTasks kullanılır (rate = 1.0)
 */
export function calcScore(
  totalXP: number,
  completedTasks: number,
  settings?: ScoringSettings,
  totalAssignedTasks?: number,
): number {
  const lb    = settings?.leaderboard ?? DEFAULT_SCORING.leaderboard;
  const tasks = Math.max(completedTasks, 0);

  const adjustedXP     = totalXP + tasks * 3;
  const averageXP      = adjustedXP / Math.max(tasks, lb.minTaskDivisor);
  const bonus          = 1 + Math.log2(Math.max(tasks, 1)) * lb.bonusMultiplier;
  const assigned       = Math.max(totalAssignedTasks ?? tasks, tasks);
  const completionRate = assigned > 0 ? 0.55 + 0.45 * (tasks / assigned) : 1.0;
  const progressBonus  = tasks * 2.5;

  return safe((averageXP * bonus) * completionRate + progressBonus);
}

/** Final skor: %70 genel + %30 son 30 gün */
export function calcFinalScore(generalScore: number, recentScore: number): number {
  return safe(generalScore * 0.7 + recentScore * 0.3);
}

/**
 * TEK KAYNAK — Öğrenci final skorunu hesaplar.
 * Tüm UI ekranları bu fonksiyonu kullanır, başka yerde hesaplama yapılmaz.
 *
 * newXP            = bu dönemde kazanılan XP (carryOver XP olarak eklenmez)
 * carryOverScore   = önceki dönem finalScore × 0.10 (sadece final'a eklenir)
 * penaltyRate      = [0–1] aralığında ceza oranı (varsayılan 0)
 *
 * newScore  = (averageXP × bonus) × completionRate + progressBonus
 * finalScore = (newScore + carryOverScore) × (1 - penaltyRate)
 */
export interface FinalScoreDebug {
  newXP:          number;
  carryOverScore: number;
  adjustedXP:     number;
  averageXP:      number;
  bonus:          number;
  completionRate: number;
  progressBonus:  number;
  newScore:       number;
  finalScore:     number;
}

export function calcStudentFinalScore(
  newXP:               number,
  completedTasks:      number,
  settings?:           ScoringSettings,
  totalAssignedTasks?: number,
  carryOverScore:      number = 0,
  penaltyRate:         number = 0,
): { newScore: number; finalScore: number; debug: FinalScoreDebug } {
  const lb    = settings?.leaderboard ?? DEFAULT_SCORING.leaderboard;
  const tasks = Math.max(completedTasks, 0);

  const adjustedXP     = newXP + tasks * 3;
  const averageXP      = adjustedXP / Math.max(tasks, lb.minTaskDivisor);
  const bonus          = 1 + Math.log2(Math.max(tasks, 1)) * lb.bonusMultiplier;
  const assigned       = Math.max(totalAssignedTasks ?? tasks, tasks);
  const completionRate = assigned > 0 ? 0.55 + 0.45 * (tasks / assigned) : 1.0;
  const progressBonus  = tasks * 2.5;
  const newScore       = safe((averageXP * bonus) * completionRate + progressBonus);

  const carry      = Math.max(carryOverScore, 0);
  const rate       = Math.min(Math.max(penaltyRate, 0), 1);
  let   finalScore = safe((newScore + carry) * (1 - rate));

  const debug: FinalScoreDebug = {
    newXP, carryOverScore: carry, adjustedXP, averageXP,
    bonus, completionRate, progressBonus, newScore, finalScore,
  };

  if (typeof process !== "undefined" && process.env.NODE_ENV === "development") {
    console.log("[calcStudentFinalScore]", debug);
  }

  return { newScore, finalScore, debug };
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
