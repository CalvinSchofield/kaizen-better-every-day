import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDailyEntry } from '@/hooks/useDailyEntry';
import { useEfpMode } from '@/hooks/useEfpMode';
import { format } from 'date-fns';

interface SmartActivityGoals {
  hasEnoughData: boolean;
  daysTracked: number;
  dataThreshold: number;
  
  // Conversion rates (after threshold met)
  doorsPerUnit: number;
  decisionMakersPerUnit: number;
  pitchesPerUnit: number;
  presentationsPerFp: number;
  transitionsPerFp: number;
  
  // Smart daily goals (rounded up)
  suggestedDoors: number;
  suggestedDMs: number;
  suggestedPitches: number;
  suggestedPresentations: number;
  suggestedTransitions: number;
  
  // Remaining for today
  presentationsRemaining: number;
  transitionsRemaining: number;
  
  // Map for easy consumption by counter grid
  smartGoalsMap: Record<string, number>;
  
  // Fallback flag
  isUsingManualGoals: boolean;
  dataSource: 'current' | 'historical' | 'none';
  
  isLoading: boolean;
}

interface UseSmartActivityGoalsOptions {
  dailyFpGoal: number;
  isRookie: boolean;
}

/**
 * Calculates smart daily activity targets based on historical conversion rates.
 * Season-aware: uses current season data first, falls back to 2025 historical summer data.
 */
export function useSmartActivityGoals({
  dailyFpGoal,
  isRookie,
}: UseSmartActivityGoalsOptions): SmartActivityGoals {
  const { entry } = useDailyEntry();
  const { efpModeEnabled } = useEfpMode();
  
  const dataThreshold = isRookie ? 24 : 18;

  const { data: conversionData, isLoading } = useQuery({
    queryKey: ['smart-activity-goals-conversion-v2', efpModeEnabled],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user;
      if (!user) throw new Error('Not authenticated');

      const userEmail = user.email?.toLowerCase() ?? null;
      const today = format(new Date(), 'yyyy-MM-dd');

      // Fetch season config to determine current season
      const { data: seasonConfig } = await supabase
        .from('season_config')
        .select('personal_summer_start')
        .eq('user_id', user.id)
        .maybeSingle();

      const personalSummerStart = seasonConfig?.personal_summer_start || '2026-04-12';
      const isSummer = today >= personalSummerStart;

      // Query current season entries
      let query = supabase
        .from('daily_entries')
        .select('doors_knocked, decision_makers, pitches, transitions, presentations, closes, fp_plus, prmr')
        .eq('user_id', user.id)
        .eq('is_finalized', true)
        .gte('doors_knocked', 4);

      if (isSummer) {
        query = query.gte('entry_date', personalSummerStart);
      } else {
        query = query.lt('entry_date', personalSummerStart);
      }

      const { data: entries, error } = await query.order('entry_date', { ascending: false });
      if (error) throw error;

      const knockingDays = entries?.length || 0;

      // Calculate totals from current season
      const totals = (entries || []).reduce(
        (acc, e) => {
          acc.doors += e.doors_knocked || 0;
          acc.dms += e.decision_makers || 0;
          acc.pitches += e.pitches || 0;
          acc.presentations += e.presentations || 0;
          acc.transitions += e.transitions || 0;
          acc.fpPlus += e.fp_plus || 0;
          acc.prmr += e.prmr || 0;
          return acc;
        },
        { doors: 0, dms: 0, pitches: 0, presentations: 0, transitions: 0, fpPlus: 0, prmr: 0 }
      );

      const totalEfp = totals.prmr / 85;
      const salesMetric = efpModeEnabled ? totalEfp : totals.fpPlus;

      // Check if we have enough current season data
      const effectiveThreshold = userEmail === 'calvinjschofield@gmail.com' ? 1 : dataThreshold;

      if (knockingDays >= effectiveThreshold && salesMetric > 0) {
        return {
          userEmail,
          knockingDays,
          effectiveThreshold,
          dataSource: 'current' as const,
          doorsPerUnit: totals.doors / salesMetric,
          dmsPerUnit: totals.dms / salesMetric,
          pitchesPerUnit: totals.pitches / salesMetric,
          presentationsPerUnit: totals.presentations / salesMetric,
          transitionsPerUnit: totals.transitions / salesMetric,
        };
      }

      // Fallback: if in summer and below threshold, try 2025 historical summer data
      if (isSummer) {
        const { data: historicalEntries, error: histError } = await supabase
          .from('historical_entries')
          .select('doors_knocked, decision_makers, pitches, transitions, presentations, closes, fp_plus, prmr, upgrade_prmr')
          .eq('user_id', user.id)
          .eq('season_type', 'summer')
          .eq('season_year', 2025)
          .gte('doors_knocked', 4);

        if (histError) throw histError;

        const histDays = historicalEntries?.length || 0;

        if (histDays >= effectiveThreshold) {
          const histTotals = (historicalEntries || []).reduce(
            (acc, e) => {
              acc.doors += e.doors_knocked || 0;
              acc.dms += e.decision_makers || 0;
              acc.pitches += e.pitches || 0;
              acc.presentations += e.presentations || 0;
              acc.transitions += e.transitions || 0;
              acc.prmr += e.prmr || 0;
              acc.upgradePrmr += e.upgrade_prmr || 0;
              return acc;
            },
            { doors: 0, dms: 0, pitches: 0, presentations: 0, transitions: 0, prmr: 0, upgradePrmr: 0 }
          );

          // Historical data: EFP is authoritative metric (PRMR / 85)
          const histEfp = histTotals.prmr / 85;
          const histSalesMetric = histEfp > 0 ? histEfp : 1;

          return {
            userEmail,
            knockingDays: histDays,
            effectiveThreshold,
            dataSource: 'historical' as const,
            doorsPerUnit: histTotals.doors / histSalesMetric,
            dmsPerUnit: histTotals.dms / histSalesMetric,
            pitchesPerUnit: histTotals.pitches / histSalesMetric,
            presentationsPerUnit: histTotals.presentations / histSalesMetric,
            transitionsPerUnit: histTotals.transitions / histSalesMetric,
          };
        }
      }

      // Not enough data anywhere
      return {
        userEmail,
        knockingDays,
        effectiveThreshold,
        dataSource: 'none' as const,
        doorsPerUnit: 0,
        dmsPerUnit: 0,
        pitchesPerUnit: 0,
        presentationsPerUnit: 0,
        transitionsPerUnit: 0,
      };
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  return useMemo(() => {
    const knockingDays = conversionData?.knockingDays || 0;
    const effectiveThreshold = conversionData?.effectiveThreshold || dataThreshold;
    const dataSource = conversionData?.dataSource || 'none';
    const hasEnoughData = dataSource !== 'none';

    if (!hasEnoughData || !conversionData) {
      return {
        hasEnoughData: false,
        daysTracked: knockingDays,
        dataThreshold: effectiveThreshold,
        doorsPerUnit: 0,
        decisionMakersPerUnit: 0,
        pitchesPerUnit: 0,
        presentationsPerFp: 0,
        transitionsPerFp: 0,
        suggestedDoors: 0,
        suggestedDMs: 0,
        suggestedPitches: 0,
        suggestedPresentations: 0,
        suggestedTransitions: 0,
        presentationsRemaining: 0,
        transitionsRemaining: 0,
        smartGoalsMap: {},
        isUsingManualGoals: true,
        dataSource: 'none' as const,
        isLoading,
      };
    }

    // Calculate smart daily goals using Math.ceil
    const suggestedDoors = Math.ceil(dailyFpGoal * conversionData.doorsPerUnit);
    const suggestedDMs = Math.ceil(dailyFpGoal * conversionData.dmsPerUnit);
    const suggestedPitches = Math.ceil(dailyFpGoal * conversionData.pitchesPerUnit);
    const suggestedPresentations = Math.ceil(dailyFpGoal * conversionData.presentationsPerUnit);
    const suggestedTransitions = Math.ceil(dailyFpGoal * conversionData.transitionsPerUnit);

    // Calculate remaining for today
    const todayPresentations = entry?.presentations || 0;
    const todayTransitions = entry?.transitions || 0;

    const presentationsRemaining = Math.max(0, suggestedPresentations - todayPresentations);
    const transitionsRemaining = Math.max(0, suggestedTransitions - todayTransitions);

    // Build map for counter grid (no goal for closes - it IS the output)
    const smartGoalsMap: Record<string, number> = {};
    if (suggestedDoors > 0) smartGoalsMap['doors_knocked'] = suggestedDoors;
    if (suggestedDMs > 0) smartGoalsMap['decision_makers'] = suggestedDMs;
    if (suggestedPitches > 0) smartGoalsMap['pitches'] = suggestedPitches;
    if (suggestedTransitions > 0) smartGoalsMap['transitions'] = suggestedTransitions;
    if (suggestedPresentations > 0) smartGoalsMap['presentations'] = suggestedPresentations;

    return {
      hasEnoughData: true,
      daysTracked: knockingDays,
      dataThreshold: effectiveThreshold,
      doorsPerUnit: conversionData.doorsPerUnit,
      decisionMakersPerUnit: conversionData.dmsPerUnit,
      pitchesPerUnit: conversionData.pitchesPerUnit,
      presentationsPerFp: conversionData.presentationsPerUnit,
      transitionsPerFp: conversionData.transitionsPerUnit,
      suggestedDoors,
      suggestedDMs,
      suggestedPitches,
      suggestedPresentations,
      suggestedTransitions,
      presentationsRemaining,
      transitionsRemaining,
      smartGoalsMap,
      isUsingManualGoals: false,
      dataSource,
      isLoading,
    };
  }, [conversionData, dataThreshold, dailyFpGoal, entry, isLoading]);
}
