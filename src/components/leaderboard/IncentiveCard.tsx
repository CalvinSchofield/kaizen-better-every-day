import { useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Users, Target, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Incentive, IncentiveMetric } from "@/hooks/useIncentives";
import { useIncentiveProgress } from "@/hooks/useIncentiveProgress";
import { differenceInHours, differenceInDays } from "date-fns";
import { IncentiveDetailSheet } from "./IncentiveDetailSheet";

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
  const [showDetail, setShowDetail] = useState(false);
  const isActive = incentive.status === 'active';
  const isCompleted = incentive.status === 'completed';
  const isGroupTotal = incentive.target_type === 'group_total';

  const { data: progressData } = useIncentiveProgress(isActive ? incentive : null);

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
    <>
      <motion.div
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={() => setShowDetail(true)}
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

        {/* Progress for active incentives */}
        {isActive && progressData && (
          <div className="mb-3 space-y-2">
            {isGroupTotal ? (
              <>
                {/* Group Total Progress */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-blue-500" />
                    <span className="font-medium">Team Progress</span>
                  </div>
                  <span className="font-bold text-amber-600">
                    {progressData.groupTotal.toFixed(1)} / {progressData.targetValue} {metricLabels[incentive.metric]}
                  </span>
                </div>
                <Progress value={progressData.progressPercent} className="h-2" />
                
                {/* Individual contributions */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {progressData.participants.slice(0, 4).map(p => (
                    <div key={p.user_id} className="flex items-center gap-1 bg-muted/50 rounded-full px-2 py-0.5">
                      <Avatar className="h-4 w-4">
                        {p.profile_photo_url && <AvatarImage src={p.profile_photo_url} />}
                        <AvatarFallback className="text-[8px]">{p.rep_name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs">{p.current_value.toFixed(1)}</span>
                    </div>
                  ))}
                  {progressData.participants.length > 4 && (
                    <span className="text-xs text-muted-foreground px-2 py-0.5">
                      +{progressData.participants.length - 4} more
                    </span>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Individual Race - show leader */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1.5">
                    <User className="h-4 w-4 text-primary" />
                    <span className="font-medium">Leader</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {progressData.leader && (
                      <>
                        <span className="text-muted-foreground">{progressData.leader.rep_name}</span>
                        <span className="font-bold text-amber-600">
                          {progressData.leader.current_value.toFixed(1)} / {progressData.targetValue}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <Progress value={progressData.progressPercent} className="h-2" />
              </>
            )}
          </div>
        )}

        {/* Details */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Target className="h-3.5 w-3.5" />
            <span>
              {isGroupTotal 
                ? `Group reaches ${incentive.target_value} ${metricLabels[incentive.metric]}`
                : incentive.target_type === 'first_to' 
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

      <IncentiveDetailSheet
        incentive={incentive}
        open={showDetail}
        onOpenChange={setShowDetail}
      />
    </>
  );
};
