import { cn } from "@/lib/utils";
import { Star } from "lucide-react";

interface ActivityRingMiniProps {
  doors: number;
  maxDoors?: number;
  hasSale: boolean;
  hasWork: boolean;
  isSelected?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export const ActivityRingMini = ({
  doors,
  maxDoors = 60,
  hasSale,
  hasWork,
  isSelected = false,
  size = "sm",
  className,
}: ActivityRingMiniProps) => {
  const dimensions = size === "sm" ? 24 : 32;
  const strokeWidth = size === "sm" ? 3 : 4;
  const radius = (dimensions - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  
  // Calculate fill percentage based on doors
  const fillPercent = Math.min(doors / maxDoors, 1);
  const strokeDasharray = `${circumference * fillPercent} ${circumference}`;
  
  // Determine ring color based on activity
  const getRingColor = () => {
    if (!hasWork) return "hsl(var(--muted))";
    if (hasSale) return "hsl(45, 93%, 47%)"; // Gold for sales
    if (fillPercent >= 0.8) return "hsl(142, 76%, 36%)"; // Green for high activity
    if (fillPercent >= 0.4) return "hsl(var(--primary))"; // Primary for medium
    return "hsl(var(--muted-foreground))"; // Muted for low
  };

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg
        width={dimensions}
        height={dimensions}
        viewBox={`0 0 ${dimensions} ${dimensions}`}
        className="transform -rotate-90"
      >
        {/* Background track */}
        <circle
          cx={dimensions / 2}
          cy={dimensions / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
          opacity={0.3}
        />
        
        {/* Progress ring */}
        {hasWork && (
          <circle
            cx={dimensions / 2}
            cy={dimensions / 2}
            r={radius}
            fill="none"
            stroke={getRingColor()}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
            strokeLinecap="round"
            className="transition-all duration-300"
          />
        )}
      </svg>
      
      {/* Sale indicator star */}
      {hasSale && (
        <Star
          className={cn(
            "absolute text-amber-400 fill-amber-400",
            size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"
          )}
        />
      )}
      
      {/* Selected indicator */}
      {isSelected && (
        <div 
          className={cn(
            "absolute inset-0 rounded-full ring-2 ring-primary ring-offset-1 ring-offset-background",
          )}
        />
      )}
    </div>
  );
};
