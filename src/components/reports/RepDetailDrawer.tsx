import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useEfpMode } from "@/hooks/useEfpMode";
import { Clock, Target, TrendingUp, Users } from "lucide-react";

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
}

interface RepDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rep: RepDetailData | null;
  daysInRange?: number;
}

export const RepDetailDrawer = ({ open, onOpenChange, rep, daysInRange = 1 }: RepDetailDrawerProps) => {
  const { efpModeEnabled } = useEfpMode();

  if (!rep) return null;

  const daysWorked = rep.daysWorked || Math.max(1, Math.ceil(rep.hoursWorked / 8));
  const avgHoursPerDay = daysWorked > 0 ? rep.hoursWorked / daysWorked : 0;
  const avgFpPerDay = daysWorked > 0 ? rep.fp / daysWorked : 0;
  const avgDoorsPerDay = daysWorked > 0 ? rep.doors / daysWorked : 0;
  const avgPresentationsPerDay = daysWorked > 0 ? rep.presentations / daysWorked : 0;
  const efp = rep.prmr / 85;
  const avgEfpPerDay = daysWorked > 0 ? efp / daysWorked : 0;

  const StatRow = ({ label, value, subValue }: { label: string; value: string; subValue?: string }) => (
    <div className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
      <span className="text-muted-foreground text-sm">{label}</span>
      <div className="text-right">
        <span className="font-semibold">{value}</span>
        {subValue && <span className="text-xs text-muted-foreground ml-1">({subValue})</span>}
      </div>
    </div>
  );

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="text-left pb-2">
          <DrawerTitle className="text-xl">{rep.name}</DrawerTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{rep.teamName || 'No Team'}</span>
            <span>·</span>
            <span>{rep.mgmtGroupName || 'No Group'}</span>
            {rep.year && rep.year !== 'Unknown' && (
              <>
                <span>·</span>
                <span className="capitalize">{rep.year}</span>
              </>
            )}
          </div>
        </DrawerHeader>

        <div className="px-4 pb-6 space-y-4 overflow-y-auto">
          {/* Totals Section */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
              <Target className="w-4 h-4" />
              <span>Totals</span>
            </div>
            <div className="bg-muted/30 rounded-xl p-3">
              <StatRow 
                label={efpModeEnabled ? "EFP" : "FP+"} 
                value={efpModeEnabled ? efp.toFixed(2) : rep.fp.toFixed(1)} 
              />
              <StatRow 
                label={efpModeEnabled ? "FP+" : "PRMR"} 
                value={efpModeEnabled ? rep.fp.toFixed(1) : `$${rep.prmr.toFixed(0)}`} 
              />
              <StatRow label="Closes" value={rep.closes.toString()} />
              <StatRow label="Presentations" value={rep.presentations.toString()} />
              <StatRow label="Transitions" value={rep.transitions.toString()} />
              <StatRow label="Pitches" value={rep.pitches.toString()} />
              <StatRow label="Decision Makers" value={rep.dms.toString()} />
              <StatRow label="Doors Knocked" value={rep.doors.toString()} />
            </div>
          </div>

          {/* Daily Averages Section */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
              <TrendingUp className="w-4 h-4" />
              <span>Daily Averages</span>
              <span className="text-xs">({daysWorked} day{daysWorked !== 1 ? 's' : ''} worked)</span>
            </div>
            <div className="bg-muted/30 rounded-xl p-3">
              <StatRow 
                label={`Avg ${efpModeEnabled ? "EFP" : "FP+"}/Day`} 
                value={efpModeEnabled ? avgEfpPerDay.toFixed(2) : avgFpPerDay.toFixed(1)} 
              />
              <StatRow label="Avg Doors/Day" value={avgDoorsPerDay.toFixed(0)} />
              <StatRow label="Avg Presentations/Day" value={avgPresentationsPerDay.toFixed(1)} />
            </div>
          </div>

          {/* Time Section */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
              <Clock className="w-4 h-4" />
              <span>Time</span>
            </div>
            <div className="bg-muted/30 rounded-xl p-3">
              <StatRow 
                label="Total Hours Worked" 
                value={`${Math.floor(rep.hoursWorked)}h ${Math.round((rep.hoursWorked % 1) * 60)}m`} 
              />
              <StatRow 
                label="Avg Hours/Day" 
                value={`${Math.floor(avgHoursPerDay)}h ${Math.round((avgHoursPerDay % 1) * 60)}m`} 
              />
              {rep.doorsToFpRatio > 0 && (
                <StatRow label="Doors per FP+" value={rep.doorsToFpRatio.toFixed(0)} />
              )}
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
