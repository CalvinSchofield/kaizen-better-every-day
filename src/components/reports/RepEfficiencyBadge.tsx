import { cn } from "@/lib/utils";
import { Zap } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface RepEfficiencyBadgeProps {
  fp: number;
  doors: number;
  hours: number;
  allScores: number[]; // All efficiency scores for quartile calculation
  className?: string;
}

// Formula: (FP+ × 10) / (Doors × Hours) - higher = more efficient
export const calculateEfficiency = (fp: number, doors: number, hours: number): number => {
  if (doors === 0 || hours === 0) return 0;
  return (fp * 10) / (doors * hours);
};

export const RepEfficiencyBadge = ({ 
  fp, 
  doors, 
  hours, 
  allScores,
  className 
}: RepEfficiencyBadgeProps) => {
  const score = calculateEfficiency(fp, doors, hours);
  
  if (score === 0) return null;
  
  // Calculate quartiles
  const sortedScores = [...allScores].filter(s => s > 0).sort((a, b) => a - b);
  const q1 = sortedScores[Math.floor(sortedScores.length * 0.25)] || 0;
  const q3 = sortedScores[Math.floor(sortedScores.length * 0.75)] || 0;
  
  // Color based on quartile
  let colorClass = "bg-muted text-muted-foreground"; // Middle
  if (score >= q3) {
    colorClass = "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"; // Top 25%
  } else if (score <= q1) {
    colorClass = "bg-red-500/15 text-red-600 dark:text-red-400"; // Bottom 25%
  }
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn(
          "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium",
          colorClass,
          className
        )}>
          <Zap className="w-2.5 h-2.5" />
          {score.toFixed(2)}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <p className="font-medium">Efficiency Score</p>
        <p className="text-muted-foreground">
          Gets {score.toFixed(2)} FP+ per 100 doors per hour
        </p>
        <p className="text-muted-foreground mt-1">
          {score >= q3 ? "🟢 Top 25%" : score <= q1 ? "🔴 Bottom 25%" : "🟡 Middle 50%"}
        </p>
      </TooltipContent>
    </Tooltip>
  );
};
