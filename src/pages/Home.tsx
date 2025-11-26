import { CheckCircle2, Circle, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRepData } from "@/hooks/useRepData";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
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
const Home = () => {
  const {
    repData,
    loading
  } = useRepData();
  const navigate = useNavigate();
  const [showIntroDialog, setShowIntroDialog] = useState(false);
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
  // Check if phase contains keywords for more flexible matching
  const onboardingComplete = phaseLower.includes("onboarding") && phaseLower.includes("✅");
  const trainingsComplete = phaseLower.includes("training") && phaseLower.includes("✅");
  const slackComplete = phaseLower.includes("slack") && phaseLower.includes("✅");
  const isInRampPhases = (phaseLower.includes("phase") && phaseLower.includes("✅")) || phaseLower === "slack ✅";
  
  // If any ramp phase is complete, all previous steps are complete
  if (isInRampPhases) {
    // All steps before ramp phases are complete
  }
  
  const allRampPhasesComplete = phaseLower.includes("phase 4") && phaseLower.includes("✅");
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
  }, {
    id: "ramp",
    title: "Set Goals",
    description: "Watch the blitz overview video and schedule a Goals & Gameplan call with your leaders.",
    status: {
      completed: allRampPhasesComplete,
      locked: !slackComplete,
      inProgress: slackComplete && !allRampPhasesComplete
    },
    actions: [{
      label: "Watch: What is a Blitz",
      href: "https://calvinschofield.notion.site/What-the-blitz-is-and-how-you-get-paid-c74c25ffd00747e4a345c08160d727e6",
      variant: "default"
    }, {
      label: "Text Leaders to Schedule Call",
      variant: "outline",
      onClick: () => window.open("sms:", "_self")
    }]
  }];
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