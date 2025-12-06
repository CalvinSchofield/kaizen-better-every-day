import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  BookOpen, 
  Clock, 
  Users, 
  Calendar, 
  Plane, 
  Target,
  Plus,
  Minus,
  Check,
  Settings2
} from "lucide-react";
import { RepGoals } from "@/hooks/useRepGoals";
import { cn } from "@/lib/utils";
import { useEfpMode } from "@/hooks/useEfpMode";
import { useRepData } from "@/hooks/useRepData";
import { useBlitzes } from "@/hooks/useBlitzes";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";

interface CommitmentsTrackerProps {
  goals: RepGoals;
  preseasonFpProgress: number;
  onUpdateGoals: (updates: Partial<RepGoals>) => Promise<unknown>;
  isUpdating?: boolean;
}

interface Commitment {
  key: string;
  progressKey: string;
  label: string;
  icon: typeof BookOpen;
  unit: string;
  color: string;
  bgColor: string;
  description: string;
  incrementBy?: number;
  autoTracked?: boolean;
  maxValue?: number;
}

const baseCommitments: Omit<Commitment, 'label' | 'unit' | 'description' | 'maxValue'>[] = [
  {
    key: 'training_hours_goal',
    progressKey: 'training_hours_progress',
    icon: Clock,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    incrementBy: 5,
  },
  {
    key: 'books_goal',
    progressKey: 'books_progress',
    icon: BookOpen,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    incrementBy: 1,
  },
  {
    key: 'role_plays_goal',
    progressKey: 'role_plays_progress',
    icon: Users,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    incrementBy: 1,
  },
  {
    key: 'monday_night_lights_goal',
    progressKey: 'monday_night_lights_progress',
    icon: Calendar,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    incrementBy: 1,
  },
  {
    key: 'blitzes_goal',
    progressKey: 'blitzes_progress',
    icon: Plane,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    incrementBy: 1,
    autoTracked: true,
  },
];

const commitmentLabels: Record<string, { label: string; unit: string; description: string }> = {
  training_hours_goal: { label: 'Training Hours', unit: 'hrs', description: 'Hours in training sessions' },
  books_goal: { label: 'Books Read', unit: 'books', description: 'Sales/mindset books' },
  role_plays_goal: { label: 'Role Plays', unit: 'sessions', description: 'Practice sessions with vets' },
  monday_night_lights_goal: { label: 'Monday Night Lights', unit: 'calls', description: 'Weekly team calls' },
  blitzes_goal: { label: 'Blitzes', unit: 'trips', description: 'Auto-tracked from your commits' },
};

export const CommitmentsTracker = ({
  goals,
  preseasonFpProgress,
  onUpdateGoals,
  isUpdating = false,
}: CommitmentsTrackerProps) => {
  const { efpModeEnabled } = useEfpMode();
  const { repData } = useRepData();
  const { allBlitzes } = useBlitzes();
  const metricLabel = efpModeEnabled ? 'EFP' : 'FP+';
  
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [editingGoals, setEditingGoals] = useState<Record<string, number>>({});

  // Calculate blitz stats
  const blitzStats = useMemo(() => {
    const committedBlitzes = (repData?.committed_blitzes as string[]) || [];
    const blitzesAttended = goals.blitzes_progress || 0;
    const blitzesRemaining = allBlitzes.length;
    const blitzesCommitted = committedBlitzes.length;
    
    return {
      attended: blitzesAttended,
      committed: blitzesCommitted,
      remaining: blitzesRemaining,
      maxGoal: blitzesRemaining,
    };
  }, [repData?.committed_blitzes, goals.blitzes_progress, allBlitzes.length]);

  // Build commitments with dynamic max for blitzes
  const commitments = useMemo((): Commitment[] => {
    const staticCommitments: Commitment[] = baseCommitments.map(c => ({
      ...c,
      label: commitmentLabels[c.key].label,
      unit: commitmentLabels[c.key].unit,
      description: commitmentLabels[c.key].description,
      maxValue: c.key === 'blitzes_goal' ? blitzStats.remaining : undefined,
    }));
    
    // Add preseason FP commitment
    staticCommitments.push({
      key: 'preseason_fp_goal',
      progressKey: 'preseason_fp_goal',
      label: `Preseason ${metricLabel}`,
      icon: Target,
      unit: metricLabel,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      description: `${metricLabel} before summer`,
      incrementBy: 1,
      autoTracked: true,
    });
    
    return staticCommitments;
  }, [metricLabel, blitzStats.remaining]);

  const handleOpenEditDrawer = () => {
    // Initialize with current goal values
    const currentGoals: Record<string, number> = {};
    commitments.forEach(c => {
      if (!c.autoTracked || c.key === 'blitzes_goal') {
        currentGoals[c.key] = Number(goals[c.key as keyof RepGoals]) || 0;
      }
    });
    setEditingGoals(currentGoals);
    setIsEditDrawerOpen(true);
  };

  const handleSaveGoals = async () => {
    await onUpdateGoals(editingGoals as Partial<RepGoals>);
    setIsEditDrawerOpen(false);
  };

  const handleStepperChange = (key: string, delta: number, maxValue?: number) => {
    setEditingGoals(prev => {
      const currentVal = prev[key] || 0;
      const newVal = Math.max(0, currentVal + delta);
      // Cap at maxValue if defined
      return { ...prev, [key]: maxValue !== undefined ? Math.min(newVal, maxValue) : newVal };
    });
  };

  const handleQuickIncrement = async (commitment: Commitment) => {
    if (commitment.autoTracked) return;
    
    const progressKey = commitment.progressKey as keyof RepGoals;
    const currentProgress = Number(goals[progressKey]) || 0;
    const increment = commitment.incrementBy || 1;
    
    await onUpdateGoals({
      [progressKey]: currentProgress + increment,
    } as Partial<RepGoals>);
  };

  const handleQuickDecrement = async (commitment: Commitment) => {
    if (commitment.autoTracked) return;
    
    const progressKey = commitment.progressKey as keyof RepGoals;
    const currentProgress = Number(goals[progressKey]) || 0;
    const increment = commitment.incrementBy || 1;
    
    if (currentProgress >= increment) {
      await onUpdateGoals({
        [progressKey]: currentProgress - increment,
      } as Partial<RepGoals>);
    }
  };

  const getProgress = (commitment: Commitment): number => {
    if (commitment.key === 'preseason_fp_goal') {
      return preseasonFpProgress;
    }
    if (commitment.key === 'blitzes_goal') {
      // Auto-track blitzes from committed blitzes
      return blitzStats.attended;
    }
    const progressKey = commitment.progressKey as keyof RepGoals;
    return Number(goals[progressKey]) || 0;
  };

  const getGoal = (commitment: Commitment): number => {
    const goalKey = commitment.key as keyof RepGoals;
    return Number(goals[goalKey]) || 0;
  };

  const getPercentage = (commitment: Commitment): number => {
    const goal = getGoal(commitment);
    if (goal === 0) return 0;
    return Math.min((getProgress(commitment) / goal) * 100, 100);
  };

  const isComplete = (commitment: Commitment): boolean => {
    return getProgress(commitment) >= getGoal(commitment) && getGoal(commitment) > 0;
  };

  // Filter to only show commitments with goals set, plus always show FP+
  const activeCommitments = commitments.filter(
    c => getGoal(c) > 0 || c.key === 'preseason_fp_goal'
  );

  const hasAnyGoals = commitments.some(c => getGoal(c) > 0);

  // Get commitments that are editable (not fully auto-tracked like FP)
  const editableCommitments = commitments.filter(c => c.key !== 'preseason_fp_goal');

  return (
    <>
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Preseason Commitments
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenEditDrawer}
              className="text-xs"
            >
              <Settings2 className="h-3 w-3 mr-1" />
              Edit Goals
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {!hasAnyGoals ? (
            <div className="text-center py-6">
              <p className="text-muted-foreground text-sm mb-3">
                No preseason commitments set yet
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenEditDrawer}
              >
                <Plus className="h-4 w-4 mr-1" />
                Set Commitments
              </Button>
            </div>
          ) : (
            activeCommitments.map((commitment) => {
              const Icon = commitment.icon;
              const progress = getProgress(commitment);
              const goal = getGoal(commitment);
              const percentage = getPercentage(commitment);
              const complete = isComplete(commitment);
              const isFpCommitment = commitment.key === 'preseason_fp_goal';
              const isAutoTracked = commitment.autoTracked;

              if (goal === 0 && !isFpCommitment) return null;

              return (
                <div
                  key={commitment.key}
                  className={cn(
                    "rounded-xl p-3 transition-all",
                    commitment.bgColor,
                    complete && "ring-2 ring-green-500/50"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={cn("p-1.5 rounded-lg bg-background/50")}>
                        {complete ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Icon className={cn("h-4 w-4", commitment.color)} />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{commitment.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {isFpCommitment 
                            ? `${progress.toFixed(1)} / ${goal} ${commitment.unit}`
                            : `${progress} / ${goal} ${commitment.unit}`
                          }
                        </p>
                      </div>
                    </div>

                    {/* Quick increment/decrement buttons (not for auto-tracked) */}
                    {!isAutoTracked && goal > 0 && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleQuickDecrement(commitment)}
                          disabled={isUpdating || progress <= 0}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleQuickIncrement(commitment)}
                          disabled={isUpdating}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {goal > 0 && (
                    <Progress 
                      value={percentage} 
                      className="h-1.5"
                    />
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Edit Goals Drawer */}
      <Drawer open={isEditDrawerOpen} onOpenChange={setIsEditDrawerOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="text-center pb-2">
            <DrawerTitle>Set Your Goals</DrawerTitle>
            <DrawerDescription>
              Tap + or - to set your preseason commitments
            </DrawerDescription>
          </DrawerHeader>

          <div className="px-4 pb-6 space-y-4 overflow-y-auto">
            {editableCommitments.map((commitment) => {
              const Icon = commitment.icon;
              const currentGoalValue = editingGoals[commitment.key] ?? (Number(goals[commitment.key as keyof RepGoals]) || 0);
              const isBlitzes = commitment.key === 'blitzes_goal';
              const stepAmount = commitment.incrementBy || 1;
              const maxValue = commitment.maxValue;

              return (
                <div 
                  key={commitment.key} 
                  className={cn(
                    "rounded-xl p-4 transition-all",
                    commitment.bgColor
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn("p-2 rounded-lg bg-background/60")}>
                        <Icon className={cn("h-5 w-5", commitment.color)} />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{commitment.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {commitment.description}
                        </p>
                        {isBlitzes && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {blitzStats.remaining} trips left this preseason
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {/* Stepper */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 rounded-full"
                        onClick={() => handleStepperChange(commitment.key, -stepAmount, maxValue)}
                        disabled={currentGoalValue <= 0}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="text-xl font-bold w-12 text-center tabular-nums">
                        {currentGoalValue}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 rounded-full"
                        onClick={() => handleStepperChange(commitment.key, stepAmount, maxValue)}
                        disabled={maxValue !== undefined && currentGoalValue >= maxValue}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}

            <Button 
              onClick={handleSaveGoals} 
              className="w-full mt-4"
              disabled={isUpdating}
              size="lg"
            >
              {isUpdating ? "Saving..." : "Save Goals"}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
};
