import { Clock, LogOut, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { clearAllRepCaches } from "@/hooks/useRepData";

interface PendingApprovalScreenProps {
  repName?: string;
  teamLeader?: string | null;
  teamLeaderPhone?: string | null;
  showTeamInfoLink?: boolean;
}

const PendingApprovalScreen = ({ repName, teamLeader, teamLeaderPhone, showTeamInfoLink }: PendingApprovalScreenProps) => {
  const handleLogout = async () => {
    clearAllRepCaches();
    await supabase.auth.signOut();
  };

  const firstName = repName?.split(' ')[0] || 'there';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
        <Clock className="w-8 h-8 text-primary" />
      </div>
      
      <h1 className="text-2xl font-bold text-foreground mb-2">
        Welcome, {firstName}! 🎉
      </h1>
      
      <p className="text-muted-foreground max-w-sm mb-6">
        Your account is being reviewed by your team leader. You'll have full access once approved — hang tight!
      </p>

      {teamLeader && (
        <div className="bg-muted/50 rounded-xl p-4 mb-6 max-w-sm w-full">
          <p className="text-sm text-muted-foreground mb-1">Reviewing your signup</p>
          <p className="font-semibold text-foreground">{teamLeader}</p>
          {teamLeaderPhone && (
            <a 
              href={`tel:${teamLeaderPhone}`} 
              className="text-sm text-primary hover:underline"
            >
              {teamLeaderPhone}
            </a>
          )}
        </div>
      )}

      {showTeamInfoLink && (
        <a
          href="https://www.smarthomepros.com"
          target="_blank"
          rel="noopener noreferrer"
          className="mb-6"
        >
          <Button variant="outline" className="gap-2">
            <ExternalLink className="w-4 h-4" />
            Learn About the Team
          </Button>
        </a>
      )}

      <Button variant="outline" onClick={handleLogout} className="gap-2">
        <LogOut className="w-4 h-4" />
        Sign Out
      </Button>
    </div>
  );
};

export default PendingApprovalScreen;
