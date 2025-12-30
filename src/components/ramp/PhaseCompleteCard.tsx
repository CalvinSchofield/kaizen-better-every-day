import { Clock, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface PhaseCompleteCardProps {
  phaseNumber: number;
  teamLeaderPhone?: string | null;
  teamLeaderName?: string | null;
}

export const PhaseCompleteCard = ({ 
  phaseNumber, 
  teamLeaderPhone, 
  teamLeaderName 
}: PhaseCompleteCardProps) => {
  const handleTextLeader = () => {
    if (!teamLeaderPhone) {
      toast({
        title: "No leader phone found",
        description: "Contact your recruiter to get connected with your leader",
        variant: "destructive",
      });
      return;
    }

    const cleanPhone = teamLeaderPhone.replace(/\D/g, '');
    const message = encodeURIComponent(
      `Hey! I've finished all my tasks for Phase ${phaseNumber} of Ramp to Blitz. Can you verify and mark it complete when you get a chance?`
    );
    
    window.location.href = `sms:${cleanPhone}?body=${message}`;
  };

  const leaderFirstName = teamLeaderName?.split(' ')[0] || 'your leader';

  return (
    <Card className="bg-amber-500/10 border-amber-500/30 rounded-2xl">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-600" />
          <h3 className="font-semibold text-amber-700 dark:text-amber-500">
            Phase {phaseNumber} Complete!
          </h3>
        </div>
        <p className="text-sm text-muted-foreground">
          You've finished everything in this phase. Your leader will verify and unlock the next phase.
        </p>
        <Button
          variant="outline"
          className="w-full border-amber-500/30 text-amber-700 hover:bg-amber-500/10"
          onClick={handleTextLeader}
        >
          <MessageSquare className="w-4 h-4 mr-2" />
          Text {leaderFirstName}
        </Button>
      </CardContent>
    </Card>
  );
};
