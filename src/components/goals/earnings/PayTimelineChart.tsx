import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';

interface PayTimelineChartProps {
  upfrontPay: number;
  backend1: number;
  backend2: number;
  totalGross: number;
  isProjected: boolean;
}

export const PayTimelineChart = ({
  upfrontPay,
  backend1,
  backend2,
  totalGross,
  isProjected,
}: PayTimelineChartProps) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const maxValue = totalGross;
  const getBarWidth = (value: number) => {
    if (maxValue <= 0) return 0;
    return (value / maxValue) * 100;
  };

  const timelineItems = [
    {
      label: 'Upfront (×4)',
      subLabel: '~2 wks post-install',
      value: upfrontPay,
      color: 'bg-success',
      delay: 0,
    },
    {
      label: 'Backend 1 (70%)',
      subLabel: 'Mid-season payout',
      value: backend1,
      color: 'bg-primary',
      delay: 0.1,
    },
    {
      label: 'Backend 2 (30%+Ext)',
      subLabel: 'End of season',
      value: backend2,
      color: 'bg-primary/70',
      delay: 0.2,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Pay Timeline {isProjected && '(Projected)'}
      </div>
      
      <div className="space-y-3">
        {timelineItems.map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: item.delay, duration: 0.3 }}
            className="space-y-1"
          >
            <div className="flex justify-between items-baseline">
              <span className="text-sm font-medium">{item.label}</span>
              <motion.span
                key={item.value}
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                className="text-sm font-semibold"
              >
                {formatCurrency(item.value)}
              </motion.span>
            </div>
            <div className="h-2.5 bg-muted/50 rounded-full overflow-hidden">
              <motion.div
                className={`h-full ${item.color} rounded-full`}
                initial={{ width: 0 }}
                animate={{ width: `${getBarWidth(item.value)}%` }}
                transition={{ delay: item.delay + 0.2, duration: 0.5, ease: "easeOut" }}
              />
            </div>
            <div className="text-[10px] text-muted-foreground">{item.subLabel}</div>
          </motion.div>
        ))}
      </div>

      {/* Total */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="pt-3 border-t border-border/50 flex justify-between items-center"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-success" />
          <span className="text-sm font-medium">Gross Total</span>
        </div>
        <motion.span
          key={totalGross}
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          className="font-bold text-lg text-success"
        >
          {formatCurrency(totalGross)}
        </motion.span>
      </motion.div>
    </div>
  );
};
