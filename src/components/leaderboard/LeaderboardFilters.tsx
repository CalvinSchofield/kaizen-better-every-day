import { cn } from "@/lib/utils";
import { Calendar, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { TimeframeType, CustomDateRange } from "@/hooks/useExpandedLeaderboard";
import { useState } from "react";
import { DateRange } from "react-day-picker";

export type TimeFilter = TimeframeType;
export type ScopeFilter = 'all' | 'rookies';

interface LeaderboardFiltersProps {
  timeFilter: TimeFilter;
  scopeFilter: ScopeFilter;
  availablePresets: TimeFilter[];
  customDateRange?: CustomDateRange;
  onTimeFilterChange: (filter: TimeFilter) => void;
  onScopeFilterChange: (filter: ScopeFilter) => void;
  onCustomDateRangeChange?: (range: CustomDateRange) => void;
}

const timeLabels: Record<TimeFilter, string> = {
  live: 'Live',
  yesterday: 'Yesterday',
  week: 'Week',
  month: 'Month',
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
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [tempRange, setTempRange] = useState<DateRange | undefined>(
    customDateRange 
      ? { from: new Date(customDateRange.start + 'T12:00:00'), to: new Date(customDateRange.end + 'T12:00:00') }
      : undefined
  );

  const handleDateSelect = (range: DateRange | undefined) => {
    setTempRange(range);
    if (range?.from && range?.to && onCustomDateRangeChange) {
      const start = format(range.from, 'yyyy-MM-dd');
      const end = format(range.to, 'yyyy-MM-dd');
      onCustomDateRangeChange({ start, end });
      onTimeFilterChange('custom');
      setDatePickerOpen(false);
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
          
          {/* Custom Date Range Picker */}
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-1.5",
                  timeFilter === 'custom'
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-secondary/60 text-secondary-foreground hover:bg-secondary"
                )}
              >
                <Calendar className="h-3.5 w-3.5" />
                {getCustomLabel()}
                <ChevronDown className="h-3 w-3" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="range"
                selected={tempRange}
                onSelect={handleDateSelect}
                numberOfMonths={1}
                disabled={(date) => date > new Date()}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
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
