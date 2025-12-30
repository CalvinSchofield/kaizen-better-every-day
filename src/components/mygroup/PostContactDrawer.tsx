import { useState, useEffect } from "react";
import { UserCheck, PhoneMissed, Loader2, Clock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle,
  DrawerFooter
} from "@/components/ui/drawer";
import { Recruit, RecruitActivity, useLogRecruitActivity } from "@/hooks/useGroupRecruits";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  /** Called when user wants to schedule a follow-up for later today */
  onScheduleLaterToday?: () => void;
}

// Strip emojis from name
const stripEmojis = (text: string | null): string | null => {
  if (!text) return null;
  return text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2B50}]|[\u{1FA00}-\u{1FAFF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]/gu, '').trim();
};

export const PostContactDrawer = ({
  open,
  onOpenChange,
  recruit,
  contactMethod,
  defaultMethod,
  scheduledActivity,
  onComplete,
  onScheduleLaterToday,
}: PostContactDrawerProps) => {
  // Use contactMethod if provided, otherwise use defaultMethod
  const method = contactMethod || defaultMethod || 'call';
  const isCall = method === 'call';
  
  const [outcome, setOutcome] = useState<'connected' | 'no_answer' | null>(null);
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [markTaskComplete, setMarkTaskComplete] = useState(true);
  
  const logActivityMutation = useLogRecruitActivity();
  const queryClient = useQueryClient();

  // Reset state when drawer opens/closes or method changes
  useEffect(() => {
    if (open) {
      setOutcome(null);
      setNotes('');
      setMarkTaskComplete(true);
    }
  }, [open]);

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
          // Invalidate queries to refresh the task list
          queryClient.invalidateQueries({ queryKey: ['assigned-tasks'] });
          queryClient.invalidateQueries({ queryKey: ['recruit-activities'] });
        }
      }
      
      // Show toast with undo option if task was completed
      if (taskWasCompleted) {
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
      onOpenChange(false);
      // Pass wasConnected to parent so it knows whether to dismiss the card
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
    onOpenChange(false);
  };

  if (!recruit) return null;

  const firstName = stripEmojis(recruit.name)?.split(' ')[0] || 'them';
  
  // Determine if we can submit (calls need outcome, text/in-person don't)
  const canSubmit = isCall ? !!outcome : true;

  return (
    <Drawer open={open} onOpenChange={handleClose}>
      <DrawerContent>
        <DrawerHeader className="border-b">
          <DrawerTitle>
            {isCall ? `How did it go with ${firstName}?` : `Log ${method === 'text' ? 'text' : 'meeting'} with ${firstName}`}
          </DrawerTitle>
        </DrawerHeader>
        
        <div className="p-4 space-y-4">
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
                Logging...
              </>
            ) : (
              "Save & Continue"
            )}
          </Button>
          {/* Show "Schedule for later today" when No Answer selected */}
          {isCall && outcome === 'no_answer' && onScheduleLaterToday && (
            <Button 
              variant="outline"
              onClick={() => {
                handleSubmit();
                onScheduleLaterToday();
              }}
              disabled={isLoading}
              className="w-full"
            >
              <Clock className="h-4 w-4 mr-2" />
              Schedule for later today
            </Button>
          )}
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
