import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Play, Calendar, ChevronDown, ChevronUp, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRecapData } from '@/hooks/useRecapData';
import { usePastRecaps } from '@/hooks/usePastRecaps';
import { useRecapDataForPeriod } from '@/hooks/useRecapDataForPeriod';
import { RecapStory } from './RecapStory';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

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

  if (!weekStats && !monthStats && !isLoading && weeklyRecaps.length === 0 && monthlyRecaps.length === 0) {
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

  // Effect to show story when past recap data loads
  if (selectedPastRecap && pastRecapStats && !showStory && !isLoadingPastRecap) {
    setTimeout(() => setShowStory(true), 0);
  }

  // Show first 3 by default, all if expanded
  const displayedWeeks = showAllWeeks ? weeklyRecaps : weeklyRecaps.slice(0, 3);
  const displayedMonths = showAllMonths ? monthlyRecaps : monthlyRecaps.slice(0, 3);

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

        {/* Past Weekly Recaps */}
        {weeklyRecaps.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Past Weeks</p>
            <div className="flex gap-2 flex-wrap">
              {displayedWeeks.map((recap) => {
                const isSelected = selectedPastRecap?.periodStart.getTime() === recap.period_start.getTime() 
                  && selectedPastRecap?.periodType === 'week';
                const isLoadingThis = isSelected && isLoadingPastRecap;
                const isWatched = recap.hasStoredRecap;
                
                return (
                  <Button
                    key={`week-${String(recap.period_start)}`}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "gap-2 text-xs transition-opacity",
                      isWatched && "opacity-50"
                    )}
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
                    ) : isWatched ? (
                      <Check className="w-3 h-3 text-green-500" />
                    ) : (
                      <Play className="w-3 h-3" />
                    )}
                    {recap.period_label}
                    <span className="text-muted-foreground">({Number(recap.total_fp ?? 0).toFixed(1)} FP)</span>
                  </Button>
                );
              })}
            </div>
            {weeklyRecaps.length > 3 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllWeeks(!showAllWeeks)}
                className="text-xs gap-1"
              >
                {showAllWeeks ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {showAllWeeks ? 'Show less' : `Show ${weeklyRecaps.length - 3} more`}
              </Button>
            )}
          </div>
        )}

        {/* Past Monthly Recaps */}
        {monthlyRecaps.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Past Months</p>
            <div className="flex gap-2 flex-wrap">
              {displayedMonths.map((recap) => {
                const isSelected = selectedPastRecap?.periodStart.getTime() === recap.period_start.getTime() 
                  && selectedPastRecap?.periodType === 'month';
                const isLoadingThis = isSelected && isLoadingPastRecap;
                const isWatched = recap.hasStoredRecap;
                
                return (
                  <Button
                    key={`month-${String(recap.period_start)}`}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "gap-2 text-xs transition-opacity",
                      isWatched && "opacity-50"
                    )}
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
                    ) : isWatched ? (
                      <Check className="w-3 h-3 text-green-500" />
                    ) : (
                      <Play className="w-3 h-3" />
                    )}
                    {recap.period_label}
                    <span className="text-muted-foreground">({Number(recap.total_fp ?? 0).toFixed(1)} FP)</span>
                  </Button>
                );
              })}
            </div>
            {monthlyRecaps.length > 3 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllMonths(!showAllMonths)}
                className="text-xs gap-1"
              >
                {showAllMonths ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {showAllMonths ? 'Show less' : `Show ${monthlyRecaps.length - 3} more`}
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
