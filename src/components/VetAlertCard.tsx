import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, AlertCircle, Moon, MessageSquare } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp } from "lucide-react";

interface TeamMember {
  notionPageId: string;
  name: string;
  email: string | null;
  phone: string | null;
  blitzReady: boolean;
  committedBlitzes: string[];
  ipadAssigned: boolean;
  year: string | null;
  stage: string | null;
  onboardingStatus: string | null;
}

interface BlitzEvent {
  id: string;
  name: string;
  date: string;
  endDate: string | null;
  location: string | null;
}

interface VetAlertCardProps {
  teamMembers: TeamMember[];
  allBlitzes: BlitzEvent[];
}

interface RookieAlert {
  rookie: TeamMember;
  blitz: BlitzEvent;
  daysUntil: number;
}

export const VetAlertCard = ({ teamMembers, allBlitzes }: VetAlertCardProps) => {
  const [showCard, setShowCard] = useState(false);
  const [isMondayNightLights, setIsMondayNightLights] = useState(false);
  const [rookiesNeedingIpad, setRookiesNeedingIpad] = useState<RookieAlert[]>([]);
  const [rookiesNeedingOnboarding, setRookiesNeedingOnboarding] = useState<RookieAlert[]>([]);
  const [ipadSectionOpen, setIpadSectionOpen] = useState(true);
  const [onboardingSectionOpen, setOnboardingSectionOpen] = useState(true);

  useEffect(() => {
    // Check Monday Night Lights (Monday 4 AM - 8:30 PM MST)
    const checkMondayNightLights = () => {
      const now = new Date();
      const mstOffset = -7 * 60; // MST is UTC-7
      const localOffset = now.getTimezoneOffset();
      const mstTime = new Date(now.getTime() + (localOffset - mstOffset) * 60000);
      
      const day = mstTime.getDay();
      const hours = mstTime.getHours();
      const minutes = mstTime.getMinutes();
      const totalMinutes = hours * 60 + minutes;
      
      // Monday is 1, check if between 4:00 AM (240 minutes) and 8:30 PM (1230 minutes)
      return day === 1 && totalMinutes >= 240 && totalMinutes <= 1230;
    };

    // Check for rookies needing attention
    const checkRookieAlerts = () => {
      const today = new Date();
      const ipadAlerts: RookieAlert[] = [];
      const onboardingAlerts: RookieAlert[] = [];

      const rookies = teamMembers.filter(m => m.year === "Rookie");

      rookies.forEach(rookie => {
        rookie.committedBlitzes.forEach(blitzId => {
          const blitz = allBlitzes.find(b => b.id === blitzId);
          if (!blitz) return;

          const blitzDate = new Date(blitz.date);
          const diffTime = blitzDate.getTime() - today.getTime();
          const daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          // Only check for blitzes within 7 days and in the future
          if (daysUntil <= 7 && daysUntil >= 0) {
            // Check iPad status
            if (!rookie.ipadAssigned) {
              ipadAlerts.push({ rookie, blitz, daysUntil });
            }

            // Check onboarding status (not Phase 4 complete)
            const status = rookie.onboardingStatus?.toLowerCase() || "";
            if (!status.includes("phase 4")) {
              onboardingAlerts.push({ rookie, blitz, daysUntil });
            }
          }
        });
      });

      setRookiesNeedingIpad(ipadAlerts);
      setRookiesNeedingOnboarding(onboardingAlerts);
    };

    const isMNL = checkMondayNightLights();
    setIsMondayNightLights(isMNL);
    checkRookieAlerts();

    // Show card if any condition is met
    setShowCard(isMNL || rookiesNeedingIpad.length > 0 || rookiesNeedingOnboarding.length > 0);
  }, [teamMembers, allBlitzes]);

  const sendIpadRequestEmail = (rookie: TeamMember) => {
    const subject = `iPad Request for ${rookie.name}`;
    const body = `Hi,\n\nI'd like to request an iPad for ${rookie.name}.\n\nContact:\nEmail: ${rookie.email || 'N/A'}\nPhone: ${rookie.phone || 'N/A'}\n\nThanks!`;
    const mailtoLink = `mailto:salesassets@vivint.com?cc=Calvin.Schofield@vivint.com&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;
  };

  const getSimplifiedLocation = (blitz: BlitzEvent) => {
    if (!blitz.location) return blitz.name;
    // Extract city name from location (e.g., "Bakersfield, CA" -> "Bakersfield")
    return blitz.location.split(',')[0].trim();
  };

  if (!showCard) return null;

  return (
    <Card className="mb-6 border-orange-500/40 bg-gradient-to-br from-orange-500/10 to-transparent animate-fade-in animate-scale-in">
      <CardContent className="pt-6 space-y-4">
        {/* Monday Night Lights */}
        {isMondayNightLights && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Moon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h3 className="font-semibold text-lg">Monday Night Lights — Tonight!</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Team training and Q&A session.
            </p>
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-sm font-medium mb-2">💡 Leader Reminder:</p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                <li>Send personal invites to your recruits</li>
                <li>Take notes on key takeaways to share</li>
              </ul>
            </div>
          </div>
        )}

        {/* iPad Warnings */}
        {rookiesNeedingIpad.length > 0 && (
          <Collapsible open={ipadSectionOpen} onOpenChange={setIpadSectionOpen}>
            <div className="space-y-3">
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between group">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 animate-pulse" />
                    <h3 className="font-semibold text-lg">iPad Needed Before Blitz</h3>
                    <Badge variant="destructive" className="text-xs">
                      {rookiesNeedingIpad.length}
                    </Badge>
                  </div>
                  {ipadSectionOpen ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  These rookies need iPads before their upcoming blitz:
                </p>
                <div className="space-y-2">
                  {rookiesNeedingIpad.map((alert, idx) => (
                    <button
                      key={idx}
                      onClick={() => sendIpadRequestEmail(alert.rookie)}
                      className="w-full flex items-center justify-between p-3 bg-card border border-orange-500/30 rounded-lg hover:bg-orange-500/5 transition-colors text-left"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-orange-600 dark:text-orange-400">
                          {alert.rookie.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {getSimplifiedLocation(alert.blitz)} in {alert.daysUntil} {alert.daysUntil === 1 ? 'day' : 'days'}
                        </p>
                      </div>
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground italic">
                  Tap names to send iPad request email
                </p>
              </CollapsibleContent>
            </div>
          </Collapsible>
        )}

        {/* Onboarding Warnings */}
        {rookiesNeedingOnboarding.length > 0 && (
          <Collapsible open={onboardingSectionOpen} onOpenChange={setOnboardingSectionOpen}>
            <div className="space-y-3">
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between group">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    <h3 className="font-semibold text-lg">Onboarding Not Complete</h3>
                    <Badge variant="secondary" className="text-xs">
                      {rookiesNeedingOnboarding.length}
                    </Badge>
                  </div>
                  {onboardingSectionOpen ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  These rookies need to finish onboarding before their blitz:
                </p>
                <div className="space-y-2">
                  {rookiesNeedingOnboarding.map((alert, idx) => {
                    const status = alert.rookie.onboardingStatus || "Not Started";
                    const simpleStatus = status.toLowerCase().includes("phase") 
                      ? status.replace("Onboarding Step Completed: ", "")
                      : status.toLowerCase().includes("training") 
                      ? "Training"
                      : "Onboarding";
                    
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-card border rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-orange-600 dark:text-orange-400">
                            {alert.rookie.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {getSimplifiedLocation(alert.blitz)} in {alert.daysUntil} {alert.daysUntil === 1 ? 'day' : 'days'} • {simpleStatus}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            const phone = alert.rookie.phone;
                            if (phone) {
                              window.location.href = `sms:${phone}`;
                            }
                          }}
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground italic">
                  Tap message icon to reach out to them
                </p>
              </CollapsibleContent>
            </div>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
};
