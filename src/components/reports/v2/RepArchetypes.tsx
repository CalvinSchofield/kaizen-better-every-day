import { cn } from "@/lib/utils";
import { Star, Wrench, Zap, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { RepWithEffort } from "@/hooks/useReportsV2Data";
import { ScatterChart, Scatter, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from "recharts";

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

const archetypeColors: Record<Archetype, string> = {
  superstar: 'hsl(142, 76%, 36%)',
  grinder: 'hsl(217, 91%, 60%)',
  assassin: 'hsl(38, 92%, 50%)',
  at_risk: 'hsl(0, 84%, 60%)',
};

const archetypeConfig: Record<Archetype, {
  label: string;
  subtitle: string;
  textColor: string;
}> = {
  superstar: { label: '⭐ Superstar', subtitle: 'High effort + High skill', textColor: 'text-green-600 dark:text-green-400' },
  grinder: { label: '💪 Grinder', subtitle: 'Needs training', textColor: 'text-blue-600 dark:text-blue-400' },
  assassin: { label: '🎯 Assassin', subtitle: 'Needs motivation', textColor: 'text-amber-600 dark:text-amber-400' },
  at_risk: { label: '⚠️ At Risk', subtitle: 'Low effort + Low skill', textColor: 'text-destructive' },
};

interface ScatterPoint {
  effortScore: number;
  skillScore: number;
  name: string;
  userId: string;
  archetype: Archetype;
  fp: number;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload as ScatterPoint;
  const config = archetypeConfig[data.archetype];
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
      <p className="text-xs font-bold text-foreground">{data.name}</p>
      <p className={cn("text-[10px] font-medium", config.textColor)}>{config.label}</p>
      <div className="flex gap-3 mt-1">
        <span className="text-[10px] text-muted-foreground">Effort: <span className="font-bold text-foreground">{data.effortScore}</span></span>
        <span className="text-[10px] text-muted-foreground">Skill: <span className="font-bold text-foreground">{data.skillScore}</span></span>
        <span className="text-[10px] text-muted-foreground">FP: <span className="font-bold text-foreground">{data.fp.toFixed(1)}</span></span>
      </div>
    </div>
  );
};

export const RepArchetypes = ({ reps, funnelData, isLoading, onRepClick }: RepArchetypesProps) => {
  if (isLoading) return null;

  const activeReps = reps.filter(r => r.doors > 0 || r.fp > 0);
  if (activeReps.length < 2) return null;

  // Calculate skill score per rep
  const scatterData: ScatterPoint[] = activeReps.map(r => {
    const convRates: number[] = [];
    if (r.pitches > 0 && r.transitions > 0) convRates.push(r.transitions / r.pitches);
    if (r.transitions > 0 && r.presentations > 0) convRates.push(r.presentations / r.transitions);
    if (r.presentations > 0 && r.closes > 0) convRates.push(r.closes / r.presentations);
    const avgConv = convRates.length > 0 ? convRates.reduce((a, b) => a + b, 0) / convRates.length : 0;
    const skillScore = Math.min(100, Math.round(avgConv * 200));

    return {
      effortScore: Math.round(r.effort.score),
      skillScore,
      name: getFirstName(r.name),
      userId: r.userId,
      archetype: classifyRep(r),
      fp: r.fp,
    };
  });

  const counts: Record<Archetype, number> = { superstar: 0, grinder: 0, assassin: 0, at_risk: 0 };
  scatterData.forEach(d => counts[d.archetype]++);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border/50 bg-card p-4 space-y-3"
    >
      <h3 className="text-sm font-semibold text-muted-foreground">Rep Archetypes</h3>
      
      {/* Scatter Plot */}
      <div className="relative">
        {/* Quadrant labels */}
        <div className="absolute top-1 left-8 text-[9px] font-medium text-blue-500/60 z-10">💪 Grinder</div>
        <div className="absolute top-1 right-1 text-[9px] font-medium text-green-500/60 z-10">⭐ Superstar</div>
        <div className="absolute bottom-6 left-8 text-[9px] font-medium text-red-400/60 z-10">⚠️ At Risk</div>
        <div className="absolute bottom-6 right-1 text-[9px] font-medium text-amber-500/60 z-10">🎯 Assassin</div>
        
        {/* Quadrant dividers */}
        <div className="absolute top-0 bottom-[24px] left-1/2 w-px bg-border/30" />
        <div className="absolute left-[32px] right-0 top-1/2 h-px bg-border/30" style={{ transform: 'translateY(-12px)' }} />
        
        <ResponsiveContainer width="100%" height={200}>
          <ScatterChart margin={{ top: 15, right: 10, bottom: 5, left: -15 }}>
            <XAxis 
              type="number" 
              dataKey="skillScore" 
              name="Skill" 
              domain={[0, 100]}
              className="text-[9px] fill-muted-foreground"
              axisLine={false}
              tickLine={false}
              label={{ value: 'Skill →', position: 'insideBottom', offset: -2, className: 'text-[9px] fill-muted-foreground' }}
            />
            <YAxis 
              type="number" 
              dataKey="effortScore" 
              name="Effort" 
              domain={[0, 100]}
              className="text-[9px] fill-muted-foreground"
              axisLine={false}
              tickLine={false}
              label={{ value: 'Effort →', angle: -90, position: 'insideLeft', offset: 20, className: 'text-[9px] fill-muted-foreground' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Scatter data={scatterData} animationDuration={600}>
              {scatterData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={archetypeColors[entry.archetype]}
                  r={Math.max(5, Math.min(12, 5 + entry.fp * 1.5))}
                  className="cursor-pointer"
                  onClick={() => onRepClick?.(entry.userId)}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Legend row */}
      <div className="flex items-center justify-between px-1">
        {(['superstar', 'grinder', 'assassin', 'at_risk'] as Archetype[]).map(arch => {
          const config = archetypeConfig[arch];
          return (
            <div key={arch} className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: archetypeColors[arch] }} />
              <span className="text-[10px] text-muted-foreground font-medium">{counts[arch]}</span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};
