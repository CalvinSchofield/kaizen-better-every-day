import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDailyEntry } from '@/hooks/useDailyEntry';
import { useEfpMode } from '@/hooks/useEfpMode';

interface SmartActivityGoals {
  hasEnoughData: boolean;
  daysTracked: number;
  dataThreshold: number;
  
  // Conversion rates (after threshold met)
  presentationsPerFp: number;
  transitionsPerFp: number;
  
  // Smart daily goals (rounded to whole numbers)
  suggestedPresentations: number;
  suggestedTransitions: number;
  
  // Remaining for today
  presentationsRemaining: number;
  transitionsRemaining: number;
  
  // Fallback flag
  isUsingManualGoals: boolean;
  
  isLoading: boolean;
}

interface UseSmartActivityGoalsOptions {
  dailyFpGoal: number;
  isRookie: boolean;
}

/**
 * Calculates smart daily activity targets based on historical conversion rates.
 * After 18 knocking days (vets) or 24 days (rookies), shows data-driven suggestions.
 */
export function useSmartActivityGoals({
  dailyFpGoal,
  isRookie,
}: UseSmartActivityGoalsOptions): SmartActivityGoals {
  const { entry } = useDailyEntry();
  const { efpModeEnabled } = useEfpMode();
  
  const dataThreshold = isRookie ? 24 : 18;

  // Fetch historical conversion rates
  const { data: conversionData, isLoading } = useQuery({
    queryKey: ['smart-activity-goals-conversion', efpModeEnabled],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const userEmail = user.email?.toLowerCase() ?? null;

      // Fetch all finalized entries with activity
      const { data: entries, error } = await supabase
        .from('daily_entries')
        .select('doors_knocked, transitions, presentations, closes, fp_plus, prmr')
        .eq('user_id', user.id)
        .eq('is_finalized', true)
        .gte('doors_knocked', 4) // Only "knocking days"
        .order('entry_date', { ascending: false });

      if (error) throw error;

      const knockingDays = entries?.length || 0;

      // Calculate totals
      const totals = (entries || []).reduce(
        (acc, entry) => {
          acc.presentations += entry.presentations || 0;
          acc.transitions += entry.transitions || 0;
          acc.fpPlus += entry.fp_plus || 0;
          acc.prmr += entry.prmr || 0;
          return acc;
        },
        { presentations: 0, transitions: 0, fpPlus: 0, prmr: 0 }
      );

      // Calculate EFP if needed
      const totalEfp = totals.prmr / 85;
      const salesMetric = efpModeEnabled ? totalEfp : totals.fpPlus;

      // Calculate conversion rates
      const presentationsPerFp = salesMetric > 0 ? totals.presentations / salesMetric : 0;
      const transitionsPerFp = salesMetric > 0 ? totals.transitions / salesMetric : 0;

      return {
        userEmail,
        knockingDays,
        presentationsPerFp,
        transitionsPerFp,
      };
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000,
  });

  return useMemo(() => {
    const knockingDays = conversionData?.knockingDays || 0;

    const effectiveThreshold =
      conversionData?.userEmail === 'calvinjschofield@gmail.com'
        ? 1
        : dataThreshold;

    const hasEnoughData = knockingDays >= effectiveThreshold;

    if (!hasEnoughData || !conversionData) {
      return {
        hasEnoughData: false,
        daysTracked: knockingDays,
        dataThreshold: effectiveThreshold,
        presentationsPerFp: 0,
        transitionsPerFp: 0,
        suggestedPresentations: 0,
        suggestedTransitions: 0,
        presentationsRemaining: 0,
        transitionsRemaining: 0,
        isUsingManualGoals: true,
        isLoading,
      };
    }

    // Calculate smart daily goals
    const suggestedPresentations = Math.round(
      dailyFpGoal * conversionData.presentationsPerFp
    );
    const suggestedTransitions = Math.round(
      dailyFpGoal * conversionData.transitionsPerFp
    );

    // Calculate remaining for today
    const todayPresentations = entry?.presentations || 0;
    const todayTransitions = entry?.transitions || 0;

    const presentationsRemaining = Math.max(0, suggestedPresentations - todayPresentations);
    const transitionsRemaining = Math.max(0, suggestedTransitions - todayTransitions);

    return {
      hasEnoughData: true,
      daysTracked: knockingDays,
      dataThreshold: effectiveThreshold,
      presentationsPerFp: conversionData.presentationsPerFp,
      transitionsPerFp: conversionData.transitionsPerFp,
      suggestedPresentations,
      suggestedTransitions,
      presentationsRemaining,
      transitionsRemaining,
      isUsingManualGoals: false,
      isLoading,
    };
  }, [conversionData, dataThreshold, dailyFpGoal, entry, isLoading]);
}
