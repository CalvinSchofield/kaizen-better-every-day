import { useState, useMemo, useCallback } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { 
  useParticipantPool, 
  filterAndSortReps, 
  ParticipantRep,
  ScopeFilter,
  YearFilter 
} from "@/hooks/useParticipantPool";
import { YearBadge } from "./YearBadge";
import { CalendarCheck, Loader2, Search, X, Users, User, Building2 } from "lucide-react";
import { getInitials } from "@/utils/nameUtils";

interface ParticipantPickerV2Props {
  selectedUserIds: string[];
  allSelected: boolean;
  onToggleUser: (userId: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  dateRange?: { start: Date; end: Date };
  showSelfInList?: boolean;
  /** Pre-select a scope */
  defaultScope?: ScopeFilter;
}

const scopeLabels: Record<ScopeFilter, { label: string; icon: typeof User }> = {
  my_recruits: { label: 'My Recruits', icon: User },
  my_team: { label: 'My Team', icon: Users },
  my_mgmt: { label: 'My MGMT', icon: Building2 },
  all_office: { label: 'All Office', icon: Users },
};

const yearLabels: Record<YearFilter, string> = {
  rookie: 'Rookies',
  sophomore: 'Sophs',
  vet: 'Vets',
};

export const ParticipantPickerV2 = ({
  selectedUserIds,
  allSelected,
  onToggleUser,
  onSelectAll,
  onClear,
  dateRange,
  showSelfInList = true,
  defaultScope,
}: ParticipantPickerV2Props) => {
  const {
    allReps,
    accessLevel,
    availableScopes,
    workingUserIds,
    isLoading,
    currentUserId,
  } = useParticipantPool({ dateRange, includeCurrentUser: showSelfInList });
  
  // Default to first available scope or "all_office"
  const [scope, setScope] = useState<ScopeFilter>(
    defaultScope && availableScopes.includes(defaultScope) 
      ? defaultScope 
      : availableScopes[0] || 'all_office'
  );
  const [yearFilters, setYearFilters] = useState<Set<YearFilter>>(new Set());
  const [workingOnly, setWorkingOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Toggle year filter
  const toggleYearFilter = useCallback((year: YearFilter) => {
    setYearFilters(prev => {
      const next = new Set(prev);
      if (next.has(year)) {
        next.delete(year);
      } else {
        next.add(year);
      }
      return next;
    });
  }, []);
  
  // Filter and group reps
  const { grouped, total } = useMemo(() => {
    return filterAndSortReps(allReps, {
      scope,
      yearFilters,
      workingOnly,
      searchQuery,
      currentUserId,
    });
  }, [allReps, scope, yearFilters, workingOnly, searchQuery, currentUserId]);
  
  // Count how many are selected from visible reps
  const visibleSelectedCount = useMemo(() => {
    if (allSelected) return total;
    let count = 0;
    grouped.forEach(reps => {
      reps.forEach(rep => {
        if (selectedUserIds.includes(rep.userId)) count++;
      });
    });
    return count;
  }, [allSelected, grouped, selectedUserIds, total]);
  
  // Render a single rep row
  const renderRepItem = (rep: ParticipantRep) => {
    const isChecked = allSelected || selectedUserIds.includes(rep.userId);
    const isSelf = rep.userId === currentUserId;
    
    return (
      <label
        key={rep.userId}
        className={cn(
          "flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-colors",
          "active:scale-[0.98] active:bg-muted",
          isChecked ? "bg-primary/10" : "hover:bg-muted/50"
        )}
      >
        <Checkbox
          checked={isChecked}
          onCheckedChange={() => onToggleUser(rep.userId)}
          className="h-5 w-5"
        />
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs">{getInitials(rep.name)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">
              {rep.name}
              {isSelf && <span className="text-muted-foreground ml-1">(You)</span>}
            </span>
            <YearBadge year={rep.year} />
          </div>
          {rep.teamName && (
            <span className="text-xs text-muted-foreground truncate block">{rep.teamName}</span>
          )}
        </div>
        {rep.isWorking && (
          <CalendarCheck className="h-4 w-4 text-green-500 shrink-0" />
        )}
      </label>
    );
  };
  
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Participants</Label>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onSelectAll} className="h-7 text-xs">
            Select All
          </Button>
          <Button variant="outline" size="sm" onClick={onClear} className="h-7 text-xs">
            Clear
          </Button>
        </div>
      </div>
      
      {/* Scope Filter Chips */}
      {availableScopes.length > 1 && (
        <div className="flex gap-1.5 flex-wrap">
          {availableScopes.map(s => {
            const { label, icon: Icon } = scopeLabels[s];
            const isActive = scope === s;
            return (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                  "active:scale-[0.97]",
                  isActive 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                )}
              >
                <Icon className="h-3 w-3" />
                {label}
              </button>
            );
          })}
        </div>
      )}
      
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search by name or team..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 pr-9 h-10"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      
      {/* Year + Working Filter Chips */}
      <div className="flex gap-1.5 flex-wrap">
        {(Object.entries(yearLabels) as [YearFilter, string][]).map(([year, label]) => {
          const isActive = yearFilters.has(year);
          return (
            <button
              key={year}
              onClick={() => toggleYearFilter(year)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                "active:scale-[0.97]",
                isActive 
                  ? "bg-secondary text-secondary-foreground" 
                  : "bg-muted/60 hover:bg-muted text-muted-foreground"
              )}
            >
              {label}
            </button>
          );
        })}
        
        {dateRange && (
          <button
            onClick={() => setWorkingOnly(!workingOnly)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
              "active:scale-[0.97]",
              workingOnly 
                ? "bg-green-500/20 text-green-700 dark:text-green-400" 
                : "bg-muted/60 hover:bg-muted text-muted-foreground"
            )}
          >
            <CalendarCheck className="h-3 w-3" />
            Working ({workingUserIds.size})
          </button>
        )}
      </div>
      
      {/* Selection Summary */}
      <div className="p-3 rounded-xl bg-muted/50 border border-border">
        <p className="text-sm font-medium">
          {allSelected 
            ? `All ${total} reps selected`
            : visibleSelectedCount === 0
              ? 'No participants selected'
              : `${visibleSelectedCount} of ${total} selected`
          }
        </p>
      </div>
      
      {/* Rep List */}
      <div className="max-h-60 overflow-y-auto space-y-1 rounded-xl border border-border p-2">
        {isLoading && (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Loading participants...
          </div>
        )}
        
        {!isLoading && total === 0 && (
          <div className="text-center py-6 text-sm text-muted-foreground">
            {searchQuery ? (
              <>
                No participants match "{searchQuery}"
                <button
                  onClick={() => setSearchQuery('')}
                  className="block mx-auto mt-2 text-primary hover:underline text-xs"
                >
                  Clear search
                </button>
              </>
            ) : yearFilters.size > 0 || workingOnly ? (
              <>
                No participants match your filters
                <button
                  onClick={() => { setYearFilters(new Set()); setWorkingOnly(false); }}
                  className="block mx-auto mt-2 text-primary hover:underline text-xs"
                >
                  Clear filters
                </button>
              </>
            ) : (
              'No eligible participants found'
            )}
          </div>
        )}
        
        {!isLoading && total > 0 && (
          <>
            {Array.from(grouped.entries()).map(([groupName, reps]) => (
              <div key={groupName} className="space-y-0.5">
                {/* Group header */}
                <div className="text-xs font-semibold text-muted-foreground px-2 pt-2 pb-1 sticky top-0 bg-background/95 backdrop-blur-sm">
                  {groupName} ({reps.length})
                </div>
                {reps.map(rep => renderRepItem(rep))}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};
