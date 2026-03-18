import { motion } from 'framer-motion';
import { RecapMoment, RecapDay } from '@/hooks/useChallengeRecap';
import { ChallengeMetric } from '@/hooks/useChallenges';
import { metricConfig } from '@/utils/challengeMetricConfig';
import { format, parseISO } from 'date-fns';
import { Area, ComposedChart, Line, ResponsiveContainer, YAxis } from 'recharts';

interface ChallengeRaceTimelineProps {
  moments: RecapMoment[];
  days: RecapDay[];
  participantIds: [string, string];
  participantNames: Record<string, string>;
  metric: ChallengeMetric;
  winnerId?: string | null;
}

const momentIcons: Record<string, string> = {
  first_score: '🎯',
  lead_change: '🔄',
  biggest_day: '🔥',
  final: '🏁',
};

export const ChallengeRaceTimeline = ({
  moments,
  days,
  participantIds,
  participantNames,
  metric,
  winnerId,
}: ChallengeRaceTimelineProps) => {
  const config = metricConfig[metric];
  const [p1, p2] = participantIds;

  // Chart data for cumulative sparkline
  const chartData = days.map(d => ({
    day: d.dayNumber,
    p1: d.cumulative[p1] ?? 0,
    p2: d.cumulative[p2] ?? 0,
  }));

  return (
    <div className="space-y-4">
      {/* Cumulative sparkline */}
      {chartData.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-muted/30 rounded-2xl p-3"
        >
          <p className="text-xs font-semibold text-muted-foreground mb-2 px-1">Race Progress</p>
          <ResponsiveContainer width="100%" height={100}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <YAxis hide domain={['auto', 'auto']} />
              <defs>
                <linearGradient id="recap-p1-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="p1"
                fill="url(#recap-p1-grad)"
                stroke="none"
              />
              <Line
                type="monotone"
                dataKey="p1"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="p2"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                strokeOpacity={0.6}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-1">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-primary" />
              <span className="text-[10px] text-muted-foreground font-medium">{participantNames[p1]}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/40 border border-dashed border-muted-foreground/50" />
              <span className="text-[10px] text-muted-foreground">{participantNames[p2]}</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Key moments timeline */}
      {moments.length > 0 && (
        <div className="relative">
          <p className="text-xs font-semibold text-muted-foreground mb-3 px-1">Key Moments</p>
          {/* Vertical line */}
          <div className="absolute left-4 top-8 bottom-2 w-px bg-border" />

          <div className="space-y-0">
            {moments.map((moment, i) => (
              <motion.div
                key={`${moment.dayNumber}-${moment.type}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.08 }}
                className="relative flex items-start gap-3 pl-1 py-2"
              >
                {/* Dot on timeline */}
                <div className="relative z-10 flex items-center justify-center w-7 h-7 rounded-full bg-card border-2 border-border text-sm shrink-0">
                  {momentIcons[moment.type] || '•'}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground font-medium">
                      Day {moment.dayNumber} · {format(parseISO(moment.date), 'MMM d')}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground mt-0.5">
                    {moment.narrative}
                  </p>
                  {moment.value !== undefined && moment.value > 0 && (
                    <span className="text-xs text-muted-foreground">
                      +{config.format(moment.value)} {config.unit}
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
