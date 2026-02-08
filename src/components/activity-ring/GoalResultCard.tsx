import { motion } from "framer-motion";
import { Target, Trophy, TrendingUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { formatFP } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { useRepGoals } from "@/hooks/useRepGoals";

interface GoalResultCardProps {
  fpToday: number;
  className?: string;
}

export const GoalResultCard = ({
  fpToday,
  className,
}: GoalResultCardProps) => {
  const { goals } = useRepGoals();

  if (!goals?.setup_complete) return null;

  // Determine which goal tier to use based on focus_tier or default to will_do
  const focusTier = goals.focus_tier || 'willDo';
  const goalMap = {
    mustDo: { goal: goals.must_do_fp_goal || 0, label: 'Must Do' },
    willDo: { goal: goals.will_do_fp_goal || 0, label: 'Will Do' },
    couldDo: { goal: goals.could_do_fp_goal || 0, label: 'Could Do' },
  };

  const { goal, label } = goalMap[focusTier as keyof typeof goalMap] || goalMap.willDo;
  
  // Calculate daily goal from seasonal goal and weeks working
  const weeksWorking = goals.weeks_working || 14;
  const daysWorking = weeksWorking * 5; // Assume 5 days/week
  const dailyGoal = goal / daysWorking;
  
  const progress = dailyGoal > 0 ? Math.min((fpToday / dailyGoal) * 100, 150) : 0;
  const goalMet = fpToday >= dailyGoal;
  const remaining = Math.max(0, dailyGoal - fpToday);

  return (
    <motion.div
      className={cn(
        "p-4 rounded-xl border",
        goalMet 
          ? "bg-green-500/10 border-green-500/30" 
          : "bg-muted/30 border-border/30",
        className
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {goalMet ? (
            <Trophy className="w-5 h-5 text-green-500" />
          ) : (
            <Target className="w-5 h-5 text-primary" />
          )}
          <div>
            <div className="font-semibold text-foreground">
              {goalMet ? "Goal Crushed! 🎉" : "Daily Goal"}
            </div>
            <div className="text-xs text-muted-foreground">{label} Pace</div>
          </div>
        </div>
        
        <div className="text-right">
          <div className="text-lg font-bold tabular-nums">
            {formatFP(fpToday)} / {formatFP(dailyGoal)}
          </div>
          <div className="text-xs text-muted-foreground">FP+</div>
        </div>
      </div>

      <Progress value={progress} className="h-2 mb-2" />

      <div className="flex items-center justify-between text-xs">
        <span className={cn(
          "font-medium",
          goalMet ? "text-green-500" : "text-muted-foreground"
        )}>
          {Math.round(progress)}% of daily goal
        </span>
        {!goalMet && remaining > 0 && (
          <span className="flex items-center gap-1 text-primary">
            <TrendingUp className="w-3 h-3" />
            {formatFP(remaining)} more needed
          </span>
        )}
      </div>
    </motion.div>
  );
};
