import { ChevronRight, Check, ExternalLink, MessageSquare, GraduationCap, ClipboardCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { RampHeroProgress } from "@/components/ramp/RampHeroProgress";
import type { PhaseData, PhaseId } from "@/pages/RampToBlitz";
import type { RepData } from "@/hooks/useRepData";

interface RookieRampHeroSectionProps {
  repData: RepData;
  prerequisites: {
    onboarding: boolean;
    trainings: boolean;
    slack: boolean;
  };
  phases: PhaseData[];
  activePhase: PhaseId;
  onPhaseSelect: (phase: PhaseId) => void;
  goalsSetupComplete?: boolean;
}

export const RookieRampHeroSection = ({
  repData,
  prerequisites,
  phases,
  activePhase,
  onPhaseSelect,
  goalsSetupComplete = false,
}: RookieRampHeroSectionProps) => {
  const navigate = useNavigate();
  const allPrereqsComplete = prerequisites.onboarding && prerequisites.trainings && prerequisites.slack;

  // If prerequisites not complete, show them as 3 separate step cards
  if (!allPrereqsComplete) {
    return (
      <div className="space-y-3">
        <OnboardingStepCard
          step={1}
          title="Complete Your Onboarding"
          description="Get fully onboarded in the system so you can get paid."
          complete={prerequisites.onboarding}
          icon={ClipboardCheck}
          primaryAction={{
            label: "Finish Onboarding",
            href: "https://onboardingtool.vivint.com/"
          }}
          secondaryAction={{
            label: "Request I-9 Help",
            href: "https://forms.gle/rCssbYULxJ673nfP8",
            helperText: "Upload your Social & Driver's License for employment eligibility"
          }}
        />
        
        <OnboardingStepCard
          step={2}
          title="Finish Required Trainings"
          description="Complete the mandatory Vivint modules and quizzes so you're cleared to sell."
          complete={prerequisites.trainings}
          icon={GraduationCap}
          primaryAction={{
            label: "Open Training Portal",
            href: "https://dthvivinttraining.conveyour.com/ui/portal"
          }}
        />
        
        <OnboardingStepCard
          step={3}
          title="Join the Team Slack"
          description="Join the group and introduce yourself so the team knows who you are."
          complete={prerequisites.slack}
          icon={MessageSquare}
          primaryAction={{
            label: "Join Slack",
            href: "https://join.slack.com/t/kaizen-better-daily/shared_invite/zt-3g30ikq9e-RugmfMRBUCu4qx5S0GUgZw"
          }}
          introGuidance={{
            title: "What to share in your intro:",
            points: [
              "1-2 things about yourself (hobbies, where you're from)",
              "Why you're excited to work at Vivint"
            ]
          }}
        />
      </div>
    );
  }

  // Prerequisites complete - show Ramp to Blitz hero only
  return (
    <Card className="border-primary/30 overflow-hidden">
      <CardContent className="p-0">
        <div className="p-4 pb-3">
          <RampHeroProgress
            phases={phases}
            activePhase={activePhase}
            repData={repData}
            onPhaseSelect={onPhaseSelect}
            goalsSetupComplete={goalsSetupComplete}
          />
        </div>
        
        <div className="px-4 pb-4">
          <Button 
            onClick={() => navigate('/ramp-to-blitz')}
            className="w-full rounded-xl gap-2"
            size="lg"
          >
            Continue Your Prep
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

interface OnboardingStepCardProps {
  step: number;
  title: string;
  description: string;
  complete: boolean;
  icon: React.ComponentType<{ className?: string }>;
  primaryAction: {
    label: string;
    href: string;
  };
  secondaryAction?: {
    label: string;
    href: string;
    helperText?: string;
  };
  introGuidance?: {
    title: string;
    points: string[];
  };
}

const OnboardingStepCard = ({
  step,
  title,
  description,
  complete,
  icon: Icon,
  primaryAction,
  secondaryAction,
  introGuidance,
}: OnboardingStepCardProps) => {
  const openLink = (href: string) => {
    window.open(href, '_blank', 'noopener,noreferrer');
  };

  return (
    <Card className={`transition-all ${complete ? 'border-success/30 bg-success/5' : 'border-border'}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Step indicator */}
          <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
            complete 
              ? 'bg-success text-success-foreground' 
              : 'bg-primary/10 text-primary'
          }`}>
            {complete ? (
              <Check className="w-5 h-5" />
            ) : (
              <span className="font-bold text-lg">{step}</span>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            {/* Title and icon */}
            <div className="flex items-center gap-2 mb-1">
              <h3 className={`font-semibold ${complete ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                {title}
              </h3>
              {complete && (
                <span className="text-xs text-success font-medium">Complete</span>
              )}
            </div>
            
            {/* Description */}
            <p className="text-sm text-muted-foreground mb-3">
              {description}
            </p>
            
            {/* Actions - only show if not complete */}
            {!complete && (
              <div className="space-y-2">
                <Button 
                  onClick={() => openLink(primaryAction.href)}
                  className="w-full gap-2"
                  size="sm"
                >
                  <Icon className="w-4 h-4" />
                  {primaryAction.label}
                  <ExternalLink className="w-3 h-3 ml-auto" />
                </Button>
                
                {secondaryAction && (
                  <div className="pt-1">
                    <button
                      onClick={() => openLink(secondaryAction.href)}
                      className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                      {secondaryAction.label}
                      <ExternalLink className="w-3 h-3" />
                    </button>
                    {secondaryAction.helperText && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {secondaryAction.helperText}
                      </p>
                    )}
                  </div>
                )}
                
                {introGuidance && (
                  <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs font-medium text-foreground mb-1.5">
                      {introGuidance.title}
                    </p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      {introGuidance.points.map((point, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-primary">•</span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
