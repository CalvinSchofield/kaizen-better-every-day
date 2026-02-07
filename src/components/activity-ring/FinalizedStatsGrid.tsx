import { motion } from "framer-motion";
import { DailyEntry, Sale } from "@/hooks/useDailyEntry";
import { calculateFromSalesLog } from "@/utils/salesLogCalculations";
import { formatFP, formatPRMR } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface FinalizedStatsGridProps {
  entry: DailyEntry | {
    doors_knocked: number;
    decision_makers: number;
    pitches: number;
    transitions: number;
    presentations: number;
    closes: number;
    fp_plus: number;
    prmr: number;
  };
  salesLog?: Sale[];
  className?: string;
}

interface StatBoxProps {
  label: string;
  value: string | number;
  highlight?: boolean;
  delay?: number;
}

const StatBox = ({ label, value, highlight = false, delay = 0 }: StatBoxProps) => (
  <motion.div
    className={cn(
      "p-3 rounded-xl text-center",
      highlight 
        ? "bg-primary/10 border border-primary/20" 
        : "bg-muted/30 border border-border/30"
    )}
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, delay }}
  >
    <div className={cn(
      "text-lg font-bold tabular-nums",
      highlight && "text-primary"
    )}>
      {value}
    </div>
    <div className="text-xs text-muted-foreground">{label}</div>
  </motion.div>
);

export const FinalizedStatsGrid = ({
  entry,
  salesLog = [],
  className,
}: FinalizedStatsGridProps) => {
  // Calculate FP and PRMR from sales log if available
  const { fp, prmr } = salesLog.length > 0
    ? calculateFromSalesLog(salesLog)
    : { fp: entry.fp_plus || 0, prmr: entry.prmr || 0 };

  const hasSales = fp > 0;

  return (
    <div className={cn("px-4", className)}>
      {/* Main stats row */}
      <div className="grid grid-cols-4 gap-2 mb-2">
        <StatBox label="Doors" value={entry.doors_knocked || 0} delay={0} />
        <StatBox label="Pitches" value={entry.pitches || 0} delay={0.05} />
        <StatBox label="Trans" value={entry.transitions || 0} delay={0.1} />
        <StatBox label="Pres" value={entry.presentations || 0} delay={0.15} />
      </div>
      
      {/* Sales row - highlighted */}
      <div className="grid grid-cols-3 gap-2">
        <StatBox 
          label="Closes" 
          value={entry.closes || 0} 
          highlight={entry.closes > 0}
          delay={0.2} 
        />
        <StatBox 
          label="FP+" 
          value={formatFP(fp)} 
          highlight={hasSales}
          delay={0.25} 
        />
        <StatBox 
          label="PRMR" 
          value={`$${formatPRMR(prmr)}`} 
          highlight={hasSales}
          delay={0.3} 
        />
      </div>
    </div>
  );
};
