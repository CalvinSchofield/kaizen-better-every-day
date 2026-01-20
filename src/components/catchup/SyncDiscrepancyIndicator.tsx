import { AlertCircle, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface SyncDiscrepancyIndicatorProps {
  hasDiscrepancy: boolean;
  discrepancyAmount: number;
  daysSinceVerification: number | null;
  needsVerification: boolean;
  hasOfficialTotals: boolean;
  onSyncClick?: () => void;
  variant?: 'badge' | 'inline' | 'compact';
  className?: string;
}

export const SyncDiscrepancyIndicator = ({
  hasDiscrepancy,
  discrepancyAmount,
  daysSinceVerification,
  needsVerification,
  hasOfficialTotals,
  onSyncClick,
  variant = 'badge',
  className,
}: SyncDiscrepancyIndicatorProps) => {
  // Don't show anything if no setup and no discrepancy
  if (!hasOfficialTotals && !needsVerification) return null;

  // Determine what message to show
  const getMessage = () => {
    if (!hasOfficialTotals) {
      return "Set up your official totals for accurate tracking";
    }
    if (hasDiscrepancy) {
      if (discrepancyAmount > 0) {
        return `~${discrepancyAmount.toFixed(1)} FP+ untracked since last sync`;
      } else {
        return `Tracked total is ${Math.abs(discrepancyAmount).toFixed(1)} higher than baseline`;
      }
    }
    if (needsVerification && daysSinceVerification !== null) {
      return `Last verified ${daysSinceVerification} days ago`;
    }
    return null;
  };

  const message = getMessage();
  if (!message) return null;

  const isWarning = hasDiscrepancy || needsVerification;

  if (variant === 'compact') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button 
              onClick={onSyncClick}
              className={cn(
                "p-1 rounded-full transition-colors",
                isWarning 
                  ? "text-amber-600 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/30"
                  : "text-muted-foreground hover:bg-muted",
                className
              )}
            >
              {isWarning ? (
                <AlertCircle className="h-4 w-4" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{message}</p>
            <p className="text-xs text-muted-foreground">Tap to sync</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (variant === 'inline') {
    return (
      <button
        onClick={onSyncClick}
        className={cn(
          "flex items-center gap-1.5 text-xs transition-colors",
          isWarning 
            ? "text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
            : "text-muted-foreground hover:text-foreground",
          className
        )}
      >
        {isWarning ? (
          <AlertCircle className="h-3 w-3" />
        ) : (
          <RefreshCw className="h-3 w-3" />
        )}
        <span>{message}</span>
      </button>
    );
  }

  // Badge variant (default)
  return (
    <Badge
      variant={isWarning ? "outline" : "secondary"}
      className={cn(
        "cursor-pointer transition-colors",
        isWarning 
          ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300 dark:hover:bg-amber-900/30"
          : "",
        className
      )}
      onClick={onSyncClick}
    >
      {isWarning ? (
        <AlertCircle className="h-3 w-3 mr-1" />
      ) : (
        <RefreshCw className="h-3 w-3 mr-1" />
      )}
      {message}
    </Badge>
  );
};
