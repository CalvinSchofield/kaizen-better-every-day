import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Target, TrendingUp, TrendingDown, Minus, CheckCircle2, Clock } from "lucide-react";
import { useAllRepGoals, RepGoals } from "@/hooks/useRepGoals";
import { usePreseasonFP } from "@/hooks/usePreseasonFP";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { differenceInDays, parseISO } from "date-fns";

interface LeaderGoalsCardProps {
  userIds: string[];
  excludeUserIds?: string[];
  accessibleReps?: any[];
}

interface RepWithGoals {
  userId: string;
  name: string;
  year: string;
  goals: RepGoals | null;
  currentFp: number;
  mustDoProgress: number;
  willDoProgress: number;
  couldDoProgress: number;
  paceStatus: 'ahead' | 'on-track' | 'behind' | 'no-goal';
  pacePercent: number;
}

export const LeaderGoalsCard = ({ userIds, excludeUserIds = [], accessibleReps = [] }: LeaderGoalsCardProps) => {
  const { data: allGoals, isLoading: goalsLoading } = useAllRepGoals();
  
  // Fetch preseason FP for all reps in scope
  const { data: repsFp, isLoading: fpLoading } = useQuery({
    queryKey: ['team-preseason-fp', userIds],
    queryFn: async () => {
      if (userIds.length === 0) return {};
      
      const summerStartDate = '2026-04-12';
      
      const { data, error } = await supabase
        .from('daily_entries')
        .select('user_id, fp_plus, upgrade_prmr')
        .in('user_id', userIds)
        .eq('is_finalized', true)
        .lt('entry_date', summerStartDate);
      
      if (error) throw error;
      
      // Sum FP+ per user
      const fpByUser: Record<string, number> = {};
      for (const entry of data || []) {
        const fpPlus = (entry.fp_plus || 0) + ((entry.upgrade_prmr || 0) / 85);
        fpByUser[entry.user_id] = (fpByUser[entry.user_id] || 0) + fpPlus;
      }
      
      return fpByUser;
    },
    enabled: userIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // Calculate expected pace based on summer start date
  const getExpectedPace = (goal: number): number => {
    if (!goal) return 0;
    
    const summerStart = parseISO('2026-04-12');
    const preseasonStart = parseISO('2025-09-28');
    const now = new Date();
    
    const totalDays = differenceInDays(summerStart, preseasonStart);
    const daysElapsed = differenceInDays(now, preseasonStart);
    
    if (daysElapsed <= 0) return 0;
    if (daysElapsed >= totalDays) return goal;
    
    return (goal * daysElapsed) / totalDays;
  };

  const repsWithGoals: RepWithGoals[] = useMemo(() => {
    if (!allGoals || !repsFp) return [];
    
    const filteredUserIds = userIds.filter(id => !excludeUserIds.includes(id));
    
    return filteredUserIds.map(userId => {
      const rep = accessibleReps.find((r: any) => r.userId === userId);
      const goals = allGoals.find(g => g.user_id === userId) || null;
      const currentFp = repsFp[userId] || 0;
      
      const mustDoGoal = goals?.must_do_fp_goal || 0;
      const willDoGoal = goals?.will_do_fp_goal || 0;
      const couldDoGoal = goals?.could_do_fp_goal || 0;
      
      const mustDoProgress = mustDoGoal > 0 ? Math.min((currentFp / mustDoGoal) * 100, 100) : 0;
      const willDoProgress = willDoGoal > 0 ? Math.min((currentFp / willDoGoal) * 100, 100) : 0;
      const couldDoProgress = couldDoGoal > 0 ? Math.min((currentFp / couldDoGoal) * 100, 100) : 0;
      
      // Calculate pace status based on will_do goal
      let paceStatus: 'ahead' | 'on-track' | 'behind' | 'no-goal' = 'no-goal';
      let pacePercent = 0;
      
      if (willDoGoal > 0) {
        const expectedFp = getExpectedPace(willDoGoal);
        if (expectedFp > 0) {
          pacePercent = ((currentFp - expectedFp) / expectedFp) * 100;
          
          if (pacePercent >= 10) {
            paceStatus = 'ahead';
          } else if (pacePercent >= -10) {
            paceStatus = 'on-track';
          } else {
            paceStatus = 'behind';
          }
        }
      }
      
      return {
        userId,
        name: rep?.name || 'Unknown',
        year: rep?.year || 'Rookie',
        goals,
        currentFp,
        mustDoProgress,
        willDoProgress,
        couldDoProgress,
        paceStatus,
        pacePercent,
      };
    }).sort((a, b) => {
      // Sort by: has goals first, then by will_do progress descending
      if (a.goals?.setup_complete && !b.goals?.setup_complete) return -1;
      if (!a.goals?.setup_complete && b.goals?.setup_complete) return 1;
      return b.willDoProgress - a.willDoProgress;
    });
  }, [allGoals, repsFp, userIds, excludeUserIds, accessibleReps]);

  const stats = useMemo(() => {
    const withGoals = repsWithGoals.filter(r => r.goals?.setup_complete);
    const ahead = withGoals.filter(r => r.paceStatus === 'ahead').length;
    const onTrack = withGoals.filter(r => r.paceStatus === 'on-track').length;
    const behind = withGoals.filter(r => r.paceStatus === 'behind').length;
    const noGoals = repsWithGoals.filter(r => !r.goals?.setup_complete).length;
    
    return { withGoals: withGoals.length, ahead, onTrack, behind, noGoals };
  }, [repsWithGoals]);

  if (goalsLoading || fpLoading) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Team Goals
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
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Team Goals
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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
            <p className="text-[10px] text-muted-foreground">No Goals</p>
          </div>
        </div>

        {/* Rep Goals List */}
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {repsWithGoals.map(rep => (
            <div key={rep.userId} className="p-3 rounded-lg border border-border/50 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{rep.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    {rep.year}
                  </span>
                </div>
                {rep.goals?.setup_complete ? (
                  <div className={cn(
                    "flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
                    rep.paceStatus === 'ahead' && "bg-green-500/10 text-green-600 dark:text-green-400",
                    rep.paceStatus === 'on-track' && "bg-blue-500/10 text-blue-600 dark:text-blue-400",
                    rep.paceStatus === 'behind' && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                  )}>
                    {rep.paceStatus === 'ahead' && <TrendingUp className="h-3 w-3" />}
                    {rep.paceStatus === 'on-track' && <Minus className="h-3 w-3" />}
                    {rep.paceStatus === 'behind' && <TrendingDown className="h-3 w-3" />}
                    {rep.paceStatus === 'ahead' && `+${Math.abs(rep.pacePercent).toFixed(0)}%`}
                    {rep.paceStatus === 'on-track' && 'On Pace'}
                    {rep.paceStatus === 'behind' && `-${Math.abs(rep.pacePercent).toFixed(0)}%`}
                  </div>
                ) : (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    No goals set
                  </span>
                )}
              </div>
              
              {rep.goals?.setup_complete && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-16 text-muted-foreground">Current:</span>
                    <span className="font-semibold">{rep.currentFp.toFixed(1)} FP+</span>
                  </div>
                  
                  {/* Goal Ladder Progress */}
                  <div className="space-y-1">
                    {/* Must Do */}
                    {rep.goals.must_do_fp_goal > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="w-16 text-[10px] text-muted-foreground">Must Do</span>
                        <div className="flex-1 flex items-center gap-2">
                          <Progress 
                            value={rep.mustDoProgress} 
                            className="h-1.5 flex-1"
                          />
                          {rep.mustDoProgress >= 100 && (
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                          )}
                        </div>
                        <span className="text-[10px] w-10 text-right text-muted-foreground">
                          {rep.goals.must_do_fp_goal}
                        </span>
                      </div>
                    )}
                    
                    {/* Will Do */}
                    {rep.goals.will_do_fp_goal > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="w-16 text-[10px] text-muted-foreground">Will Do</span>
                        <div className="flex-1 flex items-center gap-2">
                          <Progress 
                            value={rep.willDoProgress} 
                            className="h-1.5 flex-1"
                          />
                          {rep.willDoProgress >= 100 && (
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                          )}
                        </div>
                        <span className="text-[10px] w-10 text-right text-muted-foreground">
                          {rep.goals.will_do_fp_goal}
                        </span>
                      </div>
                    )}
                    
                    {/* Could Do */}
                    {rep.goals.could_do_fp_goal > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="w-16 text-[10px] text-muted-foreground">Could Do</span>
                        <div className="flex-1 flex items-center gap-2">
                          <Progress 
                            value={rep.couldDoProgress} 
                            className="h-1.5 flex-1"
                          />
                          {rep.couldDoProgress >= 100 && (
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                          )}
                        </div>
                        <span className="text-[10px] w-10 text-right text-muted-foreground">
                          {rep.goals.could_do_fp_goal}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
