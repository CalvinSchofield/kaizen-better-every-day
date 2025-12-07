import { useState, useMemo } from "react";
import { Recruit, RecruitActivity } from "@/hooks/useGroupRecruits";
import { useRecruitingRecommendations } from "@/hooks/useRecruitingRecommendations";
import { PlannerTaskCard } from "./PlannerTaskCard";
import { RecommendationsSection } from "./RecommendationsSection";
import { RecruitDetailDrawer } from "./RecruitDetailDrawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, CalendarCheck, AlertTriangle, Users } from "lucide-react";
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

// Helper to get first name from full name
const getFirstName = (name: string | null): string => {
  if (!name) return '';
  // Strip emojis first
  const cleaned = name.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2B50}]|[\u{1FA00}-\u{1FAFF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]/gu, '').trim();
  return cleaned.split(' ')[0];
};

// Stages that should be hidden unless follow-up is due
const HIDDEN_STAGES = ['Not Interested', 'Signed but Not Interested'];

interface RecruitPlannerViewProps {
  recruits: Recruit[];
  activities: RecruitActivity[];
}

export const RecruitPlannerView = ({ recruits, activities }: RecruitPlannerViewProps) => {
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => 
    startOfWeek(new Date(), { weekStartsOn: 0 })
  );
  const [selectedRecruit, setSelectedRecruit] = useState<Recruit | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  const recommendations = useRecruitingRecommendations(filteredRecruits, activities);

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
    
    // Find latest next_action_due per recruit
    const latestNextActions = new Map<string, RecruitActivity>();
    activities.forEach(activity => {
      if (activity.next_action_due && activity.next_action) {
        const existing = latestNextActions.get(activity.rep_notion_page_id);
        if (!existing || parseISO(activity.created_at) > parseISO(existing.created_at)) {
          latestNextActions.set(activity.rep_notion_page_id, activity);
        }
      }
    });

    // Group by date - use filteredRecruits to exclude hidden stages
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

  // Get upcoming tasks for when today has nothing scheduled
  const upcomingTasks = useMemo(() => {
    const today = startOfToday();
    const upcoming: { recruit: Recruit; activity: RecruitActivity; daysAway: number; label: string }[] = [];
    
    scheduledTasks.forEach((tasks, dateStr) => {
      const date = parseISO(dateStr);
      if (isBefore(date, today) || isSameDay(date, today)) return; // Skip past and today
      
      const daysAway = differenceInDays(date, today);
      if (daysAway > 7) return; // Only show next 7 days
      
      let label = '';
      if (isTomorrow(date)) {
        label = 'Tomorrow';
      } else if (isThisWeek(date, { weekStartsOn: 0 })) {
        label = format(date, 'EEEE'); // Day name
      } else {
        label = `In ${daysAway} days`;
      }
      
      tasks.forEach(({ recruit, activity }) => {
        upcoming.push({ recruit, activity, daysAway, label });
      });
    });
    
    // Sort by days away and take first 3
    return upcoming.sort((a, b) => a.daysAway - b.daysAway).slice(0, 3);
  }, [scheduledTasks]);

  const handleRecruitClick = (recruit: Recruit) => {
    setSelectedRecruit(recruit);
    setDrawerOpen(true);
  };

  const getActivitiesForRecruit = (recruit: Recruit) => 
    activities.filter(a => a.rep_notion_page_id === recruit.notionPageId);

  return (
    <div className="space-y-4">
      {/* Hero Summary Card */}
      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background rounded-xl p-4 border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">{weekLabel}</h3>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePrevWeek}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleToday}>
              Today
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNextWeek}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          {format(selectedWeekStart, 'MMM d')} - {format(endOfWeek(selectedWeekStart, { weekStartsOn: 0 }), 'MMM d, yyyy')}
        </p>
        <div className="flex flex-wrap gap-2">
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
      </div>

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
                "text-center p-1 rounded-lg",
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

      {/* Day Tasks */}
      <div className="space-y-4">
        {weekDays.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayTasks = scheduledTasks.get(dateKey) || [];
          const isToday = isDateToday(day);

          if (dayTasks.length === 0 && !isToday) return null;

          return (
            <div key={dateKey}>
              <div className="flex items-center gap-2 mb-2">
                <h4 className={cn(
                  "text-sm font-medium",
                  isToday && "text-primary"
                )}>
                  {isToday ? 'Today' : format(day, 'EEEE, MMM d')}
                </h4>
                {dayTasks.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {dayTasks.length}
                  </Badge>
                )}
              </div>
              {dayTasks.length === 0 ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Nothing scheduled
                  </p>
                  {/* Show upcoming tasks when today has nothing */}
                  {isToday && upcomingTasks.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs text-muted-foreground font-medium">Coming up:</p>
                      {upcomingTasks.map(({ recruit, activity, label }) => (
                        <div 
                          key={`upcoming-${recruit.notionPageId}-${activity.id}`}
                          className="flex items-center justify-between bg-muted/50 rounded-lg p-2 cursor-pointer hover:bg-muted transition-colors"
                          onClick={() => handleRecruitClick(recruit)}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="text-xs font-medium text-primary whitespace-nowrap">{label}</div>
                            <span className="text-sm truncate">{getFirstName(recruit.name)}</span>
                          </div>
                          <Badge variant="secondary" className="text-xs shrink-0 ml-2">
                            {recruit.stage}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {dayTasks.map(({ recruit, activity }) => (
                    <PlannerTaskCard
                      key={`${recruit.notionPageId}-${activity.id}`}
                      recruit={recruit}
                      activity={activity}
                      onClick={() => handleRecruitClick(recruit)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Recommendations Section */}
      <div className="pt-4 border-t">
        <RecommendationsSection 
          recommendations={recommendations}
          onRecruitClick={handleRecruitClick}
        />
      </div>

      {/* Recruit Detail Drawer */}
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
    </div>
  );
};
