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
  const isRookie = recruitRepData && (recruitRepData.year === 'Rookie' || !recruitRepData.year);
  
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

  // Get closest upcoming blitz from committed blitzes
  const upcomingBlitz = useMemo(() => {
    if (!recruitRepData?.committed_blitzes || !allBlitzes.length) return null;
    
    // Normalize committed blitz IDs
    const committedIds = (recruitRepData.committed_blitzes as (string | { id: string })[])
      .map(b => typeof b === 'string' ? b : b.id);
    
    if (committedIds.length === 0) return null;
    
    const today = startOfToday();
    
    // Find all committed blitzes that are upcoming
    const committedUpcoming = allBlitzes
      .filter(blitz => committedIds.includes(blitz.id))
      .filter(blitz => {
        if (!blitz.date) return false;
        const blitzDate = parseISO(blitz.date);
        return isAfter(blitzDate, today) || isSameDay(blitzDate, today);
      })
      .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
    
    if (committedUpcoming.length === 0) return null;
    
    const closest = committedUpcoming[0];
    const daysUntil = differenceInDays(parseISO(closest.date), today);
    
    return {
      name: closest.name,
      date: parseISO(closest.date),
      daysUntil,
      location: closest.location
    };
  }, [recruitRepData?.committed_blitzes, allBlitzes]);

  // Step configuration with field mappings and progressive locking
  const onboardingStepConfigs = [
    { 
      field: 'onboarding_complete', 
      label: 'Basic Onboarding', 
      complete: recruitRepData.onboarding_complete,
      locked: false // First step is never locked
    },
    { 
      field: 'trainings_complete', 
      label: 'Required Trainings', 
      complete: recruitRepData.trainings_complete,
      locked: !recruitRepData.onboarding_complete // Locked until onboarding complete
    },
    { 
      field: 'slack_joined', 
      label: 'Join Slack', 
      complete: recruitRepData.slack_joined,
      locked: !recruitRepData.trainings_complete // Locked until trainings complete
    },
  ];

  const rampStepConfigs = [
    { 
      field: 'ramp_phase_1_complete', 
      label: 'Onboard & Get Ready', 
      complete: recruitRepData.ramp_phase_1_complete, 
      phase: 1,
      locked: !onboardingComplete // Locked until all onboarding complete
    },
    { 
      field: 'ramp_phase_2_complete', 
      label: 'Start Training', 
      complete: recruitRepData.ramp_phase_2_complete, 
      phase: 2,
      locked: !recruitRepData.ramp_phase_1_complete // Locked until phase 1 complete
    },
    { 
      field: 'ramp_phase_3_complete', 
      label: 'Practice', 
      complete: recruitRepData.ramp_phase_3_complete, 
      phase: 3,
      locked: !recruitRepData.ramp_phase_2_complete // Locked until phase 2 complete
    },
    { 
      field: 'ramp_phase_4_complete', 
      label: 'Saddle Up', 
      complete: recruitRepData.ramp_phase_4_complete, 
      phase: 4,
      locked: !recruitRepData.ramp_phase_3_complete // Locked until phase 3 complete
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

          {/* Blitz Ready Banner */}
          {rampComplete && (
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
