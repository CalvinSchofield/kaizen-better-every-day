import { useState, useEffect, useMemo } from "react";
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
import { RingSegment } from "@/utils/inHomeZoneCalculator";
import { Sale } from "@/hooks/useDailyEntry";
import { 
  ActivityRingHero, 
  FinalizedStatsGrid, 
  WeekActivityStrip,
  CoachingCallouts,
  ActivityCalendarDrawer,
  ActivityRingLegend,
  LegendTriggerButton,
  GoalTimeframeToggle,
  GoalTimeframe,
  SegmentDetailDrawer,
} from "@/components/activity-ring";
import { format, isSameDay, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";

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
  /** Date range start - used to find most recent activity day */
  dateRangeStart?: Date;
  /** Date range end - used to find most recent activity day */
  dateRangeEnd?: Date;
}

export const RepDrillDownDrawer = ({
  rep,
  isOpen,
  onClose,
  onSendSms,
  dateRangeStart,
  dateRangeEnd,
}: RepDrillDownDrawerProps) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [hasAutoSelected, setHasAutoSelected] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [goalTimeframe, setGoalTimeframe] = useState<GoalTimeframe>('D');
  const [selectedSegment, setSelectedSegment] = useState<RingSegment | null>(null);
  const [selectedSegmentSale, setSelectedSegmentSale] = useState<Sale | null>(null);
  
  // Get userId for hooks - must be at top level
  const userId = isOpen && rep ? rep.userId : undefined;
  
  // Fetch extended data (timeline + goals)
  const { data: extendedData, isLoading: isLoadingExtended } = useRepDrillDownData(userId);
  
  // Fetch calendar data for week strip
  const { data: calendarData } = useRepActivityCalendar(userId);
  
  // Fetch selected day activity
  const { data: dayActivity } = useRepDayActivity(userId, selectedDate);
  
  // Auto-select best date when drawer opens or date range changes
  useEffect(() => {
    if (!isOpen) {
      setHasAutoSelected(false);
      return;
    }
    
    // Only auto-select once per drawer open
    if (hasAutoSelected) return;
    
    const rangeEnd = dateRangeEnd || new Date();
    const rangeStart = dateRangeStart || rangeEnd;
    
    // If we have calendar data, find the most recent day with activity in range
    if (calendarData?.summaries && calendarData.summaries.length > 0) {
      const rangeStartStr = format(rangeStart, 'yyyy-MM-dd');
      const rangeEndStr = format(rangeEnd, 'yyyy-MM-dd');
      
      // Filter to days within range that have work, then pick most recent
      const daysInRange = calendarData.summaries
        .filter(s => s.hasWork && s.date >= rangeStartStr && s.date <= rangeEndStr)
        .sort((a, b) => b.date.localeCompare(a.date)); // Most recent first
      
      if (daysInRange.length > 0) {
        // Use parseISO to avoid timezone issues
        const bestDate = parseISO(daysInRange[0].date);
        setSelectedDate(bestDate);
        setHasAutoSelected(true);
        return;
      }
    }
    
    // Fallback: use end of range
    setSelectedDate(rangeEnd);
    setHasAutoSelected(true);
  }, [isOpen, calendarData, dateRangeStart?.getTime(), dateRangeEnd?.getTime(), hasAutoSelected]);

  // Use day activity if available, otherwise fall back to rep data for today
  const isToday = isSameDay(selectedDate, new Date());
  const displayData = isToday 
    ? {
        doors: rep?.doors ?? 0,
        dms: rep?.dms ?? 0,
        pitches: rep?.pitches ?? 0,
        transitions: rep?.transitions ?? 0,
        presentations: rep?.presentations ?? 0,
        closes: rep?.closes ?? 0,
        fp: rep?.fp ?? 0,
        prmr: rep?.prmr ?? 0,
        hoursWorked: rep?.hoursWorked ?? 0,
        workStartTime: rep?.workStartTime,
        workEndTime: rep?.workEndTime,
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

  // Calculate timeframe-based goal progress
  const timeframeGoalProgress = useMemo(() => {
    if (!calendarData?.summaries) return { D: 0, W: 0, M: 0, Y: 0 };
    
    const dailyGoal = extendedData?.goals?.mustGoal 
      ? extendedData.goals.mustGoal / 53 
      : 2;
    const seasonGoal = extendedData?.goals?.focusTier === 'couldDo' 
      ? extendedData?.goals?.couldGoal 
      : extendedData?.goals?.focusTier === 'willDo' 
        ? extendedData?.goals?.willGoal 
        : extendedData?.goals?.mustGoal || 0;
    
    // Day progress
    const dayFP = displayData.fp;
    const dayProgress = dailyGoal > 0 ? (dayFP / dailyGoal) * 100 : 0;
    
    // Week progress
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
    const weekFP = calendarData.summaries
      .filter(s => {
        const d = parseISO(s.date);
        return isWithinInterval(d, { start: weekStart, end: weekEnd });
      })
      .reduce((acc, s) => acc + (s.fp || 0), 0);
    const weekGoal = dailyGoal * 7;
    const weekProgress = weekGoal > 0 ? (weekFP / weekGoal) * 100 : 0;
    
    // Month progress
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);
    const daysInMonth = monthEnd.getDate();
    const monthFP = calendarData.summaries
      .filter(s => {
        const d = parseISO(s.date);
        return isWithinInterval(d, { start: monthStart, end: monthEnd });
      })
      .reduce((acc, s) => acc + (s.fp || 0), 0);
    const monthGoal = dailyGoal * daysInMonth;
    const monthProgress = monthGoal > 0 ? (monthFP / monthGoal) * 100 : 0;
    
    // Year/Season progress
    const yearProgress = seasonGoal > 0 
      ? ((extendedData?.totalSeasonFP || 0) / seasonGoal) * 100 
      : 0;
    
    return { D: dayProgress, W: weekProgress, M: monthProgress, Y: yearProgress };
  }, [calendarData?.summaries, extendedData, dayActivity, selectedDate]);

  if (!rep) return null;

  const getFirstName = (name: string) => {
    // Strip emojis and get first word
    const stripped = name.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2B50}]|[\u{1FA00}-\u{1FAFF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]/gu, '').trim();
    return stripped.split(' ')[0] || stripped;
  };


  // Get goal progress based on selected timeframe
  const goalProgress = timeframeGoalProgress[goalTimeframe];
  
  // Calculate work start/end for segment drawer
  const workStart = dayActivity?.workStartTime ? parseISO(dayActivity.workStartTime) : null;
  const workEnd = dayActivity?.workEndTime ? parseISO(dayActivity.workEndTime) : null;
  const totalWorkMinutes = workStart && workEnd 
    ? (workEnd.getTime() - workStart.getTime()) / (1000 * 60) 
    : 0;
  
  // Handle segment click
  const handleSegmentClick = (segment: RingSegment, matchedSale?: Sale) => {
    setSelectedSegment(segment);
    setSelectedSegmentSale(matchedSale || null);
  };

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      {/* z-[60] to stack above WorkingRepsDrawer/GoalPaceDrawer (z-50) */}
      <DrawerContent className="max-h-[92vh] z-[60]">
        <DrawerHeader className="border-b pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DrawerTitle className="text-xl">{rep.name}</DrawerTitle>
              {rep.year && (
                <Badge variant="outline">{rep.year}</Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <LegendTriggerButton onClick={() => setShowLegend(true)} />
              <DrawerClose asChild>
                <Button variant="ghost" size="icon">
                  <X className="w-4 h-4" />
                </Button>
              </DrawerClose>
            </div>
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
                  dailyGoal={extendedData?.goals?.mustGoal 
                    ? extendedData.goals.mustGoal / 53 
                    : 2
                  }
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
                  showGoalRing={goalProgress > 0}
                  showGapPercent={true}
                  showLegend={false}
                  size="md"
                  onSegmentClick={handleSegmentClick}
                />
              </div>
            )}
            
            {/* Timeframe Toggle */}
            <GoalTimeframeToggle
              selected={goalTimeframe}
              onSelect={setGoalTimeframe}
            />
            
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

            {/* Goal Pace Card - Season-aware */}

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
        
        {/* Legend Drawer */}
        <ActivityRingLegend
          open={showLegend}
          onOpenChange={setShowLegend}
        />
        
        {/* Segment Detail Drawer */}
        <SegmentDetailDrawer
          open={!!selectedSegment}
          onOpenChange={(open) => !open && setSelectedSegment(null)}
          segment={selectedSegment}
          sale={selectedSegmentSale}
          workStart={workStart}
          workEnd={workEnd}
          totalWorkMinutes={totalWorkMinutes}
        />
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
