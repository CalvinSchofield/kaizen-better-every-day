import { useHeadToHeadRecord } from "@/hooks/useCompetitionHistory";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Flame, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeadToHeadBadgeProps {
  opponentUserId?: string;
  compact?: boolean;
  className?: string;
}

export const HeadToHeadBadge = ({ opponentUserId, compact = false, className }: HeadToHeadBadgeProps) => {
  const { data: record, isLoading } = useHeadToHeadRecord(opponentUserId);

  if (isLoading || !record || record.total === 0) {
    return null;
  }

  const { wins, losses, ties, total, recentResults } = record;
  const isWinning = wins > losses;
  const isTied = wins === losses;

  // Calculate streak from recent results
  let streak = 0;
  for (const result of recentResults) {
    if (streak === 0) {
      streak = result.won ? 1 : (result.tied ? 0 : -1);
    } else if (streak > 0 && result.won) {
      streak++;
    } else if (streak < 0 && !result.won && !result.tied) {
      streak--;
    } else {
      break;
    }
  }

  const hasHotStreak = streak >= 2;
  const hasColdStreak = streak <= -2;

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="outline"
              className={cn(
                "text-xs cursor-help",
                isWinning && "border-green-500/50 text-green-600",
                !isWinning && !isTied && "border-red-500/50 text-red-600",
                className
              )}
            >
              {wins}-{losses}
              {hasHotStreak && <Flame className="h-3 w-3 ml-0.5 text-orange-500" />}
              {hasColdStreak && <TrendingDown className="h-3 w-3 ml-0.5" />}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-center">
              <p className="font-medium">Head-to-Head Record</p>
              <p className="text-sm">
                {wins}W - {losses}L{ties > 0 && ` - ${ties}T`}
              </p>
              {hasHotStreak && (
                <p className="text-xs text-orange-500">{streak} win streak!</p>
              )}
              {hasColdStreak && (
                <p className="text-xs text-muted-foreground">{Math.abs(streak)} loss streak</p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <span className="text-xs text-muted-foreground">H2H:</span>
      <span className={cn(
        "text-xs font-medium",
        isWinning ? "text-green-600" : isTied ? "text-muted-foreground" : "text-red-600"
      )}>
        {wins}-{losses}
        {ties > 0 && <span className="text-muted-foreground">-{ties}</span>}
      </span>
      {hasHotStreak && <Flame className="h-3 w-3 text-orange-500" />}
      {hasColdStreak && <TrendingDown className="h-3 w-3 text-muted-foreground" />}
    </div>
  );
};
