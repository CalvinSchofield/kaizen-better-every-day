import { cn } from "@/lib/utils";
import { Star, Wrench, Zap, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { RepWithEffort } from "@/hooks/useReportsV2Data";

interface RepArchetypesProps {
  reps: RepWithEffort[];
  funnelData: {
    doors: number;
    pitches: number;
    closes: number;
  };
  isLoading?: boolean;
  onRepClick?: (userId: string) => void;
}

type Archetype = 'superstar' | 'grinder' | 'assassin' | 'at_risk';

const getFirstName = (name: string) => {
  const stripped = name.replace(/[\p{Emoji}\p{Emoji_Component}]/gu, '').trim();
  return stripped.split(' ')[0] || stripped;
};

const classifyRep = (rep: RepWithEffort): Archetype => {
  const effortHigh = rep.effort.score >= 65;
  const skillHigh = rep.closes > 0 || (rep.presentations > 0 && rep.pitches > 0 && (rep.presentations / Math.max(rep.pitches, 1)) >= 0.3);

  if (effortHigh && skillHigh) return 'superstar';
  if (effortHigh && !skillHigh) return 'grinder';
  if (!effortHigh && skillHigh) return 'assassin';
  return 'at_risk';
};

const archetypeConfig: Record<Archetype, {
  label: string;
  subtitle: string;
  icon: React.ReactNode;
  bgColor: string;
  borderColor: string;
  textColor: string;
}> = {
  superstar: {
    label: '⭐ Superstar',
    subtitle: 'High effort + High skill',
    icon: <Star className="w-4 h-4" />,
    bgColor: 'bg-green-500/5',
    borderColor: 'border-green-500/30',
    textColor: 'text-green-600 dark:text-green-400',
  },
  grinder: {
    label: '💪 Grinder',
    subtitle: 'High effort, needs training',
    icon: <Wrench className="w-4 h-4" />,
    bgColor: 'bg-blue-500/5',
    borderColor: 'border-blue-500/30',
    textColor: 'text-blue-600 dark:text-blue-400',
  },
  assassin: {
    label: '🎯 Assassin',
    subtitle: 'Skilled, needs motivation',
    icon: <Zap className="w-4 h-4" />,
    bgColor: 'bg-amber-500/5',
    borderColor: 'border-amber-500/30',
    textColor: 'text-amber-600 dark:text-amber-400',
  },
  at_risk: {
    label: '⚠️ At Risk',
    subtitle: 'Low effort + Low skill',
    icon: <AlertTriangle className="w-4 h-4" />,
    bgColor: 'bg-destructive/5',
    borderColor: 'border-destructive/30',
    textColor: 'text-destructive',
  },
};

export const RepArchetypes = ({ reps, funnelData, isLoading, onRepClick }: RepArchetypesProps) => {
  if (isLoading) return null;

  // Only show for reps with activity
  const activeReps = reps.filter(r => r.doors > 0 || r.fp > 0);
  if (activeReps.length < 2) return null;

  const classified = activeReps.map(r => ({
    ...r,
    archetype: classifyRep(r),
  }));

  const groups: Record<Archetype, typeof classified> = {
    superstar: classified.filter(r => r.archetype === 'superstar'),
    grinder: classified.filter(r => r.archetype === 'grinder'),
    assassin: classified.filter(r => r.archetype === 'assassin'),
    at_risk: classified.filter(r => r.archetype === 'at_risk'),
  };

  const archetypeOrder: Archetype[] = ['superstar', 'grinder', 'assassin', 'at_risk'];

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground px-1">Rep Archetypes</h3>
      <div className="grid grid-cols-2 gap-2">
        {archetypeOrder.map((archetype, i) => {
          const config = archetypeConfig[archetype];
          const group = groups[archetype];

          return (
            <motion.div
              key={archetype}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.06 }}
              className={cn(
                "rounded-xl border p-3 min-h-[80px]",
                config.bgColor, config.borderColor,
              )}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold">{config.label}</span>
                <span className={cn("text-lg font-bold", config.textColor)}>
                  {group.length}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground mb-2">{config.subtitle}</p>
              
              {group.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {group.slice(0, 4).map((rep) => (
                    <button
                      key={rep.userId}
                      onClick={() => onRepClick?.(rep.userId)}
                      className="text-[10px] text-muted-foreground hover:text-foreground hover:underline transition-colors"
                    >
                      {getFirstName(rep.name)}
                    </button>
                  ))}
                  {group.length > 4 && (
                    <span className="text-[10px] text-muted-foreground">+{group.length - 4}</span>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
