import { useState, useEffect, useMemo, useCallback } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Lock, SlidersHorizontal, Calculator, ChevronDown, ArrowLeft, Loader2, Check } from "lucide-react";
import { useRepGoals } from "@/hooks/useRepGoals";
import { useRepData } from "@/hooks/useRepData";
import { usePreseasonFP } from "@/hooks/usePreseasonFP";
import { useBlitzes } from "@/hooks/useBlitzes";
import { usePlannedDays } from "@/hooks/usePlannedDays";
import { useDailyEntry } from "@/hooks/useDailyEntry";
import { usePersonalBenchmarks } from "@/hooks/usePersonalBenchmarks";
import { GoalSetupWizard } from "@/components/goals/GoalSetupWizard";
import { GoalHeroRing, GoalTier } from "@/components/goals/GoalHeroRing";
import { CommitmentChips } from "@/components/goals/CommitmentChips";
import { PayscaleCalculator } from "@/components/goals/PayscaleCalculator";
import { CalendarPlanningCard } from "@/components/goals/CalendarPlanningCard";
import { CanceledStatsCard } from "@/components/goals/CanceledStatsCard";
import { SpendingROICard } from "@/components/goals/SpendingROICard";
import { TrainingTimer } from "@/components/goals/TrainingTimer";
import { BooksCompletionDrawer } from "@/components/goals/BooksSelectionDrawer";
import { CommitmentEditorDrawer } from "@/components/goals/CommitmentEditorDrawer";
import { PurposeCard } from "@/components/goals/PurposeCard";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { supabase } from "@/integrations/supabase/client";
import { useEfpMode } from "@/hooks/useEfpMode";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { isBefore, parseISO, format } from "date-fns";
import { parseDateAsLocal } from "@/utils/blitzDateUtils";
import { usePageTour } from "@/hooks/usePageTour";
import { PageTour } from "@/components/PageTour";
import { goalsTourSteps } from "@/config/pageTours";
import { calculatePaceContext, getLearningCurvePrincipleMessage, calculateSuggestedStretchGoal } from "@/utils/learningCurveData";

interface CommittedBlitz {
  id: string;
  name: string;
  date: string;
  endDate?: string;
  location?: string;
}

const PRESEASON_START = '2025-09-28';
const PRESEASON_END = '2026-04-11';

const Goals = () => {
  const { 
    goals, 
    isLoading, 
    hasGoalsAccess, 
    isRookie, 
    updateGoals, 
    isUpdating,
    checkAndResetWeeklyProgress,
    needsWeeklyCheck
  } = useRepGoals();
  const { repData, isInitializing: repDataInitializing, loading: repDataLoading } = useRepData();
  const { 
    totalFP: totalFpPlus, 
    totalPRMR, 
    fundedFP, 
    fundedPRMR 
  } = usePreseasonFP();
  const { allBlitzes } = useBlitzes();
  const { plannedDays } = usePlannedDays();
  const { entry: todayEntry } = useDailyEntry();
  const { efpModeEnabled, calculateEfp } = useEfpMode();
  const queryClient = useQueryClient();
  const { toast: toastHook } = useToast();
  
  // Page tour - only show after setup is complete
  const { 
    showTour, 
    completeTour, 
    skipTour,
  } = usePageTour({ 
    page: 'goals', 
    enabled: goals?.setup_complete === true,
    delay: 800 
  });
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showCommitmentEditor, setShowCommitmentEditor] = useState(false);
  const [showTrainingTimer, setShowTrainingTimer] = useState(false);
  const [showBlitzEditor, setShowBlitzEditor] = useState(false);
  const [showBooksDrawer, setShowBooksDrawer] = useState(false);
  const [activeTier, setActiveTier] = useState<GoalTier>('preseason');
  const [hasManualTierSelection, setHasManualTierSelection] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isCommitting, setIsCommitting] = useState<string | null>(null);

  const handleTourStepAction = useCallback((action: string) => {
    if (action === 'openGoalsCalendarPlanning') {
      setIsCalendarOpen(true);
    }
  }, []);

  
  // Confirmation drawer states for blitz commit/uncommit
  const [confirmCommitBlitz, setConfirmCommitBlitz] = useState<{ id: string; name: string; date: string; endDate?: string | null; location?: string | null } | null>(null);
  const [confirmUncommitBlitz, setConfirmUncommitBlitz] = useState<{ id: string; name: string } | null>(null);

  // Fetch knocking days count for pace calculation
  // Knocking day = doors >= 5 AND has work_start_time AND work_end_time
  const { data: workedDaysData } = useQuery({
    queryKey: ['goals-knocking-days', repData?.user_id],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { knockingDays: 0 };
      
      const { data: entries, error } = await supabase
        .from('daily_entries')
        .select('entry_date, doors_knocked, work_start_time, work_end_time')
        .eq('user_id', user.id)
        .eq('is_finalized', true)
        .gte('entry_date', PRESEASON_START)
        .lte('entry_date', PRESEASON_END);
      
      if (error) return { knockingDays: 0 };
      
      // Count only "knocking days" (doors >= 4 AND has both work times)
      const knockingDays = entries?.filter(e => 
        (e.doors_knocked || 0) >= 4 && e.work_start_time && e.work_end_time
      ).length || 0;
      
      return { knockingDays };
    },
    enabled: !!repData?.user_id,
    staleTime: 2 * 60 * 1000,
  });

  // Fetch user's personal summer dates to determine if their summer has started
  const { data: seasonConfig } = useQuery({
    queryKey: ['season-config-for-goals-page', repData?.user_id],
    queryFn: async () => {
      if (!repData?.user_id) return null;
      const { data, error } = await supabase
        .from('season_config')
        .select('personal_summer_start, personal_summer_end')
        .eq('user_id', repData.user_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!repData?.user_id,
  });

  // Calculate if user's personal summer has started (based on their personal_summer_start, not global date)
  const isUserSummerStarted = useMemo(() => {
    const personalStart = seasonConfig?.personal_summer_start;
    if (!personalStart) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = parseISO(personalStart);
    return today >= startDate;
  }, [seasonConfig?.personal_summer_start]);

  // Check and reset weekly training progress on new week
  useEffect(() => {
    if (needsWeeklyCheck && goals) {
      checkAndResetWeeklyProgress();
    }
  }, [needsWeeklyCheck, goals, checkAndResetWeeklyProgress]);

  // Get committed blitzes
  const committedBlitzes = useMemo(() => {
    return (repData?.committed_blitzes as CommittedBlitz[]) || [];
  }, [repData?.committed_blitzes]);

  // Calculate blitz stats
  const blitzStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let attended = 0;
    
    committedBlitzes.forEach(blitz => {
      const blitzEnd = parseDateAsLocal(blitz.endDate) || parseDateAsLocal(blitz.date);
      if (!blitzEnd) return;
      blitzEnd.setHours(23, 59, 59, 999);
      
      if (blitzEnd < today) {
        attended++;
      } else {
        const blitzStart = parseDateAsLocal(blitz.date);
        if (!blitzStart) return;
        blitzStart.setHours(0, 0, 0, 0);
        if (blitzStart <= today && today <= blitzEnd) {
          attended++; // Currently on blitz
        }
      }
    });
    
    return {
      attended,
      committed: committedBlitzes.length,
    };
  }, [committedBlitzes]);

  // Future available blitzes
  const futureAvailableBlitzes = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return allBlitzes.filter(blitz => {
      const blitzStart = parseDateAsLocal(blitz.date);
      if (!blitzStart) return false;
      blitzStart.setHours(0, 0, 0, 0);
      return blitzStart >= today;
    });
  }, [allBlitzes]);

  // Calculate current progress based on mode
  const currentProgress = efpModeEnabled ? calculateEfp(totalPRMR) : totalFpPlus;
  const fundedProgress = efpModeEnabled ? calculateEfp(fundedPRMR) : fundedFP;

  // Today's progress from entry (EFP or FP+ based on mode)
  // IMPORTANT: Include RUNNING totals from unfinalized sales_log for live "behind" calculation
  const todayUnfinalizedPrmr = useMemo(() => {
    if (!todayEntry || todayEntry.is_finalized) {
      // If finalized, use the saved values
      return (todayEntry?.prmr || 0) + ((todayEntry as any)?.upgrade_prmr || 0);
    }
    // If not finalized, calculate from sales_log for running total
    const salesLog = (todayEntry as any)?.sales_log || [];
    if (salesLog.length > 0) {
      // Exclude never_installed sales from totals
      return salesLog
        .filter((sale: any) => sale.install_status !== 'never_installed')
        .reduce((sum: number, sale: any) => sum + (sale.prmr || 0), 0);
    }
    // Fallback to prmr field if no sales_log
    return (todayEntry?.prmr || 0) + ((todayEntry as any)?.upgrade_prmr || 0);
  }, [todayEntry]);

  const todayUnfinalizedFpPlus = useMemo(() => {
    if (!todayEntry || todayEntry.is_finalized) {
      // If finalized, use the saved values
      const upgradePrmr = (todayEntry as any)?.upgrade_prmr || 0;
      return (todayEntry?.fp_plus || 0) + (upgradePrmr / 85);
    }
    // If not finalized, calculate from sales_log for running total
    const salesLog = (todayEntry as any)?.sales_log || [];
    if (salesLog.length > 0) {
      // Exclude never_installed sales from totals
      const fundedSales = salesLog.filter((s: any) => s.install_status !== 'never_installed');
      const fpSales = fundedSales.filter((s: any) => s.type === 'fp');
      const upgradeSales = fundedSales.filter((s: any) => s.type === 'upgrade');
      const upgradePrmr = upgradeSales.reduce((sum: number, s: any) => sum + (s.prmr || 0), 0);
      return fpSales.length + (upgradePrmr / 85);
    }
    // Fallback to fp_plus field if no sales_log
    const upgradePrmr = (todayEntry as any)?.upgrade_prmr || 0;
    return (todayEntry?.fp_plus || 0) + (upgradePrmr / 85);
  }, [todayEntry]);

  const todayProgress = efpModeEnabled 
    ? calculateEfp(todayUnfinalizedPrmr)
    : todayUnfinalizedFpPlus;

  // Check if we're in preseason (before April 12, 2026)
  const isPreseason = new Date() < new Date('2026-04-12');

  // Convert goals to display values (EFP if enabled) - always use $85 for PRMR per FP
  const conversionFactor = efpModeEnabled ? 85 / 85 : 1; // Simplified since we're using $85

  // Check if today is a planned day
  const isTodayPlanned = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    return plannedDays?.some(d => d.planned_date === todayStr) ?? false;
  }, [plannedDays]);

  // Check if user has any planned days
  const hasAnyPlannedDays = (plannedDays?.length || 0) > 0;

  // Calculate daily goal and remaining daily needed based on planned days
  const paceData = useMemo(() => {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const preseasonEnd = parseISO(PRESEASON_END);
    
    // Get active goal based on tier
    const activeGoal = activeTier === 'preseason' 
      ? (goals?.preseason_fp_goal || 0) * conversionFactor
      : activeTier === 'mustDo'
        ? (goals?.must_do_fp_goal || 0) * conversionFactor
        : activeTier === 'willDo'
          ? (goals?.will_do_fp_goal || 0) * conversionFactor
          : (goals?.could_do_fp_goal || 0) * conversionFactor;
    
    if (!activeGoal || activeGoal <= 0) {
      return { dailyGoal: 0, remainingDailyNeeded: 0, fundedGoalNeeded: 0, totalDays: 0, futurePlannedDays: 0 };
    }
    
    // Apply cancel buffer - need to fund more to hit goal after cancellations
    // If cancel_rate is 10% (0.1), we need to fund goal / 0.9 to end up with goal
    const cancelRate = goals?.cancel_rate || 0;
    const fundedGoalNeeded = cancelRate > 0 && cancelRate < 1 
      ? activeGoal / (1 - cancelRate) 
      : activeGoal;
    
    // Count future planned days (not including today)
    const futurePlannedCount = plannedDays?.filter(d => {
      const date = parseISO(d.planned_date);
      return date > today && !isBefore(preseasonEnd, date);
    }).length || 0;
    
    // Total days = knocking days already done + future planned
    const knockingDays = workedDaysData?.knockingDays || 0;
    const totalDays = knockingDays + futurePlannedCount;
    
    // Daily goal = funded goal / total planned days
    const dailyGoal = totalDays > 0 ? fundedGoalNeeded / totalDays : 0;
    
    // Remaining needed = (funded goal - current progress) / remaining days
    const remaining = Math.max(0, fundedGoalNeeded - currentProgress);
    const remainingDays = futurePlannedCount + 1; // +1 for today
    const remainingDailyNeeded = remainingDays > 0 ? remaining / remainingDays : 0;
    
    return { dailyGoal, remainingDailyNeeded, fundedGoalNeeded, totalDays, futurePlannedDays: futurePlannedCount };
  }, [goals, activeTier, conversionFactor, plannedDays, workedDaysData, currentProgress]);

  // Calculate overall preseason pace status
  const preseasonPaceStatus = useMemo(() => {
    const knockingDays = workedDaysData?.knockingDays || 0;
    if (knockingDays === 0) return undefined;
    
    const preseasonGoal = (goals?.preseason_fp_goal || 0) * conversionFactor;
    if (preseasonGoal <= 0) return undefined;
    
    // Apply cancel buffer
    const cancelRate = goals?.cancel_rate || 0;
    const fundedGoalNeeded = cancelRate > 0 && cancelRate < 1 
      ? preseasonGoal / (1 - cancelRate) 
      : preseasonGoal;
    
    // Count future planned days
    const today = new Date();
    const preseasonEnd = parseISO(PRESEASON_END);
    const futurePlannedCount = plannedDays?.filter(d => {
      const date = parseISO(d.planned_date);
      return date > today && !isBefore(preseasonEnd, date);
    }).length || 0;
    
    const totalDays = knockingDays + futurePlannedCount;
    if (totalDays <= 0) return undefined;
    
    // Daily goal based on total planned + knocked days
    const dailyGoal = fundedGoalNeeded / totalDays;
    
    // Expected FP by now = daily goal × knocking days completed
    const expectedFp = dailyGoal * knockingDays;
    
    // Variance = actual - expected
    const paceVariance = currentProgress - expectedFp;
    
    return {
      knockingDays,
      expectedFp,
      actualFp: currentProgress,
      paceVariance,
    };
  }, [workedDaysData, goals, conversionFactor, plannedDays, currentProgress]);

  // Goal tiers data
  const tiers = useMemo(() => ({
    preseason: {
      goal: (goals?.preseason_fp_goal || 0) * conversionFactor,
      rawGoal: goals?.preseason_fp_goal || 0,
      complete: currentProgress >= (goals?.preseason_fp_goal || 0) * conversionFactor && (goals?.preseason_fp_goal || 0) > 0,
    },
    mustDo: {
      goal: (goals?.must_do_fp_goal || 0) * conversionFactor,
      rawGoal: goals?.must_do_fp_goal || 0,
      complete: currentProgress >= (goals?.must_do_fp_goal || 0) * conversionFactor && (goals?.must_do_fp_goal || 0) > 0,
    },
    willDo: {
      goal: (goals?.will_do_fp_goal || 0) * conversionFactor,
      rawGoal: goals?.will_do_fp_goal || 0,
      complete: currentProgress >= (goals?.will_do_fp_goal || 0) * conversionFactor && (goals?.will_do_fp_goal || 0) > 0,
    },
    couldDo: {
      goal: (goals?.could_do_fp_goal || 0) * conversionFactor,
      rawGoal: goals?.could_do_fp_goal || 0,
      complete: currentProgress >= (goals?.could_do_fp_goal || 0) * conversionFactor && (goals?.could_do_fp_goal || 0) > 0,
    },
  }), [goals, conversionFactor, currentProgress]);

  // Personal benchmarks hook for enhanced pace context
  const { data: benchmarks } = usePersonalBenchmarks({
    userId: repData?.user_id,
    personalSummerStart: seasonConfig?.personal_summer_start,
    personalSummerEnd: seasonConfig?.personal_summer_end,
    efpModeEnabled,
    calculateEfp,
    currentProgress,
    futurePlannedDays: paceData.futurePlannedDays || 0,
    fundedGoal: paceData.fundedGoalNeeded || 0,
  });

  // Calculate enhanced pace context for summer goals
  const enhancedPaceContext = useMemo(() => {
    if (!benchmarks || !isUserSummerStarted || activeTier === 'preseason') {
      return null;
    }

    const paceContext = calculatePaceContext(
      benchmarks.knockingDaysCompleted,
      paceData.remainingDailyNeeded || 0,
      benchmarks.currentAverage,
      benchmarks.weekInSummer,
      isRookie
    );

    const learningCurveMessage = getLearningCurvePrincipleMessage(
      benchmarks.weekInSummer,
      isRookie,
      paceContext
    );

    const suggestStretchGoal = calculateSuggestedStretchGoal(
      benchmarks.projectedFinal,
      tiers.couldDo.goal,
      benchmarks.hasEnoughData
    );

    return {
      paceContext,
      learningCurveMessage,
      suggestStretchGoal,
    };
  }, [benchmarks, isUserSummerStarted, activeTier, paceData.remainingDailyNeeded, isRookie, tiers.couldDo.goal]);

  // Auto-select appropriate tier based on progress and season
  // This only runs on initial load (no manual selection yet) to pick a sensible default.
  // Once user manually selects a tier, we never override it.
  useEffect(() => {
    if (!goals) return;
    
    // If user has already manually selected a tier this session, respect it
    if (hasManualTierSelection) return;

    // If user has a saved focus_tier in DB, use it
    if (goals.focus_tier) {
      const savedTier = goals.focus_tier as GoalTier;
      if (['mustDo', 'willDo', 'couldDo', 'preseason'].includes(savedTier)) {
        setActiveTier(savedTier);
        return;
      }
    }

    // Default selection logic for first load only:
    // During preseason, default to preseason tier if available and not complete
    if (isPreseason && !tiers.preseason.complete && tiers.preseason.goal > 0) {
      setActiveTier('preseason');
    } else if (!tiers.willDo.complete && tiers.willDo.goal > 0) {
      setActiveTier('willDo');
    } else if (!tiers.mustDo.complete && tiers.mustDo.goal > 0) {
      setActiveTier('mustDo');
    } else if (!tiers.couldDo.complete && tiers.couldDo.goal > 0) {
      setActiveTier('couldDo');
    } else if (tiers.willDo.goal > 0) {
      setActiveTier('willDo');
    }
  }, [goals, tiers, isPreseason, hasManualTierSelection]);

  // Handler for tier selection that persists to database (for summer tiers only)
  const handleTierSelect = async (tier: GoalTier) => {
    setHasManualTierSelection(true);
    setActiveTier(tier);
    // Only persist summer tiers to database
    if (tier !== 'preseason') {
      await updateGoals({ focus_tier: tier });
    }
  };

  const handleQuickIncrement = async (progressKey: string) => {
    // Check if this is a full reset action (wrap-around)
    if (progressKey.endsWith('_reset')) {
      const actualKey = progressKey.replace('_reset', '');
      await updateGoals({
        [actualKey]: 0,
      });
      return;
    }
    
    // Check if this is a decrement by 1 action
    if (progressKey.endsWith('_reset_one')) {
      const actualKey = progressKey.replace('_reset_one', '');
      const currentProgress = Number(goals?.[actualKey as keyof typeof goals]) || 0;
      if (currentProgress > 0) {
        await updateGoals({
          [actualKey]: currentProgress - 1,
        });
      }
      return;
    }
    
    const currentProgress = Number(goals?.[progressKey as keyof typeof goals]) || 0;
    await updateGoals({
      [progressKey]: currentProgress + 1,
    });
  };

  const handleSaveTrainingTime = async (totalMinutes: number) => {
    await updateGoals({
      training_hours_progress: totalMinutes,
    });
    setShowTrainingTimer(false);
  };

  // Handler to show commit confirmation drawer
  const handleRequestCommitToBlitz = (blitz: { id: string; name: string; date: string; endDate?: string | null; location?: string | null }) => {
    setConfirmCommitBlitz(blitz);
  };

  // Handler to show uncommit confirmation drawer
  const handleRequestUncommitFromBlitz = (blitzId: string, blitzName: string) => {
    setConfirmUncommitBlitz({ id: blitzId, name: blitzName });
  };

  const handleConfirmCommitToBlitz = async () => {
    const blitz = confirmCommitBlitz;
    if (!blitz || !repData?.id) return;
    
    setIsCommitting(blitz.id);
    setConfirmCommitBlitz(null);
    
    try {
      const newCommitment: CommittedBlitz = {
        id: blitz.id,
        name: blitz.name,
        date: blitz.date,
        endDate: blitz.endDate || undefined,
        location: blitz.location || undefined,
      };
      
      const newCommitments = [...committedBlitzes, newCommitment];
      const newBlitzIds = newCommitments.map(b => b.id);
      
      // Update local Supabase first
      const { error } = await supabase
        .from('reps')
        .update({ committed_blitzes: newCommitments as any })
        .eq('id', repData.id);
      
      if (error) throw error;
      
      // Sync committed blitzes via edge function
      await supabase.functions.invoke('update-blitz-commitment', {
        body: {
          repId: repData.id,
          blitzPageIds: newBlitzIds,
        },
      });
      
      await queryClient.invalidateQueries({ queryKey: ['rep-data'] });
      toastHook({ title: "Committed!", description: `You're going to ${blitz.name}` });
    } catch (error) {
      console.error('Error committing to blitz:', error);
      toastHook({ title: "Failed to commit", variant: "destructive" });
    } finally {
      setIsCommitting(null);
    }
  };

  const handleConfirmUncommitFromBlitz = async () => {
    const blitz = confirmUncommitBlitz;
    if (!blitz || !repData?.id) return;
    
    setIsCommitting(blitz.id);
    setConfirmUncommitBlitz(null);
    
    try {
      const newCommitments = committedBlitzes.filter(b => b.id !== blitz.id);
      const newBlitzIds = newCommitments.map(b => b.id);
      
      // Update local Supabase first
      const { error } = await supabase
        .from('reps')
        .update({ committed_blitzes: newCommitments as any })
        .eq('id', repData.id);
      
      if (error) throw error;
      
      // Sync committed blitzes via edge function
      await supabase.functions.invoke('update-blitz-commitment', {
        body: {
          repId: repData.id,
          blitzPageIds: newBlitzIds,
        },
      });
      
      await queryClient.invalidateQueries({ queryKey: ['rep-data'] });
      toastHook({ title: "Uncommitted", description: "You've been removed from this trip" });
    } catch (error) {
      console.error('Error uncommitting from blitz:', error);
      toastHook({ title: "Failed to uncommit", variant: "destructive" });
    } finally {
      setIsCommitting(null);
    }
  };

  // Loading state - show skeleton while repData OR goals are loading
  // This prevents the wizard from flashing before data is ready
  const isDataLoading = repDataInitializing || repDataLoading || isLoading || !repData;
  
  if (isDataLoading) {
    return (
      <Layout>
        <div className="p-4 space-y-6">
          <div className="flex justify-center py-8">
            <Skeleton className="h-56 w-56 rounded-full" />
          </div>
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </Layout>
    );
  }

  // Locked state for pre-Phase 1 rookies
  if (!hasGoalsAccess) {
    return (
      <Layout>
        <div className="p-4 flex flex-col items-center justify-center min-h-[60vh] text-center">
          <motion.div 
            className="p-5 rounded-full bg-gradient-to-br from-muted to-muted/50 mb-4"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <Lock className="h-8 w-8 text-muted-foreground" />
          </motion.div>
          <h2 className="text-xl font-bold mb-2">Goals</h2>
          <p className="text-muted-foreground max-w-xs">
            Complete Phase 1 of Ramp to Blitz to unlock goal setting and earnings planning.
          </p>
        </div>
      </Layout>
    );
  }

  // Setup wizard state (no goals set yet)
  if (!goals?.setup_complete || showSetupWizard) {
    return (
      <Layout>
        <div className="p-4">
          <div className="mb-6">
            {goals?.setup_complete && (
              <Button
                variant="ghost"
                size="sm"
                className="mb-2 -ml-2 text-muted-foreground"
                onClick={() => setShowSetupWizard(false)}
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
            <h1 className="text-2xl font-bold">
              {goals?.setup_complete ? 'Edit Your Goals' : 'Set Your Goals'}
            </h1>
            <p className="text-muted-foreground">
              {goals?.setup_complete ? 'Update your summer plan' : "Let's plan your summer success"}
            </p>
          </div>
          
          <GoalSetupWizard
            isRookie={isRookie}
            committedBlitzIds={committedBlitzes.map(b => b.id)}
            onComplete={async (data) => {
              try {
                // Save goals
                await updateGoals({
                  monthly_expenses: data.monthlyExpenses,
                  months_off: data.monthsOff,
                  rent_type: data.rentType,
                  avg_prmr_per_fp: data.avgPrmrPerFp,
                  weeks_working: data.weeksWorking,
                  must_do_fp_goal: data.mustDoFpGoal,
                  will_do_fp_goal: data.willDoFpGoal,
                  could_do_fp_goal: data.couldDoFpGoal,
                  preseason_fp_goal: data.preseasonFpGoal,
                  setup_complete: true,
                });

                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                  await supabase
                    .from('season_config')
                    .upsert({
                      user_id: user.id,
                      personal_summer_start: data.summerStart,
                      personal_summer_end: data.summerEnd,
                    }, {
                      onConflict: 'user_id'
                    });
                  
                  // Sync summer dates to reps table
                  if (repData?.id) {
                    await supabase.functions.invoke('update-summer-dates', {
                      body: {
                        repId: repData.id,
                        startDate: data.summerStart,
                        endDate: data.summerEnd,
                      },
                    });
                  }
                }

                // Handle blitz commitments if rookie selected any
                if (isRookie && data.selectedBlitzIds && data.selectedBlitzIds.length > 0 && repData?.id) {
                  const selectedBlitzDetails = allBlitzes
                    .filter(b => data.selectedBlitzIds?.includes(b.id))
                    .map(b => ({
                      id: b.id,
                      name: b.name,
                      date: b.date,
                      endDate: b.endDate || undefined,
                      location: b.location || undefined,
                    }));
                  
                  // Update local Supabase
                  const { error: blitzError } = await supabase
                    .from('reps')
                    .update({ committed_blitzes: selectedBlitzDetails as any })
                    .eq('id', repData.id);
                  
                  if (blitzError) {
                    console.error('Error saving blitz commitments:', blitzError);
                  } else {
                    console.log('Saved blitz commitments:', selectedBlitzDetails);
                  }
                  
                  // Sync to edge function
                  if (repData.id) {
                    await supabase.functions.invoke('update-blitz-commitment', {
                      body: {
                        repId: repData.id,
                        blitzPageIds: data.selectedBlitzIds,
                      },
                    });
                  }
                  
                  await queryClient.invalidateQueries({ queryKey: ['rep-data'] });
                }

                setShowSetupWizard(false);
                toast.success("Goals saved!");
              } catch (error) {
                toast.error("Failed to save goals");
              }
            }}
            onCancel={goals?.setup_complete ? () => setShowSetupWizard(false) : undefined}
          />
        </div>
      </Layout>
    );
  }

  const activeGoalData = tiers[activeTier];

  // Active state with goals - REDESIGNED
  return (
    <Layout>
      <div className="pb-24">
        {/* Header Actions */}
        <div className="flex items-center justify-between p-4 pb-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-2.5 py-1.5 rounded-full">
            <span className="font-medium">
              {Math.round((goals.cancel_rate ?? (isRookie ? 0.10 : 0.10)) * 100)}% cancel buffer
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl"
              onClick={() => setShowCalculator(true)}
            >
              <Calculator className="h-4 w-4" />
            </Button>
            <Button
              id="goals-settings-button"
              data-tour="goals-settings-button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl"
              onClick={() => setShowSetupWizard(true)}
            >
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Purpose Card - Your Why */}
        {goals.purpose_statement && (
          <motion.div 
            className="px-4 pt-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <PurposeCard
              purposeStatement={goals.purpose_statement}
              purposeUpdatedAt={goals.purpose_updated_at}
              onEdit={() => setShowSetupWizard(true)}
              variant="compact"
            />
          </motion.div>
        )}

        {/* Hero Ring Section */}
        <motion.div 
          id="goals-hero-ring"
          data-tour="goals-hero-ring"
          className="px-4 py-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
            <GoalHeroRing
            activeTier={activeTier}
            fpGoal={activeGoalData.goal}
            currentProgress={currentProgress}
            fundedProgress={fundedProgress < currentProgress ? fundedProgress : undefined}
            avgPrmrPerFp={85}
            upgradeFpGoal={goals.upgrade_fp_goal || 0}
            rentType={goals.rent_type || 'Single'}
            weeksWorking={goals.weeks_working || 18}
            efpMode={efpModeEnabled}
            onTierChange={handleTierSelect}
            tiers={tiers}
            dailyGoal={paceData.dailyGoal}
            todayProgress={todayProgress}
            remainingDailyNeeded={paceData.remainingDailyNeeded}
            isSummer={!isPreseason}
            isTodayPlanned={isTodayPlanned}
            hasAnyPlannedDays={hasAnyPlannedDays}
            isUserSummerStarted={isUserSummerStarted}
            preseasonPaceStatus={preseasonPaceStatus}
            // Enhanced pace context props
            paceContext={enhancedPaceContext?.paceContext}
            knockingDaysCompleted={benchmarks?.knockingDaysCompleted}
            currentAverage={benchmarks?.currentAverage}
            bestDay={benchmarks?.bestDay}
            projectedFinal={benchmarks?.projectedFinal}
            suggestStretchGoal={enhancedPaceContext?.suggestStretchGoal}
            canAddMoreDays={benchmarks?.canAddMoreDays}
            availableDaysToAdd={benchmarks?.availableDaysToAdd}
            isRookie={isRookie}
            weekInSummer={benchmarks?.weekInSummer}
            learningCurveMessage={enhancedPaceContext?.learningCurveMessage}
          />
        </motion.div>

        {/* Commitment Chips Section - ONLY show during preseason (before user's summer starts) */}
        {!isUserSummerStarted && (
          <motion.div 
            id="goals-commitment-chips"
            data-tour="goals-commitment-chips"
            className="px-4 pb-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <CommitmentChips
              goals={goals}
              preseasonFpProgress={currentProgress}
              blitzStats={blitzStats}
              onEdit={() => setShowCommitmentEditor(true)}
              onQuickIncrement={handleQuickIncrement}
              onTrainingClick={() => setShowTrainingTimer(true)}
              onBlitzClick={() => setShowBlitzEditor(true)}
              onBooksClick={() => setShowBooksDrawer(true)}
              isUpdating={isUpdating}
            />
          </motion.div>
        )}

        {/* Calendar Planning - Collapsible */}
        <motion.div 
          id="goals-calendar-planning"
          data-tour="goals-calendar-planning"
          className="px-4 pb-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: isUserSummerStarted ? 0.2 : 0.3 }}
        >
          <Collapsible open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <CollapsibleTrigger className="w-full">
              <div className={cn(
                "flex items-center justify-between p-4 rounded-2xl",
                "bg-gradient-to-r from-card to-card/80",
                "border border-border/50",
                "hover:shadow-md transition-shadow"
              )}>
                <span className="font-semibold">Calendar Planning</span>
                <ChevronDown className={cn(
                  "h-5 w-5 text-muted-foreground transition-transform duration-200",
                  isCalendarOpen && "rotate-180"
                )} />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="pt-2">
                <CalendarPlanningCard
                  mustDoFpGoal={goals.must_do_fp_goal || 0}
                  willDoFpGoal={goals.will_do_fp_goal || 0}
                  couldDoFpGoal={goals.could_do_fp_goal || 0}
                  avgPrmrPerFp={goals.avg_prmr_per_fp || 85}
                  rentType={goals.rent_type || 'Single'}
                  weeksWorking={goals.weeks_working || 18}
                  upgradeFpGoal={goals.upgrade_fp_goal || 0}
                  preseasonFpGoal={goals.preseason_fp_goal || 0}
                  cancelRate={goals.cancel_rate ?? (isRookie ? 0.10 : 0.10)}
                  onPreseasonGoalChange={(goal) => updateGoals({ preseason_fp_goal: goal })}
                  activeTier={activeTier}
                  isUserSummerStarted={isUserSummerStarted}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </motion.div>

        {/* Spending & ROI Card - only shows if user has spending data */}
        <div className="px-4 pb-4">
          <SpendingROICard />
        </div>

        {/* Canceled Stats */}
        <motion.div 
          className="px-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <CanceledStatsCard />
        </motion.div>
      </div>

      {/* Calculator Sheet */}
      <Sheet open={showCalculator} onOpenChange={setShowCalculator}>
        <SheetContent side="bottom" className="h-[85vh]">
          <SheetHeader>
            <SheetTitle>Payscale Calculator</SheetTitle>
          </SheetHeader>
          <div className="mt-4 overflow-y-auto">
            <PayscaleCalculator
              initialFpGoal={goals.will_do_fp_goal}
              initialAvgPrmr={goals.avg_prmr_per_fp}
              initialRentType={goals.rent_type}
              initialWeeks={goals.weeks_working}
              initialUpgradeFp={goals.upgrade_fp_goal}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Training Timer Drawer */}
      <Drawer open={showTrainingTimer} onOpenChange={setShowTrainingTimer}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Training Timer</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6">
            <TrainingTimer
              currentMinutes={goals.training_hours_progress || 0}
              weeklyGoal={(goals.training_hours_goal || 0)}
              history={(goals.training_hours_history as any) || []}
              streak={goals.training_streak || 0}
              onSave={handleSaveTrainingTime}
            />
          </div>
        </DrawerContent>
      </Drawer>

      {/* Blitz Editor Drawer */}
      <Drawer open={showBlitzEditor} onOpenChange={setShowBlitzEditor}>
        <DrawerContent className="max-h-[80dvh]">
          <DrawerHeader>
            <DrawerTitle>Blitz Commitments</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 overflow-y-auto space-y-4">
            {/* Committed blitzes */}
            {committedBlitzes.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Your Trips</p>
                <div className="space-y-2">
                  {committedBlitzes.map(blitz => (
                    <div 
                      key={blitz.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30"
                    >
                      <div>
                        <p className="font-medium">{blitz.name}</p>
                        <p className="text-xs text-muted-foreground">{blitz.location} · {blitz.date}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRequestUncommitFromBlitz(blitz.id, blitz.name)}
                        disabled={isCommitting === blitz.id}
                      >
                        Uncommit
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Available blitzes */}
            {futureAvailableBlitzes.filter(b => !committedBlitzes.some(c => c.id === b.id)).length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Available Trips</p>
                <div className="space-y-2">
                  {futureAvailableBlitzes
                    .filter(b => !committedBlitzes.some(c => c.id === b.id))
                    .map(blitz => (
                      <div 
                        key={blitz.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border/50"
                      >
                        <div>
                          <p className="font-medium">{blitz.name}</p>
                          <p className="text-xs text-muted-foreground">{blitz.location} · {blitz.date}</p>
                        </div>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleRequestCommitToBlitz(blitz)}
                          disabled={isCommitting === blitz.id}
                        >
                          Commit
                        </Button>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Commit Confirmation Drawer */}
      <Drawer open={!!confirmCommitBlitz} onOpenChange={(open) => !open && setConfirmCommitBlitz(null)}>
        <DrawerContent>
          <DrawerHeader className="text-center">
            <DrawerTitle>Confirm Commitment</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 space-y-4">
            <div className="text-center space-y-2">
              <p className="text-lg font-medium">{confirmCommitBlitz?.name}</p>
              <p className="text-sm text-muted-foreground">
                {confirmCommitBlitz?.date && new Date(confirmCommitBlitz.date).toLocaleDateString('en-US', { 
                  weekday: 'long',
                  month: 'long', 
                  day: 'numeric' 
                })}
                {confirmCommitBlitz?.location && ` · ${confirmCommitBlitz.location}`}
              </p>
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Are you sure you want to commit to this blitz? Your leader will be notified.
            </p>
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => setConfirmCommitBlitz(null)}
              >
                Cancel
              </Button>
              <Button 
                className="flex-1"
                onClick={handleConfirmCommitToBlitz}
                disabled={isCommitting === confirmCommitBlitz?.id}
              >
                {isCommitting === confirmCommitBlitz?.id ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Yes, Commit
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Uncommit Confirmation Drawer */}
      <Drawer open={!!confirmUncommitBlitz} onOpenChange={(open) => !open && setConfirmUncommitBlitz(null)}>
        <DrawerContent>
          <DrawerHeader className="text-center">
            <DrawerTitle>Confirm Uncommitment</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 space-y-4">
            <div className="text-center space-y-2">
              <p className="text-lg font-medium">{confirmUncommitBlitz?.name}</p>
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Are you sure you want to uncommit from this blitz? You can always commit again later.
            </p>
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => setConfirmUncommitBlitz(null)}
              >
                Cancel
              </Button>
              <Button 
                variant="destructive"
                className="flex-1"
                onClick={handleConfirmUncommitFromBlitz}
                disabled={isCommitting === confirmUncommitBlitz?.id}
              >
                {isCommitting === confirmUncommitBlitz?.id ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Yes, Uncommit
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Commitment Editor Drawer */}
      <CommitmentEditorDrawer
        open={showCommitmentEditor}
        onOpenChange={setShowCommitmentEditor}
        goals={goals}
        onUpdateGoals={updateGoals}
        isUpdating={isUpdating}
        preseasonFpProgress={totalFpPlus}
      />

      {/* Books Completion Drawer */}
      <BooksCompletionDrawer
        isOpen={showBooksDrawer}
        onClose={() => setShowBooksDrawer(false)}
        currentProgress={Number(goals.books_progress) || 0}
        onUpdateProgress={(newProgress) => updateGoals({ books_progress: newProgress })}
        onOpenCommitmentEditor={() => setShowCommitmentEditor(true)}
      />

      {/* Goals Page Tour - filtered to only show relevant steps based on season and available blitzes */}
      <PageTour
        steps={goalsTourSteps.filter(s => {
          // Hide commitment chips during summer
          if (isUserSummerStarted && s.target === 'goals-commitment-chips') return false;
          // Hide blitz button step if no future blitzes
          const hasAnyFutureBlitzes = allBlitzes.some(blitz => {
            const blitzStart = new Date(blitz.date);
            blitzStart.setHours(0, 0, 0, 0);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return blitzStart >= today;
          });
          if (!hasAnyFutureBlitzes && s.target === 'goals-blitz-button') return false;
          return true;
        })}
        isOpen={showTour}
        onComplete={completeTour}
        onSkip={skipTour}
        onStepAction={handleTourStepAction}
      />
    </Layout>
  );
};

export default Goals;