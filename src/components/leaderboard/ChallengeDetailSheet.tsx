import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Challenge } from "@/hooks/useChallenges";
import { useChallengeProgress } from "@/hooks/useChallengeProgress";
import { useChallengeEditProposals } from "@/hooks/useChallengeEdits";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, Eye, EyeOff, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EditChallengeDrawer } from "./EditChallengeDrawer";
import { ChallengeEditApprovalCard } from "./ChallengeEditApprovalCard";
import { getInitials } from "@/utils/nameUtils";

interface ChallengeDetailSheetProps {
  challenge: Challenge;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ChallengeDetailSheet = ({ challenge, open, onOpenChange }: ChallengeDetailSheetProps) => {
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const { data: progress } = useChallengeProgress(challenge.status === 'active' ? challenge : null);
  const { data: editProposals } = useChallengeEditProposals(challenge.id);

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const isParticipant = challenge.participants?.some(p => p.user_id === currentUser?.id);
  const canEdit = isParticipant && (challenge.status === 'active' || challenge.status === 'pending');
  const hasPendingProposals = editProposals && editProposals.length > 0;

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="text-center relative">
            <DrawerTitle>Challenge Details</DrawerTitle>
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
            className="p-4 space-y-6 overflow-y-auto"
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
                "inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium",
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
                {challenge.status.toUpperCase()}
              </span>
            </motion.div>

            {/* Matchup */}
            <AnimatePresence>
              {progress && (
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
            {progress && (
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
