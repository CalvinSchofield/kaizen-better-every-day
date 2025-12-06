import { Card, CardContent } from "@/components/ui/card";
import { Ban, ChevronDown, ChevronUp } from "lucide-react";
import { useYTDCanceledStats } from "@/hooks/useCanceledStats";
import { useEfpMode } from "@/hooks/useEfpMode";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface CanceledStatsCardProps {
  className?: string;
}

export const CanceledStatsCard = ({ className }: CanceledStatsCardProps) => {
  const { stats, isLoading } = useYTDCanceledStats();
  const { efpModeEnabled } = useEfpMode();
  const [isExpanded, setIsExpanded] = useState(false);

  // Don't show card if no canceled sales
  if (!isLoading && stats.totalCanceledCount === 0) {
    return null;
  }

  if (isLoading) {
    return (
      <Card className={`border-amber-500/30 bg-amber-500/5 ${className}`}>
        <CardContent className="p-4">
          <Skeleton className="h-5 w-32 mb-2" />
          <Skeleton className="h-6 w-48" />
        </CardContent>
      </Card>
    );
  }

  // Summary text based on mode
  const summaryText = efpModeEnabled
    ? `${stats.canceledEfp.toFixed(1)} EFP · ${stats.canceledFpPlus.toFixed(1)} FP+`
    : `${stats.canceledFpPlus.toFixed(1)} FP+ · $${stats.canceledPrmr.toLocaleString()}`;

  return (
    <Card className={`border-amber-500/30 bg-amber-500/5 ${className}`}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger className="w-full">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/10">
                  <Ban className="h-4 w-4 text-amber-600" />
                </div>
                <div className="text-left">
                <p className="text-xs font-medium text-amber-600">
                    YTD Unfunded (Installed but Cancelled)
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {summaryText}
                  </p>
                </div>
              </div>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CardContent>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="border-t border-amber-500/20 pt-3 mt-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 rounded-lg bg-background/50">
                  <p className="text-lg font-bold text-foreground">
                    {stats.canceledFpCount}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    FP{stats.canceledFpCount !== 1 ? 's' : ''} Cancelled
                  </p>
                </div>
                <div className="text-center p-3 rounded-lg bg-background/50">
                  <p className="text-lg font-bold text-foreground">
                    {stats.canceledUpgradeCount}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Upgrade{stats.canceledUpgradeCount !== 1 ? 's' : ''} Cancelled
                  </p>
                </div>
              </div>

              {efpModeEnabled ? (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="text-center p-2 rounded-lg bg-background/50">
                    <p className="text-sm font-semibold text-amber-600">
                      {stats.canceledEfp.toFixed(2)} EFP
                    </p>
                    <p className="text-[10px] text-muted-foreground">Lost EFP</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-background/50">
                    <p className="text-sm font-semibold text-foreground">
                      {stats.canceledFpPlus.toFixed(2)} FP+
                    </p>
                    <p className="text-[10px] text-muted-foreground">Lost FP+</p>
                  </div>
                </div>
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="text-center p-2 rounded-lg bg-background/50">
                    <p className="text-sm font-semibold text-amber-600">
                      {stats.canceledFpPlus.toFixed(2)} FP+
                    </p>
                    <p className="text-[10px] text-muted-foreground">Lost FP+</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-background/50">
                    <p className="text-sm font-semibold text-foreground">
                      ${stats.canceledPrmr.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Lost PRMR</p>
                  </div>
                </div>
              )}

              <p className="text-[10px] text-muted-foreground text-center mt-3 italic">
                These sales were installed but later cancelled. They count toward your total goal but not funded income.
              </p>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
