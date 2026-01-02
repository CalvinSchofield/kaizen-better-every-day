import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Calendar, BarChart3, Target, Sparkles, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRepGoals } from "@/hooks/useRepGoals";
import { usePlannedDays } from "@/hooks/usePlannedDays";
import { useMeVsMe } from "@/hooks/useMeVsMe";
import { useEfpMode } from "@/hooks/useEfpMode";
import { useFocusTier, FocusTier } from "@/hooks/useFocusTier";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getSeasonInfo } from "@/utils/seasonWeekUtils";
import confetti from "canvas-confetti";

interface PostSaveSuccessSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: {
    doors: number;
    dms?: number;
    pitches?: number;
    transitions?: number;
    presentations: number;
    closes: number;
    fpPlus: number;
    prmr: number;
    hoursWorked?: number;
  };
  onKeepWorking: () => void;
}

export const PostSaveSuccessSheet = ({ 
  open, 
  onOpenChange, 
  summary,
  onKeepWorking,
}: PostSaveSuccessSheetProps) => {
  const navigate = useNavigate();
  const { goals } = useRepGoals();
  const { plannedDays } = usePlannedDays();
  const { isEnabled: meVsMeEnabled } = useMeVsMe();
  const { efpModeEnabled, calculateEfp } = useEfpMode();
  
  // Get current season info and comparison year
  const seasonInfo = useMemo(() => getSeasonInfo(new Date()), []);
  const comparisonYear = seasonInfo ? seasonInfo.year - 1 : 2025;
  
  // Calculate day number from season start
  const dayNumber = useMemo(() => {
    if (!seasonInfo) return null;
    return (seasonInfo.week - 1) * 7 + seasonInfo.dayOfWeek;
  }, [seasonInfo]);
  
  // Fetch historical entry for the same day number
  const { data: historicalEntry } = useQuery({
    queryKey: ['historical-day-comparison', comparisonYear, seasonInfo?.type, dayNumber],
    queryFn: async () => {
      if (!dayNumber || !seasonInfo) return null;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      // Find entry with matching day number
      const { data, error } = await supabase
        .from('historical_entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('season_year', comparisonYear)
        .eq('season_type', seasonInfo.type);
      
      if (error || !data) return null;
      
      // Find entry matching day number
      const matchingEntry = data.find(entry => {
        const entryDayNumber = (entry.season_week - 1) * 7 + entry.day_of_week;
        return entryDayNumber === dayNumber;
      });
      
      return matchingEntry || null;
    },
    enabled: open && meVsMeEnabled && !!seasonInfo && !!dayNumber,
    staleTime: 5 * 60 * 1000,
  });
  
  // Calculate comparison metrics
  const comparison = useMemo(() => {
    if (!historicalEntry) return null;
    
    const currentEfp = efpModeEnabled ? calculateEfp(summary.prmr) : summary.fpPlus;
    const historicalEfp = efpModeEnabled 
      ? calculateEfp(historicalEntry.prmr || 0) 
      : (historicalEntry.fp_plus || 0);
    
    // Priority order for metrics
    const metrics = [
      { 
        key: 'efp', 
        label: efpModeEnabled ? 'EFP' : 'FP+', 
        current: currentEfp, 
        historical: historicalEfp,
        format: (v: number) => v.toFixed(1)
      },
      { 
        key: 'prmr', 
        label: 'PRMR', 
        current: summary.prmr, 
        historical: historicalEntry.prmr || 0,
        format: (v: number) => `$${Math.round(v)}`
      },
      { 
        key: 'closes', 
        label: 'closes', 
        current: summary.closes, 
        historical: historicalEntry.closes || 0,
        format: (v: number) => v.toString()
      },
      { 
        key: 'presentations', 
        label: 'presentations', 
        current: summary.presentations, 
        historical: historicalEntry.presentations || 0,
        format: (v: number) => v.toString()
      },
      { 
        key: 'transitions', 
        label: 'transitions', 
        current: summary.transitions || 0, 
        historical: historicalEntry.transitions || 0,
        format: (v: number) => v.toString()
      },
      { 
        key: 'hours', 
        label: 'hours', 
        current: summary.hoursWorked || 0, 
        historical: historicalEntry.hours_worked || 0,
        format: (v: number) => v.toFixed(1)
      },
      { 
        key: 'pitches', 
        label: 'pitches', 
        current: summary.pitches || 0, 
        historical: historicalEntry.pitches || 0,
        format: (v: number) => v.toString()
      },
      { 
        key: 'dms', 
        label: 'DMs', 
        current: summary.dms || 0, 
        historical: historicalEntry.decision_makers || 0,
        format: (v: number) => v.toString()
      },
      { 
        key: 'doors', 
        label: 'doors', 
        current: summary.doors, 
        historical: historicalEntry.doors_knocked || 0,
        format: (v: number) => v.toString()
      },
    ];
    
    // Find first metric with a meaningful delta (both have data)
    const significantMetric = metrics.find(m => 
      (m.current > 0 || m.historical > 0) && 
      m.current !== m.historical
    );
    
    if (!significantMetric) return null;
    
    const delta = significantMetric.current - significantMetric.historical;
    const isAhead = delta > 0;
    const isBehind = delta < 0;
    
    return {
      metric: significantMetric,
      delta,
      isAhead,
      isBehind,
      year: comparisonYear,
    };
  }, [historicalEntry, summary, efpModeEnabled, calculateEfp, comparisonYear]);
  
  // Calculate display values based on EFP mode
  const displayFpValue = useMemo(() => {
    if (efpModeEnabled) {
      return calculateEfp(summary.prmr);
    }
    return summary.fpPlus;
  }, [efpModeEnabled, calculateEfp, summary.prmr, summary.fpPlus]);
  
  const displayLabel = efpModeEnabled ? "EFP" : "FP+";
  
  // Get focus tier for goal calculation
  const { fundedFocusTierGoal, focusTier, setFocusTier, allTiers, isUserSummerStarted } = useFocusTier(displayFpValue);
  
  // Tier display config
  const tierLabels: Record<FocusTier, string> = {
    mustDo: 'Must Do',
    willDo: 'Will Do',
    couldDo: 'Could Do',
  };
  
  // Calculate daily goal based on remaining planned days
  // For preseason: use preseason goal; for summer: use focus tier goal
  const dailyGoal = useMemo(() => {
    if (!goals?.setup_complete || !plannedDays) return null;
    
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // Get remaining planned days from today onwards (including today)
    const remainingPlannedDays = plannedDays.filter(d => d.planned_date >= todayStr);
    
    if (remainingPlannedDays.length === 0) return null;
    
    // Use the focused tier goal for summer, preseason goal for preseason
    let targetGoal: number;
    if (isUserSummerStarted) {
      targetGoal = fundedFocusTierGoal;
    } else {
      // Preseason goal with cancel rate buffer
      const cancelRate = goals.cancel_rate || 0;
      const preseasonGoal = goals.preseason_fp_goal || 0;
      const fundedPreseasonGoal = cancelRate > 0 && cancelRate < 1 
        ? preseasonGoal / (1 - cancelRate) 
        : preseasonGoal;
      const conversionFactor = efpModeEnabled ? (goals.avg_prmr_per_fp || 85) / 85 : 1;
      targetGoal = fundedPreseasonGoal * conversionFactor;
    }
    
    // Simple daily target based on planned days
    const dailyTarget = targetGoal / remainingPlannedDays.length;
    
    return Math.max(Math.round(dailyTarget * 10) / 10, 0.5);
  }, [goals, plannedDays, fundedFocusTierGoal, isUserSummerStarted, efpModeEnabled]);

  const goalMet = dailyGoal !== null && displayFpValue >= dailyGoal;
  const progressPercent = dailyGoal ? Math.min(100, (displayFpValue / dailyGoal) * 100) : 0;

  // Trigger confetti when goal is met
  useEffect(() => {
    if (open && goalMet) {
      const timer = setTimeout(() => {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9']
        });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open, goalMet]);
  
  const handleDone = () => {
    onOpenChange(false);
  };

  const handleViewCalendar = () => {
    onOpenChange(false);
    navigate('/calendar');
  };

  const handleViewInsights = () => {
    onOpenChange(false);
    navigate('/insights');
  };
  
  const handleSetupGoals = () => {
    onOpenChange(false);
    navigate('/goals');
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="pb-safe max-h-[90dvh]">
        <DrawerHeader className="mb-2">
          <div className="flex items-center gap-2 justify-center mb-2">
            {goalMet ? (
              <Sparkles className="h-8 w-8 text-primary animate-pulse" />
            ) : (
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            )}
          </div>
          <DrawerTitle>
            {goalMet ? "You crushed it!" : "Great work today!"}
          </DrawerTitle>
          <DrawerDescription>
            {goalMet 
              ? "You hit your daily goal!" 
              : "Your entry has been saved successfully."}
          </DrawerDescription>
        </DrawerHeader>
        
        {/* Goals Not Set Up CTA */}
        {(!goals || !goals.setup_complete) && (
          <div className="px-4 mb-4">
            <div 
              className="rounded-xl p-4 bg-primary/10 border border-primary/20 cursor-pointer"
              onClick={handleSetupGoals}
            >
              <div className="flex items-center gap-2 mb-1">
                <Target className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">Set Up Your Goals</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Track your pace and see how you're doing against your targets
              </p>
            </div>
          </div>
        )}
        
        {/* Summer Tier Selector - Only show during summer */}
        {goals?.setup_complete && isUserSummerStarted && allTiers && (
          <div className="px-4 mb-4">
            <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-muted/50">
              {(['mustDo', 'willDo', 'couldDo'] as FocusTier[]).map((tier) => (
                <button
                  key={tier}
                  onClick={() => setFocusTier(tier)}
                  className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                    focusTier === tier
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {tierLabels[tier]}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* Daily Goal Progress */}
        {dailyGoal !== null && displayFpValue > 0 && (
          <div className="px-4 mb-4">
            <div className={`rounded-xl p-4 ${goalMet ? 'bg-primary/10 border border-primary/20' : 'bg-muted/50'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Target className={`h-4 w-4 ${goalMet ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="text-sm font-medium">Daily Goal Progress</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {isUserSummerStarted ? tierLabels[focusTier] : 'Preseason'}
                </span>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className={`text-2xl font-bold ${goalMet ? 'text-primary' : 'text-foreground'}`}>
                  {displayFpValue.toFixed(1)}
                </span>
                <span className="text-muted-foreground">/ {dailyGoal.toFixed(1)} {displayLabel}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${goalMet ? 'bg-primary' : 'bg-muted-foreground/50'}`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              {goalMet && (
                <p className="text-sm text-primary mt-2 font-medium">
                  {displayFpValue > dailyGoal 
                    ? `+${(displayFpValue - dailyGoal).toFixed(1)} ${displayLabel} ahead of pace!` 
                    : "Right on target!"}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Me vs Me Comparison Card */}
        {meVsMeEnabled && comparison && (
          <div className="px-4 mb-4">
            <div className={`rounded-xl p-4 ${comparison.isAhead ? 'bg-green-500/10 border border-green-500/20' : comparison.isBehind ? 'bg-orange-500/10 border border-orange-500/20' : 'bg-muted/50'}`}>
              <div className="flex items-center gap-2 mb-2">
                {comparison.isAhead ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : comparison.isBehind ? (
                  <TrendingDown className="h-4 w-4 text-orange-500" />
                ) : (
                  <Minus className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-sm font-medium">vs {comparison.year} You</span>
              </div>
              <p className={`text-lg font-semibold ${comparison.isAhead ? 'text-green-600' : comparison.isBehind ? 'text-orange-600' : 'text-foreground'}`}>
                {comparison.isAhead ? (
                  <>Beat your {comparison.year} self by {comparison.metric.format(Math.abs(comparison.delta))} {comparison.metric.label}!</>
                ) : comparison.isBehind ? (
                  <>{comparison.metric.format(Math.abs(comparison.delta))} {comparison.metric.label} behind your {comparison.year} pace</>
                ) : (
                  <>Matching your {comparison.year} performance</>
                )}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Day {dayNumber} of {seasonInfo?.type}
              </p>
            </div>
          </div>
        )}

        {/* Summary Stats */}
        <div className="px-4 mb-6">
          <div className="bg-muted/50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Doors Knocked</span>
              <span className="font-medium">{summary.doors}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Presentations</span>
              <span className="font-medium">{summary.presentations}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Closes</span>
              <span className="font-medium">{summary.closes}</span>
            </div>
            {displayFpValue > 0 && (
              <div className="flex justify-between text-sm pt-2 border-t border-border/50">
                <span className="text-muted-foreground">{displayLabel}</span>
                <span className="font-semibold text-primary">{displayFpValue.toFixed(2)}</span>
              </div>
            )}
            {summary.prmr > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">PRMR</span>
                <span className="font-semibold text-green-600">${Math.round(summary.prmr)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Info about data */}
        <div className="px-4 text-sm text-muted-foreground mb-6 text-center">
          Your data is now available in Calendar, Insights, and Reports.
        </div>
        
        {/* Quick Actions */}
        <div className="flex gap-3 px-4 mb-4">
          <Button
            onClick={handleViewCalendar}
            variant="outline"
            className="flex-1 py-4"
            size="sm"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Calendar
          </Button>
          <Button
            onClick={handleViewInsights}
            variant="outline"
            className="flex-1 py-4"
            size="sm"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Insights
          </Button>
        </div>

        <div className="flex flex-col gap-3 px-4 pb-4">
          <Button
            onClick={handleDone}
            variant="default"
            className="w-full py-6 text-lg font-semibold"
            size="lg"
          >
            Done for Today
          </Button>
          <Button
            onClick={() => {
              onKeepWorking();
              onOpenChange(false);
            }}
            variant="ghost"
            className="w-full py-4 text-sm mb-2"
          >
            Actually, I need to keep working
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
