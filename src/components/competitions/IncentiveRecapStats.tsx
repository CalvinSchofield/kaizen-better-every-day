import { motion } from 'framer-motion';
import { IncentiveRecapStats as StatsType } from '@/hooks/useIncentiveRecap';
import { IncentiveTargetType, IncentiveMetric } from '@/hooks/useIncentives';
import { metricConfig } from '@/utils/challengeMetricConfig';
import { Calendar, Trophy, Flame, TrendingUp } from 'lucide-react';

interface IncentiveRecapStatsProps {
  stats: StatsType;
  targetType: IncentiveTargetType;
  metric: IncentiveMetric;
  winnerName?: string;
}

export const IncentiveRecapStats = ({ stats, targetType, metric, winnerName }: IncentiveRecapStatsProps) => {
  const config = metricConfig[metric];

  const items: { icon: any; label: string; value: string }[] = [
    {
      icon: Calendar,
      label: 'Duration',
      value: `${stats.duration} day${stats.duration !== 1 ? 's' : ''}`,
    },
  ];

  // Second stat: result
  if (targetType === 'anyone_who') {
    items.push({ icon: Trophy, label: 'Qualified', value: `${stats.qualifiedCount || 0} reps` });
  } else if (targetType === 'group_total') {
    const pct = stats.targetValue ? Math.round(((stats.groupTotal || 0) / stats.targetValue) * 100) : 0;
    items.push({ icon: TrendingUp, label: 'Group Total', value: `${config.format(stats.groupTotal || 0)} (${pct}%)` });
  } else {
    items.push({ icon: Trophy, label: 'Winner', value: winnerName || '—' });
  }

  // Best day
  if (stats.bestDay && stats.duration > 1) {
    items.push({
      icon: Flame,
      label: 'Best Day',
      value: `${stats.bestDay.name} — ${config.format(stats.bestDay.value)}`,
    });
  }

  // Margin or lead changes
  if ((targetType === 'first_to' || targetType === 'most_by_end') && stats.margin > 0) {
    items.push({ icon: TrendingUp, label: 'Margin', value: config.format(stats.margin) });
  } else if (stats.leadChanges > 0) {
    items.push({ icon: TrendingUp, label: 'Lead Changes', value: `${stats.leadChanges}` });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="grid grid-cols-2 gap-2"
    >
      {items.map((item, i) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25 + i * 0.05 }}
          className="p-3 rounded-xl bg-muted/40 border border-border/50"
        >
          <div className="flex items-center gap-1.5 mb-1">
            <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{item.label}</span>
          </div>
          <p className="text-sm font-semibold text-foreground truncate">{item.value}</p>
        </motion.div>
      ))}
    </motion.div>
  );
};
