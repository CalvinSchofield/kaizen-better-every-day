import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, History } from 'lucide-react';

interface MeVsMeComparisonData {
  fpPlus: { current: number; historical: number };
  prmr: { current: number; historical: number };
  closes: { current: number; historical: number };
  presentations: { current: number; historical: number };
  transitions: { current: number; historical: number };
  hours: { current: number; historical: number };
  pitches: { current: number; historical: number };
  dms: { current: number; historical: number };
  doors: { current: number; historical: number };
}

interface RecapMeVsMeSlideProps {
  period: 'week' | 'month';
  comparisonYear: number;
  comparison: MeVsMeComparisonData | null;
  hasHistoricalData: boolean;
  efpModeEnabled?: boolean;
}

function DeltaRow({ 
  label, 
  current, 
  historical, 
  decimals = 0 
}: { 
  label: string; 
  current: number; 
  historical: number; 
  decimals?: number;
}) {
  const delta = current - historical;
  const isPositive = delta > 0;
  const isNeutral = delta === 0;
  const formatValue = (v: number) => decimals > 0 ? v.toFixed(decimals) : Math.round(v);
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center justify-between bg-muted/30 rounded-xl px-4 py-3"
    >
      <div className="flex flex-col">
        <span className="text-muted-foreground text-sm">{label}</span>
        <span className="text-xs text-muted-foreground/60">
          {formatValue(current)} vs {formatValue(historical)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {isNeutral ? (
          <>
            <Minus className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground font-medium">Tied</span>
          </>
        ) : isPositive ? (
          <>
            <TrendingUp className="w-4 h-4 text-green-500" />
            <span className="text-green-500 font-medium">+{formatValue(delta)}</span>
          </>
        ) : (
          <>
            <TrendingDown className="w-4 h-4 text-red-400" />
            <span className="text-red-400 font-medium">{formatValue(delta)}</span>
          </>
        )}
      </div>
    </motion.div>
  );
}

export function RecapMeVsMeSlide({ 
  period, 
  comparisonYear, 
  comparison, 
  hasHistoricalData,
  efpModeEnabled 
}: RecapMeVsMeSlideProps) {
  if (!hasHistoricalData || !comparison) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-muted/30 rounded-2xl p-6"
        >
          <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            No {comparisonYear} data available for comparison
          </p>
        </motion.div>
      </div>
    );
  }

  const periodLabel = period === 'week' ? 'This Week' : 'This Month';
  const vsLabel = period === 'week' 
    ? `Same Week in ${comparisonYear}`
    : `${new Date().toLocaleString('en-US', { month: 'long' })} ${comparisonYear}`;

  // Calculate primary metric and message
  const primaryMetric = efpModeEnabled 
    ? { label: 'EFP', current: comparison.fpPlus.current, historical: comparison.fpPlus.historical }
    : { label: 'FP+', current: comparison.fpPlus.current, historical: comparison.fpPlus.historical };
  
  const primaryDelta = primaryMetric.current - primaryMetric.historical;
  const beatingLastYear = primaryDelta > 0;

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="mb-2"
      >
        <History className="w-10 h-10 text-primary mx-auto" />
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="text-muted-foreground text-sm mb-1 uppercase tracking-wide"
      >
        Me vs Me
      </motion.p>

      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="text-2xl font-bold mb-1"
      >
        {beatingLastYear ? '🏆 Ahead of' : 'vs'} {comparisonYear}
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
        className="text-muted-foreground text-sm mb-6"
      >
        {periodLabel} vs {vsLabel}
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="space-y-3 w-full max-w-xs"
      >
        <DeltaRow 
          label={primaryMetric.label} 
          current={primaryMetric.current} 
          historical={primaryMetric.historical}
          decimals={1}
        />
        <DeltaRow 
          label="PRMR" 
          current={comparison.prmr.current} 
          historical={comparison.prmr.historical}
        />
        <DeltaRow 
          label="Closes" 
          current={comparison.closes.current} 
          historical={comparison.closes.historical}
        />
        <DeltaRow 
          label="Presentations" 
          current={comparison.presentations.current} 
          historical={comparison.presentations.historical}
        />
        <DeltaRow 
          label="Hours" 
          current={comparison.hours.current} 
          historical={comparison.hours.historical}
          decimals={1}
        />
        <DeltaRow 
          label="Doors" 
          current={comparison.doors.current} 
          historical={comparison.doors.historical}
        />
      </motion.div>
    </div>
  );
}
