import { useState } from "react";
import { ChevronRight, Check, ExternalLink, MessageSquare, GraduationCap, ClipboardCheck, Clock, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { RampHeroProgress } from "@/components/ramp/RampHeroProgress";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { PhaseData, PhaseId } from "@/pages/RampToBlitz";
import type { RepData } from "@/hooks/useRepData";

interface RookieRampHeroSectionProps {
  repData: RepData;
  prerequisites: {
    onboarding: boolean;
    trainings: boolean;
    slack: boolean;
  };
  selfReported?: {
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
  selfReported = { onboarding: false, trainings: false, slack: false },
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
          selfReported={selfReported.onboarding}
          repId={repData.id}
          selfReportField="selfReportedOnboarding"
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
          selfReported={selfReported.trainings}
          repId={repData.id}
          selfReportField="selfReportedTrainings"
          locked={!prerequisites.onboarding}
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
          selfReported={selfReported.slack}
          repId={repData.id}
          selfReportField="selfReportedSlack"
          locked={!prerequisites.trainings}
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
  selfReported: boolean;
  repId: string;
  selfReportField: 'selfReportedOnboarding' | 'selfReportedTrainings' | 'selfReportedSlack';
  locked?: boolean;
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
  selfReported,
  repId,
  selfReportField,
  locked = false,
  icon: Icon,
  primaryAction,
  secondaryAction,
  introGuidance,
}: OnboardingStepCardProps) => {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openLink = (href: string) => {
    window.open(href, '_blank', 'noopener,noreferrer');
  };

  const handleMarkDone = async () => {
    setIsSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { error } = await supabase.functions.invoke('update-rookie-status', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          rookieId: repId,
          [selfReportField]: true
        }
      });

      if (error) throw error;

      toast.success("Nice work! Your leader will verify this step.", {
        description: "They'll check and mark it complete shortly."
      });

      queryClient.invalidateQueries({ queryKey: ['rep-data'] });
      queryClient.invalidateQueries({ queryKey: ['recruits-rep-data'] });
    } catch (error: any) {
      console.error('Error marking step done:', error);
      toast.error('Failed to mark as done', {
        description: error.message || 'Please try again'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Completed cards - show checkmark and complete state
  if (complete) {
    return (
      <Card className="border-success/30 bg-card transition-all">
        <CardContent className="p-3">
          <div className="flex items-center gap-3">
            <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-success text-success-foreground">
              <Check className="w-4 h-4" />
            </div>
            <h3 className="font-medium text-muted-foreground line-through flex-1">
              {title}
            </h3>
            <span className="text-xs text-success font-medium">Complete</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Self-reported but awaiting verification
  if (selfReported && !complete) {
    return (
      <Card className="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 transition-all">
        <CardContent className="p-3">
          <div className="flex items-center gap-3">
            <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-amber-500/20 text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-foreground">
                {title}
              </h3>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Awaiting leader verification
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Locked state
  if (locked) {
    return (
      <Card className="border-border bg-muted/30 transition-all opacity-60">
        <CardContent className="p-3">
          <div className="flex items-center gap-3">
            <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-muted text-muted-foreground">
              <span className="font-bold text-sm">{step}</span>
            </div>
            <h3 className="font-medium text-muted-foreground flex-1">
              {title}
            </h3>
            <span className="text-xs text-muted-foreground">Locked</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Active state - show full card with actions
  return (
    <Card className="border-border transition-all">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Step indicator */}
          <div className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-primary/10 text-primary">
            <span className="font-bold text-lg">{step}</span>
          </div>
          
          <div className="flex-1 min-w-0">
            {/* Title */}
            <h3 className="font-semibold text-foreground mb-1">
              {title}
            </h3>
            
            {/* Description */}
            <p className="text-sm text-muted-foreground mb-3">
              {description}
            </p>
            
            {/* Actions */}
            <div className="space-y-2">
              <Button 
                onClick={() => openLink(primaryAction.href)}
                className="w-full gap-2"
                size="sm"
              >
                <Icon className="w-4 h-4" />
                {primaryAction.label}
              </Button>
              
              {secondaryAction && (
                <Button
                  onClick={() => openLink(secondaryAction.href)}
                  variant="secondary"
                  className="w-full gap-2"
                  size="sm"
                >
                  {secondaryAction.label}
                </Button>
              )}
              {secondaryAction?.helperText && (
                <p className="text-xs text-muted-foreground text-center">
                  {secondaryAction.helperText}
                </p>
              )}
              
              {introGuidance && (
                <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs font-medium text-foreground mb-1.5">
                    {introGuidance.title}
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {introGuidance.points.map((point, i) => (
                      <li key={i}>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* I'm Done button */}
              <Button
                onClick={handleMarkDone}
                variant="outline"
                className="w-full gap-2 mt-3 border-emerald-500/50 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                size="sm"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {isSubmitting ? "Saving..." : "I'm Done"}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
