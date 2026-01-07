import { motion } from "framer-motion";
import { Trophy, Users, Target, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Incentive, IncentiveMetric } from "@/hooks/useIncentives";
import { format, parseISO, isToday, differenceInHours, differenceInDays } from "date-fns";

interface IncentiveCardProps {
  incentive: Incentive;
}

const metricLabels: Record<IncentiveMetric, string> = {
  fp_plus: 'FP+',
  prmr: 'PRMR',
  transitions: 'Transitions',
  doors_knocked: 'Doors',
};

export const IncentiveCard = ({ incentive }: IncentiveCardProps) => {
  const isActive = incentive.status === 'active';
  const isCompleted = incentive.status === 'completed';

  // Format time remaining
  const getTimeRemaining = () => {
    const endDate = new Date(incentive.end_date);
    endDate.setHours(23, 59, 59, 999);
    const now = new Date();
    
    if (endDate < now) return 'Ended';
    
    const hoursLeft = differenceInHours(endDate, now);
    const daysLeft = differenceInDays(endDate, now);
    
    if (daysLeft > 0) return `${daysLeft}d left`;
    if (hoursLeft > 0) return `${hoursLeft}h left`;
    return 'Ending soon';
  };

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className={cn(
        "bg-card rounded-2xl border border-border p-4 cursor-pointer transition-colors",
        isActive && "border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
            <Trophy className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h3 className="font-semibold">{incentive.title}</h3>
            <p className="text-xs text-muted-foreground">
              by {incentive.creator_name}
            </p>
          </div>
        </div>
        
        {isActive && (
          <span className="text-xs font-medium bg-amber-500/20 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full">
            {getTimeRemaining()}
          </span>
        )}
        {isCompleted && (
          <span className="text-xs font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
            Completed
          </span>
        )}
      </div>

      {/* Reward */}
      <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-xl p-3 mb-3">
        <p className="text-xs text-muted-foreground mb-1">Prize</p>
        <p className="font-semibold text-amber-600 dark:text-amber-400">
          {incentive.reward}
        </p>
      </div>

      {/* Details */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <Target className="h-3.5 w-3.5" />
          <span>
            {incentive.target_type === 'first_to' 
              ? `First to ${incentive.target_value} ${metricLabels[incentive.metric]}`
              : `Most ${metricLabels[incentive.metric]}`
            }
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          <span>{incentive.eligible_count} eligible</span>
        </div>
      </div>

      {/* Winner display for completed */}
      {isCompleted && incentive.winner_user_id && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium">Winner claimed the prize!</span>
          </div>
        </div>
      )}
    </motion.div>
  );
};
