import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Recruit } from "@/hooks/useGroupRecruits";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Check, AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface EditableRecruitProgressProps {
  recruit: Recruit;
  repData?: {
    onboarding_complete: boolean | null;
    trainings_complete: boolean | null;
    slack_joined: boolean | null;
    ipad_assigned: boolean | null;
    ramp_phase_1_complete: boolean | null;
    ramp_phase_2_complete: boolean | null;
    ramp_phase_3_complete: boolean | null;
    ramp_phase_4_complete: boolean | null;
  } | null;
}

type ProgressProperty = 
  | 'onboardingComplete' 
  | 'trainingsComplete' 
  | 'slackJoined' 
  | 'ipadAssigned'
  | 'rampPhase1Complete'
  | 'rampPhase2Complete'
  | 'rampPhase3Complete'
  | 'rampPhase4Complete';

export const EditableRecruitProgress = ({ recruit, repData }: EditableRecruitProgressProps) => {
  const queryClient = useQueryClient();
  const [updatingProperty, setUpdatingProperty] = useState<string | null>(null);

  // Get values from repData (Supabase) or recruit (Notion)
  const onboardingComplete = repData?.onboarding_complete ?? recruit.onboardingComplete ?? false;
  const trainingsComplete = repData?.trainings_complete ?? recruit.trainingsComplete ?? false;
  const slackJoined = repData?.slack_joined ?? recruit.slackJoined ?? false;
  const ipadAssigned = repData?.ipad_assigned ?? recruit.ipadAssigned ?? false;
  const phase1 = repData?.ramp_phase_1_complete ?? recruit.rampPhase1Complete ?? false;
  const phase2 = repData?.ramp_phase_2_complete ?? recruit.rampPhase2Complete ?? false;
  const phase3 = repData?.ramp_phase_3_complete ?? recruit.rampPhase3Complete ?? false;
  const phase4 = repData?.ramp_phase_4_complete ?? recruit.rampPhase4Complete ?? false;

  // Determine current phase
  const isOnboarding = !slackJoined;
  const isRampToBlitz = slackJoined && !phase4;
  const isReady = phase4;

  const updateMutation = useMutation({
    mutationFn: async ({ property, value }: { property: ProgressProperty; value: boolean }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('update-recruit-progress', {
        body: {
          recruitNotionId: recruit.notionPageId,
          property,
          value,
        },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-recruits'] });
      queryClient.invalidateQueries({ queryKey: ['rep-data'] });
      toast.success('Progress updated');
    },
    onError: (error) => {
      console.error('Failed to update progress:', error);
      toast.error('Failed to update progress');
    },
    onSettled: () => {
      setUpdatingProperty(null);
    },
  });

  const handleToggle = (property: ProgressProperty, currentValue: boolean) => {
    setUpdatingProperty(property);
    updateMutation.mutate({ property, value: !currentValue });
  };

  const ProgressItem = ({ 
    property, 
    label, 
    checked, 
    disabled = false 
  }: { 
    property: ProgressProperty; 
    label: string; 
    checked: boolean;
    disabled?: boolean;
  }) => {
    const isUpdating = updatingProperty === property;
    
    return (
      <div className="flex items-center justify-between py-1.5 group">
        <div className="flex items-center gap-2">
          {isUpdating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          ) : checked ? (
            <Check className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <div className="h-3.5 w-3.5 rounded border border-muted-foreground/40" />
          )}
          <span className={`text-sm ${checked ? 'text-muted-foreground line-through' : ''}`}>
            {label}
          </span>
        </div>
        <Checkbox
          checked={checked}
          disabled={disabled || isUpdating}
          onCheckedChange={() => handleToggle(property, checked)}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
        />
      </div>
    );
  };

  // Don't show if everything is complete
  if (isReady && onboardingComplete && trainingsComplete && slackJoined) {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-medium text-emerald-700">Blitz Ready!</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg p-3 ${
      isReady 
        ? 'bg-emerald-500/10 border border-emerald-500/30' 
        : isRampToBlitz 
          ? 'bg-purple-500/10 border border-purple-500/30'
          : 'bg-amber-500/10 border border-amber-500/30'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        {isReady ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        ) : isRampToBlitz ? (
          <AlertTriangle className="h-4 w-4 text-purple-600" />
        ) : (
          <AlertCircle className="h-4 w-4 text-amber-600" />
        )}
        <span className={`text-sm font-medium ${
          isReady 
            ? 'text-emerald-700' 
            : isRampToBlitz 
              ? 'text-purple-700'
              : 'text-amber-700'
        }`}>
          {isReady 
            ? 'Blitz Ready!' 
            : isRampToBlitz 
              ? 'In Ramp to Blitz'
              : 'Onboarding in Progress'}
        </span>
        <span className="text-xs text-muted-foreground ml-auto">tap to update</span>
      </div>
      
      {/* Onboarding Progress Steps */}
      {isOnboarding && (
        <div className="space-y-0.5">
          <ProgressItem 
            property="onboardingComplete" 
            label="Onboarding Video" 
            checked={onboardingComplete} 
          />
          <ProgressItem 
            property="trainingsComplete" 
            label="Required Trainings" 
            checked={trainingsComplete} 
          />
          <ProgressItem 
            property="slackJoined" 
            label="Joined Slack" 
            checked={slackJoined} 
          />
        </div>
      )}
      
      {/* Ramp to Blitz Progress */}
      {isRampToBlitz && (
        <div className="space-y-0.5">
          <ProgressItem 
            property="rampPhase1Complete" 
            label="Phase 1: Onboard & Get Ready" 
            checked={phase1} 
          />
          <ProgressItem 
            property="rampPhase2Complete" 
            label="Phase 2: Start Training" 
            checked={phase2}
            disabled={!phase1}
          />
          <ProgressItem 
            property="rampPhase3Complete" 
            label="Phase 3: Practice" 
            checked={phase3}
            disabled={!phase2}
          />
          <ProgressItem 
            property="rampPhase4Complete" 
            label="Phase 4: Saddle Up" 
            checked={phase4}
            disabled={!phase3}
          />
        </div>
      )}

      {/* iPad Assignment - always show for onboarding/ramp phase */}
      {!isReady && (
        <div className="mt-2 pt-2 border-t border-border/50">
          <ProgressItem 
            property="ipadAssigned" 
            label="iPad Assigned" 
            checked={ipadAssigned} 
          />
        </div>
      )}
    </div>
  );
};
