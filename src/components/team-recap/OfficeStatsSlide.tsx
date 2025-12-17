import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Clock, Users, DoorOpen, Target, Pencil } from 'lucide-react';

interface OfficeStatsSlideProps {
  totals: {
    fp: number;
    efp: number;
    prmr: number;
    doors: number;
    pitches: number;
    transitions: number;
    presentations: number;
    closes: number;
    hours: number;
    avgStartTime: string;
    avgEndTime: string;
    daysWorked: number;
    uniqueReps: number;
  };
  growth: {
    fp: number;
    efp: number;
    prmr: number;
    doors: number;
    hours: number;
  };
  onEditValue?: (field: string, label: string, currentValue: number | string, type?: 'number' | 'text') => void;
}

function GrowthBadge({ value, size = 'sm' }: { value: number; size?: 'sm' | 'lg' }) {
  if (value === 0) return null;
  
  const isPositive = value > 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  const colorClass = isPositive ? 'text-green-500 bg-green-500/10' : 'text-red-500 bg-red-500/10';
  const sizeClass = size === 'lg' ? 'text-sm px-2 py-1' : 'text-xs px-1.5 py-0.5';
  
  return (
    <span className={`inline-flex items-center gap-1 rounded-full ${colorClass} ${sizeClass}`}>
      <Icon className={size === 'lg' ? 'w-4 h-4' : 'w-3 h-3'} />
      {isPositive ? '+' : ''}{value.toFixed(0)}%
    </span>
  );
}

function AnimatedCounter({ value, suffix = '', delay = 0 }: { value: number; suffix?: string; delay?: number }) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay }}
    >
      {value.toLocaleString()}{suffix}
    </motion.span>
  );
}

export function OfficeStatsSlide({ totals, growth, onEditValue }: OfficeStatsSlideProps) {
  const stats = [
    { icon: DoorOpen, label: 'Doors', value: totals.doors, growth: growth.doors, field: 'officeTotals.doors' },
    { icon: Target, label: 'Pitches', value: totals.pitches, field: 'officeTotals.pitches' },
    { icon: Target, label: 'Transitions', value: totals.transitions, field: 'officeTotals.transitions' },
    { icon: Target, label: 'Presentations', value: totals.presentations, field: 'officeTotals.presentations' },
  ];

  const EditHint = () => onEditValue ? (
    <Pencil className="w-3 h-3 text-muted-foreground/50 absolute top-2 right-2" />
  ) : null;

  return (
    <div className="h-full flex flex-col px-6 pt-4 overflow-y-auto">
      {/* Header */}
      <motion.h2
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-xl font-bold text-center text-muted-foreground mb-4"
      >
        OFFICE STATS
      </motion.h2>

      {/* Hero stats */}
      <div className="flex flex-col items-center mb-6">
        {/* FP+ */}
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.2 }}
          className="text-center mb-2 relative"
          onClick={() => onEditValue?.('officeTotals.fp', 'FP+', totals.fp)}
          disabled={!onEditValue}
        >
          {onEditValue && <EditHint />}
          <p className="text-6xl font-black text-primary">
            <AnimatedCounter value={totals.fp} delay={0.3} />
          </p>
          <div className="flex items-center justify-center gap-2">
            <p className="text-lg font-medium text-muted-foreground">FP+</p>
            <GrowthBadge value={growth.fp} size="lg" />
          </div>
        </motion.button>

        {/* EFP & PRMR row */}
        <div className="flex gap-8 mt-4">
          <motion.button
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-center relative"
            onClick={() => onEditValue?.('officeTotals.efp', 'EFP', totals.efp)}
            disabled={!onEditValue}
          >
            <p className="text-3xl font-bold text-foreground">
              <AnimatedCounter value={totals.efp} delay={0.5} />
            </p>
            <div className="flex items-center justify-center gap-1">
              <p className="text-sm text-muted-foreground">EFP</p>
              <GrowthBadge value={growth.efp} />
            </div>
          </motion.button>

          <motion.button
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-center relative"
            onClick={() => onEditValue?.('officeTotals.prmr', 'PRMR', totals.prmr)}
            disabled={!onEditValue}
          >
            <p className="text-3xl font-bold text-foreground">
              $<AnimatedCounter value={totals.prmr} delay={0.5} />
            </p>
            <div className="flex items-center justify-center gap-1">
              <p className="text-sm text-muted-foreground">PRMR</p>
              <GrowthBadge value={growth.prmr} />
            </div>
          </motion.button>
        </div>
      </div>

      {/* Input stats grid */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="grid grid-cols-2 gap-3 mb-6"
      >
        {stats.map((stat, idx) => (
          <button 
            key={stat.label}
            className="bg-card/50 rounded-xl p-3 flex items-center gap-3 text-left hover:bg-card/70 transition-colors active:scale-95"
            onClick={() => onEditValue?.(stat.field, stat.label, stat.value)}
            disabled={!onEditValue}
          >
            <div className="p-2 rounded-lg bg-primary/10">
              <stat.icon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xl font-bold">{stat.value.toLocaleString()}</p>
              <div className="flex items-center gap-1">
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                {stat.growth !== undefined && <GrowthBadge value={stat.growth} />}
              </div>
            </div>
          </button>
        ))}
      </motion.div>

      {/* Time stats */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="bg-card/50 rounded-xl p-4"
      >
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Time Stats</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-2xl font-bold">{totals.hours.toFixed(0)}</p>
            <div className="flex items-center gap-1">
              <p className="text-xs text-muted-foreground">Total Hours</p>
              <GrowthBadge value={growth.hours} />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold">{totals.uniqueReps}</p>
            <p className="text-xs text-muted-foreground">Reps Working</p>
          </div>
          <div>
            <p className="text-lg font-semibold">{totals.avgStartTime}</p>
            <p className="text-xs text-muted-foreground">Avg Start</p>
          </div>
          <div>
            <p className="text-lg font-semibold">{totals.avgEndTime}</p>
            <p className="text-xs text-muted-foreground">Avg End</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
