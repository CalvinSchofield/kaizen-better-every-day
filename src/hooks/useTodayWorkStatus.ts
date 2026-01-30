import { useMemo } from 'react';
import { format } from 'date-fns';
import { usePlannedDays } from './usePlannedDays';
import { useDailyEntry } from './useDailyEntry';

/**
 * Hook to track today's work status
 * Combines planned days with current entry status for app-wide awareness
 */
export const useTodayWorkStatus = () => {
  const { isDatePlanned } = usePlannedDays();
  const { entry } = useDailyEntry();

  return useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const isTodayPlanned = isDatePlanned(todayStr);
    const hasStartedWork = entry?.work_start_time !== null && entry?.work_start_time !== undefined;
    const isWorkComplete = entry?.is_finalized === true;
    
    // Rest day = not planned AND haven't started work
    const isRestDay = !isTodayPlanned && !hasStartedWork;
    
    // Planned but not started = should start soon
    const shouldStartSoon = isTodayPlanned && !hasStartedWork && !isWorkComplete;
    
    return {
      todayStr,
      isTodayPlanned,
      hasStartedWork,
      isWorkComplete,
      isRestDay,
      shouldStartSoon,
    };
  }, [isDatePlanned, entry]);
};
