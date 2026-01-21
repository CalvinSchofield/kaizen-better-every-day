import { useState } from "react";
import { Calendar as CalendarIcon, Loader2, User, ChevronDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Recruit, useLogRecruitActivity } from "@/hooks/useGroupRecruits";
import { useAssignableUsers, AssignableUser } from "@/hooks/useAssignableUsers";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MentionInput } from "./recruit-detail/MentionInput";
import { AddToCalendarPrompt } from "./AddToCalendarPrompt";

interface ScheduleFollowUpDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recruit: Recruit | null;
  onComplete?: () => void;
}

// Strip emojis from name
const stripEmojis = (text: string | null): string | null => {
  if (!text) return null;
  return text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2B50}]|[\u{1FA00}-\u{1FAFF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]/gu, '').trim();
};

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
  const [showAssigneePopover, setShowAssigneePopover] = useState(false);
  
  // Calendar prompt state
  const [showCalendarPrompt, setShowCalendarPrompt] = useState(false);
  const [scheduledActivityId, setScheduledActivityId] = useState<string | null>(null);
  const [scheduledDateString, setScheduledDateString] = useState<string>('');
  
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
      
      // Show calendar prompt instead of closing immediately
      if (result?.id) {
        setScheduledActivityId(result.id);
        setScheduledDateString(dateOnlyString);
        setShowCalendarPrompt(true);
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
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85svh] flex flex-col">
        <DrawerHeader className="border-b flex-shrink-0">
          <DrawerTitle>
            Schedule Follow-up with {stripEmojis(recruit.name)}
          </DrawerTitle>
        </DrawerHeader>
        
        <div className="flex-1 overflow-y-auto overscroll-contain">
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
            {assignableUsersLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : assignableUsers.length > 0 ? (
              <Popover open={showAssigneePopover} onOpenChange={setShowAssigneePopover}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                    role="combobox"
                  >
                    <span className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {selectedAssignee ? selectedAssignee.name : "Me (default)"}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-2" align="start">
                  <div className="flex flex-col gap-1">
                    <Button
                      variant={!selectedAssignee ? "secondary" : "ghost"}
                      className="w-full justify-start"
                      onClick={() => {
                        setSelectedAssignee(null);
                        setShowAssigneePopover(false);
                      }}
                    >
                      <User className="h-4 w-4 mr-2" />
                      Me (default)
                    </Button>
                    {assignableUsers.map((user) => (
                      <Button
                        key={user.userId}
                        variant={selectedAssignee?.userId === user.userId ? "secondary" : "ghost"}
                        className="w-full justify-start"
                        onClick={() => {
                          setSelectedAssignee(user);
                          setShowAssigneePopover(false);
                        }}
                      >
                        <User className="h-4 w-4 mr-2" />
                        <span className="flex-1 text-left">{user.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">{user.role}</span>
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              <Button
                variant="outline"
                className="w-full justify-start"
                disabled
              >
                <User className="h-4 w-4 mr-2" />
                Me (default)
              </Button>
            )}
          </div>
          </div>

          {/* Calendar Prompt - shown after successful scheduling */}
          {showCalendarPrompt && scheduledActivityId && scheduledDateString && (
            <AddToCalendarPrompt
              activityId={scheduledActivityId}
              recruit={recruit}
              scheduledDate={scheduledDateString}
              notes={notes}
              onClose={handleCloseComplete}
            />
          )}
        </div>

        {!showCalendarPrompt && (
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
        )}
      </DrawerContent>
    </Drawer>
  );
};
