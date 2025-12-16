import { Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { PhaseData } from "@/pages/RampToBlitz";
import type { RepData } from "@/hooks/useRepData";
import { Phase1Content } from "./Phase1Content";
import { Phase2Content } from "./Phase2Content";
import { Phase3Content } from "./Phase3Content";
import { Phase4Content } from "./Phase4Content";

interface RampPhaseContentProps {
  phase: PhaseData;
  repData: RepData | null;
  onOpenPitchGuide: (guide: "takeover" | "upgrade") => void;
  scrollToStepKey?: string | null;
  onScrollComplete?: () => void;
}

export const RampPhaseContent = ({ 
  phase, 
  repData, 
  onOpenPitchGuide,
  scrollToStepKey,
  onScrollComplete 
}: RampPhaseContentProps) => {
  if (phase.isLocked) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-muted-foreground mb-2">
            Phase {phase.id} Locked
          </h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Complete Phase {phase.id - 1} to unlock this content.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Render Phase 1 with dedicated component
  if (phase.id === 1) {
    return (
      <Phase1Content 
        repData={repData} 
        isComplete={phase.isComplete} 
        scrollToStepKey={scrollToStepKey}
        onScrollComplete={onScrollComplete}
      />
    );
  }

  // Render Phase 2 with dedicated component
  if (phase.id === 2) {
    return (
      <Phase2Content 
        repData={repData} 
        isComplete={phase.isComplete} 
        onOpenPitchGuide={onOpenPitchGuide}
        scrollToStepKey={scrollToStepKey}
        onScrollComplete={onScrollComplete}
      />
    );
  }

  // Render Phase 3 with dedicated component
  if (phase.id === 3) {
    return (
      <Phase3Content 
        repData={repData} 
        isComplete={phase.isComplete}
        scrollToStepKey={scrollToStepKey}
        onScrollComplete={onScrollComplete}
      />
    );
  }

  // Render Phase 4 with dedicated component
  if (phase.id === 4) {
    return (
      <Phase4Content 
        repData={repData} 
        isComplete={phase.isComplete}
        scrollToStepKey={scrollToStepKey}
        onScrollComplete={onScrollComplete}
      />
    );
  }

  return null;
};
