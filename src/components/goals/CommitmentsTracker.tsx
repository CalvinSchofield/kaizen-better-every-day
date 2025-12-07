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
  Settings2,
  AlertCircle,
  ChevronRight
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
import { TrainingTimer } from "./TrainingTimer";
import { BooksSelectionDrawer } from "./BooksSelectionDrawer";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

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
  hasCustomEditor?: boolean;
}

interface CommittedBlitz {
  id: string;
  name: string;
  date: string;
  endDate?: string;
  location?: string;
}

const baseCommitments: Omit<Commitment, 'label' | 'unit' | 'description' | 'maxValue'>[] = [
  {
    key: 'training_hours_goal',
    progressKey: 'training_hours_progress',
    icon: Clock,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    incrementBy: 60, // minutes for goal setting
    hasCustomEditor: true,
  },
  {
    key: 'books_goal',
    progressKey: 'books_progress',
    icon: BookOpen,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    incrementBy: 1,
    hasCustomEditor: true,
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
    hasCustomEditor: true,
  },
];

// Calculate Mondays remaining until summer start (April 13, 2026)
const getMondaysRemaining = (): number => {
  const summerStart = new Date('2026-04-13');
  const today = new Date();
  let count = 0;
  let current = new Date(today);
  
  while (current < summerStart) {
    if (current.getDay() === 1) { // Monday
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
};

const commitmentLabels: Record<string, { label: string; unit: string; description: string }> = {
  training_hours_goal: { label: 'Training Hours', unit: 'hrs', description: 'Weekly goal (resets Sunday)' },
  books_goal: { label: 'Books Read', unit: 'books', description: 'Sales/mindset books' },
  role_plays_goal: { label: 'Role Plays', unit: 'sessions', description: 'Practice with vets' },
  monday_night_lights_goal: { label: 'Monday Night Lights', unit: 'calls', description: 'Weekly team calls' },
  blitzes_goal: { label: 'Blitzes', unit: 'trips', description: 'Commit to trips below' },
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
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const metricLabel = efpModeEnabled ? 'EFP' : 'FP+';
  
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [isTrainingTimerOpen, setIsTrainingTimerOpen] = useState(false);
  const [isBooksDrawerOpen, setIsBooksDrawerOpen] = useState(false);
  const [editingGoals, setEditingGoals] = useState<Record<string, number>>({});
  const [isCommitting, setIsCommitting] = useState<string | null>(null);
  const [isBlitzExpanded, setIsBlitzExpanded] = useState(false);

  // Get committed blitzes
  const committedBlitzes = useMemo(() => {
    return (repData?.committed_blitzes as CommittedBlitz[]) || [];
  }, [repData?.committed_blitzes]);

  // Separate past blitzes (already attended) from future ones
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const { pastBlitzes, futureBlitzes, activeBlitz } = useMemo(() => {
    const past: CommittedBlitz[] = [];
    const future: CommittedBlitz[] = [];
    let active: CommittedBlitz | null = null;
    
    committedBlitzes.forEach(blitz => {
      const blitzStart = new Date(blitz.date);
      blitzStart.setHours(0, 0, 0, 0);
      const blitzEnd = blitz.endDate ? new Date(blitz.endDate) : blitzStart;
      blitzEnd.setHours(23, 59, 59, 999);
      
      if (blitzEnd < today) {
        // Blitz has ended
        past.push(blitz);
      } else if (blitzStart <= today && today <= blitzEnd) {
        // Currently on this blitz
        active = blitz;
      } else {
        // Future blitz
        future.push(blitz);
      }
    });
    
    return { pastBlitzes: past, futureBlitzes: future, activeBlitz: active };
  }, [committedBlitzes, today]);

  // Filter allBlitzes to only show future ones
  const futureAvailableBlitzes = useMemo(() => {
    return allBlitzes.filter(blitz => {
      const blitzStart = new Date(blitz.date);
      blitzStart.setHours(0, 0, 0, 0);
      return blitzStart >= today;
    });
  }, [allBlitzes, today]);

  // Calculate blitz stats
  // Attended = past blitzes + active blitz (ones they've been on or are currently on)
  // Committed = total committed blitzes (past + active + future)
  const blitzStats = useMemo(() => {
    const blitzesAttended = pastBlitzes.length + (activeBlitz ? 1 : 0);
    const blitzesAvailable = futureAvailableBlitzes.length;
    // Total committed = all committed blitzes (past attended + active + future)
    const totalCommitted = committedBlitzes.length;
    
    return {
      attended: blitzesAttended,
      committed: totalCommitted,
      available: blitzesAvailable,
      maxGoal: blitzesAvailable,
    };
  }, [pastBlitzes.length, activeBlitz, futureAvailableBlitzes.length, committedBlitzes.length]);

  // Check if blitz goal mismatches committed count (auto-expand if mismatch)
  const blitzMismatch = useMemo(() => {
    const goal = Number(goals.blitzes_goal) || 0;
    const mismatch = goal !== blitzStats.committed && goal > 0;
    return mismatch;
  }, [goals.blitzes_goal, blitzStats.committed]);

  // Calculate dynamic max values
  const mondaysRemaining = useMemo(() => getMondaysRemaining(), []);

  // Build commitments with dynamic max for blitzes and Monday Night Lights
  const commitments = useMemo((): Commitment[] => {
    const staticCommitments: Commitment[] = baseCommitments.map(c => ({
      ...c,
      label: commitmentLabels[c.key].label,
      unit: commitmentLabels[c.key].unit,
      description: commitmentLabels[c.key].description,
      maxValue: c.key === 'blitzes_goal' 
        ? blitzStats.available 
        : c.key === 'monday_night_lights_goal'
          ? mondaysRemaining
          : undefined,
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
  }, [metricLabel, blitzStats.available, mondaysRemaining]);

  const handleOpenEditDrawer = () => {
    // Initialize with current goal values, use committed blitzes count for blitz goal
    const currentGoals: Record<string, number> = {};
    commitments.forEach(c => {
      if (c.key === 'blitzes_goal') {
        // Pre-fill with committed blitzes count
        currentGoals[c.key] = blitzStats.committed;
      } else if (!c.autoTracked) {
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
      return { ...prev, [key]: maxValue !== undefined ? Math.min(newVal, maxValue) : newVal };
    });
  };

  const handleCommitToBlitz = async (blitz: { id: string; name: string; date: string; endDate?: string | null; location?: string | null }) => {
    if (!repData?.id) return;
    setIsCommitting(blitz.id);
    
    try {
      const newCommitment: CommittedBlitz = {
        id: blitz.id,
        name: blitz.name,
        date: blitz.date,
        endDate: blitz.endDate || undefined,
        location: blitz.location || undefined,
      };
      
      const newCommitments = [...committedBlitzes, newCommitment];
      
      const { error } = await supabase
        .from('reps')
        .update({ committed_blitzes: newCommitments as any })
        .eq('id', repData.id);
      
      if (error) throw error;
      
      // Update the editing goals to reflect new commitment
      setEditingGoals(prev => ({
        ...prev,
        blitzes_goal: newCommitments.length
      }));
      
      await queryClient.invalidateQueries({ queryKey: ['rep-data'] });
      
      toast({
        title: "Committed!",
        description: `You're going to ${blitz.name}`,
      });
    } catch (error) {
      console.error('Error committing to blitz:', error);
      toast({
        title: "Failed to commit",
        variant: "destructive",
      });
    } finally {
      setIsCommitting(null);
    }
  };

  const handleUncommitFromBlitz = async (blitzId: string) => {
    if (!repData?.id) return;
    setIsCommitting(blitzId);
    
    try {
      const newCommitments = committedBlitzes.filter(b => b.id !== blitzId);
      
      const { error } = await supabase
        .from('reps')
        .update({ committed_blitzes: newCommitments as any })
        .eq('id', repData.id);
      
      if (error) throw error;
      
      // Update the editing goals to reflect removal
      setEditingGoals(prev => ({
        ...prev,
        blitzes_goal: newCommitments.length
      }));
      
      await queryClient.invalidateQueries({ queryKey: ['rep-data'] });
      
      toast({
        title: "Uncommitted",
        description: "You've been removed from this trip",
      });
    } catch (error) {
      console.error('Error uncommitting from blitz:', error);
      toast({
        title: "Failed to uncommit",
        variant: "destructive",
      });
    } finally {
      setIsCommitting(null);
    }
  };

  const handleSaveTrainingTime = async (totalMinutes: number) => {
    await onUpdateGoals({
      training_hours_progress: totalMinutes,
    } as Partial<RepGoals>);
    setIsTrainingTimerOpen(false);
  };

  const handleQuickIncrement = async (commitment: Commitment) => {
    if (commitment.autoTracked || commitment.hasCustomEditor) return;
    
    const progressKey = commitment.progressKey as keyof RepGoals;
    const currentProgress = Number(goals[progressKey]) || 0;
    const increment = commitment.incrementBy || 1;
    
    await onUpdateGoals({
      [progressKey]: currentProgress + increment,
    } as Partial<RepGoals>);
  };

  const handleQuickDecrement = async (commitment: Commitment) => {
    if (commitment.autoTracked || commitment.hasCustomEditor) return;
    
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
      return blitzStats.attended;
    }
    const progressKey = commitment.progressKey as keyof RepGoals;
    return Number(goals[progressKey]) || 0;
  };

  const getGoal = (commitment: Commitment): number => {
    if (commitment.key === 'blitzes_goal') {
      return blitzStats.committed; // Goal IS the committed count
    }
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

  // Format training time display
  const formatTrainingTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Get commitments that are editable (not fully auto-tracked like FP)
  const editableCommitments = commitments.filter(c => 
    c.key !== 'preseason_fp_goal' && c.key !== 'blitzes_goal'
  );

  // Filter to only show commitments with goals set, plus always show FP+
  const activeCommitments = commitments.filter(
    c => getGoal(c) > 0 || c.key === 'preseason_fp_goal' || c.key === 'blitzes_goal'
  );

  // Get commitments that have NO goal set (available to add)
  const uncommittedCommitments = editableCommitments.filter(c => getGoal(c) === 0);

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
              onClick={handleOpenEditDrawer}
              className="text-xs"
            >
              <Settings2 className="h-3 w-3 mr-1" />
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {!hasAnyGoals && blitzStats.committed === 0 ? (
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
                Set Your Standards
              </Button>
            </div>
          ) : (
            <>
              {activeCommitments.map((commitment) => {
                const Icon = commitment.icon;
                const progress = getProgress(commitment);
                const goal = getGoal(commitment);
                const percentage = getPercentage(commitment);
                const complete = isComplete(commitment);
                const isFpCommitment = commitment.key === 'preseason_fp_goal';
                const isBlitzes = commitment.key === 'blitzes_goal';
                const isTraining = commitment.key === 'training_hours_goal';
                const isAutoTracked = commitment.autoTracked;
                const hasCustomEditor = commitment.hasCustomEditor;

                if (goal === 0 && !isFpCommitment && !isBlitzes) return null;

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
                              : isTraining
                                ? `${formatTrainingTime(progress)} / ${formatTrainingTime(goal)}`
                                : isBlitzes
                                  ? `${progress} attended / ${goal} committed`
                                  : `${progress} / ${goal} ${commitment.unit}`
                            }
                          </p>
                        </div>
                      </div>

                      {/* Training timer button */}
                      {isTraining && goal > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs gap-1"
                          onClick={() => setIsTrainingTimerOpen(true)}
                        >
                          <Clock className="h-3 w-3" />
                          Log Time
                        </Button>
                      )}

                      {/* Books log button */}
                      {commitment.key === 'books_goal' && goal > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs gap-1"
                          onClick={() => setIsBooksDrawerOpen(true)}
                        >
                          <BookOpen className="h-3 w-3" />
                          Log Book
                        </Button>
                      )}

                      {/* Quick increment/decrement buttons (not for auto-tracked or custom editors) */}
                      {!isAutoTracked && !hasCustomEditor && goal > 0 && (
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
              })}

              {/* Show "Add more" button if there are uncommitted commitments */}
              {uncommittedCommitments.length > 0 && (
                <button
                  onClick={handleOpenEditDrawer}
                  className="w-full rounded-xl p-3 border-2 border-dashed border-border/50 hover:border-primary/50 hover:bg-accent/30 transition-all flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
                >
                  <Plus className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    Add {uncommittedCommitments.length} more commitment{uncommittedCommitments.length > 1 ? 's' : ''}
                  </span>
                </button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Goals Drawer */}
      <Drawer open={isEditDrawerOpen} onOpenChange={setIsEditDrawerOpen}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="text-center pb-2">
            <DrawerTitle>Set Your Standards</DrawerTitle>
            <DrawerDescription>
              What are you committing to this preseason?
            </DrawerDescription>
          </DrawerHeader>

          <div className="px-4 pb-6 space-y-4 overflow-y-auto">
            {/* Blitzes Section - Collapsible */}
            <div className="rounded-xl p-4 bg-red-500/10">
              <button 
                className="flex items-center gap-3 w-full text-left"
                onClick={() => setIsBlitzExpanded(!isBlitzExpanded)}
              >
                <div className="p-2 rounded-lg bg-background/60">
                  <Plane className="h-5 w-5 text-red-500" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">Blitzes</p>
                  <p className="text-xs text-muted-foreground">
                    {blitzStats.attended > 0 && `${blitzStats.attended} attended · `}
                    {blitzStats.committed} committed · {blitzStats.available} available
                  </p>
                </div>
                <span className="text-2xl font-bold tabular-nums mr-2">{blitzStats.committed}</span>
                <ChevronRight className={cn(
                  "h-5 w-5 text-muted-foreground transition-transform",
                  (isBlitzExpanded || blitzMismatch) && "rotate-90"
                )} />
              </button>
              
              {/* Blitz list - collapsible, auto-expand on mismatch */}
              {(isBlitzExpanded || blitzMismatch) && (
                <div className="space-y-2 mt-3">
                  {/* Active blitz (can't uncommit) */}
                  {activeBlitz && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/20 ring-1 ring-amber-500/50">
                      <div>
                        <p className="font-medium text-sm">{activeBlitz.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Currently active
                          {activeBlitz.location && ` · ${activeBlitz.location}`}
                        </p>
                      </div>
                      <span className="text-xs font-medium text-amber-600 px-2 py-1 bg-amber-100 rounded-full">
                        On Trip
                      </span>
                    </div>
                  )}
                  
                  {/* Future available blitzes */}
                  {futureAvailableBlitzes.map((blitz) => {
                    const isCommitted = futureBlitzes.some(b => b.id === blitz.id);
                    const blitzDate = new Date(blitz.date);
                    
                    return (
                      <div 
                        key={blitz.id}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg transition-all",
                          isCommitted ? "bg-green-500/20 ring-1 ring-green-500/50" : "bg-background/50"
                        )}
                      >
                        <div>
                          <p className="font-medium text-sm">{blitz.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {blitzDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            {blitz.location && ` · ${blitz.location}`}
                          </p>
                        </div>
                        <Button
                          variant={isCommitted ? "outline" : "default"}
                          size="sm"
                          onClick={() => isCommitted 
                            ? handleUncommitFromBlitz(blitz.id)
                            : handleCommitToBlitz(blitz)
                          }
                          disabled={isCommitting === blitz.id}
                          className={cn(
                            "min-w-[80px]",
                            isCommitted && "border-green-500/50 text-green-600"
                          )}
                        >
                          {isCommitting === blitz.id ? "..." : isCommitted ? (
                            <>
                              <Check className="h-3 w-3 mr-1" />
                              Going
                            </>
                          ) : "Commit"}
                        </Button>
                      </div>
                    );
                  })}
                  
                  {futureAvailableBlitzes.length === 0 && !activeBlitz && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      No upcoming blitzes scheduled
                    </p>
                  )}
                  
                  {/* Past blitzes attended */}
                  {pastBlitzes.length > 0 && (
                    <div className="pt-2 mt-2 border-t border-border/50">
                      <p className="text-xs text-muted-foreground mb-2">Past blitzes attended</p>
                      {pastBlitzes.map((blitz) => (
                        <div 
                          key={blitz.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                        >
                          <div>
                            <p className="font-medium text-xs text-muted-foreground">{blitz.name}</p>
                          </div>
                          <Check className="h-4 w-4 text-green-500" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Other commitments with steppers */}
            {editableCommitments.map((commitment) => {
              const Icon = commitment.icon;
              const isTraining = commitment.key === 'training_hours_goal';
              const currentGoalValue = editingGoals[commitment.key] ?? (Number(goals[commitment.key as keyof RepGoals]) || 0);
              // Training uses 15-min increments (stored as minutes)
              const stepAmount = isTraining ? 15 : (commitment.incrementBy || 1);
              // Display training as hours and mins
              const displayValue = isTraining 
                ? (currentGoalValue >= 60 
                    ? `${Math.floor(currentGoalValue / 60)}h${currentGoalValue % 60 > 0 ? ` ${currentGoalValue % 60}m` : ''}`
                    : `${currentGoalValue}m`)
                : currentGoalValue;

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
                          {isTraining && ' (weekly)'}
                        </p>
                      </div>
                    </div>
                    
                    {/* Stepper */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 rounded-full"
                        onClick={() => handleStepperChange(commitment.key, -stepAmount, commitment.maxValue)}
                        disabled={currentGoalValue <= 0}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <div className="text-center min-w-[56px]">
                        <span className="text-lg font-bold tabular-nums">
                          {displayValue}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 rounded-full"
                        onClick={() => handleStepperChange(commitment.key, stepAmount, commitment.maxValue)}
                        disabled={commitment.maxValue !== undefined && currentGoalValue >= commitment.maxValue}
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
              {isUpdating ? "Saving..." : "Save Standards"}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Training Timer Drawer */}
      <Drawer open={isTrainingTimerOpen} onOpenChange={setIsTrainingTimerOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="text-center pb-2">
            <DrawerTitle className="flex items-center justify-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              Training Timer
            </DrawerTitle>
            <DrawerDescription>
              Log time spent studying and training
            </DrawerDescription>
          </DrawerHeader>

          <div className="px-4 pb-6">
            <TrainingTimer
              currentMinutes={Number(goals.training_hours_progress) || 0}
              weeklyGoal={Number(goals.training_hours_goal) || 0}
              history={goals.training_hours_history || []}
              onSave={handleSaveTrainingTime}
              isSaving={isUpdating}
            />
          </div>
        </DrawerContent>
      </Drawer>

      {/* Books Selection Drawer */}
      <BooksSelectionDrawer
        isOpen={isBooksDrawerOpen}
        onClose={() => setIsBooksDrawerOpen(false)}
        currentProgress={Number(goals.books_progress) || 0}
        onUpdateProgress={(newProgress) => onUpdateGoals({ books_progress: newProgress })}
      />
    </>
  );
};
