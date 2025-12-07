import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingUp, TrendingDown, Minus, CheckCircle2, Clock } from "lucide-react";
import { useAllRepGoals, RepGoals } from "@/hooks/useRepGoals";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { parseISO, isBefore, isAfter, eachDayOfInterval, format, differenceInDays } from "date-fns";

interface LeaderGoalsCardProps {
  userIds: string[];
  excludeUserIds?: string[];
  accessibleReps?: any[];
  dateRange?: { start: string; end: string };
  datePreset?: 'today' | 'yesterday' | 'week' | 'month' | 'preseason' | 'ytd' | 'custom';
  urgencyBadgeCount?: number;
}

type GoalTier = 'must_do' | 'will_do' | 'could_do';

interface RepWithGoals {
  userId: string;
  displayName: string;
  year: string;
  goals: RepGoals | null;
  currentFp: number;
  // Preseason
  preseasonGoal: number;
  preseasonProgress: number;
  // Summer goal tiers
  mustDoGoal: number;
  willDoGoal: number;
  couldDoGoal: number;
  mustDoProgress: number;
  willDoProgress: number;
  couldDoProgress: number;
  // Pace
  paceStatus: 'ahead' | 'on-track' | 'behind' | 'no-goal';
  paceDiff: number;
}

// Strip emojis from name
const stripEmojis = (str: string): string => {
  return str.replace(/[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier}\p{Emoji_Component}]/gu, '').trim();
};

// Get clean first name without emojis
const getCleanFirstName = (fullName: string): string => {
  const cleaned = stripEmojis(fullName);
  return cleaned.split(' ')[0] || cleaned;
};

// Get display name with optional last initial for duplicates
const getDisplayName = (fullName: string, allNames: string[]): string => {
  const cleanedFirst = getCleanFirstName(fullName);
  const cleanedFull = stripEmojis(fullName);
  
  const duplicateCount = allNames.filter(name => getCleanFirstName(name) === cleanedFirst).length;
  
  if (duplicateCount > 1) {
    const parts = cleanedFull.split(' ');
    if (parts.length > 1) {
      return `${parts[0]} ${parts[parts.length - 1]}`;
    }
  }
  
  return cleanedFirst;
};

export const LeaderGoalsCard = ({ 
  userIds, 
  excludeUserIds = [], 
  accessibleReps = [],
  dateRange,
  datePreset = 'today',
  urgencyBadgeCount
}: LeaderGoalsCardProps) => {
  const { data: allGoals, isLoading: goalsLoading } = useAllRepGoals();
  
  const summerStartDate = '2026-04-12';
  const summerEndDate = '2026-09-27';
  const preseasonStartDate = '2025-09-28';
  const now = new Date();
  const isPreseason = now < parseISO(summerStartDate);
  
  // Summer goal tier filter (only used after summer starts)
  const [selectedTier, setSelectedTier] = useState<GoalTier>('will_do');
  
  // Fetch FP and worked days for the selected date range
  const { data: repsFpData, isLoading: fpLoading } = useQuery({
    queryKey: ['team-goals-fp', userIds, dateRange?.start, dateRange?.end],
    queryFn: async () => {
      if (userIds.length === 0) return { fpByUser: {}, workedDaysByUser: {} };
      
      const startDate = dateRange?.start || preseasonStartDate;
      const endDate = dateRange?.end || now.toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('daily_entries')
        .select('user_id, fp_plus, upgrade_prmr, entry_date, doors_knocked, work_start_time, work_end_time')
        .in('user_id', userIds)
        .gte('entry_date', startDate)
        .lte('entry_date', endDate);
      
      if (error) throw error;
      
      const fpByUser: Record<string, number> = {};
      const workedDaysByUser: Record<string, Set<string>> = {};
      
      for (const entry of data || []) {
        // FP+ calculation
        const fpPlus = (entry.fp_plus || 0) + ((entry.upgrade_prmr || 0) / 85);
        fpByUser[entry.user_id] = (fpByUser[entry.user_id] || 0) + fpPlus;
        
        // Count as worked day if doors >= 10 OR has start and end time (real knocking day)
        const isRealWorkDay = (entry.doors_knocked || 0) >= 10 || 
                              (entry.work_start_time && entry.work_end_time);
        if (isRealWorkDay) {
          if (!workedDaysByUser[entry.user_id]) {
            workedDaysByUser[entry.user_id] = new Set();
          }
          workedDaysByUser[entry.user_id].add(entry.entry_date);
        }
      }
      
      // Convert Sets to counts
      const workedDaysCount: Record<string, number> = {};
      for (const userId of Object.keys(workedDaysByUser)) {
        workedDaysCount[userId] = workedDaysByUser[userId].size;
      }
      
      return { fpByUser, workedDaysByUser: workedDaysCount };
    },
    enabled: userIds.length > 0,
    staleTime: 2 * 60 * 1000,
  });

  // Fetch planned work days for all reps
  const { data: allPlannedDays, isLoading: plannedLoading } = useQuery({
    queryKey: ['team-planned-days', userIds],
    queryFn: async () => {
      if (userIds.length === 0) return {};
      
      const { data, error } = await supabase
        .from('planned_work_days')
        .select('user_id, planned_date')
        .in('user_id', userIds);
      
      if (error) throw error;
      
      const plannedByUser: Record<string, string[]> = {};
      for (const row of data || []) {
        if (!plannedByUser[row.user_id]) {
          plannedByUser[row.user_id] = [];
        }
        plannedByUser[row.user_id].push(row.planned_date);
      }
      
      return plannedByUser;
    },
    enabled: userIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch blitz commitments from reps table
  const { data: repsBlitzData, isLoading: blitzLoading } = useQuery({
    queryKey: ['team-blitz-commitments', userIds],
    queryFn: async () => {
      if (userIds.length === 0) return {};
      
      const { data, error } = await supabase
        .from('reps')
        .select('user_id, committed_blitzes')
        .in('user_id', userIds);
      
      if (error) throw error;
      
      const blitzByUser: Record<string, any[]> = {};
      for (const row of data || []) {
        blitzByUser[row.user_id] = (row.committed_blitzes as any[]) || [];
      }
      
      return blitzByUser;
    },
    enabled: userIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // Calculate total planned + worked days for a user within season
  const getTotalWorkDays = (userId: string, seasonStart: Date, seasonEnd: Date): { total: number; elapsed: number } => {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    
    // Get worked days (past)
    const workedDays = repsFpData?.workedDaysByUser[userId] || 0;
    
    // Get planned days (future, within season)
    const plannedDates = allPlannedDays?.[userId] || [];
    const futurePlannedDays = plannedDates.filter(d => {
      const date = parseISO(d);
      return isAfter(date, today) && !isAfter(date, seasonEnd) && !isBefore(date, seasonStart);
    }).length;
    
    // Get blitz days (future, within season, Mon-Sat only)
    const blitzes = repsBlitzData?.[userId] || [];
    let blitzDays = 0;
    
    for (const blitz of blitzes) {
      if (!blitz.startDate || !blitz.endDate) continue;
      
      try {
        const blitzStart = parseISO(blitz.startDate);
        const blitzEnd = parseISO(blitz.endDate);
        
        // Only count future blitz days within season
        const effectiveStart = isAfter(blitzStart, today) ? blitzStart : 
                               isAfter(today, blitzEnd) ? null : today;
        if (!effectiveStart) continue;
        
        const effectiveEnd = isAfter(blitzEnd, seasonEnd) ? seasonEnd : blitzEnd;
        
        if (!isBefore(effectiveStart, effectiveEnd)) continue;
        
        // Count Mon-Sat days in this range
        const days = eachDayOfInterval({ start: effectiveStart, end: effectiveEnd });
        const workDays = days.filter(d => d.getDay() !== 0); // Exclude Sundays
        blitzDays += workDays.length;
      } catch {
        // Skip invalid blitz dates
      }
    }
    
    // Total = worked + future planned + future blitz days (avoid double counting)
    const futurePlannedSet = new Set(plannedDates.filter(d => {
      const date = parseISO(d);
      return isAfter(date, today) && !isAfter(date, seasonEnd);
    }));
    
    // Blitz days might overlap with planned days, so we use max of the two for future
    const totalFutureDays = Math.max(futurePlannedDays, blitzDays);
    const totalDays = workedDays + totalFutureDays;
    
    // Elapsed = just the worked days so far
    return { total: totalDays, elapsed: workedDays };
  };

  // Calculate expected FP+ based on planned work days
  const getExpectedFpByWorkDays = (userId: string, goal: number, seasonStart: Date, seasonEnd: Date): number => {
    if (!goal || goal <= 0) return 0;
    
    const { total, elapsed } = getTotalWorkDays(userId, seasonStart, seasonEnd);
    
    if (total <= 0) {
      // Fallback to linear if no planned days
      const totalCalendarDays = differenceInDays(seasonEnd, seasonStart);
      const daysElapsed = differenceInDays(new Date(), seasonStart);
      if (totalCalendarDays <= 0 || daysElapsed <= 0) return 0;
      return (goal / totalCalendarDays) * daysElapsed;
    }
    
    // Expected = goal distributed across total work days × days already worked
    const dailyExpected = goal / total;
    return dailyExpected * elapsed;
  };

  const allRepNames = useMemo(() => {
    return accessibleReps.map((r: any) => r.name || '');
  }, [accessibleReps]);

  const repsWithGoals: RepWithGoals[] = useMemo(() => {
    if (!allGoals || !repsFpData) return [];
    
    const filteredUserIds = userIds.filter(id => !excludeUserIds.includes(id));
    
    return filteredUserIds.map(userId => {
      const rep = accessibleReps.find((r: any) => r.userId === userId);
      const goals = allGoals.find(g => g.user_id === userId) || null;
      const currentFp = repsFpData.fpByUser[userId] || 0;
      const fullName = rep?.name || 'Unknown';
      
      // Goals
      const preseasonGoal = goals?.preseason_fp_goal || 0;
      const mustDoGoal = goals?.must_do_fp_goal || 0;
      const willDoGoal = goals?.will_do_fp_goal || 0;
      const couldDoGoal = goals?.could_do_fp_goal || 0;
      
      // Progress calculations
      const preseasonProgress = preseasonGoal > 0 ? Math.min((currentFp / preseasonGoal) * 100, 100) : 0;
      const mustDoProgress = mustDoGoal > 0 ? Math.min((currentFp / mustDoGoal) * 100, 100) : 0;
      const willDoProgress = willDoGoal > 0 ? Math.min((currentFp / willDoGoal) * 100, 100) : 0;
      const couldDoProgress = couldDoGoal > 0 ? Math.min((currentFp / couldDoGoal) * 100, 100) : 0;
      
      // Pace calculation - use planned work days instead of linear calendar days
      let paceStatus: 'ahead' | 'on-track' | 'behind' | 'no-goal' = 'no-goal';
      let paceDiff = 0;
      
      if (isPreseason) {
        // Preseason pace based on planned/worked days
        if (preseasonGoal > 0) {
          const expectedFp = getExpectedFpByWorkDays(userId, preseasonGoal, parseISO(preseasonStartDate), parseISO(summerStartDate));
          paceDiff = currentFp - expectedFp;
          
          if (expectedFp > 0) {
            const pacePercent = (paceDiff / expectedFp) * 100;
            if (pacePercent >= 10) paceStatus = 'ahead';
            else if (pacePercent >= -10) paceStatus = 'on-track';
            else paceStatus = 'behind';
          } else if (currentFp > 0) {
            paceStatus = 'ahead';
          }
        }
      } else {
        // Summer pace - based on selected tier and planned days
        const tierGoal = selectedTier === 'must_do' ? mustDoGoal : 
                         selectedTier === 'will_do' ? willDoGoal : couldDoGoal;
        
        if (tierGoal > 0) {
          const expectedFp = getExpectedFpByWorkDays(userId, tierGoal, parseISO(summerStartDate), parseISO(summerEndDate));
          paceDiff = currentFp - expectedFp;
          
          if (expectedFp > 0) {
            const pacePercent = (paceDiff / expectedFp) * 100;
            if (pacePercent >= 10) paceStatus = 'ahead';
            else if (pacePercent >= -10) paceStatus = 'on-track';
            else paceStatus = 'behind';
          } else if (currentFp > 0) {
            paceStatus = 'ahead';
          }
        }
      }
      
      return {
        userId,
        displayName: getDisplayName(fullName, allRepNames),
        year: rep?.year || 'Rookie',
        goals,
        currentFp,
        preseasonGoal,
        preseasonProgress,
        mustDoGoal,
        willDoGoal,
        couldDoGoal,
        mustDoProgress,
        willDoProgress,
        couldDoProgress,
        paceStatus,
        paceDiff,
      };
    }).sort((a, b) => {
      if (a.goals?.setup_complete && !b.goals?.setup_complete) return -1;
      if (!a.goals?.setup_complete && b.goals?.setup_complete) return 1;
      
      if (isPreseason) {
        return b.preseasonProgress - a.preseasonProgress;
      } else {
        const aProgress = selectedTier === 'must_do' ? a.mustDoProgress : 
                          selectedTier === 'will_do' ? a.willDoProgress : a.couldDoProgress;
        const bProgress = selectedTier === 'must_do' ? b.mustDoProgress : 
                          selectedTier === 'will_do' ? b.willDoProgress : b.couldDoProgress;
        return bProgress - aProgress;
      }
    });
  }, [allGoals, repsFpData, allPlannedDays, repsBlitzData, userIds, excludeUserIds, accessibleReps, allRepNames, isPreseason, selectedTier]);

  // Get active goal for a rep based on season/tier
  const getActiveGoal = (rep: RepWithGoals) => {
    if (isPreseason) return rep.preseasonGoal;
    return selectedTier === 'must_do' ? rep.mustDoGoal : 
           selectedTier === 'will_do' ? rep.willDoGoal : rep.couldDoGoal;
  };

  const getActiveProgress = (rep: RepWithGoals) => {
    if (isPreseason) return rep.preseasonProgress;
    return selectedTier === 'must_do' ? rep.mustDoProgress : 
           selectedTier === 'will_do' ? rep.willDoProgress : rep.couldDoProgress;
  };

  const getGoalLabel = () => {
    if (isPreseason) return 'Preseason';
    return selectedTier === 'must_do' ? 'Must Do' : 
           selectedTier === 'will_do' ? 'Will Do' : 'Could Do';
  };

  const stats = useMemo(() => {
    const withGoals = repsWithGoals.filter(r => r.goals?.setup_complete && getActiveGoal(r) > 0);
    const ahead = withGoals.filter(r => r.paceStatus === 'ahead').length;
    const onTrack = withGoals.filter(r => r.paceStatus === 'on-track').length;
    const behind = withGoals.filter(r => r.paceStatus === 'behind').length;
    const noGoals = repsWithGoals.filter(r => !r.goals?.setup_complete || getActiveGoal(r) <= 0).length;
    
    return { withGoals: withGoals.length, ahead, onTrack, behind, noGoals };
  }, [repsWithGoals, isPreseason, selectedTier]);

  const getPaceText = (rep: RepWithGoals) => {
    if (rep.paceStatus === 'on-track') return 'On Pace';
    
    const absDiff = Math.abs(rep.paceDiff);
    if (absDiff < 0.1) return 'On Pace';
    
    if (rep.paceStatus === 'ahead') {
      return `+${absDiff.toFixed(1)} ahead`;
    } else {
      return `${absDiff.toFixed(1)} behind`;
    }
  };

  if (goalsLoading || fpLoading || plannedLoading || blitzLoading) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            {isPreseason ? 'Preseason Goals' : 'Summer Goals'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (repsWithGoals.length === 0) {
    return null;
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            {isPreseason ? 'Preseason Goals' : 'Summer Goals'}
          </CardTitle>
          {(urgencyBadgeCount ?? stats.behind) > 0 && (
            <Badge variant="destructive" className="text-xs">
              {urgencyBadgeCount ?? stats.behind} behind
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summer Goal Tier Filter - only show after summer starts */}
        {!isPreseason && (
          <div className="flex gap-1.5">
            <Button
              variant={selectedTier === 'must_do' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedTier('must_do')}
              className="flex-1 text-xs h-8"
            >
              Must Do
            </Button>
            <Button
              variant={selectedTier === 'will_do' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedTier('will_do')}
              className="flex-1 text-xs h-8"
            >
              Will Do
            </Button>
            <Button
              variant={selectedTier === 'could_do' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedTier('could_do')}
              className="flex-1 text-xs h-8"
            >
              Could Do
            </Button>
          </div>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="p-2 rounded-lg bg-green-500/10">
            <p className="text-lg font-bold text-green-600 dark:text-green-400">{stats.ahead}</p>
            <p className="text-[10px] text-muted-foreground">Ahead</p>
          </div>
          <div className="p-2 rounded-lg bg-blue-500/10">
            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{stats.onTrack}</p>
            <p className="text-[10px] text-muted-foreground">On Track</p>
          </div>
          <div className="p-2 rounded-lg bg-amber-500/10">
            <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{stats.behind}</p>
            <p className="text-[10px] text-muted-foreground">Behind</p>
          </div>
          <div className="p-2 rounded-lg bg-muted">
            <p className="text-lg font-bold text-muted-foreground">{stats.noGoals}</p>
            <p className="text-[10px] text-muted-foreground">No Goal</p>
          </div>
        </div>

        {/* Rep Goals List */}
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {repsWithGoals.map(rep => {
            const activeGoal = getActiveGoal(rep);
            const activeProgress = getActiveProgress(rep);
            
            return (
              <div key={rep.userId} className="p-3 rounded-lg border border-border/50 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{rep.displayName}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {rep.year}
                    </span>
                  </div>
                  {rep.goals?.setup_complete && activeGoal > 0 ? (
                    <div className={cn(
                      "flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
                      rep.paceStatus === 'ahead' && "bg-green-500/10 text-green-600 dark:text-green-400",
                      rep.paceStatus === 'on-track' && "bg-blue-500/10 text-blue-600 dark:text-blue-400",
                      rep.paceStatus === 'behind' && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                    )}>
                      {rep.paceStatus === 'ahead' && <TrendingUp className="h-3 w-3" />}
                      {rep.paceStatus === 'on-track' && <Minus className="h-3 w-3" />}
                      {rep.paceStatus === 'behind' && <TrendingDown className="h-3 w-3" />}
                      {getPaceText(rep)}
                    </div>
                  ) : (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      No goal set
                    </span>
                  )}
                </div>
                
                {rep.goals?.setup_complete && activeGoal > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-16 text-muted-foreground">Current:</span>
                      <span className="font-semibold">{rep.currentFp.toFixed(1)} FP+</span>
                    </div>
                    
                    {/* Goal Progress */}
                    <div className="flex items-center gap-2">
                      <span className="w-16 text-[10px] text-muted-foreground">{getGoalLabel()}</span>
                      <div className="flex-1 flex items-center gap-2">
                        <Progress 
                          value={activeProgress} 
                          className="h-1.5 flex-1"
                        />
                        {activeProgress >= 100 && (
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                        )}
                      </div>
                      <span className="text-[10px] w-10 text-right text-muted-foreground">
                        {activeGoal}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};