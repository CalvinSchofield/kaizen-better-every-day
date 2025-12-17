import { useMemo } from "react";
import { TrendingUp, TrendingDown, Minus, Calendar, Clock, Target, Flame, Trophy, AlertTriangle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { differenceInDays, format, parseISO, startOfWeek } from "date-fns";

interface DailyEntry {
  entry_date: string;
  fp_plus: number;
  work_start_time: string | null;
  work_end_time: string | null;
  doors_knocked: number;
  is_finalized: boolean;
}

interface SummerGoals {
  must_do_fp_goal?: number;
  will_do_fp_goal?: number;
  could_do_fp_goal?: number;
}

interface SummerProgressTabProps {
  recruitName: string;
  summerStart: string;
  summerEnd: string;
  goals: SummerGoals | null;
  entries: DailyEntry[];
  currentFpPlus: number;
}

const MIN_DOORS_FOR_KNOCKING_DAY = 4;

export const SummerProgressTab = ({
  recruitName,
  summerStart,
  summerEnd,
  goals,
  entries,
  currentFpPlus,
}: SummerProgressTabProps) => {
  const firstName = recruitName.split(' ')[0];
  
  const stats = useMemo(() => {
    const today = new Date();
    const startDate = parseISO(summerStart);
    const endDate = parseISO(summerEnd);
    const totalSummerDays = differenceInDays(endDate, startDate) + 1;
    const daysElapsed = Math.max(0, differenceInDays(today, startDate) + 1);
    const daysRemaining = Math.max(0, differenceInDays(endDate, today));
    
    // Knocking days (4+ doors with start/end times)
    const knockingDays = entries.filter(e => 
      e.is_finalized &&
      e.doors_knocked >= MIN_DOORS_FOR_KNOCKING_DAY && 
      e.work_start_time && 
      e.work_end_time
    );
    const knockingDaysCount = knockingDays.length;
    
    // Calculate pace
    const willDoGoal = goals?.will_do_fp_goal || 0;
    const mustDoGoal = goals?.must_do_fp_goal || 0;
    const couldDoGoal = goals?.could_do_fp_goal || 0;
    
    const expectedProgress = willDoGoal > 0 && totalSummerDays > 0
      ? (willDoGoal / totalSummerDays) * daysElapsed
      : 0;
    
    const pacePercentage = expectedProgress > 0 
      ? (currentFpPlus / expectedProgress) * 100 
      : 100;
    
    const dailyPaceNeeded = daysRemaining > 0 && willDoGoal > currentFpPlus
      ? (willDoGoal - currentFpPlus) / daysRemaining
      : 0;
    
    // Work ethic metrics
    let avgStartMinutes = 0;
    let avgEndMinutes = 0;
    let avgDaysPerWeek = 0;
    
    if (knockingDays.length >= 3) {
      const workTimeDays = knockingDays.filter(e => e.work_start_time && e.work_end_time);
      
      avgStartMinutes = workTimeDays.reduce((sum, e) => {
        const start = new Date(e.work_start_time!);
        return sum + start.getHours() * 60 + start.getMinutes();
      }, 0) / workTimeDays.length;
      
      avgEndMinutes = workTimeDays.reduce((sum, e) => {
        const end = new Date(e.work_end_time!);
        return sum + end.getHours() * 60 + end.getMinutes();
      }, 0) / workTimeDays.length;
      
      // Days per week
      const weekCounts = new Map<string, number>();
      knockingDays.forEach(e => {
        const weekStart = format(startOfWeek(parseISO(e.entry_date), { weekStartsOn: 0 }), 'yyyy-MM-dd');
        weekCounts.set(weekStart, (weekCounts.get(weekStart) || 0) + 1);
      });
      if (weekCounts.size > 0) {
        avgDaysPerWeek = Array.from(weekCounts.values()).reduce((a, b) => a + b, 0) / weekCounts.size;
      }
    }
    
    // Week over week trend
    const twoWeeksAgo = format(new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
    const oneWeekAgo = format(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
    const todayStr = format(today, 'yyyy-MM-dd');
    
    const thisWeekFp = entries
      .filter(e => e.is_finalized && e.entry_date >= oneWeekAgo && e.entry_date <= todayStr)
      .reduce((sum, e) => sum + (Number(e.fp_plus) || 0), 0);
    
    const lastWeekFp = entries
      .filter(e => e.is_finalized && e.entry_date >= twoWeeksAgo && e.entry_date < oneWeekAgo)
      .reduce((sum, e) => sum + (Number(e.fp_plus) || 0), 0);
    
    const weekTrend = lastWeekFp > 0 ? ((thisWeekFp - lastWeekFp) / lastWeekFp) * 100 : 0;
    
    return {
      totalSummerDays,
      daysElapsed,
      daysRemaining,
      knockingDaysCount,
      pacePercentage,
      dailyPaceNeeded,
      avgStartMinutes,
      avgEndMinutes,
      avgDaysPerWeek,
      thisWeekFp,
      lastWeekFp,
      weekTrend,
      willDoGoal,
      mustDoGoal,
      couldDoGoal,
    };
  }, [summerStart, summerEnd, goals, entries, currentFpPlus]);

  const formatMinutesToTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    return `${displayHours}:${String(mins).padStart(2, '0')} ${period}`;
  };

  const getPaceStatus = () => {
    if (stats.pacePercentage >= 110) return { label: 'Ahead', color: 'bg-emerald-500', icon: TrendingUp };
    if (stats.pacePercentage >= 90) return { label: 'On Track', color: 'bg-primary', icon: Minus };
    if (stats.pacePercentage >= 70) return { label: 'Behind', color: 'bg-amber-500', icon: TrendingDown };
    return { label: 'Critical', color: 'bg-destructive', icon: AlertTriangle };
  };

  const paceStatus = getPaceStatus();
  const PaceIcon = paceStatus.icon;

  // Check for bagel (0 FP+ after 2+ knocking days)
  const isBageled = stats.knockingDaysCount >= 2 && currentFpPlus === 0;

  return (
    <div className="space-y-4">
      {/* Bagel Alert */}
      {isBageled && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
            <Flame className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <p className="font-semibold text-destructive">Bagel Alert</p>
            <p className="text-sm text-muted-foreground">
              {firstName} has worked {stats.knockingDaysCount} days with 0 FP+
            </p>
          </div>
        </div>
      )}

      {/* Goal Progress Ring Card */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <span className="font-semibold">Summer Goal Progress</span>
          </div>
          <Badge className={`${paceStatus.color} text-white`}>
            <PaceIcon className="h-3 w-3 mr-1" />
            {paceStatus.label}
          </Badge>
        </div>

        {/* FP+ Progress */}
        <div className="mb-4">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-3xl font-bold">{currentFpPlus.toFixed(1)}</span>
            <span className="text-muted-foreground text-sm">
              / {stats.willDoGoal} FP+ goal
            </span>
          </div>
          <Progress 
            value={Math.min((currentFpPlus / (stats.willDoGoal || 1)) * 100, 100)} 
            className="h-3"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>{Math.round((currentFpPlus / (stats.willDoGoal || 1)) * 100)}% complete</span>
            <span>{stats.daysRemaining} days left</span>
          </div>
        </div>

        {/* Goal Tiers */}
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border">
          <div className={`text-center p-2 rounded-lg ${currentFpPlus >= stats.mustDoGoal ? 'bg-emerald-500/10' : 'bg-muted/50'}`}>
            <p className="text-xs text-muted-foreground">Must Do</p>
            <p className={`font-semibold ${currentFpPlus >= stats.mustDoGoal ? 'text-emerald-600' : ''}`}>
              {stats.mustDoGoal}
            </p>
            {currentFpPlus >= stats.mustDoGoal && <span className="text-xs text-emerald-600">✓</span>}
          </div>
          <div className={`text-center p-2 rounded-lg ${currentFpPlus >= stats.willDoGoal ? 'bg-emerald-500/10' : 'bg-primary/10'}`}>
            <p className="text-xs text-muted-foreground">Will Do</p>
            <p className={`font-semibold ${currentFpPlus >= stats.willDoGoal ? 'text-emerald-600' : 'text-primary'}`}>
              {stats.willDoGoal}
            </p>
            {currentFpPlus >= stats.willDoGoal && <span className="text-xs text-emerald-600">✓</span>}
          </div>
          <div className={`text-center p-2 rounded-lg ${currentFpPlus >= stats.couldDoGoal ? 'bg-emerald-500/10' : 'bg-muted/50'}`}>
            <p className="text-xs text-muted-foreground">Could Do</p>
            <p className={`font-semibold ${currentFpPlus >= stats.couldDoGoal ? 'text-emerald-600' : ''}`}>
              {stats.couldDoGoal}
            </p>
            {currentFpPlus >= stats.couldDoGoal && <span className="text-xs text-emerald-600">✓</span>}
          </div>
        </div>

        {/* Daily pace needed */}
        {stats.dailyPaceNeeded > 0 && (
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Need <span className="font-semibold text-foreground">{stats.dailyPaceNeeded.toFixed(2)} FP+/day</span> to hit Will Do
            </p>
          </div>
        )}
      </div>

      {/* Week Trend Card */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          {stats.weekTrend > 5 ? (
            <TrendingUp className="h-5 w-5 text-emerald-500" />
          ) : stats.weekTrend < -5 ? (
            <TrendingDown className="h-5 w-5 text-destructive" />
          ) : (
            <Minus className="h-5 w-5 text-muted-foreground" />
          )}
          <span className="font-semibold">Week-over-Week</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-1">This Week</p>
            <p className="text-xl font-bold">{stats.thisWeekFp.toFixed(1)}</p>
          </div>
          <div className="text-center px-3">
            {stats.weekTrend > 0 ? (
              <span className="text-emerald-600 font-semibold">+{stats.weekTrend.toFixed(0)}%</span>
            ) : stats.weekTrend < 0 ? (
              <span className="text-destructive font-semibold">{stats.weekTrend.toFixed(0)}%</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
          <div className="flex-1 text-right">
            <p className="text-xs text-muted-foreground mb-1">Last Week</p>
            <p className="text-xl font-bold text-muted-foreground">{stats.lastWeekFp.toFixed(1)}</p>
          </div>
        </div>
      </div>

      {/* Work Metrics */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="h-5 w-5 text-primary" />
          <span className="font-semibold">Work Metrics</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Days Worked</p>
            <p className="text-xl font-bold">{stats.knockingDaysCount}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Avg Start</p>
            <p className="text-lg font-semibold">
              {stats.avgStartMinutes > 0 ? formatMinutesToTime(stats.avgStartMinutes) : '—'}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Avg End</p>
            <p className="text-lg font-semibold">
              {stats.avgEndMinutes > 0 ? formatMinutesToTime(stats.avgEndMinutes) : '—'}
            </p>
          </div>
        </div>
        {stats.avgDaysPerWeek > 0 && (
          <div className="mt-3 pt-3 border-t border-border text-center">
            <p className="text-sm">
              <span className="font-semibold">{stats.avgDaysPerWeek.toFixed(1)}</span>
              <span className="text-muted-foreground"> days/week average</span>
            </p>
          </div>
        )}
      </div>

      {/* Summer Timeline */}
      <div className="bg-muted/50 border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Summer Timeline</span>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{format(parseISO(summerStart), 'MMM d')}</span>
          <span className="font-medium text-foreground">Day {stats.daysElapsed} of {stats.totalSummerDays}</span>
          <span>{format(parseISO(summerEnd), 'MMM d')}</span>
        </div>
        <Progress 
          value={(stats.daysElapsed / stats.totalSummerDays) * 100} 
          className="h-1.5 mt-2"
        />
      </div>
    </div>
  );
};
