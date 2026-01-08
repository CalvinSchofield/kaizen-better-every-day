import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useMyActiveChallenges, Challenge } from "@/hooks/useChallenges";
import { useMyActiveIncentives, Incentive } from "@/hooks/useIncentives";
import { useChallengeProgress } from "@/hooks/useChallengeProgress";
import { useIncentiveProgress } from "@/hooks/useIncentiveProgress";
import { CompeteDrawer } from "@/components/CompeteDrawer";
import { Swords, Trophy, ChevronRight, Flame, Gift, Loader2, Plus, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticLight } from "@/utils/haptics";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

const metricLabels: Record<string, string> = {
  fp_plus: 'FP+',
  prmr: 'PRMR',
  transitions: 'Trans',
  doors_knocked: 'Doors',
};

interface ChallengeProgressItemProps {
  challenge: Challenge;
  myUserId: string;
}

const ChallengeProgressItem = ({ challenge, myUserId }: ChallengeProgressItemProps) => {
  const { data: progress, isLoading } = useChallengeProgress(challenge);
  
  if (isLoading || !progress) {
    return (
      <div className="flex items-center justify-center py-2">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const myProgress = progress.participants.find(p => p.user_id === myUserId);
  const opponentProgress = progress.participants.find(p => p.user_id !== myUserId);
  
  const myValue = myProgress?.current_value || 0;
  const theirValue = opponentProgress?.current_value || 0;
  const isWinning = myValue > theirValue;
  const isTied = myValue === theirValue;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
            isWinning ? "bg-green-500/20 text-green-600" : isTied ? "bg-yellow-500/20 text-yellow-600" : "bg-red-500/20 text-red-600"
          )}>
            {myValue}
          </div>
          <span className="text-sm font-medium">You</span>
        </div>
        <Badge variant="secondary" className="text-xs">
          {metricLabels[challenge.metric] || challenge.metric}
        </Badge>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{opponentProgress?.rep_name?.split(' ')[0]}</span>
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
            !isWinning && !isTied ? "bg-green-500/20 text-green-600" : isTied ? "bg-yellow-500/20 text-yellow-600" : "bg-red-500/20 text-red-600"
          )}>
            {theirValue}
          </div>
        </div>
      </div>
      {challenge.stakes && (
        <p className="text-xs text-muted-foreground text-center">🎯 {challenge.stakes}</p>
      )}
    </div>
  );
};

// Component to show incentive progress inline
const IncentiveProgressItem = ({ incentive }: { incentive: Incentive }) => {
  const { data: progress, isLoading } = useIncentiveProgress(incentive);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-1">
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isGroupIncentive = incentive.target_type === 'group_total';
  const targetValue = incentive.target_value || 0;
  const currentValue = isGroupIncentive ? (progress?.groupTotal || 0) : (progress?.leader?.current_value || 0);
  const progressPercent = targetValue > 0 ? Math.min(100, (currentValue / targetValue) * 100) : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground flex items-center gap-1">
          {isGroupIncentive && <Users className="h-3 w-3" />}
          {isGroupIncentive ? 'Group goal:' : 'First to'} {targetValue} {metricLabels[incentive.metric] || incentive.metric}
        </span>
        <Badge variant="outline" className="text-amber-600 border-amber-500/50 text-xs py-0">
          🎁 {incentive.reward}
        </Badge>
      </div>
      {isGroupIncentive && (
        <div className="space-y-1">
          <Progress value={progressPercent} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{currentValue.toFixed(1)} / {targetValue}</span>
            <span>{progressPercent.toFixed(0)}% complete</span>
          </div>
        </div>
      )}
    </div>
  );
};

export const ActiveChallengesCard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [competeDrawerOpen, setCompeteDrawerOpen] = useState(false);
  const {
    data: challenges,
    isLoading: loadingChallenges,
    isError: challengesError,
  } = useMyActiveChallenges();
  const {
    data: incentives,
    isLoading: loadingIncentives,
    isError: incentivesError,
  } = useMyActiveIncentives();

  // Subscribe to realtime updates for incentives and daily entries
  useEffect(() => {
    const channel = supabase
      .channel('active-competitions-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_entries' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['my-active-incentives'], refetchType: 'all' });
          queryClient.invalidateQueries({ queryKey: ['incentive-progress'], refetchType: 'all' });
          queryClient.invalidateQueries({ queryKey: ['challenge-progress'], refetchType: 'all' });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'incentives' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['my-active-incentives'] });
          queryClient.invalidateQueries({ queryKey: ['incentives'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const activeChallenges = challenges?.filter((c) => c.status === "active") || [];
  const pendingChallenges = challenges?.filter((c) => c.status === "pending") || [];
  const activeIncentives = incentives || [];

  const hasContent =
    activeChallenges.length > 0 ||
    pendingChallenges.length > 0 ||
    activeIncentives.length > 0;

  const pendingActionCount = pendingChallenges.filter((c) => {
    const me = c.participants?.find(
      (p) => p.accepted === null && p.role === "captain_b"
    );
    return !!me;
  }).length;

  if (loadingChallenges || loadingIncentives) {
    return (
      <Card className="mb-6 border-muted">
        <CardContent className="py-6">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // If the backend call errors (or times out), don't block the Home feed.
  if (challengesError || incentivesError) return null;

  const handleCardClick = () => {
    hapticLight();
    setCompeteDrawerOpen(true);
  };

  const handleCreateChallenge = (e: React.MouseEvent) => {
    e.stopPropagation();
    hapticLight();
    navigate('/compete?create=challenge');
  };

  // Show CTA when no active competitions
  if (!hasContent) {
    return (
      <>
        <Card 
          className="mb-6 border-dashed border-muted-foreground/30 bg-muted/30 cursor-pointer hover:border-primary/40 transition-colors"
          onClick={handleCardClick}
        >
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Swords className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">No active competitions</p>
                  <p className="text-xs text-muted-foreground">Challenge a teammate!</p>
                </div>
              </div>
              <Button 
                size="sm" 
                onClick={handleCreateChallenge}
                className="gap-1"
              >
                <Plus className="h-4 w-4" />
                Challenge
              </Button>
            </div>
          </CardContent>
        </Card>
        <CompeteDrawer open={competeDrawerOpen} onOpenChange={setCompeteDrawerOpen} />
      </>
    );
  }

  return (
    <>
      <Card 
        className="mb-6 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent cursor-pointer hover:border-primary/40 transition-colors"
        onClick={handleCardClick}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Flame className="h-5 w-5 text-orange-500" />
              Active Competitions
              {pendingActionCount > 0 && (
                <Badge variant="destructive" className="h-5 min-w-5 flex items-center justify-center p-0 text-xs">
                  {pendingActionCount}
                </Badge>
              )}
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={(e) => { e.stopPropagation(); handleCardClick(); }}
              className="text-primary"
            >
              View All
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Active Challenges */}
          {activeChallenges.slice(0, 2).map(challenge => {
            const me = challenge.participants?.find(p => p.role === 'captain_a');
            
            return (
              <div 
                key={challenge.id}
                className="p-3 rounded-lg bg-background/80 border"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Swords className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">1v1 Challenge</span>
                </div>
                <ChallengeProgressItem
                  challenge={challenge}
                  myUserId={me?.user_id || ''}
                />
              </div>
            );
          })}

          {/* Pending Challenges */}
          {pendingChallenges.slice(0, 1).map(challenge => {
            const opponent = challenge.participants?.find(p => p.role === 'captain_b');
            const isFromMe = challenge.participants?.find(p => p.role === 'captain_a')?.user_id === challenge.created_by;
            
            return (
              <div 
                key={challenge.id}
                className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Swords className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm font-medium">
                      {isFromMe ? 'Waiting for response...' : 'Challenge received!'}
                    </span>
                  </div>
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={opponent?.profile_photo_url || undefined} />
                    <AvatarFallback className="text-xs">
                      {opponent?.rep_name?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {metricLabels[challenge.metric]} vs {opponent?.rep_name}
                </p>
              </div>
            );
          })}

          {/* Active Incentives */}
          {activeIncentives.slice(0, 2).map(incentive => (
            <div 
              key={incentive.id}
              className="p-3 rounded-lg bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/30"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-semibold">{incentive.title}</span>
                </div>
                <Gift className="h-4 w-4 text-amber-600" />
              </div>
              <IncentiveProgressItem incentive={incentive} />
            </div>
          ))}

          {/* Show more indicator */}
          {(activeChallenges.length > 2 || activeIncentives.length > 2 || pendingChallenges.length > 1) && (
            <p className="text-xs text-center text-muted-foreground">
              +{Math.max(0, activeChallenges.length - 2) + Math.max(0, activeIncentives.length - 2) + Math.max(0, pendingChallenges.length - 1)} more
            </p>
          )}
        </CardContent>
      </Card>
      
      <CompeteDrawer open={competeDrawerOpen} onOpenChange={setCompeteDrawerOpen} />
    </>
  );
};