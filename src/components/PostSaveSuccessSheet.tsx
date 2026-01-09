import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Calendar, BarChart3, Target, Sparkles, TrendingUp, TrendingDown, Minus, Lightbulb, Swords, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRepGoals } from "@/hooks/useRepGoals";
import { usePlannedDays } from "@/hooks/usePlannedDays";
import { useMeVsMe } from "@/hooks/useMeVsMe";
import { useEfpMode } from "@/hooks/useEfpMode";
import { useFocusTier, FocusTier } from "@/hooks/useFocusTier";
import { usePreseasonFP } from "@/hooks/usePreseasonFP";
import { useRepData } from "@/hooks/useRepData";
import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getSeasonInfo } from "@/utils/seasonWeekUtils";
import { getLearningCurvePrincipleMessage, calculatePaceContext } from "@/utils/learningCurveData";
import { calculateSalesPace } from "@/utils/salesPaceCalculator";
import { format, differenceInDays } from "date-fns";
import confetti from "canvas-confetti";
import { useMyActiveChallenges } from "@/hooks/useChallenges";
import { useChallengeProgress } from "@/hooks/useChallengeProgress";

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
  const queryClient = useQueryClient();
  const { goals } = useRepGoals();
  const { plannedDays } = usePlannedDays();
  const { isEnabled: meVsMeEnabled } = useMeVsMe();
  const { efpModeEnabled, calculateEfp } = useEfpMode();
  const { knockingDays, totalFP, totalPRMR } = usePreseasonFP();
  const { repData } = useRepData();
  
  // Get current season info and comparison year
  const seasonInfo = useMemo(() => getSeasonInfo(new Date()), []);
  const comparisonYear = seasonInfo ? seasonInfo.year - 1 : 2025;
  
  // Calculate day number from season start
  const dayNumber = useMemo(() => {
    if (!seasonInfo) return null;
    return (seasonInfo.week - 1) * 7 + seasonInfo.dayOfWeek;
  }, [seasonInfo]);
  
  // Fetch user's personal summer start for proper season filtering
  const { data: seasonConfig } = useQuery({
    queryKey: ['season-config-post-save', repData?.user_id],
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

  // Fetch all historical entries up to this point in the season for cumulative comparison
  const { data: historicalEntries } = useQuery({
    queryKey: ['historical-cumulative-comparison', comparisonYear, seasonInfo?.type, dayNumber],
    queryFn: async () => {
      if (!dayNumber || !seasonInfo) return null;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      // Fetch all historical entries for this season type up to this day number
      const { data, error } = await supabase
        .from('historical_entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('season_year', comparisonYear)
        .eq('season_type', seasonInfo.type);
      
      if (error || !data) return null;
      
      // Filter to only entries up to or on the current day number in the season
      return data.filter(entry => {
        const entryDayNumber = (entry.season_week - 1) * 7 + entry.day_of_week;
        return entryDayNumber <= dayNumber;
      });
    },
    enabled: open && meVsMeEnabled && !!seasonInfo && !!dayNumber,
    staleTime: 5 * 60 * 1000,
  });
  
  // Calculate cumulative season-to-date comparison
  const comparison = useMemo(() => {
    if (!historicalEntries || historicalEntries.length === 0) return null;
    
    // Current cumulative = totalFP/totalPRMR from usePreseasonFP (already includes today after save)
    // But since this is shown after save, we need to include today's summary too
    const currentCumulativeFp = totalFP + summary.fpPlus;
    const currentCumulativePrmr = totalPRMR + summary.prmr;
    
    // Historical cumulative = sum of all historical entries up to this point
    const historicalCumulativeFp = historicalEntries.reduce((sum, entry) => sum + (entry.fp_plus || 0), 0);
    const historicalCumulativePrmr = historicalEntries.reduce((sum, entry) => sum + (entry.prmr || 0), 0);
    
    // Calculate EFP if needed
    const currentValue = efpModeEnabled ? calculateEfp(currentCumulativePrmr) : currentCumulativeFp;
    const historicalValue = efpModeEnabled ? calculateEfp(historicalCumulativePrmr) : historicalCumulativeFp;
    
    const delta = currentValue - historicalValue;
    const isAhead = delta > 0;
    const isBehind = delta < 0;
    
    return {
      currentValue,
      historicalValue,
      delta,
      isAhead,
      isBehind,
      year: comparisonYear,
      label: efpModeEnabled ? 'EFP' : 'FP+',
    };
  }, [historicalEntries, totalFP, totalPRMR, summary.fpPlus, summary.prmr, efpModeEnabled, calculateEfp, comparisonYear]);
  
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
  
  // Calculate daily goal using centralized pace calculator
  // This properly filters planned days by season (preseason vs summer)
  const dailyGoal = useMemo(() => {
    if (!goals?.setup_complete || !plannedDays) return null;
    
    // Use the centralized calculator which correctly handles:
    // 1. Filtering planned days by season (preseason ends April 11)
    // 2. Cancel rate buffer
    // 3. EFP conversion
    const result = calculateSalesPace({
      goals,
      plannedDays,
      knockingDays,
      currentFpPlus: totalFP,
      currentPrmr: totalPRMR,
      efpModeEnabled,
      calculateEfp,
      activeTier: isUserSummerStarted ? focusTier : 'preseason',
      personalSummerStart: seasonConfig?.personal_summer_start || undefined,
    });
    
    if (!result) return null;
    
    return Math.max(Math.round(result.dailyGoal * 10) / 10, 0.5);
  }, [goals, plannedDays, knockingDays, totalFP, totalPRMR, efpModeEnabled, calculateEfp, isUserSummerStarted, focusTier, seasonConfig?.personal_summer_start]);

  const goalMet = dailyGoal !== null && displayFpValue >= dailyGoal;
  const progressPercent = dailyGoal ? Math.min(100, (displayFpValue / dailyGoal) * 100) : 0;

  // Calculate pace insight message
  const paceInsight = useMemo(() => {
    if (!goals?.setup_complete || knockingDays < 1) return null;
    
    const isRookie = repData?.year === "Rookie";
    const currentSeasonProgress = efpModeEnabled ? calculateEfp(totalPRMR) : totalFP;
    const avgPerDay = knockingDays > 0 ? currentSeasonProgress / knockingDays : 0;
    
    // Calculate new average including today
    const newKnockingDays = knockingDays + 1;
    const newTotal = currentSeasonProgress + displayFpValue;
    const newAvg = newTotal / newKnockingDays;
    
    // Determine pace context
    const weekInSummer = seasonInfo?.week || 1;
    
    if (knockingDays < 18) {
      // Before enough data, show encouraging message
      return {
        type: 'early',
        message: getLearningCurvePrincipleMessage(weekInSummer, isRookie, 'insufficient-data'),
        newAverage: newAvg,
      };
    }
    
    const paceContext = calculatePaceContext(newKnockingDays, dailyGoal || 1, newAvg, weekInSummer, isRookie);
    
    if (paceContext === 'building-momentum' || paceContext === 'on-track') {
      return {
        type: 'ahead',
        message: `Your average is now ${newAvg.toFixed(2)}/day — you're on pace!`,
        newAverage: newAvg,
      };
    } else if (paceContext === 'stretch') {
      return {
        type: 'stretch',
        message: `Your average is ${newAvg.toFixed(2)}/day — push for more days like your best!`,
        newAverage: newAvg,
      };
    }
    
    return null;
  }, [goals, knockingDays, totalFP, totalPRMR, displayFpValue, dailyGoal, efpModeEnabled, calculateEfp, repData, seasonInfo]);

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

  const handleViewCalendar = async () => {
    onOpenChange(false);
    // Refetch to ensure Calendar shows fresh data after save
    await queryClient.refetchQueries({ queryKey: ['all-daily-entries'] });
    await queryClient.refetchQueries({ queryKey: ['preseason-fp-total'] });
    navigate('/calendar');
  };

  const handleViewInsights = async () => {
    onOpenChange(false);
    // Refetch to ensure Insights shows fresh data after save
    await queryClient.refetchQueries({ queryKey: ['all-daily-entries'] });
    await queryClient.refetchQueries({ queryKey: ['preseason-fp-total'] });
    await queryClient.refetchQueries({ queryKey: ['insights-data'] });
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
                  <>{Math.abs(comparison.delta).toFixed(1)} {comparison.label} ahead of your {comparison.year} pace</>
                ) : comparison.isBehind ? (
                  <>{Math.abs(comparison.delta).toFixed(1)} {comparison.label} behind your {comparison.year} pace</>
                ) : (
                  <>Matching your {comparison.year} performance</>
                )}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Through day {dayNumber} of {seasonInfo?.type}
              </p>
            </div>
          </div>
        )}

        {/* Active Challenges Progress */}
        <ChallengesProgressSection />
        
        {/* Pace Insight - Show progress context */}
        {paceInsight && !goalMet && (
          <div className="px-4 mb-4">
            <div className="flex items-start gap-2 p-3 rounded-xl bg-primary/5 border border-primary/10">
              <Lightbulb className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                {paceInsight.message}
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

// Separate component to avoid hook issues
const ChallengesProgressSection = () => {
  const navigate = useNavigate();
  const { data: challenges } = useMyActiveChallenges();
  
  // Filter to only active challenges (not pending)
  const activeChallenges = useMemo(() => 
    challenges?.filter(c => c.status === 'active') || [], 
    [challenges]
  );
  
  if (activeChallenges.length === 0) return null;
  
  return (
    <div className="px-4 mb-4">
      <div className="space-y-2">
        {activeChallenges.slice(0, 2).map(challenge => (
          <ChallengeProgressItem 
            key={challenge.id} 
            challenge={challenge}
            onClick={() => navigate('/leaderboard')}
          />
        ))}
        {activeChallenges.length > 2 && (
          <button 
            onClick={() => navigate('/leaderboard')}
            className="w-full text-xs text-primary font-medium py-1"
          >
            +{activeChallenges.length - 2} more challenges
          </button>
        )}
      </div>
    </div>
  );
};

const ChallengeProgressItem = ({ 
  challenge, 
  onClick 
}: { 
  challenge: any; 
  onClick: () => void;
}) => {
  const { data: progressData } = useChallengeProgress(challenge);
  
  if (!progressData) return null;
  
  const { userProgress, leader, isUserAhead, gap, timeRemaining } = progressData;
  const metricLabel = challenge.metric === 'fp_plus' ? 'FP+' : 
                     challenge.metric === 'prmr' ? 'PRMR' : 
                     challenge.metric === 'doors_knocked' ? 'Doors' : 'Trans.';
  
  // Get opponent for 1v1
  const opponent = challenge.participants?.find((p: any) => p.user_id !== userProgress?.user_id);
  const opponentProgress = progressData.participants?.find((p: any) => p.user_id !== userProgress?.user_id);
  
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-xl p-3 text-left transition-all ${
        isUserAhead 
          ? 'bg-green-500/10 border border-green-500/20' 
          : 'bg-orange-500/10 border border-orange-500/20'
      }`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Swords className={`h-3.5 w-3.5 ${isUserAhead ? 'text-green-500' : 'text-orange-500'}`} />
        <span className="text-xs font-medium truncate flex-1">
          vs {opponent?.rep_name || 'Opponent'}
        </span>
        {isUserAhead && <Trophy className="h-3.5 w-3.5 text-yellow-500" />}
      </div>
      
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-1.5">
          <span className={`text-lg font-bold ${isUserAhead ? 'text-green-600' : 'text-foreground'}`}>
            {userProgress?.current_value?.toFixed(1) || '0'}
          </span>
          <span className="text-muted-foreground text-xs">
            vs {opponentProgress?.current_value?.toFixed(1) || '0'}
          </span>
          <span className="text-muted-foreground text-xs">{metricLabel}</span>
        </div>
        <span className={`text-xs font-medium ${isUserAhead ? 'text-green-600' : 'text-orange-600'}`}>
          {isUserAhead ? `+${gap.toFixed(1)} ahead` : `-${gap.toFixed(1)} behind`}
        </span>
      </div>
      
      <p className="text-xs text-muted-foreground mt-1">
        {timeRemaining}
      </p>
    </button>
  );
};
