import { Check, CheckCircle2, Calendar, Circle, Lock } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Recruit } from "@/hooks/useGroupRecruits";
import { RecruitRepData, RecruitGoals, RecruitSummerConfig } from "../types";
import { getFirstName } from "../utils";
import { format, parseISO, differenceInDays, isAfter, isSameDay, startOfToday } from "date-fns";
import { toast } from "sonner";
import { SummerProgressTab } from "./SummerProgressTab";
import { useBlitzes } from "@/hooks/useBlitzes";
import { useMemo } from "react";
interface DailyEntry {
  entry_date: string;
  fp_plus: number;
  work_start_time: string | null;
  work_end_time: string | null;
  doors_knocked: number;
  is_finalized: boolean;
}

interface ProgressTabProps {
  recruit: Recruit;
  recruitRepData: RecruitRepData | null;
  recruitGoals: RecruitGoals | null;
  recruitYtdFP: number;
  summerConfig?: RecruitSummerConfig | null;
  summerEntries?: DailyEntry[];
  onOnboardingStepClick: (field: string, label: string, currentValue: boolean) => void;
}

export const ProgressTab = ({
  recruit,
  recruitRepData,
  recruitGoals,
  recruitYtdFP,
  summerConfig,
  summerEntries = [],
  onOnboardingStepClick
}: ProgressTabProps) => {
  const { allBlitzes } = useBlitzes();
  
  const recruitFirstName = getFirstName(recruit.name);
  
  // Use rep data if available, otherwise fall back to recruit data for progress tracking
  // This ensures recruits without email (no rep record) still show progress
  const progressData = recruitRepData ?? {
    year: recruit.year || 'Rookie',
    onboarding_complete: recruit.onboardingComplete ?? false,
    trainings_complete: recruit.trainingsComplete ?? false,
    slack_joined: recruit.slackJoined ?? false,
    ramp_phase_1_complete: recruit.phase1Complete ?? false,
    ramp_phase_2_complete: recruit.phase2Complete ?? false,
    ramp_phase_3_complete: recruit.phase3Complete ?? false,
    ramp_phase_4_complete: recruit.phase4Complete ?? false,
    committed_blitzes: recruit.committedBlitzes ?? [] as (string | { id: string })[],
  };
  
  const isRookie = progressData.year === 'Rookie' || !progressData.year;
  
  // Get committed blitzes from progressData (works for both rep and recruit fallback)
  const committedBlitzes = recruitRepData?.committed_blitzes ?? recruit.committedBlitzes ?? [];
  
  // IMPORTANT: All hooks must be called before any early returns
  // Get closest upcoming blitz from committed blitzes
  const upcomingBlitz = useMemo(() => {
    if (!committedBlitzes.length || !allBlitzes.length) return null;
    
    // Normalize committed blitz IDs
    const committedIds = (committedBlitzes as (string | { id: string; blitz_id?: string })[])
      .map(b => typeof b === 'string' ? b : (b.blitz_id || b.id));
    
    if (committedIds.length === 0) return null;
    
    const todayDate = startOfToday();
    
    // Find all committed blitzes that are upcoming
    const committedUpcoming = allBlitzes
      .filter(blitz => committedIds.includes(blitz.id))
      .filter(blitz => {
        if (!blitz.date) return false;
        const blitzDate = parseISO(blitz.date);
        return isAfter(blitzDate, todayDate) || isSameDay(blitzDate, todayDate);
      })
      .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
    
    if (committedUpcoming.length === 0) return null;
    
    const closest = committedUpcoming[0];
    const daysUntil = differenceInDays(parseISO(closest.date), todayDate);
    
    return {
      name: closest.name,
      date: parseISO(closest.date),
      daysUntil,
      location: closest.location
    };
  }, [committedBlitzes, allBlitzes]);
  
  // Check if recruit is in summer mode
  const today = format(new Date(), 'yyyy-MM-dd');
  const isInSummer = summerConfig?.personalSummerStart && today >= summerConfig.personalSummerStart;
  
  // If in summer and has summer config, show summer progress tab
  if (isInSummer && summerConfig?.personalSummerStart && summerConfig?.personalSummerEnd) {
    return (
      <SummerProgressTab
        recruitName={recruit.name}
        summerStart={summerConfig.personalSummerStart}
        summerEnd={summerConfig.personalSummerEnd}
        goals={recruitGoals}
        entries={summerEntries}
        currentFpPlus={recruitYtdFP}
      />
    );
  }
  
  // Check if recruit is in an early stage (not yet signed)
  const stageLower = (recruit.stage || '').toLowerCase();
  const earlyStages = ['100_list', '100 list', 'evaluating', 'reached_out', 'reached out'];
  const isEarlyStage = earlyStages.some(s => stageLower.includes(s));
  
  // For early-stage recruits, show a simplified view
  if (isEarlyStage) {
    return (
      <div className="space-y-4">
        <div className="text-center py-6 text-muted-foreground">
          <p className="text-sm mb-2">Progress tracking unlocks after signing</p>
          <p className="text-xs">Move {recruitFirstName} to "Signed" to track onboarding & blitz prep</p>
        </div>
        
        {/* Show recruiter info as context */}
        {recruit.recruiterName && (
          <div className="bg-muted/50 border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <span>Recruited by</span>
            </div>
            <p className="font-medium">{recruit.recruiterName}</p>
          </div>
        )}
      </div>
    );
  }

  // Calculate overall progress
  const onboardingSteps = [
    progressData.onboarding_complete,
    progressData.trainings_complete,
    progressData.slack_joined
  ];
  const rampSteps = [
    progressData.ramp_phase_1_complete,
    progressData.ramp_phase_2_complete,
    progressData.ramp_phase_3_complete,
    progressData.ramp_phase_4_complete
  ];
  
  const onboardingComplete = onboardingSteps.every(Boolean);
  const rampComplete = rampSteps.every(Boolean);
  const totalSteps = 7;
  const completedSteps = [...onboardingSteps, ...rampSteps].filter(Boolean).length;
  const progressPercent = (completedSteps / totalSteps) * 100;

  // Determine current active step
  const getCurrentStep = () => {
    if (!progressData.onboarding_complete) return 'onboarding';
    if (!progressData.trainings_complete) return 'trainings';
    if (!progressData.slack_joined) return 'slack';
    if (!progressData.ramp_phase_1_complete) return 'phase1';
    if (!progressData.ramp_phase_2_complete) return 'phase2';
    if (!progressData.ramp_phase_3_complete) return 'phase3';
    if (!progressData.ramp_phase_4_complete) return 'phase4';
    return 'complete';
  };
  
  const currentStep = getCurrentStep();


  // Step configuration with field mappings and progressive locking
  const onboardingStepConfigs = [
    { 
      field: 'onboarding_complete', 
      label: 'Basic Onboarding', 
      complete: progressData.onboarding_complete,
      locked: false // First step is never locked
    },
    { 
      field: 'trainings_complete', 
      label: 'Required Trainings', 
      complete: progressData.trainings_complete,
      locked: !progressData.onboarding_complete // Locked until onboarding complete
    },
    { 
      field: 'slack_joined', 
      label: 'Join Slack', 
      complete: progressData.slack_joined,
      locked: !progressData.trainings_complete // Locked until trainings complete
    },
  ];

  const rampStepConfigs = [
    { 
      field: 'ramp_phase_1_complete', 
      label: 'Onboard & Get Ready', 
      complete: progressData.ramp_phase_1_complete, 
      phase: 1,
      locked: !onboardingComplete // Locked until all onboarding complete
    },
    { 
      field: 'ramp_phase_2_complete', 
      label: 'Start Training', 
      complete: progressData.ramp_phase_2_complete, 
      phase: 2,
      locked: !progressData.ramp_phase_1_complete // Locked until phase 1 complete
    },
    { 
      field: 'ramp_phase_3_complete', 
      label: 'Practice', 
      complete: progressData.ramp_phase_3_complete, 
      phase: 3,
      locked: !progressData.ramp_phase_2_complete // Locked until phase 2 complete
    },
    { 
      field: 'ramp_phase_4_complete', 
      label: 'Saddle Up', 
      complete: progressData.ramp_phase_4_complete, 
      phase: 4,
      locked: !progressData.ramp_phase_3_complete // Locked until phase 3 complete
    },
  ];

  const handleStepClick = (step: typeof onboardingStepConfigs[0] | typeof rampStepConfigs[0]) => {
    // Allow clicking completed steps to uncomplete them
    if (step.locked && !step.complete) {
      toast.error('Complete the previous step first');
      return;
    }
    // Pass info to parent for confirmation drawer
    onOnboardingStepClick(step.field, step.label, !!step.complete);
  };

  return (
    <div className="space-y-4">
      {isRookie && (
        <>
          {/* Upcoming Blitz Context - Top Banner */}
          {upcomingBlitz && !rampComplete && (
            <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-xl ${
              upcomingBlitz.daysUntil <= 7 
                ? 'bg-destructive/10 text-destructive border border-destructive/20' 
                : upcomingBlitz.daysUntil <= 14 
                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                  : 'bg-primary/10 text-primary border border-primary/20'
            }`}>
              <Calendar className="h-4 w-4 shrink-0" />
              <span className="font-medium">{upcomingBlitz.name}</span>
              <span className="opacity-60">·</span>
              <span>
                {upcomingBlitz.daysUntil === 0 
                  ? 'Today!' 
                  : upcomingBlitz.daysUntil === 1 
                    ? 'Tomorrow' 
                    : `${upcomingBlitz.daysUntil} days away`}
              </span>
            </div>
          )}

          {/* Blitz Ready Banner - only show if upcoming blitz exists */}
          {rampComplete && upcomingBlitz && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <span className="font-semibold text-emerald-600">Blitz Ready!</span>
            </div>
          )}

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
              {onboardingStepConfigs.map((step, index) => (
                <ProgressStep 
                  key={step.field}
                  label={step.label} 
                  complete={step.complete} 
                  active={currentStep === step.field.replace('_complete', '').replace('slack_joined', 'slack')}
                  isLast={index === onboardingStepConfigs.length - 1}
                  locked={step.locked}
                  onClick={() => handleStepClick(step)}
                />
              ))}
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
              !onboardingComplete ? 'opacity-50 pointer-events-none' : ''
            }`}>
              {rampStepConfigs.map((step, index) => (
                <ProgressStep 
                  key={step.field}
                  label={step.label} 
                  complete={step.complete} 
                  active={currentStep === `phase${step.phase}`}
                  isLast={index === rampStepConfigs.length - 1}
                  locked={step.locked}
                  onClick={() => handleStepClick(step)}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Progress Step Component - Clickable with filled/outline circles
const ProgressStep = ({ 
  label, 
  complete, 
  active,
  isLast,
  locked,
  onClick
}: { 
  label: string; 
  complete?: boolean; 
  active?: boolean;
  isLast?: boolean;
  locked?: boolean;
  onClick?: () => void;
}) => {
  // Determine if step is actually locked (locked AND not complete)
  const isActuallyLocked = locked && !complete;
  
  return (
    <button 
      className={`flex items-center gap-3 px-4 py-3 w-full text-left transition-colors ${
        !isLast ? 'border-b border-border' : ''
      } ${isActuallyLocked ? 'cursor-not-allowed opacity-50' : 'hover:bg-muted/50 active:bg-muted cursor-pointer'}`}
      onClick={onClick}
    >
      {complete ? (
        // Filled circle for completed
        <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
          <Check className="h-3.5 w-3.5 text-white" />
        </div>
      ) : isActuallyLocked ? (
        // Lock icon for locked steps
        <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center shrink-0">
          <Lock className="h-3 w-3 text-muted-foreground/50" />
        </div>
      ) : active ? (
        // Outline primary circle for current
        <div className="w-6 h-6 rounded-full border-2 border-primary flex items-center justify-center shrink-0">
          <Circle className="h-2.5 w-2.5 fill-primary text-primary" />
        </div>
      ) : (
        // Empty outline circle for pending
        <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/30 shrink-0" />
      )}
      <span className={`text-sm flex-1 ${
        complete ? 'text-foreground' : 
        active ? 'text-foreground font-medium' : 
        'text-muted-foreground'
      }`}>
        {label}
      </span>
      {active && !isActuallyLocked && (
        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
          Current
        </span>
      )}
    </button>
  );
};
