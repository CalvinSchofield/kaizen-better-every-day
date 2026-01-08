import { useState, useEffect } from "react";
import { useConfetti } from "@/hooks/useConfetti";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMyActiveChallenges, Challenge, useRespondToChallenge } from "@/hooks/useChallenges";
import { useMyActiveIncentives, Incentive } from "@/hooks/useIncentives";
import { useChallengeProgress } from "@/hooks/useChallengeProgress";
import { useIncentiveProgress } from "@/hooks/useIncentiveProgress";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { CreateChallengeDrawer } from "@/components/leaderboard/CreateChallengeDrawer";
import { CreateIncentiveDrawer } from "@/components/leaderboard/CreateIncentiveDrawer";
import { Swords, Trophy, Gift, ChevronRight, Loader2, Check, X, Flame, Plus, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { hapticLight, hapticSuccess, hapticWarning } from "@/utils/haptics";
import { toast } from "sonner";

interface CompeteDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold",
          isWinning ? "bg-green-500/20 text-green-600" : isTied ? "bg-yellow-500/20 text-yellow-600" : "bg-red-500/20 text-red-600"
        )}>
          {myValue}
        </div>
        <span className="text-xs font-medium">You</span>
      </div>
      <Badge variant="secondary" className="text-[10px]">
        {metricLabels[challenge.metric] || challenge.metric}
      </Badge>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium">{opponentProgress?.rep_name?.split(' ')[0]}</span>
        <div className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold",
          !isWinning && !isTied ? "bg-green-500/20 text-green-600" : isTied ? "bg-yellow-500/20 text-yellow-600" : "bg-red-500/20 text-red-600"
        )}>
          {theirValue}
        </div>
      </div>
    </div>
  );
};

// Component to show incentive progress inline in drawer
const IncentiveProgressInDrawer = ({ incentive }: { incentive: Incentive }) => {
  const { data: progress, isLoading } = useIncentiveProgress(incentive);
  const { fireConfetti } = useConfetti();
  const [hasFiredConfetti, setHasFiredConfetti] = useState(false);
  const isGroupTotal = incentive.target_type === 'group_total';
  const targetValue = incentive.target_value || 0;

  const currentValue = isGroupTotal 
    ? (progress?.groupTotal || 0) 
    : (progress?.leader?.current_value || 0);
  const progressPercent = targetValue > 0 ? Math.min(100, (currentValue / targetValue) * 100) : 0;

  // Fire confetti when group incentive reaches 100%
  useEffect(() => {
    if (isGroupTotal && progressPercent >= 100 && !hasFiredConfetti && !isLoading) {
      fireConfetti({ variant: 'gold', duration: 4000 });
      setHasFiredConfetti(true);
    }
  }, [isGroupTotal, progressPercent, hasFiredConfetti, isLoading, fireConfetti]);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-1">
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground flex items-center gap-1">
          {isGroupTotal && <Users className="h-3 w-3" />}
          {isGroupTotal ? 'Group goal:' : 'First to'} {targetValue} {metricLabels[incentive.metric] || incentive.metric}
        </span>
        <Badge variant="outline" className="text-amber-600 border-amber-500/50 text-[10px]">
          🎁 {incentive.reward}
        </Badge>
      </div>
      {/* Always show progress bar for group incentives */}
      {isGroupTotal && (
        <div className="space-y-1">
          <Progress value={progressPercent} className="h-2" />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{currentValue.toFixed(1)} / {targetValue}</span>
            <span>{progressPercent.toFixed(0)}% complete</span>
          </div>
        </div>
      )}
    </div>
  );
};

export const CompeteDrawer = ({ open, onOpenChange }: CompeteDrawerProps) => {
  const navigate = useNavigate();
  const [showCreateChallenge, setShowCreateChallenge] = useState(false);
  const [showCreateIncentive, setShowCreateIncentive] = useState(false);
  
  const { data: challenges, isLoading: loadingChallenges } = useMyActiveChallenges();
  const { data: incentives, isLoading: loadingIncentives } = useMyActiveIncentives();
  const { data: teamAccess } = useTeamAccess();
  const respondMutation = useRespondToChallenge();

  // Get current user
  const { data: currentUser } = useQuery({
    queryKey: ['current-user-id'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id || null;
    },
    staleTime: Infinity,
  });

  const isLeader = teamAccess?.accessLevel && teamAccess.accessLevel !== 'none';

  const activeChallenges = challenges?.filter(c => c.status === 'active') || [];
  const pendingChallenges = challenges?.filter(c => c.status === 'pending') || [];
  const activeIncentives = incentives || [];

  // Separate pending into "sent by me" and "received"
  const pendingReceived = pendingChallenges.filter(c => {
    const myParticipant = c.participants?.find(p => p.user_id === currentUser);
    return myParticipant && myParticipant.accepted === null && c.created_by !== currentUser;
  });
  const pendingSent = pendingChallenges.filter(c => c.created_by === currentUser);

  const handleRespond = async (challengeId: string, accept: boolean) => {
    try {
      if (accept) {
        hapticSuccess();
      } else {
        hapticWarning();
      }
      await respondMutation.mutateAsync({ challengeId, accept });
      toast.success(accept ? 'Challenge accepted! 🔥' : 'Challenge declined');
    } catch (error: any) {
      toast.error(error.message || 'Failed to respond');
    }
  };

  const handleViewAll = () => {
    onOpenChange(false);
    navigate('/leaderboard');
  };

  const isLoading = loadingChallenges || loadingIncentives;
  const hasContent = activeChallenges.length > 0 || pendingChallenges.length > 0 || activeIncentives.length > 0;

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="pb-2">
            <div className="flex items-center justify-between">
              <DrawerTitle className="flex items-center gap-2">
                <Swords className="h-5 w-5 text-primary" />
                Compete
              </DrawerTitle>
              <Button variant="ghost" size="sm" onClick={handleViewAll}>
                View All
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </DrawerHeader>

          <ScrollArea className="flex-1 px-4 pb-4">
            <div className="space-y-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !hasContent ? (
                <div className="text-center py-8 space-y-3">
                  <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                    <Flame className="h-8 w-8 text-primary" />
                  </div>
                  <p className="text-muted-foreground">No active competitions</p>
                  <p className="text-sm text-muted-foreground">Challenge someone to ignite your competitive edge!</p>
                </div>
              ) : (
                <>
                  {/* Pending Received - Action Required */}
                  {pendingReceived.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-yellow-600">Action Required</p>
                      {pendingReceived.map(challenge => {
                        const opponent = challenge.participants?.find(p => p.role === 'captain_a');
                        return (
                          <div 
                            key={challenge.id}
                            className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30"
                          >
                            <div className="flex items-center gap-3 mb-3">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={opponent?.profile_photo_url || undefined} />
                                <AvatarFallback>{opponent?.rep_name?.charAt(0) || '?'}</AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                <p className="text-sm font-medium">{opponent?.rep_name} challenged you!</p>
                                <p className="text-xs text-muted-foreground">
                                  {metricLabels[challenge.metric]} • {challenge.type === '1v1' ? '1v1' : 'Team'}
                                </p>
                              </div>
                            </div>
                            {challenge.stakes && (
                              <p className="text-xs text-muted-foreground mb-3">🎯 {challenge.stakes}</p>
                            )}
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1"
                                onClick={() => handleRespond(challenge.id, false)}
                                disabled={respondMutation.isPending}
                              >
                                <X className="h-4 w-4 mr-1" />
                                Decline
                              </Button>
                              <Button
                                size="sm"
                                className="flex-1"
                                onClick={() => handleRespond(challenge.id, true)}
                                disabled={respondMutation.isPending}
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Accept
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Active Challenges */}
                  {activeChallenges.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-primary">Active Challenges</p>
                      {activeChallenges.map(challenge => {
                        const me = challenge.participants?.find(p => p.user_id === currentUser);
                        return (
                          <div 
                            key={challenge.id}
                            onClick={handleViewAll}
                            className="p-3 rounded-xl bg-background border cursor-pointer hover:border-primary/50 transition-colors"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <Swords className="h-4 w-4 text-primary" />
                              <span className="text-xs font-medium">{challenge.type === '1v1' ? '1v1' : 'Team'}</span>
                              {challenge.stakes && (
                                <span className="text-[10px] text-muted-foreground ml-auto">🎯 {challenge.stakes}</span>
                              )}
                            </div>
                            <ChallengeProgressItem
                              challenge={challenge}
                              myUserId={me?.user_id || currentUser || ''}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Pending Sent */}
                  {pendingSent.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Waiting for Response</p>
                      {pendingSent.map(challenge => {
                        const opponent = challenge.participants?.find(p => p.role === 'captain_b');
                        return (
                          <div 
                            key={challenge.id}
                            className="p-3 rounded-xl bg-muted/50 border border-border"
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={opponent?.profile_photo_url || undefined} />
                                <AvatarFallback>{opponent?.rep_name?.charAt(0) || '?'}</AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                <p className="text-sm font-medium">Challenged {opponent?.rep_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {metricLabels[challenge.metric]} • Waiting...
                                </p>
                              </div>
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Active Incentives */}
                  {activeIncentives.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-amber-600">Active Incentives</p>
                      {activeIncentives.map(incentive => (
                        <div 
                          key={incentive.id}
                          onClick={handleViewAll}
                          className="p-3 rounded-xl bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/30 cursor-pointer hover:border-amber-500/50 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Trophy className="h-4 w-4 text-amber-500" />
                              <span className="text-sm font-semibold">{incentive.title}</span>
                            </div>
                            <Gift className="h-4 w-4 text-amber-600" />
                          </div>
                          <IncentiveProgressInDrawer incentive={incentive} />
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Quick Actions */}
              <div className="pt-2 space-y-2">
                <Button
                  onClick={() => { hapticLight(); setShowCreateChallenge(true); }}
                  className="w-full"
                  size="lg"
                >
                  <Swords className="h-4 w-4 mr-2" />
                  Challenge Someone
                </Button>
                
                {isLeader && (
                  <Button
                    onClick={() => { hapticLight(); setShowCreateIncentive(true); }}
                    variant="outline"
                    className="w-full"
                    size="lg"
                  >
                    <Trophy className="h-4 w-4 mr-2" />
                    Create Incentive
                  </Button>
                )}
              </div>
            </div>
          </ScrollArea>
        </DrawerContent>
      </Drawer>

      <CreateChallengeDrawer 
        open={showCreateChallenge} 
        onOpenChange={setShowCreateChallenge} 
      />
      
      <CreateIncentiveDrawer 
        open={showCreateIncentive} 
        onOpenChange={setShowCreateIncentive} 
      />
    </>
  );
};