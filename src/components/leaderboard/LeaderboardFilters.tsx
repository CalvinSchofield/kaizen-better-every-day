import { cn } from "@/lib/utils";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { CustomDateRangeDrawer } from "@/components/shared/CustomDateRangeDrawer";
import type { TimeframeType, CustomDateRange } from "@/hooks/useExpandedLeaderboard";
import { useState } from "react";

export type TimeFilter = TimeframeType;
export type ScopeFilter = 'all' | 'rookies' | 'watchlist';

interface LeaderboardFiltersProps {
  timeFilter: TimeFilter;
  scopeFilter?: ScopeFilter;
  availablePresets: TimeFilter[];
  customDateRange?: CustomDateRange;
  onTimeFilterChange: (filter: TimeFilter) => void;
  onScopeFilterChange?: (filter: ScopeFilter) => void;
  onCustomDateRangeChange?: (range: CustomDateRange) => void;
}

const timeLabels: Record<TimeFilter, string> = {
  live: 'Live',
  yesterday: 'Yesterday',
  week: 'This Week',
  month: 'This Month',
  season: 'Preseason',
  ytd: 'YTD',
  custom: 'Custom',
};

export const LeaderboardFilters = ({
  timeFilter,
  scopeFilter,
  availablePresets,
  customDateRange,
  onTimeFilterChange,
  onScopeFilterChange,
  onCustomDateRangeChange,
}: LeaderboardFiltersProps) => {
  const [showCustomDrawer, setShowCustomDrawer] = useState(false);

  const handleCustomApply = (start: Date, end: Date) => {
    if (onCustomDateRangeChange) {
      const startStr = format(start, 'yyyy-MM-dd');
      const endStr = format(end, 'yyyy-MM-dd');
      onCustomDateRangeChange({ start: startStr, end: endStr });
      onTimeFilterChange('custom');
    }
  };

  const getCustomLabel = () => {
    if (timeFilter === 'custom' && customDateRange) {
      const startDate = new Date(customDateRange.start + 'T12:00:00');
      const endDate = new Date(customDateRange.end + 'T12:00:00');
      if (customDateRange.start === customDateRange.end) {
        return format(startDate, 'MMM d');
      }
      return `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d')}`;
    }
    return 'Custom';
  };

  // Filter out 'custom' from scrollable presets
  const scrollablePresets = availablePresets.filter(k => k !== 'custom');

  return (
    <div className="space-y-3">
      {/* Time Filter: scrollable presets + pinned Custom */}
      <div className="flex items-center gap-0">
        {/* Scrollable presets */}
        <div className="flex-1 overflow-x-auto scrollbar-hide -ml-4 pl-4">
          <div className="flex gap-2 min-w-max pr-2">
            {scrollablePresets.map((key) => (
              <button
                key={key}
                onClick={() => onTimeFilterChange(key)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 flex-shrink-0",
                  timeFilter === key
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-secondary/60 text-secondary-foreground hover:bg-secondary"
                )}
              >
                {timeLabels[key]}
                {key === 'live' && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className={cn(
                      "relative inline-flex rounded-full h-2 w-2",
                      timeFilter === key ? "bg-green-300" : "bg-green-500"
                    )}></span>
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Pinned Custom button */}
        <div className="flex-shrink-0 pl-2 border-l border-border/50 -mr-4 pr-4">
          <button
            onClick={() => setShowCustomDrawer(true)}
            className={cn(
              "px-3.5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-1.5",
              timeFilter === 'custom'
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-secondary/60 text-secondary-foreground hover:bg-secondary"
            )}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            {getCustomLabel()}
          </button>
        </div>
      </div>

      {/* Scope Toggle */}
      {scopeFilter && onScopeFilterChange && (
        <div className="flex justify-end">
          <div className="flex items-center gap-0.5 bg-secondary/50 rounded-full p-0.5">
            <button
              onClick={() => onScopeFilterChange('all')}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                scopeFilter === 'all'
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              All
            </button>
            <button
              onClick={() => onScopeFilterChange('rookies')}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                scopeFilter === 'rookies'
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Rookies
            </button>
            <button
              onClick={() => onScopeFilterChange('watchlist')}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                scopeFilter === 'watchlist'
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              👀 Watchlist
            </button>
          </div>
        </div>
      )}

      {/* Custom Date Range Drawer */}
      <CustomDateRangeDrawer
        open={showCustomDrawer}
        onOpenChange={setShowCustomDrawer}
        startDate={customDateRange ? new Date(customDateRange.start + 'T12:00:00') : undefined}
        endDate={customDateRange ? new Date(customDateRange.end + 'T12:00:00') : undefined}
        onApply={handleCustomApply}
      />
    </div>
  );
};