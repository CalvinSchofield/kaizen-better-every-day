/**
 * Leaderboard Tiebreaker Logic
 * 
 * When people tie in a category, use the next category to break the tie.
 * Order for activity metrics: doors → decision_makers → pitches → transitions → presentations
 * 
 * For FP+, tiebreaker is PRMR.
 * For PRMR, tiebreaker is FP+.
 * 
 * If still tied, prefer younger reps: Rookie > Sophomore > Vet
 */

export type YearRank = 'Rookie' | 'Sophomore' | 'Vet' | string | null;

/**
 * Get numeric priority for year (lower = younger = preferred in tiebreak)
 */
export const getYearPriority = (year: YearRank): number => {
  if (!year) return 99;
  const normalized = year.toLowerCase();
  if (normalized === 'rookie') return 1;
  if (normalized === 'sophomore') return 2;
  if (normalized === 'vet') return 3;
  return 99;
};

/**
 * Compare two users for tiebreaking when primary value is equal.
 * Returns negative if a should come first, positive if b should come first.
 */
export const tiebreakerCompare = (
  aValue: number,
  bValue: number,
  aTiebreaker: number,
  bTiebreaker: number,
  aYear: YearRank,
  bYear: YearRank
): number => {
  // First compare primary value (higher is better)
  if (bValue !== aValue) return bValue - aValue;
  
  // If tied, compare tiebreaker (higher is better)
  if (bTiebreaker !== aTiebreaker) return bTiebreaker - aTiebreaker;
  
  // If still tied, prefer younger rep (lower priority = preferred)
  return getYearPriority(aYear) - getYearPriority(bYear);
};

/**
 * Find the leader among candidates with tiebreaking logic.
 * @param candidates Array of { userId, value, tiebreaker, year }
 * @returns The winning userId or null
 */
export const findLeaderWithTiebreaker = <T extends { 
  userId: string; 
  value: number; 
  tiebreaker: number; 
  year: YearRank;
}>(candidates: T[]): T | null => {
  if (candidates.length === 0) return null;
  
  return candidates.reduce((best, current) => {
    const comparison = tiebreakerCompare(
      current.value,
      best.value,
      current.tiebreaker,
      best.tiebreaker,
      current.year,
      best.year
    );
    // Negative means current should come first (wins)
    return comparison < 0 ? current : best;
  });
};

/**
 * Activity metrics order for chained tiebreaking
 */
export const ACTIVITY_ORDER = [
  'doors_knocked',
  'decision_makers', 
  'pitches',
  'transitions',
  'presentations'
] as const;

/**
 * Get the next metric in the activity chain for tiebreaking
 */
export const getNextActivityMetric = (currentMetric: string): string | null => {
  const index = ACTIVITY_ORDER.indexOf(currentMetric as any);
  if (index === -1 || index === ACTIVITY_ORDER.length - 1) return null;
  return ACTIVITY_ORDER[index + 1];
};
