import { format, parseISO, isToday, isYesterday, isThisWeek, isFuture, isTomorrow } from "date-fns";
import { 
  Phone, 
  MessageSquare, 
  Users, 
  Calendar,
  Clock,
  CheckCircle2,
  Plus,
  PhoneCall,
  PhoneMissed,
  UserCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RecruitActivity } from "@/hooks/useGroupRecruits";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ActivityTabProps {
  activities: RecruitActivity[];
  onLogActivity: () => void;
  onScheduleFollowUp: () => void;
  onActivityClick: (activity: RecruitActivity) => void;
}

export const ActivityTab = ({
  activities,
  onLogActivity,
  onScheduleFollowUp,
  onActivityClick
}: ActivityTabProps) => {
  
  // Get current user ID to compare with assigned_to_user_id
  const { data: currentUserId } = useQuery({
    queryKey: ['current-user-id'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id || null;
    },
    staleTime: Infinity,
  });

  // Get assignee names for activities assigned to others
  const assignedUserIds = [...new Set(
    activities
      .filter(a => a.assigned_to_user_id && a.assigned_to_user_id !== currentUserId)
      .map(a => a.assigned_to_user_id!)
  )];
  
  // Strip emojis helper
  const stripEmojis = (text: string | null): string => {
    if (!text) return '';
    return text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2B50}]|[\u{1FA00}-\u{1FAFF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]/gu, '').trim();
  };
  
  const { data: assigneeNames = {} } = useQuery({
    queryKey: ['activity-assignee-names', assignedUserIds],
    queryFn: async () => {
      if (assignedUserIds.length === 0) return {};
      const { data } = await supabase
        .from('reps')
        .select('user_id, name')
        .in('user_id', assignedUserIds);
      
      const nameMap: Record<string, string> = {};
      data?.forEach(rep => {
        // Strip emojis and get first name only
        const cleanName = stripEmojis(rep.name);
        nameMap[rep.user_id] = cleanName.split(' ')[0];
      });
      return nameMap;
    },
    enabled: assignedUserIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
  
  const isTextActivity = (type: string, notes?: string | null): boolean => {
    if (type !== 'phone_call') return false;
    const notesLower = notes?.toLowerCase() || '';
    return notesLower.includes('text') || notesLower.startsWith('texted');
  };

  const getActivityIcon = (type: string, notes?: string | null, isCompleted?: boolean) => {
    // For completed scheduled activities, show a green checkmark
    if (type === 'next_step' && isCompleted) {
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    }
    
    if (isTextActivity(type, notes)) {
      return <MessageSquare className="h-4 w-4 text-blue-500" />;
    }
    
    if (type === 'phone_call') {
      if (notes?.includes('Connected')) return <PhoneCall className="h-4 w-4 text-green-500" />;
      if (notes === 'No Answer' || notes === 'Call attempt') return <PhoneMissed className="h-4 w-4 text-muted-foreground" />;
      return <Phone className="h-4 w-4" />;
    }
    switch (type) {
      case 'in_person': return <Users className="h-4 w-4 text-purple-500" />;
      case 'note': return <MessageSquare className="h-4 w-4 text-blue-500" />;
      case 'next_step': return <Calendar className="h-4 w-4 text-amber-500" />;
      case 'stage_change': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getActivityLabel = (type: string, notes?: string | null): string => {
    if (isTextActivity(type, notes)) return 'Text';
    if (type === 'next_step') return 'Follow-up';
    return type.replace('_', ' ');
  };

  // Format date with support for future dates
  const formatActivityDate = (dateString: string, isFutureSection: boolean = false) => {
    const date = parseISO(dateString);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    if (isTomorrow(date)) return 'Tomorrow';
    if (isThisWeek(date)) return format(date, 'EEEE');
    return format(date, 'MMM d');
  };

  // Get the relevant date for an activity (due date for scheduled, created for others)
  const getActivityDateKey = (activity: RecruitActivity): string => {
    const isScheduled = activity.activity_type === 'next_step';
    const isCompleted = activity.assignment_status === 'completed' || !!activity.completed_at;
    
    // For pending scheduled activities with a due date, use the due date
    if (isScheduled && activity.next_action_due && !isCompleted) {
      return activity.next_action_due;
    }
    // For everything else (including completed scheduled), use created_at
    return format(parseISO(activity.created_at), 'yyyy-MM-dd');
  };

  // Group activities by their relevant date
  const groupedActivities = activities.reduce((groups, activity) => {
    const dateKey = getActivityDateKey(activity);
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(activity);
    return groups;
  }, {} as Record<string, RecruitActivity[]>);

  // Sort dates: future dates first (ascending), then past dates (descending)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const sortedDates = Object.keys(groupedActivities).sort((a, b) => {
    const dateA = parseISO(a);
    const dateB = parseISO(b);
    const aIsFuture = isFuture(dateA) || isToday(dateA);
    const bIsFuture = isFuture(dateB) || isToday(dateB);
    
    // Both future: ascending (soonest first)
    if (aIsFuture && bIsFuture) {
      return dateA.getTime() - dateB.getTime();
    }
    // Both past: descending (most recent first)
    if (!aIsFuture && !bIsFuture) {
      return dateB.getTime() - dateA.getTime();
    }
    // Future comes before past
    return aIsFuture ? -1 : 1;
  });

  return (
    <div className="space-y-4">
      {/* Quick Actions */}
      <div className="flex gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          className="flex-1"
          onClick={onLogActivity}
        >
          <Plus className="h-4 w-4 mr-1" />
          Log Activity
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="flex-1"
          onClick={onScheduleFollowUp}
        >
          <Calendar className="h-4 w-4 mr-1" />
          Schedule
        </Button>
      </div>
      
      {/* Activity Timeline */}
      {activities.length === 0 ? (
        <div className="text-center py-8">
          <Clock className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">No activity logged yet</p>
          <Button 
            variant="link" 
            size="sm" 
            className="mt-1"
            onClick={onLogActivity}
          >
            Log your first activity
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedDates.map((dateKey) => {
            const dateForHeader = parseISO(dateKey);
            const isFutureDate = isFuture(dateForHeader) && !isToday(dateForHeader);
            
            return (
              <div key={dateKey}>
                {/* Date Header */}
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-medium ${
                    isFutureDate ? 'text-amber-600' : 'text-muted-foreground'
                  }`}>
                    {formatActivityDate(dateKey)}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                
                {/* Activities for this date */}
                <div className="space-y-2">
                  {groupedActivities[dateKey].map((activity) => {
                    const isAssignedToOther = activity.assigned_to_user_id && 
                      activity.assigned_to_user_id !== currentUserId;
                    const assigneeName = isAssignedToOther 
                      ? assigneeNames[activity.assigned_to_user_id!] 
                      : null;
                    
                    // Determine if next_action is different from notes (avoid duplicate display)
                    const hasUniqueNextAction = activity.next_action && 
                      activity.next_action !== activity.notes &&
                      !activity.notes?.includes(activity.next_action);
                    
                    // For scheduled activities, prefer showing next_action as the main text
                    const isScheduledActivity = activity.activity_type === 'next_step';
                    const mainText = isScheduledActivity 
                      ? (activity.next_action || activity.notes)
                      : activity.notes;
                    
                    // Check if scheduled activity is completed
                    const isCompleted = activity.assignment_status === 'completed' || !!activity.completed_at;
                    const isScheduledCompleted = isScheduledActivity && isCompleted;
                    const isScheduledPending = isScheduledActivity && !isCompleted;
                    
                    return (
                      <button
                        key={activity.id}
                        className={`w-full text-left p-3 rounded-lg transition-colors ${
                          isScheduledCompleted 
                            ? 'bg-green-500/5 hover:bg-green-500/10 border border-green-500/20'
                            : isScheduledPending
                            ? 'bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/20'
                            : 'bg-muted/50 hover:bg-muted'
                        }`}
                        onClick={() => onActivityClick(activity)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 shrink-0">
                            {getActivityIcon(activity.activity_type, activity.notes, isCompleted)}
                          </div>
                          <div className="flex-1 min-w-0">
                            {/* Header row: type, time */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`text-sm font-medium capitalize shrink-0 ${
                                  isScheduledCompleted ? 'text-green-600' : isScheduledPending ? 'text-amber-600' : ''
                                }`}>
                                  {isScheduledCompleted ? 'Completed' : getActivityLabel(activity.activity_type, activity.notes)}
                                </span>
                                {/* For non-scheduled activities, show the time */}
                                {!isScheduledActivity && (
                                  <span className="text-xs text-muted-foreground shrink-0">
                                    {format(parseISO(activity.created_at), 'h:mm a')}
                                  </span>
                                )}
                              </div>
                            </div>
                          
                          {/* Assignee badge on its own line if present */}
                          {isAssignedToOther && assigneeName && (
                            <div className="mt-1">
                              <Badge variant="outline" className="text-[10px] gap-1 bg-indigo-500/10 text-indigo-600 border-indigo-500/30">
                                <UserCircle className="h-3 w-3" />
                                {assigneeName}
                              </Badge>
                            </div>
                          )}
                          
                          {/* Main content text - one line only */}
                          {mainText && (
                            <p className={`text-xs mt-1 line-clamp-1 ${
                              isScheduledCompleted ? 'text-muted-foreground/70 line-through' : 'text-muted-foreground'
                            }`}>
                              {mainText}
                            </p>
                          )}
                          
                          {/* Show "Next:" badge only if it's a non-scheduled activity with unique next action */}
                          {!isScheduledActivity && hasUniqueNextAction && (
                            <div className="mt-1.5 flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] max-w-full">
                                <span className="truncate">Next: {activity.next_action}</span>
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
