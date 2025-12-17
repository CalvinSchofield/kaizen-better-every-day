import { Card } from "@/components/ui/card";
import { AlertTriangle, ChevronDown, MessageSquare } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface StuckRep {
  userId: string;
  name: string;
  phone?: string;
  currentWeeklyFp: number;
  neededWeeklyFp: number;
  weeksFlat: number;
}

interface StuckRepsAlertProps {
  stuckReps: StuckRep[];
}

const getFirstName = (name: string) => {
  const stripped = name.replace(/[\p{Emoji}\p{Emoji_Component}]/gu, '').trim();
  return stripped.split(' ')[0] || stripped;
};

const openSms = (phone: string, message: string) => {
  const cleanPhone = phone.replace(/\D/g, '');
  const encodedMessage = encodeURIComponent(message);
  window.open(`sms:${cleanPhone}?body=${encodedMessage}`, '_blank');
};

export const StuckRepsAlert = ({ stuckReps }: StuckRepsAlertProps) => {
  const [isOpen, setIsOpen] = useState(true);
  
  if (stuckReps.length === 0) return null;
  
  const handleText = (rep: StuckRep) => {
    if (!rep.phone) {
      toast.error("No phone number available");
      return;
    }
    const firstName = getFirstName(rep.name);
    const gap = (rep.neededWeeklyFp - rep.currentWeeklyFp).toFixed(1);
    const message = `Hey ${firstName}! Wanted to check in - how's everything going? Let me know if there's anything I can help with to get things moving. 💪`;
    openSms(rep.phone, message);
  };
  
  return (
    <Card className="p-4 border-amber-500/30 bg-amber-500/5">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h3 className="font-semibold text-sm">
              {stuckReps.length} rep{stuckReps.length !== 1 ? 's' : ''} showing plateau pattern
            </h3>
          </div>
          <ChevronDown className={cn(
            "w-4 h-4 text-muted-foreground transition-transform",
            isOpen && "rotate-180"
          )} />
        </CollapsibleTrigger>
        
        <CollapsibleContent className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground mb-3">
            These reps have flat FP+ for 2+ weeks AND are not on pace to hit their summer goal
          </p>
          
          {stuckReps.map(rep => (
            <div 
              key={rep.userId}
              className="flex items-center justify-between p-2 rounded-lg bg-background"
            >
              <div>
                <p className="font-medium text-sm">{rep.name}</p>
                <p className="text-xs text-muted-foreground">
                  Avg: {rep.currentWeeklyFp.toFixed(1)} FP+/wk • Need: {rep.neededWeeklyFp.toFixed(1)} FP+/wk
                </p>
                <p className="text-[10px] text-amber-600 dark:text-amber-400">
                  Gap: {(rep.neededWeeklyFp - rep.currentWeeklyFp).toFixed(1)} FP+/wk behind pace
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
                onClick={() => handleText(rep)}
              >
                <MessageSquare className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
