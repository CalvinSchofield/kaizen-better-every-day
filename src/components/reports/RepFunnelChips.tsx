import { cn } from "@/lib/utils";

interface RepFunnelChipsProps {
  doors: number;
  pitches: number;
  transitions: number;
  presentations: number;
  closes: number;
  teamAvg: {
    doorsToPitch: number;
    pitchToTrans: number;
    transToPres: number;
    presClose: number;
  };
}

export const RepFunnelChips = ({ 
  doors, 
  pitches, 
  transitions, 
  presentations, 
  closes,
  teamAvg 
}: RepFunnelChipsProps) => {
  // Calculate conversion rates
  const doorsToPitch = doors > 0 ? (pitches / doors) * 100 : 0;
  const pitchToTrans = pitches > 0 ? (transitions / pitches) * 100 : 0;
  const transToPres = transitions > 0 ? (presentations / transitions) * 100 : 0;
  const presClose = presentations > 0 ? (closes / presentations) * 100 : 0;
  
  const metrics = [
    { label: 'D→P', value: doorsToPitch, avg: teamAvg.doorsToPitch },
    { label: 'P→T', value: pitchToTrans, avg: teamAvg.pitchToTrans },
    { label: 'T→Pr', value: transToPres, avg: teamAvg.transToPres },
    { label: 'Pr→C', value: presClose, avg: teamAvg.presClose },
  ];
  
  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {metrics.map(({ label, value, avg }) => {
        const diff = value - avg;
        const isAbove = diff > 5;
        const isBelow = diff < -5;
        
        return (
          <span
            key={label}
            className={cn(
              "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
              isAbove && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
              isBelow && "bg-red-500/15 text-red-600 dark:text-red-400",
              !isAbove && !isBelow && "bg-muted text-muted-foreground"
            )}
          >
            {label}: {value.toFixed(0)}%
            {isAbove && ' ▲'}
            {isBelow && ' ▼'}
          </span>
        );
      })}
    </div>
  );
};

// Helper to calculate team averages
export const calculateTeamFunnelAvg = (reps: Array<{
  stats: { doors: number; pitches: number; transitions: number; presentations: number; closes: number };
}>) => {
  const totals = reps.reduce((acc, r) => ({
    doors: acc.doors + r.stats.doors,
    pitches: acc.pitches + r.stats.pitches,
    transitions: acc.transitions + r.stats.transitions,
    presentations: acc.presentations + r.stats.presentations,
    closes: acc.closes + r.stats.closes,
  }), { doors: 0, pitches: 0, transitions: 0, presentations: 0, closes: 0 });
  
  return {
    doorsToPitch: totals.doors > 0 ? (totals.pitches / totals.doors) * 100 : 0,
    pitchToTrans: totals.pitches > 0 ? (totals.transitions / totals.pitches) * 100 : 0,
    transToPres: totals.transitions > 0 ? (totals.presentations / totals.transitions) * 100 : 0,
    presClose: totals.presentations > 0 ? (totals.closes / totals.presentations) * 100 : 0,
  };
};
