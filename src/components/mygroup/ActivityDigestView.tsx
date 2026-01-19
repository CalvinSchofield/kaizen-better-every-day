import { useState, useMemo } from "react";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { 
  Bell, 
  Phone, 
  PhoneCall, 
  PhoneMissed, 
  Users, 
  MessageSquare, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles,
  CheckCheck,
  Inbox
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getInitials } from "@/utils/nameUtils";
import { useAllUnreadActivities, useMarkAllActivitiesRead } from "@/hooks/useActivitySocial";
import { useActivityReactions, useActivityCommentCounts } from "@/hooks/useActivitySocial";
import { hapticMedium } from "@/utils/haptics";
import { RecruitActivity } from "@/hooks/useGroupRecruits";

interface ActivityDigestViewProps {
  recruitIds: string[];
  onActivityTap: (recruitId: string, activityId: string) => void;
}

export const ActivityDigestView = ({
  recruitIds,
  onActivityTap,
}: ActivityDigestViewProps) => {
  const { data: unreadActivities, isLoading, refetch } = useAllUnreadActivities(recruitIds);
  const markAllRead = useMarkAllActivitiesRead();
  
  // Get activity IDs for reactions/comments
  const activityIds = useMemo(() => 
    unreadActivities?.map(a => a.id) || [], 
    [unreadActivities]
  );
  
  const { data: reactions = {} } = useActivityReactions(activityIds);
  const { data: commentCounts = {} } = useActivityCommentCounts(activityIds);
  
  // Group activities by recruit
  const groupedActivities = useMemo(() => {
    if (!unreadActivities) return {};
    
    const grouped: Record<string, typeof unreadActivities> = {};
    unreadActivities.forEach(activity => {
      const recruitId = activity.recruit_id;
      if (!grouped[recruitId]) {
        grouped[recruitId] = [];
      }
      grouped[recruitId].push(activity);
    });
    
    return grouped;
  }, [unreadActivities]);
  
  const recruitNames = useMemo(() => {
    const names: Record<string, string> = {};
    unreadActivities?.forEach(a => {
      if (a.recruit_name && a.recruit_id) {
        names[a.recruit_id] = a.recruit_name;
      }
    });
    return names;
  }, [unreadActivities]);
  
  const handleMarkAllRead = () => {
    hapticMedium();
    const uniqueRecruitIds = Object.keys(groupedActivities);
    markAllRead.mutate(uniqueRecruitIds, {
      onSuccess: () => {
        refetch();
      }
    });
  };
  
  const isTextActivity = (type: string, notes?: string | null): boolean => {
    if (type !== 'phone_call') return false;
    const notesLower = notes?.toLowerCase() || '';
    return notesLower.includes('text') || notesLower.startsWith('texted');
  };

  const getActivityIcon = (type: string, notes?: string | null, isCompleted?: boolean, isOverdue?: boolean) => {
    if (type === 'next_step' && isCompleted) {
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    }
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
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getActivityLabel = (type: string, notes?: string | null): string => {
    if (isTextActivity(type, notes)) return 'Text';
    switch (type) {
      case 'phone_call': return 'Call';
      case 'in_person': return 'In Person';
      case 'note': return 'Note';
      case 'next_step': return 'Scheduled';
      case 'stage_change': return 'Stage';
      default: return type.replace(/_/g, ' ');
    }
  };
  
  const isSubstantiveNote = (notes: string | null | undefined): boolean => {
    return (notes?.length || 0) >= 50;
  };
  
  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ))}
      </div>
    );
  }
  
  const totalUnread = unreadActivities?.length || 0;
  const recruitCount = Object.keys(groupedActivities).length;
  
  if (totalUnread === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
          <Inbox className="h-8 w-8 text-green-500" />
        </div>
        <h3 className="font-semibold text-lg mb-1">All caught up!</h3>
        <p className="text-sm text-muted-foreground max-w-[240px]">
          You've seen all the latest activity from your recruits.
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Header with mark all read */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">
            {totalUnread} update{totalUnread !== 1 ? 's' : ''} from {recruitCount} recruit{recruitCount !== 1 ? 's' : ''}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-7"
          onClick={handleMarkAllRead}
          disabled={markAllRead.isPending}
        >
          <CheckCheck className="h-3.5 w-3.5 mr-1" />
          Mark all read
        </Button>
      </div>
      
      {/* Grouped activities */}
      <ScrollArea className="h-[calc(90vh-200px)]">
        <div className="space-y-4 pr-2">
          {Object.entries(groupedActivities).map(([recruitId, activities]) => (
            <div key={recruitId} className="space-y-2">
              {/* Recruit header */}
              <div className="flex items-center gap-2 sticky top-0 bg-background/95 backdrop-blur py-1 z-10">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                    {getInitials(recruitNames[recruitId] || 'Unknown')}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-sm">
                  {recruitNames[recruitId] || 'Unknown Recruit'}
                </span>
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                  {activities.length}
                </Badge>
              </div>
              
              {/* Activity cards for this recruit */}
              <div className="space-y-2 pl-2">
                {activities.map((activity) => {
                  const isSubstantive = isSubstantiveNote(activity.notes);
                  const isScheduledActivity = activity.activity_type === 'next_step';
                  // For scheduled activities, prefer showing notes (the actual content) over generic next_action
                  const mainText = isScheduledActivity 
                    ? (activity.notes || activity.next_action)
                    : activity.notes;
                  const likeCount = (reactions[activity.id] || []).length;
                  const commentCount = commentCounts[activity.id] || 0;
                  
                  return (
                    <div
                      key={activity.id}
                      onClick={() => {
                        hapticMedium();
                        onActivityTap(recruitId, activity.id);
                      }}
                      className={cn(
                        "p-3 rounded-lg border cursor-pointer transition-all active:scale-[0.98]",
                        isSubstantive 
                          ? "bg-amber-500/5 hover:bg-amber-500/10 border-amber-500/30" 
                          : "bg-muted/30 hover:bg-muted/50 border-border/50"
                      )}
                    >
                      {/* Activity header row */}
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {getActivityIcon(activity.activity_type, activity.notes)}
                          <span className="text-xs font-medium">
                            {getActivityLabel(activity.activity_type, activity.notes)}
                          </span>
                          {isSubstantive && (
                            <Sparkles className="h-3 w-3 text-amber-500" />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Logger avatar */}
                          {activity.logger_name && (
                            <div className="flex items-center gap-1">
                              <Avatar className="h-4 w-4">
                                <AvatarImage src={activity.logger_photo || undefined} />
                                <AvatarFallback className="text-[8px] bg-muted">
                                  {getInitials(activity.logger_name)}
                                </AvatarFallback>
                              </Avatar>
                            </div>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(parseISO(activity.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                      
                      {/* Notes preview */}
                      {mainText && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                          {mainText}
                        </p>
                      )}
                      
                      {/* Social indicators */}
                      {(likeCount > 0 || commentCount > 0) && (
                        <div className="flex items-center gap-3 mt-2 pt-1.5 border-t border-border/30">
                          {likeCount > 0 && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              ♥ {likeCount}
                            </span>
                          )}
                          {commentCount > 0 && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              💬 {commentCount}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
