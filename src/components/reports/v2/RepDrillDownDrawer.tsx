import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { X, Clock, Footprints, Target, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { EffortResult } from "@/utils/effortScore";
import { RepWorkTimeline } from "./RepWorkTimeline";
import { RepGoalPaceCard } from "./RepGoalPaceCard";
import { useRepDrillDownData } from "@/hooks/useRepDrillDownData";

interface RepDrillDownData {
  userId: string;
  name: string;
  year?: string;
  teamName?: string;
  phone?: string;
  
  // Today/Period stats
  doors: number;
  dms: number;
  pitches: number;
  transitions: number;
  presentations: number;
  closes: number;
  fp: number;
  prmr: number;
  hoursWorked: number;
  
  // Effort analysis
  effort: EffortResult;
  
  // Timeline data (optional)
  workStartTime?: string;
  workEndTime?: string;
  
  // Coaching recommendation
  coachingFocus?: string;
}

interface RepDrillDownDrawerProps {
  rep: RepDrillDownData | null;
  isOpen: boolean;
  onClose: () => void;
  onSendSms?: (phone: string, message: string) => void;
}

export const RepDrillDownDrawer = ({
  rep,
  isOpen,
  onClose,
  onSendSms,
}: RepDrillDownDrawerProps) => {
  // Fetch extended data (timeline + goals)
  const { data: extendedData, isLoading: isLoadingExtended } = useRepDrillDownData(
    isOpen && rep ? rep.userId : undefined
  );

  if (!rep) return null;

  const getFirstName = (name: string) => name.split(' ')[0];

  // Generate coaching recommendation based on data
  const getCoachingRecommendation = (): string => {
    if (rep.effort.category === 'needs_improvement') {
      if (rep.effort.flags.some(f => f.type === 'low_doors')) {
        return 'Focus on increasing door volume. Set a doors-per-hour target.';
      }
      if (rep.effort.flags.some(f => f.type === 'late_start')) {
        return 'Address late starts. Establish a consistent morning routine.';
      }
      if (rep.effort.flags.some(f => f.type === 'early_end')) {
        return 'Encourage working later. Best sales often happen in evening hours.';
      }
    }
    
    // Check conversion ratios
    if (rep.pitches > 0 && rep.transitions === 0) {
      return 'Focus on Pitch → Transition. Practice creating curiosity and getting commitment.';
    }
    if (rep.transitions > 0 && rep.presentations === 0) {
      return 'Focus on getting inside for presentations after transition.';
    }
    if (rep.presentations > 0 && rep.closes === 0) {
      return 'Focus on closing techniques. Review objection handling.';
    }
    
    if (rep.effort.category === 'outstanding' && rep.fp > 0) {
      return 'Strong performance! Consider for mentoring opportunities.';
    }
    
    return 'Continue building momentum with consistent effort.';
  };

  // Status indicators
  const StatusIndicator = ({ 
    label, 
    status, 
    detail 
  }: { 
    label: string; 
    status: 'good' | 'warning' | 'bad'; 
    detail: string;
  }) => (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{detail}</span>
        <div className={cn(
          "w-2 h-2 rounded-full",
          status === 'good' && "bg-green-500",
          status === 'warning' && "bg-yellow-500",
          status === 'bad' && "bg-red-500",
        )} />
      </div>
    </div>
  );

  const effortStatus = rep.effort.category === 'outstanding' ? 'good' : 
                       rep.effort.category === 'standard' ? 'warning' : 'bad';

  // Simple skill status based on funnel progression
  const hasActivity = rep.doors > 0;
  const conversionOk = hasActivity ? (rep.fp / rep.doors > 0.01 || rep.presentations > 0) : true;
  const skillStatus = conversionOk ? 'good' : 'warning';

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DrawerTitle className="text-xl">{rep.name}</DrawerTitle>
              {rep.year && (
                <Badge variant="outline">{rep.year}</Badge>
              )}
            </div>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon">
                <X className="w-4 h-4" />
              </Button>
            </DrawerClose>
          </div>
          {rep.teamName && (
            <p className="text-sm text-muted-foreground">{rep.teamName}</p>
          )}
        </DrawerHeader>

        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Status Indicators */}
          <div className="space-y-2">
            <StatusIndicator 
              label="Effort" 
              status={effortStatus}
              detail={`${rep.effort.score}/100`}
            />
            <StatusIndicator 
              label="Skill" 
              status={skillStatus}
              detail={conversionOk ? 'On track' : 'Review funnel'}
            />
          </div>

          {/* Today's Stats */}
          <div className="grid grid-cols-4 gap-2">
            <StatBox label="Doors" value={rep.doors} />
            <StatBox label="Pitches" value={rep.pitches} />
            <StatBox label="Trans" value={rep.transitions} />
            <StatBox label="Pres" value={rep.presentations} />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <StatBox 
              label="FP+" 
              value={rep.fp.toFixed(1)} 
              highlight={rep.fp > 0}
            />
            <StatBox 
              label="PRMR" 
              value={`$${rep.prmr.toLocaleString()}`}
              highlight={rep.prmr > 0}
            />
            <StatBox 
              label="Hours" 
              value={rep.hoursWorked.toFixed(1)}
            />
          </div>

          {/* Effort Flags */}
          {rep.effort.flags.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Effort Flags</h4>
              <div className="flex flex-wrap gap-2">
                {rep.effort.flags.map((flag, idx) => (
                  <Badge 
                    key={idx}
                    variant={flag.severity === 'critical' ? 'destructive' : 'secondary'}
                    className="gap-1"
                  >
                    {flag.type === 'late_start' || flag.type === 'early_end' ? (
                      <Clock className="w-3 h-3" />
                    ) : (
                      <Footprints className="w-3 h-3" />
                    )}
                    {flag.label}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Goal Pace Section */}
          {extendedData?.goals ? (
            <RepGoalPaceCard
              preseasonGoal={extendedData.goals.preseasonGoal}
              preseasonProgress={extendedData.preseasonFP}
              mustGoal={extendedData.goals.mustGoal}
              willGoal={extendedData.goals.willGoal}
              couldGoal={extendedData.goals.couldGoal}
              currentFP={extendedData.totalSeasonFP}
              focusTier={extendedData.goals.focusTier}
            />
          ) : !isLoadingExtended && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <Target className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">No goals configured</span>
            </div>
          )}

          <Separator />

          {/* Work Timeline Section */}
          {extendedData?.last14DaysEntries && extendedData.last14DaysEntries.length > 0 ? (
            <RepWorkTimeline entries={extendedData.last14DaysEntries} />
          ) : !isLoadingExtended && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">No recent activity</span>
            </div>
          )}

          <Separator />

          {/* Coaching Recommendation */}
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-primary" />
              <h4 className="font-medium">Coaching Focus</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              {rep.coachingFocus || getCoachingRecommendation()}
            </p>
          </div>

          {/* SMS Action */}
          {rep.phone && onSendSms && (
            <Button 
              variant="outline" 
              className="w-full gap-2"
              onClick={() => {
                const message = generateSmsMessage(rep);
                onSendSms(rep.phone!, message);
              }}
            >
              <MessageSquare className="w-4 h-4" />
              Send Text to {getFirstName(rep.name)}
            </Button>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

// Stat box component
const StatBox = ({ 
  label, 
  value, 
  highlight = false 
}: { 
  label: string; 
  value: string | number; 
  highlight?: boolean;
}) => (
  <div className={cn(
    "p-3 rounded-lg text-center",
    highlight ? "bg-primary/10" : "bg-muted/50"
  )}>
    <div className={cn(
      "text-lg font-semibold tabular-nums",
      highlight && "text-primary"
    )}>
      {value}
    </div>
    <div className="text-xs text-muted-foreground">{label}</div>
  </div>
);

// Generate contextual SMS message
const generateSmsMessage = (rep: RepDrillDownData): string => {
  const firstName = rep.name.split(' ')[0];
  
  if (rep.effort.category === 'outstanding' && rep.fp > 0) {
    return `Hey ${firstName}! Great work today - ${rep.fp.toFixed(1)} FP+! Keep crushing it! 🔥`;
  }
  
  if (rep.effort.flags.some(f => f.type === 'late_start')) {
    return `Hey ${firstName}, noticed you got a late start today. Everything ok? Let's get after it tomorrow! 💪`;
  }
  
  if (rep.effort.flags.some(f => f.type === 'low_doors')) {
    return `Hey ${firstName}, let's pick up the door volume! You've got this. What do you need from me?`;
  }
  
  return `Hey ${firstName}, checking in - how's it going out there? Anything I can help with?`;
};
