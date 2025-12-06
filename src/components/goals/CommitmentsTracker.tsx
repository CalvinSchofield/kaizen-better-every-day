import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Pencil
} from "lucide-react";
import { RepGoals } from "@/hooks/useRepGoals";
import { cn } from "@/lib/utils";
import { useEfpMode } from "@/hooks/useEfpMode";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";

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
}

const baseCommitments: Omit<Commitment, 'label' | 'unit' | 'description'>[] = [
  {
    key: 'training_hours_goal',
    progressKey: 'training_hours_progress',
    icon: Clock,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    incrementBy: 1,
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
  },
];

// Build full commitments list with static labels
const commitmentLabels: Record<string, { label: string; unit: string; description: string }> = {
  training_hours_goal: { label: 'Training Hours', unit: 'hrs', description: 'Hours spent in training sessions' },
  books_goal: { label: 'Books Read', unit: 'books', description: 'Sales/mindset books completed' },
  role_plays_goal: { label: 'Role Plays', unit: 'sessions', description: 'Practice sessions with vets' },
  monday_night_lights_goal: { label: 'Monday Night Lights', unit: 'calls', description: 'Weekly team calls attended' },
  blitzes_goal: { label: 'Blitzes', unit: 'trips', description: 'Preseason blitz trips attended' },
};

// Get the full commitments array with dynamic preseason label
const getCommitments = (metricLabel: string): Commitment[] => {
  const staticCommitments: Commitment[] = baseCommitments.map(c => ({
    ...c,
    label: commitmentLabels[c.key].label,
    unit: commitmentLabels[c.key].unit,
    description: commitmentLabels[c.key].description,
  }));
  
  // Add the preseason commitment with dynamic label
  staticCommitments.push({
    key: 'preseason_fp_goal',
    progressKey: 'preseason_fp_goal',
    label: `Preseason ${metricLabel}`,
    icon: Target,
    unit: metricLabel,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    description: `${metricLabel} earned before summer`,
    incrementBy: 0.5,
  });
  
  return staticCommitments;
};

export const CommitmentsTracker = ({
  goals,
  preseasonFpProgress,
  onUpdateGoals,
  isUpdating = false,
}: CommitmentsTrackerProps) => {
  const { efpModeEnabled } = useEfpMode();
  const metricLabel = efpModeEnabled ? 'EFP' : 'FP+';
  const commitments = getCommitments(metricLabel);
  
  const [editingCommitment, setEditingCommitment] = useState<Commitment | null>(null);
  const [editGoalValue, setEditGoalValue] = useState<number>(0);
  const [editProgressValue, setEditProgressValue] = useState<number>(0);

  const handleOpenEdit = (commitment: Commitment) => {
    setEditingCommitment(commitment);
    setEditGoalValue(Number(goals[commitment.key]) || 0);
    setEditProgressValue(
      commitment.key === 'preseason_fp_goal' 
        ? preseasonFpProgress 
        : Number(goals[commitment.progressKey]) || 0
    );
  };

  const handleSaveGoal = async () => {
    if (!editingCommitment) return;
    
    // Save all commitments at once
    const updates: Record<string, number> = {};
    
    commitments.forEach((commitment) => {
      const goalKey = commitment.key as string;
      const progressKey = commitment.progressKey as string;
      
      if (commitment.key === editingCommitment.key) {
        updates[goalKey] = editGoalValue;
        if (commitment.key !== 'preseason_fp_goal') {
          updates[progressKey] = editProgressValue;
        }
      }
    });
    
    await onUpdateGoals(updates as Partial<RepGoals>);
    setEditingCommitment(null);
  };

  const handleQuickIncrement = async (commitment: Commitment) => {
    if (commitment.key === 'preseason_fp_goal') return; // Can't manually increment FP
    
    const progressKey = commitment.progressKey as keyof RepGoals;
    const currentProgress = Number(goals[progressKey]) || 0;
    const increment = commitment.incrementBy || 1;
    
    await onUpdateGoals({
      [progressKey]: currentProgress + increment,
    } as Partial<RepGoals>);
  };

  const handleQuickDecrement = async (commitment: Commitment) => {
    if (commitment.key === 'preseason_fp_goal') return;
    
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
              onClick={() => handleOpenEdit(commitments[0])}
              className="text-xs"
            >
              <Pencil className="h-3 w-3 mr-1" />
              Edit
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
                onClick={() => handleOpenEdit(commitments[0])}
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
                          {progress.toFixed(commitment.key === 'preseason_fp_goal' ? 1 : 0)} / {goal} {commitment.unit}
                        </p>
                      </div>
                    </div>

                    {/* Quick increment/decrement buttons (not for FP) */}
                    {!isFpCommitment && goal > 0 && (
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

      {/* Edit Sheet */}
      <Sheet open={!!editingCommitment} onOpenChange={() => setEditingCommitment(null)}>
        <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Preseason Commitments</SheetTitle>
            <SheetDescription>
              Set your goals and track your progress
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {commitments.map((commitment) => {
              const Icon = commitment.icon;
              const isFpCommitment = commitment.key === 'preseason_fp_goal';
              const currentGoal = Number(goals[commitment.key]) || 0;
              const currentProgress = isFpCommitment 
                ? preseasonFpProgress 
                : Number(goals[commitment.progressKey]) || 0;

              return (
                <div key={commitment.key} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className={cn("p-2 rounded-lg", commitment.bgColor)}>
                      <Icon className={cn("h-4 w-4", commitment.color)} />
                    </div>
                    <div>
                      <p className="font-medium">{commitment.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {commitment.description}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Goal ({commitment.unit})</Label>
                      <Input
                        type="number"
                        value={editingCommitment ? (commitment.key === editingCommitment.key ? editGoalValue : currentGoal) : currentGoal}
                        onChange={(e) => {
                          if (editingCommitment?.key === commitment.key) {
                            setEditGoalValue(Number(e.target.value));
                          }
                        }}
                        onFocus={() => {
                          if (!editingCommitment || editingCommitment.key !== commitment.key) {
                            setEditingCommitment(commitment);
                            setEditGoalValue(currentGoal);
                            setEditProgressValue(currentProgress);
                          }
                        }}
                        className="mt-1"
                        min={0}
                        step={commitment.key === 'preseason_fp_goal' ? 0.5 : 1}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">
                        Progress {isFpCommitment && "(auto)"}
                      </Label>
                      <Input
                        type="number"
                        value={editingCommitment?.key === commitment.key ? editProgressValue : currentProgress}
                        onChange={(e) => {
                          if (editingCommitment?.key === commitment.key && !isFpCommitment) {
                            setEditProgressValue(Number(e.target.value));
                          }
                        }}
                        className="mt-1"
                        min={0}
                        disabled={isFpCommitment}
                        step={commitment.key === 'preseason_fp_goal' ? 0.1 : 1}
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            <Button 
              onClick={handleSaveGoal} 
              className="w-full mt-6"
              disabled={isUpdating}
            >
              {isUpdating ? "Saving..." : "Save All Commitments"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
