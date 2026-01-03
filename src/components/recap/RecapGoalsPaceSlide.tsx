import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Target, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Sprout, Mountain, Zap, Trophy, Flame } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine, Tooltip, Area, ComposedChart } from 'recharts';
import { useRepData } from '@/hooks/useRepData';
import { useRepGoals } from '@/hooks/useRepGoals';
import { useEfpMode } from '@/hooks/useEfpMode';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, differenceInWeeks, eachDayOfInterval, differenceInDays } from 'date-fns';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  LEARNING_CURVE_18_WEEKS, 
  LEARNING_CURVE_24_WEEKS, 
  getClosestLearningCurve,
  scaleLearningCurve,
  getLearningCurvePrincipleMessage,
  calculatePaceContext
} from '@/utils/learningCurveData';

type PaceStatus = 'ahead' | 'on-track' | 'behind' | 'no-goal';
type FocusTier = 'mustDo' | 'willDo' | 'couldDo';

interface GoalsPaceData {
  preseasonGoal: number;
  mustDoGoal: number;
  willDoGoal: number;
  couldDoGoal: number;
  focusTier: FocusTier | null;
  cumulativeProgress: number;
  periodProgress: number;
  // Expected progress by end of period (what you should have done in this period to stay on pace)
  expectedByEndOfPeriod: number;
  dailyCumulativeData: Array<{
    date: string;
    dayLabel: string;
    cumulative: number;
    preseasonPace?: number;
    mustDoPace?: number;
    willDoPace?: number;
    couldDoPace?: number;
    isPeriodPreseason: boolean;
  }>;
  isPeriodPreseason: boolean;
  paceStatus: {
    preseason: PaceStatus;
    mustDo: PaceStatus;
    willDo: PaceStatus;
    couldDo: PaceStatus;
  };
  isUserSummerStarted: boolean;
  personalSummerStart: string | null;
  weeksIntoSeason: number;
  isFirstHalfOfSummer: boolean;
  isRookie: boolean;
  totalKnockingDays: number;
}

interface RecapGoalsPaceSlideProps {
  stats: {
    period: 'week' | 'month';
    dateRange: { start: Date; end: Date };
    totalFpPlus: number;
    daysWorked: number;
  };
}

export function RecapGoalsPaceSlide({ stats }: RecapGoalsPaceSlideProps) {
  const { repData } = useRepData();
  const { goals } = useRepGoals();
  const { efpModeEnabled } = useEfpMode();
  const [showLearningCurve, setShowLearningCurve] = useState(false);
  
  const isRookie = repData?.year === 'Rookie' || repData?.year === '1st Year';
  
  // Fetch user's personal summer dates and season config
  const { data: seasonConfig } = useQuery({
    queryKey: ['season-config-recap', repData?.user_id],
    queryFn: async () => {
      if (!repData?.user_id) return null;
      const { data } = await supabase
        .from('season_config')
        .select('personal_summer_start, personal_summer_end')
        .eq('user_id', repData.user_id)
        .maybeSingle();
      return data;
    },
    enabled: !!repData?.user_id,
    staleTime: 5 * 60 * 1000,
  });
  
  // Fetch cumulative progress up to and during this period, plus planned days for pace calculation
  const { data: progressData, isLoading: progressLoading } = useQuery({
    queryKey: ['cumulative-progress-recap', repData?.user_id, stats.dateRange.start.toISOString(), stats.dateRange.end.toISOString()],
    queryFn: async () => {
      if (!repData?.user_id) return null;
      
      const startStr = format(stats.dateRange.start, 'yyyy-MM-dd');
      const endStr = format(stats.dateRange.end, 'yyyy-MM-dd');
      
      // Get entries before this period for starting cumulative
      const { data: beforeEntries } = await supabase
        .from('daily_entries')
        .select('fp_plus, entry_date, doors_knocked, work_start_time, work_end_time')
        .eq('user_id', repData.user_id)
        .eq('is_finalized', true)
        .lt('entry_date', startStr);
      
      // Get entries during this period
      const { data: periodEntries } = await supabase
        .from('daily_entries')
        .select('fp_plus, entry_date, doors_knocked, work_start_time, work_end_time')
        .eq('user_id', repData.user_id)
        .eq('is_finalized', true)
        .gte('entry_date', startStr)
        .lte('entry_date', endStr)
        .order('entry_date', { ascending: true });
      
      // Get planned work days for proper pace calculation
      const { data: plannedDays } = await supabase
        .from('planned_work_days')
        .select('planned_date')
        .eq('user_id', repData.user_id);
      
      // Helper to check if entry is a knocking day
      const isKnockingDay = (e: { doors_knocked?: number | null; work_start_time?: string | null; work_end_time?: string | null }) => 
        (e.doors_knocked || 0) >= 5 && e.work_start_time && e.work_end_time;
      
      const cumulativeBefore = beforeEntries?.reduce((sum, e) => sum + (e.fp_plus || 0), 0) || 0;
      const knockingDaysBefore = beforeEntries?.filter(isKnockingDay).length || 0;
      
      return {
        cumulativeBefore,
        knockingDaysBefore,
        periodEntries: periodEntries || [],
        plannedDays: plannedDays || [],
        isKnockingDay,
      };
    },
    enabled: !!repData?.user_id,
    staleTime: 5 * 60 * 1000,
  });
  
  // Calculate goals pace data - using knocking days like Insights does
  const goalsData = useMemo((): GoalsPaceData | null => {
    if (!goals || !seasonConfig || !progressData) return null;
    
    const conversionFactor = efpModeEnabled ? (goals.avg_prmr_per_fp || 85) / 85 : 1;
    
    // Apply cancel buffer - need to fund more to hit goal after cancellations
    const cancelRate = goals.cancel_rate || 0;
    const cancelMultiplier = cancelRate > 0 && cancelRate < 1 ? 1 / (1 - cancelRate) : 1;
    
    const preseasonGoal = (goals.preseason_fp_goal || 0) * conversionFactor * cancelMultiplier;
    const mustDoGoal = (goals.must_do_fp_goal || 0) * conversionFactor * cancelMultiplier;
    const willDoGoal = (goals.will_do_fp_goal || 0) * conversionFactor * cancelMultiplier;
    const couldDoGoal = (goals.could_do_fp_goal || 0) * conversionFactor * cancelMultiplier;
    
    const personalSummerStart = seasonConfig.personal_summer_start;
    const personalSummerEnd = seasonConfig.personal_summer_end;
    
    const today = new Date();
    const periodStart = stats.dateRange.start;
    const periodEnd = stats.dateRange.end;
    const todayStr = format(today, 'yyyy-MM-dd');
    const periodEndStr = format(periodEnd, 'yyyy-MM-dd');
    
    // Determine if summer has started
    const summerStartDate = personalSummerStart ? parseISO(personalSummerStart) : null;
    const isUserSummerStarted = summerStartDate ? today >= summerStartDate : false;
    
    // Calculate weeks into season
    let weeksIntoSeason = 0;
    if (summerStartDate && isUserSummerStarted) {
      weeksIntoSeason = Math.max(1, differenceInWeeks(today, summerStartDate) + 1);
    }
    
    // Calculate if first half of summer
    const summerEndDate = personalSummerEnd ? parseISO(personalSummerEnd) : null;
    let totalSummerWeeks = 20;
    if (summerStartDate && summerEndDate) {
      totalSummerWeeks = differenceInWeeks(summerEndDate, summerStartDate);
    }
    const isFirstHalfOfSummer = weeksIntoSeason <= Math.ceil(totalSummerWeeks / 2);
    
    // Check if this period is entirely in preseason
    const periodIsPreseason = summerStartDate ? periodEnd < summerStartDate : true;
    
    // Get knocking day counts from data
    const periodEntries = progressData.periodEntries || [];
    const plannedDays = progressData.plannedDays || [];
    const cumulativeBefore = progressData.cumulativeBefore || 0;
    const knockingDaysBefore = progressData.knockingDaysBefore || 0;
    
    // Helper: check if entry is a knocking day
    const isKnockingDay = (e: { doors_knocked?: number | null; work_start_time?: string | null; work_end_time?: string | null }) => 
      (e.doors_knocked || 0) >= 5 && e.work_start_time && e.work_end_time;
    
    // Count knocking days in this period
    const knockingDaysInPeriod = periodEntries.filter(isKnockingDay).length;
    
    // Count future planned days (not yet worked) in preseason
    const workedDatesSet = new Set(periodEntries.map(e => e.entry_date));
    let futurePreseasonPlannedCount = 0;
    
    plannedDays.forEach(p => {
      if (workedDatesSet.has(p.planned_date) || p.planned_date <= periodEndStr) return;
      const pDate = parseISO(p.planned_date);
      if (summerStartDate && pDate < summerStartDate) {
        futurePreseasonPlannedCount++;
      }
    });
    
    // Total expected knocking days = worked + future planned (for preseason)
    const totalPreseasonKnockingDays = knockingDaysBefore + knockingDaysInPeriod + futurePreseasonPlannedCount;
    
    // Calculate expected by end of this period based on KNOCKING days, not calendar days
    // expectedByEndOfPeriod = (knocking days worked up to period end / total planned knocking days) × goal
    const knockingDaysByPeriodEnd = knockingDaysBefore + knockingDaysInPeriod;
    const expectedByEndOfPeriod = periodIsPreseason && preseasonGoal > 0 && totalPreseasonKnockingDays > 0
      ? (knockingDaysByPeriodEnd / totalPreseasonKnockingDays) * preseasonGoal
      : 0;
    
    // Daily pace for preseason (goal / total planned days)
    const preseasonDailyPace = totalPreseasonKnockingDays > 0 ? preseasonGoal / totalPreseasonKnockingDays : 0;
    
    // Build daily cumulative data for chart
    const days = eachDayOfInterval({ start: periodStart, end: periodEnd });
    let runningCumulative = cumulativeBefore;
    let runningKnockingDayCount = knockingDaysBefore;
    
    const dailyCumulativeData = days.map((day) => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const entry = periodEntries.find(e => e.entry_date === dateStr);
      
      if (entry) {
        runningCumulative += entry.fp_plus || 0;
        if (isKnockingDay(entry)) {
          runningKnockingDayCount++;
        }
      }
      
      // Pace line = knocking days so far × daily pace
      const preseasonPace = periodIsPreseason && preseasonDailyPace > 0 && runningKnockingDayCount > 0
        ? runningKnockingDayCount * preseasonDailyPace
        : undefined;
      
      // Summer pace lines (similar approach)
      const summerDailyMustDo = totalSummerWeeks * 5 > 0 ? mustDoGoal / (totalSummerWeeks * 5) : 0;
      const summerDailyWillDo = totalSummerWeeks * 5 > 0 ? willDoGoal / (totalSummerWeeks * 5) : 0;
      const summerDailyCouldDo = totalSummerWeeks * 5 > 0 ? couldDoGoal / (totalSummerWeeks * 5) : 0;
      
      const mustDoPace = !periodIsPreseason && mustDoGoal > 0 ? runningKnockingDayCount * summerDailyMustDo : undefined;
      const willDoPace = !periodIsPreseason && willDoGoal > 0 ? runningKnockingDayCount * summerDailyWillDo : undefined;
      const couldDoPace = !periodIsPreseason && couldDoGoal > 0 ? runningKnockingDayCount * summerDailyCouldDo : undefined;
      
      return {
        date: dateStr,
        dayLabel: format(day, 'M/d'),
        cumulative: runningCumulative,
        preseasonPace,
        mustDoPace,
        willDoPace,
        couldDoPace,
        isPeriodPreseason: periodIsPreseason,
      };
    });
    
    const cumulativeProgress = runningCumulative;
    const periodProgress = stats.totalFpPlus;
    
    // Calculate pace status
    const calculatePaceStatus = (expected: number, actual: number): PaceStatus => {
      if (expected <= 0) return 'no-goal';
      const pacePercent = (actual / expected) * 100;
      if (pacePercent >= 100) return 'ahead';
      if (pacePercent >= 85) return 'on-track';
      return 'behind';
    };
    
    const focusTier = (goals.focus_tier as FocusTier) || 'willDo';
    
    return {
      preseasonGoal,
      mustDoGoal,
      willDoGoal,
      couldDoGoal,
      focusTier,
      cumulativeProgress,
      periodProgress,
      expectedByEndOfPeriod,
      dailyCumulativeData,
      paceStatus: {
        preseason: calculatePaceStatus(expectedByEndOfPeriod, cumulativeProgress),
        mustDo: calculatePaceStatus(mustDoGoal, cumulativeProgress),
        willDo: calculatePaceStatus(willDoGoal, cumulativeProgress),
        couldDo: calculatePaceStatus(couldDoGoal, cumulativeProgress),
      },
      isUserSummerStarted,
      personalSummerStart,
      weeksIntoSeason,
      isFirstHalfOfSummer,
      isRookie: isRookie || false,
      totalKnockingDays: totalSummerWeeks * 5,
      isPeriodPreseason: periodIsPreseason,
    };
  }, [goals, seasonConfig, stats, progressData, efpModeEnabled, isRookie]);
  
  // Get encouraging message based on context - using enhanced learning curve principles
  const encouragingMessage = useMemo(() => {
    if (!goalsData) return null;
    
    const { paceStatus, focusTier, isRookie, weeksIntoSeason, isUserSummerStarted, totalKnockingDays } = goalsData;
    const currentStatus = focusTier ? paceStatus[focusTier] : paceStatus.willDo;
    
    // Calculate pace context for principle-based messaging
    const paceContext = calculatePaceContext(
      totalKnockingDays,
      0, // We don't have remainingDailyNeeded here
      0, // We don't have currentAverage here  
      weeksIntoSeason,
      isRookie
    );

    // Preseason messaging
    if (!isUserSummerStarted) {
      if (currentStatus === 'ahead') {
        return { title: "Great Prep!", message: "You're building strong preseason momentum!", icon: Flame, color: 'text-orange-500' };
      }
      return { title: "Building Foundation", message: "Every hour of prep now pays off in summer sales.", icon: Sprout, color: 'text-green-500' };
    }
    
    // Use enhanced learning curve principle messages for summer
    if (totalKnockingDays < 18) {
      // Not enough data - use principle-based encouragement
      const message = getLearningCurvePrincipleMessage(weeksIntoSeason, isRookie, 'insufficient-data');
      return { title: "Building Momentum", message, icon: Sprout, color: 'text-green-500' };
    }
    
    // Early season (weeks 1-6)
    if (weeksIntoSeason <= 6) {
      if (currentStatus === 'ahead') {
        return { title: "Blazing Start!", message: "You're ahead of pace - incredible momentum!", icon: Flame, color: 'text-orange-500' };
      }
      const message = getLearningCurvePrincipleMessage(weeksIntoSeason, isRookie, 'early-season');
      return { title: "Finding Your Rhythm", message, icon: Sprout, color: 'text-green-500' };
    }
    
    // Mid season (weeks 7-12)
    if (weeksIntoSeason <= 12) {
      if (currentStatus === 'ahead' || currentStatus === 'on-track') {
        return { title: "On Track!", message: "Your consistency is paying off. Keep the momentum going!", icon: Target, color: 'text-primary' };
      }
      const message = getLearningCurvePrincipleMessage(weeksIntoSeason, isRookie, 'stretch');
      return { title: "The Climb Begins", message, icon: Mountain, color: 'text-blue-500' };
    }
    
    // Late season (weeks 13+)
    if (currentStatus === 'ahead') {
      return { title: "Crushing It!", message: "You're on pace to exceed your goal!", icon: Trophy, color: 'text-yellow-500' };
    }
    if (currentStatus === 'on-track') {
      return { title: "Strong Finish Ahead", message: "Stay consistent and you'll hit your goal!", icon: Target, color: 'text-primary' };
    }
    const message = getLearningCurvePrincipleMessage(weeksIntoSeason, isRookie, 'very-ambitious');
    return { title: "Push Time", message, icon: Zap, color: 'text-purple-500' };
  }, [goalsData]);
  
  // Get learning curve data scaled to user's goal
  const learningCurveData = useMemo(() => {
    if (!goalsData || !goalsData.isRookie || !goalsData.isFirstHalfOfSummer) return null;
    
    const plannedWeeks = Math.round(goalsData.totalKnockingDays / 5);
    const curve = getClosestLearningCurve(plannedWeeks);
    const focusGoal = goalsData.focusTier === 'mustDo' 
      ? goalsData.mustDoGoal 
      : goalsData.focusTier === 'couldDo' 
        ? goalsData.couldDoGoal 
        : goalsData.willDoGoal;
    
    return {
      curve: scaleLearningCurve(curve, focusGoal || 100),
      plannedWeeks,
      isUsing18Week: plannedWeeks < 21,
    };
  }, [goalsData]);
  
  // Show loading state while data is being fetched to prevent flash
  if (progressLoading || !progressData || !goalsData) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 py-8">
        <div className="animate-pulse text-center">
          <Target className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
          <div className="h-5 w-32 bg-muted rounded mx-auto mb-2" />
          <div className="h-4 w-48 bg-muted rounded mx-auto" />
        </div>
      </div>
    );
  }
  
  // Only show "Set Up Goals" if data is loaded but goals are truly missing
  if (!goals?.preseason_fp_goal && !goals?.must_do_fp_goal) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 py-8">
        <div className="text-center">
          <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Set Up Your Goals</h2>
          <p className="text-muted-foreground text-sm">
            Visit the Goals page to set up your summer goals and track your pace.
          </p>
        </div>
      </div>
    );
  }
  
  // During preseason, show expected by end of period vs actual; during summer show focus tier goal
  const isPeriodPreseason = goalsData.isPeriodPreseason;
  
  // For preseason: compare actual vs expected by end of this period (not full goal)
  // For summer: compare against full goal (existing behavior)
  const displayGoal = isPeriodPreseason 
    ? goalsData.expectedByEndOfPeriod
    : goalsData.focusTier === 'mustDo' 
      ? goalsData.mustDoGoal 
      : goalsData.focusTier === 'couldDo' 
        ? goalsData.couldDoGoal 
        : goalsData.willDoGoal;
  
  const focusPaceStatus = isPeriodPreseason 
    ? goalsData.paceStatus.preseason
    : (goalsData.focusTier ? goalsData.paceStatus[goalsData.focusTier] : 'no-goal');
  const progressPercent = displayGoal > 0 ? Math.min(100, (goalsData.cumulativeProgress / displayGoal) * 100) : 0;
  
  const tierLabel = isPeriodPreseason 
    ? 'Expected by End of Period' 
    : goalsData.focusTier === 'mustDo' ? 'Must Do' : goalsData.focusTier === 'couldDo' ? 'Could Do' : 'Will Do';
  const unit = efpModeEnabled ? 'EFP' : 'FP+';
  
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col px-6 py-8 pb-32"
    >
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-1">Your Goals Pace</h2>
        <p className="text-sm text-muted-foreground">
          {stats.period === 'week' ? 'Weekly' : 'Monthly'} progress toward your goals
        </p>
      </div>
      
      {/* Progress Chart */}
      <div className="bg-card rounded-2xl p-4 mb-4 border border-border">
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={goalsData.dailyCumulativeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis 
                dataKey="dayLabel" 
                tick={{ fontSize: 10 }} 
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis 
                tick={{ fontSize: 10 }} 
                tickLine={false}
                axisLine={false}
                domain={['auto', 'auto']}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value: number, name: string) => [
                  `${Math.round(value)} ${unit}`,
                  name === 'cumulative' ? 'Actual' : name.replace('Pace', ' Pace')
                ]}
              />
              
              {/* Pace lines - show different ones based on preseason vs summer */}
              {isPeriodPreseason && goalsData.preseasonGoal > 0 && (
                <Line 
                  type="monotone" 
                  dataKey="preseasonPace" 
                  stroke="hsl(var(--primary))" 
                  strokeDasharray="4 4"
                  strokeWidth={2}
                  dot={false}
                  name="Preseason Goal Pace"
                />
              )}
              
              {!isPeriodPreseason && (
                <>
                  {goalsData.mustDoGoal > 0 && (
                    <Line 
                      type="monotone" 
                      dataKey="mustDoPace" 
                      stroke={goalsData.focusTier === 'mustDo' ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'} 
                      strokeDasharray="4 4"
                      strokeWidth={goalsData.focusTier === 'mustDo' ? 2 : 1}
                      strokeOpacity={goalsData.focusTier === 'mustDo' ? 1 : 0.5}
                      dot={false}
                      name="Must Do"
                    />
                  )}
                  
                  {goalsData.willDoGoal > 0 && (
                    <Line 
                      type="monotone" 
                      dataKey="willDoPace" 
                      stroke={goalsData.focusTier === 'willDo' ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'} 
                      strokeDasharray="4 4"
                      strokeWidth={goalsData.focusTier === 'willDo' ? 2 : 1}
                      strokeOpacity={goalsData.focusTier === 'willDo' ? 1 : 0.5}
                      dot={false}
                      name="Will Do"
                    />
                  )}
                  
                  {goalsData.couldDoGoal > 0 && (
                    <Line 
                      type="monotone" 
                      dataKey="couldDoPace" 
                      stroke={goalsData.focusTier === 'couldDo' ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'} 
                      strokeDasharray="4 4"
                      strokeWidth={goalsData.focusTier === 'couldDo' ? 2 : 1}
                      strokeOpacity={goalsData.focusTier === 'couldDo' ? 1 : 0.5}
                      dot={false}
                      name="Could Do"
                    />
                  )}
                </>
              )}
              
              {/* Actual progress line - always on top */}
              <Area
                type="monotone"
                dataKey="cumulative"
                fill="hsl(var(--primary) / 0.1)"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                dot={false}
                name="cumulative"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        
        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 bg-primary rounded" />
            <span>Actual</span>
          </div>
          {isPeriodPreseason ? (
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 border-t-2 border-dashed border-primary" />
              <span>Preseason Pace</span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <div className={`w-4 h-0.5 border-t-2 border-dashed ${goalsData.focusTier === 'mustDo' ? 'border-primary' : 'border-muted-foreground/50'}`} />
                <span className={goalsData.focusTier === 'mustDo' ? 'text-foreground font-medium' : ''}>Must Do</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className={`w-4 h-0.5 border-t-2 border-dashed ${goalsData.focusTier === 'willDo' ? 'border-primary' : 'border-muted-foreground/50'}`} />
                <span className={goalsData.focusTier === 'willDo' ? 'text-foreground font-medium' : ''}>Will Do</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className={`w-4 h-0.5 border-t-2 border-dashed ${goalsData.focusTier === 'couldDo' ? 'border-primary' : 'border-muted-foreground/50'}`} />
                <span className={goalsData.focusTier === 'couldDo' ? 'text-foreground font-medium' : ''}>Could Do</span>
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* Progress Summary */}
      <div className="bg-card rounded-2xl p-4 mb-4 border border-border">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm text-muted-foreground">{tierLabel}</p>
            <p className="text-2xl font-bold">{Math.round(goalsData.cumulativeProgress)} <span className="text-lg text-muted-foreground">/ {Math.round(displayGoal)} {unit}</span></p>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
            focusPaceStatus === 'ahead' ? 'bg-green-500/10 text-green-600' :
            focusPaceStatus === 'on-track' ? 'bg-primary/10 text-primary' :
            'bg-yellow-500/10 text-yellow-600'
          }`}>
            {focusPaceStatus === 'ahead' && <TrendingUp className="w-4 h-4" />}
            {focusPaceStatus === 'on-track' && <Target className="w-4 h-4" />}
            {focusPaceStatus === 'behind' && <AlertCircle className="w-4 h-4" />}
            <span>{focusPaceStatus === 'ahead' ? 'Ahead' : focusPaceStatus === 'on-track' ? 'On Track' : 'Building'}</span>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className={`h-full rounded-full ${
              focusPaceStatus === 'ahead' ? 'bg-green-500' :
              focusPaceStatus === 'on-track' ? 'bg-primary' :
              'bg-yellow-500'
            }`}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          {Math.round(progressPercent)}% complete
        </p>
      </div>
      
      {/* Goal Tiers Status (only show when period is in summer) */}
      {!isPeriodPreseason && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { tier: 'mustDo' as FocusTier, label: 'Must Do', goal: goalsData.mustDoGoal },
            { tier: 'willDo' as FocusTier, label: 'Will Do', goal: goalsData.willDoGoal },
            { tier: 'couldDo' as FocusTier, label: 'Could Do', goal: goalsData.couldDoGoal },
          ].map(({ tier, label, goal }) => {
            const status = goalsData.paceStatus[tier];
            const isFocused = tier === goalsData.focusTier;
            
            if (goal <= 0) return null;
            
            return (
              <div 
                key={tier}
                className={`p-3 rounded-xl border text-center ${
                  isFocused ? 'border-primary bg-primary/5' : 'border-border bg-card'
                }`}
              >
                <p className={`text-xs font-medium mb-1 ${isFocused ? 'text-primary' : 'text-muted-foreground'}`}>
                  {label}
                </p>
                <p className="text-sm font-semibold">{Math.round(goal)}</p>
                <div className="mt-1">
                  {status === 'ahead' && <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />}
                  {status === 'on-track' && <Target className="w-4 h-4 text-primary mx-auto" />}
                  {status === 'behind' && <AlertCircle className="w-4 h-4 text-yellow-500 mx-auto" />}
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {/* Encouraging Message */}
      {encouragingMessage && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-2xl p-4 mb-4 border border-primary/20"
        >
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-full bg-background ${encouragingMessage.color}`}>
              <encouragingMessage.icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base">{encouragingMessage.title}</h3>
              <p className="text-sm text-muted-foreground mt-0.5">{encouragingMessage.message}</p>
            </div>
          </div>
        </motion.div>
      )}
      
      {/* Learning Curve Explainer (for rookies in first half of summer) */}
      {learningCurveData && goalsData.isRookie && goalsData.isFirstHalfOfSummer && goalsData.isUserSummerStarted && (
        <Collapsible open={showLearningCurve} onOpenChange={setShowLearningCurve}>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between p-3 bg-card rounded-xl border border-border">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">The Rookie Learning Curve</span>
              </div>
              {showLearningCurve ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 p-4 bg-card rounded-xl border border-border">
              <p className="text-sm text-muted-foreground mb-3">
                Here's what a typical path to {Math.round(goalsData.preseasonGoal)} {unit} looks like over {learningCurveData.plannedWeeks} weeks. 
                Notice how sales accelerate as you gain experience:
              </p>
              
              {/* Learning Curve Chart */}
              <div className="h-40 mb-3">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={learningCurveData.curve} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis 
                      dataKey="week" 
                      tick={{ fontSize: 10 }} 
                      tickLine={false}
                      axisLine={false}
                      label={{ value: 'Week', position: 'bottom', fontSize: 10, offset: -5 }}
                    />
                    <YAxis 
                      tick={{ fontSize: 10 }} 
                      tickLine={false}
                      axisLine={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="cumulative"
                      fill="hsl(var(--primary) / 0.1)"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              
              {/* Key insight */}
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">Key insight:</strong> At the midpoint (week {Math.round(learningCurveData.plannedWeeks / 2)}), 
                  you'd only be at ~{Math.round(goalsData.preseasonGoal * 0.35)}/{Math.round(goalsData.preseasonGoal)}. That's normal! 
                  What matters is consistent effort, not whether you start hot.
                </p>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </motion.div>
  );
}
