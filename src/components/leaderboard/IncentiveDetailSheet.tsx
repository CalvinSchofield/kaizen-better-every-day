import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Trophy, Users, Target, Clock, User, Eye, EyeOff, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { Incentive, IncentiveMetric } from "@/hooks/useIncentives";
import { useIncentiveProgress } from "@/hooks/useIncentiveProgress";
import { EditIncentiveDrawer } from "./EditIncentiveDrawer";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
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
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  
  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });
  
  const isActive = incentive.status === 'active';
  const isGroupTotal = incentive.target_type === 'group_total';
  const isCreator = currentUser?.id === incentive.created_by;
  
  const { data: progressData } = useIncentiveProgress(isActive ? incentive : null);

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
                <p className="text-sm text-muted-foreground">by {incentive.creator_name}</p>
              </div>
              {isCreator && isActive && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setShowEditDrawer(true)}
                  className="h-8 w-8"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
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
                  : `First to ${incentive.target_value} ${metricLabels[incentive.metric]}`
              },
              {
                icon: Clock,
                label: "Duration",
                value: `${format(new Date(incentive.start_date), 'MMM d')} - ${format(new Date(incentive.end_date), 'MMM d')}`
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

          {/* Progress Section */}
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
                  ) : (
                    <>
                      <Trophy className="h-4 w-4 text-amber-500" />
                      Leaderboard
                    </>
                  )}
                </h3>

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

                {/* Individual Contributions */}
                <div className="space-y-2">
                  {progressData.participants.map((participant, index) => (
                    <motion.div 
                      key={participant.user_id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + index * 0.05 }}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl",
                        index === 0 && !isGroupTotal ? "bg-amber-500/10 border border-amber-500/20" : "bg-muted/50"
                      )}
                    >
                      <div className="relative">
                        {index === 0 && !isGroupTotal && (
                          <motion.div 
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.4, type: "spring" }}
                            className="absolute -top-1 -left-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center"
                          >
                            <Trophy className="h-3 w-3 text-white" />
                          </motion.div>
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
                        <motion.p 
                          key={participant.current_value}
                          initial={{ scale: 1.1 }}
                          animate={{ scale: 1 }}
                          className="font-bold text-amber-600"
                        >
                          {participant.current_value.toFixed(1)}
                        </motion.p>
                        <p className="text-xs text-muted-foreground">
                          {metricLabels[incentive.metric]}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Completed State */}
          {incentive.status === 'completed' && incentive.winner_user_id && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-xl p-4 text-center"
            >
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 10, 0], scale: [1, 1.1, 1] }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <Trophy className="h-8 w-8 text-amber-500 mx-auto mb-2" />
              </motion.div>
              <p className="font-semibold">Winner claimed the prize!</p>
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
    </>
  );
};
