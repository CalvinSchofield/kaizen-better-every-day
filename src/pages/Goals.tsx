import { useState, useEffect, useMemo } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Lock, Settings, Calculator, ChevronDown } from "lucide-react";
import { useRepGoals } from "@/hooks/useRepGoals";
import { useRepData } from "@/hooks/useRepData";
import { usePreseasonFP } from "@/hooks/usePreseasonFP";
import { useBlitzes } from "@/hooks/useBlitzes";
import { usePlannedDays } from "@/hooks/usePlannedDays";
import { useDailyEntry } from "@/hooks/useDailyEntry";
import { GoalSetupWizard } from "@/components/goals/GoalSetupWizard";
import { GoalHeroRing, GoalTier } from "@/components/goals/GoalHeroRing";
import { CommitmentChips } from "@/components/goals/CommitmentChips";
import { PayscaleCalculator } from "@/components/goals/PayscaleCalculator";
import { CalendarPlanningCard } from "@/components/goals/CalendarPlanningCard";
import { CanceledStatsCard } from "@/components/goals/CanceledStatsCard";
import { TrainingTimer } from "@/components/goals/TrainingTimer";
import { CommitmentEditorDrawer } from "@/components/goals/CommitmentEditorDrawer";
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
  const { repData } = useRepData();
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
  const [showCommitmentEditor, setShowCommitmentEditor] = useState(false);
  const [showTrainingTimer, setShowTrainingTimer] = useState(false);
  const [showBlitzEditor, setShowBlitzEditor] = useState(false);
  const [activeTier, setActiveTier] = useState<GoalTier>('preseason');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isCommitting, setIsCommitting] = useState<string | null>(null);

  // Fetch worked days count for pace calculation
  const { data: workedDaysData } = useQuery({
    queryKey: ['goals-worked-days', repData?.user_id],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { workedDays: 0 };
      
      const { data: entries, error } = await supabase
        .from('daily_entries')
        .select('entry_date, doors_knocked, work_start_time, work_end_time')
        .eq('user_id', user.id)
        .eq('is_finalized', true)
        .gte('entry_date', PRESEASON_START)
        .lte('entry_date', PRESEASON_END);
      
      if (error) return { workedDays: 0 };
      
      // Count only "real knocking days" (doors >= 10 OR has work times)
      const realDays = entries?.filter(e => 
        (e.doors_knocked || 0) >= 10 || (e.work_start_time && e.work_end_time)
      ).length || 0;
      
      return { workedDays: realDays };
    },
    enabled: !!repData?.user_id,
    staleTime: 2 * 60 * 1000,
  });

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
      const blitzEnd = blitz.endDate ? new Date(blitz.endDate) : new Date(blitz.date);
      blitzEnd.setHours(23, 59, 59, 999);
      
      if (blitzEnd < today) {
        attended++;
      } else {
        const blitzStart = new Date(blitz.date);
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
      const blitzStart = new Date(blitz.date);
      blitzStart.setHours(0, 0, 0, 0);
      return blitzStart >= today;
    });
  }, [allBlitzes]);

  // Calculate current progress based on mode
  const currentProgress = efpModeEnabled ? calculateEfp(totalPRMR) : totalFpPlus;
  const fundedProgress = efpModeEnabled ? calculateEfp(fundedPRMR) : fundedFP;

  // Today's progress from entry (EFP or FP+ based on mode)
  const todayUpgradePrmr = (todayEntry as any)?.upgrade_prmr || 0;
  const todayFpPlus = (todayEntry?.fp_plus || 0) + (todayUpgradePrmr / 85);
  const todayProgress = efpModeEnabled 
    ? calculateEfp((todayEntry?.prmr || 0) + todayUpgradePrmr)
    : todayFpPlus;

  // Check if we're in preseason (before April 12, 2026)
  const isPreseason = new Date() < new Date('2026-04-12');

  // Convert goals to display values (EFP if enabled) - always use $85 for PRMR per FP
  const conversionFactor = efpModeEnabled ? 85 / 85 : 1; // Simplified since we're using $85

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
      return { dailyGoal: 0, remainingDailyNeeded: 0 };
    }
    
    // Count future planned days (not including today)
    const futurePlannedCount = plannedDays?.filter(d => {
      const date = parseISO(d.planned_date);
      return date > today && !isBefore(preseasonEnd, date);
    }).length || 0;
    
    // Total days = worked + future planned
    const workedDays = workedDaysData?.workedDays || 0;
    const totalDays = workedDays + futurePlannedCount;
    
    // Daily goal = total goal / total planned days
    const dailyGoal = totalDays > 0 ? activeGoal / totalDays : 0;
    
    // Remaining needed = (goal - current progress) / remaining days
    const remaining = Math.max(0, activeGoal - currentProgress);
    const remainingDays = futurePlannedCount + 1; // +1 for today
    const remainingDailyNeeded = remainingDays > 0 ? remaining / remainingDays : 0;
    
    return { dailyGoal, remainingDailyNeeded };
  }, [goals, activeTier, conversionFactor, plannedDays, workedDaysData, currentProgress]);

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

  // Auto-select appropriate tier based on progress and season
  useEffect(() => {
    if (!goals) return;
    
    // During preseason, default to preseason tier if goal exists and not complete
    if (isPreseason && !tiers.preseason.complete && tiers.preseason.goal > 0) {
      setActiveTier('preseason');
    } else if (!tiers.mustDo.complete && tiers.mustDo.goal > 0) {
      setActiveTier('mustDo');
    } else if (!tiers.willDo.complete && tiers.willDo.goal > 0) {
      setActiveTier('willDo');
    } else if (!tiers.couldDo.complete && tiers.couldDo.goal > 0) {
      setActiveTier('couldDo');
    } else if (isPreseason && tiers.preseason.goal > 0) {
      setActiveTier('preseason');
    } else if (tiers.willDo.goal > 0) {
      setActiveTier('willDo');
    }
  }, [goals, tiers, isPreseason]);

  const handleQuickIncrement = async (progressKey: string) => {
    // Check if this is a reset action (wrap-around)
    if (progressKey.endsWith('_reset')) {
      const actualKey = progressKey.replace('_reset', '');
      await updateGoals({
        [actualKey]: 0,
      });
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

  const handleCommitToBlitz = async (blitz: { id: string; name: string; date: string; endDate?: string | null; location?: string | null }) => {
    if (!repData?.id || !repData?.notion_page_id) return;
    setIsCommitting(blitz.id);
    
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
      
      // Also sync to Notion via edge function
      await supabase.functions.invoke('update-blitz-commitment', {
        body: {
          repNotionPageId: repData.notion_page_id,
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

  const handleUncommitFromBlitz = async (blitzId: string) => {
    if (!repData?.id || !repData?.notion_page_id) return;
    setIsCommitting(blitzId);
    
    try {
      const newCommitments = committedBlitzes.filter(b => b.id !== blitzId);
      const newBlitzIds = newCommitments.map(b => b.id);
      
      // Update local Supabase first
      const { error } = await supabase
        .from('reps')
        .update({ committed_blitzes: newCommitments as any })
        .eq('id', repData.id);
      
      if (error) throw error;
      
      // Also sync to Notion via edge function
      await supabase.functions.invoke('update-blitz-commitment', {
        body: {
          repNotionPageId: repData.notion_page_id,
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

  // Loading state
  if (isLoading) {
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

  // Setup wizard state (no goals set yet)
  if (!goals?.setup_complete || showSetupWizard) {
    return (
      <Layout>
        <div className="p-4">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Set Your Goals</h1>
            <p className="text-muted-foreground">
              Let's plan your summer success
            </p>
          </div>
          
          <GoalSetupWizard
            isRookie={isRookie}
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
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl"
              onClick={() => setShowSetupWizard(true)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Hero Ring Section */}
        <motion.div 
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
            onTierChange={setActiveTier}
            tiers={tiers}
            dailyGoal={paceData.dailyGoal}
            todayProgress={todayProgress}
            remainingDailyNeeded={paceData.remainingDailyNeeded}
            isSummer={!isPreseason}
          />
        </motion.div>

        {/* Commitment Chips Section */}
        <motion.div 
          className="px-4 pb-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <CommitmentChips
            goals={goals}
            preseasonFpProgress={totalFpPlus}
            blitzStats={blitzStats}
            onEdit={() => setShowCommitmentEditor(true)}
            onQuickIncrement={handleQuickIncrement}
            onTrainingClick={() => setShowTrainingTimer(true)}
            onBlitzClick={() => setShowBlitzEditor(true)}
            isUpdating={isUpdating}
          />
        </motion.div>

        {/* Calendar Planning - Collapsible */}
        <motion.div 
          className="px-4 pb-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
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
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </motion.div>

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
              onSave={handleSaveTrainingTime}
            />
          </div>
        </DrawerContent>
      </Drawer>

      {/* Blitz Editor Drawer */}
      <Drawer open={showBlitzEditor} onOpenChange={setShowBlitzEditor}>
        <DrawerContent className="max-h-[80vh]">
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
                        onClick={() => handleUncommitFromBlitz(blitz.id)}
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
                          onClick={() => handleCommitToBlitz(blitz)}
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

      {/* Commitment Editor Drawer */}
      <CommitmentEditorDrawer
        open={showCommitmentEditor}
        onOpenChange={setShowCommitmentEditor}
        goals={goals}
        onUpdateGoals={updateGoals}
        isUpdating={isUpdating}
        preseasonFpProgress={totalFpPlus}
      />
    </Layout>
  );
};

export default Goals;