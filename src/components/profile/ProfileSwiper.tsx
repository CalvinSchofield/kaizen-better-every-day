import { useCallback, useEffect, useState, type ReactNode } from "react";
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
  /** Optional extra slide (e.g. season heatmap) rendered as third panel */
  extraSlide?: ReactNode;
}

const SLIDE_MIN_H = "min-h-[260px]";

export const ProfileSwiper = ({ dailyFp, isOwnProfile, goalPaceData, repName, extraSlide }: ProfileSwiperProps) => {
  const hasGoalData = goalPaceData !== null;
  const hasExtra = !!extraSlide;
  const slideCount = 1 + (hasGoalData ? 1 : 0) + (hasExtra ? 1 : 0);
  const isCarousel = slideCount > 1;

  const [selectedIndex, setSelectedIndex] = useState(0);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    active: isCarousel,
    watchDrag: (_emblaApi, event) => {
      const target = event.target;
      if (target instanceof Element && target.closest('[data-embla-no-drag="true"]')) {
        return false;
      }
      return true;
    },
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

  // If only one slide, render directly (no carousel)
  if (!isCarousel) {
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
          <div className={cn("min-w-full snap-center px-4 flex flex-col", SLIDE_MIN_H)}>
            <div className="flex-1 flex flex-col">
              <MomentumSparkline
                dailyFp={dailyFp}
                isOwnProfile={isOwnProfile}
              />
            </div>
          </div>

          {/* Slide 2: Goal Progress */}
          {hasGoalData && (
            <div className={cn("min-w-full snap-center px-4 flex flex-col", SLIDE_MIN_H)}>
              <div className="flex-1 flex flex-col">
                <UnifiedGoalProgress
                  data={goalPaceData}
                  mode="full"
                  showTierSelector={!goalPaceData.isPreseason}
                  showPaceContext
                  showTimeframeToggle
                />
              </div>
            </div>
          )}

          {/* Slide 3: Extra (Heatmap) */}
          {hasExtra && (
            <div className={cn("min-w-full snap-center px-4 flex flex-col", SLIDE_MIN_H)}>
              <div className="flex-1 flex flex-col">
                {extraSlide}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-1.5 mt-2">
        {Array.from({ length: slideCount }).map((_, i) => (
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
