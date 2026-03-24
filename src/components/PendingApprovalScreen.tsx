import { Clock, LogOut, ExternalLink, Smartphone, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { clearAllRepCaches } from "@/hooks/useRepData";

const TESTFLIGHT_URL = "https://testflight.apple.com/join/MGGUFyE7";

const isIOS = (): boolean => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) return true;
  return false;
};

const isNativeApp = (): boolean => {
  if (typeof window === "undefined") return false;
  return window.location.protocol === "capacitor:";
};

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
  const showAppDownload = isIOS() && !isNativeApp();

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

      {/* Download native app prompt for iOS web users */}
      {showAppDownload && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6 max-w-sm w-full">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Smartphone className="h-5 w-5 text-primary" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-sm text-foreground">Get the Kaizen App</p>
              <p className="text-xs text-muted-foreground">Faster, smoother, with push notifications</p>
            </div>
          </div>
          <Button
            onClick={() => window.open(TESTFLIGHT_URL, "_blank", "noopener,noreferrer")}
            size="sm"
            className="w-full gap-2"
          >
            <Download className="h-4 w-4" />
            Download via TestFlight
          </Button>
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
