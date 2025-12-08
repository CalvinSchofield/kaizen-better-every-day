import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, AlertCircle, Moon, Tablet } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp } from "lucide-react";
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle,
  DrawerDescription,
  DrawerFooter
} from "@/components/ui/drawer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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
  onTeamMemberUpdate?: (notionPageId: string, updates: Partial<TeamMember>) => void;
}

interface RookieAlert {
  rookie: TeamMember;
  blitz: BlitzEvent;
  daysUntil: number;
  needsIpad: boolean;
  needsOnboarding: boolean;
}

export const VetAlertCard = ({ teamMembers, allBlitzes, onTeamMemberUpdate }: VetAlertCardProps) => {
  const { toast } = useToast();
  const [showCard, setShowCard] = useState(false);
  const [isMondayNightLights, setIsMondayNightLights] = useState(false);
  const [rookiesNeedingAttention, setRookiesNeedingAttention] = useState<RookieAlert[]>([]);
  const [alertSectionOpen, setAlertSectionOpen] = useState(true);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<RookieAlert | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [ipadAssigned, setIpadAssigned] = useState(false);

  useEffect(() => {
    console.log('[VetAlertCard] useEffect triggered', {
      teamMembersCount: teamMembers.length,
      allBlitzesCount: allBlitzes.length
    });

    // Check Monday Night Lights (Monday 9 AM - 8:30 PM MST)
    const checkMondayNightLights = () => {
      const now = new Date();
      const mstTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Denver' }));
      
      const day = mstTime.getDay();
      const hours = mstTime.getHours();
      const minutes = mstTime.getMinutes();
      const totalMinutes = hours * 60 + minutes;
      
      // Monday is 1, check if between 9:00 AM (540 minutes) and 8:30 PM (1230 minutes)
      const isMonday = day === 1;
      const isInTimeWindow = totalMinutes >= 540 && totalMinutes <= 1230;
      return { isMonday: isMonday && isInTimeWindow, isEvening: hours >= 17 }; // 5 PM = 17:00
    };

    // Check for rookies needing attention
    const checkRookieAlerts = () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset to start of day for accurate comparison
      const alertsMap = new Map<string, RookieAlert>();

      const rookies = teamMembers.filter(m => m.year === "Rookie");
      console.log('[VetAlertCard] Checking rookies:', rookies.length);

      rookies.forEach(rookie => {
        console.log('[VetAlertCard] Checking rookie:', {
          name: rookie.name,
          committedBlitzes: rookie.committedBlitzes,
          ipadAssigned: rookie.ipadAssigned,
          onboardingStatus: rookie.onboardingStatus
        });

        // Track the earliest blitz for this rookie to avoid duplicates
        let earliestBlitz: { blitz: BlitzEvent; daysUntil: number } | null = null;

        rookie.committedBlitzes.forEach(blitzId => {
          const blitz = allBlitzes.find(b => b.id === blitzId);
          if (!blitz) {
            console.log('[VetAlertCard] Blitz not found:', blitzId);
            return;
          }

          // Parse the date string as UTC to avoid timezone shifts
          const blitzDate = new Date(blitz.date + 'T00:00:00Z');
          const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
          
          // Calculate days difference using UTC timestamps
          const diffTime = blitzDate.getTime() - todayUTC.getTime();
          const daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          console.log('[VetAlertCard] Blitz check:', {
            rookieName: rookie.name,
            blitzName: blitz.name,
            blitzDate: blitz.date,
            today: today.toISOString(),
            blitzDateUTC: blitzDate.toISOString(),
            diffTime,
            daysUntil,
            ipadAssigned: rookie.ipadAssigned,
            onboardingStatus: rookie.onboardingStatus
          });

          // Track the earliest blitz within 7 days for this rookie
          if (daysUntil <= 7 && daysUntil >= 0) {
            if (!earliestBlitz || daysUntil < earliestBlitz.daysUntil) {
              earliestBlitz = { blitz, daysUntil };
            }
          }
        });

        // After checking all blitzes, add ONE alert per rookie if they have an upcoming blitz within 7 days
        if (earliestBlitz) {
          console.log('[VetAlertCard] Earliest blitz for rookie:', {
            rookieName: rookie.name,
            blitzName: earliestBlitz.blitz.name,
            daysUntil: earliestBlitz.daysUntil
          });

          const needsIpad = !rookie.ipadAssigned;
          const status = rookie.onboardingStatus?.toLowerCase() || "";
          const needsOnboarding = !status.includes("phase 4");

          // Only add alert if rookie needs iPad OR onboarding
          if (needsIpad || needsOnboarding) {
            // Use only rookie ID as key to ensure one alert per rookie
            alertsMap.set(rookie.notionPageId, {
              rookie,
              blitz: earliestBlitz.blitz,
              daysUntil: earliestBlitz.daysUntil,
              needsIpad,
              needsOnboarding
            });
          }
        }
      });

      const alerts = Array.from(alertsMap.values());
      console.log('[VetAlertCard] Combined alerts found:', alerts.length);

      setRookiesNeedingAttention(alerts);
      
      return alerts;
    };

    const mnlStatus = checkMondayNightLights();
    setIsMondayNightLights(mnlStatus.isMonday);
    const alerts = checkRookieAlerts();

    // Show card if any condition is met
    const shouldShow = mnlStatus.isMonday || alerts.length > 0;
    console.log('[VetAlertCard] Should show card:', shouldShow, {
      isMNL: mnlStatus.isMonday,
      isEvening: mnlStatus.isEvening,
      alertsCount: alerts.length
    });
    setShowCard(shouldShow);
  }, [teamMembers, allBlitzes]);

  const sendIpadRequestEmail = (rookie: TeamMember) => {
    const subject = `iPad Request for ${rookie.name}`;
    const body = `Team,\n\nI'd like to request an iPad for ${rookie.name}.\n\nBadge ID:\nAddress to ship to:\n\nThanks!`;
    const mailtoLink = `mailto:salesassets@vivint.com?cc=Calvin.Schofield@vivint.com&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;
  };

  const getSimplifiedLocation = (blitz: BlitzEvent) => {
    if (!blitz.location) return blitz.name;
    // Extract city name from location (e.g., "Bakersfield, CA" -> "Bakersfield")
    return blitz.location.split(',')[0].trim();
  };

  const openUpdateDialog = (alert: RookieAlert) => {
    setSelectedAlert(alert);
    setSelectedStatus(alert.rookie.onboardingStatus || "Started");
    setIpadAssigned(alert.rookie.ipadAssigned || false);
    setUpdateDialogOpen(true);
  };

  const updateRookieInfo = async () => {
    if (!selectedAlert) return;

    try {
      const updates: any = {};
      
      // Build the update request body
      const updateBody: any = {
        rookieNotionPageId: selectedAlert.rookie.notionPageId,
      };

      if (selectedAlert.needsOnboarding) {
        updateBody.onboardingStatus = selectedStatus;
        updates.onboardingStatus = selectedStatus;
      }

      if (selectedAlert.needsIpad) {
        updateBody.ipadAssigned = ipadAssigned;
        updates.ipadAssigned = ipadAssigned;
      }

      // Update Notion via edge function
      const { error: notionError } = await supabase.functions.invoke('update-rookie-status', {
        body: updateBody,
      });
      
      if (notionError) throw notionError;

      // Also update local Supabase database for iPad status
      if (selectedAlert.needsIpad) {
        const { data: repData, error: fetchError } = await supabase
          .from('reps')
          .select('id')
          .eq('notion_page_id', selectedAlert.rookie.notionPageId)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (repData) {
          const { error: ipadError } = await supabase
            .from('reps')
            .update({ ipad_assigned: ipadAssigned })
            .eq('id', repData.id);

          if (ipadError) throw ipadError;
        }
      }

      // Notify parent of changes
      if (onTeamMemberUpdate) {
        onTeamMemberUpdate(selectedAlert.rookie.notionPageId, updates);
      }

      // Remove alert from list if both issues resolved
      const statusResolved = !selectedAlert.needsOnboarding || selectedStatus.includes("Phase 4");
      const ipadResolved = !selectedAlert.needsIpad || ipadAssigned;
      
      if (statusResolved && ipadResolved) {
        setRookiesNeedingAttention(prev => 
          prev.filter(a => 
            !(a.rookie.notionPageId === selectedAlert.rookie.notionPageId && 
              a.blitz.id === selectedAlert.blitz.id)
          )
        );
      } else {
        // Update alert in place
        setRookiesNeedingAttention(prev => 
          prev.map(a => 
            a.rookie.notionPageId === selectedAlert.rookie.notionPageId && a.blitz.id === selectedAlert.blitz.id
              ? { 
                  ...a, 
                  rookie: { ...a.rookie, ...updates },
                  needsOnboarding: !statusResolved,
                  needsIpad: !ipadResolved
                }
              : a
          )
        );
      }

      toast({
        title: "Updated successfully",
        description: `${selectedAlert.rookie.name}'s information has been updated`,
      });

      setUpdateDialogOpen(false);
    } catch (error: any) {
      console.error('Error updating rookie:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update",
        variant: "destructive",
      });
    }
  };

  if (!showCard) return null;

  return (
    <>
    <Card className="mb-6 border-orange-500/40 bg-gradient-to-br from-orange-500/10 to-transparent animate-in fade-in slide-in-from-top-2 duration-500">
      <CardContent className="pt-6 space-y-4">
        {/* Monday Night Lights */}
        {isMondayNightLights && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Moon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h3 className="font-semibold text-lg">
                Monday Night Lights — {(() => {
                  const now = new Date();
                  const mstTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Denver' }));
                  const hour = mstTime.getHours();
                  const minutes = mstTime.getMinutes();
                  const totalMinutes = hour * 60 + minutes;
                  // MNL starts at 6pm MST (1080 minutes), "Happening Now" = within 1 hour of start (5pm+)
                  const mnlStartMinutes = 18 * 60; // 6pm = 1080 minutes
                  const isWithinOneHourOfStart = totalMinutes >= mnlStartMinutes - 60; // 5pm or later
                  return isWithinOneHourOfStart ? "Happening Now!" : "Later Today";
                })()}
              </h3>
            </div>
            <p className="text-sm text-muted-foreground">
              6:00 PM - 8:30 PM MST • Team training and Q&A session
            </p>
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-sm font-medium mb-2">💡 Team Lead & MGMT Reminder:</p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                <li>Send <strong>personal invites</strong> to each of your recruits individually</li>
                <li>Encourage them to <strong>take notes</strong> on key takeaways</li>
                <li>If you're in <strong>Utah</strong>, encourage your team to attend <strong>in person</strong> when possible</li>
              </ul>
            </div>
          </div>
        )}

        {/* Ramp to Blitz Prep Warnings */}
        {rookiesNeedingAttention.length > 0 && (
          <Collapsible open={alertSectionOpen} onOpenChange={setAlertSectionOpen}>
            <div className="space-y-3">
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between group hover:opacity-80 transition-all duration-300">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 animate-[pulse_2s_ease-in-out_infinite]" />
                    <h3 className="font-semibold text-lg">Ramp to Blitz Not Complete</h3>
                    <Badge variant="destructive" className="text-xs animate-in zoom-in-50 duration-300">
                      {rookiesNeedingAttention.length}
                    </Badge>
                  </div>
                  {alertSectionOpen ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground transition-transform duration-300" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-300" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 animate-in slide-in-from-top-2 duration-500">
                <p className="text-sm text-muted-foreground">
                  These rookies need to complete their prep before their upcoming blitz:
                </p>
                <div className="space-y-2">
                  {rookiesNeedingAttention.map((alert, idx) => {
                    const issues: string[] = [];
                    if (alert.needsIpad) issues.push("iPad");
                    if (alert.needsOnboarding) issues.push("Finish Ramp to Blitz");
                    
                    return (
                      <button
                        key={idx}
                        onClick={() => openUpdateDialog(alert)}
                        className="w-full flex items-center justify-between p-3 bg-card border border-orange-500/30 rounded-lg hover:bg-accent/50 transition-all duration-300 hover:scale-[1.02] hover:shadow-md cursor-pointer group"
                      >
                        <div className="flex-1 text-left">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-orange-600 dark:text-orange-400">
                              {alert.rookie.name}
                            </p>
                            <Badge variant="outline" className="text-xs bg-accent/20 border-accent text-accent-foreground flex-shrink-0 animate-in zoom-in-50 duration-200">
                              Update
                            </Badge>
                            {alert.needsIpad && (
                              <Badge variant="outline" className="text-xs bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800 text-red-700 dark:text-red-400">
                                Needs iPad
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {getSimplifiedLocation(alert.blitz)} in {alert.daysUntil} {alert.daysUntil === 1 ? 'day' : 'days'}
                          </p>
                          <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                            Needs: {issues.join(", ")}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground italic">
                  Tap a rookie's card to update their iPad status and/or ramp progress
                </p>
              </CollapsibleContent>
            </div>
          </Collapsible>
        )}
      </CardContent>
    </Card>

    {/* Update Drawer */}
    <Drawer open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
      <DrawerContent>
        {selectedAlert && (
          <>
            <DrawerHeader className="border-b">
              <DrawerTitle>Update {selectedAlert.rookie.name}</DrawerTitle>
              <DrawerDescription>
                Update their preparation status for the {getSimplifiedLocation(selectedAlert.blitz)} blitz
              </DrawerDescription>
            </DrawerHeader>
            <div className="p-4 space-y-4">
              {selectedAlert.needsOnboarding && (
                <div className="space-y-2">
                  <Label>Onboarding Stage</Label>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="text-base">
                      <SelectValue placeholder="Select completed stage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Started">✓ Started</SelectItem>
                      <SelectItem value="Onboarding ✅">✓ Onboarding</SelectItem>
                      <SelectItem value="Trainings ✅">✓ Required Trainings</SelectItem>
                      <SelectItem value="Slack ✅">✓ Slack</SelectItem>
                      <SelectItem value="Phase 1 ✅">✓ Phase 1</SelectItem>
                      <SelectItem value="Phase 2 ✅">✓ Phase 2</SelectItem>
                      <SelectItem value="Phase 3 ✅">✓ Phase 3</SelectItem>
                      <SelectItem value="Phase 4 ✅">✓ Phase 4 (Blitz Ready)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {selectedAlert.needsIpad && (
                <div className="space-y-3">
                  <Label>iPad Assignment</Label>
                  <div className="flex items-center gap-3 p-3 border rounded-lg bg-card">
                    <Checkbox 
                      id="ipad-checkbox"
                      checked={ipadAssigned}
                      onCheckedChange={(checked) => setIpadAssigned(checked as boolean)}
                    />
                    <label htmlFor="ipad-checkbox" className="text-sm cursor-pointer flex-1">
                      iPad has been assigned
                    </label>
                  </div>
                  {!ipadAssigned && (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                      <div className="flex items-center gap-2 mb-2">
                        <Tablet className="h-4 w-4 text-amber-600" />
                        <span className="text-sm font-medium text-amber-700 dark:text-amber-400">Need to request an iPad?</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full border-amber-500/50 hover:bg-amber-500/10"
                        onClick={() => sendIpadRequestEmail(selectedAlert.rookie)}
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        Request iPad via Email
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <DrawerFooter className="border-t pt-4">
              <div className="flex gap-3 w-full">
                <Button variant="outline" onClick={() => setUpdateDialogOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={updateRookieInfo} className="flex-1">
                  Update
                </Button>
              </div>
            </DrawerFooter>
          </>
        )}
      </DrawerContent>
    </Drawer>
    </>
  );
};
