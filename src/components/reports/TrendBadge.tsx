import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface TrendBadgeProps {
  currentValue: number;
  previousValue: number;
  label?: string;
  className?: string;
}

export const TrendBadge = ({ 
  currentValue, 
  previousValue, 
  label = "vs last week",
  className 
}: TrendBadgeProps) => {
  if (previousValue === 0 && currentValue === 0) return null;
  
  const change = previousValue > 0 
    ? ((currentValue - previousValue) / previousValue) * 100 
    : currentValue > 0 ? 100 : 0;
  
  const isUp = change > 10;
  const isDown = change < -10;
  const isFlat = !isUp && !isDown;
  
  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn(
          "inline-flex items-center gap-0.5 text-[10px] font-medium",
          isUp && "text-emerald-600 dark:text-emerald-400",
          isDown && "text-red-600 dark:text-red-400",
          isFlat && "text-muted-foreground",
          className
        )}>
          <Icon className="w-3 h-3" />
          {!isFlat && (
            <span>{isUp ? '+' : ''}{change.toFixed(0)}%</span>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <p>{label}</p>
        <p className="text-muted-foreground">
          {previousValue.toFixed(1)} → {currentValue.toFixed(1)}
        </p>
      </TooltipContent>
    </Tooltip>
  );
};
