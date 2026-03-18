import { cn } from "@/lib/utils";
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
  emoji: string;
  label: string;
  subtitle: string;
  dotColor: string;
  borderColor: string;
  bgColor: string;
}> = {
  superstar: {
    emoji: '⭐',
    label: 'Superstar',
    subtitle: 'High effort + High skill',
    dotColor: 'bg-green-500',
    borderColor: 'border-green-500/30',
    bgColor: 'bg-green-500/5',
  },
  grinder: {
    emoji: '💪',
    label: 'Grinder',
    subtitle: 'Needs training',
    dotColor: 'bg-blue-500',
    borderColor: 'border-blue-500/30',
    bgColor: 'bg-blue-500/5',
  },
  assassin: {
    emoji: '🎯',
    label: 'Assassin',
    subtitle: 'Needs motivation',
    dotColor: 'bg-amber-500',
    borderColor: 'border-amber-500/30',
    bgColor: 'bg-amber-500/5',
  },
  at_risk: {
    emoji: '⚠️',
    label: 'At Risk',
    subtitle: 'Low effort + Low skill',
    dotColor: 'bg-destructive',
    borderColor: 'border-destructive/30',
    bgColor: 'bg-destructive/5',
  },
};

interface ClassifiedRep {
  userId: string;
  name: string;
  effortScore: number;
  fp: number;
  archetype: Archetype;
}

export const RepArchetypes = ({ reps, funnelData, isLoading, onRepClick }: RepArchetypesProps) => {
  if (isLoading) return null;

  const activeReps = reps.filter(r => r.doors > 0 || r.fp > 0);
  if (activeReps.length < 2) return null;

  const classified: ClassifiedRep[] = activeReps.map(r => ({
    userId: r.userId,
    name: getFirstName(r.name),
    effortScore: Math.round(r.effort.score),
    fp: r.fp,
    archetype: classifyRep(r),
  }));

  const groups: Record<Archetype, ClassifiedRep[]> = {
    superstar: [],
    grinder: [],
    assassin: [],
    at_risk: [],
  };
  classified.forEach(r => groups[r.archetype].push(r));

  // Only show quadrants that have reps
  const activeArchetypes = (['superstar', 'grinder', 'assassin', 'at_risk'] as Archetype[])
    .filter(a => groups[a].length > 0);

  if (activeArchetypes.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-2"
    >
      <h3 className="text-sm font-semibold text-muted-foreground px-1">Rep Archetypes</h3>

      <div className="grid grid-cols-2 gap-2">
        {activeArchetypes.map((arch, i) => {
          const config = archetypeConfig[arch];
          const archReps = groups[arch].sort((a, b) => b.fp - a.fp);

          return (
            <motion.div
              key={arch}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.06 }}
              className={cn(
                "rounded-xl border p-3 space-y-2",
                config.borderColor,
                config.bgColor,
              )}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{config.emoji}</span>
                  <span className="text-xs font-bold">{config.label}</span>
                </div>
                <span className="text-[10px] text-muted-foreground font-medium">
                  {archReps.length}
                </span>
              </div>
              <p className="text-[9px] text-muted-foreground leading-tight">{config.subtitle}</p>

              {/* Rep list */}
              <div className="space-y-1">
                {archReps.slice(0, 4).map(r => (
                  <button
                    key={r.userId}
                    onClick={() => onRepClick?.(r.userId)}
                    className="w-full flex items-center justify-between py-1 px-1 rounded-md hover:bg-background/50 active:scale-[0.98] transition-all text-left"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", config.dotColor)} />
                      <span className="text-xs font-medium truncate">{r.name}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-1">
                      {r.fp > 0 ? `${r.fp.toFixed(1)} FP` : `E:${r.effortScore}`}
                    </span>
                  </button>
                ))}
                {archReps.length > 4 && (
                  <p className="text-[9px] text-muted-foreground text-center pt-0.5">
                    +{archReps.length - 4} more
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};
