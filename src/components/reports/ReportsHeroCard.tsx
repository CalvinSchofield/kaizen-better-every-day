import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Users, Target, DollarSign, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReportsHeroCardProps {
  totalFP: number;
  totalPRMR: number;
  repCount: number;
  workingCount?: number;
  avgFPPerRep: number;
  periodLabel: string;
  comparison?: {
    fpChange: number;
    prmrChange: number;
  };
  isLive?: boolean;
}

export const ReportsHeroCard = ({
  totalFP,
  totalPRMR,
  repCount,
  workingCount,
  avgFPPerRep,
  periodLabel,
  comparison,
  isLive,
}: ReportsHeroCardProps) => {
  const fpTrend = comparison?.fpChange ?? 0;
  const isFpUp = fpTrend > 0;

  return (
    <Card className="relative overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10" />
      
      <div className="relative p-5">
        {/* Period label with live indicator */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-muted-foreground">{periodLabel}</span>
          {isLive && workingCount !== undefined && workingCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <div className="relative">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <div className="absolute inset-0 w-2 h-2 rounded-full bg-green-500 animate-ping opacity-75" />
              </div>
              <span className="text-green-600 dark:text-green-400 font-medium">
                {workingCount} working now
              </span>
            </div>
          )}
        </div>

        {/* Primary metrics row */}
        <div className="grid grid-cols-2 gap-6 mb-4">
          {/* FP+ - Primary */}
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold tracking-tight">{totalFP.toFixed(1)}</span>
              <span className="text-lg text-muted-foreground">FP+</span>
            </div>
            {comparison && fpTrend !== 0 && (
              <div className={cn(
                "flex items-center gap-1 text-xs mt-1",
                isFpUp ? "text-green-600 dark:text-green-400" : "text-orange-500"
              )}>
                {isFpUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(fpTrend).toFixed(1)}% vs last period
              </div>
            )}
          </div>

          {/* PRMR - Secondary */}
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold tracking-tight text-green-700 dark:text-green-500">
                ${totalPRMR.toLocaleString()}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">Total PRMR</span>
          </div>
        </div>

        {/* Secondary stats row */}
        <div className="flex items-center gap-4 pt-3 border-t border-border/50">
          <div className="flex items-center gap-1.5 text-sm">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">{repCount}</span>
            <span className="text-muted-foreground">reps</span>
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-1.5 text-sm">
            <Target className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">{avgFPPerRep.toFixed(2)}</span>
            <span className="text-muted-foreground">FP+ per rep</span>
          </div>
        </div>
      </div>
    </Card>
  );
};
