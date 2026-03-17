import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { MomentumSparkline } from "./MomentumSparkline";
import { UnifiedGoalProgress } from "@/components/goals/UnifiedGoalProgress";
import type { GoalPaceData } from "@/hooks/useGoalPaceCalculator";
import { cn } from "@/lib/utils";

interface ProfileSwiperProps {
  dailyFp: { date: string; fp: number; prmr: number }[];
  isOwnProfile: boolean;
  goalPaceData: GoalPaceData | null;
  repName: string;
}

export const ProfileSwiper = ({ dailyFp, isOwnProfile, goalPaceData, repName }: ProfileSwiperProps) => {
  const hasGoalData = goalPaceData !== null;
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    active: hasGoalData, // Only enable swiping if there's a second card
  });

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on('select', onSelect);
    return () => { emblaApi.off('select', onSelect); };
  }, [emblaApi, onSelect]);

  // If no goal data, just render the sparkline directly (no carousel)
  if (!hasGoalData) {
    return (
      <MomentumSparkline
        dailyFp={dailyFp}
        isOwnProfile={isOwnProfile}
      />
    );
  }

  return (
    <div className="mb-4">
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex">
          {/* Slide 1: Momentum */}
          <div className="min-w-full snap-center px-4">
            <MomentumSparkline
              dailyFp={dailyFp}
              isOwnProfile={isOwnProfile}
            />
          </div>

          {/* Slide 2: Goal Progress (UnifiedGoalProgress) */}
          <div className="min-w-full snap-center px-4">
            <UnifiedGoalProgress
              data={goalPaceData}
              mode="full"
              showTierSelector={!goalPaceData.isPreseason}
              showPaceContext
              showTimeframeToggle
            />
          </div>
        </div>
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-1.5 mt-2">
        {[0, 1].map(i => (
          <button
            key={i}
            className={cn(
              "h-1.5 rounded-full transition-all duration-200",
              selectedIndex === i
                ? "w-4 bg-primary"
                : "w-1.5 bg-muted-foreground/30"
            )}
            onClick={() => emblaApi?.scrollTo(i)}
          />
        ))}
      </div>
    </div>
  );
};
