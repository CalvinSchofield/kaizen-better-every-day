import { useState } from "react";
import { format, parseISO } from "date-fns";
import { MessageCircle, X, Phone, PhoneCall, PhoneMissed, Users, MessageSquare, Calendar, CheckCircle2, AlertCircle, Pencil, Check } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { CommentsList, CommentInput, ReactionButton } from "./ActivitySocialFeatures";
import { getInitials } from "@/utils/nameUtils";
import { cn } from "@/lib/utils";
import { useCurrentUserId } from "@/hooks/useCurrentUserId";
import { useActivityReactions, useUpdateActivityNotes } from "@/hooks/useActivitySocial";

interface RecruitActivity {
  id: string;
  activity_type: string;
  notes: string | null;
  next_action: string | null;
  next_action_due: string | null;
  created_at: string;
  logged_by_user_id: string;
  assigned_to_user_id: string | null;
  assignment_status: string | null;
  completed_at: string | null;
  recruit_id?: string | null;
}

interface LoggerInfo {
  name: string;
  profilePhotoUrl: string | null;
}

interface ActivityCommentsDrawerProps {
  activity: RecruitActivity | null;
  isOpen: boolean;
  onClose: () => void;
  loggerInfo?: LoggerInfo | null;
  recruitName?: string;
  recruitId?: string;
}

export const ActivityCommentsDrawer = ({
  activity,
  isOpen,
  onClose,
  loggerInfo,
  recruitName,
  recruitId,
}: ActivityCommentsDrawerProps) => {
  const { userId: currentUserId } = useCurrentUserId();
  const { data: reactions = {} } = useActivityReactions(activity ? [activity.id] : []);
  const updateNotes = useUpdateActivityNotes();
  
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editedNotes, setEditedNotes] = useState("");
  
  if (!activity) return null;
  
  const isTextActivity = (type: string, notes?: string | null): boolean => {
    if (type !== 'phone_call') return false;
    const notesLower = notes?.toLowerCase() || '';
    return notesLower.includes('text') || notesLower.startsWith('texted');
  };

  const getActivityIcon = (type: string, notes?: string | null, isCompleted?: boolean, isOverdue?: boolean) => {
    if (type === 'next_step' && isCompleted) {
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    }
    if (type === 'next_step' && isOverdue) {
      return <AlertCircle className="h-5 w-5 text-destructive" />;
    }
    if (isTextActivity(type, notes)) {
      return <MessageSquare className="h-5 w-5 text-blue-500" />;
    }
    if (type === 'phone_call') {
      if (notes?.includes('Connected')) return <PhoneCall className="h-5 w-5 text-green-500" />;
      if (notes === 'No Answer' || notes === 'Call attempt') return <PhoneMissed className="h-5 w-5 text-muted-foreground" />;
      return <Phone className="h-5 w-5" />;
    }
    switch (type) {
      case 'in_person': return <Users className="h-5 w-5 text-purple-500" />;
      case 'note': return <MessageSquare className="h-5 w-5 text-blue-500" />;
      case 'next_step': return <Calendar className="h-5 w-5 text-amber-500" />;
      default: return <MessageSquare className="h-5 w-5" />;
    }
  };

  const getActivityLabel = (type: string, notes?: string | null): string => {
    if (isTextActivity(type, notes)) return 'Text';
    switch (type) {
      case 'phone_call': return 'Phone Call';
      case 'in_person': return 'In Person';
      case 'note': return 'Note';
      case 'next_step': return 'Scheduled';
      case 'stage_change': return 'Stage Change';
      default: return type.replace(/_/g, ' ');
    }
  };

  const isCompleted = activity.assignment_status === 'completed' || !!activity.completed_at;
  const isScheduledActivity = activity.activity_type === 'next_step';
  // For scheduled activities, prefer showing notes (the actual content) over generic next_action
  const mainText = isScheduledActivity 
    ? (activity.notes || activity.next_action)
    : activity.notes;
  
  // Check if this is the current user's own activity (for edit permission)
  const isOwnActivity = activity.logged_by_user_id === currentUserId;

  // Handle edit start
  const handleStartEdit = () => {
    setEditedNotes(activity.notes || "");
    setIsEditing(true);
  };

  // Handle save edit
  const handleSaveEdit = () => {
    updateNotes.mutate(
      { activityId: activity.id, notes: editedNotes },
      {
        onSuccess: () => {
          setIsEditing(false);
          // Update will be reflected via query invalidation
        },
      }
    );
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedNotes("");
  };

  // Get current user's name for mention notifications
  const commenterName = loggerInfo?.name?.split(' ')[0] || 'Someone';

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="flex items-center justify-between pb-2 border-b">
          <DrawerTitle className="text-base font-semibold">Activity Details</DrawerTitle>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </DrawerHeader>
        
        <ScrollArea className="flex-1 max-h-[calc(90vh-180px)]">
          <div className="p-4 space-y-4">
            {/* Activity Header */}
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0 p-2 rounded-full bg-muted">
                {getActivityIcon(activity.activity_type, activity.notes, isCompleted)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {getActivityLabel(activity.activity_type, activity.notes)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(parseISO(activity.created_at), 'MMM d, yyyy • h:mm a')}
                  </span>
                </div>
                
                {/* Logger info */}
                {loggerInfo && (
                  <div className="flex items-center gap-2 mt-1">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={loggerInfo.profilePhotoUrl || undefined} alt={loggerInfo.name} />
                      <AvatarFallback className="text-[8px] bg-muted">
                        {getInitials(loggerInfo.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground">
                      Logged by {loggerInfo.name.split(' ')[0]}
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Full Notes - With Edit Capability */}
            {isEditing ? (
              <div className="space-y-2">
                <Textarea
                  value={editedNotes}
                  onChange={(e) => setEditedNotes(e.target.value)}
                  placeholder="Edit your notes..."
                  className="min-h-[100px] text-sm"
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelEdit}
                    disabled={updateNotes.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveEdit}
                    disabled={updateNotes.isPending}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Save
                  </Button>
                </div>
              </div>
            ) : mainText ? (
              <div className="bg-muted/50 rounded-lg p-3 relative group">
                <p className="text-sm whitespace-pre-wrap pr-8">{mainText}</p>
                {/* Edit button - only for own activities */}
                {isOwnActivity && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={handleStartEdit}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ) : isOwnActivity ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleStartEdit}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Add notes
              </Button>
            ) : null}
            
            {/* Next Action if different */}
            {!isScheduledActivity && activity.next_action && activity.next_action !== activity.notes && (
              <div className="bg-amber-500/10 rounded-lg p-3 border border-amber-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="h-4 w-4 text-amber-600" />
                  <span className="text-xs font-medium text-amber-600">Next Step</span>
                </div>
                <p className="text-sm">{activity.next_action}</p>
              </div>
            )}
            
            {/* Reactions Bar - Pass loggedByUserId to prevent self-liking */}
            <div className="flex items-center gap-4 pt-2 border-t">
              <ReactionButton 
                activityId={activity.id} 
                reactions={reactions} 
                loggedByUserId={activity.logged_by_user_id} 
              />
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MessageCircle className="h-3.5 w-3.5" />
                <span>Comments</span>
              </div>
            </div>
            
            {/* Comments Section */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Comments</h4>
              <CommentsList activityId={activity.id} />
            </div>
          </div>
        </ScrollArea>
        
        {/* Comment Input - Fixed at bottom */}
        <div className="p-4 border-t bg-background">
          <CommentInput 
            activityId={activity.id} 
            commenterName={commenterName}
            recruitName={recruitName}
            recruitId={recruitId || activity.recruit_id || undefined}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
};
