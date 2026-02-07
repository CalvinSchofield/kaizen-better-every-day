import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Clock, 
  DollarSign, 
  Home, 
  Target, 
  Zap,
  Timer,
  AlertTriangle,
  Coffee,
  Users,
  DoorOpen,
} from "lucide-react";
import { RingSegment } from "@/utils/inHomeZoneCalculator";
import { Sale } from "@/hooks/useDailyEntry";
import { format, parseISO, differenceInMinutes } from "date-fns";
import { formatPRMR } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface SegmentDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  segment: RingSegment | null;
  sale?: Sale | null;
  workStart: Date | null;
  workEnd: Date | null;
  totalWorkMinutes: number;
}

// Convert angle back to time
const angleToTime = (
  angle: number, 
  workStart: Date, 
  workEnd: Date
): Date => {
  const totalDuration = workEnd.getTime() - workStart.getTime();
  const elapsed = (angle / 360) * totalDuration;
  return new Date(workStart.getTime() + elapsed);
};

const formatDuration = (minutes: number): string => {
  if (minutes < 1) return '<1 min';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

const SEGMENT_COLORS: Record<string, string> = {
  knocking: 'hsl(210, 80%, 55%)',
  doorstep: 'hsl(180, 60%, 50%)',
  transition: 'hsl(45, 90%, 55%)',
  presentation: 'hsl(45, 90%, 55%)',
  sale: 'hsl(142, 76%, 45%)',
  seen_out: 'hsl(45, 90%, 55%)',
  break: 'hsl(35, 90%, 50%)',
  gap: 'hsl(0, 0%, 30%)',
};

const SEGMENT_LABELS: Record<string, string> = {
  knocking: 'Knocking',
  doorstep: 'Doorstep Talk',
  transition: 'Transition',
  presentation: 'Presentation',
  sale: 'Sale',
  seen_out: 'Seen Out',
  break: 'Break',
  gap: 'Gap',
};

export const SegmentDetailDrawer = ({
  open,
  onOpenChange,
  segment,
  sale,
  workStart,
  workEnd,
  totalWorkMinutes,
}: SegmentDetailDrawerProps) => {
  if (!segment || !workStart || !workEnd) return null;
  
  const startTime = angleToTime(segment.startAngle, workStart, workEnd);
  const endTime = angleToTime(segment.endAngle, workStart, workEnd);
  const duration = segment.duration || 
    ((segment.endAngle - segment.startAngle) / 360) * totalWorkMinutes;
  
  const isSale = segment.type === 'sale';
  const isPresentation = segment.type === 'presentation';
  const isGap = segment.type === 'gap';
  const isBreak = segment.type === 'break';
  const isTransition = segment.type === 'transition';
  const isDoorstep = segment.type === 'doorstep';
  const isSeenOut = segment.type === 'seen_out';
  
  // For gap segments over 20 min, show coaching callout
  const isCoachingOpportunity = isGap && duration >= 20;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="border-b pb-3">
          <div className="flex items-center gap-3">
            <div 
              className="w-4 h-4 rounded-sm"
              style={{ backgroundColor: SEGMENT_COLORS[segment.type] }}
            />
            <DrawerTitle className="text-lg">
              {SEGMENT_LABELS[segment.type]}
            </DrawerTitle>
            {segment.source === 'estimated' && (
              <Badge variant="secondary" className="text-[10px]">
                Estimated
              </Badge>
            )}
          </div>
        </DrawerHeader>

        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Time Info - Always shown */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Time</span>
            </div>
            <div className="text-sm font-medium tabular-nums">
              {format(startTime, 'h:mm a')} – {format(endTime, 'h:mm a')}
            </div>
          </div>
          
          {/* Duration - Always shown */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Duration</span>
            </div>
            <div className="text-sm font-medium tabular-nums">
              {formatDuration(duration)}
            </div>
          </div>

          {/* Sale-specific details */}
          {isSale && sale && (
            <>
              <Separator />
              
              {/* PRMR */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-primary" />
                  <span className="text-sm text-muted-foreground">PRMR</span>
                </div>
                <div className="text-sm font-bold text-primary tabular-nums">
                  ${formatPRMR(sale.prmr)}
                </div>
              </div>
              
              {/* Sale Type */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Type</span>
                </div>
                <Badge variant={sale.type === 'fp' ? 'default' : 'secondary'}>
                  {sale.type === 'fp' ? 'FP+' : 'Upgrade'}
                </Badge>
              </div>
              
              {/* Deal Type if logged */}
              {sale.deal_type && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Home className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Deal</span>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {sale.deal_type}
                  </Badge>
                </div>
              )}
              
              {/* Difficulty if logged */}
              {sale.difficulty && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Difficulty</span>
                  </div>
                  <Badge 
                    variant="outline"
                    className={cn(
                      "capitalize",
                      sale.difficulty === 'easy' && "border-green-500 text-green-600",
                      sale.difficulty === 'medium' && "border-amber-500 text-amber-600",
                      sale.difficulty === 'hard' && "border-red-500 text-red-600"
                    )}
                  >
                    {sale.difficulty}
                  </Badge>
                </div>
              )}
              
              {/* Money Spent if logged */}
              {sale.money_spent !== undefined && sale.money_spent > 0 && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Money Spent</span>
                  </div>
                  <span className="text-sm font-medium tabular-nums">
                    ${sale.money_spent}
                  </span>
                </div>
              )}
              
              {/* Customer Name if CRM data */}
              {sale.customer_name && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <span className="text-sm text-muted-foreground">Customer</span>
                  <span className="text-sm font-medium">{sale.customer_name}</span>
                </div>
              )}
            </>
          )}

          {/* Presentation without sale */}
          {isPresentation && (
            <>
              <Separator />
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <Home className="w-4 h-4 text-amber-500" />
                <span className="text-sm text-amber-600 dark:text-amber-400">
                  Presentation without sale logged
                </span>
              </div>
            </>
          )}

          {/* Break details */}
          {isBreak && (
            <>
              <Separator />
              <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <Coffee className="w-4 h-4 text-orange-500" />
                <span className="text-sm text-orange-600 dark:text-orange-400">
                  Scheduled break period
                </span>
              </div>
            </>
          )}

          {/* Gap coaching callout */}
          {isCoachingOpportunity && (
            <>
              <Separator />
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  <span className="text-sm font-medium text-destructive">
                    Coaching Opportunity
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  This {formatDuration(duration)} gap may indicate idle time. 
                  Consider checking in about time management or potential blockers.
                </p>
              </div>
            </>
          )}

          {/* Transition info */}
          {isTransition && (
            <>
              <Separator />
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <Home className="w-4 h-4 text-amber-500" />
                <span className="text-sm text-amber-600 dark:text-amber-400">
                  Entered home for presentation
                </span>
              </div>
            </>
          )}

          {/* Doorstep conversation */}
          {isDoorstep && (
            <>
              <Separator />
              <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20 space-y-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-cyan-500" />
                  <span className="text-sm font-medium text-cyan-600 dark:text-cyan-400">
                    Doorstep Conversation
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Rep talked to someone at the door but didn't transition inside.
                  {segment.hasPitch && " A pitch was attempted."}
                  {segment.hasDM && !segment.hasPitch && " Decision maker was contacted."}
                </p>
              </div>
            </>
          )}

          {/* Seen out */}
          {isSeenOut && (
            <>
              <Separator />
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-2">
                <div className="flex items-center gap-2">
                  <DoorOpen className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                    Seen Out
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Got into the home but was asked to leave before presenting.
                </p>
                <p className="text-xs text-muted-foreground/80 italic">
                  Coach: Work on building rapport quickly after entering.
                </p>
              </div>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
