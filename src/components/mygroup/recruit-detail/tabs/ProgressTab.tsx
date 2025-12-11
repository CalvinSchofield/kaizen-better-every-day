import { Check, CheckCircle2, Calendar } from "lucide-react";
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
import { format, parseISO, differenceInDays } from "date-fns";

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

  // Calculate overall progress
  const onboardingSteps = [
    recruitRepData.onboarding_complete,
    recruitRepData.trainings_complete,
    recruitRepData.slack_joined
  ];
  const rampSteps = [
    recruitRepData.ramp_phase_1_complete,
    recruitRepData.ramp_phase_2_complete,
    recruitRepData.ramp_phase_3_complete,
    recruitRepData.ramp_phase_4_complete
  ];
  
  const onboardingComplete = onboardingSteps.every(Boolean);
  const rampComplete = rampSteps.every(Boolean);
  const totalSteps = 7;
  const completedSteps = [...onboardingSteps, ...rampSteps].filter(Boolean).length;
  const progressPercent = (completedSteps / totalSteps) * 100;

  // Determine current active step
  const getCurrentStep = () => {
    if (!recruitRepData.onboarding_complete) return 'onboarding';
    if (!recruitRepData.trainings_complete) return 'trainings';
    if (!recruitRepData.slack_joined) return 'slack';
    if (!recruitRepData.ramp_phase_1_complete) return 'phase1';
    if (!recruitRepData.ramp_phase_2_complete) return 'phase2';
    if (!recruitRepData.ramp_phase_3_complete) return 'phase3';
    if (!recruitRepData.ramp_phase_4_complete) return 'phase4';
    return 'complete';
  };
  
  const currentStep = getCurrentStep();

  // Get upcoming blitz info
  const getUpcomingBlitz = () => {
    if (!recruitRepData.blitz_trip_date || !recruitRepData.blitz_trip_name) return null;
    try {
      const blitzDate = parseISO(recruitRepData.blitz_trip_date);
      const today = new Date();
      const daysUntil = differenceInDays(blitzDate, today);
      if (daysUntil < 0) return null; // Past blitz
      return {
        name: recruitRepData.blitz_trip_name,
        date: blitzDate,
        daysUntil,
        location: recruitRepData.blitz_trip_location
      };
    } catch {
      return null;
    }
  };
  
  const upcomingBlitz = getUpcomingBlitz();

  return (
    <div className="space-y-4">
      {isRookie && (
        <>
          {/* Overall Progress Header */}
          <div className={`rounded-xl p-4 ${
            rampComplete 
              ? 'bg-emerald-500/10 border border-emerald-500/30'
              : 'bg-card border border-border'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {rampComplete ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-primary flex items-center justify-center">
                    <span className="text-[10px] font-bold text-primary">{completedSteps}</span>
                  </div>
                )}
                <span className={`font-semibold ${rampComplete ? 'text-emerald-600' : 'text-foreground'}`}>
                  {rampComplete ? 'Blitz Ready!' : `${completedSteps} of ${totalSteps} steps complete`}
                </span>
              </div>
              <span className="text-sm text-muted-foreground">{Math.round(progressPercent)}%</span>
            </div>
            
            {/* Upcoming Blitz Context */}
            {upcomingBlitz && !rampComplete && (
              <div className={`flex items-center gap-2 text-xs mb-2 px-2 py-1.5 rounded-lg ${
                upcomingBlitz.daysUntil <= 7 
                  ? 'bg-destructive/10 text-destructive' 
                  : upcomingBlitz.daysUntil <= 14 
                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                    : 'bg-primary/10 text-primary'
              }`}>
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <span className="font-medium">{upcomingBlitz.name}</span>
                <span>·</span>
                <span>
                  {upcomingBlitz.daysUntil === 0 
                    ? 'Today!' 
                    : upcomingBlitz.daysUntil === 1 
                      ? 'Tomorrow' 
                      : `${upcomingBlitz.daysUntil} days away`}
                </span>
              </div>
            )}
            
            <Progress value={progressPercent} className="h-2" />
          </div>

          {/* Onboarding Section */}
          <div className="space-y-1">
            <div className="flex items-center justify-between px-1 mb-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Onboarding
              </h4>
              {onboardingComplete && (
                <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                  <Check className="h-3 w-3" /> Complete
                </span>
              )}
            </div>
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <ProgressStep 
                label="Basic Onboarding" 
                complete={recruitRepData.onboarding_complete} 
                active={currentStep === 'onboarding'}
                stepNumber={1}
              />
              <ProgressStep 
                label="Required Trainings" 
                complete={recruitRepData.trainings_complete} 
                active={currentStep === 'trainings'}
                stepNumber={2}
              />
              <ProgressStep 
                label="Join Slack" 
                complete={recruitRepData.slack_joined} 
                active={currentStep === 'slack'}
                stepNumber={3}
                isLast
              />
            </div>
          </div>

          {/* Ramp to Blitz Section */}
          <div className="space-y-1">
            <div className="flex items-center justify-between px-1 mb-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Ramp to Blitz
              </h4>
              {rampComplete && (
                <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                  <Check className="h-3 w-3" /> Complete
                </span>
              )}
            </div>
            <div className={`bg-card border border-border rounded-xl overflow-hidden ${
              !onboardingComplete ? 'opacity-50' : ''
            }`}>
              <ProgressStep 
                label="Onboard & Get Ready" 
                complete={recruitRepData.ramp_phase_1_complete} 
                active={currentStep === 'phase1'}
                stepNumber={1}
                locked={!onboardingComplete}
              />
              <ProgressStep 
                label="Start Training" 
                complete={recruitRepData.ramp_phase_2_complete} 
                active={currentStep === 'phase2'}
                stepNumber={2}
                locked={!onboardingComplete}
              />
              <ProgressStep 
                label="Practice" 
                complete={recruitRepData.ramp_phase_3_complete} 
                active={currentStep === 'phase3'}
                stepNumber={3}
                locked={!onboardingComplete}
              />
              <ProgressStep 
                label="Saddle Up" 
                complete={recruitRepData.ramp_phase_4_complete} 
                active={currentStep === 'phase4'}
                stepNumber={4}
                isLast
                locked={!onboardingComplete}
              />
            </div>
          </div>

          {/* Step Selector */}
          {!rampComplete && (
            <div className="space-y-2 pt-2">
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
                    'onboarding_complete': 'Basic Onboarding ✅',
                    'trainings_complete': 'Required Trainings ✅',
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
                  <SelectItem value="onboarding_complete">Basic Onboarding ✅</SelectItem>
                  <SelectItem value="trainings_complete">Required Trainings ✅</SelectItem>
                  <SelectItem value="slack_joined">Slack Joined</SelectItem>
                  <SelectItem value="ramp_phase_1_complete">Phase 1: Onboard & Get Ready ✅</SelectItem>
                  <SelectItem value="ramp_phase_2_complete">Phase 2: Start Training ✅</SelectItem>
                  <SelectItem value="ramp_phase_3_complete">Phase 3: Practice ✅</SelectItem>
                  <SelectItem value="ramp_phase_4_complete">Phase 4: Saddle Up ✅</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </>
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
  active,
  stepNumber,
  isLast,
  locked
}: { 
  label: string; 
  complete?: boolean; 
  active?: boolean;
  stepNumber: number;
  isLast?: boolean;
  locked?: boolean;
}) => (
  <div className={`flex items-center gap-3 px-4 py-3 ${!isLast ? 'border-b border-border' : ''} ${
    locked ? 'opacity-50' : ''
  }`}>
    {complete ? (
      <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
        <Check className="h-3.5 w-3.5 text-white" />
      </div>
    ) : active ? (
      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0">
        <span className="text-xs font-bold text-primary-foreground">{stepNumber}</span>
      </div>
    ) : (
      <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center shrink-0">
        <span className="text-xs text-muted-foreground">{stepNumber}</span>
      </div>
    )}
    <span className={`text-sm ${
      complete ? 'text-muted-foreground line-through' : 
      active ? 'text-foreground font-medium' : 
      'text-muted-foreground'
    }`}>
      {label}
    </span>
    {active && !locked && (
      <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
        Current
      </span>
    )}
  </div>
);
