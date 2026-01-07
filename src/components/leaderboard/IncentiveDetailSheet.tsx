import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Trophy, Users, Target, Clock, User, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Incentive, IncentiveMetric } from "@/hooks/useIncentives";
import { useIncentiveProgress } from "@/hooks/useIncentiveProgress";
import { format } from "date-fns";

interface IncentiveDetailSheetProps {
  incentive: Incentive;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const metricLabels: Record<IncentiveMetric, string> = {
  fp_plus: 'FP+',
  prmr: 'PRMR',
  transitions: 'Transitions',
  doors_knocked: 'Doors',
};

export const IncentiveDetailSheet = ({ incentive, open, onOpenChange }: IncentiveDetailSheetProps) => {
  const isActive = incentive.status === 'active';
  const isGroupTotal = incentive.target_type === 'group_total';
  
  const { data: progressData } = useIncentiveProgress(isActive ? incentive : null);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
              <Trophy className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <DrawerTitle>{incentive.title}</DrawerTitle>
              <p className="text-sm text-muted-foreground">by {incentive.creator_name}</p>
            </div>
          </div>
        </DrawerHeader>

        <div className="p-4 space-y-6 overflow-y-auto">
          {/* Reward */}
          <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-xl p-4">
            <p className="text-sm text-muted-foreground mb-1">Prize</p>
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
              {incentive.reward}
            </p>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-muted/50 border border-border">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Target className="h-4 w-4" />
                <span className="text-xs">Goal</span>
              </div>
              <p className="font-semibold text-sm">
                {isGroupTotal 
                  ? `Group: ${incentive.target_value} ${metricLabels[incentive.metric]}`
                  : `First to ${incentive.target_value} ${metricLabels[incentive.metric]}`
                }
              </p>
            </div>
            <div className="p-3 rounded-xl bg-muted/50 border border-border">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Clock className="h-4 w-4" />
                <span className="text-xs">Duration</span>
              </div>
              <p className="font-semibold text-sm">
                {format(new Date(incentive.start_date), 'MMM d')} - {format(new Date(incentive.end_date), 'MMM d')}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-muted/50 border border-border">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Users className="h-4 w-4" />
                <span className="text-xs">Participants</span>
              </div>
              <p className="font-semibold text-sm">
                {incentive.eligible_count} reps
              </p>
            </div>
            <div className="p-3 rounded-xl bg-muted/50 border border-border">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                {incentive.visibility === 'public' ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                <span className="text-xs">Visibility</span>
              </div>
              <p className="font-semibold text-sm capitalize">
                {incentive.visibility}
              </p>
            </div>
          </div>

          {/* Progress Section */}
          {isActive && progressData && (
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                {isGroupTotal ? (
                  <>
                    <Users className="h-4 w-4 text-blue-500" />
                    Team Progress
                  </>
                ) : (
                  <>
                    <Trophy className="h-4 w-4 text-amber-500" />
                    Leaderboard
                  </>
                )}
              </h3>

              {isGroupTotal && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Combined Total</span>
                    <span className="font-bold text-lg text-amber-600">
                      {progressData.groupTotal.toFixed(1)} / {progressData.targetValue}
                    </span>
                  </div>
                  <Progress value={progressData.progressPercent} className="h-3" />
                  <p className="text-xs text-muted-foreground text-right">
                    {progressData.progressPercent.toFixed(0)}% complete
                  </p>
                </div>
              )}

              {/* Individual Contributions */}
              <div className="space-y-2">
                {progressData.participants.map((participant, index) => (
                  <div 
                    key={participant.user_id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl",
                      index === 0 && !isGroupTotal ? "bg-amber-500/10 border border-amber-500/20" : "bg-muted/50"
                    )}
                  >
                    <div className="relative">
                      {index === 0 && !isGroupTotal && (
                        <div className="absolute -top-1 -left-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
                          <Trophy className="h-3 w-3 text-white" />
                        </div>
                      )}
                      <Avatar className="h-10 w-10">
                        {participant.profile_photo_url && (
                          <AvatarImage src={participant.profile_photo_url} />
                        )}
                        <AvatarFallback>{participant.rep_name.charAt(0)}</AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{participant.rep_name}</p>
                      {isGroupTotal && (
                        <p className="text-xs text-muted-foreground">
                          {((participant.current_value / progressData.groupTotal) * 100 || 0).toFixed(0)}% contribution
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-amber-600">
                        {participant.current_value.toFixed(1)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {metricLabels[incentive.metric]}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed State */}
          {incentive.status === 'completed' && incentive.winner_user_id && (
            <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-xl p-4 text-center">
              <Trophy className="h-8 w-8 text-amber-500 mx-auto mb-2" />
              <p className="font-semibold">Winner claimed the prize!</p>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
