import { useState, useEffect, useMemo, useRef } from "react";
import { CheckCircle2, Circle, Tablet, MessageSquare, ChevronDown, ChevronUp, Heart, Users, Download, LogIn, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useRampProgress } from "@/hooks/useRampProgress";
import type { RepData } from "@/hooks/useRepData";

// Detect if running as PWA on iPhone
const useIsIPhonePWA = () => {
  return useMemo(() => {
    if (typeof window === 'undefined') return false;
    const userAgent = navigator.userAgent || '';
    const isIPhone = /iPhone/i.test(userAgent);
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                  (window.navigator as any).standalone === true;
    return isIPhone && isPWA;
  }, []);
};

const IPAD_SETUP_STEPS = [
  'phase3-ipad-step1',
  'phase3-ipad-step2',
  'phase3-ipad-step3',
  'phase3-ipad-step4',
] as const;

const STREET_GENIE_VIDEOS = [
  { id: 'phase3-sg-current-area', title: "Current Area", url: "https://dthvivinttraining.conveyour.com/ui/portal/course/660d857a0866a207c10fbd89/lesson/660d8816ae62a2b0187a218b" },
  { id: 'phase3-sg-building-packages', title: "Building Packages", url: "https://dthvivinttraining.conveyour.com/ui/portal/course/660d857a0866a207c10fbd89/lesson/660d88dbae62a2b30c7ecf47" },
  { id: 'phase3-sg-sales-tools', title: "Sales Tools", url: "https://dthvivinttraining.conveyour.com/ui/portal/course/660d857a0866a207c10fbd89/lesson/660d895d3c63a20e0b39a949" },
  { id: 'phase3-sg-prequalification', title: "Prequalification", url: "https://dthvivinttraining.conveyour.com/ui/portal/course/660d857a0866a207c10fbd89/lesson/660d89d00866a2156d333117" },
  { id: 'phase3-sg-emergency-contacts', title: "Emergency Contacts & Passwords", url: "https://dthvivinttraining.conveyour.com/ui/portal/course/660d857a0866a207c10fbd89/lesson/660d8a330866a217ce67a982" },
  { id: 'phase3-sg-send-docs', title: "Send Docs and Schedule Install", url: "https://dthvivinttraining.conveyour.com/ui/portal/course/660d857a0866a207c10fbd89/lesson/660d8a8fae62a2b7cc7691c8" },
  { id: 'phase3-sg-solar-leads', title: "Setting Solar Leads", url: "https://dthvivinttraining.conveyour.com/ui/portal/course/660d857a0866a207c10fbd89/lesson/660d8aa6ae62a2b7cc7691cc" },
  { id: 'phase3-sg-summary-tab', title: "Summary Tab", url: "https://dthvivinttraining.conveyour.com/ui/portal/course/660d857a0866a207c10fbd89/lesson/660d8b51ae62a2ba241bd93e" },
  { id: 'phase3-sg-extra-options', title: "Extra Options", url: "https://dthvivinttraining.conveyour.com/ui/portal/course/660d857a0866a207c10fbd89/lesson/660d8b8e3c63a2160331f6d6" },
] as const;

interface Phase3ContentProps {
  repData: RepData | null;
  isComplete: boolean;
  scrollToStepKey?: string | null;
  onScrollComplete?: () => void;
}

export const Phase3Content = ({ repData, isComplete, scrollToStepKey, onScrollComplete }: Phase3ContentProps) => {
  const [expandedSection, setExpandedSection] = useState<string | null>("ipad");
  const [ipadReady, setIpadReady] = useState(false);
  const [whyWritten, setWhyWritten] = useState(false);
  const [practiceScheduled, setPracticeScheduled] = useState(false);
  const [ipadStepsChecked, setIpadStepsChecked] = useState<Record<string, boolean>>({});
  const [streetGenieVideosWatched, setStreetGenieVideosWatched] = useState<Record<string, boolean>>({});

  // Refs for scrolling
  const ipadRef = useRef<HTMLDivElement>(null);
  const whyRef = useRef<HTMLDivElement>(null);
  const practiceRef = useRef<HTMLDivElement>(null);

  const { saveProgress } = useRampProgress(repData?.user_id);

  // Handle scroll to step
  useEffect(() => {
    if (!scrollToStepKey) return;

    const scrollAndExpand = () => {
      switch (scrollToStepKey) {
        case 'ipad':
          setExpandedSection('ipad');
          ipadRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          break;
        case 'why':
          setExpandedSection('why');
          whyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          break;
        case 'practice':
          setExpandedSection('practice');
          practiceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          break;
      }
      onScrollComplete?.();
    };

    setTimeout(scrollAndExpand, 150);
  }, [scrollToStepKey, onScrollComplete]);

  // Load progress from watched_videos
  useEffect(() => {
    if (repData?.watched_videos && Array.isArray(repData.watched_videos)) {
      const watched = repData.watched_videos as string[];
      setIpadReady(watched.includes('phase3-ipad-ready'));
      setWhyWritten(watched.includes('phase3-why-written'));
      setPracticeScheduled(watched.includes('phase3-practice-scheduled'));
      
      // Load iPad setup step progress
      const stepsChecked: Record<string, boolean> = {};
      IPAD_SETUP_STEPS.forEach(step => {
        stepsChecked[step] = watched.includes(step);
      });
      setIpadStepsChecked(stepsChecked);

      // Load Street Genie video progress
      const sgWatched: Record<string, boolean> = {};
      STREET_GENIE_VIDEOS.forEach(video => {
        sgWatched[video.id] = watched.includes(video.id);
      });
      setStreetGenieVideosWatched(sgWatched);
    }
  }, [repData?.watched_videos]);

  const handleToggleIpadStep = async (stepId: string) => {
    const isCurrentlyChecked = ipadStepsChecked[stepId];
    
    if (!isCurrentlyChecked) {
      const success = await saveProgress(stepId);
      if (success) {
        setIpadStepsChecked(prev => ({ ...prev, [stepId]: true }));
      }
    }
  };

  const allIpadStepsComplete = IPAD_SETUP_STEPS.every(step => ipadStepsChecked[step]);

  const handleToggleStreetGenieVideo = async (videoId: string) => {
    const isCurrentlyWatched = streetGenieVideosWatched[videoId];
    
    if (!isCurrentlyWatched) {
      const success = await saveProgress(videoId);
      if (success) {
        setStreetGenieVideosWatched(prev => ({ ...prev, [videoId]: true }));
      }
    }
  };

  const streetGenieWatchedCount = Object.values(streetGenieVideosWatched).filter(Boolean).length;

  const handleIpadReady = async () => {
    const success = await saveProgress('phase3-ipad-ready');
    if (success) {
      setIpadReady(true);
      toast({
        title: "iPad ready! ✅",
        description: "You're set up with the tools to sell",
      });
    }
  };

  const handleTextLeaderWhy = () => {
    if (!repData?.team_leader_phone) {
      toast({
        title: "No leader phone found",
        description: "Contact your recruiter to get connected with your leader",
        variant: "destructive",
      });
      return;
    }

    const cleanPhone = repData.team_leader_phone.replace(/\D/g, '');
    const message = encodeURIComponent(
      "Here's why I'm going on the blitz and what I want to learn:\n\n[Write your why here - what skills do you want to develop? What do you want to LEARN (not earn)?]"
    );
    
    window.location.href = `sms:${cleanPhone}?body=${message}`;
  };

  const handleWhyWritten = async () => {
    const success = await saveProgress('phase3-why-written');
    if (success) {
      setWhyWritten(true);
      toast({
        title: "Your 'Why' is locked in! 💪",
        description: "Remember this when times get tough",
      });
    }
  };

  const handleTextLeaderPractice = () => {
    if (!repData?.team_leader_phone) {
      toast({
        title: "No leader phone found",
        description: "Contact your recruiter to get connected with your leader",
        variant: "destructive",
      });
      return;
    }

    const cleanPhone = repData.team_leader_phone.replace(/\D/g, '');
    const message = encodeURIComponent(
      "I'm ready to do a 1-on-1 pitch practice session. Can we schedule a time, or could you connect me with a vet on the team to practice with?"
    );
    
    window.location.href = `sms:${cleanPhone}?body=${message}`;
  };

  const handlePracticeScheduled = async () => {
    const success = await saveProgress('phase3-practice-scheduled');
    if (success) {
      setPracticeScheduled(true);
      toast({
        title: "Practice complete! 🎯",
        description: "You're ready for the blitz",
      });
    }
  };

  const isIPhonePWA = useIsIPhonePWA();

  const completedSteps = [ipadReady, whyWritten, practiceScheduled].filter(Boolean).length;

  return (
    <div className="space-y-5 pb-20">
      {/* Completed Steps as Chips */}
      {completedSteps > 0 && completedSteps < 3 && (
        <div className="flex flex-wrap gap-2">
          {ipadReady && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              iPad ready
            </div>
          )}
          {whyWritten && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Why written
            </div>
          )}
          {practiceScheduled && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Practice done
            </div>
          )}
        </div>
      )}

      {/* Step 1: iPad Setup */}
      <div ref={ipadRef} />
      <TrainingSection
        title="Get Your iPad Ready"
        icon={<Tablet className="w-4 h-4" />}
        description="Learn the tools you'll use to sell"
        isComplete={ipadReady}
        isExpanded={expandedSection === "ipad"}
        onToggle={() => setExpandedSection(expandedSection === "ipad" ? null : "ipad")}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Get your iPad set up with the apps and tools you'll use on the doors.
          </p>
          
          {/* iPad Setup Guide - In App */}
          <div className="space-y-4">
            {/* Step 1: Get Your iPad */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="flex items-start gap-3">
                <Checkbox 
                  id="ipad-step1"
                  checked={ipadStepsChecked['phase3-ipad-step1'] || false}
                  onCheckedChange={() => handleToggleIpadStep('phase3-ipad-step1')}
                  className="mt-0.5"
                />
                <label htmlFor="ipad-step1" className="flex-1 cursor-pointer">
                  <h5 className="font-medium text-sm flex items-center gap-2">
                    <Tablet className="w-4 h-4 text-primary" />
                    1. Get Your iPad
                  </h5>
                  <p className="text-sm text-muted-foreground mt-1">
                    If you don't have an iPad yet, text your leader to get one assigned. Make sure it's charged and ready.
                  </p>
                </label>
              </div>
            </div>

            {/* Step 2: Install Required Apps */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="flex items-start gap-3">
                <Checkbox 
                  id="ipad-step2"
                  checked={ipadStepsChecked['phase3-ipad-step2'] || false}
                  onCheckedChange={() => handleToggleIpadStep('phase3-ipad-step2')}
                  className="mt-0.5"
                />
                <label htmlFor="ipad-step2" className="flex-1 cursor-pointer">
                  <h5 className="font-medium text-sm flex items-center gap-2">
                    <Download className="w-4 h-4 text-primary" />
                    2. Install Required Apps
                  </h5>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc mt-1">
                    <li><strong>Vivint Sales App</strong> - Main selling tool</li>
                    <li><strong>Street Genie</strong> - Prospecting & lead lookup</li>
                    <li><strong>Google Maps</strong> - Navigation</li>
                    <li><strong>Kaizen</strong> - This app (add to home screen)</li>
                  </ul>
                </label>
              </div>
            </div>

            {/* Step 3: Log Into Everything */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="flex items-start gap-3">
                <Checkbox 
                  id="ipad-step3"
                  checked={ipadStepsChecked['phase3-ipad-step3'] || false}
                  onCheckedChange={() => handleToggleIpadStep('phase3-ipad-step3')}
                  className="mt-0.5"
                />
                <label htmlFor="ipad-step3" className="flex-1 cursor-pointer">
                  <h5 className="font-medium text-sm flex items-center gap-2">
                    <LogIn className="w-4 h-4 text-primary" />
                    3. Log Into Everything
                  </h5>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc mt-1">
                    <li>Sign into Vivint Sales App with your rep credentials</li>
                    <li>Sign into Street Genie (ask leader for login)</li>
                    <li>Make sure Google Maps has your account</li>
                  </ul>
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    Test each app before the blitz to make sure everything works!
                  </p>
                </label>
              </div>
            </div>

            {/* Step 4: Set Up Your Workspace */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="flex items-start gap-3">
                <Checkbox 
                  id="ipad-step4"
                  checked={ipadStepsChecked['phase3-ipad-step4'] || false}
                  onCheckedChange={() => handleToggleIpadStep('phase3-ipad-step4')}
                  className="mt-0.5"
                />
                <label htmlFor="ipad-step4" className="flex-1 cursor-pointer">
                  <h5 className="font-medium text-sm flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    4. Set Up Your Workspace
                  </h5>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc mt-1">
                    <li>Enable location services for all sales apps</li>
                    <li>Turn on Do Not Disturb during knocking hours</li>
                    <li>Keep brightness at 50%+ (easier to see outdoors)</li>
                    <li>Charge to 100% before each knocking block</li>
                  </ul>
                </label>
              </div>
            </div>
          </div>

          {/* Progress indicator */}
          {!ipadReady && (
            <div className="text-xs text-muted-foreground text-center">
              {Object.values(ipadStepsChecked).filter(Boolean).length}/4 steps completed
            </div>
          )}

          {/* Bonus Videos - Embedded */}
          <div className="border-t pt-3 mt-3">
            <p className="text-xs text-muted-foreground mb-3 font-medium">Bonus Videos (Optional)</p>
            <div className="space-y-4">
              {/* Street Genie Video */}
              <div className="space-y-2">
                <p className="text-sm font-medium">How to use Street Genie to prospect</p>
                <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                  <iframe
                    width="100%"
                    height="100%"
                    src="https://www.youtube.com/embed/ig_9Pvg1SqE"
                    title="How to use Street Genie to prospect"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="border-0"
                  />
                </div>
              </div>

              {/* iOS Work Mode Video - Only show on iPhone PWA */}
              {isIPhonePWA && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">iOS Work Mode Setup</p>
                    <Badge variant="outline" className="text-xs">iOS</Badge>
                  </div>
                  <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                    <iframe
                      width="100%"
                      height="100%"
                      src="https://www.youtube.com/embed/KLu5xYUkMwo"
                      title="iOS Work Mode Setup"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="border-0"
                    />
                  </div>
                </div>
              )}

              {/* Street Genie Walkthrough Videos - Collapsible with Checkboxes */}
              <Collapsible>
                <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-sm">
                  <div className="flex flex-col items-start gap-0.5">
                    <span className="font-medium">Street Genie Deep Dive</span>
                    <span className="text-xs text-muted-foreground">
                      {streetGenieWatchedCount}/{STREET_GENIE_VIDEOS.length} optional videos watched
                    </span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2 space-y-2">
                  {STREET_GENIE_VIDEOS.map((video) => (
                    <div
                      key={video.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 text-sm"
                    >
                      <Checkbox
                        id={video.id}
                        checked={streetGenieVideosWatched[video.id] || false}
                        onCheckedChange={() => handleToggleStreetGenieVideo(video.id)}
                        className="flex-shrink-0"
                      />
                      <a
                        href={video.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 hover:text-primary transition-colors"
                      >
                        {video.title}
                      </a>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            </div>
          </div>

          {!ipadReady && (
            <Button 
              className="w-full mt-3"
              onClick={handleIpadReady}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              My iPad is Ready
            </Button>
          )}
        </div>
      </TrainingSection>

      {/* Step 2: Write Your Why */}
      <div ref={whyRef} />
      <TrainingSection
        title="Write Your Why"
        icon={<Heart className="w-4 h-4" />}
        description="Define your purpose for the blitz"
        isComplete={whyWritten}
        isLocked={!ipadReady}
        requiresLeader
        isExpanded={expandedSection === "why"}
        onToggle={() => setExpandedSection(expandedSection === "why" ? null : "why")}
      >
        <div className="space-y-3">
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <h5 className="font-medium text-sm">Think about:</h5>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>Why are you going on this blitz?</li>
              <li>What skills do you want to develop?</li>
              <li>What do you want to <strong>LEARN</strong> (not earn)?</li>
            </ul>
          </div>
          
          <p className="text-sm text-muted-foreground">
            Write down your "why" and send it to your leader. This will anchor you when things get tough.
          </p>

          <Button 
            className="w-full"
            onClick={handleTextLeaderWhy}
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Text My "Why" to Leader
          </Button>

          {!whyWritten && (
            <Button 
              variant="outline"
              className="w-full"
              onClick={handleWhyWritten}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              I've Sent My "Why"
            </Button>
          )}
        </div>
      </TrainingSection>

      {/* Step 3: 1-on-1 Practice */}
      <div ref={practiceRef} />
      <TrainingSection
        title="1-on-1 Pitch Practice"
        icon={<Users className="w-4 h-4" />}
        description="Practice with a vet before blitz"
        isComplete={practiceScheduled}
        isLocked={!whyWritten}
        requiresLeader
        isExpanded={expandedSection === "practice"}
        onToggle={() => setExpandedSection(expandedSection === "practice" ? null : "practice")}
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Schedule a 1-on-1 pitch practice session with your leader or another vet on the team. This hands-on practice is crucial for building confidence.
          </p>

          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <h5 className="font-medium text-sm">What to practice:</h5>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>Fresh door approach and pitch</li>
              <li>Handling common objections</li>
              <li>Transition to close</li>
            </ul>
          </div>

          <Button 
            className="w-full"
            onClick={handleTextLeaderPractice}
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Text Leader to Schedule Practice
          </Button>

          {!practiceScheduled && (
            <Button 
              variant="outline"
              className="w-full"
              onClick={handlePracticeScheduled}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              I've Done My 1-on-1 Practice
            </Button>
          )}
          
          <p className="text-xs text-muted-foreground text-center">
            Mark complete after you've practiced with a vet or leader
          </p>
        </div>
      </TrainingSection>
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
