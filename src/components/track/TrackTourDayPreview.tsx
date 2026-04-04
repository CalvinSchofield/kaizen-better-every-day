import { motion } from 'framer-motion';

/**
 * Dummy "Day Complete" preview card shown during the Track page tour (step 9).
 * Displays example data so users understand what a saved day looks like.
 */
export const TrackTourDayPreview = () => {
  // Dummy stats for the preview
  const stats = [
    { label: 'Doors', value: 87 },
    { label: 'DMs', value: 32 },
    { label: 'Pitches', value: 14 },
    { label: 'Trans', value: 8 },
    { label: 'Pres', value: 6 },
    { label: 'Closes', value: 2 },
  ];

  const sales = [
    { type: 'FP', prmr: 54 },
    { type: 'Upgrade', prmr: 38 },
  ];

  const totalPrmr = sales.reduce((sum, s) => sum + s.prmr, 0);

  // Simple ring segments approximation using conic gradient
  const ringSegments = [
    { color: 'hsl(var(--primary))', pct: 45 },
    { color: 'hsl(var(--accent))', pct: 20 },
    { color: 'hsl(var(--muted))', pct: 35 },
  ];

  const conicGradient = `conic-gradient(${ringSegments
    .reduce<string[]>((acc, seg, i) => {
      const start = ringSegments.slice(0, i).reduce((s, r) => s + r.pct, 0);
      acc.push(`${seg.color} ${start}% ${start + seg.pct}%`);
      return acc;
    }, [])
    .join(', ')})`;

  return (
    <motion.div
      data-tour="track-day-complete-preview"
      className="mx-4 rounded-2xl border border-border/50 bg-card shadow-lg overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Example Day</p>
          <h3 className="text-base font-bold text-foreground">Day Complete ✅</h3>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">8:12 AM → 7:45 PM</p>
          <p className="text-xs font-semibold text-foreground">9.2 hrs worked</p>
        </div>
      </div>

      {/* Ring + Metric */}
      <div className="flex items-center gap-4 px-4 py-3">
        <div
          className="h-20 w-20 rounded-full flex items-center justify-center flex-shrink-0"
          style={{
            background: conicGradient,
            padding: '6px',
          }}
        >
          <div className="h-full w-full rounded-full bg-card flex flex-col items-center justify-center">
            <span className="text-lg font-bold text-foreground leading-none">1.45</span>
            <span className="text-[10px] text-muted-foreground">FP+</span>
          </div>
        </div>

        {/* Stat ribbon */}
        <div className="grid grid-cols-3 gap-x-4 gap-y-1.5 flex-1">
          {stats.map((s) => (
            <div key={s.label} className="flex items-baseline gap-1">
              <span className="text-sm font-semibold tabular-nums text-foreground">{s.value}</span>
              <span className="text-[10px] text-muted-foreground">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sales chips */}
      <div className="px-4 pb-4 flex items-center gap-2">
        {sales.map((s, i) => (
          <div
            key={i}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
              s.type === 'FP'
                ? 'bg-primary/10 text-primary'
                : 'bg-accent/20 text-accent-foreground'
            }`}
          >
            <span>{s.type}</span>
            <span className="font-bold">${s.prmr}</span>
          </div>
        ))}
        <div className="ml-auto text-xs text-muted-foreground">
          Total: <span className="font-bold text-foreground">${totalPrmr} PRMR</span>
        </div>
      </div>
    </motion.div>
  );
};
