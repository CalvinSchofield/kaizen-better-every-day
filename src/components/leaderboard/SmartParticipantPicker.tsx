import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { CalendarCheck, CalendarX, Loader2, Search, X } from "lucide-react";
import { format } from "date-fns";
import { getInitials } from "@/utils/nameUtils";

interface Rep {
  id: string;
  userId: string | null;
  name: string;
  phone?: string | null;
  year?: string | null;
  stage?: string | null;
  teamId?: string | null;
  teamName?: string | null;
  mgmtGroupId?: string | null;
  mgmtGroupName?: string | null;
}

interface SmartParticipantPickerProps {
  allReps: Rep[];
  selectedUserIds: string[];
  allSelected: boolean;
  onToggleUser: (userId: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  currentUserId?: string | null;
  currentUserRep?: { user_id: string; name: string } | null;
  dateRange?: { start: Date; end: Date };
  showSelfInList?: boolean;
}

// Normalize stage for filtering - maps display stages to canonical forms
const normalizeStage = (stage: string | null | undefined): string | null => {
  if (!stage) return null;
  const lower = stage.toLowerCase().trim();
  
  if (lower.includes('signed')) return 'signed';
  if (lower.includes('shadow') && lower.includes('✅')) return 'shadow_complete';
  if (lower.includes('shadow')) return 'shadow_complete';
  if (lower.includes('sold') && (lower.includes('5+') || lower.includes('💰'))) return 'sold_5_plus';
  if (lower.includes('sold')) return 'sold';
  if (lower.includes('evaluating')) return 'evaluating';
  if (lower.includes('reached')) return 'reached_out';
  if (lower.includes('100')) return '100_list';
  
  return lower;
};

// Active stages that should appear in the list
const ACTIVE_STAGES = ['signed', 'shadow_complete', 'sold', 'sold_5_plus'];

export const SmartParticipantPicker = ({
  allReps,
  selectedUserIds,
  allSelected,
  onToggleUser,
  onSelectAll,
  onClear,
  currentUserId,
  currentUserRep,
  dateRange,
  showSelfInList = true,
}: SmartParticipantPickerProps) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch planned work days within date range
  const { data: plannedWorkDays, isLoading: isLoadingPlannedDays } = useQuery({
    queryKey: ['planned-work-days-for-picker', dateRange ? format(dateRange.start, 'yyyy-MM-dd') : null, dateRange ? format(dateRange.end, 'yyyy-MM-dd') : null],
    queryFn: async () => {
      if (!dateRange) return {};
      
      const startStr = format(dateRange.start, 'yyyy-MM-dd');
      const endStr = format(dateRange.end, 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('planned_work_days')
        .select('user_id, planned_date')
        .gte('planned_date', startStr)
        .lte('planned_date', endStr);
      
      if (error) {
        console.error('Error fetching planned work days:', error);
        return {};
      }
      
      const userPlannedDays: Record<string, boolean> = {};
      data?.forEach(row => {
        if (row.user_id) {
          userPlannedDays[row.user_id] = true;
        }
      });
      
      return userPlannedDays;
    },
    enabled: !!dateRange,
    staleTime: 60 * 1000,
  });

  // Fetch active daily entries within date range
  const { data: activeEntries, isLoading: isLoadingActiveEntries } = useQuery({
    queryKey: ['active-entries-for-picker', dateRange ? format(dateRange.start, 'yyyy-MM-dd') : null, dateRange ? format(dateRange.end, 'yyyy-MM-dd') : null],
    queryFn: async () => {
      if (!dateRange) return {};
      
      const startStr = format(dateRange.start, 'yyyy-MM-dd');
      const endStr = format(dateRange.end, 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('daily_entries')
        .select('user_id, entry_date, doors_knocked, pitches, decision_makers, transitions, presentations, closes, work_start_time')
        .gte('entry_date', startStr)
        .lte('entry_date', endStr);
      
      if (error) {
        console.error('Error fetching active entries:', error);
        return {};
      }
      
      const userHasActivity: Record<string, boolean> = {};
      data?.forEach(row => {
        if (row.user_id) {
          const hasActivity = 
            (row.doors_knocked && row.doors_knocked > 0) ||
            (row.pitches && row.pitches > 0) ||
            (row.decision_makers && row.decision_makers > 0) ||
            (row.transitions && row.transitions > 0) ||
            (row.presentations && row.presentations > 0) ||
            (row.closes && row.closes > 0) ||
            row.work_start_time;
          
          if (hasActivity) {
            userHasActivity[row.user_id] = true;
          }
        }
      });
      
      return userHasActivity;
    },
    enabled: !!dateRange,
    staleTime: 30 * 1000,
  });

  const isLoadingWorkStatus = isLoadingPlannedDays || isLoadingActiveEntries;

  // Build combined reps list including current user if needed
  const combinedReps = useMemo(() => {
    let reps = [...allReps];
    
    if (showSelfInList && currentUserId && currentUserRep) {
      const selfExists = reps.some(r => r.userId === currentUserId);
      if (!selfExists) {
        reps.unshift({
          id: currentUserId,
          userId: currentUserId,
          name: currentUserRep.name,
          stage: 'signed',
        });
      }
    }
    
    return reps;
  }, [allReps, currentUserId, currentUserRep, showSelfInList]);

  // Filter reps by search query
  const searchFilteredReps = useMemo(() => {
    if (!searchQuery.trim()) return combinedReps;
    
    const query = searchQuery.toLowerCase().trim();
    return combinedReps.filter(rep => 
      rep.name.toLowerCase().includes(query) ||
      rep.teamName?.toLowerCase().includes(query) ||
      rep.mgmtGroupName?.toLowerCase().includes(query)
    );
  }, [combinedReps, searchQuery]);

  // Filter and sort reps, grouped by team
  const { workingByTeam, notWorkingByTeam, eligibleCount, workingCount, notWorkingCount } = useMemo(() => {
    // First, filter to only active stages and those with userId
    const eligibleReps = searchFilteredReps.filter(rep => {
      if (!rep.userId) return false;
      
      // Current user is always eligible if showSelfInList
      if (showSelfInList && rep.userId === currentUserId) return true;
      
      const normalizedStage = normalizeStage(rep.stage);
      return normalizedStage && ACTIVE_STAGES.includes(normalizedStage);
    });

    // Sort function: alphabetically by name within each team
    const sortReps = (reps: Rep[]) => {
      return [...reps].sort((a, b) => a.name.localeCompare(b.name));
    };

    // Group by team - Map<teamName, Rep[]>
    const groupByTeam = (reps: Rep[]): Map<string, Rep[]> => {
      const grouped = new Map<string, Rep[]>();
      
      reps.forEach(rep => {
        const teamKey = rep.teamName || 'Other';
        if (!grouped.has(teamKey)) {
          grouped.set(teamKey, []);
        }
        grouped.get(teamKey)!.push(rep);
      });
      
      // Sort reps within each team
      grouped.forEach((teamReps, key) => {
        grouped.set(key, sortReps(teamReps));
      });
      
      // Sort teams alphabetically
      const sortedMap = new Map([...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0])));
      
      return sortedMap;
    };

    // Split into working/not working based on planned days OR active entries
    const working: Rep[] = [];
    const notWorking: Rep[] = [];
    
    eligibleReps.forEach(rep => {
      if (!rep.userId) return;
      
      // Current user always goes to "working" group if showing self
      if (showSelfInList && rep.userId === currentUserId) {
        working.push(rep);
        return;
      }
      
      // Check if they have planned work days OR have active entries in range
      const hasPlannedDays = plannedWorkDays?.[rep.userId] ?? false;
      const hasActiveEntry = activeEntries?.[rep.userId] ?? false;
      
      if (hasPlannedDays || hasActiveEntry) {
        working.push(rep);
      } else {
        notWorking.push(rep);
      }
    });

    return {
      workingByTeam: groupByTeam(working),
      notWorkingByTeam: groupByTeam(notWorking),
      eligibleCount: eligibleReps.length,
      workingCount: working.length,
      notWorkingCount: notWorking.length,
    };
  }, [searchFilteredReps, plannedWorkDays, activeEntries, currentUserId, showSelfInList]);

  const renderRepItem = (rep: Rep, isSelf: boolean = false) => {
    if (!rep.userId) return null;
    
    const isChecked = allSelected || selectedUserIds.includes(rep.userId);
    
    return (
      <label
        key={rep.userId}
        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
      >
        <Checkbox
          checked={isChecked}
          onCheckedChange={() => onToggleUser(rep.userId!)}
        />
        <Avatar className="h-6 w-6">
          <AvatarFallback className="text-xs">{getInitials(rep.name)}</AvatarFallback>
        </Avatar>
        <span className="text-sm font-medium truncate flex-1">
          {rep.name}
          {isSelf && <span className="text-muted-foreground ml-1">(You)</span>}
        </span>
      </label>
    );
  };

  const renderTeamGroup = (teamName: string, reps: Rep[], showHeader: boolean = true) => {
    return (
      <div key={teamName} className="space-y-1">
        {showHeader && (
          <div className="text-xs font-semibold text-muted-foreground px-2 pt-2">
            {teamName}
          </div>
        )}
        {reps.map(rep => 
          renderRepItem(rep, rep.userId === currentUserId)
        )}
      </div>
    );
  };

  const totalSelected = allSelected ? eligibleCount : selectedUserIds.length;
  const hasWorkingReps = workingByTeam.size > 0;
  const hasNotWorkingReps = notWorkingByTeam.size > 0;

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

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search participants..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 pr-9"
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

      <div className="p-3 rounded-xl bg-muted/50 border border-border mb-2">
        <p className="text-sm font-medium">
          {allSelected 
            ? `All ${eligibleCount} reps selected`
            : totalSelected === 0
              ? 'No participants selected'
              : `${totalSelected} participant${totalSelected !== 1 ? 's' : ''} selected`
          }
        </p>
      </div>

      <div className="max-h-60 overflow-y-auto space-y-1 rounded-lg border border-border p-2">
        {/* Loading state */}
        {isLoadingWorkStatus && dateRange && (
          <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Loading availability...
          </div>
        )}

        {/* Empty search state */}
        {!isLoadingWorkStatus && searchQuery && !hasWorkingReps && !hasNotWorkingReps && (
          <div className="text-center py-4 text-sm text-muted-foreground">
            No participants match "{searchQuery}"
            <button
              onClick={() => setSearchQuery('')}
              className="block mx-auto mt-2 text-primary hover:underline text-xs"
            >
              Clear search
            </button>
          </div>
        )}

        {/* Working reps section */}
        {!isLoadingWorkStatus && hasWorkingReps && (
          <>
            {dateRange && (
              <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
                <CalendarCheck className="h-3 w-3 text-green-500" />
                <span>Planning to work ({workingCount})</span>
              </div>
            )}
            {Array.from(workingByTeam.entries()).map(([teamName, reps]) => 
              renderTeamGroup(teamName, reps, workingByTeam.size > 1 || teamName !== 'Other')
            )}
          </>
        )}

        {/* Separator between working and not working */}
        {!isLoadingWorkStatus && hasWorkingReps && hasNotWorkingReps && (
          <div className="py-2">
            <Separator className="my-1" />
            <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
              <CalendarX className="h-3 w-3 text-muted-foreground" />
              <span>Not planning to work ({notWorkingCount})</span>
            </div>
          </div>
        )}

        {/* Not working reps section */}
        {!isLoadingWorkStatus && hasNotWorkingReps && (
          <>
            {Array.from(notWorkingByTeam.entries()).map(([teamName, reps]) => 
              renderTeamGroup(teamName, reps, notWorkingByTeam.size > 1 || teamName !== 'Other')
            )}
          </>
        )}

        {/* Empty state (no search) */}
        {!isLoadingWorkStatus && !searchQuery && !hasWorkingReps && !hasNotWorkingReps && (
          <div className="text-center py-4 text-sm text-muted-foreground">
            No eligible participants found
          </div>
        )}
      </div>
    </div>
  );
};
