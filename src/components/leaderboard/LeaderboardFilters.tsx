import { cn } from "@/lib/utils";

export type TimeFilter = 'live' | 'yesterday' | 'week' | 'month' | 'season' | 'ytd';
export type ScopeFilter = 'all' | 'rookies';

interface LeaderboardFiltersProps {
  timeFilter: TimeFilter;
  scopeFilter: ScopeFilter;
  onTimeFilterChange: (filter: TimeFilter) => void;
  onScopeFilterChange: (filter: ScopeFilter) => void;
}

export const LeaderboardFilters = ({
  timeFilter,
  scopeFilter,
  onTimeFilterChange,
  onScopeFilterChange,
}: LeaderboardFiltersProps) => {
  const timeOptions: { key: TimeFilter; label: string; isLive?: boolean }[] = [
    { key: 'live', label: 'Live', isLive: true },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
    { key: 'season', label: 'Season' },
    { key: 'ytd', label: 'YTD' },
  ];

  return (
    <div className="space-y-3">
      {/* Time Filter Pills */}
      <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
        <div className="flex gap-2 min-w-max">
          {timeOptions.map(({ key, label, isLive }) => (
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
              {label}
              {isLive && (
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
