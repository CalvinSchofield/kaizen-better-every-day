import { useState, useEffect } from "react";
import { CheckCircle2, Circle, PackageCheck, Tablet, Shirt, IdCard, MessageSquare, ExternalLink, ChevronDown, ChevronUp, Shield, AlertTriangle } from "lucide-react";
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
    <div className="space-y-6 pb-20">
      {/* Phase Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold">Saddle Up!</h3>
          <p className="text-sm text-muted-foreground">
            Final preparations for your blitz
          </p>
        </div>
        {isComplete ? (
          <Badge className="bg-primary/10 text-primary border-primary/20">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Complete
          </Badge>
        ) : (
          <Badge variant="outline">
            {completedSteps}/3 done
          </Badge>
        )}
      </div>

      {/* Step 1: Packing List */}
      <TrainingSection
        title="Pack Your Bags"
        icon={<PackageCheck className="w-4 h-4" />}
        description="Everything you need for the blitz trip"
        isComplete={packingDone}
        isExpanded={expandedSection === "packing"}
        onToggle={() => setExpandedSection(expandedSection === "packing" ? null : "packing")}
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Review the packing list to make sure you have everything for the trip.
          </p>
          
          <a
            href="https://calvinschofield.notion.site/Packing-List-Blitz-Trips-63bbc6dd1afd4340a9c9ca5533c838b4"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-colors"
          >
            <span className="font-medium text-sm text-primary">View Packing List</span>
            <ExternalLink className="w-4 h-4 text-primary" />
          </a>

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
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            The blitz will have ups and downs. Plan now for how you'll respond when things get tough, so you bounce back quickly.
          </p>

          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <h5 className="font-medium text-sm">This playbook covers:</h5>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>How to handle rejection</li>
              <li>Staying motivated on slow days</li>
              <li>Mental reset techniques</li>
              <li>When to push through vs. take a break</li>
            </ul>
          </div>

          <a
            href="https://calvinschofield.notion.site/When-It-Gets-Tough-Your-Playbook-d6d63908789b4b7587b861bd5b382f71"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-colors"
          >
            <span className="font-medium text-sm text-primary">Read Your Playbook</span>
            <ExternalLink className="w-4 h-4 text-primary" />
          </a>

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
