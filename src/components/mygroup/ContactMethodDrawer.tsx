import { useState } from "react";
import { Phone, MessageSquare, Loader2, Users } from "lucide-react";
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

interface ContactMethodDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recruit: Recruit | null;
}

// Strip emojis from name
const stripEmojis = (text: string | null): string | null => {
  if (!text) return null;
  return text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2B50}]|[\u{1FA00}-\u{1FAFF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]/gu, '').trim();
};

export const ContactMethodDrawer = ({
  open,
  onOpenChange,
  recruit,
}: ContactMethodDrawerProps) => {
  const [contactMethod, setContactMethod] = useState<'phone_call' | 'text' | 'in_person' | null>(null);
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const logActivityMutation = useLogRecruitActivity();

  const handleLogContact = async () => {
    if (!recruit || !contactMethod) return;
    
    setIsLoading(true);
    try {
      await logActivityMutation.mutateAsync({
        recruitNotionId: recruit.notionPageId,
        activityType: contactMethod === 'in_person' ? 'in_person' : 'phone_call',
        notes: notes || `${contactMethod === 'phone_call' ? 'Phone call' : contactMethod === 'text' ? 'Text message' : 'Met in person'}`,
        updateLastContact: true,
      });
      toast.success(`Contact logged for ${stripEmojis(recruit.name)}`);
      onOpenChange(false);
      setNotes('');
      setContactMethod(null);
    } catch (error) {
      console.error('Failed to log contact:', error);
      toast.error('Failed to log contact');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setNotes('');
    setContactMethod(null);
  };

  if (!recruit) return null;

  return (
    <Drawer open={open} onOpenChange={handleClose}>
      <DrawerContent>
        <DrawerHeader className="border-b">
          <DrawerTitle>
            Log Contact with {stripEmojis(recruit.name)}
          </DrawerTitle>
        </DrawerHeader>
        
        <div className="p-4 space-y-4">
          {/* Contact method selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              How did you contact them?
            </label>
            <div className="grid grid-cols-3 gap-3">
              <Button
                variant="outline"
                className={cn(
                  "h-20 flex-col gap-2",
                  contactMethod === 'phone_call' && "border-primary bg-primary/10"
                )}
                onClick={() => setContactMethod('phone_call')}
              >
                <Phone className="h-6 w-6" />
                <span className="text-xs">Phone Call</span>
              </Button>
              <Button
                variant="outline"
                className={cn(
                  "h-20 flex-col gap-2",
                  contactMethod === 'text' && "border-primary bg-primary/10"
                )}
                onClick={() => setContactMethod('text')}
              >
                <MessageSquare className="h-6 w-6" />
                <span className="text-xs">Text</span>
              </Button>
              <Button
                variant="outline"
                className={cn(
                  "h-20 flex-col gap-2",
                  contactMethod === 'in_person' && "border-primary bg-primary/10"
                )}
                onClick={() => setContactMethod('in_person')}
              >
                <Users className="h-6 w-6" />
                <span className="text-xs">In Person</span>
              </Button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Notes (optional)
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What did you discuss?"
              className="resize-none"
              rows={3}
            />
          </div>
        </div>

        <DrawerFooter className="border-t">
          <Button 
            onClick={handleLogContact}
            disabled={!contactMethod || isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Logging...
              </>
            ) : (
              "Log Contact"
            )}
          </Button>
          <Button 
            variant="outline"
            onClick={handleClose}
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
