import { useState } from "react";
import { Heart, MessageCircle, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  useActivityReactions, 
  useToggleReaction, 
  useActivityComments, 
  useAddComment,
  useDeleteComment,
  useActivityCommentCounts,
  ActivityComment
} from "@/hooks/useActivitySocial";
import { useCurrentUserId } from "@/hooks/useCurrentUserId";
import { getInitials } from "@/utils/nameUtils";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { MentionInput, MentionText } from "./MentionInput";

interface ReactionButtonProps {
  activityId: string;
  reactions: Record<string, any[]>;
  loggedByUserId?: string; // Add to check if user is reacting to own activity
}

export const ReactionButton = ({ activityId, reactions, loggedByUserId }: ReactionButtonProps) => {
  const { userId } = useCurrentUserId();
  const toggleReaction = useToggleReaction();
  
  const activityReactions = reactions[activityId] || [];
  const likeCount = activityReactions.filter(r => r.reaction_type === 'like').length;
  const hasUserLiked = activityReactions.some(r => r.user_id === userId && r.reaction_type === 'like');
  
  // Don't allow users to like their own activities
  const isOwnActivity = loggedByUserId === userId;
  
  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOwnActivity) return; // Prevent liking own activity
    toggleReaction.mutate({ activityId, reactionType: 'like' });
  };
  
  // If own activity, show just the count (not clickable for liking)
  if (isOwnActivity) {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Heart className={cn("h-3.5 w-3.5", likeCount > 0 && "fill-red-500 text-red-500")} />
        {likeCount > 0 && <span>{likeCount}</span>}
      </div>
    );
  }
  
  return (
    <button
      onClick={handleToggle}
      className={cn(
        "flex items-center gap-1 text-xs transition-colors",
        hasUserLiked 
          ? "text-red-500" 
          : "text-muted-foreground hover:text-red-500"
      )}
    >
      <Heart className={cn("h-3.5 w-3.5", hasUserLiked && "fill-current")} />
      {likeCount > 0 && <span>{likeCount}</span>}
    </button>
  );
};

interface CommentCountProps {
  activityId: string;
  commentCounts: Record<string, number>;
}

export const CommentCount = ({ activityId, commentCounts }: CommentCountProps) => {
  const count = commentCounts[activityId] || 0;
  
  if (count === 0) return null;
  
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <MessageCircle className="h-3.5 w-3.5" />
      <span>{count}</span>
    </div>
  );
};

interface ActivitySocialBarProps {
  activityId: string;
  reactions: Record<string, any[]>;
  commentCounts: Record<string, number>;
  loggedByUserId?: string; // Add to pass through to ReactionButton
  isSubstantive?: boolean; // For highlighting substantive notes
}

export const ActivitySocialBar = ({ 
  activityId, 
  reactions, 
  commentCounts,
  loggedByUserId,
  isSubstantive 
}: ActivitySocialBarProps) => {
  return (
    <div className={cn(
      "flex items-center gap-3 mt-2 pt-1.5 border-t border-border/30",
      isSubstantive && "border-t-amber-500/40"
    )}>
      <ReactionButton activityId={activityId} reactions={reactions} loggedByUserId={loggedByUserId} />
      <CommentCount activityId={activityId} commentCounts={commentCounts} />
    </div>
  );
};

interface CommentsListProps {
  activityId: string;
}

export const CommentsList = ({ activityId }: CommentsListProps) => {
  const { data: comments = [], isLoading } = useActivityComments(activityId);
  const { userId } = useCurrentUserId();
  const deleteComment = useDeleteComment();
  
  if (isLoading) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">
        Loading comments...
      </div>
    );
  }
  
  if (comments.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">
        No comments yet
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      {comments.map((comment) => (
        <div key={comment.id} className="flex gap-2">
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarImage src={comment.user_photo || undefined} alt={comment.user_name} />
            <AvatarFallback className="text-[10px] bg-muted">
              {getInitials(comment.user_name || '')}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">
                {comment.user_name?.split(' ')[0]}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {format(parseISO(comment.created_at), 'MMM d, h:mm a')}
              </span>
              {comment.user_id === userId && (
                <button
                  onClick={() => deleteComment.mutate(comment.id)}
                  className="ml-auto text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
            <p className="text-sm text-foreground mt-0.5">
              <MentionText text={comment.content} />
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

interface CommentInputProps {
  activityId: string;
  onCommentAdded?: () => void;
  commenterName?: string;
  recruitName?: string;
  recruitId?: string;
}

export const CommentInput = ({ activityId, onCommentAdded, commenterName, recruitName, recruitId }: CommentInputProps) => {
  const [content, setContent] = useState('');
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const addComment = useAddComment();
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    
    addComment.mutate(
      { 
        activityId, 
        content: content.trim(),
        mentionedUserIds,
        commenterName,
        recruitName,
        recruitId,
      },
      {
        onSuccess: () => {
          setContent('');
          setMentionedUserIds([]);
          onCommentAdded?.();
        },
      }
    );
  };
  
  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-center">
      <MentionInput
        value={content}
        onChange={setContent}
        onMentionsChange={setMentionedUserIds}
        placeholder="Add a comment... (use @ to mention)"
        className="h-9 text-sm"
        autoFocus
        recruitId={recruitId}
      />
      <Button
        type="submit"
        size="sm"
        disabled={!content.trim() || addComment.isPending}
        className="h-9 px-3 shrink-0"
      >
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
};

interface UnreadBadgeProps {
  count: number;
}

export const UnreadBadge = ({ count }: UnreadBadgeProps) => {
  if (count === 0) return null;
  
  return (
    <Badge 
      variant="destructive" 
      className="h-5 min-w-5 px-1.5 text-[10px] font-medium"
    >
      {count > 9 ? '9+' : count}
    </Badge>
  );
};

interface NewActivityIndicatorProps {
  isNew: boolean;
}

export const NewActivityIndicator = ({ isNew }: NewActivityIndicatorProps) => {
  if (!isNew) return null;
  
  return (
    <Badge 
      variant="secondary" 
      className="bg-blue-500/20 text-blue-600 text-[10px] px-1.5 py-0"
    >
      New
    </Badge>
  );
};
