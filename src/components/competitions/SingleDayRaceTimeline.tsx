import { motion } from 'framer-motion';
import { IntraDayEvent, SingleDayRecapData } from '@/hooks/useSingleDayRecap';
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
  const { events, participantNames } = data;
  const [p1, p2] = participantIds;

  if (events.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground text-sm">
        No activity timestamps recorded for this day
      </div>
    );
  }

  // Determine color for each participant
  const isWinner = (uid: string) => uid === winnerId;

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

      {/* Event timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[18px] top-2 bottom-2 w-px bg-border" />

        <div className="space-y-0">
          {events.map((event, i) => {
            const isP1 = event.userId === p1;
            const isSale = event.type === 'sale';

            return (
              <motion.div
                key={`${event.time.getTime()}-${event.userId}-${i}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(0.3 + i * 0.04, 1.5) }}
                className="relative flex items-start gap-3 pl-1 py-1.5"
              >
                {/* Dot */}
                <div
                  className={`relative z-10 flex items-center justify-center w-[26px] h-[26px] rounded-full text-xs shrink-0 ${
                    isSale
                      ? 'bg-primary/15 border-2 border-primary'
                      : isP1
                        ? 'bg-primary/10 border-2 border-primary/50'
                        : 'bg-muted border-2 border-muted-foreground/30'
                  }`}
                >
                  {event.emoji}
                </div>

                <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                  <div>
                    <p className={`text-sm font-medium ${isSale ? 'text-foreground' : 'text-foreground/80'}`}>
                      {event.userName} — {event.label}
                    </p>
                    {event.runningTotal && (
                      <span className="text-[10px] text-muted-foreground">
                        {participantNames[p1]} {config.format(event.runningTotal[p1])} · {participantNames[p2]} {config.format(event.runningTotal[p2])}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap font-medium">
                    {event.timeStr}
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
