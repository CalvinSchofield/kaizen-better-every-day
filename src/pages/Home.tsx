import { CheckCircle2, Circle, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRepData } from "@/hooks/useRepData";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
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
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };
  const handleManualSync = async () => {
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('sync-notion-reps');
      if (error) throw error;
      console.log("Sync result:", data);
      window.location.reload(); // Refresh to show updated data
    } catch (error) {
      console.error("Sync error:", error);
    }
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
  const onboardingComplete = phaseLower === "onboarding ✅" || phaseLower === "trainings ✅" || phaseLower === "slack ✅" || phaseLower.startsWith("phase");
  const trainingsComplete = phaseLower === "trainings ✅" || phaseLower === "slack ✅" || phaseLower.startsWith("phase");
  const slackComplete = phaseLower === "slack ✅" || phaseLower.startsWith("phase");
  const allRampPhasesComplete = phaseLower === "phase 4 ✅";
  const steps: JourneyStep[] = [{
    id: "onboarding",
    title: "Complete Your Onboarding",
    description: "Get fully onboarded in the system so you can get paid and start training.",
    status: {
      completed: onboardingComplete,
      locked: false,
      inProgress: phase === "not started" || !onboardingComplete
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
      completed: trainingsComplete,
      locked: !onboardingComplete,
      inProgress: onboardingComplete && !trainingsComplete
    },
    actions: [{
      label: "Open Vivint Trainings",
      href: "#"
    }]
  }, {
    id: "slack",
    title: "Join the Team Slack & Introduce Yourself",
    description: "Join the group and post a quick intro so the team knows who you are.",
    status: {
      completed: slackComplete,
      locked: !trainingsComplete,
      inProgress: trainingsComplete && !slackComplete
    },
    actions: [{
      label: "Join Slack",
      href: "#"
    }, {
      label: "Intro Example",
      href: "#",
      variant: "outline"
    }]
  }, {
    id: "ramp",
    title: "Prepare for Blitz – Ramp to Blitz",
    description: "Work through Phases 1–4 with your leaders so you're ready to crush your first blitz.",
    status: {
      completed: allRampPhasesComplete,
      locked: !slackComplete,
      inProgress: slackComplete && !allRampPhasesComplete
    },
    actions: [{
      label: phase.includes("phase") ? `Current: ${repData.ramp_to_blitz_phase}` : "Start Phase 1",
      href: "#",
      variant: phase.includes("phase") ? "default" : "default"
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
      {/* Debug Panel */}
      <div className="max-w-lg mx-auto px-4 py-4">
        <Card className="bg-muted">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Debug Info</CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-1">
            <div><strong>Phase from DB:</strong> "{repData.ramp_to_blitz_phase}"</div>
            <div><strong>Onboarding Complete:</strong> {onboardingComplete ? '✓ Yes' : '✗ No'}</div>
            <div><strong>Notion Page ID:</strong> {repData.notion_page_id || 'Not synced'}</div>
            <div className="text-warning mt-2">If the phase is wrong, check your Notion "Ramp to Blitz Phase" select property</div>
          </CardContent>
        </Card>
      </div>

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
          <Button onClick={handleManualSync} variant="secondary" size="sm" className="mt-2">
            Sync from Notion
          </Button>
          <p className="text-primary-foreground/80 text-sm">
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
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <CardTitle className="text-lg leading-tight">{step.title}</CardTitle>
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
    </div>;
};
export default Home;