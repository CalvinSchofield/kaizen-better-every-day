import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMyActiveChallenges, Challenge, useRespondToChallenge } from "@/hooks/useChallenges";
import { useMyActiveIncentives } from "@/hooks/useIncentives";
import { useChallengeProgress } from "@/hooks/useChallengeProgress";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { CreateChallengeDrawer } from "@/components/leaderboard/CreateChallengeDrawer";
import { CreateIncentiveDrawer } from "@/components/leaderboard/CreateIncentiveDrawer";
import { ChallengeScoreSlider } from "@/components/competitions/ChallengeScoreSlider";
import { CompetitionHistorySection } from "@/components/competitions/CompetitionHistorySection";
import { WinStreakBadge } from "@/components/competitions/WinStreakBadge";
import { Swords, Trophy, Gift, Loader2, Check, X, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { hapticLight, hapticSuccess, hapticWarning } from "@/utils/haptics";
import { toast } from "sonner";
import { useSalesRealtime } from "@/hooks/useSalesRealtime";
import { getInitials, getCleanName, getCleanFirstName } from "@/utils/nameUtils";

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

  const isGroupChallenge = challenge.type === 'group';

  if (isGroupChallenge) {
    const teamA = progress.participants.filter(p => p.team === 'a');
    const teamB = progress.participants.filter(p => p.team === 'b');
    const teamATotal = teamA.reduce((sum, p) => sum + (p.current_value || 0), 0);
    const teamBTotal = teamB.reduce((sum, p) => sum + (p.current_value || 0), 0);

    return (
      <ChallengeScoreSlider
        isTeamBattle
        redTotal={teamATotal}
        blueTotal={teamBTotal}
        variant="compact"
      />
    );
  }

  // 1v1 challenge
  const myProgress = progress.participants.find(p => p.user_id === myUserId);
  const opponentProgress = progress.participants.find(p => p.user_id !== myUserId);
  const myValue = myProgress?.current_value || 0;
  const theirValue = opponentProgress?.current_value || 0;

  return (
    <ChallengeScoreSlider
      myValue={myValue}
      theirValue={theirValue}
      variant="compact"
      myLabel="You"
      theirLabel={getCleanFirstName(opponentProgress?.rep_name)}
    />
  );
};

const CompeteSkeleton = () => (
  <div className="p-4 space-y-4">
    <div className="flex gap-2">
      <Skeleton className="h-11 flex-1 rounded-lg" />
      <Skeleton className="h-11 w-36 rounded-lg" />
    </div>
    <Skeleton className="h-24 rounded-xl" />
    <Skeleton className="h-32 rounded-xl" />
    <Skeleton className="h-24 rounded-xl" />
  </div>
);

const Compete = () => {
  const navigate = useNavigate();
  const [showCreateChallenge, setShowCreateChallenge] = useState(false);
  const [showCreateIncentive, setShowCreateIncentive] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  
  const { data: challenges, isLoading: loadingChallenges } = useMyActiveChallenges();
  const { data: incentives, isLoading: loadingIncentives } = useMyActiveIncentives();
  const { data: teamAccess } = useTeamAccess();
  const respondMutation = useRespondToChallenge();

  // Subscribe to realtime sales updates for immediate competition data sync
  useSalesRealtime();

  // Get current user
  const { data: currentUser, isLoading: loadingUser } = useQuery({
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

  // Only show loading skeleton if we have NO cached data at all
  // If we have any cached challenges/incentives, show them instantly
  const hasCachedData = !!challenges || !!incentives;
  const isInitialLoading = (loadingChallenges || loadingIncentives || loadingUser) && !hasCachedData;
  const hasActiveContent = activeChallenges.length > 0 || pendingChallenges.length > 0 || activeIncentives.length > 0;

  if (isInitialLoading) {
    return (
      <Layout>
        <CompeteSkeleton />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 space-y-4 pb-24">
        {/* Header with actions */}
        <div className="flex items-center gap-2">
          <Button
            onClick={() => { hapticLight(); setShowCreateChallenge(true); }}
            className="flex-1"
          >
            <Swords className="h-4 w-4 mr-2" />
            New Challenge
          </Button>
          
          {isLeader && (
            <Button
              onClick={() => { hapticLight(); setShowCreateIncentive(true); }}
              variant="outline"
            >
              <Trophy className="h-4 w-4 mr-2" />
              Incentive
            </Button>
          )}
        </div>

        {/* Win Streak Badge */}
        <WinStreakBadge />

        {/* Tabs for Active vs History */}
        <Tabs value={activeTab} onValueChange={(v) => { hapticLight(); setActiveTab(v as 'active' | 'history'); }}>
          <TabsList className="w-full">
            <TabsTrigger value="active" className="flex-1">
              <Swords className="h-4 w-4 mr-2" />
              Active
              {(activeChallenges.length + pendingChallenges.length + activeIncentives.length) > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 min-w-5 flex items-center justify-center p-0 text-xs">
                  {activeChallenges.length + pendingChallenges.length + activeIncentives.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-1">
              <Trophy className="h-4 w-4 mr-2" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4 space-y-6">
            {/* Empty State */}
            {!hasActiveContent && (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center space-y-4">
                  <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                    <Flame className="h-10 w-10 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-lg">No active competitions</p>
                    <p className="text-sm text-muted-foreground">Challenge someone to ignite your competitive edge!</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Pending Received - Action Required */}
            {pendingReceived.length > 0 && (
              <Card className="border-warning/50 bg-warning/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-warning">
                    <Badge variant="destructive" className="h-5 min-w-5 flex items-center justify-center p-0 text-xs">
                      {pendingReceived.length}
                    </Badge>
                    Action Required
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pendingReceived.map(challenge => {
                    const opponent = challenge.participants?.find(p => p.role === 'captain_a');
                    return (
                      <div 
                        key={challenge.id}
                        className="p-4 rounded-xl bg-background border"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={opponent?.profile_photo_url || undefined} />
                            <AvatarFallback>{getInitials(opponent?.rep_name)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-medium">{getCleanName(opponent?.rep_name)} challenged you!</p>
                            <p className="text-sm text-muted-foreground">
                              {metricLabels[challenge.metric]} • {challenge.type === '1v1' ? '1v1 Battle' : '🔴 Red vs 🔵 Blue'}
                            </p>
                          </div>
                        </div>
                        {challenge.stakes && (
                          <p className="text-sm text-muted-foreground mb-3 bg-muted/50 p-2 rounded-lg">🎯 {challenge.stakes}</p>
                        )}
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => handleRespond(challenge.id, false)}
                            disabled={respondMutation.isPending}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Decline
                          </Button>
                          <Button
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
                </CardContent>
              </Card>
            )}

            {/* Active Challenges */}
            {activeChallenges.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Swords className="h-5 w-5 text-primary" />
                    Active Challenges
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {activeChallenges.map(challenge => {
                    const me = challenge.participants?.find(p => p.user_id === currentUser);
                    const opponent = challenge.participants?.find(p => p.user_id !== currentUser);
                    return (
                      <div 
                        key={challenge.id}
                        className="p-4 rounded-xl border bg-gradient-to-br from-primary/5 to-transparent"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {challenge.type === '1v1' ? '1v1' : '🔴 vs 🔵'}
                            </Badge>
                            <span className="text-xs text-muted-foreground">vs {getCleanFirstName(opponent?.rep_name)}</span>
                          </div>
                          {challenge.stakes && (
                            <span className="text-xs text-muted-foreground">🎯 Stakes</span>
                          )}
                        </div>
                        <ChallengeProgressItem
                          challenge={challenge}
                          myUserId={me?.user_id || currentUser || ''}
                        />
                        {challenge.stakes && (
                          <p className="text-xs text-muted-foreground mt-2 text-center">{challenge.stakes}</p>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Pending Sent */}
            {pendingSent.length > 0 && (
              <Card className="border-muted">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Waiting for Response
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pendingSent.map(challenge => {
                    const opponent = challenge.participants?.find(p => p.role === 'captain_b');
                    return (
                      <div 
                        key={challenge.id}
                        className="p-4 rounded-xl bg-muted/30 border"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={opponent?.profile_photo_url || undefined} />
                            <AvatarFallback>{getInitials(opponent?.rep_name)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-medium">Challenged {getCleanName(opponent?.rep_name)}</p>
                            <p className="text-sm text-muted-foreground">
                              {metricLabels[challenge.metric]} • Waiting for response...
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Active Incentives */}
            {activeIncentives.length > 0 && (
              <Card className="border-warning/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-warning">
                    <Trophy className="h-5 w-5" />
                    Active Incentives
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {activeIncentives.map(incentive => (
                    <div 
                      key={incentive.id}
                      className="p-4 rounded-xl bg-gradient-to-r from-warning/10 to-warning/5 border border-warning/30"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold">{incentive.title}</span>
                        <Gift className="h-5 w-5 text-warning" />
                      </div>
                      {incentive.description && (
                        <p className="text-sm text-muted-foreground mb-2">{incentive.description}</p>
                      )}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          First to {incentive.target_value} {metricLabels[incentive.metric] || incentive.metric}
                        </span>
                        <Badge variant="outline" className="text-warning border-warning/50">
                          🎁 {incentive.reward}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <CompetitionHistorySection />
          </TabsContent>
        </Tabs>
      </div>

      <CreateChallengeDrawer 
        open={showCreateChallenge} 
        onOpenChange={setShowCreateChallenge} 
      />
      
      <CreateIncentiveDrawer 
        open={showCreateIncentive} 
        onOpenChange={setShowCreateIncentive} 
      />
    </Layout>
  );
};

export default Compete;
