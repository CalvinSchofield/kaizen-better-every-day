import { useState } from "react";
import { Calendar, Bell, X } from "lucide-react";
import { format, parse } from "date-fns";
import { Button } from "@/components/ui/button";
import { 
  getCalendarTitle, 
  buildCalendarDescription,
  CalendarEventData 
} from "@/utils/calendarLinks";
import { 
  addToNativeCalendarEvent, 
  addToNativeReminder, 
  detectCalendarType,
  suggestTime 
} from "@/utils/nativeCalendar";
import { useAddCalendarEvent, useActivityCalendarEvent, useUpdateCalendarEvent } from "@/hooks/useActivityCalendarEvents";
import { Recruit } from "@/hooks/useGroupRecruits";
import { toast } from "sonner";
import { hapticSuccess } from "@/utils/haptics";
import { cn } from "@/lib/utils";
import { formatTime12 } from "@/components/ui/time-picker";

interface AddToCalendarPromptProps {
  activityId: string;
  recruit: Recruit;
  scheduledDate: string; // YYYY-MM-DD format
  notes: string;
  onClose: () => void;
  isReschedule?: boolean;
  previousDate?: string;
}

export function AddToCalendarPrompt({
  activityId,
  recruit,
  scheduledDate,
  notes,
  onClose,
  isReschedule = false,
  previousDate,
}: AddToCalendarPromptProps) {
  const [isAdding, setIsAdding] = useState(false);
  
  const addCalendarEventMutation = useAddCalendarEvent();
  const updateCalendarEventMutation = useUpdateCalendarEvent();
  const { data: existingCalendarEvent } = useActivityCalendarEvent(activityId);
  
  const suggestedType = detectCalendarType(notes);
  const suggestedTimeStr = suggestTime(notes);
  
  const formattedDate = format(parse(scheduledDate, 'yyyy-MM-dd', new Date()), 'EEE, MMM d');

  const handleAdd = async (type: 'event' | 'reminder') => {
    setIsAdding(true);
    
    const eventTitle = getCalendarTitle(recruit.name, notes);
    const description = buildCalendarDescription(notes, recruit.phone);
    
    const [hours, minutes] = suggestedTimeStr.split(':').map(Number);
    const eventDate = parse(scheduledDate, 'yyyy-MM-dd', new Date());
    eventDate.setHours(hours, minutes, 0, 0);
    
    const calendarEvent: CalendarEventData = {
      title: eventTitle,
      description,
      startDate: eventDate,
      durationMinutes: type === 'event' ? 15 : 5,
    };
    
    // Open native sheet
    if (type === 'reminder') {
      await addToNativeReminder(calendarEvent);
    } else {
      await addToNativeCalendarEvent(calendarEvent);
    }
    
    // Track in DB
    try {
      if (existingCalendarEvent) {
        await updateCalendarEventMutation.mutateAsync({
          id: existingCalendarEvent.id,
          calendarDate: scheduledDate,
          calendarTime: suggestedTimeStr,
          eventTitle,
        });
      } else {
        await addCalendarEventMutation.mutateAsync({
          activityId,
          calendarDate: scheduledDate,
          calendarTime: suggestedTimeStr,
          recruitName: recruit.name,
          eventTitle,
        });
      }
      
      hapticSuccess();
      
      if (isReschedule && previousDate) {
        toast.success('Calendar updated!', {
          description: `Remove the old ${format(parse(previousDate, 'yyyy-MM-dd', new Date()), 'MMM d')} event`,
        });
      } else {
        toast.success(type === 'reminder' ? 'Reminder created!' : 'Added to calendar!');
      }
    } catch (error) {
      console.error('Failed to track calendar event:', error);
      toast.success(type === 'reminder' ? 'Reminder created!' : 'Added to calendar!');
    }
    
    setIsAdding(false);
    onClose();
  };

  return (
    <div className="border-t border-border bg-muted/30 p-4 space-y-3 animate-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          {isReschedule ? 'Update calendar?' : 'Add to calendar?'} · {formattedDate}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full"
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      
      <div className="flex gap-2">
        <Button
          variant={suggestedType === 'event' ? 'default' : 'outline'}
          className="flex-1 gap-2"
          onClick={() => handleAdd('event')}
          disabled={isAdding}
        >
          <Calendar className="h-4 w-4" />
          Calendar
        </Button>
        <Button
          variant={suggestedType === 'reminder' ? 'default' : 'outline'}
          className="flex-1 gap-2"
          onClick={() => handleAdd('reminder')}
          disabled={isAdding}
        >
          <Bell className="h-4 w-4" />
          Reminder
        </Button>
      </div>
    </div>
  );
}

/**
 * Small badge to indicate an activity is in the user's calendar
 */
export function CalendarBadge({ activityId }: { activityId: string }) {
  const { data: calendarEvent } = useActivityCalendarEvent(activityId);
  
  if (!calendarEvent) return null;
  
  return (
    <div 
      className="flex items-center gap-1 text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded"
      title={`In your calendar for ${format(parse(calendarEvent.calendar_date, 'yyyy-MM-dd', new Date()), 'MMM d')}${calendarEvent.calendar_time ? ` at ${formatTime12(calendarEvent.calendar_time)}` : ''}`}
    >
      <Calendar className="h-3 w-3" />
      <span className="hidden sm:inline">Cal</span>
    </div>
  );
}
