import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Clock, Users, TrendingUp, Timer, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { getFirstName } from "@/components/mygroup/recruit-detail/utils";
import { getInitials } from "@/utils/nameUtils";

interface WorkingRepData {
  userId: string;
  name: string;
  year?: string;
  timezone?: string;
  teamId?: string | null;
  teamName?: string | null;
  workStartTime?: string;
  workEndTime?: string;
  avgStartTime?: string;
  avgEndTime?: string;
  hoursWorked: number;
  doors: number;
  transitions: number;
  presentations: number;
  fp: number;
  prmr: number;
  isWorking: boolean;
}

interface WorkingRepsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reps: WorkingRepData[];
  periodLabel: string;
  isLiveView?: boolean;
  onRepClick?: (userId: string) => void;
}

// Format time in rep's local timezone
const formatLocalTime = (isoTime: string | undefined, timezone: string = 'America/Los_Angeles'): string => {
  if (!isoTime) return '—';
  try {
    return formatInTimeZone(parseISO(isoTime), timezone, 'h:mm a');
  } catch {
    return '—';
  }
};

// Calculate average time from ISO strings
const calculateAverageTime = (times: (string | undefined)[], timezones: (string | undefined)[]): string | null => {
  const validTimes: number[] = [];
  
  times.forEach((time, idx) => {
    if (!time) return;
    try {
      const tz = timezones[idx] || 'America/Los_Angeles';
      // Extract hours and minutes in local timezone
      const localTimeStr = formatInTimeZone(parseISO(time), tz, 'HH:mm');
      const [hours, minutes] = localTimeStr.split(':').map(Number);
      validTimes.push(hours * 60 + minutes);
    } catch {
      // Skip invalid times
    }
  });
  
  if (validTimes.length === 0) return null;
  
  const avgMinutes = Math.round(validTimes.reduce((a, b) => a + b, 0) / validTimes.length);
  const hours = Math.floor(avgMinutes / 60);
  const minutes = avgMinutes % 60;
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
};

export const WorkingRepsDrawer = ({
  open,
  onOpenChange,
  reps,
  periodLabel,
  isLiveView,
  onRepClick,
}: WorkingRepsDrawerProps) => {
  // Separate working and not working reps
  const workingReps = reps.filter(r => r.isWorking);
  const finishedReps = reps.filter(r => !r.isWorking && r.hoursWorked > 0);
  const notStartedReps = reps.filter(r => !r.isWorking && r.hoursWorked === 0);
  
  // Calculate summary stats
  // For historical views, use pre-computed avgStartTime/avgEndTime from the data
  // For live views, calculate from actual timestamps
  const avgStartTime = isLiveView 
    ? calculateAverageTime(reps.map(r => r.workStartTime), reps.map(r => r.timezone))
    : (() => {
        // Calculate average from pre-computed avgStartTime strings
        const validTimes = reps.filter(r => r.avgStartTime).map(r => r.avgStartTime!);
        if (validTimes.length === 0) return null;
        // All avgStartTime values are already formatted strings, just use the first as representative
        // Or calculate a proper average by parsing them
        const minuteTotals = validTimes.map(t => {
          const match = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
          if (!match) return null;
          let hours = parseInt(match[1]);
          const mins = parseInt(match[2]);
          const period = match[3].toUpperCase();
          if (period === 'PM' && hours !== 12) hours += 12;
          if (period === 'AM' && hours === 12) hours = 0;
          return hours * 60 + mins;
        }).filter((m): m is number => m !== null);
        
        if (minuteTotals.length === 0) return null;
        const avgMinutes = Math.round(minuteTotals.reduce((a, b) => a + b, 0) / minuteTotals.length);
        const hours = Math.floor(avgMinutes / 60);
        const minutes = avgMinutes % 60;
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
      })();
      
  const avgEndTime = isLiveView
    ? calculateAverageTime(finishedReps.map(r => r.workEndTime), finishedReps.map(r => r.timezone))
    : (() => {
        const validTimes = reps.filter(r => r.avgEndTime).map(r => r.avgEndTime!);
        if (validTimes.length === 0) return null;
        const minuteTotals = validTimes.map(t => {
          const match = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
          if (!match) return null;
          let hours = parseInt(match[1]);
          const mins = parseInt(match[2]);
          const period = match[3].toUpperCase();
          if (period === 'PM' && hours !== 12) hours += 12;
          if (period === 'AM' && hours === 12) hours = 0;
          return hours * 60 + mins;
        }).filter((m): m is number => m !== null);
        
        if (minuteTotals.length === 0) return null;
        const avgMinutes = Math.round(minuteTotals.reduce((a, b) => a + b, 0) / minuteTotals.length);
        const hours = Math.floor(avgMinutes / 60);
        const minutes = avgMinutes % 60;
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
      })();
      
  const totalHours = reps.reduce((sum, r) => sum + r.hoursWorked, 0);
  const avgHoursWorked = reps.length > 0 ? totalHours / reps.filter(r => r.hoursWorked > 0).length : 0;
  
  const formatHours = (hours: number): string => {
    if (hours <= 0) return '—';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const RepRow = ({ rep }: { rep: WorkingRepData }) => {
    // For historical views, show avgStartTime/avgEndTime; for live, show workStartTime/workEndTime
    const displayStartTime = isLiveView 
      ? formatLocalTime(rep.workStartTime, rep.timezone)
      : (rep.avgStartTime || '—');
    const displayEndTime = isLiveView
      ? formatLocalTime(rep.workEndTime, rep.timezone)
      : (rep.avgEndTime || '—');
    
    return (
      <div 
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg bg-muted/30 cursor-pointer",
          "hover:bg-muted/50 active:scale-[0.98] transition-all"
        )}
        onClick={() => onRepClick?.(rep.userId)}
      >
        <Avatar className="h-9 w-9">
          <AvatarFallback className="text-xs bg-primary/10 text-primary">
            {getInitials(rep.name)}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{getFirstName(rep.name)}</span>
            {rep.year && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {rep.year}
              </Badge>
            )}
            {rep.isWorking && (
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] text-green-600 dark:text-green-400">Working</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {displayStartTime}
              {(isLiveView ? (rep.workEndTime && !rep.isWorking) : rep.avgEndTime) && (
                <> – {displayEndTime}</>
              )}
            </span>
            <span className="flex items-center gap-1">
              <Timer className="w-3 h-3" />
              {formatHours(rep.hoursWorked)}
            </span>
          </div>
        </div>
      
      <div className="text-right">
        {rep.fp > 0 ? (
          <div className="flex flex-col items-end">
            <span className="font-bold text-green-600 dark:text-green-400">
              {rep.fp.toFixed(1)} FP+
            </span>
            <span className="text-[10px] text-muted-foreground">
              ${rep.prmr.toLocaleString()}
            </span>
          </div>
        ) : rep.presentations > 0 ? (
          <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/30">
            {rep.presentations} pres
          </Badge>
        ) : rep.transitions > 0 ? (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
            {rep.transitions} trans
          </Badge>
        ) : rep.doors > 0 ? (
          <span className="text-xs text-muted-foreground">
            {rep.doors} doors
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/50">—</span>
        )}
      </div>
      
      <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
    </div>
    );
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            {isLiveView ? 'Working Today' : periodLabel}
          </DrawerTitle>
        </DrawerHeader>
        
        <div className="px-4 pb-6 overflow-y-auto space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <div className="text-lg font-bold">
                {avgStartTime || '—'}
              </div>
              <div className="text-[10px] text-muted-foreground">Avg Start</div>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <div className="text-lg font-bold">
                {avgEndTime || (isLiveView ? '—' : '—')}
              </div>
              <div className="text-[10px] text-muted-foreground">Avg End</div>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <div className="text-lg font-bold">
                {avgHoursWorked > 0 ? formatHours(avgHoursWorked) : '—'}
              </div>
              <div className="text-[10px] text-muted-foreground">Avg Hours</div>
            </div>
          </div>
          
          {/* Currently Working */}
          {workingReps.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm font-medium">Currently Working ({workingReps.length})</span>
              </div>
              <div className="space-y-2">
                {workingReps.map(rep => (
                  <RepRow key={rep.userId} rep={rep} />
                ))}
              </div>
            </div>
          )}
          
          {/* Finished for the day */}
          {finishedReps.length > 0 && (
            <div className="space-y-2">
              <span className="text-sm font-medium text-muted-foreground">
                Finished ({finishedReps.length})
              </span>
              <div className="space-y-2">
                {finishedReps.map(rep => (
                  <RepRow key={rep.userId} rep={rep} />
                ))}
              </div>
            </div>
          )}
          
          {/* Not Started */}
          {isLiveView && notStartedReps.length > 0 && (
            <div className="space-y-2">
              <span className="text-sm font-medium text-muted-foreground/70">
                Not Yet Started ({notStartedReps.length})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {notStartedReps.map(rep => (
                  <Badge 
                    key={rep.userId} 
                    variant="outline" 
                    className="text-muted-foreground/70 cursor-pointer hover:bg-muted"
                    onClick={() => onRepClick?.(rep.userId)}
                  >
                    {getFirstName(rep.name)}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          {/* Empty State */}
          {reps.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No activity recorded</p>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
