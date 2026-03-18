import { motion } from 'framer-motion';
import { SingleDayRecapData, RecapMoment } from '@/hooks/useSingleDayRecap';
import { ChallengeMetric } from '@/hooks/useChallenges';
import { metricConfig } from '@/utils/challengeMetricConfig';

interface SingleDayRaceTimelineProps {
  data: SingleDayRecapData;
  participantIds: [string, string];
  metric: ChallengeMetric;
  winnerId?: string | null;
}

export const SingleDayRaceTimeline = ({
  data,
  participantIds,
  metric,
  winnerId,
}: SingleDayRaceTimelineProps) => {
  const config = metricConfig[metric];
  const { moments, participantNames } = data;
  const [p1, p2] = participantIds;

  // Filter out "started" moments if they add no value (both started)
  const visibleMoments = moments;

  if (visibleMoments.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground text-sm">
        No activity timestamps recorded for this day
      </div>
    );
  }

  // Only show running score on score-moving events
  const isScoreEvent = (m: RecapMoment) => {
    if (metric === 'fp_plus' || metric === 'prmr') return m.type === 'sale';
    if (metric === 'transitions') return m.type === 'transition';
    if (metric === 'doors_knocked') return m.type === 'door_batch';
    return false;
  };

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-muted-foreground px-1">How It Played Out</p>

      {/* Legend */}
      <div className="flex justify-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-primary" />
          <span className="text-[10px] text-muted-foreground font-medium">{participantNames[p1]}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/50" />
          <span className="text-[10px] text-muted-foreground">{participantNames[p2]}</span>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

        <div className="space-y-0">
          {visibleMoments.map((moment, i) => {
            const isP1 = moment.userId === p1;
            const isSale = moment.type === 'sale';
            const isStart = moment.type === 'started';
            const isDoorBatch = moment.type === 'door_batch';
            const showScore = isScoreEvent(moment);

            return (
              <motion.div
                key={`${moment.time.getTime()}-${moment.userId}-${i}`}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(0.15 + i * 0.05, 1.2) }}
                className={`relative flex items-center gap-2.5 pl-0.5 ${
                  isSale ? 'py-2' : 'py-1'
                }`}
              >
                {/* Dot */}
                <div
                  className={`relative z-10 flex items-center justify-center shrink-0 text-xs ${
                    isSale
                      ? 'w-[30px] h-[30px] rounded-full bg-primary/15 border-2 border-primary'
                      : isStart
                        ? 'w-[22px] h-[22px] rounded-full bg-muted border border-border'
                        : isDoorBatch
                          ? 'w-[22px] h-[22px] rounded-full bg-muted/60 border border-border/60'
                          : isP1
                            ? 'w-[24px] h-[24px] rounded-full bg-primary/10 border-[1.5px] border-primary/40'
                            : 'w-[24px] h-[24px] rounded-full bg-muted border-[1.5px] border-muted-foreground/25'
                  }`}
                >
                  <span className={isSale ? 'text-sm' : 'text-[11px]'}>{moment.emoji}</span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 flex items-center justify-between gap-1.5">
                  <div className="min-w-0">
                    <p className={`leading-tight ${
                      isSale
                        ? 'text-[13px] font-semibold text-foreground'
                        : isStart || isDoorBatch
                          ? 'text-[12px] text-muted-foreground'
                          : 'text-[12px] font-medium text-foreground/80'
                    }`}>
                      <span className="font-semibold">{moment.userName}</span>
                      {' · '}
                      {moment.label}
                    </p>
                    {showScore && (
                      <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                        {participantNames[p1]} {config.format(moment.runningScore[p1])} · {participantNames[p2]} {config.format(moment.runningScore[p2])}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground/70 whitespace-nowrap">
                    {moment.timeStr}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
