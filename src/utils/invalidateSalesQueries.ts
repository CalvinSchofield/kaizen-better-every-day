import { QueryClient } from '@tanstack/react-query';

/**
 * Centralized list of ALL query keys that depend on sales data.
 * ANY mutation that modifies sales_log, install_status, PRMR, or FP+
 * MUST invalidate all of these to keep the app consistent.
 * 
 * When adding a new sales-dependent query, add its key here.
 */
const SALES_DEPENDENT_KEYS = [
  // Core entry data
  'daily-entry',
  'all-daily-entries',
  'daily-entries',
  // Aggregates & summaries
  'preseason-fp-total',
  'ytd-prmr-total',
  'cumulative-fp',
  'canceled-stats',
  'activity-summary',
  'insights-data',
  // Customer & install tracking
  'customer-sales',
  'pending-installs',
  // Goal pace calculator
  'today-entry-unified',
  'all-entries-unified',
  'rep-goals',
  // Goals page specific
  'season-heatmap-entries',
  'goals-knocking-days',
  'summer-stats-for-whatif',
  // Leaderboards (all variants)
  'today-leaderboard',
  'yesterday-leaderboard',
  'weekly-leaderboard',
  'monthly-leaderboard',
  'season-leaderboard',
  'ytd-leaderboard',
  'expanded-leaderboard',
  // Competitions
  'my-active-incentives',
  'incentive-progress',
  'my-active-challenges',
  'challenge-progress',
  // Team reports
  'team-live-data',
  'team-live-data-boundary',
  'team-insights',
];

/**
 * Keys safe for realtime invalidation (excludes daily-entry to prevent
 * overwriting optimistic counter state during active Track sessions).
 */
const REALTIME_SAFE_KEYS = SALES_DEPENDENT_KEYS.filter(k => k !== 'daily-entry');

/**
 * Invalidate ALL sales-dependent queries with refetchType: 'all'.
 * Use this after any mutation that changes sales data.
 * 
 * @param queryClient - The React Query client
 * @param entryDate - Optional specific entry date to also invalidate
 */
export const invalidateAllSalesQueries = (
  queryClient: QueryClient,
  entryDate?: string,
) => {
  SALES_DEPENDENT_KEYS.forEach(key => {
    queryClient.invalidateQueries({ queryKey: [key], refetchType: 'all' });
  });

  // Also invalidate the specific entry date if provided
  if (entryDate) {
    queryClient.invalidateQueries({ queryKey: ['daily-entry', entryDate], refetchType: 'all' });
  }
};

/**
 * Clear localStorage caches for sales-dependent instant-loading hooks.
 * Call alongside invalidateAllSalesQueries for complete cache busting.
 */
export const clearSalesLocalStorageCaches = () => {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (
        key.startsWith('preseason-fp-cache-') ||
        key.startsWith('ytd-prmr-cache-') ||
        key.startsWith('cumulative-fp-cache-') ||
        key.startsWith('rep-goals-cache-') ||
        key.startsWith('goals-knocking-days-cache-') ||
        key.startsWith('goals-season-config-cache-')
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch {
    // Ignore storage errors
  }
};
