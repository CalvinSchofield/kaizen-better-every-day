import { useState, useEffect } from "react";
import { CheckCircle2, Circle, PackageCheck, Tablet, Shirt, IdCard, MessageSquare, ChevronDown, ChevronUp, Shield, AlertTriangle, Brain, Battery, RefreshCw, Heart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useRampProgress } from "@/hooks/useRampProgress";
import type { RepData } from "@/hooks/useRepData";

interface Phase4ContentProps {
  repData: RepData | null;
  isComplete: boolean;
}

export const Phase4Content = ({ repData, isComplete }: Phase4ContentProps) => {
  const [expandedSection, setExpandedSection] = useState<string | null>("packing");
  const [packingDone, setPackingDone] = useState(false);
  const [essentialsChecked, setEssentialsChecked] = useState(false);
  const [playbookReady, setPlaybookReady] = useState(false);

  // Essentials checklist state
  const [hasIpad, setHasIpad] = useState(false);
  const [hasUniforms, setHasUniforms] = useState(false);
  const [hasBadge, setHasBadge] = useState(false);

  const { saveProgress, updateIpadStatus } = useRampProgress(repData?.user_id);

  // Load progress from watched_videos
  useEffect(() => {
    if (repData?.watched_videos && Array.isArray(repData.watched_videos)) {
      const watched = repData.watched_videos as string[];
      setPackingDone(watched.includes('phase4-packing-done'));
      setEssentialsChecked(watched.includes('phase4-essentials-checked'));
      setPlaybookReady(watched.includes('phase4-playbook-ready'));
    }
    // Load iPad status from repData
    if (repData?.ipad_assigned) {
      setHasIpad(true);
    }
  }, [repData?.watched_videos, repData?.ipad_assigned]);

  const handlePackingDone = async () => {
    const success = await saveProgress('phase4-packing-done');
    if (success) {
      setPackingDone(true);
      toast({
        title: "Packing complete! 🎒",
        description: "Don't forget the essentials",
      });
    }
  };

  const handleIpadChange = async (checked: boolean) => {
    setHasIpad(checked);
    // Update Notion/DB with iPad status
    await updateIpadStatus(checked);
  };

  const handleTextLeaderMissing = () => {
    if (!repData?.team_leader_phone) {
      toast({
        title: "No leader phone found",
        description: "Contact your recruiter to get connected with your leader",
        variant: "destructive",
      });
      return;
    }

    const missing: string[] = [];
    if (!hasIpad) missing.push("iPad");
    if (!hasUniforms) missing.push("knocking uniforms");
    if (!hasBadge) missing.push("badge");

    const cleanPhone = repData.team_leader_phone.replace(/\D/g, '');
    const message = encodeURIComponent(
      `I'm getting ready for the blitz but I still need: ${missing.join(", ")}. Can you help me get these?`
    );
    
    window.location.href = `sms:${cleanPhone}?body=${message}`;
  };

  const handleEssentialsChecked = async () => {
    if (!hasIpad || !hasUniforms || !hasBadge) {
      toast({
        title: "Check all essentials first",
        description: "Make sure you have everything before marking complete",
        variant: "destructive",
      });
      return;
    }

    const success = await saveProgress('phase4-essentials-checked');
    if (success) {
      setEssentialsChecked(true);
      toast({
        title: "Essentials ready! ✅",
        description: "You've got everything you need",
      });
    }
  };

  const handlePlaybookReady = async () => {
    const success = await saveProgress('phase4-playbook-ready');
    if (success) {
      setPlaybookReady(true);
      toast({
        title: "You're ready for anything! 💪",
        description: "Time to crush the blitz",
      });
    }
  };

  const completedSteps = [packingDone, essentialsChecked, playbookReady].filter(Boolean).length;
  const allEssentialsHave = hasIpad && hasUniforms && hasBadge;
  const someMissing = !hasIpad || !hasUniforms || !hasBadge;

  return (
    <div className="space-y-5 pb-20">
      {/* Completed Steps as Chips */}
      {completedSteps > 0 && completedSteps < 3 && (
        <div className="flex flex-wrap gap-2">
          {packingDone && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Packed
            </div>
          )}
          {essentialsChecked && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Essentials
            </div>
          )}
          {playbookReady && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Playbook
            </div>
          )}
        </div>
      )}

      {/* Step 1: Packing List */}
      <TrainingSection
        title="Pack Your Bags"
        icon={<PackageCheck className="w-4 h-4" />}
        description="Everything you need for the blitz trip"
        isComplete={packingDone}
        isExpanded={expandedSection === "packing"}
        onToggle={() => setExpandedSection(expandedSection === "packing" ? null : "packing")}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Make sure you have everything packed for the trip:
          </p>
          
          {/* Clothing Section */}
          <div className="space-y-2">
            <h5 className="font-medium text-sm flex items-center gap-2">
              <Shirt className="w-4 h-4 text-primary" />
              Clothing
            </h5>
            <ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc">
              <li>3-5 knocking polos/shirts</li>
              <li>Comfortable pants/shorts (khakis, joggers)</li>
              <li>Comfortable walking shoes</li>
              <li>Socks & underwear for each day</li>
              <li>Light jacket or hoodie (evening)</li>
              <li>Sleepwear</li>
              <li>Casual clothes for downtime</li>
            </ul>
          </div>

          {/* Knocking Gear Section */}
          <div className="space-y-2">
            <h5 className="font-medium text-sm flex items-center gap-2">
              <Tablet className="w-4 h-4 text-primary" />
              Knocking Gear
            </h5>
            <ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc">
              <li>iPad (charged, apps logged in)</li>
              <li>iPad charger & cable</li>
              <li>ID Badge</li>
              <li>Portable battery pack</li>
              <li>Sunglasses</li>
              <li>Hat or cap</li>
              <li>Sunscreen</li>
              <li>Water bottle</li>
            </ul>
          </div>

          {/* Personal Items Section */}
          <div className="space-y-2">
            <h5 className="font-medium text-sm flex items-center gap-2">
              <IdCard className="w-4 h-4 text-primary" />
              Personal Items
            </h5>
            <ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc">
              <li>Phone & charger</li>
              <li>Wallet & ID</li>
              <li>Toiletries (toothbrush, deodorant, etc.)</li>
              <li>Any medications</li>
              <li>Earbuds/headphones</li>
              <li>Snacks for the car/doors</li>
            </ul>
          </div>

          {/* Nice to Have Section */}
          <div className="space-y-2 border-t pt-3">
            <h5 className="font-medium text-sm text-muted-foreground">Nice to Have</h5>
            <ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc">
              <li>Umbrella (just in case)</li>
              <li>Notebook & pen</li>
              <li>Pillow for car rides</li>
              <li>Book or entertainment</li>
            </ul>
          </div>

          {!packingDone && (
            <Button 
              className="w-full mt-3"
              onClick={handlePackingDone}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              I've Packed Everything
            </Button>
          )}
        </div>
      </TrainingSection>

      {/* Step 2: Knocking Essentials */}
      <TrainingSection
        title="Knocking Essentials Check"
        icon={<Tablet className="w-4 h-4" />}
        description="Triple-check your must-haves"
        isComplete={essentialsChecked}
        isLocked={!packingDone}
        isExpanded={expandedSection === "essentials"}
        onToggle={() => setExpandedSection(expandedSection === "essentials" ? null : "essentials")}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Before the blitz, make absolutely sure you have these essentials:
          </p>

          <div className="space-y-3">
            {/* iPad */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Checkbox
                id="ipad"
                checked={hasIpad}
                onCheckedChange={handleIpadChange}
              />
              <div className="flex-1">
                <label htmlFor="ipad" className="flex items-center gap-2 font-medium text-sm cursor-pointer">
                  <Tablet className="w-4 h-4" />
                  iPad (set up and ready)
                </label>
                <p className="text-xs text-muted-foreground mt-1">
                  With Vivint app installed and logged in
                </p>
              </div>
            </div>

            {/* Uniforms */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Checkbox
                id="uniforms"
                checked={hasUniforms}
                onCheckedChange={(checked) => setHasUniforms(checked === true)}
              />
              <div className="flex-1">
                <label htmlFor="uniforms" className="flex items-center gap-2 font-medium text-sm cursor-pointer">
                  <Shirt className="w-4 h-4" />
                  Knocking Uniforms
                </label>
                <p className="text-xs text-muted-foreground mt-1">
                  Professional polo/shirt for door knocking
                </p>
              </div>
            </div>

            {/* Badge */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Checkbox
                id="badge"
                checked={hasBadge}
                onCheckedChange={(checked) => setHasBadge(checked === true)}
              />
              <div className="flex-1">
                <label htmlFor="badge" className="flex items-center gap-2 font-medium text-sm cursor-pointer">
                  <IdCard className="w-4 h-4" />
                  ID Badge
                </label>
                <p className="text-xs text-muted-foreground mt-1">
                  Your official Vivint rep badge
                </p>
              </div>
            </div>
          </div>

          {someMissing && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-destructive">Missing essentials?</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Text your leader to get what you need before the blitz.
                  </p>
                </div>
              </div>
              <Button 
                variant="outline"
                size="sm"
                className="w-full mt-2"
                onClick={handleTextLeaderMissing}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Text Leader About Missing Items
              </Button>
            </div>
          )}

          {allEssentialsHave && !essentialsChecked && (
            <Button 
              className="w-full"
              onClick={handleEssentialsChecked}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              All Essentials Ready
            </Button>
          )}
        </div>
      </TrainingSection>

      {/* Step 3: Playbook for Tough Times */}
      <TrainingSection
        title="When It Gets Tough"
        icon={<Shield className="w-4 h-4" />}
        description="Your playbook for bouncing back"
        isComplete={playbookReady}
        isLocked={!essentialsChecked}
        isExpanded={expandedSection === "playbook"}
        onToggle={() => setExpandedSection(expandedSection === "playbook" ? null : "playbook")}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The blitz will have ups and downs. Plan now for how you'll respond when things get tough, so you bounce back quickly.
          </p>

          {/* Handling Rejection */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <h5 className="font-medium text-sm flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Handling Rejection
            </h5>
            <ul className="text-sm text-muted-foreground space-y-1.5">
              <li>• <strong>It's not personal</strong> - They're rejecting the timing, not you</li>
              <li>• <strong>Numbers game</strong> - Every "no" gets you closer to a "yes"</li>
              <li>• <strong>3-second rule</strong> - Feel it, then move on within 3 seconds</li>
              <li>• <strong>Learn something</strong> - What could you try differently next time?</li>
            </ul>
          </div>

          {/* Slow Days */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <h5 className="font-medium text-sm flex items-center gap-2">
              <Battery className="w-4 h-4 text-primary" />
              Staying Motivated on Slow Days
            </h5>
            <ul className="text-sm text-muted-foreground space-y-1.5">
              <li>• <strong>Focus on activity</strong> - Control the controllables (doors, pitches)</li>
              <li>• <strong>Remember your why</strong> - Why are you doing this?</li>
              <li>• <strong>Find a win</strong> - Celebrate small victories (great pitch, good convo)</li>
              <li>• <strong>Change something</strong> - New area, different approach, fresh energy</li>
            </ul>
          </div>

          {/* Mental Reset */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <h5 className="font-medium text-sm flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-primary" />
              Quick Mental Reset
            </h5>
            <ul className="text-sm text-muted-foreground space-y-1.5">
              <li>• <strong>5 deep breaths</strong> - Reset your nervous system</li>
              <li>• <strong>Power pose</strong> - Stand tall, shoulders back for 30 seconds</li>
              <li>• <strong>Gratitude check</strong> - Name 3 things you're grateful for</li>
              <li>• <strong>Call a teammate</strong> - Quick pep talk goes a long way</li>
            </ul>
          </div>

          {/* Push Through vs Break */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <h5 className="font-medium text-sm flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" />
              Push Through vs. Take a Break
            </h5>
            <div className="text-sm text-muted-foreground space-y-2">
              <p><strong>Push through when:</strong></p>
              <ul className="ml-4 space-y-1">
                <li>• You're just having a slow streak (numbers will turn)</li>
                <li>• You haven't hit your daily activity goal yet</li>
                <li>• You're feeling lazy, not exhausted</li>
              </ul>
              <p className="mt-2"><strong>Take a break when:</strong></p>
              <ul className="ml-4 space-y-1">
                <li>• You're physically exhausted or dehydrated</li>
                <li>• Your pitch quality is suffering</li>
                <li>• You need food/water to perform</li>
              </ul>
            </div>
          </div>

          {/* Encouragement */}
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Heart className="w-4 h-4 text-primary mt-0.5" />
              <div>
                <p className="text-sm font-medium text-primary">Remember</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Every successful rep has bad days. What separates them is how quickly they bounce back. You've got this!
                </p>
              </div>
            </div>
          </div>

          {!playbookReady && (
            <Button 
              className="w-full"
              onClick={handlePlaybookReady}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              I'm Ready for Anything
            </Button>
          )}
        </div>
      </TrainingSection>

      {/* Completion Celebration */}
      {isComplete && (
        <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-6 text-center">
            <div className="text-4xl mb-3">🎉</div>
            <h3 className="text-lg font-bold mb-2">You're Blitz Ready!</h3>
            <p className="text-sm text-muted-foreground">
              You've completed all preparation phases. Time to go crush it!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

interface TrainingSectionProps {
  title: string;
  icon: React.ReactNode;
  description: string;
  isComplete: boolean;
  isLocked?: boolean;
  requiresLeader?: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const TrainingSection = ({
  title,
  icon,
  description,
  isComplete,
  isLocked,
  requiresLeader,
  isExpanded,
  onToggle,
  children,
}: TrainingSectionProps) => {
  return (
    <Card className={cn(
      "transition-all duration-200 overflow-hidden",
      isComplete && "bg-primary/5 border-primary/20",
      isLocked && "opacity-50"
    )}>
      <Collapsible open={isExpanded && !isLocked} onOpenChange={isLocked ? undefined : onToggle}>
        <CollapsibleTrigger asChild disabled={isLocked}>
          <CardContent className={cn("p-4", !isLocked && "cursor-pointer")}>
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                {isComplete ? (
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground/50" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-primary">{icon}</span>
                  <h4 className={cn(
                    "font-medium text-sm",
                    isComplete && "text-muted-foreground"
                  )}>
                    {title}
                  </h4>
                </div>
                <p className="text-xs text-muted-foreground">
                  {isLocked ? "Complete previous step to unlock" : description}
                </p>
                {requiresLeader && !isLocked && (
                  <Badge variant="outline" className="mt-2 text-xs">
                    Requires leader
                  </Badge>
                )}
              </div>
              {!isLocked && (
                <div className="shrink-0">
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-0 border-t">
            <div className="pt-4">
              {children}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
