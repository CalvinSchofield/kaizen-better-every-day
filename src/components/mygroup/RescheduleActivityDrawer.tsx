import { useState, useEffect } from "react";
import { Calendar as CalendarIcon, Loader2, User, ChevronDown } from "lucide-react";
import { format, addDays, getDay, startOfDay } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { MentionInput } from "@/components/mygroup/recruit-detail/MentionInput";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle,
  DrawerFooter
} from "@/components/ui/drawer";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Recruit, RecruitActivity, useUpdateRecruitActivity } from "@/hooks/useGroupRecruits";
import { useAssignableUsers, AssignableUser } from "@/hooks/useAssignableUsers";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface RescheduleActivityDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recruit: Recruit | null;
  activity: RecruitActivity | null;
  onComplete?: () => void;
}

// Strip emojis from name
const stripEmojis = (text: string | null): string | null => {
  if (!text) return null;
  return text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2B50}]|[\u{1FA00}-\u{1FAFF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]/gu, '').trim();
};

// Get next available day, skipping Sunday (0 = Sunday in getDay)
const getNextAvailableDay = (): Date => {
  let nextDay = addDays(new Date(), 1);
  // If tomorrow is Sunday, skip to Monday
  if (getDay(nextDay) === 0) {
    nextDay = addDays(nextDay, 1);
  }
  return nextDay;
};

export const RescheduleActivityDrawer = ({
  open,
  onOpenChange,
  recruit,
  activity,
  onComplete,
}: RescheduleActivityDrawerProps) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(getNextAvailableDay());
  const [taskText, setTaskText] = useState("");
  const [taskMentions, setTaskMentions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState<AssignableUser | null>(null);
  const [showAssigneePopover, setShowAssigneePopover] = useState(false);
  
  const updateActivityMutation = useUpdateRecruitActivity();
  const { data: assignableUsers = [], isLoading: assignableUsersLoading } = useAssignableUsers({
    recruitId: recruit?.id,
    recruitTeamLeader: recruit?.teamName,
  });

  // Reset form when activity changes
  useEffect(() => {
    if (activity && open) {
      setTaskText(activity.next_action || activity.notes || "Follow-up");
      setSelectedDate(getNextAvailableDay());
      
      // Pre-select the existing assignee if there is one
      if (activity.assigned_to_user_id && assignableUsers.length > 0) {
        const existingAssignee = assignableUsers.find(u => u.userId === activity.assigned_to_user_id);
        setSelectedAssignee(existingAssignee || null);
      } else {
        setSelectedAssignee(null);
      }
    }
  }, [activity, open, assignableUsers]);

  // Generate quick dates that skip Sunday
  const getQuickDates = () => {
    const dates = [];
    let tomorrow = addDays(new Date(), 1);
    if (getDay(tomorrow) === 0) tomorrow = addDays(tomorrow, 1);
    dates.push({ label: 'Tomorrow', date: tomorrow });
    
    let in3Days = addDays(new Date(), 3);
    if (getDay(in3Days) === 0) in3Days = addDays(in3Days, 1);
    dates.push({ label: 'In 3 days', date: in3Days });
    
    let nextWeek = addDays(new Date(), 7);
    if (getDay(nextWeek) === 0) nextWeek = addDays(nextWeek, 1);
    dates.push({ label: 'Next week', date: nextWeek });
    
    return dates;
  };

  const quickDates = getQuickDates();

  const handleReschedule = async () => {
    if (!activity || !selectedDate) return;
    
    setIsLoading(true);
    try {
      // Format as date-only string (YYYY-MM-DD) to avoid timezone shifts
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const dateOnlyString = formatInTimeZone(selectedDate, userTimezone, 'yyyy-MM-dd');
      
      await updateActivityMutation.mutateAsync({
        activityId: activity.id,
        nextActionDue: dateOnlyString,
        nextAction: taskText.trim() || undefined,
        assignedToUserId: selectedAssignee?.userId,
      });
      
      const assigneeText = selectedAssignee ? ` (assigned to ${selectedAssignee.name})` : '';
      toast.success(`Rescheduled for ${format(selectedDate, 'MMM d')}${assigneeText}`);
      onOpenChange(false);
      onComplete?.();
      setSelectedDate(getNextAvailableDay());
      setTaskText("");
      setTaskMentions([]);
      setSelectedAssignee(null);
    } catch (error) {
      console.error('Failed to reschedule:', error);
      toast.error('Failed to reschedule');
    } finally {
      setIsLoading(false);
    }
  };

  if (!recruit || !activity) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="border-b">
          <DrawerTitle>
            Reschedule for {stripEmojis(recruit.name)}
          </DrawerTitle>
        </DrawerHeader>
        
        <div className="p-4 space-y-4">
          {/* Editable task text */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              What's the next step? (type @ to mention)
            </label>
            <MentionInput
              value={taskText}
              onChange={setTaskText}
              onMentionsChange={setTaskMentions}
              placeholder="e.g., Call to discuss blitz dates, Follow up on signing paperwork..."
              rows={3}
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

        <DrawerFooter className="border-t">
          <Button 
            onClick={handleReschedule}
            disabled={!selectedDate || isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Rescheduling...
              </>
            ) : (
              <>
                <CalendarIcon className="h-4 w-4 mr-2" />
                Reschedule for {selectedDate ? format(selectedDate, 'MMM d') : '...'}
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
  );
};
