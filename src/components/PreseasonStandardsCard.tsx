import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChevronRight, BookOpen, Dumbbell, Phone, Target, Users, Timer, ChevronDown, ChevronUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRepGoals } from "@/hooks/useRepGoals";
import { usePreseasonFP } from "@/hooks/usePreseasonFP";
import { useEfpMode } from "@/hooks/useEfpMode";
import { useRepsWithSaleCount } from "@/hooks/useRepsWithSaleCount";
import { usePlannedDays } from "@/hooks/usePlannedDays";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { getCommitmentPaceStatus, PaceStatus } from "@/utils/paceCalculator";
import { calculateSalesPace } from "@/utils/salesPaceCalculator";
import { useCurrentUserId } from "@/hooks/useCurrentUserId";

interface CommitmentItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  current: number;
  goal: number;
  unit?: string;
  weeklyReset?: boolean;
}

export const PreseasonStandardsCard = () => {
  const navigate = useNavigate();
  const { goals, isLoading, hasGoalsAccess } = useRepGoals();
  const { totalFP: preseasonFP, totalEFP: preseasonEFP, totalPRMR: preseasonPRMR, knockingDays } = usePreseasonFP();
  const { efpModeEnabled, calculateEfp } = useEfpMode();
  const { count: repsWithSaleCount } = useRepsWithSaleCount();
  const { plannedDays } = usePlannedDays();
  const [isExpanded, setIsExpanded] = useState(false);
  const { userId, isReady: authReady } = useCurrentUserId();

  // Fetch user's personal summer start date
  const { data: seasonConfig } = useQuery({
    queryKey: ['season-config-pace', userId],
    enabled: authReady && !!userId,
    queryFn: async () => {
      if (!userId) return null;
      
      const { data } = await supabase
        .from('season_config')
        .select('personal_summer_start')
        .eq('user_id', userId)
        .single();
      
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const personalSummerStart = seasonConfig?.personal_summer_start;

  // Calculate FP pace using centralized calculator (same as Goals page)
  const fpPaceResult = useMemo(() => {
    if (!goals?.setup_complete) return null;
    
    return calculateSalesPace({
      goals,
      plannedDays,
      knockingDays: knockingDays || 0,
      currentFpPlus: preseasonFP,
      currentPrmr: preseasonPRMR,
      efpModeEnabled,
      calculateEfp,
      activeTier: 'preseason',
      personalSummerStart,
    });
  }, [goals, plannedDays, knockingDays, preseasonFP, preseasonPRMR, efpModeEnabled, calculateEfp, personalSummerStart]);

  // INSTANT LOAD: Show cached goals immediately, only hide if truly no access after loading
  // Key insight: if goals?.setup_complete is true (from cache), show the card immediately
  const hasGoalsFromCache = goals?.setup_complete === true;
  
  // Don't show if no goals access AND we're not loading (i.e., we know for sure user doesn't have access)
  if (!hasGoalsAccess && !isLoading) return null;
  // Don't show if goals not set up AND we've confirmed loading is done
  if (!hasGoalsFromCache && !isLoading) return null;
  // If still loading with no cached goals, return null (prevents skeleton flash, layout will settle)
  if (isLoading && !hasGoalsFromCache) return null;

  // Build commitment items from goals (excluding blitzes - shown in separate card)
  const commitments: CommitmentItem[] = [
    {
      key: "training",
      label: "Training",
      icon: <Timer className="h-4 w-4" />,
      current: goals.training_hours_progress || 0, // Keep in minutes for pace calc
      goal: (goals.training_hours_goal || 0) * 60, // Convert goal hours to minutes
      unit: "hrs/wk",
      weeklyReset: true,
    },
    {
      key: "books",
      label: "Books",
      icon: <BookOpen className="h-4 w-4" />,
      current: goals.books_progress || 0,
      goal: goals.books_goal || 0,
    },
    {
      key: "roleplays",
      label: "Role Plays",
      icon: <Dumbbell className="h-4 w-4" />,
      current: goals.role_plays_progress || 0,
      goal: goals.role_plays_goal || 0,
    },
    {
      key: "mnl",
      label: "MNL Calls",
      icon: <Phone className="h-4 w-4" />,
      current: goals.monday_night_lights_progress || 0,
      goal: goals.monday_night_lights_goal || 0,
    },
    {
      key: "fp",
      label: efpModeEnabled ? "EFP Before Summer" : "FP+ Before Summer",
      icon: <Target className="h-4 w-4" />,
      current: efpModeEnabled ? preseasonEFP : preseasonFP,
      goal: goals.preseason_fp_goal || 0,
    },
    {
      key: "recruits",
      label: "Recruits w/ Sale",
      icon: <Users className="h-4 w-4" />,
      current: repsWithSaleCount, // Auto-calculated from My Group data
      goal: goals.recruits_with_sale_goal || 0,
    },
  ].filter(c => c.goal > 0); // Only show items with goals set

  if (commitments.length === 0) return null;

  // Use centralized pace calculator for FP, old calculator for other commitments
  const getPaceStatus = (commitment: CommitmentItem): PaceStatus => {
    // For FP+ / EFP, use the centralized calculator result
    if (commitment.key === "fp") {
      if (!fpPaceResult) return 'no-goal';
      return fpPaceResult.isOnTrack ? 'ahead' : 'behind';
    }
    
    // For other commitments, use the original pace calculator
    return getCommitmentPaceStatus(
      commitment.key,
      commitment.current,
      commitment.goal,
      personalSummerStart
    );
  };

  const behindCount = commitments.filter(c => getPaceStatus(c) === "behind").length;

  // Show condensed view (first 3 items) or expanded view
  const visibleCommitments = isExpanded ? commitments : commitments.slice(0, 3);

  // Helper to format display values (convert minutes back to hours for training)
  const getDisplayValue = (commitment: CommitmentItem, value: number): string => {
    if (commitment.key === "training") {
      return Math.round(value / 60).toString();
    }
    return value.toString();
  };

  return (
    <Card 
      className="mb-6 border-2 border-secondary/50 shadow-md cursor-pointer hover:border-primary/30 transition-colors"
      onClick={() => navigate('/goals')}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Your Standards</CardTitle>
          {behindCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {behindCount} behind pace
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {visibleCommitments.map((commitment) => {
          const status = getPaceStatus(commitment);
          const progress = commitment.goal > 0 ? (commitment.current / commitment.goal) * 100 : 0;
          const displayCurrent = getDisplayValue(commitment, commitment.current);
          const displayGoal = getDisplayValue(commitment, commitment.goal);
          
          return (
            <div key={commitment.key} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{commitment.icon}</span>
                  <span className={cn(
                    "text-sm",
                    status === "behind" && "text-destructive font-medium"
                  )}>
                    {commitment.label}
                  </span>
                  {commitment.weeklyReset && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0">
                      weekly
                    </Badge>
                  )}
                </div>
                <span className={cn(
                  "font-medium text-sm",
                  status === "ahead" && "text-green-600 dark:text-green-400",
                  status === "behind" && "text-destructive"
                )}>
                  {displayCurrent}/{displayGoal}
                  {commitment.unit && <span className="text-xs text-muted-foreground ml-0.5">{commitment.unit}</span>}
                </span>
              </div>
              <Progress 
                value={Math.min(progress, 100)} 
                className={cn(
                  "h-1.5",
                  status === "behind" && "[&>div]:bg-destructive"
                )}
              />
            </div>
          );
        })}

        {commitments.length > 3 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-8 text-muted-foreground"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                Show {commitments.length - 3} more
              </>
            )}
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="w-full h-8 text-primary"
          onClick={(e) => {
            e.stopPropagation();
            navigate('/goals');
          }}
        >
          View Goals
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
};
