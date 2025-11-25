import { CheckCircle2, Circle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
    variant?: "default" | "outline" | "secondary";
  }>;
}

const Home = () => {
  // Mock data - will be replaced with Notion integration
  const steps: JourneyStep[] = [
    {
      id: "onboarding",
      title: "Complete Your Onboarding",
      description: "Get fully onboarded in the system so you can get paid and start training.",
      status: { completed: false, locked: false, inProgress: true },
      actions: [
        { label: "Start Onboarding", href: "#", variant: "default" },
        { label: "Request I-9 Help", href: "#", variant: "outline" },
      ],
    },
    {
      id: "trainings",
      title: "Complete Required Vivint Trainings",
      description: "Finish the mandatory Vivint modules and quizzes so you're cleared to sell.",
      status: { completed: false, locked: true, inProgress: false },
      actions: [
        { label: "Open Vivint Trainings", href: "#" },
      ],
    },
    {
      id: "slack",
      title: "Join the Team Slack & Introduce Yourself",
      description: "Join the group and post a quick intro so the team knows who you are.",
      status: { completed: false, locked: true, inProgress: false },
      actions: [
        { label: "Join Slack", href: "#" },
        { label: "Intro Example", href: "#", variant: "outline" },
      ],
    },
  ];

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-6 pb-8">
        <div className="max-w-lg mx-auto">
          <h1 className="text-2xl font-bold mb-2">Your Journey</h1>
          <p className="text-primary-foreground/90 text-sm">
            Follow these steps to go from rookie to closer
          </p>
        </div>
      </div>

      {/* Journey Steps */}
      <div className="max-w-lg mx-auto px-4 -mt-4 space-y-4 pb-6">
        {steps.map((step, index) => {
          const isExpanded = step.status.inProgress && !step.status.completed;
          
          return (
            <Card
              key={step.id}
              className={`transition-all ${
                step.status.locked
                  ? "opacity-60"
                  : step.status.completed
                  ? "border-success/50"
                  : step.status.inProgress
                  ? "border-primary shadow-orange"
                  : ""
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1">
                    {getStatusIcon(step.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <CardTitle className="text-lg leading-tight">
                        {step.title}
                      </CardTitle>
                      {getStatusBadge(step.status)}
                    </div>
                    {isExpanded && (
                      <CardDescription className="text-sm leading-relaxed">
                        {step.description}
                      </CardDescription>
                    )}
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-0 space-y-2">
                  {step.actions.map((action, actionIndex) => (
                    <Button
                      key={actionIndex}
                      variant={action.variant || "default"}
                      className="w-full"
                      size="lg"
                      disabled={step.status.locked}
                      asChild={!!action.href}
                    >
                      {action.href ? (
                        <a href={action.href} target="_blank" rel="noopener noreferrer">
                          {action.label}
                        </a>
                      ) : (
                        <span>{action.label}</span>
                      )}
                    </Button>
                  ))}
                </CardContent>
              )}

              {step.status.completed && !isExpanded && (
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground">Step completed!</p>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default Home;
