import { CheckCircle2, Circle, Lock, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { useRepData } from "@/hooks/useRepData";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
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
    loading
  } = useRepData();
  const navigate = useNavigate();
  const [showIntroDialog, setShowIntroDialog] = useState(false);
  
  // Track completed tasks in localStorage
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(() => {
    if (!repData?.id) return new Set();
    const saved = localStorage.getItem(`ramp-progress-${repData.id}`);
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  // Update localStorage when completedTasks changes
  useEffect(() => {
    if (repData?.id) {
      localStorage.setItem(`ramp-progress-${repData.id}`, JSON.stringify([...completedTasks]));
    }
  }, [completedTasks, repData?.id]);
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };
  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>;
  }
  if (!repData) {
    return <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Setup Required</CardTitle>
            <CardDescription>
              Your account needs to be set up by your team leader. Click "Sync from Notion" to load your data.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={handleLogout} variant="outline" className="w-full">
              Log Out
            </Button>
          </CardContent>
        </Card>
      </div>;
  }

  // Helper to check phase status - case-insensitive matching
  const phase = repData.ramp_to_blitz_phase || "Not started";
  const phaseLower = phase.toLowerCase();

  // Log for debugging
  console.log("Current phase:", phase);

  // Determine step completions based on Ramp to Blitz Phase value (case-insensitive)
  const onboardingComplete = phaseLower.includes("onboarding") && phaseLower.includes("✅");
  const trainingsComplete = phaseLower.includes("training") && phaseLower.includes("✅");
  const slackComplete = phaseLower.includes("slack") && phaseLower.includes("✅");
  
  // Individual ramp phase completions
  const phase1Complete = phaseLower.includes("phase 1") && phaseLower.includes("✅");
  const phase2Complete = phaseLower.includes("phase 2") && phaseLower.includes("✅");
  const phase3Complete = phaseLower.includes("phase 3") && phaseLower.includes("✅");
  const phase4Complete = phaseLower.includes("phase 4") && phaseLower.includes("✅");
  
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
  const rampPhases: RampPhase[] = [
    {
      id: 1,
      title: "Phase 1: Set Goals",
      tasks: [
        {
          id: "phase1-blitz-video",
          label: "Watch: What is a blitz and how do you get paid?",
          href: "https://calvinschofield.notion.site/What-the-blitz-is-and-how-you-get-paid-c74c25ffd00747e4a345c08160d727e6",
          duration: "5 mins"
        },
        {
          id: "phase1-goals-call",
          label: "Text leaders to schedule a Goals & Gameplan call",
          href: "https://www.notion.so/Goals-Gameplan-290070fe3bc280daa182cc832ef1a35d",
          duration: "30 mins"
        }
      ]
    },
    {
      id: 2,
      title: "Phase 2: Start Trainings",
      tasks: [
        {
          id: "phase2-product-basics",
          label: "Learn Product basics - How to sound like you've been selling for years",
          href: "https://www.notion.so/Product-How-to-sound-like-you-ve-been-selling-for-years-in-one-night-2d7f4a89e80d4d4686c40da84f6540b7",
          duration: "30 mins"
        },
        {
          id: "phase2-product-quiz",
          label: "Take the Product Quiz",
          href: "https://www.notion.so/Product-Quiz-1624b6a3caba47669c20eeef13d2934f",
          duration: "5 mins"
        },
        {
          id: "phase2-upgrades",
          label: "Study Upgrades 101",
          href: "https://www.notion.so/Upgrades-101-f027467a0a5e405a853abdc26e92401e",
          duration: "30 mins"
        },
        {
          id: "phase2-takeover",
          label: "Study the Takeover Door Approach",
          href: "https://www.notion.so/Takeover-Door-Approach-18c070fe3bc2800bad33c0818f0f0489",
          duration: "30 mins"
        },
        {
          id: "phase2-pitch-video",
          label: "Send video giving the two pitches to your leaders",
          href: "https://www.notion.so/Pitch-Feedback-Instructions-03901d3e606b4aa29fbc5f5b20de8a8e",
          duration: "5 mins"
        }
      ]
    },
    {
      id: 3,
      title: "Phase 3: Practice",
      tasks: [
        {
          id: "phase3-ipad-setup",
          label: "Get your iPad ready - Tools to Sell guide",
          href: "https://www.notion.so/Tools-to-Sell-iPad-setup-guide-112cda9d37034831bed0dafbc12364f1",
          duration: "30 mins"
        },
        {
          id: "phase3-why-blitz",
          label: "Write down: Why am I going on the blitz? And send it to your leaders",
          duration: "5 mins",
          onClick: () => window.open("sms:", "_self")
        },
        {
          id: "phase3-pitch-practice",
          label: "1-on-1 pitch practice with a vet - text your leaders to set up",
          duration: "20 mins",
          onClick: () => window.open("sms:", "_self")
        }
      ]
    },
    {
      id: 4,
      title: "Phase 4: Saddle Up!",
      tasks: [
        {
          id: "phase4-packing-list",
          label: "Review the Packing List - Blitz Trips",
          href: "https://www.notion.so/Packing-List-Blitz-Trips-63bbc6dd1afd4340a9c9ca5533c838b4"
        },
        {
          id: "phase4-dominate-video",
          label: "Watch: How to Dominate Your First Blitz",
          href: "https://www.notion.so/How-to-Dominate-Your-First-Blitz-23f9a08a052548e8b838f80837c9e35d",
          duration: "5 mins"
        },
        {
          id: "phase4-equipment",
          label: "Text leadership for iPad, badge, and knocking jerseys",
          onClick: () => window.open("sms:", "_self")
        },
        {
          id: "phase4-playbook",
          label: "Share with leaders: When It Gets Tough - Your Playbook",
          href: "https://www.notion.so/When-It-Gets-Tough-Your-Playbook-d6d63908789b4b7587b861bd5b382f71",
          duration: "10 mins"
        }
      ]
    }
  ];

  // Handler for task clicks - auto-check and open link
  const handleTaskClick = (taskId: string, href?: string, onClick?: () => void) => {
    // Mark as complete
    const newCompleted = new Set(completedTasks);
    newCompleted.add(taskId);
    setCompletedTasks(newCompleted);
    
    // Execute action
    if (onClick) {
      onClick();
    } else if (href) {
      window.open(href, '_blank');
    }
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
    return { completed: false, locked: true, inProgress: false };
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
              <h1 className="text-2xl font-bold">Your Journey</h1>
              <p className="text-primary-foreground/90 text-sm">Welcome back, {repData.name}!</p>
            </div>
            <Button onClick={handleLogout} variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10">
              Log Out
            </Button>
          </div>
          <p className="text-primary-foreground/80 text-sm mt-2">
            Follow these steps to go from rookie to closer
          </p>
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
                  {step.actions.map((action, actionIndex) => <Button key={actionIndex} variant={action.variant || "default"} className="w-full" size="lg" disabled={step.status.locked} onClick={action.onClick} asChild={!!action.href && !action.onClick}>
                      {action.href && !action.onClick ? <a href={action.href} target="_blank" rel="noopener noreferrer">{action.label}
                        </a> : <span>{action.label}</span>}
                    </Button>)}
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
                  <CardTitle className="text-lg leading-tight flex-1 min-w-0">Prepare for Blitz</CardTitle>
                  {allRampPhasesComplete ? <Badge className="bg-success text-success-foreground">✓ Completed</Badge> : !slackComplete ? <Badge className="bg-locked text-locked-foreground">🔒 Locked</Badge> : <Badge className="bg-warning text-warning-foreground">In Progress</Badge>}
                </div>
                {slackComplete && !allRampPhasesComplete && <CardDescription className="text-sm leading-relaxed">
                    Work through all 4 phases to be ready for your first blitz.
                  </CardDescription>}
              </div>
            </div>
          </CardHeader>

          {slackComplete && !allRampPhasesComplete && <CardContent className="pt-0 space-y-3">
              {rampPhases.map(phase => {
              const phaseStatus = getPhaseStatus(phase.id);
              const isPhaseExpanded = phaseStatus.inProgress || phaseStatus.completed;
              return <Collapsible key={phase.id} defaultOpen={phaseStatus.inProgress} className={`border rounded-lg ${phaseStatus.locked ? "opacity-60 bg-muted/30" : phaseStatus.completed ? "bg-success/5 border-success/30" : "bg-card"}`}>
                    <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-accent/50 transition-colors rounded-lg" disabled={phaseStatus.locked}>
                      <div className="flex items-center gap-3 flex-1">
                        {phaseStatus.completed ? <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" /> : phaseStatus.locked ? <Lock className="w-5 h-5 text-muted-foreground flex-shrink-0" /> : <Circle className="w-5 h-5 text-muted-foreground flex-shrink-0" />}
                        <div className="flex items-center gap-2 flex-wrap flex-1">
                          <span className="font-semibold text-sm">{phase.title}</span>
                          {phaseStatus.completed && <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/30">✓ Complete</Badge>}
                          {phaseStatus.locked && <Badge variant="outline" className="text-xs">🔒 Locked</Badge>}
                        </div>
                      </div>
                      <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform ui-state-open:rotate-180" />
                    </CollapsibleTrigger>

                    <CollapsibleContent className="px-4 pb-4 space-y-2">
                      {phase.tasks.map(task => {
                    const isCompleted = completedTasks.has(task.id);
                    return <div key={task.id} className="flex items-start gap-3 py-2 group">
                            <Checkbox checked={isCompleted} onCheckedChange={() => !isCompleted && handleTaskClick(task.id, task.href, task.onClick)} disabled={phaseStatus.locked} className="mt-0.5 flex-shrink-0" />
                            <button onClick={() => !isCompleted && handleTaskClick(task.id, task.href, task.onClick)} disabled={phaseStatus.locked || isCompleted} className="flex-1 text-left text-sm group-hover:text-primary transition-colors disabled:opacity-70 disabled:cursor-not-allowed">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={isCompleted ? "line-through text-muted-foreground" : ""}>{task.label}</span>
                                {task.duration && <span className="text-xs text-muted-foreground">({task.duration})</span>}
                              </div>
                            </button>
                          </div>;
                  })}
                    </CollapsibleContent>
                  </Collapsible>;
            })}
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
    </div>;
};
export default Home;