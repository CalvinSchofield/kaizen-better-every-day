import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface PeriodMetrics {
  fp: number;
  prmr: number;
  doors: number;
  presentations: number;
  closes: number;
  hoursWorked: number;
  repsWorked: number;
}

interface PeriodComparisonCardProps {
  current: PeriodMetrics;
  previous: PeriodMetrics | null;
  currentLabel: string;
  previousLabel: string;
  isLoading?: boolean;
}

interface DeltaRowProps {
  label: string;
  current: number;
  previous: number;
  format?: 'number' | 'currency' | 'decimal' | 'hours';
}

const DeltaRow = ({ label, current, previous, format = 'number' }: DeltaRowProps) => {
  const delta = previous > 0 ? ((current - previous) / previous) * 100 : 0;
  const hasChange = previous > 0 && Math.abs(delta) > 0.5;

  const formatValue = (v: number) => {
    if (format === 'currency') return `$${v.toLocaleString()}`;
    if (format === 'decimal') return v.toFixed(1);
    if (format === 'hours') return `${v.toFixed(1)}h`;
    return v.toString();
  };

  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-sm font-bold">{formatValue(current)}</span>
        {hasChange && (
          <div className={cn(
            "flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
            delta > 0 ? "text-green-600 dark:text-green-400 bg-green-500/10" : "text-orange-500 bg-orange-500/10"
          )}>
            {delta > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
            {delta > 0 ? '+' : ''}{delta.toFixed(0)}%
          </div>
        )}
        {!hasChange && previous > 0 && (
          <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground px-1.5 py-0.5 rounded-full bg-muted/50">
            <Minus className="w-2.5 h-2.5" />
            0%
          </div>
        )}
        {previous === 0 && (
          <span className="text-[10px] text-muted-foreground">new</span>
        )}
      </div>
    </div>
  );
};

export const PeriodComparisonCard = ({
  current, previous, currentLabel, previousLabel, isLoading,
}: PeriodComparisonCardProps) => {
  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="h-5 w-48 bg-muted animate-pulse rounded mb-3" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-8 bg-muted animate-pulse rounded" />)}
        </div>
      </Card>
    );
  }

  if (!previous) return null;

  const overallFpDelta = previous.fp > 0 ? ((current.fp - previous.fp) / previous.fp) * 100 : 0;
  const isUp = overallFpDelta > 0;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">{currentLabel} vs {previousLabel}</h3>
          </div>
          {Math.abs(overallFpDelta) > 0.5 && (
            <div className={cn(
              "flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full",
              isUp ? "text-green-600 dark:text-green-400 bg-green-500/10" : "text-orange-500 bg-orange-500/10"
            )}>
              {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {isUp ? '+' : ''}{overallFpDelta.toFixed(0)}% FP+
            </div>
          )}
        </div>

        <div className="divide-y divide-border/50">
          <DeltaRow label="FP+" current={current.fp} previous={previous.fp} format="decimal" />
          <DeltaRow label="PRMR" current={current.prmr} previous={previous.prmr} format="currency" />
          <DeltaRow label="Doors" current={current.doors} previous={previous.doors} />
          <DeltaRow label="Presentations" current={current.presentations} previous={previous.presentations} />
          <DeltaRow label="Closes" current={current.closes} previous={previous.closes} />
          <DeltaRow label="Reps Worked" current={current.repsWorked} previous={previous.repsWorked} />
        </div>
      </Card>
    </motion.div>
  );
};
