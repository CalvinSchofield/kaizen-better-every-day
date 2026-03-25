import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { ChallengeDetailSheet } from "@/components/leaderboard/ChallengeDetailSheet";
import { IncentiveDetailSheet } from "@/components/leaderboard/IncentiveDetailSheet";
import { CompetitionHistorySection } from "@/components/competitions/CompetitionHistorySection";
import { WinStreakBadge } from "@/components/competitions/WinStreakBadge";
import { Swords, Trophy, Gift, Loader2, Check, X, Flame, Clock, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { getSessionSafe } from "@/utils/authSession";
import { useQuery } from "@tanstack/react-query";
import { hapticLight, hapticSuccess, hapticWarning } from "@/utils/haptics";
import { toast } from "sonner";
import { useSalesRealtime } from "@/hooks/useSalesRealtime";
import { getInitials, getCleanName, getCleanFirstName } from "@/utils/nameUtils";
import { metricConfig } from "@/utils/challengeMetricConfig";

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

// ESPN-style active challenge card
const ActiveChallengeCard = ({ challenge, currentUser, onTap }: { challenge: Challenge; currentUser: string; onTap: () => void }) => {
  const { data: progress, isLoading } = useChallengeProgress(challenge);
  const config = metricConfig[challenge.metric];
  const is1v1 = challenge.type === '1v1';
  
  const me = challenge.participants?.find(p => p.user_id === currentUser);
  const opponent = is1v1 ? challenge.participants?.find(p => p.user_id !== currentUser) : null;

  const myValue = progress?.participants.find(p => p.user_id === currentUser)?.current_value || 0;
  const opponentValue = is1v1 ? progress?.participants.find(p => p.user_id !== currentUser)?.current_value || 0 : 0;

  // Team battle values
  const teamA = progress?.participants.filter(p => p.team === 'a') || [];
  const teamB = progress?.participants.filter(p => p.team === 'b') || [];
  const teamATotal = teamA.reduce((sum, p) => sum + (p.current_value || 0), 0);
  const teamBTotal = teamB.reduce((sum, p) => sum + (p.current_value || 0), 0);

  return (
    <button
      onClick={() => { hapticLight(); onTap(); }}
      className="w-full p-4 rounded-xl border bg-gradient-to-br from-primary/5 to-transparent text-left transition-all active:scale-[0.97]"
    >
      {is1v1 && opponent ? (
        <div className="space-y-3">
          {/* ESPN-style matchup header */}
          <div className="flex items-center justify-between">
            {/* Left: me */}
            <div className="flex items-center gap-2.5 flex-1">
              <Avatar className="h-11 w-11 border-2 border-primary/50">
                <AvatarImage src={me?.profile_photo_url} />
                <AvatarFallback className="text-sm font-bold">{getInitials(me?.rep_name)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-sm">{getCleanFirstName(me?.rep_name)}</p>
                <p className="text-xl font-bold text-primary">
                  {isLoading ? '—' : myValue.toFixed(1)}
                </p>
              </div>
            </div>

            {/* VS center */}
            <div className="flex flex-col items-center px-2 shrink-0">
              <span className="text-xs font-bold text-muted-foreground tracking-wider">VS</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 mt-0.5">
                {config.icon} {config.label}
              </Badge>
            </div>

            {/* Right: opponent */}
            <div className="flex items-center gap-2.5 flex-1 justify-end">
              <div className="text-right">
                <p className="font-semibold text-sm">{getCleanFirstName(opponent.rep_name)}</p>
                <p className="text-xl font-bold text-foreground">
                  {isLoading ? '—' : opponentValue.toFixed(1)}
                </p>
              </div>
              <Avatar className="h-11 w-11 border-2 border-border">
                <AvatarImage src={opponent.profile_photo_url} />
                <AvatarFallback className="text-sm font-bold">{getInitials(opponent.rep_name)}</AvatarFallback>
              </Avatar>
            </div>
          </div>

          {/* Score slider */}
          {!isLoading && progress && (
            <ChallengeScoreSlider
              myValue={myValue}
              theirValue={opponentValue}
              variant="compact"
              myLabel="You"
              theirLabel={getCleanFirstName(opponent.rep_name)}
            />
          )}

          {/* Bottom row: time + stakes */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            {progress && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {progress.timeRemaining}
              </span>
            )}
            {challenge.stakes && (
              <span className="truncate ml-2">🎯 {challenge.stakes}</span>
            )}
          </div>
        </div>
      ) : (
        /* Team battle card */
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Badge variant="secondary" className="text-xs">
              🔴 vs 🔵 Team Battle
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              {config.icon} {config.label}
            </Badge>
          </div>

          {/* Team scores */}
          <div className="flex items-center justify-between px-2">
            <div className="text-center">
              <p className="text-sm font-bold text-red-600">🔴 RED</p>
              <p className="text-xl font-bold text-red-600">{isLoading ? '—' : teamATotal.toFixed(1)}</p>
            </div>
            <span className="text-xs font-bold text-muted-foreground">VS</span>
            <div className="text-center">
              <p className="text-sm font-bold text-blue-600">🔵 BLUE</p>
              <p className="text-xl font-bold text-blue-600">{isLoading ? '—' : teamBTotal.toFixed(1)}</p>
            </div>
          </div>

          {!isLoading && progress && (
            <ChallengeScoreSlider
              isTeamBattle
              redTotal={teamATotal}
              blueTotal={teamBTotal}
              variant="compact"
            />
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            {progress && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {progress.timeRemaining}
              </span>
            )}
            {challenge.stakes && (
              <span className="truncate ml-2">🎯 {challenge.stakes}</span>
            )}
          </div>
        </div>
      )}
    </button>
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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [showCreateChallenge, setShowCreateChallenge] = useState(false);
  const [showCreateIncentive, setShowCreateIncentive] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [selectedIncentive, setSelectedIncentive] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>(
    searchParams.get('tab') === 'history' ? 'history' : 'active'
  );
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  
  const { data: challenges, isLoading: loadingChallenges } = useMyActiveChallenges();
  const { data: incentives, isLoading: loadingIncentives } = useMyActiveIncentives();
  const { data: teamAccess } = useTeamAccess();
  const respondMutation = useRespondToChallenge();

  useSalesRealtime();

  const { data: currentUser, isLoading: loadingUser } = useQuery({
    queryKey: ['current-user-id'],
    queryFn: async () => {
      const { user } = await getSessionSafe();
      return user?.id || null;
    },
    staleTime: Infinity,
  });

  const isLeader = teamAccess?.accessLevel && teamAccess.accessLevel !== 'none';

  const activeChallenges = challenges?.filter(c => c.status === 'active') || [];
  const pendingChallenges = challenges?.filter(c => c.status === 'pending') || [];
  const activeIncentives = incentives || [];

  const pendingReceived = pendingChallenges.filter(c => {
    const myParticipant = c.participants?.find(p => p.user_id === currentUser);
    return myParticipant && myParticipant.accepted === null && c.created_by !== currentUser;
  });
  const pendingSent = pendingChallenges.filter(c => c.created_by === currentUser);

  const handleRespond = async (challengeId: string, accept: boolean) => {
    try {
      if (accept) hapticSuccess(); else hapticWarning();
      await respondMutation.mutateAsync({ challengeId, accept });
      toast.success(accept ? 'Challenge accepted! 🔥' : 'Challenge declined');
    } catch (error: any) {
      toast.error(error.message || 'Failed to respond');
    }
  };

  const hasCachedData = !!challenges || !!incentives;
  const isInitialLoading = !loadingTimedOut && (loadingChallenges || loadingIncentives || loadingUser) && !hasCachedData;
  const hasActiveContent = activeChallenges.length > 0 || pendingChallenges.length > 0 || activeIncentives.length > 0;

  // Safety timeout: force-render after 5s to prevent infinite skeleton
  useEffect(() => {
    if (!isInitialLoading) return;
    const timer = setTimeout(() => setLoadingTimedOut(true), 5000);
    return () => clearTimeout(timer);
  }, [isInitialLoading]);

  if (isInitialLoading) {
    return <Layout><CompeteSkeleton /></Layout>;
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

        <WinStreakBadge />

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

            {/* Pending Received */}
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

            {/* Active Challenges - ESPN Style */}
            {activeChallenges.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Swords className="h-5 w-5 text-primary" />
                    Active Challenges
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {activeChallenges.map(challenge => (
                    <ActiveChallengeCard
                      key={challenge.id}
                      challenge={challenge}
                      currentUser={currentUser || ''}
                      onTap={() => setSelectedChallenge(challenge)}
                    />
                  ))}
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

            {/* Active Incentives - ESPN Style */}
            {activeIncentives.length > 0 && (
              <Card className="border-warning/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-warning">
                    <Trophy className="h-5 w-5" />
                    Active Incentives
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {activeIncentives.map(incentive => {
                    const eligibleReps = incentive.eligible_reps || [];
                    const topReps = eligibleReps.slice(0, 3);
                    const remainingCount = Math.max(0, (incentive.eligible_count || 0) - 3);

                    return (
                      <button
                        key={incentive.id}
                        onClick={() => { hapticLight(); setSelectedIncentive(incentive); }}
                        className="w-full p-4 rounded-xl bg-gradient-to-r from-warning/10 to-warning/5 border border-warning/30 text-left transition-all active:scale-[0.97]"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold">{incentive.title}</span>
                          <Badge variant="outline" className="text-warning border-warning/50 text-xs">
                            🎁 {incentive.reward}
                          </Badge>
                        </div>

                        {/* Participant avatars row */}
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex -space-x-2">
                            {topReps.map(rep => (
                              <Avatar key={rep.user_id} className="h-7 w-7 border-2 border-background">
                                <AvatarImage src={rep.profile_photo_url} />
                                <AvatarFallback className="text-[9px]">{getInitials(rep.rep_name)}</AvatarFallback>
                              </Avatar>
                            ))}
                            {remainingCount > 0 && (
                              <div className="h-7 w-7 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                                <span className="text-[9px] font-bold text-muted-foreground">+{remainingCount}</span>
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground ml-1">
                            {incentive.eligible_count} competing
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Target className="h-3 w-3" />
                            {incentive.target_type === 'anyone_who' ? 'Anyone who gets' : 'First to'} {incentive.target_value} {metricLabels[incentive.metric] || incentive.metric}
                          </span>
                        </div>
                      </button>
                    );
                  })}
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

      {/* Detail sheets */}
      {selectedChallenge && (
        <ChallengeDetailSheet
          challenge={selectedChallenge}
          open={!!selectedChallenge}
          onOpenChange={(open) => !open && setSelectedChallenge(null)}
        />
      )}
      {selectedIncentive && (
        <IncentiveDetailSheet
          incentive={selectedIncentive}
          open={!!selectedIncentive}
          onOpenChange={(open) => !open && setSelectedIncentive(null)}
        />
      )}
    </Layout>
  );
};

export default Compete;
