import { useState, useEffect, useRef } from "react";
import { UserCheck, PhoneMissed, Loader2, CheckCircle2, ChevronDown, ChevronUp, CalendarDays, User } from "lucide-react";
import { AddToCalendarDrawer } from "./AddToCalendarPrompt";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle,
  DrawerFooter
} from "@/components/ui/drawer";
import { Recruit, RecruitActivity, useLogRecruitActivity } from "@/hooks/useGroupRecruits";
import { useAssignableUsers } from "@/hooks/useAssignableUsers";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MentionInput } from "./recruit-detail/MentionInput";
import { format, addDays, getDay, startOfDay } from "date-fns";
import { withTimeout } from "@/utils/withTimeout";

interface PostContactDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recruit: Recruit | null;
  contactMethod?: 'call' | 'text' | 'in_person';
  defaultMethod?: 'call' | 'text' | 'in_person';
  /** The scheduled activity that triggered this contact (if any) */
  scheduledActivity?: RecruitActivity | null;
  /** Called when contact is logged. wasConnected = true means dismiss the card, false means keep it */
  onComplete?: (wasConnected: boolean) => void;
}

// Strip emojis from name
const stripEmojis = (text: string | null): string | null => {
  if (!text) return null;
  return text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2B50}]|[\u{1FA00}-\u{1FAFF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]/gu, '').trim();
};

type QuickDateOption = 'tomorrow' | '3days' | 'nextweek' | 'custom';

export const PostContactDrawer = ({
  open,
  onOpenChange,
  recruit,
  contactMethod,
  defaultMethod,
  scheduledActivity,
  onComplete,
}: PostContactDrawerProps) => {
  // Use contactMethod if provided, otherwise use defaultMethod
  const method = contactMethod || defaultMethod || 'call';
  const isCall = method === 'call';
  
  const [outcome, setOutcome] = useState<'connected' | 'no_answer' | null>(null);
  const [notes, setNotes] = useState('');
  const [notesMentions, setNotesMentions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [markTaskComplete, setMarkTaskComplete] = useState(true);
  const [backdateValue, setBackdateValue] = useState(''); // '' = today, 'YYYY-MM-DD' = past date
  
  // Scheduling state
  const [showScheduling, setShowScheduling] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(undefined);
  const [quickDateOption, setQuickDateOption] = useState<QuickDateOption | null>(null);
  const [scheduleNotes, setScheduleNotes] = useState('');
  const [scheduleMentions, setScheduleMentions] = useState<string[]>([]);
  const [scheduleAssignee, setScheduleAssignee] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showAssigneePopover, setShowAssigneePopover] = useState(false);
  
  // Calendar prompt state
  const [showCalendarPrompt, setShowCalendarPrompt] = useState(false);
  const [scheduledActivityId, setScheduledActivityId] = useState<string | null>(null);
  const [scheduledDateString, setScheduledDateString] = useState<string | null>(null);
  
  const logActivityMutation = useLogRecruitActivity();
  const queryClient = useQueryClient();
  
  // Fetch assignable users
  const { data: assignableUsers = [] } = useAssignableUsers({ recruitId: recruit?.id });

  // Reset state when drawer opens/closes
  useEffect(() => {
    if (open) {
      setOutcome(null);
      setNotes('');
      setNotesMentions([]);
      setMarkTaskComplete(true);
      setBackdateValue('');
      setShowScheduling(false);
      setScheduleDate(undefined);
      setQuickDateOption(null);
      setScheduleNotes('');
      setScheduleMentions([]);
      setScheduleAssignee(null);
      setShowCalendar(false);
    }
  }, [open]);

  // Auto-expand scheduling and pre-select tomorrow when "No Answer" is selected
  // Also pre-fill the next step text from the scheduled activity if available
  useEffect(() => {
    if (outcome === 'no_answer') {
      setShowScheduling(true);
      setQuickDateOption('tomorrow');
      setScheduleDate(addDays(new Date(), 1));
      // Pre-fill next step from the scheduled activity we attempted
      if (scheduledActivity?.next_action) {
        setScheduleNotes(scheduledActivity.next_action);
      }
      // Pre-fill assignee from the scheduled activity if available
      if (scheduledActivity?.assigned_to_user_id) {
        setScheduleAssignee(scheduledActivity.assigned_to_user_id);
      }
    }
  }, [outcome, scheduledActivity]);

  const handleQuickDateSelect = (option: QuickDateOption) => {
    setQuickDateOption(option);
    if (option === 'tomorrow') {
      let tomorrow = addDays(new Date(), 1);
      if (getDay(tomorrow) === 0) tomorrow = addDays(tomorrow, 1);
      setScheduleDate(tomorrow);
      setShowCalendar(false);
    } else if (option === '3days') {
      // Smart 3-day logic: if 3 days from now is Sunday, push to Monday (4 days)
      let in3Days = addDays(new Date(), 3);
      if (getDay(in3Days) === 0) in3Days = addDays(in3Days, 1);
      setScheduleDate(in3Days);
      setShowCalendar(false);
    } else if (option === 'nextweek') {
      let nextWeek = addDays(new Date(), 7);
      if (getDay(nextWeek) === 0) nextWeek = addDays(nextWeek, 1);
      setScheduleDate(nextWeek);
      setShowCalendar(false);
    } else if (option === 'custom') {
      setShowCalendar(true);
    }
  };

  const handleCustomDateSelect = (date: Date | undefined) => {
    setScheduleDate(date);
    if (date) {
      setShowCalendar(false);
    }
  };

  const handleSubmit = async () => {
    if (!recruit) return;
    
    // For calls, require outcome selection
    if (isCall && !outcome) return;
    
    setIsLoading(true);

    try {
      const firstName = stripEmojis(recruit.name)?.split(' ')[0] || 'them';
      const actionLabel = method === 'call' ? 'Called' : method === 'text' ? 'Texted' : 'Met with';
      const activityType: 'phone_call' | 'in_person' | 'text' =
        method === 'in_person' ? 'in_person' : method === 'text' ? 'text' : 'phone_call';
      
      // For texts/in-person, always mark as connected (they inherently connected)
      const effectiveOutcome = isCall ? outcome : 'connected';
      const wasConnected = effectiveOutcome === 'connected';
      const outcomeLabel = wasConnected ? 'Connected' : 'No answer';

      // Build contact notes (don't merge schedule description — it goes in next_action)
      const wantsSchedule = showScheduling && scheduleDate;
      let combinedNotes = notes || `${actionLabel} ${firstName}${isCall ? ` - ${outcomeLabel}` : ''}`;

      // ── STEP 1: Log the contact activity (primary operation) ──
      let loggedActivity: any = null;
      try {
        const mutationParams: Parameters<typeof logActivityMutation.mutateAsync>[0] = {
          recruitId: recruit.id,
          recruitNotionId: recruit.id,
          activityType,
          notes: combinedNotes,
          updateLastContact: wasConnected,
          activityDate: backdateValue || undefined,
        };

        // Attach scheduling fields so the planner picks it up
        if (wantsSchedule) {
          const dateOnlyString = format(scheduleDate, 'yyyy-MM-dd');
          mutationParams.nextAction = scheduleNotes || 'Follow up';
          mutationParams.nextActionDue = dateOnlyString;
          // Always assign (to chosen user or self) so it appears in the planner
          mutationParams.assignedToUserId = scheduleAssignee || undefined;
        }

        loggedActivity = await withTimeout(
          logActivityMutation.mutateAsync(mutationParams),
          25000,
          'Saving contact timed out — please try again'
        );
      } catch (error: any) {
        console.error('Failed to log contact activity:', error);
        const msg = error?.message?.includes('timed out')
          ? 'Timed out saving — check your connection and try again'
          : 'Failed to log contact — tap Save to retry';
        toast.error(msg);
        return; // Don't proceed if the primary operation failed
      }

      // ── STEP 2: Mark scheduled task complete (fire-and-forget to avoid stacking timeouts) ──
      const taskWasCompleted = scheduledActivity && wasConnected && markTaskComplete;
      if (taskWasCompleted) {
        supabase
          .from('recruit_activities')
          .update({
            assignment_status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', scheduledActivity.id)
          .then(({ error: completeError }) => {
            if (completeError) {
              console.error('Failed to mark task complete:', completeError);
              toast.error('Contact logged, but failed to mark task complete');
            } else {
              queryClient.invalidateQueries({ queryKey: ['assigned-tasks'] });
              queryClient.invalidateQueries({ queryKey: ['recruit-activities'] });
            }
          });
      }

      // ── STEP 3: Sync recruit row for scheduling (independent, non-blocking) ──
      let newActivityId: string | null = null;
      let scheduledFollowUp = false;

      if (wantsSchedule) {
        const dateOnlyString = format(scheduleDate, 'yyyy-MM-dd');
        newActivityId = loggedActivity?.id || null;
        scheduledFollowUp = true;

        // Sync next_action to recruit row for display consistency (fire-and-forget)
        supabase
          .from('recruits')
          .update({
            next_action: scheduleNotes || 'Follow up',
            next_action_due: dateOnlyString,
          })
          .eq('id', recruit.id)
          .then(({ error }) => {
            if (error) console.error('Failed to sync recruit next action:', error);
          });

        queryClient.invalidateQueries({ queryKey: ['assigned-tasks'] });
        queryClient.invalidateQueries({ queryKey: ['recruit-activities'] });
        queryClient.invalidateQueries({ queryKey: ['group-recruits'] });
      }
      
      // ── STEP 4: Show success toast ──
      if (taskWasCompleted && scheduledFollowUp) {
        toast.success(`Logged contact, completed task, and scheduled follow-up for ${format(scheduleDate!, 'MMM d')}`);
      } else if (taskWasCompleted) {
        const taskName = scheduledActivity.next_action || 'Task';
        toast.success(`Logged contact and marked "${taskName}" complete`, {
          action: {
            label: 'Undo',
            onClick: async () => {
              const { error: undoError } = await supabase
                .from('recruit_activities')
                .update({
                  assignment_status: 'pending',
                  completed_at: null,
                })
                .eq('id', scheduledActivity.id);
              
              if (undoError) {
                toast.error('Failed to undo');
              } else {
                queryClient.invalidateQueries({ queryKey: ['assigned-tasks'] });
                queryClient.invalidateQueries({ queryKey: ['recruit-activities'] });
                queryClient.invalidateQueries({ queryKey: ['group-recruits'] });
                toast.success('Task restored');
              }
            },
          },
          duration: 5000,
        });
      } else if (scheduledFollowUp) {
        toast.success(`Logged contact and scheduled follow-up for ${format(scheduleDate!, 'MMM d')}`);
      } else if (isCall) {
        toast.success(
          wasConnected 
            ? `Great! Logged call with ${firstName}` 
            : `Logged attempt - ${firstName} stays in your list`
        );
      } else {
        toast.success(`Logged ${method === 'text' ? 'text' : 'meeting'} with ${firstName}`);
      }
      
      // ── STEP 5: Handle calendar prompt or close ──
      const shouldShowCalendar = scheduledFollowUp && newActivityId && scheduleDate && !scheduleAssignee;
      const savedScheduleDateStr = scheduleDate ? format(scheduleDate, 'yyyy-MM-dd') : null;

      // Reset and close the drawer
      setOutcome(null);
      setNotes('');
      setBackdateValue('');
      setMarkTaskComplete(true);
      setShowScheduling(false);
      setScheduleDate(undefined);
      setQuickDateOption(null);
      setScheduleNotes('');
      setScheduleMentions([]);
      setScheduleAssignee(null);
      onOpenChange(false);

      if (shouldShowCalendar && newActivityId && savedScheduleDateStr) {
        setTimeout(() => {
          setScheduledActivityId(newActivityId);
          setScheduledDateString(savedScheduleDateStr);
          setShowCalendarPrompt(true);
        }, 350);
      } else {
        onComplete?.(wasConnected);
      }
    } catch (error) {
      console.error('Unexpected error while saving post-contact activity:', error);
      toast.error('Something went wrong while saving — please try again');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setOutcome(null);
    setNotes('');
    setBackdateValue('');
    setMarkTaskComplete(true);
    setShowScheduling(false);
    setScheduleDate(undefined);
    setQuickDateOption(null);
    setScheduleNotes('');
    setScheduleMentions([]);
    setScheduleAssignee(null);
    setShowCalendarPrompt(false);
    setScheduledActivityId(null);
    setScheduledDateString(null);
    onOpenChange(false);
  };
  
  const handleCalendarPromptClose = () => {
    // Reset everything and close
    handleClose();
    onComplete?.(true); // Mark as connected since we scheduled follow-up
  };

  if (!recruit) return null;

  const firstName = stripEmojis(recruit.name)?.split(' ')[0] || 'them';
  
  // Determine if we can submit (calls need outcome, text/in-person don't)
  const canSubmit = isCall ? !!outcome : true;
  
  // Check if we should show the scheduling section (after outcome for calls, always for text/in-person)
  const showSchedulingSection = isCall ? !!outcome : true;

  return (
    <>
    <Drawer open={open} onOpenChange={handleClose}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="border-b">
          <DrawerTitle>
            {isCall ? `How did it go with ${firstName}?` : `Log ${method === 'text' ? 'text' : 'meeting'} with ${firstName}`}
          </DrawerTitle>
        </DrawerHeader>
        
        <div className="p-4 space-y-4 overflow-y-auto overflow-x-hidden">
          {/* Outcome selection - only for calls */}
          {isCall && (
            <div>
              <label className="text-sm font-medium mb-3 block text-muted-foreground">
                Did you connect?
              </label>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className={cn(
                    "h-24 flex-col gap-2 transition-all",
                    outcome === 'connected' && "border-green-500 bg-green-500/10 text-green-700"
                  )}
                  onClick={() => setOutcome('connected')}
                >
                  <UserCheck className={cn(
                    "h-7 w-7",
                    outcome === 'connected' && "text-green-600"
                  )} />
                  <span className="font-medium">Connected</span>
                </Button>
                <Button
                  variant="outline"
                  className={cn(
                    "h-24 flex-col gap-2 transition-all",
                    outcome === 'no_answer' && "border-amber-500 bg-amber-500/10 text-amber-700"
                  )}
                  onClick={() => setOutcome('no_answer')}
                >
                  <PhoneMissed className={cn(
                    "h-7 w-7",
                    outcome === 'no_answer' && "text-amber-600"
                  )} />
                  <span className="font-medium">No Answer</span>
                </Button>
              </div>
            </div>
          )}

          {/* Notes - for calls show after selecting outcome, for text/in-person show immediately */}
          {(isCall ? outcome : true) && (
            <div className="animate-fade-in">
              <label className="text-sm font-medium mb-2 block text-muted-foreground">
                {isCall && outcome === 'connected' 
                  ? 'What did you discuss?' 
                  : isCall 
                    ? 'Any notes?' 
                    : 'Add notes (optional)'
                }
              </label>
              <MentionInput
                value={notes}
                onChange={setNotes}
                onMentionsChange={setNotesMentions}
                placeholder={
                  isCall && outcome === 'connected' 
                    ? "Quick notes... (type @ to mention)" 
                    : isCall
                      ? "Left voicemail... (type @ to mention)"
                      : method === 'text'
                        ? "What did you text about? (type @ to mention)"
                        : "What did you discuss? (type @ to mention)"
                }
                rows={3}
                autoFocus={!isCall}
                recruitId={recruit?.id}
              />
              
              {/* Backdating option */}
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setBackdateValue(backdateValue ? '' : format(new Date(), 'yyyy-MM-dd'))}
                  className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  {backdateValue ? 'This happened today' : 'This happened in the past?'}
                </button>
                {backdateValue && (
                  <div className="mt-2 animate-fade-in">
                    <input 
                      type="date" 
                      value={backdateValue} 
                      onChange={(e) => setBackdateValue(e.target.value)} 
                      max={format(new Date(), 'yyyy-MM-dd')}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Mark task complete toggle - show when there's a scheduled activity and user connected */}
          {scheduledActivity && (isCall ? outcome === 'connected' : true) && (
            <div className="animate-fade-in flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <Label htmlFor="mark-complete" className="text-sm font-medium cursor-pointer">
                  Mark "{scheduledActivity.next_action || 'Task'}" complete
                </Label>
              </div>
              <Switch
                id="mark-complete"
                checked={markTaskComplete}
                onCheckedChange={setMarkTaskComplete}
              />
            </div>
          )}

          {/* Schedule Next Steps Section */}
          {showSchedulingSection && (
            <div className="animate-fade-in">
              <button
                type="button"
                onClick={() => setShowScheduling(!showScheduling)}
                className="w-full flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">
                    {showScheduling ? 'Schedule Next Steps' : '+ Schedule Next Steps'}
                  </span>
                </div>
                {showScheduling ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {showScheduling && (
                <div className="mt-3 space-y-4 animate-fade-in">
                  {/* Quick date options */}
                  <div>
                    <label className="text-sm font-medium mb-2 block text-muted-foreground">
                      When?
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={cn(
                          "transition-all",
                          quickDateOption === 'tomorrow' && "border-primary bg-primary/10 text-primary"
                        )}
                        onClick={() => handleQuickDateSelect('tomorrow')}
                      >
                        Tomorrow
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={cn(
                          "transition-all",
                          quickDateOption === '3days' && "border-primary bg-primary/10 text-primary"
                        )}
                        onClick={() => handleQuickDateSelect('3days')}
                      >
                        In 3 days
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={cn(
                          "transition-all",
                          quickDateOption === 'nextweek' && "border-primary bg-primary/10 text-primary"
                        )}
                        onClick={() => handleQuickDateSelect('nextweek')}
                      >
                        Next week
                      </Button>
                      <Popover open={showCalendar} onOpenChange={setShowCalendar}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className={cn(
                              "transition-all",
                              quickDateOption === 'custom' && "border-primary bg-primary/10 text-primary"
                            )}
                            onClick={() => handleQuickDateSelect('custom')}
                          >
                            {quickDateOption === 'custom' && scheduleDate 
                              ? format(scheduleDate, 'MMM d') 
                              : 'Pick date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={scheduleDate}
                            onSelect={handleCustomDateSelect}
                            disabled={(date) => date < startOfDay(new Date())}
                            initialFocus
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    {scheduleDate && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Scheduled for {format(scheduleDate, 'EEEE, MMMM d')}
                      </p>
                    )}
                  </div>

                  {/* Task description with @mention support */}
                  <div>
                    <label className="text-sm font-medium mb-2 block text-muted-foreground">
                      What's the next step?
                    </label>
                    <MentionInput
                      value={scheduleNotes}
                      onChange={setScheduleNotes}
                      onMentionsChange={setScheduleMentions}
                      placeholder={
                        outcome === 'no_answer' 
                          ? "Try calling again... (type @ to mention)" 
                          : "Call to discuss blitz dates... (type @ to mention)"
                      }
                      rows={3}
                      recruitId={recruit?.id}
                    />
                  </div>

                  {/* Assignee selector */}
                  {assignableUsers.length > 0 && (
                    <div>
                      <label className="text-sm font-medium mb-2 block text-muted-foreground">
                        Assign to (optional)
                      </label>
                      <Popover open={showAssigneePopover} onOpenChange={setShowAssigneePopover}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full justify-start"
                          >
                            <User className="h-4 w-4 mr-2" />
                            {scheduleAssignee 
                              ? assignableUsers.find(u => u.userId === scheduleAssignee)?.name || 'Me'
                              : 'Me (default)'
                            }
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-1" align="start">
                          <div className="space-y-1">
                            <button
                              type="button"
                              className="w-full text-left px-3 py-2 text-sm rounded hover:bg-muted transition-colors"
                              onClick={() => {
                                setScheduleAssignee(null);
                                setShowAssigneePopover(false);
                              }}
                            >
                              Me (default)
                            </button>
                            {assignableUsers.map((user) => (
                              <button
                                key={user.userId}
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm rounded hover:bg-muted transition-colors"
                                onClick={() => {
                                  setScheduleAssignee(user.userId);
                                  setShowAssigneePopover(false);
                                }}
                              >
                                {user.name}
                              </button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DrawerFooter className="border-t">
            <Button 
              onClick={handleSubmit}
              disabled={!canSubmit || isLoading}
              className="w-full"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : showScheduling && scheduleDate ? (
                "Save & Schedule"
              ) : (
                "Save & Continue"
              )}
            </Button>
            <Button 
              variant="ghost"
              onClick={handleClose}
              disabled={isLoading}
              className="w-full text-muted-foreground"
            >
              Skip for now
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
        notes={scheduleNotes}
        onClose={() => {
          setShowCalendarPrompt(false);
          setScheduledActivityId(null);
          setScheduledDateString(null);
          onComplete?.(true);
        }}
      />
    )}
    </>
  );
};
