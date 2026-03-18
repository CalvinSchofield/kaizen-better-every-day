import { motion, AnimatePresence } from "framer-motion";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Flame } from "lucide-react";
import { GritAwardsSection } from "./GritAwardsSection";
import { TimingBreakdownSection } from "./TimingBreakdownSection";
import type { GritAwards } from "@/hooks/useExpandedLeaderboard";
import type { AwardStreak } from "@/hooks/useAwardStreaks";

interface GritAwardsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gritAwards: GritAwards;
  currentUserId: string | null;
  streaks?: {
    earlyBirdStreak: AwardStreak | null;
    nightOwlStreak: AwardStreak | null;
    ironmanStreak: AwardStreak | null;
    workhorseStreak: AwardStreak | null;
  };
}

export const GritAwardsSheet = ({
  open,
  onOpenChange,
  gritAwards,
  currentUserId,
  streaks,
}: GritAwardsSheetProps) => {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh] border-t-0 overflow-hidden">
        {/* Premium gradient header */}
        <div className="relative overflow-hidden bg-gradient-to-b from-orange-500/10 via-orange-500/5 to-transparent dark:from-orange-500/15 dark:via-orange-500/8 dark:to-transparent">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-orange-500/15 blur-3xl rounded-full dark:bg-orange-500/20" />
          
          <div className="relative px-6 pt-4 pb-4">
            
            <AnimatePresence>
              {open && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="flex flex-col items-center gap-2"
                >
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/25">
                    <Flame className="h-6 w-6 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-foreground tracking-tight">Grit Awards</h2>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-4 pb-8 space-y-5">
          <GritAwardsSection
            gritAwards={gritAwards}
            currentUserId={currentUserId}
            streaks={streaks}
          />
          <TimingBreakdownSection
            gritAwards={gritAwards}
            currentUserId={currentUserId}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
};
