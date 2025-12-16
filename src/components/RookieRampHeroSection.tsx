import { ChevronRight, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
}

export const RookieRampHeroSection = ({
  repData,
  prerequisites,
  phases,
  activePhase,
  onPhaseSelect,
}: RookieRampHeroSectionProps) => {
  const navigate = useNavigate();
  const allPrereqsComplete = prerequisites.onboarding && prerequisites.trainings && prerequisites.slack;

  return (
    <div className="space-y-4">
      {/* Prerequisites Section - Collapsed when complete */}
      {allPrereqsComplete ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <Check className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Setup Complete</span>
          <span className="text-xs text-muted-foreground ml-1">
            Onboarding · Trainings · Slack
          </span>
        </div>
      ) : (
        <Card className="border-warning/30">
          <CardContent className="p-4">
            <p className="text-sm font-medium mb-3">Complete these first:</p>
            <div className="space-y-2">
              <PrereqItem 
                label="Complete Onboarding" 
                complete={prerequisites.onboarding} 
                href="https://onboardingtool.vivint.com/"
              />
              <PrereqItem 
                label="Required Trainings" 
                complete={prerequisites.trainings} 
                href="https://dthvivinttraining.conveyour.com/ui/portal"
              />
              <PrereqItem 
                label="Join Slack" 
                complete={prerequisites.slack} 
                href="https://join.slack.com/t/kaizen-better-daily/shared_invite/zt-3g30ikq9e-RugmfMRBUCu4qx5S0GUgZw"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ramp to Blitz Hero - Primary focus when prerequisites done */}
      {allPrereqsComplete && (
        <Card className="border-primary/30 overflow-hidden">
          <CardContent className="p-0">
            <div className="p-4 pb-3">
              <RampHeroProgress
                phases={phases}
                activePhase={activePhase}
                repData={repData}
                onPhaseSelect={onPhaseSelect}
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
      )}
    </div>
  );
};

const PrereqItem = ({ 
  label, 
  complete, 
  href 
}: { 
  label: string; 
  complete: boolean; 
  href: string;
}) => {
  const handleClick = () => {
    window.open(href, '_blank', 'noopener,noreferrer');
  };

  return (
    <button 
      onClick={handleClick}
      className="flex items-center gap-3 w-full text-left p-2 rounded-lg hover:bg-muted/50 transition-colors"
    >
      {complete ? (
        <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
          <Check className="h-3 w-3 text-white" />
        </div>
      ) : (
        <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 shrink-0" />
      )}
      <span className={`text-sm flex-1 ${complete ? 'text-muted-foreground line-through' : ''}`}>
        {label}
      </span>
      {!complete && (
        <Badge variant="outline" className="text-xs">Required</Badge>
      )}
    </button>
  );
};
