import { cn } from "@/lib/utils";
import type { TimeframeType } from "@/hooks/useExpandedLeaderboard";

export type TimeFilter = TimeframeType;
export type ScopeFilter = 'all' | 'rookies';

interface LeaderboardFiltersProps {
  timeFilter: TimeFilter;
  scopeFilter: ScopeFilter;
  availablePresets: TimeFilter[];
  onTimeFilterChange: (filter: TimeFilter) => void;
  onScopeFilterChange: (filter: ScopeFilter) => void;
}

const timeLabels: Record<TimeFilter, string> = {
  live: 'Live',
  yesterday: 'Yesterday',
  week: 'Week',
  month: 'Month',
  season: 'Preseason',
  ytd: 'YTD',
};

export const LeaderboardFilters = ({
  timeFilter,
  scopeFilter,
  availablePresets,
  onTimeFilterChange,
  onScopeFilterChange,
}: LeaderboardFiltersProps) => {
  return (
    <div className="space-y-3">
      {/* Time Filter Pills */}
      <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
        <div className="flex gap-2 min-w-max">
          {availablePresets.map((key) => (
            <button
              key={key}
              onClick={() => onTimeFilterChange(key)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-1.5",
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

      {/* Scope Toggle */}
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
        </div>
      </div>
    </div>
  );
};
