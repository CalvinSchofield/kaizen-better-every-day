import { format, parseISO, isToday, isYesterday, isThisWeek } from "date-fns";
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
        nameMap[rep.user_id] = rep.name.split(' ')[0]; // First name only
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

  const getActivityIcon = (type: string, notes?: string | null) => {
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
    if (type === 'next_step') return 'Scheduled';
    return type.replace('_', ' ');
  };

  const formatActivityDate = (dateString: string) => {
    const date = parseISO(dateString);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    if (isThisWeek(date)) return format(date, 'EEEE');
    return format(date, 'MMM d');
  };

  // Group activities by date
  const groupedActivities = activities.reduce((groups, activity) => {
    const dateKey = format(parseISO(activity.created_at), 'yyyy-MM-dd');
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(activity);
    return groups;
  }, {} as Record<string, RecruitActivity[]>);

  const sortedDates = Object.keys(groupedActivities).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  );

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
          {sortedDates.map((dateKey) => (
            <div key={dateKey}>
              {/* Date Header */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {formatActivityDate(groupedActivities[dateKey][0].created_at)}
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
                  
                  return (
                    <button
                      key={activity.id}
                      className="w-full text-left p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      onClick={() => onActivityClick(activity)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          {getActivityIcon(activity.activity_type, activity.notes)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium capitalize">
                              {getActivityLabel(activity.activity_type, activity.notes)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(parseISO(activity.created_at), 'h:mm a')}
                            </span>
                            {/* Show assignee badge if assigned to someone else */}
                            {isAssignedToOther && assigneeName && (
                              <Badge variant="outline" className="text-[10px] gap-1 bg-indigo-500/10 text-indigo-600 border-indigo-500/30">
                                <UserCircle className="h-3 w-3" />
                                {assigneeName}
                              </Badge>
                            )}
                          </div>
                          {activity.notes && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {activity.notes}
                            </p>
                          )}
                          {activity.next_action && (
                            <div className="mt-1.5 flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px]">
                                Next: {activity.next_action}
                              </Badge>
                              {activity.next_action_due && (
                                <span className="text-[10px] text-muted-foreground">
                                  Due {format(parseISO(activity.next_action_due), 'MMM d')}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
