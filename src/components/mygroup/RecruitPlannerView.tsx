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
  isToday as isDateToday
} from "date-fns";
import { cn } from "@/lib/utils";

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

  const recommendations = useRecruitingRecommendations(recruits, activities);

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

    // Group by date
    latestNextActions.forEach((activity, recruitId) => {
      const recruit = recruits.find(r => r.notionPageId === recruitId);
      if (!recruit) return;

      const dateKey = activity.next_action_due!;
      if (!tasksMap.has(dateKey)) {
        tasksMap.set(dateKey, []);
      }
      tasksMap.get(dateKey)!.push({ recruit, activity });
    });

    return tasksMap;
  }, [activities, recruits]);

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
          <h3 className="font-semibold">This Week</h3>
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
                <p className="text-sm text-muted-foreground">
                  Nothing scheduled
                </p>
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
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
};
