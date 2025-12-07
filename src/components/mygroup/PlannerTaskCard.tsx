import { useState } from "react";
import { Phone, MessageSquare, CalendarDays, CheckCircle2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
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

  const handleReschedule = async (date: Date | undefined) => {
    if (!date) return;
    
    const dateStr = format(date, 'yyyy-MM-dd');
    
    try {
      await logActivityMutation.mutateAsync({
        recruitNotionId: recruit.notionPageId,
        activityType: 'next_step',
        nextAction: activity.next_action || 'Follow up',
        nextActionDue: dateStr,
      });
      toast.success(`Rescheduled to ${format(date, 'MMM d')}`);
      setRescheduleOpen(false);
    } catch (error) {
      console.error('Failed to reschedule:', error);
      toast.error('Failed to reschedule');
    }
  };

  const handleMarkComplete = async (type: 'phone_call' | 'in_person') => {
    try {
      await logActivityMutation.mutateAsync({
        recruitNotionId: recruit.notionPageId,
        activityType: type,
        notes: `Completed: ${activity.next_action || 'Follow up'}`,
        updateLastContact: true,
      });
      toast.success('Marked complete');
      setCompleteOpen(false);
    } catch (error) {
      console.error('Failed to mark complete:', error);
      toast.error('Failed to mark complete');
    }
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
          <Badge variant="outline" className="text-xs mt-1.5">
            {recruit.stage}
          </Badge>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <Popover open={completeOpen} onOpenChange={setCompleteOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-emerald-600"
                onClick={(e) => e.stopPropagation()}
              >
                <CheckCircle2 className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent 
              className="w-auto p-2" 
              align="end"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-xs text-muted-foreground mb-2">Mark as completed via:</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => handleMarkComplete('phone_call')}
                  disabled={logActivityMutation.isPending}
                >
                  <Phone className="h-3.5 w-3.5" />
                  Call
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => handleMarkComplete('in_person')}
                  disabled={logActivityMutation.isPending}
                >
                  <Users className="h-3.5 w-3.5" />
                  In Person
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <Popover open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => e.stopPropagation()}
              >
                <CalendarDays className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent 
              className="w-auto p-0" 
              align="end"
              onClick={(e) => e.stopPropagation()}
            >
              <Calendar
                mode="single"
                selected={activity.next_action_due ? parseISO(activity.next_action_due) : undefined}
                onSelect={handleReschedule}
                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
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