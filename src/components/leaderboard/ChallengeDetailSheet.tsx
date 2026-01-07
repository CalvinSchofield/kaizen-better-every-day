import { motion, AnimatePresence } from "framer-motion";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Challenge } from "@/hooks/useChallenges";
import { useChallengeProgress } from "@/hooks/useChallengeProgress";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChallengeDetailSheetProps {
  challenge: Challenge;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ChallengeDetailSheet = ({ challenge, open, onOpenChange }: ChallengeDetailSheetProps) => {
  const { data: progress } = useChallengeProgress(challenge.status === 'active' ? challenge : null);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="text-center">
          <DrawerTitle>Challenge Details</DrawerTitle>
        </DrawerHeader>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="p-4 space-y-6"
        >
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
                        <AvatarFallback>{p.rep_name.charAt(0)}</AvatarFallback>
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
        </motion.div>
      </DrawerContent>
    </Drawer>
  );
};
