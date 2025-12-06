import { useState, useMemo } from "react";
import { 
  BookOpen, 
  Clock, 
  Users, 
  Calendar, 
  Plane, 
  Target,
  Plus,
  Check,
  ChevronRight,
  Sparkles
} from "lucide-react";
import { RepGoals } from "@/hooks/useRepGoals";
import { cn } from "@/lib/utils";
import { useEfpMode } from "@/hooks/useEfpMode";
import { useRepData } from "@/hooks/useRepData";
import { motion, AnimatePresence } from "framer-motion";

interface CommitmentChipsProps {
  goals: RepGoals;
  preseasonFpProgress: number;
  blitzStats: {
    attended: number;
    committed: number;
  };
  onEdit: () => void;
  onQuickIncrement: (key: string) => Promise<void>;
  onTrainingClick: () => void;
  onBlitzClick: () => void;
  isUpdating?: boolean;
}

interface ChipConfig {
  key: string;
  progressKey: string;
  label: string;
  icon: typeof BookOpen;
  gradient: string;
  textColor: string;
  incrementBy?: number;
  autoTracked?: boolean;
  hasCustomEditor?: boolean;
}

const chipConfigs: ChipConfig[] = [
  {
    key: 'training_hours_goal',
    progressKey: 'training_hours_progress',
    label: 'Training',
    icon: Clock,
    gradient: 'from-blue-400 to-blue-600',
    textColor: 'text-blue-500',
    hasCustomEditor: true,
  },
  {
    key: 'books_goal',
    progressKey: 'books_progress',
    label: 'Books',
    icon: BookOpen,
    gradient: 'from-purple-400 to-purple-600',
    textColor: 'text-purple-500',
    incrementBy: 1,
  },
  {
    key: 'role_plays_goal',
    progressKey: 'role_plays_progress',
    label: 'Role Plays',
    icon: Users,
    gradient: 'from-green-400 to-green-600',
    textColor: 'text-green-500',
    incrementBy: 1,
  },
  {
    key: 'monday_night_lights_goal',
    progressKey: 'monday_night_lights_progress',
    label: 'MNL',
    icon: Calendar,
    gradient: 'from-amber-400 to-amber-600',
    textColor: 'text-amber-500',
    incrementBy: 1,
  },
  {
    key: 'blitzes_goal',
    progressKey: 'blitzes_progress',
    label: 'Blitzes',
    icon: Plane,
    gradient: 'from-red-400 to-red-600',
    textColor: 'text-red-500',
    autoTracked: true,
    hasCustomEditor: true,
  },
];

const formatTrainingTime = (minutes: number) => {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

export const CommitmentChips = ({
  goals,
  preseasonFpProgress,
  blitzStats,
  onEdit,
  onQuickIncrement,
  onTrainingClick,
  onBlitzClick,
  isUpdating = false,
}: CommitmentChipsProps) => {
  const { efpModeEnabled } = useEfpMode();
  const metricLabel = efpModeEnabled ? 'EFP' : 'FP+';
  const [tappedChip, setTappedChip] = useState<string | null>(null);

  const getProgress = (config: ChipConfig): number => {
    if (config.key === 'blitzes_goal') {
      return blitzStats.attended;
    }
    const progressKey = config.progressKey as keyof RepGoals;
    return Number(goals[progressKey]) || 0;
  };

  const getGoal = (config: ChipConfig): number => {
    if (config.key === 'blitzes_goal') {
      return blitzStats.committed;
    }
    const goalKey = config.key as keyof RepGoals;
    return Number(goals[goalKey]) || 0;
  };

  const isComplete = (config: ChipConfig): boolean => {
    return getProgress(config) >= getGoal(config) && getGoal(config) > 0;
  };

  // Filter to only show chips with goals set
  const activeChips = chipConfigs.filter(c => getGoal(c) > 0);

  // Preseason FP chip data
  const preseasonFpGoal = goals.preseason_fp_goal || 0;
  const preseasonComplete = preseasonFpProgress >= preseasonFpGoal && preseasonFpGoal > 0;

  const handleChipTap = async (config: ChipConfig) => {
    if (config.hasCustomEditor) {
      if (config.key === 'training_hours_goal') {
        onTrainingClick();
      } else if (config.key === 'blitzes_goal') {
        onBlitzClick();
      }
      return;
    }
    
    if (config.autoTracked || isComplete(config)) return;
    
    // Visual feedback
    setTappedChip(config.key);
    setTimeout(() => setTappedChip(null), 300);
    
    // Quick increment
    await onQuickIncrement(config.progressKey);
  };

  const hasAnyGoals = activeChips.length > 0 || preseasonFpGoal > 0;

  if (!hasAnyGoals) {
    return (
      <motion.button
        onClick={onEdit}
        className={cn(
          "w-full p-4 rounded-2xl border-2 border-dashed border-muted-foreground/20",
          "flex items-center justify-center gap-2",
          "text-muted-foreground hover:border-primary/40 hover:text-primary",
          "transition-colors duration-200"
        )}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        <Sparkles className="h-4 w-4" />
        <span className="font-medium">Set preseason commitments</span>
      </motion.button>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Preseason Commitments
        </h3>
        <button
          onClick={onEdit}
          className="text-xs text-primary font-medium hover:underline"
        >
          Edit
        </button>
      </div>

      {/* Chips Grid */}
      <div className="flex flex-wrap gap-2">
        {/* Preseason FP Chip */}
        {preseasonFpGoal > 0 && (
          <motion.div
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-xl",
              "bg-gradient-to-r from-primary/10 to-primary/5",
              "border border-primary/20",
              preseasonComplete && "border-emerald-500/30 bg-emerald-500/10"
            )}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className={cn(
              "w-6 h-6 rounded-lg flex items-center justify-center",
              preseasonComplete 
                ? "bg-emerald-500 text-white" 
                : "bg-gradient-to-br from-primary to-primary-dark text-white"
            )}>
              {preseasonComplete ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Target className="h-3.5 w-3.5" />
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-foreground">
                {preseasonFpProgress.toFixed(1)} / {preseasonFpGoal} {metricLabel}
              </span>
              <span className="text-[10px] text-muted-foreground">Before summer</span>
            </div>
          </motion.div>
        )}

        {/* Other commitment chips */}
        <AnimatePresence>
          {activeChips.map((config, index) => {
            const Icon = config.icon;
            const progress = getProgress(config);
            const goal = getGoal(config);
            const complete = isComplete(config);
            const isTapped = tappedChip === config.key;
            const isTraining = config.key === 'training_hours_goal';
            
            const progressDisplay = isTraining 
              ? formatTrainingTime(progress)
              : progress.toString();
            const goalDisplay = isTraining 
              ? formatTrainingTime(goal)
              : goal.toString();

            return (
              <motion.button
                key={config.key}
                onClick={() => handleChipTap(config)}
                disabled={isUpdating}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-xl",
                  "transition-all duration-200",
                  complete 
                    ? "bg-emerald-500/10 border border-emerald-500/30" 
                    : "bg-muted/50 border border-border/50 hover:border-border active:scale-95",
                  isTapped && "scale-95 bg-muted"
                )}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <div className={cn(
                  "w-6 h-6 rounded-lg flex items-center justify-center",
                  complete 
                    ? "bg-emerald-500 text-white" 
                    : `bg-gradient-to-br ${config.gradient} text-white`
                )}>
                  {complete ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Icon className="h-3.5 w-3.5" />
                  )}
                </div>
                <div className="flex flex-col items-start">
                  <span className={cn(
                    "text-xs font-medium",
                    complete ? "text-emerald-600" : "text-foreground"
                  )}>
                    {progressDisplay} / {goalDisplay}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {config.label}
                  </span>
                </div>
                {config.hasCustomEditor && (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground ml-1" />
                )}
                {!config.autoTracked && !config.hasCustomEditor && !complete && (
                  <Plus className="h-3.5 w-3.5 text-muted-foreground ml-1" />
                )}
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};
