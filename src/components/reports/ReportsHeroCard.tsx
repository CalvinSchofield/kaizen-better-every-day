import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Users, Target, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

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
  sparklineData?: Array<{ date: string; fp: number }>;
  onFpClick?: () => void;
  onPrmrClick?: () => void;
  // Group breakdown for drill-down
  groupBreakdown?: Array<{
    name: string;
    fp: number;
    prmr: number;
    repCount: number;
    doors: number;
    presentations: number;
  }>;
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
  sparklineData,
  onFpClick,
  onPrmrClick,
}: ReportsHeroCardProps) => {
  const fpTrend = comparison?.fpChange ?? 0;
  const prmrTrend = comparison?.prmrChange ?? 0;
  const isFpUp = fpTrend > 0;
  const isPrmrUp = prmrTrend > 0;

  return (
    <Card className="relative overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10" />
      
      {/* Sparkline background */}
      {sparklineData && sparklineData.length >= 2 && (
        <div className="absolute inset-0 opacity-[0.08] pointer-events-none">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparklineData} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="heroSparkGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="fp" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#heroSparkGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      
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
          {/* FP+ - Primary (tappable) */}
          <button 
            onClick={onFpClick} 
            className={cn("text-left group", onFpClick && "active:scale-[0.97] transition-transform")}
            disabled={!onFpClick}
          >
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold tracking-tight">{totalFP.toFixed(1)}</span>
              <span className="text-lg text-muted-foreground">FP+</span>
              {onFpClick && <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />}
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
          </button>

          {/* PRMR - Secondary (tappable) */}
          <button 
            onClick={onPrmrClick}
            className={cn("text-left group", onPrmrClick && "active:scale-[0.97] transition-transform")}
            disabled={!onPrmrClick}
          >
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold tracking-tight text-green-700 dark:text-green-500">
                ${totalPRMR.toLocaleString()}
              </span>
              {onPrmrClick && <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />}
            </div>
            <span className="text-xs text-muted-foreground">Total PRMR</span>
            {comparison && prmrTrend !== 0 && (
              <div className={cn(
                "flex items-center gap-1 text-xs mt-0.5",
                isPrmrUp ? "text-green-600 dark:text-green-400" : "text-orange-500"
              )}>
                {isPrmrUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(prmrTrend).toFixed(1)}%
              </div>
            )}
          </button>
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
