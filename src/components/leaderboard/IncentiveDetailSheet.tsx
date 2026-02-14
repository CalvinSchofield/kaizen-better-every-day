import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Trophy, Users, Target, Clock, Eye, EyeOff, Pencil, XCircle, Loader2, CheckCircle2, Circle, ChevronDown, Crown, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { Incentive, IncentiveMetric, useCancelIncentive } from "@/hooks/useIncentives";
import { useIncentiveProgress } from "@/hooks/useIncentiveProgress";
import { EditIncentiveDrawer } from "./EditIncentiveDrawer";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { formatCompetitionDuration } from "@/utils/competitionDateUtils";
import { toast } from "sonner";
import { getInitials, getCleanName } from "@/utils/nameUtils";

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
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [showWinners, setShowWinners] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const cancelMutation = useCancelIncentive();
  
  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });
  
  const isActive = incentive.status === 'active';
  const isCompleted = incentive.status === 'completed';
  const isGroupTotal = incentive.target_type === 'group_total';
  const isAnyoneWho = incentive.target_type === 'anyone_who';
  const isCreator = currentUser?.id === incentive.created_by;
  const canCancel = isCreator && isActive && !incentive.winner_user_id;
  
  const { data: progressData } = useIncentiveProgress(isActive ? incentive : null);

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync(incentive.id);
      toast.success('Incentive cancelled');
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel incentive');
    }
  };

  // Build completed leaderboard from eligible_reps data
  const completedLeaderboard = isCompleted && incentive.eligible_reps
    ? [...incentive.eligible_reps].sort((a, b) => (b.final_value ?? 0) - (a.final_value ?? 0))
    : [];

  const winnerIds = Array.isArray(incentive.winner_user_ids) ? incentive.winner_user_ids : [];
  const userWon = currentUser?.id && (
    incentive.winner_user_id === currentUser.id || winnerIds.includes(currentUser.id)
  );

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Trophy className="h-6 w-6 text-amber-500" />
              </div>
              <div className="flex-1">
                <DrawerTitle>{incentive.title}</DrawerTitle>
                <p className="text-sm text-muted-foreground">by {getCleanName(incentive.creator_name)}</p>
              </div>
              {isCreator && isActive && (
                <div className="flex items-center gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setShowEditDrawer(true)}
                    className="h-8 w-8"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {canCancel && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-destructive active:scale-95 transition-transform"
                      onClick={() => setShowCancelConfirm(true)}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          </DrawerHeader>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="p-4 space-y-6 overflow-y-auto"
        >
          {/* Reward */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-xl p-4 relative overflow-hidden"
          >
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
              animate={{ x: ["-100%", "100%"] }}
              transition={{ repeat: Infinity, duration: 2, ease: "linear", repeatDelay: 3 }}
            />
            <p className="text-sm text-muted-foreground mb-1">Prize</p>
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
              {incentive.reward}
            </p>
          </motion.div>

          {/* Details Grid */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="grid grid-cols-2 gap-3"
          >
            {[
              {
                icon: Target,
                label: "Goal",
                value: isGroupTotal 
                  ? `Group: ${incentive.target_value} ${metricLabels[incentive.metric]}`
                  : isAnyoneWho
                    ? `Anyone who gets ${incentive.target_value} ${metricLabels[incentive.metric]}`
                    : `First to ${incentive.target_value} ${metricLabels[incentive.metric]}`
              },
              {
                icon: Clock,
                label: "Duration",
                value: formatCompetitionDuration(incentive.start_date, incentive.end_date)
              },
              {
                icon: Users,
                label: "Participants",
                value: `${incentive.eligible_count} reps`
              },
              {
                icon: incentive.visibility === 'public' ? Eye : EyeOff,
                label: "Visibility",
                value: incentive.visibility
              }
            ].map((item, i) => (
              <motion.div 
                key={item.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.05 }}
                className="p-3 rounded-xl bg-muted/50 border border-border"
              >
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <item.icon className="h-4 w-4" />
                  <span className="text-xs">{item.label}</span>
                </div>
                <p className="font-semibold text-sm capitalize">{item.value}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* Active Progress Section */}
          <AnimatePresence>
            {isActive && progressData && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ delay: 0.25 }}
                className="space-y-4"
              >
                <h3 className="font-semibold flex items-center gap-2">
                  {isGroupTotal ? (
                    <>
                      <Users className="h-4 w-4 text-blue-500" />
                      Team Progress
                    </>
                  ) : isAnyoneWho ? (
                    <>
                      <Target className="h-4 w-4 text-green-500" />
                      Qualification Status
                    </>
                  ) : (
                    <>
                      <Trophy className="h-4 w-4 text-amber-500" />
                      Leaderboard
                    </>
                  )}
                </h3>

                {isAnyoneWho && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between bg-green-500/10 border border-green-500/20 rounded-xl p-3"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span className="font-medium">Qualified</span>
                    </div>
                    <span className="text-lg font-bold text-green-600">
                      {progressData.qualifiedParticipants?.length || 0} / {progressData.participants.length}
                    </span>
                  </motion.div>
                )}

                {isGroupTotal && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-2"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Combined Total</span>
                      <motion.span 
                        key={progressData.groupTotal}
                        initial={{ scale: 1.2 }}
                        animate={{ scale: 1 }}
                        className="font-bold text-lg text-amber-600"
                      >
                        {progressData.groupTotal.toFixed(1)} / {progressData.targetValue}
                      </motion.span>
                    </div>
                    <Progress value={progressData.progressPercent} className="h-3" />
                    <p className="text-xs text-muted-foreground text-right">
                      {progressData.progressPercent.toFixed(0)}% complete
                    </p>
                  </motion.div>
                )}

                <div className="space-y-2">
                  {progressData.participants.map((participant, index) => {
                    const isQualified = isAnyoneWho && participant.current_value >= (progressData.targetValue || 0);
                    
                    return (
                      <motion.div 
                        key={participant.user_id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + index * 0.05 }}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-xl",
                          isAnyoneWho && isQualified 
                            ? "bg-green-500/10 border border-green-500/20" 
                            : index === 0 && !isGroupTotal && !isAnyoneWho 
                              ? "bg-amber-500/10 border border-amber-500/20" 
                              : "bg-muted/50"
                        )}
                      >
                        <div className="relative">
                          {index === 0 && !isGroupTotal && !isAnyoneWho && (
                            <motion.div 
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ delay: 0.4, type: "spring" }}
                              className="absolute -top-1 -left-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center"
                            >
                              <Trophy className="h-3 w-3 text-white" />
                            </motion.div>
                          )}
                          {isAnyoneWho && (
                            <motion.div 
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ delay: 0.4 + index * 0.03, type: "spring" }}
                              className={cn(
                                "absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center",
                                isQualified ? "bg-green-500" : "bg-muted-foreground/30"
                              )}
                            >
                              {isQualified ? (
                                <CheckCircle2 className="h-3 w-3 text-white" />
                              ) : (
                                <Circle className="h-3 w-3 text-white" />
                              )}
                            </motion.div>
                          )}
                          <Avatar className="h-10 w-10">
                            {participant.profile_photo_url && (
                              <AvatarImage src={participant.profile_photo_url} />
                            )}
                            <AvatarFallback className="text-xs">{getInitials(participant.rep_name)}</AvatarFallback>
                          </Avatar>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{getCleanName(participant.rep_name)}</p>
                            {isAnyoneWho && isQualified && (
                              <span className="text-xs font-medium text-green-600 bg-green-500/20 px-1.5 py-0.5 rounded-full">
                                Qualified!
                              </span>
                            )}
                          </div>
                          {isGroupTotal && (
                            <p className="text-xs text-muted-foreground">
                              {((participant.current_value / progressData.groupTotal) * 100 || 0).toFixed(0)}% contribution
                            </p>
                          )}
                          {isAnyoneWho && !isQualified && (
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">
                                {Math.max(0, (progressData.targetValue || 0) - participant.current_value).toFixed(1)} more to qualify
                              </p>
                              {participant.current_value > 0 && progressData.targetValue && (
                                <Progress 
                                  value={(participant.current_value / progressData.targetValue) * 100} 
                                  className="h-1.5"
                                />
                              )}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <motion.p 
                            key={participant.current_value}
                            initial={{ scale: 1.1 }}
                            animate={{ scale: 1 }}
                            className={cn(
                              "font-bold",
                              isAnyoneWho && isQualified ? "text-green-600" : "text-amber-600"
                            )}
                          >
                            {participant.current_value.toFixed(1)}
                          </motion.p>
                          <p className="text-xs text-muted-foreground">
                            {metricLabels[incentive.metric]}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* === COMPLETED STATE - ESPN-Style === */}
          {isCompleted && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              {/* Result banner */}
              {userWon && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-2.5 rounded-xl font-bold text-lg bg-primary/15 text-primary"
                >
                  🏆 You Won!
                </motion.div>
              )}

              {/* Winner spotlight for non-anyoneWho */}
              {!isAnyoneWho && incentive.winner_user_id && (() => {
                const winner = incentive.eligible_reps?.find(r => r.user_id === incentive.winner_user_id);
                if (!winner) return null;
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center gap-2 py-3"
                  >
                    <div className="relative">
                      <motion.div
                        initial={{ scale: 0, y: 10 }}
                        animate={{ scale: 1, y: 0 }}
                        transition={{ delay: 0.2, type: "spring" }}
                        className="absolute -top-3 left-1/2 -translate-x-1/2 z-10"
                      >
                        <Crown className="h-7 w-7 text-amber-500 fill-amber-500" />
                      </motion.div>
                      <Avatar className="h-20 w-20 border-3 border-amber-500 ring-2 ring-amber-500/30">
                        <AvatarImage src={winner.profile_photo_url} />
                        <AvatarFallback className="text-xl font-bold">{getInitials(winner.rep_name)}</AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-lg">{getCleanName(winner.rep_name)}</p>
                      <p className="text-sm text-muted-foreground">Winner</p>
                      {winner.final_value != null && (
                        <p className="text-xl font-bold text-amber-600 mt-1">
                          {winner.final_value.toFixed(1)} {metricLabels[incentive.metric]}
                        </p>
                      )}
                    </div>
                  </motion.div>
                );
              })()}

              {/* Anyone Who winners */}
              {isAnyoneWho && winnerIds.length > 0 && (
                <Collapsible open={showWinners} onOpenChange={setShowWinners}>
                  <CollapsibleTrigger className="w-full p-4 text-center bg-green-500/10 rounded-xl">
                    <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                    <div className="flex items-center justify-center gap-2">
                      <p className="font-semibold">{winnerIds.length} qualified and won!</p>
                      <motion.div animate={{ rotate: showWinners ? 180 : 0 }} transition={{ duration: 0.2 }}>
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </motion.div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Tap to {showWinners ? 'hide' : 'see'} winners
                    </p>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-4 pb-4 space-y-2">
                      {winnerIds.map((winnerId, index) => {
                        const winner = incentive.eligible_reps?.find(r => r.user_id === winnerId);
                        if (!winner) return null;
                        return (
                          <motion.div
                            key={winnerId}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="flex items-center gap-3 p-3 rounded-xl bg-green-500/10 border border-green-500/20"
                          >
                            <div className="relative">
                              <Avatar className="h-10 w-10">
                                {winner.profile_photo_url && <AvatarImage src={winner.profile_photo_url} />}
                                <AvatarFallback className="text-xs">{getInitials(winner.rep_name)}</AvatarFallback>
                              </Avatar>
                              <motion.div 
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.2 + index * 0.05, type: "spring" }}
                                className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center"
                              >
                                <CheckCircle2 className="h-3 w-3 text-white" />
                              </motion.div>
                            </div>
                            <div className="flex-1">
                              <p className="font-medium">{getCleanName(winner.rep_name)}</p>
                              <span className="text-xs font-medium text-green-600">🏆 Qualified!</span>
                            </div>
                          </motion.div>
                        );
                      })}
                    </motion.div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Completed full leaderboard */}
              {completedLeaderboard.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold flex items-center gap-2 text-sm">
                    <Trophy className="h-4 w-4 text-amber-500" />
                    Final Standings
                  </h3>
                  {completedLeaderboard.map((participant, index) => {
                    const isWinner = incentive.winner_user_id === participant.user_id || winnerIds.includes(participant.user_id);
                    return (
                      <motion.div
                        key={participant.user_id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 + index * 0.04 }}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-xl",
                          isWinner ? "bg-amber-500/10 border border-amber-500/20" : "bg-muted/50"
                        )}
                      >
                        <span className="text-sm font-bold text-muted-foreground w-5 text-center">
                          {index + 1}
                        </span>
                        <div className="relative">
                          <Avatar className="h-9 w-9">
                            {participant.profile_photo_url && <AvatarImage src={participant.profile_photo_url} />}
                            <AvatarFallback className="text-xs">{getInitials(participant.rep_name)}</AvatarFallback>
                          </Avatar>
                          {isWinner && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
                              <Crown className="h-2.5 w-2.5 text-white fill-white" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{getCleanName(participant.rep_name)}</p>
                        </div>
                        <p className={cn("font-bold text-sm", isWinner ? "text-amber-600" : "text-foreground")}>
                          {(participant.final_value ?? 0).toFixed(1)}
                        </p>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* Duration */}
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span className="text-sm">{formatCompetitionDuration(incentive.start_date, incentive.end_date)}</span>
              </div>
            </motion.div>
          )}
        </motion.div>
        </DrawerContent>
      </Drawer>
      
      {/* Edit Drawer */}
      <EditIncentiveDrawer
        incentive={incentive}
        open={showEditDrawer}
        onOpenChange={setShowEditDrawer}
      />
      
      {/* Cancel Confirmation Drawer */}
      <Drawer open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Cancel Incentive?</DrawerTitle>
          </DrawerHeader>
          <div className="p-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              This will cancel "{incentive.title}" and notify all participants. This action cannot be undone.
            </p>
            <div className="flex flex-col gap-3">
              <Button
                variant="destructive"
                className="w-full py-6 text-lg font-semibold active:scale-[0.98] transition-transform"
                onClick={handleCancel}
                disabled={cancelMutation.isPending}
              >
                {cancelMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Cancel Incentive
              </Button>
              <Button
                variant="outline"
                className="w-full py-6 text-lg font-semibold active:scale-[0.98] transition-transform"
                onClick={() => setShowCancelConfirm(false)}
              >
                Keep Active
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
};
