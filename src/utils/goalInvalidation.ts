import { QueryClient } from "@tanstack/react-query";

/**
 * Centralized invalidation for all goal-related and planned-days-related queries.
 * 
 * Call this after ANY mutation that changes:
 * - rep_goals (goal values, focus tier, progress)
 * - planned_work_days (adding/removing planned days)
 * - season_config (summer dates, excluded days, knocking mode)
 * 
 * This ensures every view in the app sees the updated data immediately,
 * preventing stale cache from showing conflicting information.
 */
export const invalidateGoalRelatedQueries = (queryClient: QueryClient) => {
  // Goals data
  queryClient.invalidateQueries({ queryKey: ['rep-goals'] });

  // Season config — prefix match catches ALL variants:
  // 'season-config', 'season-config-for-goals-page', 'season-config-for-goals',
  // 'season-config-unified', 'season-config-focus-tier', 'season-config-whatif', etc.
  queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[0];
      return typeof key === 'string' && key.startsWith('season-config');
    },
  });

  // Planned days
  queryClient.invalidateQueries({ queryKey: ['planned-days'] });

  // Downstream production/pace queries
  queryClient.invalidateQueries({ queryKey: ['worked-days-data'] });
  queryClient.invalidateQueries({ queryKey: ['effective-fp'] });
  queryClient.invalidateQueries({ queryKey: ['goal-pace'] });
  queryClient.invalidateQueries({ queryKey: ['downline-goal-pace'] });
  queryClient.invalidateQueries({ queryKey: ['preseason-fp'] });
  queryClient.invalidateQueries({ queryKey: ['preseason-fp-total'] });
  queryClient.invalidateQueries({ queryKey: ['cumulative-fp'] });

  // Entry / production queries used by goal pace calculator
  queryClient.invalidateQueries({ queryKey: ['today-entry-unified'] });
  queryClient.invalidateQueries({ queryKey: ['all-entries-unified'] });
  queryClient.invalidateQueries({ queryKey: ['official-totals-pace'] });
  queryClient.invalidateQueries({ queryKey: ['ytd-prmr-total'] });
  queryClient.invalidateQueries({ queryKey: ['historical-summer-avg-pace'] });
};

/**
 * Lighter invalidation for planned-days-only changes.
 * Use when only planned days changed (not goals or season config).
 */
export const invalidatePlannedDaysQueries = (queryClient: QueryClient) => {
  queryClient.invalidateQueries({ queryKey: ['planned-days'] });
  queryClient.invalidateQueries({ queryKey: ['worked-days-data'] });
  queryClient.invalidateQueries({ queryKey: ['goal-pace'] });
  queryClient.invalidateQueries({ queryKey: ['downline-goal-pace'] });
  queryClient.invalidateQueries({ queryKey: ['cumulative-fp'] });
  queryClient.invalidateQueries({ queryKey: ['today-entry-unified'] });
  queryClient.invalidateQueries({ queryKey: ['all-entries-unified'] });
  queryClient.invalidateQueries({ queryKey: ['official-totals-pace'] });
  queryClient.invalidateQueries({ queryKey: ['preseason-fp-total'] });
};
