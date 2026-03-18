import { motion } from 'framer-motion';
import { IncentiveRecapData, IncentiveRecapMoment } from '@/hooks/useIncentiveRecap';
import { IncentiveMetric, IncentiveTargetType } from '@/hooks/useIncentives';
import { metricConfig } from '@/utils/challengeMetricConfig';
import { format, parseISO } from 'date-fns';
import { Area, ComposedChart, Line, ResponsiveContainer, YAxis, ReferenceLine } from 'recharts';
import { SingleDayRaceTimeline } from './SingleDayRaceTimeline';

interface IncentiveRaceTimelineProps {
  data: IncentiveRecapData;
  metric: IncentiveMetric;
  targetType: IncentiveTargetType;
  targetValue?: number | null;
  winnerId?: string | null;
}

const momentIcons: Record<string, string> = {
  first_score: '🎯',
  lead_change: '🔄',
  biggest_day: '🔥',
  final: '🏁',
  milestone: '📍',
  qualified: '🏆',
};

export const IncentiveRaceTimeline = ({
  data,
  metric,
  targetType,
  targetValue,
  winnerId,
}: IncentiveRaceTimelineProps) => {
  const config = metricConfig[metric];
  const { days, moments, participantNames, intraDayData } = data;
  const isSingleDay = days.length <= 1;
  const isGroupTotal = targetType === 'group_total';

  // For single-day incentives, show intra-day timeline
  if (isSingleDay && intraDayData && intraDayData.moments.length > 0) {
    // Pick top 2 participants by score for the timeline display
    const participantIds = Object.keys(participantNames);
    const sortedByScore = [...participantIds].sort((a, b) => {
      const lastMoment = intraDayData.moments[intraDayData.moments.length - 1];
      return (lastMoment?.runningScore[b] || 0) - (lastMoment?.runningScore[a] || 0);
    });
    const topTwo = sortedByScore.slice(0, 2) as [string, string];

    return (
      <div className="space-y-3">
        <SingleDayRaceTimeline
          data={intraDayData}
          participantIds={topTwo}
          metric={metric}
          winnerId={winnerId}
        />
      </div>
    );
  }

  if (days.length < 2 && (!intraDayData || intraDayData.moments.length === 0)) {
    return (
      <div className="text-center py-4 text-muted-foreground text-sm">
        No activity data recorded
      </div>
    );
  }

  // Chart data
  const participantIds = Object.keys(participantNames);

  let chartData: any[];
  let chartLines: JSX.Element[];

  if (isGroupTotal) {
    chartData = days.map(d => ({ day: d.dayNumber, group: d.groupTotal || 0 }));
    chartLines = [
      <Area key="group-area" type="monotone" dataKey="group" fill="url(#recap-incentive-grad)" stroke="none" />,
      <Line key="group-line" type="monotone" dataKey="group" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} />,
    ];
  } else {
    // Show top 3 participants
    const sortedParticipants = [...participantIds].sort((a, b) => {
      const lastDay = days[days.length - 1];
      return (lastDay?.cumulative[b] || 0) - (lastDay?.cumulative[a] || 0);
    });
    const topParticipants = sortedParticipants.slice(0, 3);

    chartData = days.map(d => {
      const point: any = { day: d.dayNumber };
      topParticipants.forEach((uid, i) => { point[`p${i}`] = d.cumulative[uid] || 0; });
      return point;
    });

    const colors = ['hsl(var(--primary))', 'hsl(var(--muted-foreground))', 'hsl(var(--muted-foreground))'];
    const opacities = [1, 0.5, 0.3];

    chartLines = topParticipants.map((uid, i) => (
      <Line
        key={uid}
        type="monotone"
        dataKey={`p${i}`}
        stroke={colors[i]}
        strokeWidth={i === 0 ? 2.5 : 1.5}
        strokeDasharray={i > 0 ? '4 3' : undefined}
        strokeOpacity={opacities[i]}
        dot={false}
      />
    ));

    // Add area for first participant
    chartLines.unshift(
      <Area key="p0-area" type="monotone" dataKey="p0" fill="url(#recap-incentive-grad)" stroke="none" />
    );
  }

  // Legend
  const sortedForLegend = isGroupTotal
    ? null
    : [...participantIds]
        .sort((a, b) => (days[days.length - 1]?.cumulative[b] || 0) - (days[days.length - 1]?.cumulative[a] || 0))
        .slice(0, 3);

  return (
    <div className="space-y-4">
      {/* Sparkline chart */}
      {chartData.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-muted/30 rounded-2xl p-3"
        >
          <p className="text-xs font-semibold text-muted-foreground mb-2 px-1">
            {isGroupTotal ? 'Group Progress' : 'Race Progress'}
          </p>
          <ResponsiveContainer width="100%" height={100}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <YAxis hide domain={['auto', 'auto']} />
              <defs>
                <linearGradient id="recap-incentive-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              {isGroupTotal && targetValue && (
                <ReferenceLine y={targetValue} stroke="hsl(var(--primary))" strokeDasharray="3 3" strokeOpacity={0.5} />
              )}
              {chartLines}
            </ComposedChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="flex justify-center gap-4 mt-1 flex-wrap">
            {isGroupTotal ? (
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                <span className="text-[10px] text-muted-foreground font-medium">Group Total</span>
              </div>
            ) : sortedForLegend?.map((uid, i) => (
              <div key={uid} className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-full ${i === 0 ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
                <span className={`text-[10px] text-muted-foreground ${i === 0 ? 'font-medium' : ''}`}>
                  {participantNames[uid]}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Key moments timeline */}
      {moments.length > 0 && (
        <div className="relative">
          <p className="text-xs font-semibold text-muted-foreground mb-3 px-1">Key Moments</p>
          <div className="absolute left-4 top-8 bottom-2 w-px bg-border" />

          <div className="space-y-0">
            {moments.map((moment, i) => (
              <motion.div
                key={`${moment.dayNumber}-${moment.type}-${i}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.08 }}
                className="relative flex items-start gap-3 pl-1 py-2"
              >
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
