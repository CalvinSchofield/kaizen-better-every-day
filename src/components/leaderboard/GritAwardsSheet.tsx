import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
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
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle>Grit Awards</DrawerTitle>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-6 space-y-6">
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
