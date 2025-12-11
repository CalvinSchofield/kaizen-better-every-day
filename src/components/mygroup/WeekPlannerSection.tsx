import { useState, useMemo, useCallback } from "react";
import { Recruit, RecruitActivity } from "@/hooks/useGroupRecruits";
import { useRecruitingRecommendations } from "@/hooks/useRecruitingRecommendations";
import { SwipeableTaskItem } from "./SwipeableTaskItem";
import { RecruitDetailDrawer } from "./RecruitDetailDrawer";
import { ContactMethodDrawer } from "./ContactMethodDrawer";
import { ScheduleFollowUpDrawer } from "./ScheduleFollowUpDrawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, CalendarCheck, AlertTriangle, Users, Sparkles } from "lucide-react";
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  addWeeks, 
  subWeeks, 
  eachDayOfInterval, 
  isSameDay,
  parseISO,
  isPast,
  isToday as isDateToday,
  isBefore,
  startOfToday,
  isTomorrow,
  differenceInDays,
  isThisWeek
} from "date-fns";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";

// Helper to get first name from full name
const getFirstName = (name: string | null): string => {
  if (!name) return '';
  const cleaned = name.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2B50}]|[\u{1FA00}-\u{1FAFF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]/gu, '').trim();
  return cleaned.split(' ')[0];
};

// Stages that should be hidden unless follow-up is due
const HIDDEN_STAGES = ['Not Interested', 'Signed but Not Interested'];

interface BlitzEvent {
  id: string;
  name: string;
  date: string;
  endDate: string | null;
}

interface RepData {
  notion_page_id: string;
  onboarding_complete: boolean | null;
  trainings_complete: boolean | null;
  slack_joined: boolean | null;
  ipad_assigned: boolean | null;
  ramp_to_blitz_phase: string | null;
  ramp_phase_1_complete: boolean | null;
  ramp_phase_2_complete: boolean | null;
  ramp_phase_3_complete: boolean | null;
  ramp_phase_4_complete: boolean | null;
  committed_blitzes: any;
}

interface WeekPlannerSectionProps {
  recruits: Recruit[];
  activities: RecruitActivity[];
  onRecruitClick: (recruit: Recruit) => void;
  blitzes?: BlitzEvent[];
  repDataMap?: Map<string, RepData>;
  dismissedIds?: Set<string>;
  onDismiss?: (recruit: Recruit, message: string) => void;
  // Recommendations passed from parent (already filtered, excluding hero at index 0)
  recommendations?: ReturnType<typeof useRecruitingRecommendations>;
}

export const WeekPlannerSection = ({ 
  recruits, 
  activities,
  onRecruitClick,
  blitzes,
  repDataMap,
  dismissedIds,
  onDismiss,
  recommendations: passedRecommendations,
}: WeekPlannerSectionProps) => {
  const [showSwipeHint, setShowSwipeHint] = useState(true);
  const handleDemoComplete = useCallback(() => setShowSwipeHint(false), []);
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => 
    startOfWeek(new Date(), { weekStartsOn: 0 })
  );
  const [selectedRecruit, setSelectedRecruit] = useState<Recruit | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [contactMethodOpen, setContactMethodOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [contactingRecruit, setContactingRecruit] = useState<Recruit | null>(null);

  // Filter recruits for recommendations - exclude hidden stages except due follow-ups
  const filteredRecruits = useMemo(() => 
    recruits.filter(r => {
      if (HIDDEN_STAGES.includes(r.stage)) return false;
      if (r.stage === 'Potential Follow Up') {
        if (!r.nextActionDue) return false;
        const dueDate = parseISO(r.nextActionDue);
        const today = startOfToday();
        return isBefore(dueDate, today) || isSameDay(dueDate, today);
      }
      return true;
    }),
    [recruits]
  );

  // Use passed recommendations if available (already filtered by parent), otherwise compute locally
  const localRecommendations = useRecruitingRecommendations(filteredRecruits, activities, blitzes, repDataMap);
  
  // Filter out dismissed recommendations
  const recommendations = useMemo(() => {
    const baseRecs = passedRecommendations ?? localRecommendations;
    return dismissedIds 
      ? baseRecs.filter(r => !dismissedIds.has(r.recruit.notionPageId))
      : baseRecs;
  }, [passedRecommendations, localRecommendations, dismissedIds]);

  // Get week days (starting Sunday)
  const weekDays = useMemo(() =>
    eachDayOfInterval({
      start: selectedWeekStart,
      end: endOfWeek(selectedWeekStart, { weekStartsOn: 0 }),
    }),
    [selectedWeekStart]
  );

  // Get scheduled tasks (activities with next_action_due)
  const scheduledTasks = useMemo(() => {
    const tasksMap = new Map<string, { recruit: Recruit; activity: RecruitActivity }[]>();
    
    const latestNextActions = new Map<string, RecruitActivity>();
    activities.forEach(activity => {
      if (activity.next_action_due && activity.next_action) {
        const existing = latestNextActions.get(activity.rep_notion_page_id);
        if (!existing || parseISO(activity.created_at) > parseISO(existing.created_at)) {
          latestNextActions.set(activity.rep_notion_page_id, activity);
        }
      }
    });

    latestNextActions.forEach((activity, recruitId) => {
      const recruit = filteredRecruits.find(r => r.notionPageId === recruitId);
      if (!recruit) return;

      const dateKey = activity.next_action_due!;
      if (!tasksMap.has(dateKey)) {
        tasksMap.set(dateKey, []);
      }
      tasksMap.get(dateKey)!.push({ recruit, activity });
    });

    return tasksMap;
  }, [activities, filteredRecruits]);

  // Count overdue tasks
  const overdueCount = useMemo(() => {
    let count = 0;
    scheduledTasks.forEach((tasks, dateStr) => {
      const date = parseISO(dateStr);
      if (isPast(date) && !isDateToday(date)) {
        count += tasks.length;
      }
    });
    return count;
  }, [scheduledTasks]);

  // Count this week's tasks
  const weekTaskCount = useMemo(() => {
    let count = 0;
    weekDays.forEach(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      count += scheduledTasks.get(dateKey)?.length || 0;
    });
    return count;
  }, [weekDays, scheduledTasks]);

  // Signed reps that need nurturing
  const signedNeedingNurture = useMemo(() => 
    recommendations.filter(r => r.reasonBadge === 'signed').length,
    [recommendations]
  );

  const handlePrevWeek = () => setSelectedWeekStart(prev => subWeeks(prev, 1));
  const handleNextWeek = () => setSelectedWeekStart(prev => addWeeks(prev, 1));
  const handleToday = () => setSelectedWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }));

  // Get week label based on selected week
  const weekLabel = useMemo(() => {
    const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 0 });
    const diff = differenceInDays(selectedWeekStart, currentWeekStart);
    if (diff === 0) return 'This Week';
    if (diff === 7) return 'Next Week';
    if (diff === -7) return 'Last Week';
    return format(selectedWeekStart, 'MMM d') + ' - ' + format(endOfWeek(selectedWeekStart, { weekStartsOn: 0 }), 'MMM d');
  }, [selectedWeekStart]);

  // Get today's tasks
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const todayTasks = scheduledTasks.get(todayKey) || [];

  const handleLocalRecruitClick = (recruit: Recruit) => {
    setSelectedRecruit(recruit);
    setDrawerOpen(true);
    onRecruitClick(recruit);
  };

  const handleSwipeContact = (recruit: Recruit) => {
    setContactingRecruit(recruit);
    setContactMethodOpen(true);
  };

  const handleSwipeSchedule = (recruit: Recruit) => {
    setContactingRecruit(recruit);
    setScheduleOpen(true);
  };

  const getActivitiesForRecruit = (recruit: Recruit) => 
    activities.filter(a => a.rep_notion_page_id === recruit.notionPageId);

  // Get rest of week tasks (exclude today)
  const restOfWeekTasks = useMemo(() => {
    return weekDays
      .filter(day => !isDateToday(day) && !isPast(day))
      .map(day => {
        const dateKey = format(day, 'yyyy-MM-dd');
        return {
          day,
          dateKey,
          tasks: scheduledTasks.get(dateKey) || []
        };
      })
      .filter(({ tasks }) => tasks.length > 0);
  }, [weekDays, scheduledTasks]);

  return (
    <div className="space-y-4">
      {/* Week Overview Card with Week Grid Inside */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{weekLabel}</CardTitle>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePrevWeek}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-8 px-3" onClick={handleToday}>
                Today
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNextWeek}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {format(selectedWeekStart, 'MMM d')} - {format(endOfWeek(selectedWeekStart, { weekStartsOn: 0 }), 'MMM d, yyyy')}
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant="secondary" className="flex items-center gap-1.5">
              <CalendarCheck className="h-3.5 w-3.5" />
              {weekTaskCount} scheduled
            </Badge>
            {overdueCount > 0 && (
              <Badge variant="destructive" className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                {overdueCount} overdue
              </Badge>
            )}
            {signedNeedingNurture > 0 && (
              <Badge className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                <Users className="h-3.5 w-3.5" />
                {signedNeedingNurture} signed needing attention
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Week Grid */}
          <div className="grid grid-cols-7 gap-1">
            {weekDays.map((day) => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const dayTasks = scheduledTasks.get(dateKey) || [];
              const isToday = isDateToday(day);
              const isPastDay = isPast(day) && !isToday;

              return (
                <div 
                  key={dateKey} 
                  className={cn(
                    "text-center p-1.5 rounded-lg",
                    isToday && "bg-primary/10 ring-2 ring-primary/20"
                  )}
                >
                  <div className="text-xs text-muted-foreground">
                    {format(day, 'EEE')}
                  </div>
                  <div className={cn(
                    "text-sm font-medium",
                    isToday && "text-primary",
                    isPastDay && "text-muted-foreground"
                  )}>
                    {format(day, 'd')}
                  </div>
                  {dayTasks.length > 0 && (
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full mx-auto mt-1",
                      isPastDay ? "bg-destructive" : "bg-primary"
                    )} />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Overdue Section - show before today */}
      {overdueCount > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-destructive flex items-center gap-2">
              Overdue
              <Badge variant="destructive" className="text-xs">
                {overdueCount}
              </Badge>
            </h3>
          </div>
          <div className="space-y-2">
            {Array.from(scheduledTasks.entries())
              .filter(([dateStr]) => {
                const date = parseISO(dateStr);
                return isPast(date) && !isDateToday(date);
              })
              .sort(([a], [b]) => parseISO(a).getTime() - parseISO(b).getTime())
              .flatMap(([dateStr, tasks]) => 
                tasks.map(({ recruit, activity }) => (
                  <SwipeableTaskItem
                    key={`overdue-${recruit.notionPageId}-${activity.id}`}
                    recruit={recruit}
                    activity={activity}
                    onRecruitClick={handleLocalRecruitClick}
                    onContact={handleSwipeContact}
                    onSchedule={handleSwipeSchedule}
                    isOverdue
                  />
                ))
              )}
          </div>
        </div>
      )}

      {/* Today Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-primary flex items-center gap-2">
            Today
            {todayTasks.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {todayTasks.length} scheduled
              </Badge>
            )}
          </h3>
          <span className={cn(
            "text-xs text-muted-foreground transition-opacity duration-500",
            showSwipeHint ? "opacity-100" : "opacity-0"
          )}>← schedule · contact →</span>
        </div>

        {/* Today's Scheduled Tasks */}
        {todayTasks.length > 0 && (
          <div className="space-y-2">
            {todayTasks.map(({ recruit, activity }, index) => (
              <SwipeableTaskItem
                key={`${recruit.notionPageId}-${activity.id}`}
                recruit={recruit}
                activity={activity}
                onRecruitClick={handleLocalRecruitClick}
                onContact={handleSwipeContact}
                onSchedule={handleSwipeSchedule}
                showSwipeDemo={index === 0 && recommendations.length === 0}
                onDemoComplete={handleDemoComplete}
              />
            ))}
          </div>
        )}

        {/* Recommended Today (limit to 4) */}
        {recommendations.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4" />
              <span>Recommended Today</span>
            </div>
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {recommendations.slice(0, 4).map((rec, index) => (
                  <motion.div
                    key={rec.recruit.notionPageId}
                    layout
                    initial={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <SwipeableTaskItem
                      recruit={rec.recruit}
                      reason={rec.reason}
                      reasonBadge={rec.reasonBadge}
                      daysSinceContact={rec.daysSinceContact}
                      onRecruitClick={handleLocalRecruitClick}
                      onContact={handleSwipeContact}
                      onSchedule={handleSwipeSchedule}
                      showSwipeDemo={index === 0 && todayTasks.length === 0}
                      onDemoComplete={handleDemoComplete}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {todayTasks.length === 0 && recommendations.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nothing scheduled for today
          </p>
        )}
      </div>

      {/* Rest of the Week */}
      {restOfWeekTasks.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Rest of the Week
          </h3>
          {restOfWeekTasks.map(({ day, dateKey, tasks }) => (
            <div key={dateKey} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {format(day, 'EEEE, MMM d')}
                </span>
                <Badge variant="outline" className="text-xs">
                  {tasks.length}
                </Badge>
              </div>
              <div className="space-y-2">
                {tasks.map(({ recruit, activity }) => (
                  <SwipeableTaskItem
                    key={`${recruit.notionPageId}-${activity.id}`}
                    recruit={recruit}
                    activity={activity}
                    onRecruitClick={handleLocalRecruitClick}
                    onContact={handleSwipeContact}
                    onSchedule={handleSwipeSchedule}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Drawers */}
      <RecruitDetailDrawer
        recruit={selectedRecruit}
        activities={selectedRecruit ? getActivitiesForRecruit(selectedRecruit) : []}
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open && selectedRecruit) {
            const updated = recruits.find(r => r.notionPageId === selectedRecruit.notionPageId);
            if (updated) setSelectedRecruit(updated);
          }
        }}
      />

      <ContactMethodDrawer
        open={contactMethodOpen}
        onOpenChange={setContactMethodOpen}
        recruit={contactingRecruit}
        onComplete={() => {
          setContactMethodOpen(false);
          if (contactingRecruit && onDismiss) {
            onDismiss(contactingRecruit, `Contact logged for ${contactingRecruit.name || 'recruit'}`);
          }
        }}
      />

      <ScheduleFollowUpDrawer
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        recruit={contactingRecruit}
        onComplete={() => {
          setScheduleOpen(false);
          if (contactingRecruit && onDismiss) {
            onDismiss(contactingRecruit, `Follow-up scheduled for ${contactingRecruit.name || 'recruit'}`);
          }
        }}
      />
    </div>
  );
};
