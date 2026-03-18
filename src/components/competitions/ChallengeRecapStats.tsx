import { motion } from 'framer-motion';
import { RecapStats } from '@/hooks/useChallengeRecap';
import { ChallengeMetric } from '@/hooks/useChallenges';
import { metricConfig } from '@/utils/challengeMetricConfig';
import { Trophy, Calendar, TrendingUp, Repeat } from 'lucide-react';

interface ChallengeRecapStatsProps {
  stats: RecapStats;
  metric: ChallengeMetric;
}

export const ChallengeRecapStats = ({ stats, metric }: ChallengeRecapStatsProps) => {
  const config = metricConfig[metric];

  const items = [
    {
      icon: Calendar,
      label: 'Duration',
      value: `${stats.duration} day${stats.duration !== 1 ? 's' : ''}`,
    },
    {
      icon: TrendingUp,
      label: 'Margin',
      value: stats.margin === 0 ? 'Tied' : config.format(stats.margin),
    },
    {
      icon: Repeat,
      label: 'Lead Changes',
      value: stats.leadChanges.toString(),
    },
    {
      icon: Trophy,
      label: 'Best Day',
      value: stats.bestDay ? `${stats.bestDay.name}` : '—',
      subValue: stats.bestDay ? config.format(stats.bestDay.value) : undefined,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
    >
      <p className="text-xs font-semibold text-muted-foreground mb-2.5 px-1">Competition Stats</p>
      <div className="grid grid-cols-2 gap-2">
        {items.map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.55 + i * 0.05 }}
            className="bg-muted/40 rounded-xl p-3 space-y-1"
          >
            <div className="flex items-center gap-1.5">
              <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{item.label}</span>
            </div>
            <p className="text-base font-bold text-foreground">{item.value}</p>
            {item.subValue && (
              <p className="text-xs text-muted-foreground">{item.subValue}</p>
            )}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};
