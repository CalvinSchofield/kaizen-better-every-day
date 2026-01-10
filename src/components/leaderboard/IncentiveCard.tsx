import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Users, Target, User, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Incentive, IncentiveMetric } from "@/hooks/useIncentives";
import { useIncentiveProgress } from "@/hooks/useIncentiveProgress";
import { differenceInHours, differenceInDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { IncentiveDetailSheet } from "./IncentiveDetailSheet";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface IncentiveCardProps {
  incentive: Incentive;
}

const metricLabels: Record<IncentiveMetric, string> = {
  fp_plus: 'FP+',
  prmr: 'PRMR',
  transitions: 'Transitions',
  doors_knocked: 'Doors',
};

// Get the timezone offset in minutes for a given timezone
// More negative = further west = later in the day
const getTimezoneOffset = (timezone: string): number => {
  try {
    const now = new Date();
    const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    return (tzDate.getTime() - utcDate.getTime()) / 60000; // offset in minutes
  } catch {
    return 0;
  }
};

// Find the westernmost (latest) timezone among a list
const getLatestTimezone = (timezones: (string | null)[]): string => {
  const validTimezones = timezones.filter(Boolean) as string[];
  if (validTimezones.length === 0) return Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  // Sort by offset (most negative = furthest west = latest time)
  return validTimezones.reduce((latest, tz) => {
    return getTimezoneOffset(tz) < getTimezoneOffset(latest) ? tz : latest;
  });
};

export const IncentiveCard = ({ incentive }: IncentiveCardProps) => {
  const [showDetail, setShowDetail] = useState(false);
  const isActive = incentive.status === 'active';
  const isCompleted = incentive.status === 'completed';
  const isGroupTotal = incentive.target_type === 'group_total';
  const isAnyoneWho = incentive.target_type === 'anyone_who';

  const { data: progressData } = useIncentiveProgress(isActive ? incentive : null);

  // Fetch participant timezones to determine the latest end time
  const { data: participantTimezones } = useQuery({
    queryKey: ['incentive-participant-timezones', incentive.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('incentive_eligible_reps')
        .select('user_id')
        .eq('incentive_id', incentive.id);
      
      if (error || !data?.length) return [];
      
      const userIds = data.map(r => r.user_id);
      const { data: reps } = await supabase
        .from('reps')
        .select('user_id, timezone')
        .in('user_id', userIds);
      
      return reps?.map(r => r.timezone) || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Format time remaining using the latest participant timezone
  const getTimeRemaining = useMemo(() => {
    const latestTimezone = getLatestTimezone(participantTimezones || []);
    
    // Create end of day in the latest timezone
    const endDateStr = incentive.end_date;
    // Parse as local date then set to end of day in the latest timezone
    const [year, month, day] = endDateStr.split('-').map(Number);
    
    // Create a date at 23:59:59 in the latest timezone
    // We compare against "now" in that same timezone
    const nowInLatestTz = toZonedTime(new Date(), latestTimezone);
    const endDateInLatestTz = new Date(year, month - 1, day, 23, 59, 59, 999);
    
    if (endDateInLatestTz < nowInLatestTz) return 'Ended';
    
    const hoursLeft = differenceInHours(endDateInLatestTz, nowInLatestTz);
    const daysLeft = differenceInDays(endDateInLatestTz, nowInLatestTz);
    
    if (daysLeft > 0) return `${daysLeft}d left`;
    if (hoursLeft > 0) return `${hoursLeft}h left`;
    return 'Ending soon';
  }, [incentive.end_date, participantTimezones]);

  const handleClick = () => {
    Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    setShowDetail(true);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.95 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        onClick={handleClick}
        className={cn(
          "bg-card rounded-2xl border border-border p-4 cursor-pointer transition-colors",
          isActive && "border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent shadow-lg shadow-amber-500/5"
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <motion.div 
              className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center"
              animate={isActive ? { 
                boxShadow: ["0 0 0 0 rgba(245, 158, 11, 0)", "0 0 0 8px rgba(245, 158, 11, 0.1)", "0 0 0 0 rgba(245, 158, 11, 0)"]
              } : {}}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              <Trophy className="h-5 w-5 text-amber-500" />
            </motion.div>
            <div>
              <h3 className="font-semibold">{incentive.title}</h3>
              <p className="text-xs text-muted-foreground">
                by {incentive.creator_name}
              </p>
            </div>
          </div>
          
          {isActive && (
            <span className="text-xs font-medium bg-amber-500/20 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full">
              {getTimeRemaining}
            </span>
          )}
          {isCompleted && (
            <span className="text-xs font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
              Completed
            </span>
          )}
        </div>

        {/* Reward - with shimmer effect */}
        <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-xl p-3 mb-3">
          <p className="text-xs text-muted-foreground mb-1">Prize</p>
          <p className="font-semibold text-amber-600 dark:text-amber-400">
            {incentive.reward}
          </p>
        </div>

        {/* Progress for active incentives */}
        <AnimatePresence>
          {isActive && progressData && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-3 space-y-2 overflow-hidden"
            >
              {isGroupTotal ? (
                <>
                  {/* Group Total Progress */}
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-blue-500" />
                      <span className="font-medium">Team Progress</span>
                    </div>
                    <motion.span 
                      key={progressData.groupTotal}
                      initial={{ scale: 1.2, color: "rgb(245, 158, 11)" }}
                      animate={{ scale: 1, color: "rgb(217, 119, 6)" }}
                      className="font-bold text-amber-600"
                    >
                      {progressData.groupTotal.toFixed(1)} / {progressData.targetValue} {metricLabels[incentive.metric]}
                    </motion.span>
                  </div>
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    style={{ originX: 0 }}
                  >
                    <Progress value={progressData.progressPercent} className="h-2" />
                  </motion.div>
                  
                  {/* Individual contributions */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {progressData.participants.slice(0, 4).map((p, i) => (
                      <motion.div 
                        key={p.user_id} 
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-center gap-1 bg-muted/50 rounded-full px-2 py-0.5"
                      >
                        <Avatar className="h-4 w-4">
                          {p.profile_photo_url && <AvatarImage src={p.profile_photo_url} />}
                          <AvatarFallback className="text-[8px]">{p.rep_name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="text-xs">{p.current_value.toFixed(1)}</span>
                      </motion.div>
                    ))}
                    {progressData.participants.length > 4 && (
                      <span className="text-xs text-muted-foreground px-2 py-0.5">
                        +{progressData.participants.length - 4} more
                      </span>
                    )}
                  </div>
                </>
              ) : isAnyoneWho ? (
                <>
                  {/* Anyone Who - show qualified count */}
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="font-medium">Qualified</span>
                    </div>
                    <motion.span 
                      key={progressData.qualifiedParticipants.length}
                      initial={{ scale: 1.2, color: "rgb(34, 197, 94)" }}
                      animate={{ scale: 1, color: "rgb(22, 163, 74)" }}
                      className="font-bold text-green-600"
                    >
                      {progressData.qualifiedParticipants.length} / {progressData.participants.length}
                    </motion.span>
                  </div>
                  
                  {/* Show qualified participants */}
                  {progressData.qualifiedParticipants.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {progressData.qualifiedParticipants.slice(0, 4).map((p, i) => (
                        <motion.div 
                          key={p.user_id} 
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.05 }}
                          className="flex items-center gap-1 bg-green-500/10 rounded-full px-2 py-0.5 border border-green-500/20"
                        >
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                          <Avatar className="h-4 w-4">
                            {p.profile_photo_url && <AvatarImage src={p.profile_photo_url} />}
                            <AvatarFallback className="text-[8px]">{p.rep_name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-medium">{p.rep_name.split(' ')[0]}</span>
                        </motion.div>
                      ))}
                      {progressData.qualifiedParticipants.length > 4 && (
                        <span className="text-xs text-green-600 px-2 py-0.5">
                          +{progressData.qualifiedParticipants.length - 4} more
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">
                      No one has qualified yet - be the first!
                    </p>
                  )}
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
                          <motion.span 
                            key={progressData.leader.current_value}
                            initial={{ scale: 1.2 }}
                            animate={{ scale: 1 }}
                            className="font-bold text-amber-600"
                          >
                            {progressData.leader.current_value.toFixed(1)} / {progressData.targetValue}
                          </motion.span>
                        </>
                      )}
                    </div>
                  </div>
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    style={{ originX: 0 }}
                  >
                    <Progress value={progressData.progressPercent} className="h-2" />
                  </motion.div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Details */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Target className="h-3.5 w-3.5" />
            <span>
              {isGroupTotal 
                ? `Group reaches ${incentive.target_value} ${metricLabels[incentive.metric]}`
                : isAnyoneWho
                  ? `Anyone who gets ${incentive.target_value} ${metricLabels[incentive.metric]}`
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
        {isCompleted && (
          <div className="mt-3 pt-3 border-t border-border">
            {isAnyoneWho ? (
              // Anyone who - show how many qualified
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">
                  {(incentive.winner_user_ids?.length || 0) > 0 
                    ? `${incentive.winner_user_ids?.length} qualified and won!`
                    : 'No one qualified'}
                </span>
              </div>
            ) : incentive.winner_user_id ? (
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium">Winner claimed the prize!</span>
              </div>
            ) : isGroupTotal ? (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">Group goal achieved!</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Target className="h-4 w-4" />
                <span className="text-sm">Expired - no winner</span>
              </div>
            )}
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
