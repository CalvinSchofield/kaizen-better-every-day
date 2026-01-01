import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Play, Calendar, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRecapData } from '@/hooks/useRecapData';
import { usePastRecaps } from '@/hooks/usePastRecaps';
import { useRecapDataForPeriod } from '@/hooks/useRecapDataForPeriod';
import { RecapStory } from './RecapStory';
import { format } from 'date-fns';

interface SelectedPastRecap {
  periodType: 'week' | 'month';
  periodStart: Date;
  periodEnd: Date;
  periodLabel: string;
}

export function PastRecapsSection() {
  const [showStory, setShowStory] = useState(false);
  const [activeRecap, setActiveRecap] = useState<'week' | 'month' | null>(null);
  const [selectedPastRecap, setSelectedPastRecap] = useState<SelectedPastRecap | null>(null);
  const [showAllWeeks, setShowAllWeeks] = useState(false);
  const [showAllMonths, setShowAllMonths] = useState(false);
  
  const { data: weekStats } = useRecapData('week');
  const { data: monthStats } = useRecapData('month');
  const { weeklyRecaps, monthlyRecaps, isLoading } = usePastRecaps();

  // Fetch data for selected past recap
  const { data: pastRecapStats, isLoading: isLoadingPastRecap } = useRecapDataForPeriod({
    periodType: selectedPastRecap?.periodType || 'week',
    periodStart: selectedPastRecap?.periodStart || new Date(),
    periodEnd: selectedPastRecap?.periodEnd || new Date(),
    periodLabel: selectedPastRecap?.periodLabel || '',
    enabled: !!selectedPastRecap,
  });

  // Filter to only show unwatched recaps
  const unwatchedWeeklyRecaps = weeklyRecaps.filter(r => !r.hasStoredRecap);
  const unwatchedMonthlyRecaps = monthlyRecaps.filter(r => !r.hasStoredRecap);

  if (!weekStats && !monthStats && !isLoading && unwatchedWeeklyRecaps.length === 0 && unwatchedMonthlyRecaps.length === 0) {
    return null;
  }

  const handleOpenRecap = (type: 'week' | 'month') => {
    setSelectedPastRecap(null);
    setActiveRecap(type);
    setShowStory(true);
  };

  const handleOpenPastRecap = (recap: {
    period_type: 'week' | 'month';
    period_start: Date;
    period_end: Date;
    period_label: string;
  }) => {
    setActiveRecap(null);
    setSelectedPastRecap({
      periodType: recap.period_type,
      periodStart: recap.period_start,
      periodEnd: recap.period_end,
      periodLabel: recap.period_label,
    });
  };

  // When past recap data is loaded, show the story
  const handleShowPastRecapStory = () => {
    if (pastRecapStats) {
      setShowStory(true);
    }
  };

  // Effect to show story when past recap data loads
  if (selectedPastRecap && pastRecapStats && !showStory && !isLoadingPastRecap) {
    // Use setTimeout to avoid state update during render
    setTimeout(() => setShowStory(true), 0);
  }

  // Show first 3 by default, all if expanded
  const displayedWeeks = showAllWeeks ? unwatchedWeeklyRecaps : unwatchedWeeklyRecaps.slice(0, 3);
  const displayedMonths = showAllMonths ? unwatchedMonthlyRecaps : unwatchedMonthlyRecaps.slice(0, 3);

  // Determine which stats to show in the story
  const storyStats = selectedPastRecap 
    ? pastRecapStats 
    : (activeRecap === 'week' ? weekStats : monthStats);

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
              {displayedWeeks.map((recap) => {
                const isSelected = selectedPastRecap?.periodStart.getTime() === recap.period_start.getTime() 
                  && selectedPastRecap?.periodType === 'week';
                const isLoadingThis = isSelected && isLoadingPastRecap;
                
                return (
                  <Button
                    key={`week-${String(recap.period_start)}`}
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-xs"
                    onClick={() => handleOpenPastRecap({
                      period_type: 'week',
                      period_start: recap.period_start,
                      period_end: recap.period_end,
                      period_label: recap.period_label,
                    })}
                    disabled={isLoadingThis}
                  >
                    {isLoadingThis ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Play className="w-3 h-3" />
                    )}
                    {recap.period_label}
                    <span className="text-muted-foreground">({Number(recap.total_fp ?? 0).toFixed(1)} FP)</span>
                  </Button>
                );
              })}
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
              {displayedMonths.map((recap) => {
                const isSelected = selectedPastRecap?.periodStart.getTime() === recap.period_start.getTime() 
                  && selectedPastRecap?.periodType === 'month';
                const isLoadingThis = isSelected && isLoadingPastRecap;
                
                return (
                  <Button
                    key={`month-${String(recap.period_start)}`}
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-xs"
                    onClick={() => handleOpenPastRecap({
                      period_type: 'month',
                      period_start: recap.period_start,
                      period_end: recap.period_end,
                      period_label: recap.period_label,
                    })}
                    disabled={isLoadingThis}
                  >
                    {isLoadingThis ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Play className="w-3 h-3" />
                    )}
                    {recap.period_label}
                    <span className="text-muted-foreground">({Number(recap.total_fp ?? 0).toFixed(1)} FP)</span>
                  </Button>
                );
              })}
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
        {showStory && storyStats && (
          <RecapStory
            stats={storyStats}
            onClose={() => {
              setShowStory(false);
              setSelectedPastRecap(null);
            }}
            onComplete={() => {}}
          />
        )}
      </AnimatePresence>
    </>
  );
}
