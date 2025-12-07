import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChevronRight, BookOpen, Dumbbell, Phone, Target, Users, Timer, ChevronDown, ChevronUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRepGoals } from "@/hooks/useRepGoals";
import { usePreseasonFP } from "@/hooks/usePreseasonFP";
import { useEfpMode } from "@/hooks/useEfpMode";
import { cn } from "@/lib/utils";

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
  const { totalFP: preseasonFP, totalEFP: preseasonEFP } = usePreseasonFP();
  const { efpModeEnabled } = useEfpMode();
  const [isExpanded, setIsExpanded] = useState(false);

  // Don't show if no goals access or goals not set up
  if (!hasGoalsAccess || isLoading) return null;
  if (!goals?.setup_complete) return null;

  // Build commitment items from goals (excluding blitzes - shown in separate card)
  const commitments: CommitmentItem[] = [
    {
      key: "training",
      label: "Training",
      icon: <Timer className="h-4 w-4" />,
      current: Math.round((goals.training_hours_progress || 0) / 60), // Convert minutes to hours
      goal: goals.training_hours_goal || 0,
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
      current: goals.recruits_with_sale_progress || 0,
      goal: goals.recruits_with_sale_goal || 0,
    },
  ].filter(c => c.goal > 0); // Only show items with goals set

  if (commitments.length === 0) return null;

  // Calculate which commitments are behind pace
  const getBehindStatus = (current: number, goal: number): "ahead" | "on-track" | "behind" => {
    if (goal === 0) return "on-track";
    const progress = current / goal;
    
    // For preseason, calculate based on time elapsed
    // April 12, 2026 is summer start
    const summerStart = new Date("2026-04-12");
    const preseasonStart = new Date("2025-09-28");
    const now = new Date();
    
    const totalDays = (summerStart.getTime() - preseasonStart.getTime()) / (1000 * 60 * 60 * 24);
    const elapsedDays = Math.max(0, (now.getTime() - preseasonStart.getTime()) / (1000 * 60 * 60 * 24));
    const expectedProgress = elapsedDays / totalDays;
    
    if (progress >= 1) return "ahead";
    if (progress >= expectedProgress * 0.9) return "on-track";
    return "behind";
  };

  const behindCount = commitments.filter(c => getBehindStatus(c.current, c.goal) === "behind").length;

  // Show condensed view (first 3 items) or expanded view
  const visibleCommitments = isExpanded ? commitments : commitments.slice(0, 3);

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
          const status = getBehindStatus(commitment.current, commitment.goal);
          const progress = commitment.goal > 0 ? (commitment.current / commitment.goal) * 100 : 0;
          
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
                  {commitment.current}/{commitment.goal}
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
