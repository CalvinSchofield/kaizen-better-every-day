import { Check, X, CheckCircle2, AlertCircle, AlertTriangle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Recruit } from "@/hooks/useGroupRecruits";
import { RecruitRepData, RecruitGoals } from "../types";
import { getFirstName } from "../utils";

interface ProgressTabProps {
  recruit: Recruit;
  recruitRepData: RecruitRepData | null;
  recruitGoals: RecruitGoals | null;
  recruitYtdFP: number;
  onOnboardingStepClick: (field: string, label: string, currentValue: boolean) => void;
}

export const ProgressTab = ({
  recruit,
  recruitRepData,
  recruitGoals,
  recruitYtdFP,
  onOnboardingStepClick
}: ProgressTabProps) => {
  const recruitFirstName = getFirstName(recruit.name);
  const isRookie = recruitRepData && (recruitRepData.year === 'Rookie' || !recruitRepData.year);
  
  if (!recruitRepData) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">No progress data available</p>
      </div>
    );
  }

  // Determine current phase
  const getCurrentPhase = () => {
    if (recruitRepData.ramp_phase_4_complete) return 'complete';
    if (recruitRepData.ramp_phase_3_complete) return 'phase4';
    if (recruitRepData.ramp_phase_2_complete) return 'phase3';
    if (recruitRepData.ramp_phase_1_complete) return 'phase2';
    if (recruitRepData.slack_joined) return 'phase1';
    if (recruitRepData.trainings_complete) return 'slack';
    if (recruitRepData.onboarding_complete) return 'trainings';
    return 'onboarding';
  };
  
  const currentPhase = getCurrentPhase();

  return (
    <div className="space-y-4">
      {/* Readiness Status Card */}
      {isRookie && (
        <div className={`rounded-xl p-4 ${
          recruitRepData.ramp_phase_4_complete 
            ? 'bg-emerald-500/10 border border-emerald-500/30'
            : recruitRepData.slack_joined 
              ? 'bg-purple-500/10 border border-purple-500/30'
              : 'bg-amber-500/10 border border-amber-500/30'
        }`}>
          <div className="flex items-center gap-3 mb-3">
            {recruitRepData.ramp_phase_4_complete ? (
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
            ) : recruitRepData.slack_joined ? (
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-purple-600" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-amber-600" />
              </div>
            )}
            <div>
              <h3 className={`font-semibold ${
                recruitRepData.ramp_phase_4_complete 
                  ? 'text-emerald-700 dark:text-emerald-400' 
                  : recruitRepData.slack_joined 
                    ? 'text-purple-700 dark:text-purple-400'
                    : 'text-amber-700 dark:text-amber-400'
              }`}>
                {recruitRepData.ramp_phase_4_complete 
                  ? 'Blitz Ready!' 
                  : recruitRepData.slack_joined 
                    ? 'In Ramp to Blitz'
                    : 'Onboarding in Progress'}
              </h3>
              <p className="text-xs text-muted-foreground">
                {recruitRepData.ramp_phase_4_complete 
                  ? `${recruitFirstName} has completed all prep`
                  : `${recruitFirstName} is working through the process`}
              </p>
            </div>
          </div>
          
          {/* Progress Steps */}
          <div className="space-y-2">
            {/* Onboarding Phase */}
            {!recruitRepData.slack_joined && (
              <>
                <ProgressStep 
                  label="Onboarding Video" 
                  complete={recruitRepData.onboarding_complete} 
                  active={currentPhase === 'onboarding'}
                />
                <ProgressStep 
                  label="Required Trainings" 
                  complete={recruitRepData.trainings_complete} 
                  active={currentPhase === 'trainings'}
                />
                <ProgressStep 
                  label="Join Slack" 
                  complete={recruitRepData.slack_joined} 
                  active={currentPhase === 'slack'}
                />
              </>
            )}
            
            {/* Ramp to Blitz Phase */}
            {recruitRepData.slack_joined && !recruitRepData.ramp_phase_4_complete && (
              <>
                <ProgressStep 
                  label="Phase 1: Onboard & Get Ready" 
                  complete={recruitRepData.ramp_phase_1_complete} 
                  active={currentPhase === 'phase1'}
                />
                <ProgressStep 
                  label="Phase 2: Start Training" 
                  complete={recruitRepData.ramp_phase_2_complete} 
                  active={currentPhase === 'phase2'}
                />
                <ProgressStep 
                  label="Phase 3: Practice" 
                  complete={recruitRepData.ramp_phase_3_complete} 
                  active={currentPhase === 'phase3'}
                />
                <ProgressStep 
                  label="Phase 4: Saddle Up" 
                  complete={recruitRepData.ramp_phase_4_complete} 
                  active={currentPhase === 'phase4'}
                />
              </>
            )}
          </div>
        </div>
      )}
      
      {/* Onboarding Step Selector */}
      {isRookie && !recruitRepData.ramp_phase_4_complete && (
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Mark Step Complete</Label>
          <Select 
            value={
              recruitRepData.ramp_phase_4_complete ? 'ramp_phase_4_complete' :
              recruitRepData.ramp_phase_3_complete ? 'ramp_phase_3_complete' :
              recruitRepData.ramp_phase_2_complete ? 'ramp_phase_2_complete' :
              recruitRepData.ramp_phase_1_complete ? 'ramp_phase_1_complete' :
              recruitRepData.slack_joined ? 'slack_joined' :
              recruitRepData.trainings_complete ? 'trainings_complete' :
              recruitRepData.onboarding_complete ? 'onboarding_complete' :
              'none'
            }
            onValueChange={(value) => {
              const stepLabels: Record<string, string> = {
                'onboarding_complete': 'Onboarding ✅',
                'trainings_complete': 'Trainings ✅',
                'slack_joined': 'Slack Joined',
                'ramp_phase_1_complete': 'Phase 1 ✅',
                'ramp_phase_2_complete': 'Phase 2 ✅',
                'ramp_phase_3_complete': 'Phase 3 ✅',
                'ramp_phase_4_complete': 'Phase 4 ✅',
              };
              if (value !== 'none') {
                onOnboardingStepClick(value, stepLabels[value] || value, false);
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select completed step..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not started</SelectItem>
              <SelectItem value="onboarding_complete">Onboarding ✅</SelectItem>
              <SelectItem value="trainings_complete">Trainings ✅</SelectItem>
              <SelectItem value="slack_joined">Slack Joined</SelectItem>
              <SelectItem value="ramp_phase_1_complete">Phase 1 ✅</SelectItem>
              <SelectItem value="ramp_phase_2_complete">Phase 2 ✅</SelectItem>
              <SelectItem value="ramp_phase_3_complete">Phase 3 ✅</SelectItem>
              <SelectItem value="ramp_phase_4_complete">Phase 4 ✅</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      
      {/* Preseason FP+ Goal Progress */}
      {recruitGoals?.preseason_fp_goal && recruitGoals.preseason_fp_goal > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Preseason FP+ Goal</span>
            <span className="text-sm">
              <span className="font-semibold text-primary">{(recruitYtdFP || 0).toFixed(1)}</span>
              <span className="text-muted-foreground"> / {recruitGoals.preseason_fp_goal}</span>
            </span>
          </div>
          <Progress 
            value={Math.min(((recruitYtdFP || 0) / recruitGoals.preseason_fp_goal) * 100, 100)} 
            className="h-2"
          />
          {(recruitYtdFP || 0) >= recruitGoals.preseason_fp_goal && (
            <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
              <Check className="h-3 w-3" />
              Goal reached!
            </p>
          )}
        </div>
      )}
      
      {/* YTD FP+ for reps with sales but no preseason goal */}
      {recruitYtdFP > 0 && !(recruitGoals?.preseason_fp_goal && recruitGoals.preseason_fp_goal > 0) && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">YTD FP+</span>
            <span className="text-xl font-bold text-emerald-600">
              {recruitYtdFP.toFixed(1)}
            </span>
          </div>
          {recruitYtdFP >= 5 && recruit.stage === 'Sold 💲' && (
            <p className="text-xs text-amber-600 mt-2">
              ⚠️ Has 5+ FP+ - should be "Sold (5+) 💰"
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// Progress Step Component
const ProgressStep = ({ 
  label, 
  complete, 
  active 
}: { 
  label: string; 
  complete?: boolean; 
  active?: boolean;
}) => (
  <div className={`flex items-center gap-2 text-sm ${active ? 'font-medium' : ''}`}>
    {complete ? (
      <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
        <Check className="h-3 w-3 text-emerald-600" />
      </div>
    ) : (
      <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
        active ? 'bg-primary/20 border-2 border-primary' : 'bg-muted'
      }`}>
        {active && <div className="w-2 h-2 rounded-full bg-primary" />}
      </div>
    )}
    <span className={complete ? 'text-muted-foreground' : active ? 'text-foreground' : 'text-muted-foreground'}>
      {label}
    </span>
  </div>
);
