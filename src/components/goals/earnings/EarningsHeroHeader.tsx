import { motion } from 'framer-motion';
import { DollarSign, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { hapticLight } from '@/utils/haptics';

interface EarningsHeroHeaderProps {
  netPay: number;
  monthlyExpenses: number;
  isProjected: boolean;
  isOpen: boolean;
  projectionsAvailable: boolean;
  summerKnockingDays: number;
  currentFp: number;
  isRookie: boolean;
  isSummerStarted: boolean;
  onToggleProjected: (projected: boolean) => void;
}

export const EarningsHeroHeader = ({
  netPay,
  monthlyExpenses,
  isProjected,
  isOpen,
  projectionsAvailable,
  summerKnockingDays,
  currentFp,
  isRookie,
  isSummerStarted,
  onToggleProjected,
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
  
  const handleToggle = (projected: boolean) => {
    hapticLight();
    onToggleProjected(projected);
  };

  return (
    <div className="p-4 pb-3">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center">
            <DollarSign className="w-4 h-4 text-success" />
          </div>
          <span className="font-semibold">Earnings Breakdown</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Segment Control - Only show if projections are available */}
          {projectionsAvailable ? (
            <div 
              className="flex bg-muted rounded-full p-0.5" 
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => handleToggle(false)}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-full transition-all duration-200",
                  !isProjected 
                    ? "bg-background text-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-label="Current earnings"
              >
                Current
              </button>
              <button
                onClick={() => handleToggle(true)}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-full transition-all duration-200",
                  isProjected 
                    ? "bg-background text-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-label="Projected earnings"
              >
                Projected
              </button>
            </div>
          ) : (
            // Only show countdown badge if summer has started
            isSummerStarted && (
              <div className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                {isRookie ? (
                  // Rookies need 36 days OR 20 FP+
                  currentFp >= 20 
                    ? `${36 - summerKnockingDays} days until projections`
                    : summerKnockingDays >= 36
                      ? `${(20 - currentFp).toFixed(1)} FP+ until projections`
                      : `${36 - summerKnockingDays} days or ${(20 - currentFp).toFixed(1)} FP+`
                ) : (
                  `${18 - summerKnockingDays} days until projections`
                )}
              </div>
            )
          )}
          <ChevronDown className={cn(
            "w-4 h-4 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180"
          )} />
        </div>
      </div>

      {/* Hero Net Pay */}
      <div className="text-center space-y-1">
        <motion.div
          key={netPay}
          initial={{ scale: 0.95, opacity: 0.5 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="text-3xl font-bold bg-gradient-to-r from-success via-success to-emerald-400 bg-clip-text text-transparent"
        >
          {formatCurrency(netPay)}
        </motion.div>
        <div className="text-xs text-muted-foreground">
          {isProjected ? 'Projected' : 'Current'} Net Pay
        </div>
        {monthsCovered > 0 && (
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
      </div>
    </div>
  );
};
