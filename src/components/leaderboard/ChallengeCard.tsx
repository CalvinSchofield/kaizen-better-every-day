import { useState } from "react";
import { motion } from "framer-motion";
import { Flame, Users, Clock, Trophy, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Challenge, useRespondToChallenge, ChallengeMetric } from "@/hooks/useChallenges";
import { useChallengeProgress } from "@/hooks/useChallengeProgress";
import { ChallengeDetailSheet } from "./ChallengeDetailSheet";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, isToday, isTomorrow } from "date-fns";
import { toast } from "sonner";

interface ChallengeCardProps {
  challenge: Challenge;
}

const metricLabels: Record<ChallengeMetric, { label: string; format: (v: number) => string }> = {
  fp_plus: { label: 'FP+', format: (v) => v.toFixed(1) },
  prmr: { label: 'PRMR', format: (v) => `$${v.toLocaleString()}` },
  transitions: { label: 'Transitions', format: (v) => v.toString() },
  doors_knocked: { label: 'Doors', format: (v) => v.toString() },
};

export const ChallengeCard = ({ challenge }: ChallengeCardProps) => {
  const [showDetail, setShowDetail] = useState(false);
  
  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const { data: progress } = useChallengeProgress(
    challenge.status === 'active' ? challenge : null
  );

  const respondMutation = useRespondToChallenge();

  const isCreator = currentUser?.id === challenge.created_by;
  const myParticipation = challenge.participants?.find(p => p.user_id === currentUser?.id);
  const isPending = challenge.status === 'pending';
  const needsMyResponse = isPending && myParticipation && myParticipation.accepted === null && !isCreator;
  const is1v1 = challenge.type === '1v1';

  // Get opponent for 1v1
  const opponent = is1v1 
    ? challenge.participants?.find(p => p.user_id !== currentUser?.id)
    : null;

  // Format date
  const formatChallengeDate = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'MMM d');
  };

  const handleAccept = async () => {
    try {
      await respondMutation.mutateAsync({ challengeId: challenge.id, accept: true });
      toast.success('Challenge accepted! Game on! 🔥');
    } catch (error) {
      toast.error('Failed to accept challenge');
    }
  };

  const handleDecline = async () => {
    try {
      await respondMutation.mutateAsync({ challengeId: challenge.id, accept: false });
      toast.success('Challenge declined');
    } catch (error) {
      toast.error('Failed to decline challenge');
    }
  };

  const metricConfig = metricLabels[challenge.metric];

  return (
    <>
      <motion.div
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={() => !needsMyResponse && setShowDetail(true)}
        className={cn(
          "bg-card rounded-2xl border border-border p-4 cursor-pointer transition-colors",
          challenge.status === 'active' && "border-primary/30",
          needsMyResponse && "cursor-default"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {is1v1 ? (
              <Flame className="h-4 w-4 text-orange-500" />
            ) : (
              <Users className="h-4 w-4 text-blue-500" />
            )}
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {is1v1 ? '1v1 Challenge' : 'Team Battle'}
            </span>
          </div>
          
          {challenge.status === 'active' && (
            <span className="flex items-center gap-1 text-xs font-medium bg-green-500/20 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              LIVE
            </span>
          )}
          {challenge.status === 'pending' && (
            <span className="flex items-center gap-1 text-xs font-medium bg-amber-500/20 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full">
              <Clock className="h-3 w-3" />
              Pending
            </span>
          )}
          {challenge.status === 'completed' && (
            <span className="flex items-center gap-1 text-xs font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
              <Trophy className="h-3 w-3" />
              Completed
            </span>
          )}
        </div>

        {/* 1v1 Matchup */}
        {is1v1 && (
          <div className="flex items-center justify-between mb-3">
            {/* You */}
            <div className="flex items-center gap-2">
              <Avatar className="h-10 w-10 border-2 border-primary">
                <AvatarImage src={myParticipation?.profile_photo_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {myParticipation?.rep_name?.charAt(0) || 'Y'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-sm">You</p>
                {progress && (
                  <p className="text-lg font-bold text-primary">
                    {metricConfig.format(progress.userProgress?.current_value || 0)}
                  </p>
                )}
              </div>
            </div>

            <span className="text-lg font-bold text-muted-foreground">VS</span>

            {/* Opponent */}
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="font-semibold text-sm">{opponent?.rep_name || 'Opponent'}</p>
                {progress && (
                  <p className="text-lg font-bold">
                    {metricConfig.format(
                      progress.participants.find(p => p.user_id === opponent?.user_id)?.current_value || 0
                    )}
                  </p>
                )}
              </div>
              <Avatar className="h-10 w-10 border-2 border-border">
                <AvatarImage src={opponent?.profile_photo_url || undefined} />
                <AvatarFallback className="bg-muted text-muted-foreground font-semibold">
                  {opponent?.rep_name?.charAt(0) || 'O'}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        )}

        {/* Group Battle */}
        {!is1v1 && progress?.teams && (
          <div className="flex items-center justify-between mb-3">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Team A ({progress.teams.a.members.length})</p>
              <p className="text-2xl font-bold text-primary">
                {metricConfig.format(progress.teams.a.total_value)}
              </p>
            </div>
            <span className="text-lg font-bold text-muted-foreground">VS</span>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Team B ({progress.teams.b.members.length})</p>
              <p className="text-2xl font-bold">
                {metricConfig.format(progress.teams.b.total_value)}
              </p>
            </div>
          </div>
        )}

        {/* Progress bar for active */}
        {challenge.status === 'active' && progress && is1v1 && (
          <div className="mb-3">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary rounded-full"
                initial={{ width: '50%' }}
                animate={{ 
                  width: `${Math.min(95, Math.max(5, 
                    ((progress.userProgress?.current_value || 0) / 
                    ((progress.userProgress?.current_value || 0) + (progress.leader?.current_value || 1))) * 100
                  ))}%` 
                }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        )}

        {/* Stakes & Timing */}
        <div className="flex items-center justify-between text-sm">
          <div>
            {challenge.stakes && (
              <p className="text-muted-foreground">
                <span className="font-medium">Stakes:</span> {challenge.stakes}
              </p>
            )}
          </div>
          <div className="text-right text-muted-foreground">
            <p className="text-xs">
              {challenge.status === 'pending' && `Starts ${formatChallengeDate(challenge.start_date)}`}
              {challenge.status === 'active' && progress?.timeRemaining}
              {challenge.status === 'completed' && `Ended ${formatChallengeDate(challenge.end_date)}`}
            </p>
          </div>
        </div>

        {/* Accept/Decline for pending challenges */}
        {needsMyResponse && (
          <div className="mt-4 pt-3 border-t border-border flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 gap-1"
              onClick={(e) => {
                e.stopPropagation();
                handleDecline();
              }}
              disabled={respondMutation.isPending}
            >
              <X className="h-4 w-4" />
              Decline
            </Button>
            <Button 
              size="sm" 
              className="flex-1 gap-1"
              onClick={(e) => {
                e.stopPropagation();
                handleAccept();
              }}
              disabled={respondMutation.isPending}
            >
              <Check className="h-4 w-4" />
              Accept
            </Button>
          </div>
        )}
      </motion.div>

      {/* Detail Sheet */}
      <ChallengeDetailSheet
        challenge={challenge}
        open={showDetail}
        onOpenChange={setShowDetail}
      />
    </>
  );
};
