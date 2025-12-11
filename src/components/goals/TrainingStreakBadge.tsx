import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrainingStreakBadgeProps {
  streak: number;
  className?: string;
}

export const TrainingStreakBadge = ({ streak, className }: TrainingStreakBadgeProps) => {
  if (streak === 0) return null;

  const isHot = streak >= 7;
  const isOnFire = streak >= 14;

  return (
    <div 
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-semibold",
        isOnFire 
          ? "bg-orange-500/20 text-orange-400" 
          : isHot 
            ? "bg-amber-500/20 text-amber-400"
            : "bg-muted text-muted-foreground",
        className
      )}
    >
      <Flame 
        className={cn(
          "h-4 w-4",
          isOnFire && "animate-pulse text-orange-400",
          isHot && !isOnFire && "text-amber-400"
        )} 
      />
      <span>{streak} day{streak !== 1 ? 's' : ''}</span>
    </div>
  );
};
