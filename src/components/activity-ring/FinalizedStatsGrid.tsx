import { motion } from "framer-motion";
import { DailyEntry, Sale } from "@/hooks/useDailyEntry";
import { calculateFromSalesLog } from "@/utils/salesLogCalculations";
import { formatFP, formatPRMR } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { hapticLight } from "@/utils/haptics";

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
  onClosesClick?: () => void;
  onFPClick?: () => void;
  onPRMRClick?: () => void;
}

interface StatBoxProps {
  label: string;
  value: string | number;
  highlight?: boolean;
  delay?: number;
  onClick?: () => void;
  clickable?: boolean;
}

const StatBox = ({ label, value, highlight = false, delay = 0, onClick, clickable = false }: StatBoxProps) => {
  const handleClick = () => {
    if (clickable && onClick) {
      hapticLight();
      onClick();
    }
  };

  return (
    <motion.div
      className={cn(
        "p-3 rounded-xl text-center transition-all",
        highlight 
          ? "bg-primary/10 border border-primary/20" 
          : "bg-muted/30 border border-border/30",
        clickable && "cursor-pointer active:scale-95 hover:bg-muted/50"
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      onClick={handleClick}
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
};

export const FinalizedStatsGrid = ({
  entry,
  salesLog = [],
  className,
  onClosesClick,
  onFPClick,
  onPRMRClick,
}: FinalizedStatsGridProps) => {
  // Calculate FP and PRMR from sales log if available
  const { fp, prmr } = salesLog.length > 0
    ? calculateFromSalesLog(salesLog)
    : { fp: entry.fp_plus || 0, prmr: entry.prmr || 0 };

  const hasSales = fp > 0;
  const hasSalesLog = salesLog.length > 0;

  return (
    <div className={cn("px-4", className)}>
      {/* Main stats row */}
      <div className="grid grid-cols-4 gap-2 mb-2">
        <StatBox label="Doors" value={entry.doors_knocked || 0} delay={0} />
        <StatBox label="Pitches" value={entry.pitches || 0} delay={0.05} />
        <StatBox label="Trans" value={entry.transitions || 0} delay={0.1} />
        <StatBox label="Pres" value={entry.presentations || 0} delay={0.15} />
      </div>
      
      {/* Sales row - highlighted and clickable when there are sales */}
      <div className="grid grid-cols-3 gap-2">
        <StatBox 
          label="Closes" 
          value={entry.closes || 0} 
          highlight={entry.closes > 0}
          delay={0.2}
          clickable={hasSalesLog}
          onClick={onClosesClick}
        />
        <StatBox 
          label="FP+" 
          value={formatFP(fp)} 
          highlight={hasSales}
          delay={0.25}
          clickable={hasSalesLog}
          onClick={onFPClick}
        />
        <StatBox 
          label="PRMR" 
          value={`$${formatPRMR(prmr)}`} 
          highlight={hasSales}
          delay={0.3}
          clickable={hasSalesLog}
          onClick={onPRMRClick}
        />
      </div>
    </div>
  );
};
