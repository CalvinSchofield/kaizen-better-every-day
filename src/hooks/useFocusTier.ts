import { useMemo, useCallback } from 'react';
import { useRepGoals } from './useRepGoals';
import { useEfpMode } from './useEfpMode';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRepData } from './useRepData';
import { parseISO } from 'date-fns';

export type FocusTier = 'mustDo' | 'willDo' | 'couldDo';

export interface FocusTierData {
  focusTier: FocusTier;
  setFocusTier: (tier: FocusTier) => Promise<void>;
  focusTierGoal: number;
  focusTierGoalRaw: number;
  fundedFocusTierGoal: number;
  allTiers: {
    mustDo: { goal: number; funded: number; complete: boolean };
    willDo: { goal: number; funded: number; complete: boolean };
    couldDo: { goal: number; funded: number; complete: boolean };
  };
  isLoading: boolean;
  isUserSummerStarted: boolean;
}

/**
 * Hook to manage the user's focused goal tier across the app.
 * The focus tier is persisted to rep_goals.focus_tier and used
 * for all pace calculations when in summer mode.
 */
export function useFocusTier(currentProgress: number = 0): FocusTierData {
  const { goals, updateGoals, isLoading: goalsLoading } = useRepGoals();
  const { efpModeEnabled } = useEfpMode();
  const { repData } = useRepData();

  // Fetch user's personal summer dates
  const { data: seasonConfig, isLoading: seasonLoading } = useQuery({
    queryKey: ['season-config-focus-tier', repData?.user_id],
    queryFn: async () => {
      if (!repData?.user_id) return null;
      const { data, error } = await supabase
        .from('season_config')
        .select('personal_summer_start')
        .eq('user_id', repData.user_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!repData?.user_id,
    staleTime: 5 * 60 * 1000,
  });

  // Calculate if user's personal summer has started
  const isUserSummerStarted = useMemo(() => {
    const personalStart = seasonConfig?.personal_summer_start;
    if (!personalStart) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = parseISO(personalStart);
    return today >= startDate;
  }, [seasonConfig?.personal_summer_start]);

  // Conversion factor for EFP mode (goals stored in FP, convert to EFP display)
  const conversionFactor = efpModeEnabled ? (goals?.avg_prmr_per_fp || 85) / 85 : 1;
  
  // Cancel rate buffer
  const cancelRate = goals?.cancel_rate || 0;
  const applyBuffer = (goal: number) => 
    cancelRate > 0 && cancelRate < 1 ? goal / (1 - cancelRate) : goal;

  // Calculate all tier values
  const allTiers = useMemo(() => {
    const mustDoRaw = goals?.must_do_fp_goal || 0;
    const willDoRaw = goals?.will_do_fp_goal || 0;
    const couldDoRaw = goals?.could_do_fp_goal || 0;

    const mustDoDisplay = mustDoRaw * conversionFactor;
    const willDoDisplay = willDoRaw * conversionFactor;
    const couldDoDisplay = couldDoRaw * conversionFactor;

    return {
      mustDo: {
        goal: mustDoDisplay,
        funded: applyBuffer(mustDoDisplay),
        complete: currentProgress >= mustDoDisplay && mustDoDisplay > 0,
      },
      willDo: {
        goal: willDoDisplay,
        funded: applyBuffer(willDoDisplay),
        complete: currentProgress >= willDoDisplay && willDoDisplay > 0,
      },
      couldDo: {
        goal: couldDoDisplay,
        funded: applyBuffer(couldDoDisplay),
        complete: currentProgress >= couldDoDisplay && couldDoDisplay > 0,
      },
    };
  }, [goals, conversionFactor, currentProgress, cancelRate]);

  // Determine the effective focus tier
  const focusTier = useMemo((): FocusTier => {
    // Use saved preference if available
    const savedTier = goals?.focus_tier as FocusTier | null | undefined;
    if (savedTier && ['mustDo', 'willDo', 'couldDo'].includes(savedTier)) {
      return savedTier;
    }
    
    // Auto-select based on progress: lowest incomplete tier
    if (!allTiers.mustDo.complete && allTiers.mustDo.goal > 0) return 'mustDo';
    if (!allTiers.willDo.complete && allTiers.willDo.goal > 0) return 'willDo';
    if (!allTiers.couldDo.complete && allTiers.couldDo.goal > 0) return 'couldDo';
    
    // Default to willDo
    return 'willDo';
  }, [goals?.focus_tier, allTiers]);

  // Set the focus tier (persists to database)
  const setFocusTier = useCallback(async (tier: FocusTier) => {
    await updateGoals({ focus_tier: tier });
  }, [updateGoals]);

  // Get the goal values for the focused tier
  const focusTierGoalRaw = useMemo(() => {
    switch (focusTier) {
      case 'mustDo': return goals?.must_do_fp_goal || 0;
      case 'willDo': return goals?.will_do_fp_goal || 0;
      case 'couldDo': return goals?.could_do_fp_goal || 0;
    }
  }, [focusTier, goals]);

  const focusTierGoal = focusTierGoalRaw * conversionFactor;
  const fundedFocusTierGoal = applyBuffer(focusTierGoal);

  return {
    focusTier,
    setFocusTier,
    focusTierGoal,
    focusTierGoalRaw,
    fundedFocusTierGoal,
    allTiers,
    isLoading: goalsLoading || seasonLoading,
    isUserSummerStarted,
  };
}
