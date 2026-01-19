import { useState, useEffect } from "react";
import { UserCheck, PhoneMissed, Loader2, CheckCircle2, ChevronDown, ChevronUp, CalendarDays, User } from "lucide-react";
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
  const [isLoading, setIsLoading] = useState(false);
  const [markTaskComplete, setMarkTaskComplete] = useState(true);
  
  // Scheduling state
  const [showScheduling, setShowScheduling] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(undefined);
  const [quickDateOption, setQuickDateOption] = useState<QuickDateOption | null>(null);
  const [scheduleNotes, setScheduleNotes] = useState('');
  const [scheduleMentions, setScheduleMentions] = useState<string[]>([]);
  const [scheduleAssignee, setScheduleAssignee] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showAssigneePopover, setShowAssigneePopover] = useState(false);
  
  const logActivityMutation = useLogRecruitActivity();
  const queryClient = useQueryClient();
  
  // Fetch assignable users
  const { data: assignableUsers = [] } = useAssignableUsers({ recruitId: recruit?.id });

  // Reset state when drawer opens/closes
  useEffect(() => {
    if (open) {
      setOutcome(null);
      setNotes('');
      setMarkTaskComplete(true);
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
      
      // For texts/in-person, always mark as connected (they inherently connected)
      const effectiveOutcome = isCall ? outcome : 'connected';
      const wasConnected = effectiveOutcome === 'connected';
      const outcomeLabel = wasConnected ? 'Connected' : 'No answer';
      
      await logActivityMutation.mutateAsync({
        recruitId: recruit.id,
        recruitNotionId: recruit.id,
        activityType: method === 'in_person' ? 'in_person' : 'phone_call',
        notes: notes || `${actionLabel} ${firstName}${isCall ? ` - ${outcomeLabel}` : ''}`,
        updateLastContact: wasConnected, // Only update last contact if connected
      });
      
      // Mark scheduled activity as complete if connected and user opted to
      const taskWasCompleted = scheduledActivity && wasConnected && markTaskComplete;
      if (taskWasCompleted) {
        const { error: completeError } = await supabase
          .from('recruit_activities')
          .update({
            assignment_status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', scheduledActivity.id);
        
        if (completeError) {
          console.error('Failed to mark task complete:', completeError);
        } else {
          queryClient.invalidateQueries({ queryKey: ['assigned-tasks'] });
          queryClient.invalidateQueries({ queryKey: ['recruit-activities'] });
        }
      }

      // Create scheduled follow-up if user filled in scheduling
      let scheduledFollowUp = false;
      if (showScheduling && scheduleDate) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { error: scheduleError } = await supabase
            .from('recruit_activities')
            .insert({
              recruit_id: recruit.id,
              activity_type: 'next_step',
              logged_by_user_id: user.id,
              assigned_to_user_id: scheduleAssignee || user.id,
              assignment_status: 'pending',
              next_action: scheduleNotes || 'Follow up',
              next_action_due: scheduleDate.toISOString(),
              notes: scheduleNotes || null,
            });
          
          if (scheduleError) {
            console.error('Failed to schedule follow-up:', scheduleError);
          } else {
            scheduledFollowUp = true;
            queryClient.invalidateQueries({ queryKey: ['assigned-tasks'] });
            queryClient.invalidateQueries({ queryKey: ['recruit-activities'] });
            queryClient.invalidateQueries({ queryKey: ['group-recruits'] });
          }
        }
      }
      
      // Show appropriate toast
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
      
      // Reset and close
      setOutcome(null);
      setNotes('');
      setMarkTaskComplete(true);
      setShowScheduling(false);
      setScheduleDate(undefined);
      setQuickDateOption(null);
      setScheduleNotes('');
      setScheduleMentions([]);
      setScheduleAssignee(null);
      onOpenChange(false);
      onComplete?.(wasConnected);
    } catch (error) {
      console.error('Failed to log contact:', error);
      toast.error('Failed to log contact');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setOutcome(null);
    setNotes('');
    setMarkTaskComplete(true);
    setShowScheduling(false);
    setScheduleDate(undefined);
    setQuickDateOption(null);
    setScheduleNotes('');
    setScheduleMentions([]);
    setScheduleAssignee(null);
    onOpenChange(false);
  };

  if (!recruit) return null;

  const firstName = stripEmojis(recruit.name)?.split(' ')[0] || 'them';
  
  // Determine if we can submit (calls need outcome, text/in-person don't)
  const canSubmit = isCall ? !!outcome : true;
  
  // Check if we should show the scheduling section (after outcome for calls, always for text/in-person)
  const showSchedulingSection = isCall ? !!outcome : true;

  return (
    <Drawer open={open} onOpenChange={handleClose}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="border-b">
          <DrawerTitle>
            {isCall ? `How did it go with ${firstName}?` : `Log ${method === 'text' ? 'text' : 'meeting'} with ${firstName}`}
          </DrawerTitle>
        </DrawerHeader>
        
        <div className="p-4 space-y-4 overflow-y-auto">
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
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  isCall && outcome === 'connected' 
                    ? "Quick notes about your conversation..." 
                    : isCall
                      ? "Left voicemail, will try again..."
                      : method === 'text'
                        ? "What did you text about?"
                        : "What did you discuss?"
                }
                className="resize-none"
                rows={3}
                autoFocus={!isCall}
              />
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
  );
};
