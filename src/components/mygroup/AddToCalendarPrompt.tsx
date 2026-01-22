import { useState } from "react";
import { Calendar, Clock, Phone, X } from "lucide-react";
import { format, parse } from "date-fns";
import { Button } from "@/components/ui/button";
import { InlineTimePicker, formatTime12, getDefaultTime } from "@/components/ui/time-picker";
import { 
  getCalendarTitle, 
  buildCalendarDescription,
  CalendarEventData 
} from "@/utils/calendarLinks";
import { addToNativeCalendar } from "@/utils/nativeCalendar";
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
    await addToNativeCalendar(calendarEvent);
    
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
  const eventTitle = getCalendarTitle(recruit.name, notes);
  
  return (
    <div className="border-t border-border bg-gradient-to-b from-muted/50 to-muted/20 p-4 space-y-4 animate-in slide-in-from-bottom-2 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Calendar className="h-4 w-4 text-primary" />
          </div>
          <span className="font-semibold">
            {isReschedule ? 'Update Calendar?' : 'Add to Calendar?'}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Previous date warning for reschedule */}
      {isReschedule && previousDate && (
        <div className="text-sm text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          Previously scheduled for {format(parse(previousDate, 'yyyy-MM-dd', new Date()), 'MMM d')} — update to new date?
        </div>
      )}
      
      {/* Event Card - Streamlined Design */}
      <div className="bg-background rounded-xl border shadow-sm overflow-hidden">
        {/* Event Title */}
        <div className="px-4 py-3 border-b border-border/50">
          <div className="font-semibold text-base">
            {eventTitle}
          </div>
        </div>
        
        {/* Event Details */}
        <div className="divide-y divide-border/50">
          {/* Date Row */}
          <div className="flex items-center gap-3 px-4 py-3">
            <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm">{formattedDate}</span>
          </div>
          
          {/* Time Row - Tappable */}
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="h-4 w-4 flex-shrink-0" /> {/* Spacer for alignment */}
            <InlineTimePicker
              value={selectedTime}
              onChange={setSelectedTime}
            />
            <span className="text-xs text-muted-foreground ml-auto">Tap to change</span>
          </div>
          
          {/* Phone Row */}
          {recruit.phone && (
            <div className="flex items-center gap-3 px-4 py-3">
              <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm text-muted-foreground">{recruit.phone}</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex gap-3">
        <Button
          variant="ghost"
          className="flex-1"
          onClick={onClose}
        >
          Skip
        </Button>
        <Button
          className="flex-1 gap-2"
          onClick={handleAddToCalendar}
          disabled={addCalendarEventMutation.isPending || updateCalendarEventMutation.isPending}
        >
          <Calendar className="h-4 w-4" />
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
