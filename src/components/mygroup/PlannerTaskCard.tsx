import { Phone, MessageSquare, CheckCircle2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Recruit, RecruitActivity, useLogRecruitActivity } from "@/hooks/useGroupRecruits";
import { format, parseISO, isPast, isToday } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Helper to strip emojis from names
const stripEmojis = (text: string | null): string | null => {
  if (!text) return null;
  return text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2B50}]|[\u{1FA00}-\u{1FAFF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]/gu, '').trim();
};

interface PlannerTaskCardProps {
  recruit: Recruit;
  activity: RecruitActivity;
  onClick: () => void;
}

export const PlannerTaskCard = ({ recruit, activity, onClick }: PlannerTaskCardProps) => {
  const logActivityMutation = useLogRecruitActivity();
  
  const isOverdue = activity.next_action_due && isPast(parseISO(activity.next_action_due)) && !isToday(parseISO(activity.next_action_due));

  const handleCall = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await logActivityMutation.mutateAsync({
        recruitNotionId: recruit.notionPageId,
        activityType: 'phone_call',
        notes: 'Call attempt',
        updateLastContact: true,
      });
      toast.success('Call logged');
    } catch (error) {
      console.error('Failed to log call:', error);
    }
    window.location.href = `tel:${recruit.phone}`;
  };

  const handleText = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await logActivityMutation.mutateAsync({
        recruitNotionId: recruit.notionPageId,
        activityType: 'phone_call',
        notes: 'Text sent',
        updateLastContact: true,
      });
      toast.success('Text logged');
    } catch (error) {
      console.error('Failed to log text:', error);
    }
    window.location.href = `sms:${recruit.phone}`;
  };

  return (
    <div 
      className={cn(
        "bg-card rounded-lg p-3 border shadow-sm cursor-pointer hover:shadow-md transition-shadow",
        isOverdue && "border-destructive/50 bg-destructive/5"
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">
              {stripEmojis(recruit.name)}
            </span>
            {isOverdue && (
              <Badge variant="destructive" className="text-xs px-1.5 py-0">
                Overdue
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {activity.next_action || 'Follow up'}
          </p>
          {activity.notes && activity.notes !== activity.next_action && (
            <p className="text-xs text-muted-foreground/70 mt-0.5 line-clamp-1 italic">
              {activity.notes}
            </p>
          )}
          <Badge variant="outline" className="text-xs mt-1.5">
            {recruit.stage}
          </Badge>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleCall}
          >
            <Phone className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleText}
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
