import { useState, useEffect } from "react";
import { format, parseISO, isToday, isYesterday, isThisWeek, isFuture, isTomorrow, isPast } from "date-fns";
import { 
  Phone, 
  MessageSquare, 
  Users, 
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle2,
  Plus,
  PhoneCall,
  PhoneMissed,
  UserCircle,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RecruitActivity } from "@/hooks/useGroupRecruits";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getInitials } from "@/utils/nameUtils";
import { 
  useActivityReactions, 
  useActivityCommentCounts, 
  useUnreadActivityCount,
  useMarkActivitiesRead,
  useActivitySocialRealtime
} from "@/hooks/useActivitySocial";
import { 
  ActivitySocialBar, 
  NewActivityIndicator 
} from "../ActivitySocialFeatures";
import { ActivityCommentsDrawer } from "../ActivityCommentsDrawer";
import { useCurrentUserId } from "@/hooks/useCurrentUserId";

interface ActivityTabProps {
  recruitId: string;
  activities: RecruitActivity[];
  onLogActivity: () => void;
  onScheduleFollowUp: () => void;
  onActivityClick: (activity: RecruitActivity) => void;
}

interface LoggerInfo {
  name: string;
  profilePhotoUrl: string | null;
}

export const ActivityTab = ({
  recruitId,
  activities,
  onLogActivity,
  onScheduleFollowUp,
  onActivityClick
}: ActivityTabProps) => {
  
  // Get current user ID to compare with assigned_to_user_id
  const { userId: currentUserId } = useCurrentUserId();
  
  // State for comments drawer
  const [selectedActivityForComments, setSelectedActivityForComments] = useState<RecruitActivity | null>(null);
  const [isCommentsDrawerOpen, setIsCommentsDrawerOpen] = useState(false);
  
  // Get activity IDs for social features
  const activityIds = activities.map(a => a.id);
  
  // Social features hooks
  const { data: reactions = {} } = useActivityReactions(activityIds);
  const { data: commentCounts = {} } = useActivityCommentCounts(activityIds);
  const markAsRead = useMarkActivitiesRead();
  
  // Detect unread count
  const unreadCount = useUnreadActivityCount(recruitId, activities);
  
  // Real-time subscriptions for reactions/comments - called as a proper hook
  useActivitySocialRealtime(activityIds);
  
  // Handle activity tap - open comments drawer
  const handleActivityTap = (activity: RecruitActivity) => {
    setSelectedActivityForComments(activity);
    setIsCommentsDrawerOpen(true);
  };
  
  // Check if activity has substantive notes (50+ chars)
  const isSubstantiveNote = (notes: string | null | undefined): boolean => {
    if (!notes) return false;
    return notes.length >= 50;
  };
  
  // Mark as read when tab opens
  useEffect(() => {
    if (recruitId && activities.length > 0) {
      markAsRead.mutate(recruitId);
    }
  }, [recruitId, activities.length]);
  
  // Get read status for "new" indicators
  const { data: readStatus } = useQuery({
    queryKey: ['activity-read-status', recruitId, currentUserId],
    queryFn: async () => {
      if (!recruitId || !currentUserId) return null;
      const { data } = await supabase
        .from('recruit_activity_read_status')
        .select('last_seen_at')
        .eq('recruit_id', recruitId)
        .eq('user_id', currentUserId)
        .maybeSingle();
      return data;
    },
    enabled: !!recruitId && !!currentUserId,
  });
  
  const lastSeenAt = readStatus?.last_seen_at 
    ? new Date(readStatus.last_seen_at) 
    : new Date(0);
  
  // Check if an activity is "new" (created by someone else after last seen)
  const isNewActivity = (activity: RecruitActivity) => {
    return activity.logged_by_user_id !== currentUserId && 
      new Date(activity.created_at) > lastSeenAt;
  };

  // Get assignee names for activities assigned to others
  const assignedUserIds = [...new Set(
    activities
      .filter(a => a.assigned_to_user_id && a.assigned_to_user_id !== currentUserId)
      .map(a => a.assigned_to_user_id!)
  )];
  
  // Get all logged_by_user_ids to fetch their names and photos
  const loggedByUserIds = [...new Set(
    activities
      .filter(a => a.logged_by_user_id && a.logged_by_user_id !== 'optimistic')
      .map(a => a.logged_by_user_id)
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

  // Fetch logger info (name and profile photo) for all logged_by_user_ids
  const { data: loggerInfo = {} } = useQuery({
    queryKey: ['activity-logger-info', loggedByUserIds],
    queryFn: async () => {
      if (loggedByUserIds.length === 0) return {};
      const { data } = await supabase
        .from('reps')
        .select('user_id, name, profile_photo_url')
        .in('user_id', loggedByUserIds);
      
      const infoMap: Record<string, LoggerInfo> = {};
      data?.forEach(rep => {
        infoMap[rep.user_id] = {
          name: stripEmojis(rep.name),
          profilePhotoUrl: rep.profile_photo_url,
        };
      });
      return infoMap;
    },
    enabled: loggedByUserIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
  
  const isTextActivity = (type: string, notes?: string | null): boolean => {
    if (type !== 'phone_call') return false;
    const notesLower = notes?.toLowerCase() || '';
    return notesLower.includes('text') || notesLower.startsWith('texted');
  };

  const getActivityIcon = (type: string, notes?: string | null, isCompleted?: boolean, isOverdue?: boolean) => {
    // For completed scheduled activities, show a green checkmark
    if (type === 'next_step' && isCompleted) {
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    }
    
    // For overdue scheduled activities, show alert icon
    if (type === 'next_step' && isOverdue) {
      return <AlertCircle className="h-4 w-4 text-destructive" />;
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

  // Sort dates: strict future dates first (ascending), then today, then past dates (descending)
  const sortedDates = Object.keys(groupedActivities).sort((a, b) => {
    const dateA = parseISO(a);
    const dateB = parseISO(b);
    const aIsToday = isToday(dateA);
    const bIsToday = isToday(dateB);
    const aIsFuture = isFuture(dateA) && !aIsToday;
    const bIsFuture = isFuture(dateB) && !bIsToday;
    
    // Strict future dates come first (ascending - soonest first)
    if (aIsFuture && bIsFuture) {
      return dateA.getTime() - dateB.getTime();
    }
    if (aIsFuture && !bIsFuture) return -1;
    if (!aIsFuture && bIsFuture) return 1;
    
    // Today comes after future but before past
    if (aIsToday && !bIsToday) return -1;
    if (!aIsToday && bIsToday) return 1;
    
    // Both past: descending (most recent first)
    return dateB.getTime() - dateA.getTime();
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
                    
                    // Get logger info for this activity
                    const logger = activity.logged_by_user_id && activity.logged_by_user_id !== 'optimistic'
                      ? loggerInfo[activity.logged_by_user_id]
                      : null;
                    
                    // Determine if next_action is different from notes (avoid duplicate display)
                    const hasUniqueNextAction = activity.next_action && 
                      activity.next_action !== activity.notes &&
                      !activity.notes?.includes(activity.next_action);
                    
                    // For scheduled activities, prefer showing notes (the actual content) over generic next_action
                    const isScheduledActivity = activity.activity_type === 'next_step';
                    const mainText = isScheduledActivity 
                      ? (activity.notes || activity.next_action)
                      : activity.notes;
                    
                    // Check if scheduled activity is completed or overdue
                    const isCompleted = activity.assignment_status === 'completed' || !!activity.completed_at;
                    const isScheduledCompleted = isScheduledActivity && isCompleted;
                    const isScheduledPending = isScheduledActivity && !isCompleted;
                    const isOverdue = isScheduledPending && activity.next_action_due && 
                      isPast(parseISO(activity.next_action_due)) && !isToday(parseISO(activity.next_action_due));
                    
                    // Check if this is a substantive note (50+ chars)
                    const hasSubstantiveNote = isSubstantiveNote(activity.notes);
                    
                    return (
                      <button
                        key={activity.id}
                        className={`w-full text-left p-3 rounded-lg transition-colors ${
                          isScheduledCompleted 
                            ? 'bg-green-500/5 hover:bg-green-500/10 border border-green-500/20'
                            : isOverdue
                            ? 'bg-destructive/5 hover:bg-destructive/10 border border-destructive/20'
                            : isScheduledPending
                            ? 'bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/20'
                            : hasSubstantiveNote
                            ? 'bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/30'
                            : 'bg-muted/50 hover:bg-muted'
                        }`}
                        onClick={() => handleActivityTap(activity)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 shrink-0">
                            {getActivityIcon(activity.activity_type, activity.notes, isCompleted, isOverdue)}
                          </div>
                          <div className="flex-1 min-w-0">
                            {/* Header row: type, time, new indicator, and logger avatar */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`text-sm font-medium capitalize shrink-0 ${
                                  isScheduledCompleted ? 'text-green-600' : isOverdue ? 'text-destructive' : isScheduledPending ? 'text-amber-600' : ''
                                }`}>
                                  {isScheduledCompleted ? 'Completed' : isOverdue ? 'Overdue' : getActivityLabel(activity.activity_type, activity.notes)}
                                </span>
                                {/* Substantive note indicator */}
                                {hasSubstantiveNote && !isScheduledActivity && (
                                  <Sparkles className="h-3 w-3 text-amber-500" />
                                )}
                                {/* New indicator for activities from other users */}
                                <NewActivityIndicator isNew={isNewActivity(activity)} />
                                {/* For non-scheduled activities, show the time */}
                                {!isScheduledActivity && (
                                  <span className="text-xs text-muted-foreground shrink-0">
                                    {format(parseISO(activity.created_at), 'h:mm a')}
                                  </span>
                                )}
                              </div>
                              
                              {/* Logger avatar on the right */}
                              {logger && (
                                <Avatar className="h-6 w-6 shrink-0">
                                  <AvatarImage src={logger.profilePhotoUrl || undefined} alt={logger.name} />
                                  <AvatarFallback className="text-[10px] bg-muted">
                                    {getInitials(logger.name)}
                                  </AvatarFallback>
                                </Avatar>
                              )}
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
                          
                          {/* Main content text - show full text, not truncated */}
                          {mainText && (
                            <p className={`text-xs mt-1 whitespace-pre-wrap ${
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
                          
                          {/* Social features - reactions and comment count */}
                          <ActivitySocialBar
                            activityId={activity.id}
                            reactions={reactions}
                            commentCounts={commentCounts}
                            loggedByUserId={activity.logged_by_user_id}
                            isSubstantive={hasSubstantiveNote}
                          />
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
      
      {/* Comments Drawer */}
      <ActivityCommentsDrawer
        activity={selectedActivityForComments}
        isOpen={isCommentsDrawerOpen}
        onClose={() => {
          setIsCommentsDrawerOpen(false);
          setSelectedActivityForComments(null);
        }}
        loggerInfo={selectedActivityForComments?.logged_by_user_id && selectedActivityForComments.logged_by_user_id !== 'optimistic'
          ? loggerInfo[selectedActivityForComments.logged_by_user_id]
          : null
        }
      />
    </div>
  );
};
