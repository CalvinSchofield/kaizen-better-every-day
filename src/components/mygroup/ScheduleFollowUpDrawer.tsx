import { useState, useEffect, useRef } from "react";
import { Calendar as CalendarIcon, Loader2 } from "lucide-react";

import { format, addDays, getDay, startOfDay } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle,
  DrawerFooter
} from "@/components/ui/drawer";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AssigneeSelector } from "./AssigneeSelector";
import { useRepData } from "@/hooks/useRepData";
import { Recruit, useLogRecruitActivity } from "@/hooks/useGroupRecruits";
import { useAssignableUsers, AssignableUser } from "@/hooks/useAssignableUsers";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MentionInput } from "./recruit-detail/MentionInput";
import { AddToCalendarDrawer } from "./AddToCalendarPrompt";
import { getCleanName } from "@/utils/nameUtils";

interface ScheduleFollowUpDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recruit: Recruit | null;
  onComplete?: () => void;
}

export const ScheduleFollowUpDrawer = ({
  open,
  onOpenChange,
  recruit,
  onComplete,
}: ScheduleFollowUpDrawerProps) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(addDays(new Date(), 1));
  const [notes, setNotes] = useState('');
  const [notesMentions, setNotesMentions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState<AssignableUser | null>(null);
  const { repData } = useRepData();
  
  // Calendar prompt state
  const [showCalendarPrompt, setShowCalendarPrompt] = useState(false);
  const [scheduledActivityId, setScheduledActivityId] = useState<string | null>(null);
  const [scheduledDateString, setScheduledDateString] = useState<string>('');
  
  // Capture stable viewport height before keyboard opens
  const stableHeightRef = useRef<number>(window.innerHeight);

  // Reset form state when drawer opens or recruit changes
  useEffect(() => {
    if (open) {
      // Capture height BEFORE keyboard could fire
      stableHeightRef.current = window.innerHeight;
      // Dismiss keyboard immediately to prevent height squishing
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      setNotes('');
      setNotesMentions([]);
      setSelectedDate(addDays(new Date(), 1));
      setSelectedAssignee(null);
      setShowCalendarPrompt(false);
      setScheduledActivityId(null);
      setScheduledDateString('');
    }
  }, [open, recruit?.id]);

  const logActivityMutation = useLogRecruitActivity();
  const { data: assignableUsers = [], isLoading: assignableUsersLoading } = useAssignableUsers({
    recruitId: recruit?.id,
    recruitTeamLeader: recruit?.teamName, // Fallback for recruits not in reps table
  });

  // Generate quick dates that skip Sunday for "In 3 days"
  const getQuickDates = () => {
    const dates = [];
    let tomorrow = addDays(new Date(), 1);
    if (getDay(tomorrow) === 0) tomorrow = addDays(tomorrow, 1);
    dates.push({ label: 'Tomorrow', date: tomorrow });
    
    // Smart 3-day logic: if 3 days from now is Sunday, push to Monday (4 days)
    let in3Days = addDays(new Date(), 3);
    if (getDay(in3Days) === 0) in3Days = addDays(in3Days, 1);
    dates.push({ label: 'In 3 days', date: in3Days });
    
    let nextWeek = addDays(new Date(), 7);
    if (getDay(nextWeek) === 0) nextWeek = addDays(nextWeek, 1);
    dates.push({ label: 'Next week', date: nextWeek });
    
    return dates;
  };

  const quickDates = getQuickDates();

  const handleSchedule = async () => {
    if (!recruit || !selectedDate) return;
    
    setIsLoading(true);
    try {
      // Format as date-only string (YYYY-MM-DD) to avoid timezone shifts
      // Use local timezone to get the date the user actually selected
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const dateOnlyString = formatInTimeZone(selectedDate, userTimezone, 'yyyy-MM-dd');
      
      const result = await logActivityMutation.mutateAsync({
        recruitId: recruit.id,
        activityType: 'next_step',
        notes: notes || `Follow up scheduled for ${format(selectedDate, 'MMM d')}`,
        nextAction: `Follow up on ${format(selectedDate, 'MMM d, yyyy')}`,
        nextActionDue: dateOnlyString,
        assignedToUserId: selectedAssignee?.userId,
      });
      
      const assigneeText = selectedAssignee ? ` (assigned to ${selectedAssignee.name})` : '';
      toast.success(`Follow-up scheduled for ${format(selectedDate, 'MMM d')}${assigneeText}`);
      
      // Show calendar prompt only if task is assigned to me (no assignee selected = me)
      if (result?.id && !selectedAssignee) {
        const savedId = result.id;
        const savedDate = dateOnlyString;
        handleCloseComplete();
        setTimeout(() => {
          setScheduledActivityId(savedId);
          setScheduledDateString(savedDate);
          setShowCalendarPrompt(true);
        }, 350);
      } else {
        handleCloseComplete();
      }
    } catch (error) {
      console.error('Failed to schedule follow-up:', error);
      toast.error('Failed to schedule follow-up');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseComplete = () => {
    onOpenChange(false);
    onComplete?.();
    // Reset state
    setNotes('');
    setNotesMentions([]);
    setSelectedDate(addDays(new Date(), 1));
    setSelectedAssignee(null);
    setShowCalendarPrompt(false);
    setScheduledActivityId(null);
    setScheduledDateString('');
  };

  if (!recruit) return null;

  return (
    <>
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85dvh] flex flex-col" style={{ position: 'fixed', bottom: 0 }}>
        <DrawerHeader className="border-b flex-shrink-0">
          <DrawerTitle>
            Schedule Follow-up with {getCleanName(recruit.name)}
          </DrawerTitle>
        </DrawerHeader>
        
        <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
          <div className="p-4 space-y-4">
          {/* Next steps - required */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              What's the next step?
            </label>
            <MentionInput
              value={notes}
              onChange={setNotes}
              onMentionsChange={setNotesMentions}
              placeholder="e.g., Call to discuss blitz dates... (type @ to mention)"
              rows={3}
              recruitId={recruit?.id}
            />
          </div>

          {/* Quick date buttons */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              When will you do it?
            </label>
            <div className="flex gap-2">
              {quickDates.map(({ label, date }) => (
                <Button
                  key={label}
                  variant={selectedDate?.toDateString() === date.toDateString() ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setSelectedDate(date)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom date picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !selectedDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, 'PPP') : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={(date) => date < startOfDay(new Date())}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          {/* Assign to selector */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Assign to (optional)
            </label>
            <AssigneeSelector
              assignableUsers={assignableUsers}
              selectedAssignee={selectedAssignee}
              onSelect={setSelectedAssignee}
              isLoading={assignableUsersLoading}
              currentUserPhotoUrl={repData?.profile_photo_url}
            />
          </div>
          </div>

        </div>

        <DrawerFooter className="border-t">
            <Button 
              onClick={handleSchedule}
              disabled={!selectedDate || isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Scheduling...
                </>
              ) : (
                <>
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  Schedule for {selectedDate ? format(selectedDate, 'MMM d') : '...'}
                </>
              )}
            </Button>
            <Button 
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="w-full"
            >
              Cancel
            </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>

    {recruit && scheduledActivityId && scheduledDateString && (
      <AddToCalendarDrawer
        open={showCalendarPrompt}
        activityId={scheduledActivityId}
        recruit={recruit}
        scheduledDate={scheduledDateString}
        notes={notes}
        onClose={() => {
          setShowCalendarPrompt(false);
          setScheduledActivityId(null);
          setScheduledDateString('');
        }}
      />
    )}
    </>
  );
};
