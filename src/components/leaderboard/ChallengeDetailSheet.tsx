import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Challenge, useRespondToChallenge, useVoidChallenge } from "@/hooks/useChallenges";
import { useChallengeProgress } from "@/hooks/useChallengeProgress";
import { useChallengeEditProposals } from "@/hooks/useChallengeEdits";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, Eye, EyeOff, Pencil, Check, Clock, X, Swords, Users, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EditChallengeDrawer } from "./EditChallengeDrawer";
import { ChallengeEditApprovalCard } from "./ChallengeEditApprovalCard";
import { getInitials } from "@/utils/nameUtils";
import { toast } from "sonner";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { useConfetti } from "@/hooks/useConfetti";

interface ChallengeDetailSheetProps {
  challenge: Challenge;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Helper to get friendly role label
const getRoleLabel = (role: string, team?: string | null) => {
  if (role === 'captain_a') return 'Team A Captain';
  if (role === 'captain_b') return 'Team B Captain';
  if (team === 'a') return 'Team A';
  if (team === 'b') return 'Team B';
  return 'Participant';
};

export const ChallengeDetailSheet = ({ challenge, open, onOpenChange }: ChallengeDetailSheetProps) => {
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const { data: progress } = useChallengeProgress(
    (challenge.status === 'active' || challenge.status === 'pending') ? challenge : null,
    { includePending: challenge.status === 'pending' }
  );
  const { data: editProposals } = useChallengeEditProposals(challenge.id);
  const respondMutation = useRespondToChallenge();
  const voidMutation = useVoidChallenge();
  const { fireConfetti } = useConfetti();

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const isParticipant = challenge.participants?.some(p => p.user_id === currentUser?.id);
  const myParticipation = challenge.participants?.find(p => p.user_id === currentUser?.id);
  const isCreator = currentUser?.id === challenge.created_by;
  const canEdit = isParticipant && (challenge.status === 'active' || challenge.status === 'pending');
  const hasPendingProposals = editProposals && editProposals.length > 0;
  const is1v1 = challenge.type === '1v1';
  const isTeamBattle = challenge.type === 'group';

  // Check if current user needs to respond (hasn't accepted or declined yet)
  // Note: Creator is auto-accepted so their `accepted` is always true, never null
  const needsMyResponse = challenge.status === 'pending' && 
    myParticipation && 
    myParticipation.accepted === null;

  // Check if user previously declined but can change their response (team battles only)
  const canChangeResponse = challenge.status === 'pending' && 
    myParticipation && 
    myParticipation.accepted === false && 
    isTeamBattle;

  // Creator can void pending or active challenges (not completed ones)
  const canVoid = isCreator && (challenge.status === 'pending' || challenge.status === 'active');

  // Separate participants by team
  const teamA = challenge.participants?.filter(p => p.role === 'captain_a' || p.team === 'a') || [];
  const teamB = challenge.participants?.filter(p => p.role === 'captain_b' || p.team === 'b') || [];

  const handleAccept = async () => {
    try {
      Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
      await respondMutation.mutateAsync({ challengeId: challenge.id, accept: true });
      fireConfetti({ variant: 'subtle' });
      toast.success('Challenge accepted! Game on! 🔥');
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to accept challenge');
    }
  };

  const handleDecline = async () => {
    try {
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
      await respondMutation.mutateAsync({ challengeId: challenge.id, accept: false });
      toast.success('Challenge declined');
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to decline challenge');
    }
  };

  const handleVoid = async () => {
    try {
      Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
      await voidMutation.mutateAsync(challenge.id);
      toast.success('Challenge voided');
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to void challenge');
    }
  };

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="text-center relative">
            <DrawerTitle className="flex items-center justify-center gap-2">
              {is1v1 ? <Swords className="h-5 w-5 text-primary" /> : <Users className="h-5 w-5 text-primary" />}
              {is1v1 ? '1v1 Challenge' : 'Team Battle'}
            </DrawerTitle>
            {canEdit && !hasPendingProposals && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 top-1/2 -translate-y-1/2"
                onClick={() => setShowEditDrawer(true)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </DrawerHeader>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="p-4 space-y-5 overflow-y-auto"
          >
            {/* Pending Edit Proposals */}
            {hasPendingProposals && (
              <div className="space-y-3">
                {editProposals.map(proposal => (
                  <ChallengeEditApprovalCard
                    key={proposal.id}
                    proposal={proposal}
                    currentChallengeData={{
                      stakes: challenge.stakes,
                      end_date: challenge.end_date,
                    }}
                  />
                ))}
              </div>
            )}

            {/* Status */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="text-center"
            >
              <span className={cn(
                "inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold",
                challenge.status === 'active' && "bg-green-500/20 text-green-600",
                challenge.status === 'pending' && "bg-amber-500/20 text-amber-600",
                challenge.status === 'completed' && "bg-muted text-muted-foreground"
              )}>
                {challenge.status === 'active' && (
                  <motion.span 
                    className="h-2 w-2 rounded-full bg-green-500"
                    animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                  />
                )}
                {challenge.status === 'pending' && <Clock className="h-3.5 w-3.5" />}
                {challenge.status === 'completed' && <Trophy className="h-3.5 w-3.5" />}
                {challenge.status.toUpperCase()}
              </span>
            </motion.div>

            {/* Accept/Decline CTA for invitees */}
            {needsMyResponse && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-primary/10 to-amber-500/10 border border-primary/30 rounded-2xl p-4 space-y-3"
              >
                <div className="text-center">
                  <p className="font-semibold text-lg">You've been challenged!</p>
                  <p className="text-sm text-muted-foreground">
                    {challenge.creator_name} wants to compete with you
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={handleDecline}
                    disabled={respondMutation.isPending}
                  >
                    <X className="h-4 w-4" />
                    Decline
                  </Button>
                  <Button
                    className="flex-1 gap-2"
                    onClick={handleAccept}
                    disabled={respondMutation.isPending}
                  >
                    <Check className="h-4 w-4" />
                    Accept
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Change Response CTA for users who previously declined (team battles only) */}
            {canChangeResponse && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-muted/50 border border-border rounded-2xl p-4 space-y-3"
              >
                <div className="text-center">
                  <p className="font-semibold text-lg">You declined this challenge</p>
                  <p className="text-sm text-muted-foreground">
                    Change your mind? You can still join!
                  </p>
                </div>
                <Button
                  className="w-full gap-2"
                  onClick={handleAccept}
                  disabled={respondMutation.isPending}
                >
                  <Check className="h-4 w-4" />
                  Accept Challenge
                </Button>
              </motion.div>
            )}

            {/* Pending - Team View with clear separation */}
            {challenge.status === 'pending' && !is1v1 && challenge.participants && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="space-y-4"
              >
                <p className="text-sm text-muted-foreground text-center font-medium">Waiting for all participants to accept</p>
                
                <div className="grid grid-cols-2 gap-3">
                  {/* Team A */}
                  <div className="space-y-2">
                    <div className="bg-primary/10 rounded-lg px-3 py-2 text-center">
                      <span className="text-sm font-bold text-primary">TEAM A</span>
                    </div>
                    <div className="space-y-2">
                      {teamA.map((participant, i) => (
                        <motion.div
                          key={participant.user_id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.2 + i * 0.05 }}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-lg",
                            participant.accepted ? "bg-green-500/10 border border-green-500/30" : "bg-muted/50"
                          )}
                        >
                          <Avatar className="h-8 w-8 border border-primary/50">
                            <AvatarImage src={participant.profile_photo_url} />
                            <AvatarFallback className="text-xs">{getInitials(participant.rep_name)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{participant.rep_name}</p>
                          </div>
                          {participant.accepted ? (
                            <Check className="h-4 w-4 text-green-500 shrink-0" />
                          ) : (
                            <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Team B */}
                  <div className="space-y-2">
                    <div className="bg-muted rounded-lg px-3 py-2 text-center">
                      <span className="text-sm font-bold text-muted-foreground">TEAM B</span>
                    </div>
                    <div className="space-y-2">
                      {teamB.map((participant, i) => (
                        <motion.div
                          key={participant.user_id}
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.2 + i * 0.05 }}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-lg",
                            participant.accepted ? "bg-green-500/10 border border-green-500/30" : "bg-muted/50"
                          )}
                        >
                          <Avatar className="h-8 w-8 border border-border">
                            <AvatarImage src={participant.profile_photo_url} />
                            <AvatarFallback className="text-xs">{getInitials(participant.rep_name)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{participant.rep_name}</p>
                          </div>
                          {participant.accepted ? (
                            <Check className="h-4 w-4 text-green-500 shrink-0" />
                          ) : (
                            <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 1v1 Pending View */}
            {challenge.status === 'pending' && is1v1 && challenge.participants && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="space-y-4"
              >
                <p className="text-sm text-muted-foreground text-center">Waiting for response</p>
                
                <div className="flex items-center justify-around gap-4">
                  {challenge.participants.slice(0, 2).map((participant, i) => (
                    <motion.div
                      key={participant.user_id}
                      initial={{ opacity: 0, x: i === 0 ? -20 : 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 + i * 0.1 }}
                      className="text-center flex-1"
                    >
                      <div className={cn(
                        "relative inline-block p-1 rounded-full",
                        participant.accepted ? "bg-green-500/20" : "bg-amber-500/20"
                      )}>
                        <Avatar className={cn(
                          "h-16 w-16 border-2",
                          participant.accepted ? "border-green-500" : "border-amber-500"
                        )}>
                          <AvatarImage src={participant.profile_photo_url} />
                          <AvatarFallback>{getInitials(participant.rep_name)}</AvatarFallback>
                        </Avatar>
                        <div className={cn(
                          "absolute -bottom-1 -right-1 h-6 w-6 rounded-full flex items-center justify-center",
                          participant.accepted ? "bg-green-500" : "bg-amber-500"
                        )}>
                          {participant.accepted ? (
                            <Check className="h-3.5 w-3.5 text-white" />
                          ) : (
                            <Clock className="h-3.5 w-3.5 text-white" />
                          )}
                        </div>
                      </div>
                      <p className="font-semibold mt-2">{participant.rep_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {participant.accepted ? 'Ready!' : 'Pending'}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Active/Completed Matchup */}
            <AnimatePresence>
              {progress && challenge.status !== 'pending' && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-around"
                >
                  {progress.participants.slice(0, 2).map((p, i) => (
                    <motion.div 
                      key={p.user_id} 
                      initial={{ opacity: 0, x: i === 0 ? -30 : 30 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15 + i * 0.1, type: "spring", stiffness: 300 }}
                      className="text-center"
                    >
                      <motion.div
                        whileHover={{ scale: 1.05 }}
                        transition={{ type: "spring", stiffness: 400 }}
                      >
                        <Avatar className={cn(
                          "h-16 w-16 mx-auto mb-2 border-2",
                          i === 0 ? "border-primary" : "border-border"
                        )}>
                          <AvatarImage src={p.profile_photo_url} />
                          <AvatarFallback>{getInitials(p.rep_name)}</AvatarFallback>
                        </Avatar>
                      </motion.div>
                      <p className="font-semibold">{p.rep_name}</p>
                      <motion.p 
                        key={p.current_value}
                        initial={{ scale: 1.2 }}
                        animate={{ scale: 1 }}
                        className={cn(
                          "text-2xl font-bold",
                          i === 0 ? "text-primary" : "text-foreground"
                        )}
                      >
                        {p.current_value.toFixed(1)}
                      </motion.p>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Progress bar */}
            {progress && challenge.status === 'active' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="space-y-2"
              >
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-primary rounded-full"
                    initial={{ width: "50%" }}
                    animate={{ 
                      width: `${Math.min(95, Math.max(5, 
                        (progress.userProgress?.current_value || 0) / 
                        ((progress.leader?.current_value || 1) + (progress.userProgress?.current_value || 0)) * 100
                      ))}%` 
                    }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </div>
                <p className="text-center text-sm text-muted-foreground">{progress.timeRemaining}</p>
              </motion.div>
            )}

            {/* Stakes */}
            {challenge.stakes && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="bg-muted/50 rounded-xl p-4 text-center"
              >
                <p className="text-sm text-muted-foreground mb-1">Stakes</p>
                <p className="font-medium">{challenge.stakes}</p>
              </motion.div>
            )}

            {/* Visibility */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex items-center justify-center gap-2 text-muted-foreground"
            >
              {challenge.visibility === 'public' ? (
                <>
                  <Eye className="h-4 w-4" />
                  <span className="text-sm">Public challenge</span>
                </>
              ) : (
                <>
                  <EyeOff className="h-4 w-4" />
                  <span className="text-sm">Private challenge</span>
                </>
              )}
            </motion.div>

            {/* Edit button at bottom if has pending proposals */}
            {canEdit && hasPendingProposals && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="pt-4"
              >
                <p className="text-xs text-center text-muted-foreground mb-2">
                  Wait for current proposal to be resolved before proposing new changes
                </p>
              </motion.div>
            )}

            {/* Void Challenge Button - for creators only */}
            {canVoid && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45 }}
                className="pt-4 border-t border-border"
              >
                <Button
                  variant="ghost"
                  className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={handleVoid}
                  disabled={voidMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {voidMutation.isPending ? 'Voiding...' : 'Void Challenge'}
                </Button>
              </motion.div>
            )}
          </motion.div>
        </DrawerContent>
      </Drawer>

      {/* Edit Drawer */}
      <EditChallengeDrawer
        challenge={challenge}
        open={showEditDrawer}
        onOpenChange={setShowEditDrawer}
      />
    </>
  );
};
