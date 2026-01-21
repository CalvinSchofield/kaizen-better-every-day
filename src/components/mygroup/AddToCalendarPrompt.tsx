import { useState } from "react";
import { Calendar, Clock, Phone, X, Check } from "lucide-react";
import { format, parse } from "date-fns";
import { Button } from "@/components/ui/button";
import { TimePicker, formatTime12, getDefaultTime } from "@/components/ui/time-picker";
import { 
  addToCalendar, 
  getCalendarTitle, 
  buildCalendarDescription,
  CalendarEventData 
} from "@/utils/calendarLinks";
import { useAddCalendarEvent, useActivityCalendarEvent, useUpdateCalendarEvent } from "@/hooks/useActivityCalendarEvents";
import { Recruit } from "@/hooks/useGroupRecruits";
import { toast } from "sonner";
import { hapticSuccess } from "@/utils/haptics";
import { cn } from "@/lib/utils";

interface AddToCalendarPromptProps {
  activityId: string;
  recruit: Recruit;
  scheduledDate: string; // YYYY-MM-DD format
  notes: string;
  onClose: () => void;
  /** If true, this is a reschedule - show different messaging */
  isReschedule?: boolean;
  /** Previous date if rescheduling */
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
  const [selectedTime, setSelectedTime] = useState(getDefaultTime());
  const [showTimePicker, setShowTimePicker] = useState(false);
  
  const addCalendarEventMutation = useAddCalendarEvent();
  const updateCalendarEventMutation = useUpdateCalendarEvent();
  const { data: existingCalendarEvent } = useActivityCalendarEvent(activityId);
  
  const handleAddToCalendar = async () => {
    const eventTitle = getCalendarTitle(recruit.name, notes);
    const description = buildCalendarDescription(notes, recruit.phone);
    
    // Parse date and time to create full Date object
    const [hours, minutes] = selectedTime.split(':').map(Number);
    const eventDate = parse(scheduledDate, 'yyyy-MM-dd', new Date());
    eventDate.setHours(hours, minutes, 0, 0);
    
    const calendarEvent: CalendarEventData = {
      title: eventTitle,
      description,
      startDate: eventDate,
      durationMinutes: 15, // Default 15 min for a call/text
    };
    
    // Add to native calendar
    addToCalendar(calendarEvent);
    
    // Track in our database
    try {
      if (existingCalendarEvent) {
        await updateCalendarEventMutation.mutateAsync({
          id: existingCalendarEvent.id,
          calendarDate: scheduledDate,
          calendarTime: selectedTime,
          eventTitle,
        });
      } else {
        await addCalendarEventMutation.mutateAsync({
          activityId,
          calendarDate: scheduledDate,
          calendarTime: selectedTime,
          recruitName: recruit.name,
          eventTitle,
        });
      }
      
      hapticSuccess();
      
      if (isReschedule && previousDate) {
        toast.success('Calendar updated!', {
          description: `Remember to remove the old ${format(parse(previousDate, 'yyyy-MM-dd', new Date()), 'MMM d')} event`,
        });
      } else {
        toast.success('Added to calendar!');
      }
      
      onClose();
    } catch (error) {
      console.error('Failed to track calendar event:', error);
      // Still close - the calendar event was added, just tracking failed
      toast.success('Added to calendar!');
      onClose();
    }
  };
  
  const formattedDate = format(parse(scheduledDate, 'yyyy-MM-dd', new Date()), 'EEEE, MMM d');
  const displayTime = formatTime12(selectedTime);
  
  return (
    <div className="border-t border-border bg-muted/30 p-4 space-y-4 animate-in slide-in-from-bottom-2 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <span className="font-medium">
            {isReschedule ? 'Update Calendar?' : 'Add to Calendar?'}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Previous date warning for reschedule */}
      {isReschedule && previousDate && (
        <div className="text-sm text-muted-foreground bg-warning/10 border border-warning/20 rounded-md px-3 py-2">
          You had this in your calendar for {format(parse(previousDate, 'yyyy-MM-dd', new Date()), 'MMM d')}.
          Update to the new date?
        </div>
      )}
      
      {/* Event Preview */}
      <div className="bg-background rounded-lg border p-3 space-y-2">
        <div className="font-medium text-sm">
          {getCalendarTitle(recruit.name, notes)}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>{formattedDate}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>{displayTime}</span>
        </div>
        {recruit.phone && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-4 w-4" />
            <span>{recruit.phone}</span>
          </div>
        )}
      </div>
      
      {/* Time Picker Toggle */}
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-between"
        onClick={() => setShowTimePicker(!showTimePicker)}
      >
        <span className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Select Time
        </span>
        <span className="text-muted-foreground">{displayTime}</span>
      </Button>
      
      {/* Time Picker */}
      {showTimePicker && (
        <TimePicker
          value={selectedTime}
          onChange={setSelectedTime}
          className="animate-in fade-in-50 duration-200"
        />
      )}
      
      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={onClose}
        >
          Skip
        </Button>
        <Button
          className="flex-1"
          onClick={handleAddToCalendar}
          disabled={addCalendarEventMutation.isPending || updateCalendarEventMutation.isPending}
        >
          <Calendar className="h-4 w-4 mr-2" />
          Add to Calendar
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
