import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { CalendarCheck, CalendarX } from "lucide-react";

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
  dateRange?: { start: Date; end: Date };
  showSelfInList?: boolean; // Whether to include current user in list
}

// Normalize stage for filtering - maps display stages to canonical forms
const normalizeStage = (stage: string | null | undefined): string | null => {
  if (!stage) return null;
  const lower = stage.toLowerCase().trim();
  
  // Map various stage formats to canonical forms
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
  dateRange,
  showSelfInList = true,
}: SmartParticipantPickerProps) => {
  // Fetch planned work days within date range
  const { data: plannedWorkDays } = useQuery({
    queryKey: ['planned-work-days-for-picker', dateRange?.start?.toISOString(), dateRange?.end?.toISOString()],
    queryFn: async () => {
      if (!dateRange) return {};
      
      const startStr = dateRange.start.toISOString().split('T')[0];
      const endStr = dateRange.end.toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('planned_work_days')
        .select('user_id, planned_date')
        .gte('planned_date', startStr)
        .lte('planned_date', endStr);
      
      if (error) {
        console.error('Error fetching planned work days:', error);
        return {};
      }
      
      // Group by user_id - just need to know if they have ANY planned day in range
      const userPlannedDays: Record<string, boolean> = {};
      data?.forEach(row => {
        if (row.user_id) {
          userPlannedDays[row.user_id] = true;
        }
      });
      
      return userPlannedDays;
    },
    enabled: !!dateRange,
    staleTime: 60 * 1000, // 1 minute
  });

  // Filter and sort reps
  const { workingReps, notWorkingReps, eligibleCount } = useMemo(() => {
    // First, filter to only active stages and those with userId
    const eligibleReps = allReps.filter(rep => {
      if (!rep.userId) return false;
      
      const normalizedStage = normalizeStage(rep.stage);
      const isActiveStage = normalizedStage && ACTIVE_STAGES.includes(normalizedStage);
      
      // Include reps in active stages OR the current user themselves
      return isActiveStage || (showSelfInList && rep.userId === currentUserId);
    });

    // Sort function: by team name, then by name alphabetically
    const sortReps = (reps: Rep[]) => {
      return [...reps].sort((a, b) => {
        // First by team name
        const teamA = a.teamName || '';
        const teamB = b.teamName || '';
        if (teamA !== teamB) return teamA.localeCompare(teamB);
        
        // Then alphabetically by name
        return a.name.localeCompare(b.name);
      });
    };

    // Split into working/not working based on planned days
    const working: Rep[] = [];
    const notWorking: Rep[] = [];
    
    eligibleReps.forEach(rep => {
      if (!rep.userId) return;
      
      // Current user always goes to "working" group if showing self
      if (showSelfInList && rep.userId === currentUserId) {
        working.push(rep);
        return;
      }
      
      // Check if they have planned work days in range
      const hasPlannedDays = plannedWorkDays?.[rep.userId] ?? false;
      
      if (hasPlannedDays) {
        working.push(rep);
      } else {
        notWorking.push(rep);
      }
    });

    return {
      workingReps: sortReps(working),
      notWorkingReps: sortReps(notWorking),
      eligibleCount: eligibleReps.length,
    };
  }, [allReps, plannedWorkDays, currentUserId, showSelfInList]);

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
          <AvatarFallback className="text-xs">{rep.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium block truncate">
            {rep.name}
            {isSelf && <span className="text-muted-foreground ml-1">(You)</span>}
          </span>
          {rep.teamName && (
            <span className="text-xs text-muted-foreground block truncate">{rep.teamName}</span>
          )}
        </div>
      </label>
    );
  };

  const totalSelected = allSelected ? eligibleCount : selectedUserIds.length;

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
        {/* Working reps section */}
        {workingReps.length > 0 && (
          <>
            {dateRange && (
              <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
                <CalendarCheck className="h-3 w-3 text-green-500" />
                <span>Planning to work</span>
              </div>
            )}
            {workingReps.map(rep => 
              renderRepItem(rep, rep.userId === currentUserId)
            )}
          </>
        )}

        {/* Separator between working and not working */}
        {workingReps.length > 0 && notWorkingReps.length > 0 && (
          <div className="py-2">
            <Separator className="my-1" />
            <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
              <CalendarX className="h-3 w-3 text-muted-foreground" />
              <span>Not planning to work during this period</span>
            </div>
          </div>
        )}

        {/* Not working reps section */}
        {notWorkingReps.map(rep => renderRepItem(rep))}

        {/* Empty state */}
        {workingReps.length === 0 && notWorkingReps.length === 0 && (
          <div className="text-center py-4 text-sm text-muted-foreground">
            No eligible participants found
          </div>
        )}
      </div>
    </div>
  );
};
