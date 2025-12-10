import { useMemo } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useEfpMode } from "@/hooks/useEfpMode";
import { useAllRepGoals } from "@/hooks/useRepGoals";
import { TrendingUp, Target, Ban, Play, Square, Coffee, Users } from "lucide-react";
import { HourlyActivityChart } from "./HourlyActivityChart";
import { format, parseISO } from "date-fns";

// Check if we're in summer mode (after April 12, 2026)
const SUMMER_START = new Date('2026-04-12');
const isInSummer = () => new Date() >= SUMMER_START;

interface RepDetailData {
  userId: string;
  name: string;
  year: string;
  teamName: string;
  mgmtGroupName: string;
  doors: number;
  dms: number;
  pitches: number;
  transitions: number;
  presentations: number;
  closes: number;
  fp: number;
  upgradeFP: number;
  prmr: number;
  upgradePRMR: number;
  doorsToFpRatio: number;
  hoursWorked: number;
  workStartTime?: string;
  workEndTime?: string;
  timezone?: string;
  counterTimestamps?: Record<string, string[]>;
  salesLog?: Array<{ type: string; prmr: number; timestamp?: string; install_status?: string }>;
  breakPeriods?: Array<{ start: string; end: string }>;
}

interface RepDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rep: RepDetailData | null;
}

// Format time from timestamp in a specific timezone
const formatTimeInTimezone = (timestamp: string | undefined, timezone: string = 'America/Los_Angeles') => {
  if (!timestamp) return null;
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true,
      timeZone: timezone
    });
  } catch {
    return null;
  }
};

// Calculate break duration in minutes from break_periods array
const calculateBreakMinutes = (breakPeriods?: Array<{ start: string; end: string }>): number => {
  if (!breakPeriods || breakPeriods.length === 0) return 0;
  
  return breakPeriods.reduce((total, period) => {
    if (period.start && period.end) {
      const start = new Date(period.start).getTime();
      const end = new Date(period.end).getTime();
      return total + Math.max(0, (end - start) / 1000 / 60);
    }
    return total;
  }, 0);
};

// Read-only sale chip component
const ReadOnlySaleChip = ({ sale, timezone = 'America/Los_Angeles' }: { 
  sale: { type: string; prmr: number; timestamp?: string; install_status?: string };
  timezone?: string;
}) => {
  const isFP = sale.type === 'fp';
  const isCancelled = sale.install_status === 'cancelled';
  const timeStr = sale.timestamp 
    ? new Date(sale.timestamp).toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true,
        timeZone: timezone
      })
    : null;

  return (
    <div
      className={`relative flex-shrink-0 rounded-xl p-3 min-w-[80px] ${
        isCancelled
          ? 'bg-destructive/5 border border-destructive/20 opacity-60'
          : isFP
            ? 'bg-primary/10 border border-primary/20'
            : 'bg-emerald-500/10 border border-emerald-500/20'
      }`}
    >
      {isCancelled && (
        <div className="absolute top-1 right-1">
          <Ban className="w-3 h-3 text-destructive" />
        </div>
      )}

      <div className={`text-[10px] font-bold mb-1 ${
        isCancelled
          ? 'text-destructive/70'
          : isFP 
            ? 'text-primary' 
            : 'text-emerald-600'
      }`}>
        {isFP ? 'FP' : 'UP'}
      </div>

      <div className={`text-lg font-bold ${
        isCancelled ? 'line-through text-muted-foreground' : 'text-foreground'
      }`}>
        ${sale.prmr}
      </div>

      {timeStr && (
        <div className="text-[10px] text-muted-foreground mt-1">
          {timeStr}
        </div>
      )}
    </div>
  );
};

// Stat row component
const StatRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between items-center py-2.5 border-b border-border/30 last:border-0">
    <span className="text-muted-foreground text-sm">{label}</span>
    <span className="font-semibold text-foreground">{value}</span>
  </div>
);

export const RepDetailDrawer = ({ open, onOpenChange, rep }: RepDetailDrawerProps) => {
  const { efpModeEnabled } = useEfpMode();
  const { data: allGoals } = useAllRepGoals();
  
  // Find this rep's goals
  const repGoals = useMemo(() => {
    if (!allGoals || !rep) return null;
    return allGoals.find(g => g.user_id === rep.userId);
  }, [allGoals, rep]);


  if (!rep) return null;

  // Calculate values
  const hasTimelineData = rep.counterTimestamps && Object.keys(rep.counterTimestamps).length > 0;
  const breakMinutes = calculateBreakMinutes(rep.breakPeriods);
  
  // PRMR already includes upgradePRMR in the data source (calculateFromSalesLog sums all sales)
  // So we use rep.prmr directly as totalPrmr, NOT rep.prmr + rep.upgradePRMR (that would double-count)
  const totalPrmr = rep.prmr;
  const efp = totalPrmr / 85;
  // FP+ = FP count + (upgradePRMR / 85) - but rep.fp already includes upgrade FP+ from data source
  const totalFPPlus = rep.fp;
  
  // Funded sales only
  const fundedSales = (rep.salesLog || []).filter(s => s.install_status !== 'cancelled');
  const cancelledCount = (rep.salesLog || []).filter(s => s.install_status === 'cancelled').length;

  // Goal progress calculation
  const inSummer = isInSummer();
  let goalDisplay: { label: string; current: number; target: number; isComplete: boolean } | null = null;
  
  if (repGoals) {
    if (!inSummer && repGoals.preseason_fp_goal > 0) {
      // Preseason mode - show preseason goal
      goalDisplay = {
        label: 'Preseason Goal',
        current: totalFPPlus,
        target: repGoals.preseason_fp_goal,
        isComplete: totalFPPlus >= repGoals.preseason_fp_goal
      };
    } else if (inSummer) {
      // Summer mode - show the next incomplete tier
      const mustDo = repGoals.must_do_fp_goal || 0;
      const willDo = repGoals.will_do_fp_goal || 0;
      const couldDo = repGoals.could_do_fp_goal || 0;
      
      if (totalFPPlus < mustDo) {
        goalDisplay = { label: 'Must Do', current: totalFPPlus, target: mustDo, isComplete: false };
      } else if (totalFPPlus < willDo) {
        goalDisplay = { label: 'Will Do', current: totalFPPlus, target: willDo, isComplete: false };
      } else if (totalFPPlus < couldDo) {
        goalDisplay = { label: 'Could Do', current: totalFPPlus, target: couldDo, isComplete: false };
      } else if (couldDo > 0) {
        goalDisplay = { label: 'Could Do', current: totalFPPlus, target: couldDo, isComplete: true };
      }
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        {/* Clean Header */}
        <DrawerHeader className="text-left pb-3 pt-6">
          <DrawerTitle className="text-2xl font-bold">{rep.name}</DrawerTitle>
          
          {/* Team and Time row */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1.5 flex-wrap">
            {rep.teamName && rep.teamName !== 'No Team' && rep.teamName !== 'Unknown Team' && (
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                <span>{rep.teamName}</span>
              </div>
            )}
            {rep.workStartTime && (
              <div className="flex items-center gap-1">
                <Play className="w-3 h-3 text-emerald-500" />
                <span>{formatTimeInTimezone(rep.workStartTime, rep.timezone)}</span>
              </div>
            )}
            {rep.workEndTime && (
              <div className="flex items-center gap-1">
                <Square className="w-3 h-3 text-primary" />
                <span>{formatTimeInTimezone(rep.workEndTime, rep.timezone)}</span>
              </div>
            )}
            {breakMinutes > 0 && (
              <div className="flex items-center gap-1">
                <Coffee className="w-3 h-3" />
                <span>{Math.round(breakMinutes)}m</span>
              </div>
            )}
            {rep.hoursWorked > 0 && (
              <span className="text-foreground font-medium">
                {Math.floor(rep.hoursWorked)}h {Math.round((rep.hoursWorked % 1) * 60)}m
              </span>
            )}
          </div>
        </DrawerHeader>

        <div className="px-4 pb-8 space-y-5 overflow-y-auto">
          
          {/* Goal Progress Section */}
          {goalDisplay && (
            <div className="rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">
                    {goalDisplay.isComplete ? '✓ ' : ''}{goalDisplay.label}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {Math.round((goalDisplay.current / goalDisplay.target) * 100)}%
                </span>
              </div>
              
              {/* Progress bar */}
              <div className="h-2.5 bg-muted/50 rounded-full overflow-hidden mb-2">
                <div 
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (goalDisplay.current / goalDisplay.target) * 100)}%` }}
                />
              </div>
              
              <div className="flex justify-between text-sm">
                <span className="font-bold text-foreground">
                  {goalDisplay.current.toFixed(1)} FP+
                </span>
                <span className="text-muted-foreground">
                  / {goalDisplay.target.toFixed(0)} FP+
                </span>
              </div>
            </div>
          )}

          {/* Hourly Activity Section */}
          {hasTimelineData && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-medium text-muted-foreground">Hourly Activity</h3>
              </div>
              
              <div className="bg-muted/20 rounded-2xl p-4">
                <HourlyActivityChart
                  counterTimestamps={rep.counterTimestamps}
                  workStartTime={rep.workStartTime}
                  workEndTime={rep.workEndTime}
                  timezone={rep.timezone}
                />
              </div>
            </div>
          )}

          {/* Sales Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">💰</span>
                <h3 className="text-sm font-medium text-muted-foreground">Sales</h3>
              </div>
              <div className="text-right">
                <span className="text-lg font-bold text-primary">${totalPrmr.toLocaleString()}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  {efpModeEnabled ? efp.toFixed(2) : totalFPPlus.toFixed(1)} {efpModeEnabled ? 'EFP' : 'FP+'}
                </span>
              </div>
            </div>
            
            {/* Sale chips or summary */}
            {rep.salesLog && rep.salesLog.length > 0 ? (
              <>
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
                  {rep.salesLog.map((sale, idx) => (
                    <ReadOnlySaleChip key={idx} sale={sale} />
                  ))}
                </div>
                
                {/* Summary breakdown */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{fundedSales.filter(s => s.type === 'fp').length} FPs</span>
                  {fundedSales.filter(s => s.type === 'upgrade').length > 0 && (
                    <>
                      <span>•</span>
                      <span>{fundedSales.filter(s => s.type === 'upgrade').length} Upgrades</span>
                    </>
                  )}
                  {cancelledCount > 0 && (
                    <>
                      <span>•</span>
                      <span className="text-destructive/70">{cancelledCount} Cancelled</span>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="bg-muted/20 rounded-xl p-4 text-center text-sm text-muted-foreground">
                {rep.fp > 0 || rep.prmr > 0 ? (
                  <span>{rep.fp} FP · ${rep.prmr.toLocaleString()} PRMR</span>
                ) : (
                  <span>No sales logged</span>
                )}
              </div>
            )}
          </div>


          {/* Activity Inputs Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-medium text-muted-foreground">Activity</h3>
            </div>
            
            <div className="bg-muted/20 rounded-2xl p-4">
              <StatRow label="Doors" value={rep.doors.toString()} />
              <StatRow label="Decision Makers" value={rep.dms.toString()} />
              <StatRow label="Pitches" value={rep.pitches.toString()} />
              <StatRow label="Transitions" value={rep.transitions.toString()} />
              <StatRow label="Presentations" value={rep.presentations.toString()} />
              <StatRow label="Closes" value={rep.closes.toString()} />
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
