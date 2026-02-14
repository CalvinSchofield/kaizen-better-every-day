import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { MomentumSparkline } from "./MomentumSparkline";
import { GoalPaceCard } from "./GoalPaceCard";
import { DownlineGoalPace } from "@/hooks/useDownlineGoalPace";
import { cn } from "@/lib/utils";

interface ProfileSwiperProps {
  dailyFp: { date: string; fp: number; prmr: number }[];
  isOwnProfile: boolean;
  goalPace: DownlineGoalPace | null;
  repName: string;
}

export const ProfileSwiper = ({ dailyFp, isOwnProfile, goalPace, repName }: ProfileSwiperProps) => {
  const hasGoalPace = goalPace !== null;
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    active: hasGoalPace, // Only enable swiping if there's a second card
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

  // If no goal pace, just render the sparkline directly (no carousel)
  if (!hasGoalPace) {
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
          <div className="min-w-full snap-center">
            <MomentumSparkline
              dailyFp={dailyFp}
              isOwnProfile={isOwnProfile}
            />
          </div>

          {/* Slide 2: Goal Pace */}
          <GoalPaceCard pace={goalPace} repName={repName} />
        </div>
      </div>

      {/* Dot indicators */}
      <div className="flex items-center justify-center gap-1.5 mt-2">
        {[0, 1].map((idx) => (
          <button
            key={idx}
            onClick={() => emblaApi?.scrollTo(idx)}
            className={cn(
              "h-1.5 rounded-full transition-all duration-200",
              idx === selectedIndex
                ? "w-4 bg-primary"
                : "w-1.5 bg-muted-foreground/30"
            )}
          />
        ))}
      </div>
    </div>
  );
};
