/**
 * Central source of truth for recruit stage names.
 * These MUST match EXACTLY what's in the database.
 * 
 * Database stages as of query:
 * - 100 List
 * - Evaluating
 * - Potential Follow Up
 * - Shadow ✅
 * - Signed
 * - Signed but Not Interested
 * - Sold (5+) 💰
 * - Sold 💲
 * 
 * Also commonly used (may exist in database):
 * - Reached Out (with capital O - check Notion)
 * - Not Interested
 */

// Exact stage names from database - DO NOT CHANGE without checking DB
export const STAGES = {
  LIST_100: '100 List',
  REACHED_OUT: 'Reached Out', // Capital O - standardized
  EVALUATING: 'Evaluating',
  SIGNED: 'Signed',
  SHADOW: 'Shadow ✅',
  SOLD: 'Sold 💲',
  SOLD_5_PLUS: 'Sold (5+) 💰',
  POTENTIAL_FOLLOW_UP: 'Potential Follow Up',
  NOT_INTERESTED: 'Not Interested',
  SIGNED_BUT_NOT_INTERESTED: 'Signed but Not Interested', // Capital N and I
} as const;

export type StageName = typeof STAGES[keyof typeof STAGES];

// Primary/active recruiting pipeline stages (in progression order)
export const PRIMARY_STAGES = [
  STAGES.LIST_100,
  STAGES.REACHED_OUT,
  STAGES.EVALUATING,
  STAGES.SIGNED,
  STAGES.SHADOW,
  STAGES.SOLD,
  STAGES.SOLD_5_PLUS,
] as const;

// Exit/terminal stages - recruit is no longer actively progressing
export const EXIT_STAGES = [
  STAGES.POTENTIAL_FOLLOW_UP,
  STAGES.NOT_INTERESTED,
  STAGES.SIGNED_BUT_NOT_INTERESTED,
] as const;

// Stages that indicate someone has signed (for filtering recruiters, etc.)
export const SIGNED_PLUS_STAGES = [
  STAGES.SIGNED,
  STAGES.SHADOW,
  STAGES.SOLD,
  STAGES.SOLD_5_PLUS,
] as const;

// Stages that are permanent exits (need confirmation before moving to)
export const PERMANENT_EXIT_STAGES = [
  STAGES.NOT_INTERESTED,
  STAGES.SIGNED_BUT_NOT_INTERESTED,
] as const;

// Early stages where recruits haven't committed yet
export const EARLY_STAGES = [
  STAGES.LIST_100,
  STAGES.REACHED_OUT,
  STAGES.EVALUATING,
] as const;

// All stages in order for progression checking
export const ALL_STAGES_ORDERED = [
  STAGES.LIST_100,
  STAGES.REACHED_OUT,
  STAGES.EVALUATING,
  STAGES.SIGNED,
  STAGES.SHADOW,
  STAGES.SOLD,
  STAGES.SOLD_5_PLUS,
  // Exit stages are not in progression order
] as const;

// Stage display labels (for UI where we want different text than the DB value)
export const STAGE_LABELS: Record<string, string> = {
  [STAGES.LIST_100]: '100 List',
  [STAGES.REACHED_OUT]: 'Reached Out',
  [STAGES.EVALUATING]: 'Evaluating',
  [STAGES.SIGNED]: 'Signed',
  [STAGES.SHADOW]: 'Shadow ✅',
  [STAGES.SOLD]: 'Sold 💲',
  [STAGES.SOLD_5_PLUS]: 'Sold (5+) 💰',
  [STAGES.POTENTIAL_FOLLOW_UP]: 'Follow Up',
  [STAGES.NOT_INTERESTED]: 'Not Interested',
  [STAGES.SIGNED_BUT_NOT_INTERESTED]: 'Signed (Left)',
};

// Stage colors for Kanban board
export const STAGE_COLORS: Record<string, string> = {
  [STAGES.LIST_100]: 'bg-muted',
  [STAGES.REACHED_OUT]: 'bg-blue-500/20',
  [STAGES.EVALUATING]: 'bg-yellow-500/20',
  [STAGES.SIGNED]: 'bg-green-500/20',
  [STAGES.SHADOW]: 'bg-emerald-500/20',
  [STAGES.SOLD]: 'bg-primary/20',
  [STAGES.SOLD_5_PLUS]: 'bg-amber-500/20',
  [STAGES.POTENTIAL_FOLLOW_UP]: 'bg-purple-500/20',
  [STAGES.NOT_INTERESTED]: 'bg-destructive/20',
  [STAGES.SIGNED_BUT_NOT_INTERESTED]: 'bg-destructive/20',
};

// Helper to normalize stage comparison (handles case differences)
export const normalizeStage = (stage: string | null | undefined): string => {
  if (!stage) return '';
  return stage.trim();
};

// Helper to check if a stage is in a list (case-insensitive for safety)
export const isStageIn = (stage: string | null | undefined, stageList: readonly string[]): boolean => {
  if (!stage) return false;
  const normalized = normalizeStage(stage);
  return stageList.some(s => s.toLowerCase() === normalized.toLowerCase());
};

// Stage descriptions for UI
export const STAGE_DESCRIPTIONS: Record<string, string> = {
  [STAGES.LIST_100]: 'A potential recruit on the initial list who hasn\'t been contacted yet.',
  [STAGES.REACHED_OUT]: 'You\'ve made initial contact but haven\'t had a meaningful conversation yet.',
  [STAGES.EVALUATING]: 'They\'re interested and actively considering the opportunity.',
  [STAGES.SIGNED]: 'They\'ve committed to join and are starting onboarding!',
  [STAGES.SHADOW]: 'They\'ve completed shadowing and are ready to start!',
  [STAGES.SOLD]: 'They\'ve sold their first FP+ - officially on the board!',
  [STAGES.SOLD_5_PLUS]: 'They\'ve sold 5 or more FP+ and are on track!',
  [STAGES.NOT_INTERESTED]: 'They declined the opportunity.',
  [STAGES.SIGNED_BUT_NOT_INTERESTED]: 'They signed but later decided not to continue.',
  [STAGES.POTENTIAL_FOLLOW_UP]: 'Not ready now but worth following up later.',
};

// Contact cadence by stage (days between contacts)
export const STAGE_CADENCE: Record<string, number> = {
  [STAGES.SIGNED]: 7,          // Weekly check-ins
  [STAGES.SHADOW]: 7,          // Weekly check-ins
  [STAGES.SOLD]: 14,           // Bi-weekly
  [STAGES.SOLD_5_PLUS]: 14,    // Bi-weekly
  [STAGES.EVALUATING]: 3,      // Hot leads need frequent contact
  [STAGES.REACHED_OUT]: 5,     // Follow up within a week
  [STAGES.LIST_100]: 14,       // Pipeline building, lower priority
};
