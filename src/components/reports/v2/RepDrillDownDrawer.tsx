import { useState } from "react";
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { X, Clock, Footprints, Target, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { EffortResult } from "@/utils/effortScore";
import { RepGoalPaceCard } from "./RepGoalPaceCard";
import { useRepDrillDownData } from "@/hooks/useRepDrillDownData";
import { useRepDayActivity } from "@/hooks/useRepDayActivity";
import { useRepActivityCalendar } from "@/hooks/useRepActivityCalendar";
import { PurposeDisplayCard } from "@/components/goals/PurposeDisplayCard";
import { 
  ActivityRingHero, 
  FinalizedStatsGrid, 
  RingGoalProgress,
  WeekActivityStrip,
  CoachingCallouts,
  ActivityCalendarDrawer,
} from "@/components/activity-ring";
import { format, isSameDay } from "date-fns";

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
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  
  // Get userId for hooks - must be at top level
  const userId = isOpen && rep ? rep.userId : undefined;
  
  // Fetch extended data (timeline + goals)
  const { data: extendedData, isLoading: isLoadingExtended } = useRepDrillDownData(userId);
  
  // Fetch calendar data for week strip
  const { data: calendarData } = useRepActivityCalendar(userId);
  
  // Fetch selected day activity
  const { data: dayActivity } = useRepDayActivity(userId, selectedDate);

  if (!rep) return null;

  const getFirstName = (name: string) => {
    // Strip emojis and get first word
    const stripped = name.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2B50}]|[\u{1FA00}-\u{1FAFF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]/gu, '').trim();
    return stripped.split(' ')[0] || stripped;
  };

  const isToday = isSameDay(selectedDate, new Date());
  
  // Use day activity if available, otherwise fall back to rep data for today
  const displayData = isToday 
    ? {
        doors: rep.doors,
        dms: rep.dms,
        pitches: rep.pitches,
        transitions: rep.transitions,
        presentations: rep.presentations,
        closes: rep.closes,
        fp: rep.fp,
        prmr: rep.prmr,
        hoursWorked: rep.hoursWorked,
        workStartTime: rep.workStartTime,
        workEndTime: rep.workEndTime,
      }
    : {
        doors: dayActivity?.doors || 0,
        dms: dayActivity?.dms || 0,
        pitches: dayActivity?.pitches || 0,
        transitions: dayActivity?.transitions || 0,
        presentations: dayActivity?.presentations || 0,
        closes: dayActivity?.closes || 0,
        fp: dayActivity?.fp || 0,
        prmr: dayActivity?.prmr || 0,
        hoursWorked: dayActivity?.hoursWorked || 0,
        workStartTime: dayActivity?.workStartTime,
        workEndTime: dayActivity?.workEndTime,
      };

  // Calculate goal progress percentage
  const dailyGoalFP = extendedData?.goals?.mustGoal 
    ? extendedData.goals.mustGoal / 53 // Roughly divide by season days
    : 2; // Default daily target
  const goalProgress = dailyGoalFP > 0 
    ? Math.min(100, (displayData.fp / dailyGoalFP) * 100)
    : 0;

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="border-b pb-3">
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

        <div className="overflow-y-auto">
          {/* Week Activity Strip with Calendar Button */}
          <div className="px-4 py-3 border-b bg-muted/20">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <WeekActivityStrip
                  daySummaries={calendarData?.summaries || []}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => setShowCalendar(true)}
              >
                <Calendar className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Date Header */}
          {!isToday && (
            <div className="px-4 py-2 text-center">
              <span className="text-sm font-medium text-muted-foreground">
                {format(selectedDate, 'EEEE, MMMM d, yyyy')}
              </span>
            </div>
          )}

          <div className="p-4 space-y-4">
            {/* Activity Ring Hero */}
            {(displayData.doors > 0 || displayData.hoursWorked > 0) && (
              <div className="flex justify-center">
                <ActivityRingHero
                  entry={{
                    doors_knocked: displayData.doors,
                    decision_makers: displayData.dms,
                    pitches: displayData.pitches,
                    transitions: displayData.transitions,
                    presentations: displayData.presentations,
                    closes: displayData.closes,
                    fp_plus: displayData.fp,
                    prmr: displayData.prmr,
                    is_finalized: !isToday || (dayActivity?.isFinalized ?? false),
                    // Always use dayActivity for work times when available (it has actual timestamps)
                    work_start_time: dayActivity?.workStartTime || displayData.workStartTime || null,
                    work_end_time: dayActivity?.workEndTime || displayData.workEndTime || null,
                    break_periods: dayActivity?.breakPeriods || [],
                    counter_timestamps: dayActivity?.counterTimestamps || {},
                    timezone: null,
                  }}
                  salesLog={dayActivity?.salesLog as any}
                  goalProgress={goalProgress}
                  size="md"
                />
              </div>
            )}
            
            {/* Stats Grid */}
            <FinalizedStatsGrid
              entry={{
                doors_knocked: displayData.doors,
                decision_makers: displayData.dms,
                pitches: displayData.pitches,
                transitions: displayData.transitions,
                presentations: displayData.presentations,
                closes: displayData.closes,
                fp_plus: displayData.fp,
                prmr: displayData.prmr,
              }}
              salesLog={dayActivity?.salesLog as any}
            />
            
            {/* Coaching Callouts - Only for today or recent days */}
            {isToday && displayData.doors > 0 && (
              <CoachingCallouts
                doors={displayData.doors}
                pitches={displayData.pitches}
                transitions={displayData.transitions}
                presentations={displayData.presentations}
                closes={displayData.closes}
                hoursWorked={displayData.hoursWorked}
                workStartTime={displayData.workStartTime}
                workEndTime={displayData.workEndTime}
                gapMinutes={dayActivity?.gapMinutes}
                isRookie={rep.year === 'rookie'}
              />
            )}

            {/* Effort Flags */}
            {isToday && rep.effort.flags.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium px-1">Effort Flags</h4>
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

            {/* Goal Progress Section - Season-Aware */}
            {extendedData?.isPreseason ? (
              // Preseason: Show only preseason goal
              <RingGoalProgress
                preseasonMode
                preseasonFP={extendedData.preseasonFP}
                preseasonGoal={extendedData.goals?.preseasonGoal || 0}
                todayFP={displayData.fp}
                dailyNeed={dailyGoalFP}
                dayOfSeason={extendedData.goalPace?.preseason?.daysElapsed || 1}
                totalSeasonDays={extendedData.goalPace?.preseason?.totalPlannedDays || 53}
              />
            ) : (
              // Summer: Show focus tier goal
              <RingGoalProgress
                summerMode
                seasonFP={extendedData?.totalSeasonFP || 0}
                focusTierGoal={
                  extendedData?.goals?.focusTier === 'couldDo' ? extendedData?.goals?.couldGoal :
                  extendedData?.goals?.focusTier === 'willDo' ? extendedData?.goals?.willGoal :
                  extendedData?.goals?.mustGoal || 0
                }
                focusTier={extendedData?.goals?.focusTier as any}
                todayFP={displayData.fp}
                dailyNeed={dailyGoalFP}
                dayOfSeason={extendedData?.goalPace?.mustDo?.daysElapsed || 1}
                totalSeasonDays={extendedData?.goalPace?.mustDo?.totalPlannedDays || 53}
              />
            )}

            {/* Goal Pace Card - Also season-aware */}
            {extendedData?.goals ? (
              <RepGoalPaceCard
                preseasonGoal={extendedData.goals.preseasonGoal}
                preseasonProgress={extendedData.preseasonFP}
                mustGoal={extendedData.goals.mustGoal}
                willGoal={extendedData.goals.willGoal}
                couldGoal={extendedData.goals.couldGoal}
                currentFP={extendedData.totalSeasonFP}
                focusTier={extendedData.goals.focusTier}
                goalPace={extendedData.goalPace}
                isPreseason={extendedData.isPreseason}
              />
            ) : !isLoadingExtended && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <Target className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">No goals configured</span>
              </div>
            )}

            <Separator />

            {/* Their Purpose / Why */}
            {extendedData?.purposeStatement && (
              <>
                <PurposeDisplayCard
                  purposeStatement={extendedData.purposeStatement}
                  purposeUpdatedAt={extendedData.purposeUpdatedAt}
                />
                <Separator />
              </>
            )}

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
        </div>
        
        {/* Activity Calendar Drawer */}
        {userId && (
          <ActivityCalendarDrawer
            open={showCalendar}
            onOpenChange={setShowCalendar}
            userId={userId}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        )}
      </DrawerContent>
    </Drawer>
  );
};

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
