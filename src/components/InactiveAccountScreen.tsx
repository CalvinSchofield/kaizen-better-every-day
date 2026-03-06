import { Lock, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { clearAllRepCaches } from "@/hooks/useRepData";

interface InactiveAccountScreenProps {
  repName?: string;
  teamLeader?: string | null;
  teamLeaderPhone?: string | null;
}

const InactiveAccountScreen = ({ repName, teamLeader, teamLeaderPhone }: InactiveAccountScreenProps) => {
  const handleLogout = async () => {
    clearAllRepCaches();
    await supabase.auth.signOut();
  };

  const firstName = repName?.split(' ')[0] || 'there';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-6">
        <Lock className="w-8 h-8 text-muted-foreground" />
      </div>
      
      <h1 className="text-2xl font-bold text-foreground mb-2">
        Hey {firstName}
      </h1>
      
      <p className="text-muted-foreground max-w-sm mb-6">
        Your account is currently inactive. If you think this is a mistake or you'd like to come back, reach out to your team leader.
      </p>

      {teamLeader && (
        <div className="bg-muted/50 rounded-xl p-4 mb-6 max-w-sm w-full">
          <p className="text-sm text-muted-foreground mb-1">Your team leader</p>
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

      <Button variant="outline" onClick={handleLogout} className="gap-2">
        <LogOut className="w-4 h-4" />
        Sign Out
      </Button>
    </div>
  );
};

export default InactiveAccountScreen;
