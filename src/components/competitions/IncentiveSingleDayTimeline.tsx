import { useState } from 'react';
import { motion } from 'framer-motion';
import { SingleDayRecapData, RecapMoment } from '@/hooks/useSingleDayRecap';
import { IncentiveMetric } from '@/hooks/useIncentives';
import { MomentPriority, getMomentPriority } from '@/hooks/useIncentiveRecap';
import { metricConfig } from '@/utils/challengeMetricConfig';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface IncentiveSingleDayTimelineProps {
  data: SingleDayRecapData;
  metric: IncentiveMetric;
  winnerId?: string | null;
}

export const IncentiveSingleDayTimeline = ({
  data,
  metric,
  winnerId,
}: IncentiveSingleDayTimelineProps) => {
  const [showMore, setShowMore] = useState(false);
  const config = metricConfig[metric];
  const { moments, participantNames } = data || {};
  const allMoments = moments || [];

  if (allMoments.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground text-sm">
        No activity timestamps recorded for this day
      </div>
    );
  }

  // Split moments by priority
  const highMoments = allMoments.filter(m => getMomentPriority(m.type, metric) === 'high');
  const drillDownMoments = allMoments.filter(m => getMomentPriority(m.type, metric) !== 'high');

  const isScoreEvent = (m: RecapMoment) => {
    if (metric === 'fp_plus' || metric === 'prmr') return m.type === 'sale';
    if (metric === 'transitions') return m.type === 'transition';
    if (metric === 'doors_knocked') return m.type === 'door_batch';
    return false;
  };

  const renderMoment = (moment: RecapMoment, i: number, delayBase: number) => {
    const isSale = moment.type === 'sale';
    const isStart = moment.type === 'started';
    const isDoorBatch = moment.type === 'door_batch';
    const isTransition = moment.type === 'transition';
    const showScore = isScoreEvent(moment);

    return (
      <motion.div
        key={`${moment.time.getTime()}-${moment.userId}-${i}`}
        initial={{ opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: Math.min(delayBase + i * 0.05, 1.2) }}
        className={`relative flex items-center gap-2.5 pl-0.5 ${isSale ? 'py-2' : 'py-1'}`}
      >
        {/* Dot */}
        <div
          className={`relative z-10 flex items-center justify-center shrink-0 text-xs ${
            isSale
              ? 'w-[30px] h-[30px] rounded-full bg-primary/15 border-2 border-primary'
              : isStart
                ? 'w-[22px] h-[22px] rounded-full bg-muted border border-border'
                : isDoorBatch || isTransition
                  ? 'w-[22px] h-[22px] rounded-full bg-muted/60 border border-border/60'
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
            {showScore && participantNames && (
              <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                {Object.entries(moment.runningScore)
                  .filter(([_, v]) => v > 0)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 4)
                  .map(([uid, val]) => `${participantNames[uid]} ${config.format(val)}`)
                  .join(' · ')}
              </p>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground/70 whitespace-nowrap">
            {moment.timeStr}
          </span>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-muted-foreground px-1">How It Played Out</p>

      {/* Main timeline - high priority moments */}
      <div className="relative">
        <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />
        <div className="space-y-0">
          {highMoments.map((moment, i) => renderMoment(moment, i, 0.15))}
        </div>
      </div>

      {/* Drill-down for lower priority moments */}
      {drillDownMoments.length > 0 && (
        <Collapsible open={showMore} onOpenChange={setShowMore}>
          <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-1 py-1">
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showMore ? 'rotate-180' : ''}`} />
            <span>{showMore ? 'Hide' : 'Show'} {drillDownMoments.length} more event{drillDownMoments.length !== 1 ? 's' : ''}</span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="relative mt-1">
              <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border/50" />
              <div className="space-y-0">
                {drillDownMoments.map((moment, i) => renderMoment(moment, i, 0))}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
};
