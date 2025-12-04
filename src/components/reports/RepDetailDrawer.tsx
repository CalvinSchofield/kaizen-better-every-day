import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useEfpMode } from "@/hooks/useEfpMode";
import { Clock, Target, TrendingUp } from "lucide-react";

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
  daysWorked?: number;
  workStartTime?: string;
  workEndTime?: string;
}

interface RepDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rep: RepDetailData | null;
  daysInRange?: number;
}

const formatTime = (timestamp: string | undefined) => {
  if (!timestamp) return null;
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    return null;
  }
};

export const RepDetailDrawer = ({ open, onOpenChange, rep, daysInRange = 1 }: RepDetailDrawerProps) => {
  const { efpModeEnabled } = useEfpMode();

  if (!rep) return null;

  const daysWorked = rep.daysWorked || Math.max(1, Math.ceil(rep.hoursWorked / 8));
  const showDailyAverages = daysWorked > 1;
  const avgHoursPerDay = daysWorked > 0 ? rep.hoursWorked / daysWorked : 0;
  const avgFpPerDay = daysWorked > 0 ? rep.fp / daysWorked : 0;
  const avgDoorsPerDay = daysWorked > 0 ? rep.doors / daysWorked : 0;
  const avgDmsPerDay = daysWorked > 0 ? rep.dms / daysWorked : 0;
  const avgPitchesPerDay = daysWorked > 0 ? rep.pitches / daysWorked : 0;
  const avgTransitionsPerDay = daysWorked > 0 ? rep.transitions / daysWorked : 0;
  const avgPresentationsPerDay = daysWorked > 0 ? rep.presentations / daysWorked : 0;
  const avgClosesPerDay = daysWorked > 0 ? rep.closes / daysWorked : 0;
  const efp = rep.prmr / 85;
  const avgEfpPerDay = daysWorked > 0 ? efp / daysWorked : 0;
  const avgPrmrPerDay = daysWorked > 0 ? rep.prmr / daysWorked : 0;

  const StatRow = ({ label, value, avgValue }: { label: string; value: string; avgValue?: string }) => (
    <div className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
      <span className="text-muted-foreground text-sm">{label}</span>
      <div className="text-right">
        <span className="font-bold text-lg">{value}</span>
        {avgValue && showDailyAverages && (
          <span className="text-xs text-muted-foreground block">{avgValue}/day</span>
        )}
      </div>
    </div>
  );

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="text-left pb-2">
          <DrawerTitle className="text-xl">{rep.name}</DrawerTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {rep.year && rep.year !== 'Unknown' && rep.year !== 'unknown' && (
              <span className="capitalize">{rep.year}</span>
            )}
            {rep.teamName && rep.teamName !== 'No Team' && (
              <>
                {rep.year && rep.year !== 'Unknown' && rep.year !== 'unknown' && <span>·</span>}
                <span>{rep.teamName}</span>
              </>
            )}
          </div>
        </DrawerHeader>

        <div className="px-4 pb-6 space-y-4 overflow-y-auto">
          {/* Results Section - FP+ and PRMR at top */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
              <Target className="w-4 h-4" />
              <span>Results</span>
              {showDailyAverages && (
                <span className="text-xs">({daysWorked} day{daysWorked !== 1 ? 's' : ''} worked)</span>
              )}
            </div>
            <div className="bg-muted/30 rounded-xl p-3">
              <StatRow 
                label={efpModeEnabled ? "EFP" : "FP+"} 
                value={efpModeEnabled ? efp.toFixed(2) : rep.fp.toFixed(1)} 
                avgValue={efpModeEnabled ? avgEfpPerDay.toFixed(2) : avgFpPerDay.toFixed(1)}
              />
              <StatRow 
                label={efpModeEnabled ? "FP+" : "PRMR"} 
                value={efpModeEnabled ? rep.fp.toFixed(1) : `$${rep.prmr.toFixed(0)}`} 
                avgValue={efpModeEnabled ? avgFpPerDay.toFixed(1) : `$${avgPrmrPerDay.toFixed(0)}`}
              />
            </div>
          </div>

          {/* Time Section */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
              <Clock className="w-4 h-4" />
              <span>Time</span>
            </div>
            <div className="bg-muted/30 rounded-xl p-3">
              {rep.workStartTime && (
                <StatRow 
                  label="Start Time" 
                  value={formatTime(rep.workStartTime) || '-'}
                />
              )}
              {rep.workEndTime && (
                <StatRow 
                  label="End Time" 
                  value={formatTime(rep.workEndTime) || '-'}
                />
              )}
              <StatRow 
                label="Hours Worked" 
                value={`${Math.floor(rep.hoursWorked)}h ${Math.round((rep.hoursWorked % 1) * 60)}m`} 
                avgValue={showDailyAverages ? `${avgHoursPerDay.toFixed(1)}h` : undefined}
              />
            </div>
          </div>

          {/* Activity Section */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
              <TrendingUp className="w-4 h-4" />
              <span>Activity</span>
            </div>
            <div className="bg-muted/30 rounded-xl p-3">
              <StatRow 
                label="Doors Knocked" 
                value={rep.doors.toString()} 
                avgValue={avgDoorsPerDay.toFixed(0)}
              />
              <StatRow 
                label="Decision Makers" 
                value={rep.dms.toString()} 
                avgValue={avgDmsPerDay.toFixed(1)}
              />
              <StatRow 
                label="Pitches" 
                value={rep.pitches.toString()} 
                avgValue={avgPitchesPerDay.toFixed(1)}
              />
              <StatRow 
                label="Transitions" 
                value={rep.transitions.toString()} 
                avgValue={avgTransitionsPerDay.toFixed(1)}
              />
              <StatRow 
                label="Presentations" 
                value={rep.presentations.toString()} 
                avgValue={avgPresentationsPerDay.toFixed(1)}
              />
              <StatRow 
                label="Closes" 
                value={rep.closes.toString()} 
                avgValue={avgClosesPerDay.toFixed(1)}
              />
              {rep.doorsToFpRatio > 0 && (
                <StatRow 
                  label="Doors per FP+" 
                  value={rep.doorsToFpRatio.toFixed(0)} 
                />
              )}
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
