import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, Trophy, Target } from 'lucide-react';
import { useHistoricalComparison } from '@/hooks/useHistoricalComparison';
import { useMeVsMe } from '@/hooks/useMeVsMe';
import { useEfpMode } from '@/hooks/useEfpMode';
import { getSeasonInfo } from '@/utils/seasonWeekUtils';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { startOfWeek, endOfWeek } from 'date-fns';

export const MeVsMeMotivationCard = () => {
  const { isEnabled, dataSummary } = useMeVsMe();
  const { efpModeEnabled } = useEfpMode();
  
  // Get current week's date range (Sunday to Saturday - selling week)
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 0 }); // Sunday
  const weekEnd = endOfWeek(now, { weekStartsOn: 0 }); // Saturday
  
  const seasonInfo = useMemo(() => getSeasonInfo(now), []);
  const comparisonYear = seasonInfo ? seasonInfo.year - 1 : new Date().getFullYear() - 1;
  
  const { comparisonData, hasHistoricalData, isLoading } = useHistoricalComparison({
    startDate: weekStart,
    endDate: now, // Only up to today, not the full week
    comparisonYear,
    enabled: isEnabled && !!seasonInfo,
  });

  // Don't show if not enabled or no historical data
  if (!isEnabled || !hasHistoricalData || isLoading || !comparisonData) {
    return null;
  }

  // Calculate the primary comparison metric based on priority
  const getComparisonMessage = () => {
    const d = comparisonData.delta;
    
    // Priority: EFP/FP+, closes, presentations, transitions, hours, pitches, dms, doors
    if (efpModeEnabled) {
      const efpDelta = d.prmr / 85; // Convert PRMR to EFP
      if (Math.abs(efpDelta) >= 0.1) {
        return {
          value: efpDelta,
          label: 'EFP',
          isAhead: efpDelta > 0,
        };
      }
    } else {
      if (Math.abs(d.fpPlus) >= 0.1) {
        return {
          value: d.fpPlus,
          label: 'FP+',
          isAhead: d.fpPlus > 0,
        };
      }
    }
    
    if (d.closes !== 0) {
      return { value: d.closes, label: d.closes === 1 || d.closes === -1 ? 'close' : 'closes', isAhead: d.closes > 0 };
    }
    if (d.presentations !== 0) {
      return { value: d.presentations, label: d.presentations === 1 || d.presentations === -1 ? 'presentation' : 'presentations', isAhead: d.presentations > 0 };
    }
    if (d.transitions !== 0) {
      return { value: d.transitions, label: d.transitions === 1 || d.transitions === -1 ? 'transition' : 'transitions', isAhead: d.transitions > 0 };
    }
    if (Math.abs(d.hours) >= 0.5) {
      return { value: d.hours, label: d.hours === 1 || d.hours === -1 ? 'hour' : 'hours', isAhead: d.hours > 0 };
    }
    if (d.pitches !== 0) {
      return { value: d.pitches, label: d.pitches === 1 || d.pitches === -1 ? 'pitch' : 'pitches', isAhead: d.pitches > 0 };
    }
    if (d.dms !== 0) {
      return { value: d.dms, label: d.dms === 1 || d.dms === -1 ? 'DM' : 'DMs', isAhead: d.dms > 0 };
    }
    if (d.doors !== 0) {
      return { value: d.doors, label: d.doors === 1 || d.doors === -1 ? 'door' : 'doors', isAhead: d.doors > 0 };
    }
    
    return null;
  };

  const comparison = getComparisonMessage();
  
  // If no meaningful difference, don't show the card
  if (!comparison) {
    return null;
  }

  const formatValue = (val: number) => {
    if (val % 1 !== 0) {
      return Math.abs(val).toFixed(1);
    }
    return Math.abs(val);
  };

  return (
    <Card className={cn(
      "overflow-hidden",
      comparison.isAhead ? "border-green-500/30 bg-green-500/5" : "border-destructive/30 bg-destructive/5"
    )}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex-shrink-0 p-2 rounded-full",
            comparison.isAhead ? "bg-green-500/20" : "bg-destructive/20"
          )}>
            {comparison.isAhead ? (
              <Trophy className="h-5 w-5 text-green-500" />
            ) : (
              <Target className="h-5 w-5 text-destructive" />
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground">
              {comparison.isAhead ? (
                <>Beating your {comparisonYear} self by {formatValue(comparison.value)} {comparison.label} this week!</>
              ) : (
                <>{formatValue(comparison.value)} {comparison.label} behind your {comparisonYear} pace this week</>
              )}
            </p>
            <p className="text-sm text-muted-foreground">
              Me vs Me • Week {seasonInfo?.week}
            </p>
          </div>
          
          <div className={cn(
            "flex-shrink-0",
            comparison.isAhead ? "text-green-500" : "text-destructive"
          )}>
            {comparison.isAhead ? (
              <TrendingUp className="h-5 w-5" />
            ) : comparison.value === 0 ? (
              <Minus className="h-5 w-5" />
            ) : (
              <TrendingDown className="h-5 w-5" />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
