import { useMemo } from 'react';
import { useDailyEntry } from '@/hooks/useDailyEntry';

export type KnockingState = 'pre-work' | 'working' | 'day-complete';

/**
 * Get the current hour in the rep's local timezone
 */
export const getHourInRepTimezone = (timezone: string | null | undefined): number => {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'America/Los_Angeles',
      hour: 'numeric',
      hour12: false,
    });
    return parseInt(formatter.format(new Date()), 10);
  } catch {
    // Fallback to local time if timezone is invalid
    return new Date().getHours();
  }
};

interface UseKnockingStateOptions {
  timezone?: string | null;
}

interface UseKnockingStateResult {
  state: KnockingState;
  hasActivity: boolean;
  isFinalized: boolean;
  localHour: number;
}

/**
 * Determines the current knocking state based on today's entry:
 * - 'pre-work': No activity tracked today, entry not finalized
 * - 'working': Has activity today (doors > 0, etc.) AND entry not finalized
 * - 'day-complete': Entry is finalized (is_finalized = true)
 * 
 * Uses rep's local timezone for time-based logic
 */
export function useKnockingState(options: UseKnockingStateOptions = {}): UseKnockingStateResult {
  const { entry } = useDailyEntry();
  const { timezone } = options;

  return useMemo(() => {
    const localHour = getHourInRepTimezone(timezone);

    // Check if entry is finalized
    const isFinalized = entry?.is_finalized === true;
    if (isFinalized) {
      return {
        state: 'day-complete' as KnockingState,
        hasActivity: true,
        isFinalized: true,
        localHour,
      };
    }

    // Check if any activity has been tracked today
    const hasActivity = Boolean(
      entry && (
        (entry.doors_knocked ?? 0) > 0 ||
        (entry.decision_makers ?? 0) > 0 ||
        (entry.pitches ?? 0) > 0 ||
        (entry.transitions ?? 0) > 0 ||
        (entry.presentations ?? 0) > 0 ||
        (entry.closes ?? 0) > 0
      )
    );

    if (hasActivity) {
      return {
        state: 'working' as KnockingState,
        hasActivity: true,
        isFinalized: false,
        localHour,
      };
    }

    return {
      state: 'pre-work' as KnockingState,
      hasActivity: false,
      isFinalized: false,
      localHour,
    };
  }, [entry, timezone]);
}
