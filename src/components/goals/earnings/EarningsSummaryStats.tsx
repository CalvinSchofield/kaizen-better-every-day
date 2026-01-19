import { motion } from 'framer-motion';

interface EarningsSummaryStatsProps {
  payRate: number;
  totalKnockingDays: number;
  totalPrmr: number;
  isProjected: boolean;
  projectedPayRate: number;
  projectedTotalPrmr: number;
}

export const EarningsSummaryStats = ({
  payRate,
  totalKnockingDays,
  totalPrmr,
  isProjected,
  projectedPayRate,
  projectedTotalPrmr,
}: EarningsSummaryStatsProps) => {
  const displayRate = isProjected ? projectedPayRate : payRate;
  const displayPrmr = isProjected ? projectedTotalPrmr : totalPrmr;

  const stats = [
    {
      value: `$${displayRate}`,
      label: '/PRMR Rate',
      delay: 0,
    },
    {
      value: totalKnockingDays.toString(),
      label: 'Days Worked',
      delay: 0.1,
    },
    {
      value: `$${Math.round(displayPrmr).toLocaleString()}`,
      label: 'Total PRMR',
      delay: 0.2,
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {stats.map((stat) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: stat.delay }}
          className="p-3 rounded-xl bg-muted/50 text-center"
        >
          <motion.div
            key={stat.value}
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="text-lg font-bold"
          >
            {stat.value}
          </motion.div>
          <div className="text-[10px] text-muted-foreground">{stat.label}</div>
        </motion.div>
      ))}
    </div>
  );
};
