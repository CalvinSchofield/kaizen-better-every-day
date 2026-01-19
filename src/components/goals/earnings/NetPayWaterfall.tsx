import { motion } from 'framer-motion';
import { Home, Gift, Receipt, PiggyBank, ArrowDown } from 'lucide-react';

interface NetPayWaterfallProps {
  grossPay: number;
  rentCost: number;
  rentBonus: number;
  spending: number;
  netPay: number;
  weeksWorking: number;
  rentType: string;
  isProjected: boolean;
  efpModeEnabled: boolean;
  spendingRate: number;
  hasCustomRate: boolean;
  dataAccuracy: number;
  onEditSpendingRate: () => void;
}

export const NetPayWaterfall = ({
  grossPay,
  rentCost,
  rentBonus,
  spending,
  netPay,
  weeksWorking,
  rentType,
  isProjected,
  efpModeEnabled,
  spendingRate,
  hasCustomRate,
  dataAccuracy,
  onEditSpendingRate,
}: NetPayWaterfallProps) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const deductions = [
    ...(rentCost > 0 ? [{
      icon: Home,
      label: `Rent (${weeksWorking}wks × ${rentType})`,
      value: -rentCost,
      color: 'text-destructive',
      delay: 0.1,
    }] : []),
    ...(rentBonus > 0 ? [{
      icon: Gift,
      label: 'Rent Bonus',
      value: rentBonus,
      color: 'text-success',
      delay: 0.2,
    }] : []),
    {
      icon: Receipt,
      label: `Spending ${isProjected ? '(Est.)' : ''}`,
      sublabel: hasCustomRate 
        ? `Custom: $${spendingRate.toFixed(0)}/${efpModeEnabled ? 'EFP' : 'FP+'}` 
        : `${Math.round(dataAccuracy)}% tracked`,
      value: -spending,
      color: 'text-destructive',
      delay: 0.3,
      editable: true,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Your Take-Home
      </div>

      <div className="rounded-xl bg-muted/30 p-4 space-y-0">
        {/* Starting Gross */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex justify-between items-center pb-2"
        >
          <span className="text-sm text-muted-foreground">Gross Pay</span>
          <span className="font-semibold">{formatCurrency(grossPay)}</span>
        </motion.div>

        {/* Flow arrows and deductions */}
        {deductions.map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: item.delay }}
            className="relative"
          >
            {/* Connector line */}
            <div className="flex items-center gap-2 py-1.5">
              <div className="flex-shrink-0 w-5 flex justify-center">
                <ArrowDown className="w-3 h-3 text-muted-foreground/50" />
              </div>
              <div className="flex-1 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <item.icon className={`w-4 h-4 ${item.color}`} />
                  <div className="flex flex-col">
                    <span className="text-sm">{item.label}</span>
                    {item.sublabel && (
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          item.editable && onEditSpendingRate();
                        }}
                        className="text-[10px] text-muted-foreground text-left hover:text-foreground transition-colors"
                      >
                        {item.sublabel}
                      </button>
                    )}
                  </div>
                </div>
                <span className={`font-semibold ${item.color}`}>
                  {item.value >= 0 ? '+' : ''}{formatCurrency(Math.abs(item.value))}
                </span>
              </div>
            </div>
          </motion.div>
        ))}

        {/* Final Net Pay */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="pt-3 mt-2 border-t-2 border-success/30"
        >
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <PiggyBank className="w-5 h-5 text-success" />
              <span className="font-medium">Net Take-Home</span>
            </div>
            <motion.div
              key={netPay}
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="text-xl font-bold text-success"
            >
              {formatCurrency(netPay)}
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
