import { Target, ChevronRight, Edit2, Zap, Lightbulb, Settings2, BarChart3, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { useDailyEntry } from "@/hooks/useDailyEntry";
import { useRepGoals } from "@/hooks/useRepGoals";
import { usePlannedDays } from "@/hooks/usePlannedDays";
import { useEfpMode } from "@/hooks/useEfpMode";
import { usePreseasonFP } from "@/hooks/usePreseasonFP";
import { useFocusTier, FocusTier } from "@/hooks/useFocusTier";
import { useSmartActivityGoals } from "@/hooks/useSmartActivityGoals";
import { calculateSalesPace } from "@/utils/salesPaceCalculator";
import { useState, useEffect, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { getLearningCurvePrincipleMessage, calculatePaceContext } from "@/utils/learningCurveData";
import { cn } from "@/lib/utils";

interface DailyFocusCardProps {
  repData: any;
  /** Hero mode for working state - larger display */
  heroMode?: boolean;
}

const tierLabels: Record<FocusTier, string> = {
  mustDo: 'Must Do',
  willDo: 'Will Do',
  couldDo: 'Could Do',
};

export const DailyFocusCard = ({ repData, heroMode = false }: DailyFocusCardProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { entry } = useDailyEntry();
  const { goals, hasGoalsAccess, isLoading: goalsLoading } = useRepGoals();
  const { plannedDays } = usePlannedDays();
  const { efpModeEnabled, calculateEfp } = useEfpMode();
  const { totalFP, totalPRMR, knockingDays } = usePreseasonFP();
  const [isEditing, setIsEditing] = useState(false);
  const [useManualGoals, setUseManualGoals] = useState(false);
  const isRookie = repData?.year === "Rookie";

  // Calculate today's progress from sales_log
  const todayTransitions = entry?.transitions || 0;
  const todayPresentations = entry?.presentations || 0;
  
  const { todayFP, todayPRMR } = useMemo(() => {
    if (!entry) return { todayFP: 0, todayPRMR: 0 };
    
    const salesLog = entry.sales_log as Array<{ fp?: number; prmr?: number; upgrade_prmr?: number }> | null;
    if (salesLog && Array.isArray(salesLog) && salesLog.length > 0) {
      let totalFP = 0;
      let totalPRMR = 0;
      salesLog.forEach(sale => {
        totalFP += (sale.fp || 0) + ((sale.upgrade_prmr || 0) / 85);
        totalPRMR += (sale.prmr || 0) + (sale.upgrade_prmr || 0);
      });
      return { todayFP: totalFP, todayPRMR: totalPRMR };
    }
    
    const entryAny = entry as any;
    return { 
      todayFP: entry.fp_plus || 0, 
      todayPRMR: (entry.prmr || 0) + (entryAny.upgrade_prmr || 0) 
    };
  }, [entry]);

  const displayValue = efpModeEnabled ? calculateEfp(todayPRMR) : todayFP;
  const displayLabel = efpModeEnabled ? "EFP" : "FP+";

  // Focus tier hook for summer goals (includes isUserSummerStarted)
  const { 
    focusTier, 
    setFocusTier, 
    focusTierGoal, 
    allTiers, 
    isUserSummerStarted,
    isLoading: focusTierLoading 
  } = useFocusTier(displayValue);

  // Activity goals from localStorage (user-editable fallback)
  const [transitionsGoal, setTransitionsGoal] = useState(3);
  const [presentationsGoal, setPresentationsGoal] = useState(2);
  const [transitionsInput, setTransitionsInput] = useState("3");
  const [presentationsInput, setPresentationsInput] = useState("2");

  // Calculate daily FP+ goal from pace calculator (read-only, derived from Goals setup)
  const { calculatedDailyFpGoal, paceResult } = useMemo(() => {
    if (!goals?.setup_complete || !plannedDays) return { calculatedDailyFpGoal: null, paceResult: null };
    
    const result = calculateSalesPace({
      goals,
      plannedDays,
      knockingDays,
      currentFpPlus: totalFP,
      currentPrmr: totalPRMR,
      efpModeEnabled,
      calculateEfp,
    });
    
    if (!result) return { calculatedDailyFpGoal: null, paceResult: null };
    
    return {
      calculatedDailyFpGoal: Math.round(result.dailyGoal * 10) / 10,
      paceResult: result
    };
  }, [goals, plannedDays, knockingDays, totalFP, totalPRMR, efpModeEnabled, calculateEfp]);

  // The daily goal to use - preseason uses calculatedDailyFpGoal, summer uses pace from focus tier
  const fpGoal = calculatedDailyFpGoal ?? 1;

  // Smart activity goals based on conversion rates
  const smartGoals = useSmartActivityGoals({
    dailyFpGoal: fpGoal,
    isRookie,
  });

  // Determine which activity goals to show
  const effectiveTransitionsGoal = (!smartGoals.isUsingManualGoals && !useManualGoals && smartGoals.hasEnoughData) 
    ? smartGoals.suggestedTransitions 
    : transitionsGoal;
  const effectivePresentationsGoal = (!smartGoals.isUsingManualGoals && !useManualGoals && smartGoals.hasEnoughData)
    ? smartGoals.suggestedPresentations
    : presentationsGoal;

  // Calculate pace context for messaging
  const paceMessage = useMemo(() => {
    // Smart goal remaining message takes priority
    if (smartGoals.hasEnoughData && !useManualGoals) {
      const remaining = smartGoals.presentationsRemaining;
      if (remaining > 0) {
        return `${remaining} more presentation${remaining !== 1 ? 's' : ''} to hit your goal!`;
      } else if (displayValue >= fpGoal) {
        return "You hit your daily goal! 🎉";
      }
    }

    if (!paceResult || knockingDays < 18) {
      return "Keep building momentum — progress isn't always linear.";
    }
    
    const currentAverage = knockingDays > 0 ? paceResult.currentProgress / knockingDays : 0;
    
    const paceContext = calculatePaceContext(
      knockingDays,
      paceResult.remainingDailyNeeded,
      currentAverage,
      1,
      false
    );
    
    if (paceContext === 'building-momentum' || paceContext === 'on-track') {
      return `You're on pace for your ${paceResult.isInPreseason ? 'preseason' : 'focus'} goal!`;
    } else if (paceContext === 'stretch') {
      return `Push for your best days — you've got this!`;
    } else if (paceContext === 'very-ambitious') {
      return `Your best weeks may still be ahead. Keep pushing!`;
    }
    
    return null;
  }, [paceResult, knockingDays, smartGoals, useManualGoals, displayValue, fpGoal]);

  // Load activity goals from localStorage on mount
  useEffect(() => {
    const savedTransitions = localStorage.getItem('daily_transitions_goal');
    const savedPresentations = localStorage.getItem('daily_presentations_goal');
    const savedManualPref = localStorage.getItem('use_manual_activity_goals');
    
    if (savedTransitions) {
      const val = parseInt(savedTransitions);
      setTransitionsGoal(val);
      setTransitionsInput(String(val));
    }
    if (savedPresentations) {
      const val = parseInt(savedPresentations);
      setPresentationsGoal(val);
      setPresentationsInput(String(val));
    }
    if (savedManualPref === 'true') {
      setUseManualGoals(true);
    }
  }, []);

  const transitionsProgress = effectiveTransitionsGoal > 0 ? Math.min((todayTransitions / effectiveTransitionsGoal) * 100, 100) : 0;
  const presentationsProgress = effectivePresentationsGoal > 0 ? Math.min((todayPresentations / effectivePresentationsGoal) * 100, 100) : 0;
  const fpProgress = fpGoal > 0 ? Math.min((displayValue / fpGoal) * 100, 100) : 0;

  const handleSaveGoals = () => {
    const transVal = parseInt(transitionsInput) || 3;
    const presVal = parseInt(presentationsInput) || 2;
    
    setTransitionsGoal(transVal);
    setPresentationsGoal(presVal);
    
    localStorage.setItem('daily_transitions_goal', String(transVal));
    localStorage.setItem('daily_presentations_goal', String(presVal));
    
    setIsEditing(false);
    toast({
      title: "Activity targets updated",
      description: "Your daily activity targets have been saved.",
    });
  };

  const handleCancelEdit = () => {
    setTransitionsInput(String(transitionsGoal));
    setPresentationsInput(String(presentationsGoal));
    setIsEditing(false);
  };

  const handleTierChange = async (tier: FocusTier) => {
    await setFocusTier(tier);
    toast({
      title: `Focus changed to ${tierLabels[tier]}`,
      description: "Your daily pace has been updated.",
    });
  };

  const toggleManualGoals = () => {
    const newValue = !useManualGoals;
    setUseManualGoals(newValue);
    localStorage.setItem('use_manual_activity_goals', String(newValue));
  };

  // Show CTA to set up goals if no goals are set
  const showGoalsCTA = hasGoalsAccess && !goals?.setup_complete && !goalsLoading;

  if (showGoalsCTA) {
    return (
      <Card className="border-2 border-primary/20 shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <CardTitle>Set Your Goals</CardTitle>
          </div>
          <CardDescription>Plan your summer with your leader</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Set up your summer goals to see personalized daily targets and track your progress toward your earnings goals.
          </p>
          <Button 
            onClick={() => navigate('/goals')} 
            className="w-full"
          >
            <Zap className="h-4 w-4 mr-2" />
            Set Up Goals
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(
      "border-2 border-primary/20 shadow-lg transition-all",
      heroMode && "border-primary/40 shadow-xl"
    )}>
      <CardHeader className={cn(heroMode && "pb-2")}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className={cn("h-5 w-5 text-primary", heroMode && "h-6 w-6")} />
            <CardTitle className={cn(heroMode && "text-xl")}>Today's Focus</CardTitle>
          </div>
          {!isEditing ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="h-8 text-muted-foreground hover:text-foreground"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
        
        {/* Summer: Show 3-tier selector */}
        {isUserSummerStarted && goals?.setup_complete && !isEditing && (
          <div className="flex items-center gap-1.5 pt-2">
            {(['mustDo', 'willDo', 'couldDo'] as FocusTier[]).map((tier) => {
              const tierData = allTiers[tier];
              const isActive = focusTier === tier;
              const isComplete = tierData.complete;
              
              return (
                <button
                  key={tier}
                  onClick={() => handleTierChange(tier)}
                  className={cn(
                    "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                    isActive 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted text-muted-foreground hover:bg-muted/80",
                    isComplete && !isActive && "text-green-600 dark:text-green-400"
                  )}
                >
                  {isComplete && <CheckCircle2 className="h-3 w-3" />}
                  {tierLabels[tier]}
                </button>
              );
            })}
          </div>
        )}
        
        {/* Preseason: Show simple description */}
        {!isUserSummerStarted && (
          <CardDescription>
            {goals?.setup_complete 
              ? "Your daily targets based on your preseason goal" 
              : "Simplify your mission today"}
          </CardDescription>
        )}
      </CardHeader>
      
      <CardContent className={cn("space-y-4", heroMode && "space-y-5")}>
        {isEditing ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="transitions-goal">Transitions Goal</Label>
              <Input
                id="transitions-goal"
                type="number"
                value={transitionsInput}
                onChange={(e) => setTransitionsInput(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="presentations-goal">Presentations Goal</Label>
              <Input
                id="presentations-goal"
                type="number"
                value={presentationsInput}
                onChange={(e) => setPresentationsInput(e.target.value)}
                className="h-11"
              />
            </div>
            
            {/* EFP Goal - read-only, from Goals setup */}
            {goals?.setup_complete && (
              <div className="space-y-2 pt-2 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <Label className="text-muted-foreground">{displayLabel} Goal</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/goals')}
                    className="h-6 px-2 text-xs text-primary hover:text-primary"
                  >
                    <Settings2 className="h-3 w-3 mr-1" />
                    Edit in Goals
                  </Button>
                </div>
                <div className="h-11 px-3 flex items-center bg-muted/50 rounded-md border border-input">
                  <span className="text-muted-foreground">{fpGoal.toFixed(1)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Calculated from your {isUserSummerStarted ? tierLabels[focusTier] : 'preseason'} goal ÷ planned days
                </p>
              </div>
            )}
            
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleCancelEdit}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleSaveGoals}
              >
                Save
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* FP+ / EFP - Primary metric (from Goals) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1.5">
                  <span className={cn("text-muted-foreground", heroMode && "text-base")}>{displayLabel}</span>
                  {goals?.setup_complete && (
                    <span className="text-[10px] text-muted-foreground/70 bg-muted px-1.5 py-0.5 rounded">
                      {isUserSummerStarted ? tierLabels[focusTier] : 'preseason'}
                    </span>
                  )}
                </div>
                <span className={cn("font-semibold text-lg", heroMode && "text-2xl")}>
                  {displayValue.toFixed(1)} / {fpGoal.toFixed(1)}
                </span>
              </div>
              <Progress 
                value={fpProgress} 
                className={cn("h-3", heroMode && "h-4")}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Transitions</span>
                  {smartGoals.hasEnoughData && !useManualGoals && (
                    <BarChart3 className="h-3 w-3 text-primary" />
                  )}
                </div>
                <span className={cn("font-semibold text-lg", heroMode && "text-xl")}>
                  {todayTransitions} / {effectiveTransitionsGoal}
                </span>
              </div>
              <Progress value={transitionsProgress} className="h-3" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Presentations</span>
                  {smartGoals.hasEnoughData && !useManualGoals && (
                    <BarChart3 className="h-3 w-3 text-primary" />
                  )}
                </div>
                <span className={cn("font-semibold text-lg", heroMode && "text-xl")}>
                  {todayPresentations} / {effectivePresentationsGoal}
                </span>
              </div>
              <Progress value={presentationsProgress} className="h-3" />
            </div>

            {/* Smart goals indicator */}
            {smartGoals.hasEnoughData && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-muted-foreground/70 flex items-center gap-1">
                  <BarChart3 className="h-2.5 w-2.5" />
                  {useManualGoals ? 'Using your targets' : 'Based on your data'}
                </span>
                <button
                  onClick={toggleManualGoals}
                  className="text-[10px] text-primary hover:underline"
                >
                  {useManualGoals ? 'Use smart goals' : 'Use my targets'}
                </button>
              </div>
            )}

            {/* Pace Context Message */}
            {paceMessage && goals?.setup_complete && (
              <div className={cn(
                "flex items-start gap-2 pt-2 border-t border-border/50",
                heroMode && "pt-3"
              )}>
                <Lightbulb className={cn(
                  "h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5",
                  heroMode && "h-4 w-4"
                )} />
                <p className={cn(
                  "text-xs text-muted-foreground leading-relaxed",
                  heroMode && "text-sm"
                )}>
                  {paceMessage}
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
