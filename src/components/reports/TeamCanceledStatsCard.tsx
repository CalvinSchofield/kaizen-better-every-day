import { Card } from "@/components/ui/card";
import { AlertTriangle, ChevronDown, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useEfpMode } from "@/hooks/useEfpMode";

interface RepCanceledStats {
  userId: string;
  name: string;
  year: string;
  canceledFpCount: number;
  canceledUpgradeCount: number;
  canceledPrmr: number;
  canceledEfp: number;
  totalFpCount: number;
  totalUpgradeCount: number;
  totalPrmr: number;
  cancelRate: number;
}

interface TeamCanceledStatsCardProps {
  reps: RepCanceledStats[];
  totals: {
    canceledFpCount: number;
    canceledUpgradeCount: number;
    canceledPrmr: number;
    canceledEfp: number;
    totalFpCount: number;
    totalUpgradeCount: number;
    totalPrmr: number;
    cancelRate: number;
  };
  isLoading?: boolean;
  title?: string;
}

export const TeamCanceledStatsCard = ({ 
  reps, 
  totals, 
  isLoading,
  title = "Cancellation Stats"
}: TeamCanceledStatsCardProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { efpModeEnabled } = useEfpMode();

  // Filter to only reps with cancellations
  const repsWithCancellations = reps.filter(r => 
    r.canceledFpCount > 0 || r.canceledUpgradeCount > 0
  );

  // Identify high cancel rate reps (above 20%)
  const highCancelRateReps = repsWithCancellations.filter(r => r.cancelRate >= 20);

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="h-5 w-40 bg-muted rounded animate-pulse mb-3" />
        <div className="h-8 w-24 bg-muted rounded animate-pulse" />
      </Card>
    );
  }

  const totalCanceled = totals.canceledFpCount + totals.canceledUpgradeCount;
  
  if (totalCanceled === 0) {
    return null; // Don't show card if no cancellations
  }

  return (
    <Card className="p-4">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-destructive" />
              <span className="font-semibold text-sm">{title}</span>
              {highCancelRateReps.length > 0 && (
                <span className="bg-destructive/10 text-destructive text-xs px-2 py-0.5 rounded-full">
                  {highCancelRateReps.length} high rate
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
              <div className="font-semibold text-destructive">
                  {efpModeEnabled 
                    ? `${totals.canceledEfp.toFixed(1)} EFP`
                    : `${totals.canceledFpCount} FP`
                  }
                </div>
                <div className="text-xs text-muted-foreground">
                  ${totals.canceledPrmr.toLocaleString()} · {totals.cancelRate}% rate
                </div>
              </div>
              <ChevronDown className={cn(
                "w-4 h-4 transition-transform text-muted-foreground",
                isOpen && "rotate-180"
              )} />
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-4">
          {/* Team Totals Summary */}
          <div className="grid grid-cols-3 gap-3 p-3 bg-muted/30 rounded-lg mb-4">
            <div className="text-center">
              <div className="text-lg font-bold text-destructive">
                {totalCanceled}
              </div>
              <div className="text-[10px] text-muted-foreground">Total Canceled</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-destructive">
                ${totals.canceledPrmr.toLocaleString()}
              </div>
              <div className="text-[10px] text-muted-foreground">Lost PRMR</div>
            </div>
            <div className="text-center">
              <div className={cn(
                "text-lg font-bold",
                totals.cancelRate >= 20 ? "text-destructive" : 
                totals.cancelRate >= 10 ? "text-amber-600 dark:text-amber-500" : 
                "text-foreground"
              )}>
                {totals.cancelRate}%
              </div>
              <div className="text-[10px] text-muted-foreground">Cancel Rate</div>
            </div>
          </div>

          {/* High Cancel Rate Reps */}
          {highCancelRateReps.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                <span className="text-xs font-medium text-destructive">
                  Needs Coaching (&gt;20% cancel rate)
                </span>
              </div>
              <div className="space-y-2">
                {highCancelRateReps.map(rep => (
                  <div 
                    key={rep.userId}
                    className="flex items-center justify-between p-2 bg-destructive/5 border border-destructive/20 rounded-lg"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{rep.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {rep.canceledFpCount} FP + {rep.canceledUpgradeCount} UP canceled
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-destructive">
                        {rep.cancelRate}%
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        ${rep.canceledPrmr.toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Other Reps with Cancellations */}
          {repsWithCancellations.filter(r => r.cancelRate < 20).length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2">
                All Reps with Cancellations
              </div>
              <div className="space-y-1">
                {repsWithCancellations
                  .filter(r => r.cancelRate < 20)
                  .map(rep => (
                    <div 
                      key={rep.userId}
                      className="flex items-center justify-between py-1.5 px-2 rounded text-sm hover:bg-muted/50"
                    >
                      <div className="min-w-0">
                        <span className="truncate">{rep.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {rep.canceledFpCount + rep.canceledUpgradeCount} canceled
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={cn(
                          "text-xs font-medium",
                          rep.cancelRate >= 10 ? "text-amber-600 dark:text-amber-500" : "text-muted-foreground"
                        )}>
                          {rep.cancelRate}%
                        </span>
                        <span className="text-xs text-destructive">
                          ${rep.canceledPrmr.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
