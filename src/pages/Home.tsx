import { CheckCircle2, Circle, Lock, Loader2, ChevronDown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useRepData } from "@/hooks/useRepData";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import confetti from "canvas-confetti";
import TeamCalendarModal from "@/components/TeamCalendarModal";
interface StepStatus {
  completed: boolean;
  locked: boolean;
  inProgress: boolean;
}
interface JourneyStep {
  id: string;
  title: string;
  description: string;
  status: StepStatus;
  actions: Array<{
    label: string;
    href?: string;
    variant?: "default" | "outline" | "secondary" | "success" | "warning" | "locked";
    onClick?: () => void;
  }>;
}
interface RampTask {
  id: string;
  label: string;
  href?: string;
  duration?: string;
  onClick?: () => void;
}
interface RampPhase {
  id: number;
  title: string;
  tasks: RampTask[];
}
const Home = () => {
  const {
    repData,
    loading,
    refetch
  } = useRepData();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showIntroDialog, setShowIntroDialog] = useState(false);
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [previousProgress, setPreviousProgress] = useState<number>(0);
  const [animateProgress, setAnimateProgress] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Get storage key based on user ID
  const storageKey = useMemo(() => {
    return repData?.id ? `ramp-progress-${repData.id}` : 'ramp-progress-temp';
  }, [repData?.id]);

  // Use localStorage hook for task tracking
  const [completedTasksArray, setCompletedTasksArray] = useLocalStorage<string[]>(storageKey, []);
  
  // Convert array to Set for easier manipulation
  const completedTasks = useMemo(() => new Set(completedTasksArray), [completedTasksArray]);
  
  // Helper to update completed tasks
  const setCompletedTasks = (newSet: Set<string>) => {
    setCompletedTasksArray([...newSet]);
  };

  // Calculate progress values - sequential logic (later steps imply earlier ones are done)
  const phase = repData?.ramp_to_blitz_phase || "Not started";
  const phaseLower = phase.toLowerCase();
  
  // Log for debugging progress
  console.log("Current phase from Notion:", phase);
  console.log("Phase lowercase:", phaseLower);
  
  // Check which phase is marked complete in Notion
  const notionOnboardingComplete = phaseLower.includes("onboarding") && phaseLower.includes("✅");
  const notionTrainingsComplete = phaseLower.includes("training") && phaseLower.includes("✅");
  const notionSlackComplete = phaseLower.includes("slack") && phaseLower.includes("✅");
  const notionPhase1Complete = phaseLower.includes("phase 1") && phaseLower.includes("✅");
  const notionPhase2Complete = phaseLower.includes("phase 2") && phaseLower.includes("✅");
  const notionPhase3Complete = phaseLower.includes("phase 3") && phaseLower.includes("✅");
  const notionPhase4Complete = phaseLower.includes("phase 4") && phaseLower.includes("✅");
  
  // Sequential logic: if a later step is complete, all previous steps must be complete
  const phase4Complete = notionPhase4Complete;
  const phase3Complete = notionPhase3Complete || phase4Complete;
  const phase2Complete = notionPhase2Complete || phase3Complete;
  const phase1Complete = notionPhase1Complete || phase2Complete;
  const slackComplete = notionSlackComplete || phase1Complete;
  const trainingsComplete = notionTrainingsComplete || slackComplete;
  const onboardingComplete = notionOnboardingComplete || trainingsComplete;
  
  const totalSteps = 7;
  const completedSteps = [
    onboardingComplete,
    trainingsComplete,
    slackComplete,
    phase1Complete,
    phase2Complete,
    phase3Complete,
    phase4Complete
  ].filter(Boolean).length;
  const progressPercentage = (completedSteps / totalSteps) * 100;

  // Log progress calculation
  console.log("Progress:", {
    onboardingComplete,
    trainingsComplete,
    slackComplete,
    phase1Complete,
    phase2Complete,
    phase3Complete,
    phase4Complete,
    completedSteps,
    totalSteps,
    progressPercentage
  });

  // Auto-complete tasks when phase is marked complete in Notion
  useEffect(() => {
    if (!repData?.id) return;
    
    const newCompleted = new Set(completedTasks);
    let hasChanges = false;
    
    // Auto-complete all tasks in completed phases
    rampPhases.forEach((phase) => {
      const phaseStatus = getPhaseStatus(phase.id);
      if (phaseStatus.completed) {
        phase.tasks.forEach((task) => {
          if (!newCompleted.has(task.id)) {
            newCompleted.add(task.id);
            hasChanges = true;
          }
        });
      }
    });
    
    if (hasChanges) {
      setCompletedTasks(newCompleted);
    }
  }, [phase1Complete, phase2Complete, phase3Complete, phase4Complete, repData?.id]);

  // Track progress changes and trigger celebrations (only when moving forward)
  useEffect(() => {
    // Only celebrate when moving forward AND not on initial load
    if (completedSteps > previousProgress && previousProgress > 0) {
      setAnimateProgress(true);
      
      // Trigger haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]); // Double vibration pattern
      }
      
      // Trigger confetti only when progressing forward
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FF6B35', '#F7931E', '#FDC830', '#4CAF50']
      });
      
      const stepNames = [
        "Onboarding",
        "Trainings",
        "Slack Introduction",
        "Phase 1: Set Goals",
        "Phase 2: Start Trainings",
        "Phase 3: Practice",
        "Phase 4: Saddle Up!"
      ];
      
      toast({
        title: "🎉 Step Complete!",
        description: `Great job completing ${stepNames[completedSteps - 1]}! Keep going!`,
        duration: 4000,
      });

      setTimeout(() => setAnimateProgress(false), 1000);
    }
    
    // Always update previous progress to track changes in both directions
    if (previousProgress !== completedSteps) {
      setPreviousProgress(completedSteps);
    }
  }, [completedSteps, previousProgress, toast]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const confirmLogout = () => {
    setLogoutDialogOpen(false);
    handleLogout();
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await refetch();
      toast({
        title: "✓ Synced",
        description: "Your progress has been updated from Notion.",
        duration: 2000,
      });
    } catch (error) {
      toast({
        title: "Sync failed",
        description: "Could not sync your data. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsSyncing(false);
    }
  };
  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>;
  }
  
  // Helper to check phase status - case-insensitive matching
  const isInRampPhases = phase1Complete || phase2Complete || phase3Complete || phase4Complete || slackComplete;
  const allRampPhasesComplete = phase4Complete;
  const steps: JourneyStep[] = [{
    id: "onboarding",
    title: "Complete Your Onboarding",
    description: "Get fully onboarded in the system so you can get paid and start training.",
    status: {
      completed: onboardingComplete || trainingsComplete || slackComplete || isInRampPhases,
      locked: false,
      inProgress: phaseLower === "not started" && !onboardingComplete
    },
    actions: [{
      label: "Finish Onboarding",
      href: "https://onboardingtool.vivint.com/",
      variant: "default"
    }, {
      label: "Request I-9 Help",
      href: "https://forms.gle/rCssbYULxJ673nfP8",
      variant: "outline"
    }]
  }, {
    id: "trainings",
    title: "Complete Required Vivint Trainings",
    description: "Finish the mandatory Vivint modules and quizzes so you're cleared to sell.",
    status: {
      completed: trainingsComplete || slackComplete || isInRampPhases,
      locked: !(onboardingComplete || trainingsComplete || slackComplete || isInRampPhases),
      inProgress: onboardingComplete && !trainingsComplete && !slackComplete && !isInRampPhases
    },
    actions: [{
      label: "Open Training Portal",
      href: "https://dthvivinttraining.conveyour.com/ui/portal"
    }]
  }, {
    id: "slack",
    title: "Join the Team Slack & Introduce Yourself",
    description: "Join the group and post a quick intro so the team knows who you are.",
    status: {
      completed: slackComplete || isInRampPhases,
      locked: !(trainingsComplete || slackComplete || isInRampPhases),
      inProgress: trainingsComplete && !slackComplete && !isInRampPhases
    },
    actions: [{
      label: "Join Slack",
      href: "https://join.slack.com/t/vivint-chy4678/shared_invite/zt-3g30ikq9e-RugmfMRBUCu4qx5S0GUgZw"
    }, {
      label: "Intro Example",
      variant: "outline",
      onClick: () => setShowIntroDialog(true)
    }]
  }];

  // Define the 4 Ramp to Blitz phases
  const rampPhases: RampPhase[] = [{
    id: 1,
    title: "Phase 1: Set Goals",
    tasks: [{
      id: "phase1-blitz-video",
      label: "Watch: What is a blitz and how do you get paid?",
      href: "https://calvinschofield.notion.site/What-the-blitz-is-and-how-you-get-paid-c74c25ffd00747e4a345c08160d727e6",
      duration: "5 mins"
    }, {
      id: "phase1-goals-call",
      label: "Text leaders to schedule a Goals & Gameplan call",
      href: "https://www.notion.so/Goals-Gameplan-290070fe3bc280daa182cc832ef1a35d",
      duration: "30 mins"
    }, {
      id: "phase1-calendar",
      label: "Add the Vivint calendar to your phone and make plans to attend your first blitz",
      onClick: () => setCalendarModalOpen(true)
    }]
  }, {
    id: 2,
    title: "Phase 2: Start Trainings",
    tasks: [{
      id: "phase2-product-basics",
      label: "Learn Product basics - How to sound like you've been selling for years",
      href: "https://www.notion.so/Product-How-to-sound-like-you-ve-been-selling-for-years-in-one-night-2d7f4a89e80d4d4686c40da84f6540b7",
      duration: "30 mins"
    }, {
      id: "phase2-product-quiz",
      label: "Take the Product Quiz",
      href: "https://docs.google.com/forms/d/e/1FAIpQLSc9CiA33lB2VXYz9RAGv1IPp1bjn9ypbZ9xMVa1bJ3huHwhSg/viewform?usp=dialog",
      duration: "5 mins"
    }, {
      id: "phase2-upgrades",
      label: "Study Upgrades 101",
      href: "https://www.notion.so/Upgrades-101-f027467a0a5e405a853abdc26e92401e",
      duration: "30 mins"
    }, {
      id: "phase2-takeover",
      label: "Study the Takeover Door Approach",
      href: "https://www.notion.so/Takeover-Door-Approach-18c070fe3bc2800bad33c0818f0f0489",
      duration: "30 mins"
    }, {
      id: "phase2-pitch-video",
      label: "Send video giving the two pitches to your leaders",
      href: "https://www.notion.so/Pitch-Feedback-Instructions-03901d3e606b4aa29fbc5f5b20de8a8e",
      duration: "5 mins"
    }]
  }, {
    id: 3,
    title: "Phase 3: Practice",
    tasks: [{
      id: "phase3-ipad-setup",
      label: "Get your iPad ready - Tools to Sell guide",
      href: "https://www.notion.so/Tools-to-Sell-iPad-setup-guide-112cda9d37034831bed0dafbc12364f1",
      duration: "30 mins"
    }, {
      id: "phase3-why-blitz",
      label: "Write down: Why am I going on the blitz? And send it to your leaders",
      duration: "5 mins",
      onClick: () => window.open("sms:", "_self")
    }, {
      id: "phase3-pitch-practice",
      label: "1-on-1 pitch practice with a vet - text your leaders to set up",
      duration: "20 mins",
      onClick: () => window.open("sms:", "_self")
    }]
  }, {
    id: 4,
    title: "Phase 4: Saddle Up!",
    tasks: [{
      id: "phase4-packing-list",
      label: "Review the Packing List - Blitz Trips",
      href: "https://www.notion.so/Packing-List-Blitz-Trips-63bbc6dd1afd4340a9c9ca5533c838b4"
    }, {
      id: "phase4-dominate-video",
      label: "Watch: How to Dominate Your First Blitz",
      href: "https://www.notion.so/How-to-Dominate-Your-First-Blitz-23f9a08a052548e8b838f80837c9e35d",
      duration: "5 mins"
    }, {
      id: "phase4-equipment",
      label: "Text leadership for iPad, badge, and knocking jerseys",
      onClick: () => window.open("sms:", "_self")
    }, {
      id: "phase4-playbook",
      label: "Share with leaders: When It Gets Tough - Your Playbook",
      href: "https://www.notion.so/When-It-Gets-Tough-Your-Playbook-d6d63908789b4b7587b861bd5b382f71",
      duration: "10 mins"
    }]
  }];

  // Handler for task clicks - toggle check and open link only when checking
  const handleTaskClick = (taskId: string, href?: string, onClick?: () => void) => {
    const newCompleted = new Set(completedTasks);
    const isCurrentlyCompleted = completedTasks.has(taskId);
    if (isCurrentlyCompleted) {
      // Uncheck - remove from set, don't open link
      newCompleted.delete(taskId);
    } else {
      // Check - add to set and execute action
      newCompleted.add(taskId);

      // Execute action only when checking off
      if (onClick) {
        onClick();
      } else if (href) {
        openLink(href);
      }
    }
    setCompletedTasks(newCompleted);
  };

  // Smart link opener - tries to open in native apps when possible
  const openLink = (url: string) => {
    // Check if it's a Notion link and try to open in Notion app
    if (url.includes('notion.so') || url.includes('notion.site')) {
      // Extract page ID from URL and construct notion:// deep link
      const notionMatch = url.match(/([a-f0-9]{32}|[a-f0-9-]{36})/);
      if (notionMatch) {
        const pageId = notionMatch[1].replace(/-/g, '');
        const notionAppUrl = `notion://${pageId}`;
        
        // Try to open in Notion app, fallback to browser
        window.location.href = notionAppUrl;
        
        // Fallback to web after short delay if app doesn't open
        setTimeout(() => {
          window.open(url, '_blank', 'noopener,noreferrer');
        }, 500);
        return;
      }
    }
    
    // Open other links in new tab
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Determine phase status
  const getPhaseStatus = (phaseId: number) => {
    if (phaseId === 1) {
      return {
        completed: phase1Complete,
        locked: !slackComplete,
        inProgress: slackComplete && !phase1Complete
      };
    } else if (phaseId === 2) {
      return {
        completed: phase2Complete,
        locked: !phase1Complete,
        inProgress: phase1Complete && !phase2Complete
      };
    } else if (phaseId === 3) {
      return {
        completed: phase3Complete,
        locked: !phase2Complete,
        inProgress: phase2Complete && !phase3Complete
      };
    } else if (phaseId === 4) {
      return {
        completed: phase4Complete,
        locked: !phase3Complete,
        inProgress: phase3Complete && !phase4Complete
      };
    }
    return {
      completed: false,
      locked: true,
      inProgress: false
    };
  };
  const getStatusBadge = (status: StepStatus) => {
    if (status.completed) {
      return <Badge className="bg-success text-success-foreground">✓ Completed</Badge>;
    }
    if (status.inProgress) {
      return <Badge className="bg-warning text-warning-foreground">In Progress</Badge>;
    }
    if (status.locked) {
      return <Badge className="bg-locked text-locked-foreground">🔒 Locked</Badge>;
    }
    return <Badge variant="outline">Not Started</Badge>;
  };
  const getStatusIcon = (status: StepStatus) => {
    if (status.completed) {
      return <CheckCircle2 className="w-6 h-6 text-success" />;
    }
    if (status.locked) {
      return <Lock className="w-6 h-6 text-locked" />;
    }
    return <Circle className="w-6 h-6 text-muted-foreground" />;
  };

  return <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-6 pb-8">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-2xl font-bold">​Getting started  </h1>
              <p className="text-primary-foreground/90 text-sm">Welcome back, {repData.name}!</p>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={handleSync} 
                variant="ghost" 
                size="sm" 
                className="text-primary-foreground hover:bg-primary-foreground/10"
                disabled={isSyncing}
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              </Button>
              <Button 
                onClick={() => setLogoutDialogOpen(true)} 
                variant="ghost" 
                size="sm" 
                className="text-primary-foreground hover:bg-primary-foreground/10"
              >
                Log Out
              </Button>
            </div>
          </div>
          <p className="text-primary-foreground/80 text-sm mt-2">
            ​Follow this to help you make your first $10k at Vivint                                     
          </p>
          
          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-primary-foreground/70 font-medium">Overall Progress</span>
              <span className="text-xs text-primary-foreground/90 font-semibold">{completedSteps}/{totalSteps}</span>
            </div>
            <Progress 
              value={progressPercentage} 
              className={`h-2 bg-primary-foreground/20 transition-all duration-700 ease-out ${animateProgress ? 'animate-pulse' : ''}`}
            />
            <style>{`
              [data-state="complete"] .progress-indicator {
                background: hsl(var(--primary-foreground)) !important;
              }
            `}</style>
          </div>
        </div>
      </div>

      {/* Journey Steps */}
      <div className="max-w-lg mx-auto px-4 -mt-4 space-y-4 pb-6">
        {steps.map(step => {
        const isExpanded = step.status.inProgress && !step.status.completed;
        return <Card key={step.id} className={`transition-all ${step.status.locked ? "opacity-60" : step.status.completed ? "border-success/50" : step.status.inProgress ? "border-primary shadow-orange" : ""}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1">{getStatusIcon(step.status)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <CardTitle className="text-lg leading-tight flex-1 min-w-0">{step.title}</CardTitle>
                      {getStatusBadge(step.status)}
                    </div>
                    {isExpanded && <CardDescription className="text-sm leading-relaxed">
                        {step.description}
                      </CardDescription>}
                  </div>
                </div>
              </CardHeader>

              {isExpanded && <CardContent className="pt-0 space-y-2">
                  {step.actions.map((action, actionIndex) => {
                    if (action.href && !action.onClick) {
                      return (
                        <Button 
                          key={actionIndex} 
                          variant={action.variant || "default"} 
                          className="w-full" 
                          size="lg" 
                          disabled={step.status.locked}
                          onClick={() => openLink(action.href!)}
                        >
                          {action.label}
                        </Button>
                      );
                    }
                    return (
                      <Button 
                        key={actionIndex} 
                        variant={action.variant || "default"} 
                        className="w-full" 
                        size="lg" 
                        disabled={step.status.locked} 
                        onClick={action.onClick}
                      >
                        {action.label}
                      </Button>
                    );
                  })}
                </CardContent>}

              {step.status.completed && !isExpanded && <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground">Step completed!</p>
                </CardContent>}
            </Card>;
      })}

        {/* Ramp to Blitz Card with Sub-Phases */}
        <Card className={`transition-all ${!slackComplete ? "opacity-60" : allRampPhasesComplete ? "border-success/50" : "border-primary shadow-orange"}`}>
          <CardHeader className="pb-3">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-1">
                {allRampPhasesComplete ? <CheckCircle2 className="w-6 h-6 text-success" /> : !slackComplete ? <Lock className="w-6 h-6 text-locked" /> : <Circle className="w-6 h-6 text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <CardTitle className="text-lg leading-tight flex-1 min-w-0">Ramp to Blitz</CardTitle>
                  {allRampPhasesComplete ? <Badge className="bg-success text-success-foreground">✓ Completed</Badge> : !slackComplete ? <Badge className="bg-locked text-locked-foreground">🔒 Locked</Badge> : <Badge className="bg-warning text-warning-foreground">In Progress</Badge>}
                </div>
                {slackComplete && !allRampPhasesComplete && <CardDescription className="text-sm leading-relaxed">
                    Work through all 4 phases to be ready for your first blitz.
                  </CardDescription>}
              </div>
            </div>
          </CardHeader>

          {slackComplete && !allRampPhasesComplete && <CardContent className="pt-0 space-y-3">
              <Accordion 
                type="single" 
                collapsible 
                className="space-y-3"
                defaultValue={
                  phase4Complete ? undefined :
                  phase3Complete ? "phase-4" :
                  phase2Complete ? "phase-3" :
                  phase1Complete ? "phase-2" :
                  slackComplete ? "phase-1" :
                  undefined
                }
              >
                {rampPhases.map(phase => {
                  const phaseStatus = getPhaseStatus(phase.id);
                  
                  // Locked phases cannot be expanded
                  if (phaseStatus.locked) {
                    return (
                      <div key={phase.id} className="border rounded-lg opacity-60 bg-muted/30">
                        <div className="flex items-center justify-between w-full p-4 rounded-lg cursor-not-allowed">
                          <div className="flex items-center gap-3 flex-1">
                            <Lock className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                            <div className="flex items-center gap-2 flex-wrap flex-1">
                              <span className="font-semibold text-sm">{phase.title}</span>
                              <Badge variant="outline" className="text-xs">🔒 Locked</Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  
                  return (
                    <AccordionItem key={phase.id} value={`phase-${phase.id}`} className={`border rounded-lg ${phaseStatus.completed ? "bg-success/5 border-success/30" : "bg-card"}`}>
                      <AccordionTrigger className="flex items-center justify-between w-full p-4 hover:bg-accent/50 transition-colors rounded-lg [&[data-state=open]>svg]:rotate-180">
                        <div className="flex items-center gap-3 flex-1">
                          {phaseStatus.completed ? <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" /> : <Circle className="w-5 h-5 text-muted-foreground flex-shrink-0" />}
                          <div className="flex items-center gap-2 flex-wrap flex-1">
                            <span className="font-semibold text-sm">{phase.title}</span>
                            {phaseStatus.completed && <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/30">✓ Complete</Badge>}
                          </div>
                        </div>
                      </AccordionTrigger>

                      <AccordionContent className="px-4 pb-4 space-y-2">
                        {phase.tasks.map(task => {
                          const isCompleted = completedTasks.has(task.id);
                          return (
                            <div key={task.id} className="flex items-start gap-3 py-2 group">
                              <Checkbox 
                                checked={isCompleted} 
                                onCheckedChange={() => handleTaskClick(task.id, task.href, task.onClick)} 
                                className="mt-0.5 flex-shrink-0" 
                              />
                              <button 
                                onClick={() => handleTaskClick(task.id, task.href, task.onClick)} 
                                className="flex-1 text-left text-sm group-hover:text-primary transition-colors"
                              >
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={isCompleted ? "line-through text-muted-foreground" : ""}>
                                    {task.label}
                                  </span>
                                  {task.duration && <span className="text-xs text-muted-foreground">({task.duration})</span>}
                                </div>
                              </button>
                            </div>
                          );
                        })}
                        
                        {/* Show encouragement when all tasks are completed */}
                        {phase.tasks.every(task => completedTasks.has(task.id)) && !phaseStatus.completed && (
                          <div className="mt-3 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                            <p className="text-sm font-medium text-foreground">
                              🎉 Great work! You've completed all tasks for Phase {phase.id}.
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Text your leaders to let them know you're done with Phase {phase.id} so they can verify and unlock the next phase!
                            </p>
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </CardContent>}

          {allRampPhasesComplete && <CardContent className="pt-0">
              <p className="text-sm text-muted-foreground">All phases completed! You're ready for the blitz!</p>
            </CardContent>}
        </Card>
      </div>

      {/* Intro Example Dialog */}
      <Dialog open={showIntroDialog} onOpenChange={setShowIntroDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Team Introduction Example</DialogTitle>
            <DialogDescription>
              Here's what to share when you introduce yourself to the team:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-semibold mb-1">Share 1-2 things about yourself:</h4>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>What do you like to do in your free time?</li>
                <li>Where are you from?</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-1">Tell us why you're excited:</h4>
              <p className="text-muted-foreground">Share why you're excited to work at Vivint and what you're looking forward to!</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Logout Confirmation Dialog */}
      <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to log out?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll need to sign back in to access your journey progress and training.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLogout}>Log Out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Team Calendar Modal */}
      <TeamCalendarModal open={calendarModalOpen} onOpenChange={setCalendarModalOpen} />
    </div>;
};
export default Home;