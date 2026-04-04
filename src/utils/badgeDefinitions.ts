// Badge slug constants and threshold configs for detection logic

export const RARITY_PRIORITY: Record<string, number> = {
  legendary: 4,
  epic: 3,
  rare: 2,
  common: 1,
};

// Daily FP+ thresholds
export const DAILY_FP_THRESHOLDS = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export const dailyFpSlug = (n: number) => `daily_fp_${n}`;

// Weekly FP+ thresholds
export const WEEKLY_FP_THRESHOLDS = [10, 15, 20, 30, 40] as const;
export const weeklyFpSlug = (n: number) => `weekly_fp_${n}`;

// Weekly PRMR thresholds
export const WEEKLY_PRMR_THRESHOLDS = [1700, 2550, 3400] as const;
export const weeklyPrmrSlug = (n: number) => `weekly_prmr_${n}`;

// Season club thresholds
export const CLUB_THRESHOLDS = [20, 40, 60, 80, 100, 120, 140, 160, 200, 240, 300, 350, 400, 450, 500, 550, 600] as const;
export const clubSlug = (n: number) => `club_${n}`;

// Streak thresholds
export const TRANSITION_STREAK_THRESHOLDS = [3, 5, 7, 10, 14, 21, 30] as const;
export const PRESENTATION_STREAK_THRESHOLDS = [3, 5, 7, 10, 14, 21, 30] as const;
export const SALES_STREAK_THRESHOLDS = [3, 6, 10, 12, 18, 24, 30, 36, 42, 60] as const;

export const transitionStreakSlug = (n: number) => `streak_transition_${n}`;
export const presentationStreakSlug = (n: number) => `streak_presentation_${n}`;
export const salesStreakSlug = (n: number) => `streak_sales_${n}`;

// Multi-sale streak definitions
const MS_DAYS = [3, 6, 10, 12, 18, 24] as const;
export const MULTI_SALE_STREAKS = [
  ...MS_DAYS.map(d => ({ min: 2, days: d, slug: `streak_multi_2_${d}` })),
  ...MS_DAYS.map(d => ({ min: 3, days: d, slug: `streak_multi_3_${d}` })),
  ...MS_DAYS.map(d => ({ min: 4, days: d, slug: `streak_multi_4_${d}` })),
] as const;

// Special badge slugs
export const SPECIAL_SLUGS = {
  FIRST_DOOR_MAGIC: 'first_door_magic',
  NIGHT_OWL: 'night_owl',
  FIRST_BLOOD: 'first_blood',
  ONE_TWO_COMBO: 'one_two_combo',
  UPGRADE_ASSASSIN: 'upgrade_assassin',
  FIRST_DOOR: 'first_door',
  FIRST_TRANSITION: 'first_transition',
  FIRST_PRESENTATION: 'first_presentation',
  FIRST_SALE: 'first_sale',
} as const;

// Streak freeze rules
export const STREAK_FREEZE = {
  transition: { field: 'doors_knocked' as const, threshold: 80 },
  presentation: { field: 'transitions' as const, threshold: 2 },
  sales: null, // no freeze allowed
} as const;

// Streak protection config
export const STREAK_PROTECTION = {
  /** Multiplier for effort-based protection (150% of season average) */
  EFFORT_MULTIPLIER: 1.5,
  /** Recovery multiplier (200% of season average over 2 knocking days) */
  RECOVERY_MULTIPLIER: 2.0,
  /** Max protections per rolling 7-day window */
  MAX_PER_WEEK_VET: 1,
  MAX_PER_WEEK_ROOKIE: 2,
  /** Minimum knocking days of history before protection is available */
  MIN_HISTORY_DAYS: 5,
  /** Default floor for new rookies with < 5 days history */
  ROOKIE_DEFAULT_DOORS: 60,
  /** Default floor for new vets with < 5 days history */
  VET_DEFAULT_TRANSITIONS: 2,
  /** Recovery window: number of knocking days (excluding Sundays) */
  RECOVERY_KNOCKING_DAYS: 2,
} as const;

// Season date boundaries
export const SEASON_DATES = {
  PRESEASON_START: '2025-09-28',
  SUMMER_START_GLOBAL: '2026-04-12',
  SUMMER_END: '2026-09-26',
} as const;

// Rarity display config
export const RARITY_COLORS: Record<string, { border: string; glow: string }> = {
  legendary: { border: 'border-amber-400', glow: 'shadow-amber-400/40' },
  epic: { border: 'border-purple-400', glow: 'shadow-purple-400/30' },
  rare: { border: 'border-blue-400', glow: 'shadow-blue-400/20' },
  common: { border: 'border-border', glow: '' },
};
