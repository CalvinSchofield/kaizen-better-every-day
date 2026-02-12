import { useState, useEffect, useMemo, useCallback } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Lock, SlidersHorizontal, ChevronDown, ArrowLeft, Loader2, Check, BookOpen, Timer, Dumbbell, Phone, Target } from "lucide-react";
import { useRepGoals } from "@/hooks/useRepGoals";
import { useRepData } from "@/hooks/useRepData";
import { usePreseasonFP } from "@/hooks/usePreseasonFP";
import { useBlitzes } from "@/hooks/useBlitzes";
import { usePlannedDays } from "@/hooks/usePlannedDays";
import { useDailyEntry } from "@/hooks/useDailyEntry";
import { usePersonalBenchmarks } from "@/hooks/usePersonalBenchmarks";
import { useCurrentUserId } from "@/hooks/useCurrentUserId";
import { useEffectiveFP } from "@/hooks/useEffectiveFP";
import { GoalSetupWizard } from "@/components/goals/GoalSetupWizard";
import { GoalHeroRing, GoalTier } from "@/components/goals/GoalHeroRing";
import { CommitmentChips } from "@/components/goals/CommitmentChips";
import { PayscaleCalculator } from "@/components/goals/PayscaleCalculator";
import { QuickEditGoalsDrawer } from "@/components/goals/QuickEditGoalsDrawer";
import { CalendarPlanningPreview } from "@/components/goals/CalendarPlanningPreview";
import { CanceledStatsCard } from "@/components/goals/CanceledStatsCard";
import { CancelRateDrawer } from "@/components/goals/CancelRateDrawer";
import { EarningsBreakdownCard } from "@/components/goals/EarningsBreakdownCard";

import { CatchUpWizard } from "@/components/catchup/CatchUpWizard";
import { SyncDiscrepancyIndicator } from "@/components/catchup/SyncDiscrepancyIndicator";
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
import { parseDateAsLocal, formatBlitzDate } from "@/utils/blitzDateUtils";
import { calculatePaceContext, getLearningCurvePrincipleMessage, calculateSuggestedStretchGoal } from "@/utils/learningCurveData";
import { hasCompletedGoalsSetup } from "@/lib/goalsSetupCache";

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
    isFetching,
    hasGoalsAccess, 
    isRookie, 
    updateGoals, 
    isUpdating,
    checkAndResetWeeklyProgress,
    needsWeeklyCheck,
    refetch: refetchGoals
  } = useRepGoals();
  const { repData, isInitializing: repDataInitializing, loading: repDataLoading } = useRepData();
  const { userId, isReady: authReady } = useCurrentUserId();
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
  
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showQuickEdit, setShowQuickEdit] = useState(false);
  const [showBlitzEditor, setShowBlitzEditor] = useState(false);
  const [showCatchUpWizard, setShowCatchUpWizard] = useState(false);
  const [activeTier, setActiveTier] = useState<GoalTier>('preseason');
  const [hasManualTierSelection, setHasManualTierSelection] = useState(false);
  const [isCommitting, setIsCommitting] = useState<string | null>(null);
  const [showCancelRateDrawer, setShowCancelRateDrawer] = useState(false);
  const { data: effectiveFPData } = useEffectiveFP({
    seasonType: 'preseason',
    seasonStartDate: PRESEASON_START,
    seasonEndDate: PRESEASON_END,
  });

  const [confirmCommitBlitz, setConfirmCommitBlitz] = useState<{ id: string; name: string; date: string; endDate?: string | null; location?: string | null } | null>(null);
  const [confirmUncommitBlitz, setConfirmUncommitBlitz] = useState<{ id: string; name: string } | null>(null);

  const { data: workedDaysData } = useQuery({
    queryKey: ['goals-knocking-days', userId],
    queryFn: async () => {
      if (!userId) return { knockingDays: 0 };
      
      const { data: entries, error } = await supabase
        .from('daily_entries')
        .select('entry_date, doors_knocked, work_start_time, work_end_time')
        .eq('user_id', userId)
        .eq('is_finalized', true)
        .gte('entry_date', PRESEASON_START)
        .lte('entry_date', PRESEASON_END);
      
      if (error) return { knockingDays: 0 };
      
      const knockingDays = entries?.filter(e => 
        (e.doors_knocked || 0) >= 4 && e.work_start_time && e.work_end_time
      ).length || 0;
      
      const result = { knockingDays };
      
      try {
        localStorage.setItem(`goals-knocking-days-cache-${userId}`, JSON.stringify({
          data: result,
          timestamp: Date.now()
        }));
      } catch { /* ignore */ }
      
      return result;
    },
    enabled: !!userId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const { data: seasonConfig } = useQuery({
    queryKey: ['season-config-for-goals-page', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('season_config')
        .select('personal_summer_start, personal_summer_end')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      
      try {
        localStorage.setItem(`goals-season-config-cache-${userId}`, JSON.stringify({
          data,
          timestamp: Date.now()
        }));
      } catch { /* ignore */ }
      
      return data;
    },
    enabled: !!userId,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  const isUserSummerStarted = useMemo(() => {
    const personalStart = seasonConfig?.personal_summer_start;
    if (!personalStart) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = parseISO(personalStart);
    return today >= startDate;
  }, [seasonConfig?.personal_summer_start]);

  useEffect(() => {
    if (needsWeeklyCheck && goals) {
      checkAndResetWeeklyProgress();
    }
  }, [needsWeeklyCheck, goals, checkAndResetWeeklyProgress]);

  const committedBlitzes = useMemo(() => {
    return (repData?.committed_blitzes as unknown as CommittedBlitz[]) || [];
  }, [repData?.committed_blitzes]);

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

  const currentProgress = efpModeEnabled ? calculateEfp(totalPRMR) : totalFpPlus;
  const fundedProgress = efpModeEnabled ? calculateEfp(fundedPRMR) : fundedFP;

  const actualCancelRate = useMemo(() => {
    if (currentProgress <= 0) return null;
    const unfunded = currentProgress - fundedProgress;
    if (unfunded <= 0) return 0;
    return unfunded / currentProgress;
  }, [currentProgress, fundedProgress]);

  const todayUnfinalizedPrmr = useMemo(() => {
    if (!todayEntry) return 0;
    if (todayEntry.is_finalized) {
      return todayEntry.prmr || 0;
    }
    const salesLog = (todayEntry as any)?.sales_log || [];
    if (salesLog.length > 0) {
      return salesLog
        .filter((sale: any) => sale.install_status !== 'never_installed')
        .reduce((sum: number, sale: any) => sum + (Number(sale.prmr) || 0), 0);
    }
    return todayEntry.prmr || 0;
  }, [todayEntry]);

  const todayUnfinalizedFpPlus = useMemo(() => {
    if (!todayEntry) return 0;
    if (todayEntry.is_finalized) {
      return todayEntry.fp_plus || 0;
    }
    const salesLog = (todayEntry as any)?.sales_log || [];
    if (salesLog.length > 0) {
      const fundedSales = salesLog.filter((s: any) => s.install_status !== 'never_installed');
      let fp = 0;
      fundedSales.forEach((sale: any) => {
        const salePrmr = Number(sale.prmr) || 0;
        if (sale.type === 'fp') {
          fp += 1;
        } else if (sale.type === 'upgrade') {
          fp += salePrmr / 85;
        }
      });
      return fp;
    }
    return todayEntry.fp_plus || 0;
  }, [todayEntry]);

  const todayProgress = efpModeEnabled 
    ? calculateEfp(todayUnfinalizedPrmr)
    : todayUnfinalizedFpPlus;

  const isPreseason = new Date() < new Date('2026-04-12');
  const conversionFactor = efpModeEnabled ? 85 / 85 : 1;

  const isTodayPlanned = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    return plannedDays?.some(d => d.planned_date === todayStr) ?? false;
  }, [plannedDays]);

  const hasAnyPlannedDays = (plannedDays?.length || 0) > 0;

  const paceData = useMemo(() => {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const preseasonEnd = parseISO(PRESEASON_END);
    
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
    
    const cancelRate = goals?.cancel_rate || 0;
    const fundedGoalNeeded = cancelRate > 0 && cancelRate < 1 
      ? activeGoal / (1 - cancelRate) 
      : activeGoal;
    
    const futurePlannedCount = plannedDays?.filter(d => {
      const date = parseISO(d.planned_date);
      return date > today && !isBefore(preseasonEnd, date);
    }).length || 0;
    
    const knockingDays = workedDaysData?.knockingDays || 0;
    const totalDays = knockingDays + futurePlannedCount;
    
    const dailyGoal = totalDays > 0 ? fundedGoalNeeded / totalDays : 0;
    
    const remaining = Math.max(0, fundedGoalNeeded - currentProgress);
    const remainingDays = futurePlannedCount + 1;
    const remainingDailyNeeded = remainingDays > 0 ? remaining / remainingDays : 0;
    
    return { dailyGoal, remainingDailyNeeded, fundedGoalNeeded, totalDays, futurePlannedDays: futurePlannedCount };
  }, [goals, activeTier, conversionFactor, plannedDays, workedDaysData, currentProgress]);

  const preseasonPaceStatus = useMemo(() => {
    const knockingDays = workedDaysData?.knockingDays || 0;
    if (knockingDays === 0) return undefined;
    
    const preseasonGoal = (goals?.preseason_fp_goal || 0) * conversionFactor;
    if (preseasonGoal <= 0) return undefined;
    
    const cancelRate = goals?.cancel_rate || 0;
    const fundedGoalNeeded = cancelRate > 0 && cancelRate < 1 
      ? preseasonGoal / (1 - cancelRate) 
      : preseasonGoal;
    
    const today = new Date();
    const preseasonEnd = parseISO(PRESEASON_END);
    const futurePlannedCount = plannedDays?.filter(d => {
      const date = parseISO(d.planned_date);
      return date > today && !isBefore(preseasonEnd, date);
    }).length || 0;
    
    const totalDays = knockingDays + futurePlannedCount;
    if (totalDays <= 0) return undefined;
    
    const dailyGoal = fundedGoalNeeded / totalDays;
    const expectedFp = dailyGoal * knockingDays;
    const paceVariance = currentProgress - expectedFp;
    
    return {
      knockingDays,
      expectedFp,
      actualFp: currentProgress,
      paceVariance,
    };
  }, [workedDaysData, goals, conversionFactor, plannedDays, currentProgress]);

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

  useEffect(() => {
    if (!goals) return;
    if (hasManualTierSelection) return;

    if (goals.focus_tier) {
      const savedTier = goals.focus_tier as GoalTier;
      if (['mustDo', 'willDo', 'couldDo', 'preseason'].includes(savedTier)) {
        setActiveTier(savedTier);
        return;
      }
    }

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

  const handleTierSelect = async (tier: GoalTier) => {
    setHasManualTierSelection(true);
    setActiveTier(tier);
    if (tier !== 'preseason') {
      await updateGoals({ focus_tier: tier });
    }
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
      
      const { error } = await supabase
        .from('reps')
        .update({ committed_blitzes: newCommitments as any })
        .eq('id', repData.id);
      
      if (error) throw error;
      
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
      
      const { error } = await supabase
        .from('reps')
        .update({ committed_blitzes: newCommitments as any })
        .eq('id', repData.id);
      
      if (error) throw error;
      
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

  const hasGoalsData = !!goals;
  const canDecideSetup = authReady && !!userId && !isLoading;
  const isDataLoading = repDataInitializing || repDataLoading || !repData;
  const stickySetupComplete = hasCompletedGoalsSetup(userId);
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  useEffect(() => {
    if (hasGoalsData || !stickySetupComplete) {
      setLoadingTimeout(false);
      return;
    }
    const timer = setTimeout(() => setLoadingTimeout(true), 8000);
    return () => clearTimeout(timer);
  }, [hasGoalsData, stickySetupComplete]);

  if (!hasGoalsData && (!canDecideSetup || isDataLoading) && !stickySetupComplete) {
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
  
  if (stickySetupComplete && !hasGoalsData) {
    return (
      <Layout>
        <div className="p-4 space-y-6">
          <div className="flex justify-center py-8">
            {loadingTimeout ? (
              <div className="flex flex-col items-center gap-4">
                <p className="text-muted-foreground text-sm">Taking longer than expected...</p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setLoadingTimeout(false);
                    refetchGoals();
                  }}
                >
                  <Loader2 className={cn("h-4 w-4 mr-2", isFetching && "animate-spin")} />
                  Retry
                </Button>
              </div>
            ) : (
              <Skeleton className="h-56 w-56 rounded-full" />
            )}
          </div>
          {!loadingTimeout && (
            <>
              <Skeleton className="h-20 w-full rounded-2xl" />
              <Skeleton className="h-32 w-full rounded-2xl" />
            </>
          )}
        </div>
      </Layout>
    );
  }

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

  if ((canDecideSetup && !goals?.setup_complete && !stickySetupComplete) || showSetupWizard) {
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
                  purpose_statement: data.purposeStatement,
                  purpose_updated_at: data.purposeStatement ? new Date().toISOString() : undefined,
                  books_goal: data.booksGoal,
                  books_committed: data.selectedBookIds || null,
                  training_hours_goal: data.trainingHoursGoal,
                  role_plays_goal: data.rolePlaysGoal,
                  monday_night_lights_goal: data.mnlGoal,
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
                  
                  const { error: blitzError } = await supabase
                    .from('reps')
                    .update({ committed_blitzes: selectedBlitzDetails as any })
                    .eq('id', repData.id);
                  
                  if (blitzError) {
                    console.error('Error saving blitz commitments:', blitzError);
                  }
                  
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

  return (
    <Layout>
      <div className="pb-24">
        <div className="flex items-center justify-between p-4 pb-0">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowCancelRateDrawer(true)}
              className="text-xs text-muted-foreground bg-muted/50 px-2.5 py-1.5 rounded-full active:scale-95 transition-transform"
            >
              <span className="font-medium">
                {Math.round((goals.cancel_rate ?? (isRookie ? 0.10 : 0.10)) * 100)}% cancel buffer
              </span>
            </button>
            {effectiveFPData && (effectiveFPData.needsVerification || effectiveFPData.hasDiscrepancy) && (
              <SyncDiscrepancyIndicator
                hasDiscrepancy={effectiveFPData.hasDiscrepancy}
                discrepancyAmount={effectiveFPData.discrepancyAmount}
                daysSinceVerification={effectiveFPData.daysSinceVerification}
                needsVerification={effectiveFPData.needsVerification}
                hasOfficialTotals={effectiveFPData.hasOfficialTotals}
                onSyncClick={() => setShowCatchUpWizard(true)}
                variant="compact"
              />
            )}
          </div>
          <div className="flex gap-2">
            <Button
              id="goals-settings-button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl"
              onClick={() => {
                if (goals?.setup_complete) {
                  setShowQuickEdit(true);
                } else {
                  setShowSetupWizard(true);
                }
              }}
            >
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <motion.div 
          id="goals-hero-ring"
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

        {/* Read-only Preseason Commitments Card - ONLY show during preseason */}
        {!isUserSummerStarted && isRookie && (
          <motion.div 
            id="goals-preseason-commitments"
            className="px-4 pb-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Target className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">Your Preseason Commitments</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <BookOpen className="h-4 w-4 text-amber-500" />
                  <span>{goals.books_goal || 0} books</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Timer className="h-4 w-4 text-blue-500" />
                  <span>{goals.training_hours_goal || 0} hrs/wk</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Dumbbell className="h-4 w-4 text-emerald-500" />
                  <span>{goals.role_plays_goal || 0} role plays</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4 text-purple-500" />
                  <span>{goals.monday_night_lights_goal || 0} MNL</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        <div 
          id="goals-calendar-planning"
          className="px-4 pb-4"
        >
          <CalendarPlanningPreview
            goals={goals}
            activeTier={activeTier}
            knockingDays={workedDaysData?.knockingDays || 0}
            currentProgress={currentProgress}
          />
        </div>

        <div className="px-4 pb-4">
          <EarningsBreakdownCard />
        </div>

        {/* Cancel Rate Drawer */}
        <CancelRateDrawer
          open={showCancelRateDrawer}
          onOpenChange={setShowCancelRateDrawer}
          currentRate={goals.cancel_rate || 0.10}
          actualCancelRate={actualCancelRate}
          efpModeEnabled={efpModeEnabled}
          onSave={async (newRate) => {
            await updateGoals({ cancel_rate: newRate });
            setShowCancelRateDrawer(false);
          }}
        />

        {/* Quick Edit Drawer */}
        <QuickEditGoalsDrawer
          open={showQuickEdit}
          onOpenChange={setShowQuickEdit}
          currentGoals={{
            preseason_fp_goal: goals.preseason_fp_goal || 0,
            must_do_fp_goal: goals.must_do_fp_goal || 0,
            will_do_fp_goal: goals.will_do_fp_goal || 0,
            could_do_fp_goal: goals.could_do_fp_goal || 0,
          }}
          isUserSummerStarted={isUserSummerStarted}
          efpModeEnabled={efpModeEnabled}
          conversionFactor={conversionFactor}
          onSave={async (updates) => {
            await updateGoals(updates);
            setShowQuickEdit(false);
          }}
        />

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
                          <p className="text-sm text-muted-foreground">{formatBlitzDate(blitz.date, "MMM d")}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            setShowBlitzEditor(false);
                            setConfirmUncommitBlitz({ id: blitz.id, name: blitz.name });
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Available blitzes */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Upcoming Trips</p>
                {futureAvailableBlitzes.length > 0 ? (
                  <div className="space-y-2">
                    {futureAvailableBlitzes.map(blitz => (
                      <div 
                        key={blitz.id}
                        className="flex items-center justify-between p-3 rounded-xl border border-border"
                      >
                        <div>
                          <p className="font-medium">{blitz.name}</p>
                          <p className="text-sm text-muted-foreground">{formatBlitzDate(blitz.date, "MMM d")}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => {
                            setShowBlitzEditor(false);
                            setConfirmCommitBlitz({
                              id: blitz.id,
                              name: blitz.name,
                              date: blitz.date,
                              endDate: blitz.endDate,
                              location: blitz.location
                            });
                          }}
                        >
                          Join
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No upcoming trips available.</p>
                )}
              </div>
            </div>
          </DrawerContent>
        </Drawer>

        {/* Calculator Sheet */}
        <Sheet open={showCalculator} onOpenChange={setShowCalculator}>
          <SheetContent side="bottom" className="h-[90vh]">
            <SheetHeader>
              <SheetTitle>Earnings Calculator</SheetTitle>
            </SheetHeader>
            <div className="pt-6 h-full overflow-y-auto pb-20">
              <PayscaleCalculator />
            </div>
          </SheetContent>
        </Sheet>

        {/* Catch Up Wizard for syncing */}
        <CatchUpWizard 
          open={showCatchUpWizard} 
          onOpenChange={(open) => setShowCatchUpWizard(open)}
          seasonType="preseason"
        />

        {/* Commit/Uncommit Confirmations */}
        <Drawer open={!!confirmCommitBlitz} onOpenChange={(open) => !open && setConfirmCommitBlitz(null)}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Join {confirmCommitBlitz?.name}?</DrawerTitle>
            </DrawerHeader>
            <div className="p-4 pt-0 space-y-4">
              <p className="text-muted-foreground">
                Confirm your spot for this blitz trip.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setConfirmCommitBlitz(null)}>Cancel</Button>
                <Button className="flex-1" onClick={handleConfirmCommitToBlitz} disabled={!!isCommitting}>
                  {isCommitting === confirmCommitBlitz?.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm"}
                </Button>
              </div>
            </div>
          </DrawerContent>
        </Drawer>

        <Drawer open={!!confirmUncommitBlitz} onOpenChange={(open) => !open && setConfirmUncommitBlitz(null)}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Leave {confirmUncommitBlitz?.name}?</DrawerTitle>
            </DrawerHeader>
            <div className="p-4 pt-0 space-y-4">
              <p className="text-muted-foreground">
                Are you sure you want to remove this blitz from your schedule?
              </p>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setConfirmUncommitBlitz(null)}>Cancel</Button>
                <Button variant="destructive" className="flex-1" onClick={handleConfirmUncommitFromBlitz} disabled={!!isCommitting}>
                  {isCommitting === confirmUncommitBlitz?.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Leave Trip"}
                </Button>
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </Layout>
  );
};

export default Goals;
