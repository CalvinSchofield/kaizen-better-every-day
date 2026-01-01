import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Play, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRecapData } from '@/hooks/useRecapData';
import { usePastRecaps } from '@/hooks/usePastRecaps';
import { RecapStory } from './RecapStory';
import { format } from 'date-fns';

export function PastRecapsSection() {
  const [showStory, setShowStory] = useState(false);
  const [activeRecap, setActiveRecap] = useState<'week' | 'month' | null>(null);
  const [showAllWeeks, setShowAllWeeks] = useState(false);
  const [showAllMonths, setShowAllMonths] = useState(false);
  
  const { data: weekStats } = useRecapData('week');
  const { data: monthStats } = useRecapData('month');
  const { weeklyRecaps, monthlyRecaps, isLoading } = usePastRecaps();

  // Filter to only show unwatched recaps
  const unwatchedWeeklyRecaps = weeklyRecaps.filter(r => !r.hasStoredRecap);
  const unwatchedMonthlyRecaps = monthlyRecaps.filter(r => !r.hasStoredRecap);

  if (!weekStats && !monthStats && !isLoading && unwatchedWeeklyRecaps.length === 0 && unwatchedMonthlyRecaps.length === 0) {
    return null;
  }

  const handleOpenRecap = (type: 'week' | 'month') => {
    setActiveRecap(type);
    setShowStory(true);
  };

  // Show first 3 by default, all if expanded
  const displayedWeeks = showAllWeeks ? unwatchedWeeklyRecaps : unwatchedWeeklyRecaps.slice(0, 3);
  const displayedMonths = showAllMonths ? unwatchedMonthlyRecaps : unwatchedMonthlyRecaps.slice(0, 3);

  return (
    <>
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Recaps
        </h3>
        
        {/* Current Period Recaps */}
        <div className="flex gap-2 flex-wrap">
          {weekStats && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenRecap('week')}
              className="gap-2"
            >
              <Play className="w-3 h-3" />
              {weekStats.periodLabel}
            </Button>
          )}
          
          {monthStats && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenRecap('month')}
              className="gap-2"
            >
              <Play className="w-3 h-3" />
              {format(monthStats.dateRange.start, 'MMMM')}
            </Button>
          )}
        </div>

        {/* Past Weekly Recaps (Unwatched Only) */}
        {unwatchedWeeklyRecaps.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Past Weeks</p>
            <div className="flex gap-2 flex-wrap">
              {displayedWeeks.map((recap) => (
                <Button
                  key={`week-${String(recap.period_start)}`}
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-xs"
                  disabled
                >
                  <Play className="w-3 h-3" />
                  {recap.period_label}
                  <span className="text-muted-foreground">({Number(recap.total_fp ?? 0).toFixed(1)} FP)</span>
                </Button>
              ))}
            </div>
            {unwatchedWeeklyRecaps.length > 3 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllWeeks(!showAllWeeks)}
                className="text-xs gap-1"
              >
                {showAllWeeks ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {showAllWeeks ? 'Show less' : `Show ${unwatchedWeeklyRecaps.length - 3} more`}
              </Button>
            )}
          </div>
        )}

        {/* Past Monthly Recaps (Unwatched Only) */}
        {unwatchedMonthlyRecaps.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Past Months</p>
            <div className="flex gap-2 flex-wrap">
              {displayedMonths.map((recap) => (
                <Button
                  key={`month-${String(recap.period_start)}`}
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-xs"
                  disabled
                >
                  <Play className="w-3 h-3" />
                  {recap.period_label}
                  <span className="text-muted-foreground">({Number(recap.total_fp ?? 0).toFixed(1)} FP)</span>
                </Button>
              ))}
            </div>
            {unwatchedMonthlyRecaps.length > 3 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllMonths(!showAllMonths)}
                className="text-xs gap-1"
              >
                {showAllMonths ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {showAllMonths ? 'Show less' : `Show ${unwatchedMonthlyRecaps.length - 3} more`}
              </Button>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showStory && activeRecap && (
          <RecapStory
            stats={activeRecap === 'week' ? weekStats! : monthStats!}
            onClose={() => setShowStory(false)}
            onComplete={() => {}}
          />
        )}
      </AnimatePresence>
    </>
  );
}
