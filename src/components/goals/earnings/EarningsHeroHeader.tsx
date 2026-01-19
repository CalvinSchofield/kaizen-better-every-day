import { motion } from 'framer-motion';
import { DollarSign, ChevronDown, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { hapticLight } from '@/utils/haptics';

export type EarningsMode = 'current' | 'projected' | 'model';

interface EarningsHeroHeaderProps {
  netPay: number;
  monthlyExpenses: number;
  mode: EarningsMode;
  isOpen: boolean;
  projectionsAvailable: boolean;
  summerKnockingDays: number;
  currentFp: number;
  isRookie: boolean;
  isSummerStarted: boolean;
  modelFpGoal?: number;
  efpLabel: string;
  onModeChange: (mode: EarningsMode) => void;
}

export const EarningsHeroHeader = ({
  netPay,
  monthlyExpenses,
  mode,
  isOpen,
  projectionsAvailable,
  summerKnockingDays,
  currentFp,
  isRookie,
  isSummerStarted,
  modelFpGoal,
  efpLabel,
  onModeChange,
}: EarningsHeroHeaderProps) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const monthsCovered = monthlyExpenses > 0 ? netPay / monthlyExpenses : 0;
  
  const handleModeChange = (newMode: EarningsMode) => {
    hapticLight();
    onModeChange(newMode);
  };

  // Build the segment options
  const segments: { key: EarningsMode; label: string; disabled?: boolean }[] = [
    { key: 'current', label: 'Current' },
    { key: 'projected', label: 'Projected', disabled: !projectionsAvailable },
    { key: 'model', label: 'Model' },
  ];

  // Get display label based on mode
  const getModeLabel = () => {
    if (mode === 'model') {
      return modelFpGoal ? `Modeled at ${modelFpGoal} ${efpLabel}` : 'Model a Goal';
    }
    return mode === 'projected' ? 'Projected Net Pay' : 'Current Net Pay';
  };

  return (
    <div className="p-4 pb-3">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center">
            <DollarSign className="w-4 h-4 text-success" />
          </div>
          <span className="font-semibold">Earnings</span>
        </div>
        <div className="flex items-center gap-2">
          <ChevronDown className={cn(
            "w-4 h-4 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180"
          )} />
        </div>
      </div>

      {/* 3-Way Segment Control */}
      <div 
        className="flex bg-muted rounded-full p-0.5 mb-4" 
        onClick={(e) => e.stopPropagation()}
      >
        {segments.map((segment) => (
          <button
            key={segment.key}
            onClick={() => !segment.disabled && handleModeChange(segment.key)}
            disabled={segment.disabled}
            className={cn(
              "flex-1 px-2 py-1.5 text-xs font-medium rounded-full transition-all duration-200 relative",
              mode === segment.key
                ? "bg-background text-foreground shadow-sm" 
                : segment.disabled
                  ? "text-muted-foreground/40 cursor-not-allowed"
                  : "text-muted-foreground hover:text-foreground",
              segment.key === 'model' && mode === segment.key && "text-primary"
            )}
            aria-label={`${segment.label} earnings`}
          >
            <span className="flex items-center justify-center gap-1">
              {segment.label}
              {segment.key === 'model' && mode === segment.key && (
                <Sparkles className="w-3 h-3" />
              )}
            </span>
          </button>
        ))}
      </div>

      {/* Projection unlock hint - only when projected is disabled and summer has started */}
      {!projectionsAvailable && isSummerStarted && mode !== 'model' && (
        <div className="text-center mb-3">
          <div className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full inline-block">
            {isRookie ? (
              currentFp >= 20 
                ? `${36 - summerKnockingDays} days until projections`
                : summerKnockingDays >= 36
                  ? `${(20 - currentFp).toFixed(1)} FP+ until projections`
                  : `${36 - summerKnockingDays} days or ${(20 - currentFp).toFixed(1)} FP+`
            ) : (
              `${18 - summerKnockingDays} days until projections`
            )}
          </div>
        </div>
      )}

      {/* Hero Net Pay */}
      <div className="text-center space-y-1">
        <motion.div
          key={`${mode}-${netPay}`}
          initial={{ scale: 0.95, opacity: 0.5 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className={cn(
            "text-3xl font-bold bg-clip-text text-transparent",
            mode === 'model' 
              ? "bg-gradient-to-r from-primary via-primary to-violet-400"
              : "bg-gradient-to-r from-success via-success to-emerald-400"
          )}
        >
          {mode === 'model' && !modelFpGoal ? (
            <span className="text-muted-foreground text-xl">Enter a goal below</span>
          ) : (
            formatCurrency(netPay)
          )}
        </motion.div>
        <div className="text-xs text-muted-foreground">
          {getModeLabel()}
        </div>
        {monthsCovered > 0 && mode !== 'model' && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xs text-muted-foreground flex items-center justify-center gap-1"
          >
            <span className="text-sm">✨</span>
            <span>Covers <span className="text-foreground font-medium">{monthsCovered.toFixed(1)} months</span> of expenses</span>
          </motion.div>
        )}
        {mode === 'model' && modelFpGoal && monthsCovered > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xs text-muted-foreground flex items-center justify-center gap-1"
          >
            <Sparkles className="w-3 h-3 text-primary" />
            <span>Would cover <span className="text-foreground font-medium">{monthsCovered.toFixed(1)} months</span> of expenses</span>
          </motion.div>
        )}
      </div>
    </div>
  );
};
