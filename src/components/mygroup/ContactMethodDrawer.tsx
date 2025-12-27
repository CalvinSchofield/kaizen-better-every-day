import { useState } from "react";
import { Phone, MessageSquare, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle,
} from "@/components/ui/drawer";
import { Recruit, RecruitActivity } from "@/hooks/useGroupRecruits";
import { cn } from "@/lib/utils";
import { PostContactDrawer } from "./PostContactDrawer";

interface ContactMethodDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recruit: Recruit | null;
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

export const ContactMethodDrawer = ({
  open,
  onOpenChange,
  recruit,
  scheduledActivity,
  onComplete,
  onScheduleLaterToday,
}: ContactMethodDrawerProps) => {
  const [selectedMethod, setSelectedMethod] = useState<'call' | 'text' | 'in_person' | null>(null);
  const [showPostContactDrawer, setShowPostContactDrawer] = useState(false);

  const handleMethodSelect = (method: 'call' | 'text' | 'in_person') => {
    setSelectedMethod(method);
    
    // For call/text, open the phone/SMS first
    if (method === 'call' && recruit?.phone) {
      window.location.href = `tel:${recruit.phone}`;
    } else if (method === 'text' && recruit?.phone) {
      window.location.href = `sms:${recruit.phone}`;
    }
    
    // Close this drawer and open post-contact drawer
    onOpenChange(false);
    setTimeout(() => {
      setShowPostContactDrawer(true);
    }, 300);
  };

  const handlePostContactComplete = (wasConnected: boolean) => {
    setShowPostContactDrawer(false);
    setSelectedMethod(null);
    // Pass through whether contact was actually made
    onComplete?.(wasConnected);
  };

  const handleClose = () => {
    onOpenChange(false);
    setSelectedMethod(null);
  };

  if (!recruit) return null;

  return (
    <>
      <Drawer open={open} onOpenChange={handleClose}>
        <DrawerContent>
          <DrawerHeader className="border-b">
            <DrawerTitle>
              Contact {stripEmojis(recruit.name)}
            </DrawerTitle>
          </DrawerHeader>
          
          <div className="p-4">
            <div className="grid grid-cols-3 gap-3">
              <Button
                variant="outline"
                className={cn(
                  "h-20 flex-col gap-2",
                  selectedMethod === 'call' && "border-primary bg-primary/10"
                )}
                onClick={() => handleMethodSelect('call')}
                disabled={!recruit.phone}
              >
                <Phone className="h-6 w-6" />
                <span className="text-xs">Call</span>
              </Button>
              <Button
                variant="outline"
                className={cn(
                  "h-20 flex-col gap-2",
                  selectedMethod === 'text' && "border-primary bg-primary/10"
                )}
                onClick={() => handleMethodSelect('text')}
                disabled={!recruit.phone}
              >
                <MessageSquare className="h-6 w-6" />
                <span className="text-xs">Text</span>
              </Button>
              <Button
                variant="outline"
                className={cn(
                  "h-20 flex-col gap-2",
                  selectedMethod === 'in_person' && "border-primary bg-primary/10"
                )}
                onClick={() => handleMethodSelect('in_person')}
              >
                <Users className="h-6 w-6" />
                <span className="text-xs">In Person</span>
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      <PostContactDrawer
        open={showPostContactDrawer}
        onOpenChange={(open) => {
          if (!open) {
            setShowPostContactDrawer(false);
            setSelectedMethod(null);
          }
        }}
        recruit={recruit}
        defaultMethod={selectedMethod || undefined}
        scheduledActivity={scheduledActivity}
        onComplete={handlePostContactComplete}
        onScheduleLaterToday={onScheduleLaterToday}
      />
    </>
  );
};