import { useState } from "react";
import { UserCheck, PhoneMissed, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle,
  DrawerFooter
} from "@/components/ui/drawer";
import { Recruit, useLogRecruitActivity } from "@/hooks/useGroupRecruits";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PostContactDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recruit: Recruit | null;
  contactMethod?: 'call' | 'text' | 'in_person';
  defaultMethod?: 'call' | 'text' | 'in_person';
  onComplete?: () => void;
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
  onComplete,
}: PostContactDrawerProps) => {
  // Use contactMethod if provided, otherwise use defaultMethod
  const method = contactMethod || defaultMethod || 'call';
  const [outcome, setOutcome] = useState<'connected' | 'no_answer' | null>(null);
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const logActivityMutation = useLogRecruitActivity();

  const handleSubmit = async () => {
    if (!recruit || !outcome) return;
    
    setIsLoading(true);
    try {
      const firstName = stripEmojis(recruit.name)?.split(' ')[0] || 'them';
      const actionLabel = method === 'call' ? 'Called' : method === 'text' ? 'Texted' : 'Met with';
      const outcomeLabel = outcome === 'connected' ? 'Connected' : 'No answer';
      
      await logActivityMutation.mutateAsync({
        recruitNotionId: recruit.notionPageId,
        activityType: method === 'in_person' ? 'in_person' : 'phone_call',
        notes: notes || `${actionLabel} ${firstName} - ${outcomeLabel}`,
        updateLastContact: outcome === 'connected', // Only update last contact if connected
      });
      
      toast.success(
        outcome === 'connected' 
          ? `Great! Logged ${method === 'in_person' ? 'meeting' : 'call'} with ${firstName}` 
          : `Logged attempt to reach ${firstName}`
      );
      
      // Reset and close
      setOutcome(null);
      setNotes('');
      onOpenChange(false);
      onComplete?.();
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
    onOpenChange(false);
  };

  if (!recruit) return null;

  const firstName = stripEmojis(recruit.name)?.split(' ')[0] || 'them';

  return (
    <Drawer open={open} onOpenChange={handleClose}>
      <DrawerContent>
        <DrawerHeader className="border-b">
          <DrawerTitle>
            How did it go with {firstName}?
          </DrawerTitle>
        </DrawerHeader>
        
        <div className="p-4 space-y-4">
          {/* Outcome selection */}
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

          {/* Notes - show only after selecting outcome */}
          {outcome && (
            <div className="animate-fade-in">
              <label className="text-sm font-medium mb-2 block text-muted-foreground">
                {outcome === 'connected' ? 'What did you discuss?' : 'Any notes?'}
              </label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={outcome === 'connected' 
                  ? "Quick notes about your conversation..." 
                  : "Left voicemail, will try again..."
                }
                className="resize-none"
                rows={3}
                autoFocus
              />
            </div>
          )}
        </div>

        <DrawerFooter className="border-t">
          <Button 
            onClick={handleSubmit}
            disabled={!outcome || isLoading}
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
