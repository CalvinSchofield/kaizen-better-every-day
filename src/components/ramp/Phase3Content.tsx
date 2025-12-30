import { useState, useEffect, useMemo, useRef } from "react";
import { CheckCircle2, Tablet, MessageSquare, ChevronDown, ChevronUp, Heart, Users, MapPin, ExternalLink, Smartphone, Image, StickyNote, Lightbulb, Play, Video, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useRampProgress } from "@/hooks/useRampProgress";
import type { RepData } from "@/hooks/useRepData";
import { TrainingSection } from "./TrainingSection";
import { PhaseCompleteCard } from "./PhaseCompleteCard";

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

const IPAD_APPS = [
  { id: 'phase3-app-street-genie', key: 'street-genie' },
  { id: 'phase3-app-tiled', key: 'tiled' },
  { id: 'phase3-app-photos', key: 'photos' },
  { id: 'phase3-app-vivint', key: 'vivint' },
  { id: 'phase3-app-kaizen', key: 'kaizen' },
  { id: 'phase3-app-notes', key: 'notes' },
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

const CAMERA_VIDEOS = [
  { id: 'camera-video-1', name: 'Intruder Detection 1', url: '/videos/camera-action-3.mov' },
  { id: 'camera-video-2', name: 'Intruder Detection 2', url: '/videos/camera-action-4.mov' },
  { id: 'camera-video-3', name: 'ADT vs Vivint Comparison', url: '/videos/camera-action-5.mov' },
  { id: 'camera-video-4', name: 'Camera Alert Example', url: '/videos/camera-action-6.mov' },
  { id: 'camera-image-1', name: 'ADT Signs (Trunk Photo)', url: '/images/adt-signs-trunk-2.jpeg' },
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
      
      // Load iPad app progress
      const stepsChecked: Record<string, boolean> = {};
      IPAD_APPS.forEach(app => {
        stepsChecked[app.id] = watched.includes(app.id);
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

  const allIpadAppsComplete = IPAD_APPS.every(app => ipadStepsChecked[app.id]);

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

  // All steps done, waiting on leader to verify
  const allStepsDoneWaitingLeader = ipadReady && whyWritten && practiceScheduled && !isComplete;

  return (
    <div className="space-y-5 pb-20">
      {/* Phase Complete - Waiting on Leader */}
      {allStepsDoneWaitingLeader && (
        <PhaseCompleteCard
          phaseNumber={3}
          teamLeaderPhone={repData?.team_leader_phone}
          teamLeaderName={repData?.team_leader}
        />
      )}

      {/* Completed Steps as Chips */}
      {completedSteps > 0 && completedSteps < 3 && !allStepsDoneWaitingLeader && (
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
        title="iPad Tools"
        icon={<Tablet className="w-4 h-4" />}
        description="The basic apps you'll use most"
        isComplete={ipadReady}
        isExpanded={expandedSection === "ipad"}
        onToggle={() => setExpandedSection(expandedSection === "ipad" ? null : "ipad")}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Master these tools before you knock your first door.
          </p>
          
          {/* App List */}
          <div className="space-y-3">
            {/* 1. Street Genie */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="flex items-start gap-3">
                <Checkbox 
                  id="app-street-genie"
                  checked={ipadStepsChecked['phase3-app-street-genie'] || false}
                  onCheckedChange={() => handleToggleIpadStep('phase3-app-street-genie')}
                  className="mt-0.5"
                />
                <label htmlFor="app-street-genie" className="flex-1 cursor-pointer">
                  <h5 className="font-medium text-sm flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    1. Street Genie
                  </h5>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your main selling app! Use it to find prospects, track which homes you've knocked and how each conversation went, and build packages to send sign-up documents. <strong>Mastering this tool is essential.</strong>
                  </p>
                </label>
              </div>

              {/* Street Genie Videos - Collapsible */}
              <Collapsible className="mt-3 ml-6">
                <CollapsibleTrigger className="flex items-center gap-2 text-primary text-sm hover:underline">
                  <Video className="w-3 h-3" />
                  <span>Street Genie Training Videos</span>
                  <ChevronDown className="w-3 h-3 transition-transform [[data-state=open]>&]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3 space-y-4" onClick={(e) => e.stopPropagation()}>
                  {/* Essential Video */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-primary text-primary-foreground text-xs">MUST WATCH</Badge>
                      <span className="text-sm font-medium">How to use Street Genie to prospect</span>
                    </div>
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

                  {/* Deep Dive Videos - Nested Collapsible */}
                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors text-sm">
                      <div className="flex flex-col items-start gap-0.5">
                        <span className="font-medium">➕ BONUS — Deep Dive Videos</span>
                        <span className="text-xs text-muted-foreground">
                          Highly recommend watching these before getting on the doors yourself ({streetGenieWatchedCount}/{STREET_GENIE_VIDEOS.length} watched)
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
                </CollapsibleContent>
              </Collapsible>
            </div>

            {/* 2. Tiled */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="flex items-start gap-3">
                <Checkbox 
                  id="app-tiled"
                  checked={ipadStepsChecked['phase3-app-tiled'] || false}
                  onCheckedChange={() => handleToggleIpadStep('phase3-app-tiled')}
                  className="mt-0.5"
                />
                <label htmlFor="app-tiled" className="flex-1 cursor-pointer">
                  <h5 className="font-medium text-sm flex items-center gap-2">
                    <Play className="w-4 h-4 text-primary" />
                    2. Tiled
                  </h5>
                  <p className="text-sm text-muted-foreground mt-1">
                    The go-to sales tool for demonstrating the product on the door and in the home. Created by Sr. Regional Josh Gruwell and now used company-wide.
                  </p>
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    To sign in: Click "sign in with Okta" → type "vivint.com" for the URL → use your regular login
                  </p>
                </label>
              </div>
            </div>

            {/* Pro Tip */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Lightbulb className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-400">Want to be a pro by the time you knock your first door?</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Spend 15–20 minutes clicking through the Tiled app. Get familiar with the videos and how they can help you sell. When you show up for the blitz, it will be obvious whether you know this app or not.
                  </p>
                </div>
              </div>
            </div>

            {/* 3. Photos */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="flex items-start gap-3">
                <Checkbox 
                  id="app-photos"
                  checked={ipadStepsChecked['phase3-app-photos'] || false}
                  onCheckedChange={() => handleToggleIpadStep('phase3-app-photos')}
                  className="mt-0.5"
                />
                <label htmlFor="app-photos" className="flex-1 cursor-pointer">
                  <h5 className="font-medium text-sm flex items-center gap-2">
                    <Image className="w-4 h-4 text-primary" />
                    3. Photos
                  </h5>
                  <p className="text-sm text-muted-foreground mt-1">
                    Show real footage from our cameras that has scared off intruders! This builds a lot of value.
                  </p>
                  
                  {/* Bonus - Camera Videos */}
                  <Collapsible className="mt-2">
                    <CollapsibleTrigger className="flex items-center gap-2 text-primary text-sm hover:underline">
                      <Video className="w-3 h-3" />
                      <span>➕ BONUS — real examples of our cameras in action</span>
                      <ChevronDown className="w-3 h-3 transition-transform [[data-state=open]>&]:rotate-180" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
                      <p className="text-xs text-muted-foreground">
                        Download these videos to show customers:
                      </p>
                      <div className="space-y-2">
                        {CAMERA_VIDEOS.map((video) => (
                          <a
                            key={video.id}
                            href={video.url}
                            download
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 text-sm hover:bg-primary/20 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Download className="w-4 h-4 text-primary" />
                            <span>{video.name}</span>
                          </a>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </label>
              </div>
            </div>

            {/* 4. Vivint App */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="flex items-start gap-3">
                <Checkbox 
                  id="app-vivint"
                  checked={ipadStepsChecked['phase3-app-vivint'] || false}
                  onCheckedChange={() => handleToggleIpadStep('phase3-app-vivint')}
                  className="mt-0.5"
                />
                <label htmlFor="app-vivint" className="flex-1 cursor-pointer">
                  <h5 className="font-medium text-sm flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-primary" />
                    4. Vivint App (on your phone)
                  </h5>
                  <p className="text-sm text-muted-foreground mt-1">
                    Download the Vivint app and sign in using <strong>"Demo Mode"</strong> on your phone. Get familiar with how it works and looks — you will be teaching customers how to use it.
                  </p>
                  <a 
                    href="https://apps.apple.com/app/id734547946"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary text-sm mt-2 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    🔗 Download Vivint App
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </label>
              </div>
            </div>

            {/* 5. Kaizen App */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="flex items-start gap-3">
                <Checkbox 
                  id="app-kaizen"
                  checked={ipadStepsChecked['phase3-app-kaizen'] || false}
                  onCheckedChange={() => handleToggleIpadStep('phase3-app-kaizen')}
                  className="mt-0.5"
                />
                <label htmlFor="app-kaizen" className="flex-1 cursor-pointer">
                  <h5 className="font-medium text-sm flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    5. Kaizen App (the one you're using!)
                  </h5>
                  <p className="text-sm text-muted-foreground mt-1">
                    Make sure to add it as an app on your phone for easy access! Once you start knocking you can use this app to track your daily progress. <strong>Tracking takes the emotion out of the job</strong> — when you're having a rough day, you'll know that statistically, a sale is just around the corner.
                  </p>
                </label>
              </div>
            </div>

            {/* 6. Notes */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="flex items-start gap-3">
                <Checkbox 
                  id="app-notes"
                  checked={ipadStepsChecked['phase3-app-notes'] || false}
                  onCheckedChange={() => handleToggleIpadStep('phase3-app-notes')}
                  className="mt-0.5"
                />
                <label htmlFor="app-notes" className="flex-1 cursor-pointer">
                  <h5 className="font-medium text-sm flex items-center gap-2">
                    <StickyNote className="w-4 h-4 text-primary" />
                    6. Notes
                  </h5>
                  <p className="text-sm text-muted-foreground mt-1">
                    Used to write out the quote quickly and efficiently so you can sell with clarity and simplicity on the iPad.
                  </p>
                </label>
              </div>
            </div>
          </div>

          {/* Progress indicator */}
          {!ipadReady && (
            <div className="text-xs text-muted-foreground text-center">
              {Object.values(ipadStepsChecked).filter(Boolean).length}/{IPAD_APPS.length} apps checked
            </div>
          )}

          {/* iOS Work Mode Video - Only show on iPhone PWA */}
          {isIPhonePWA && (
            <div className="border-t pt-3 mt-3">
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
            </div>
          )}

          {!ipadReady && (
            <Button 
              className="w-full mt-3"
              onClick={handleIpadReady}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              I've Reviewed All the Apps
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
        isComplete={whyWritten || isComplete}
        isLocked={!ipadReady && !isComplete}
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
        isComplete={practiceScheduled || isComplete}
        isLocked={!whyWritten && !isComplete}
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
