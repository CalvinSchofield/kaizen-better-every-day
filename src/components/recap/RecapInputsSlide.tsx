import { motion } from 'framer-motion';
import { DoorOpen, Users, MessageSquare, ArrowRightLeft, Presentation, CheckCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface RecapInputsSlideProps {
  doors: number;
  pitches: number;
  transitions: number;
  presentations: number;
  closes: number;
  daysWorked: number;
  comparison?: {
    doors: number;
    pitches: number;
    transitions: number;
    presentations: number;
    closes: number;
  };
}

function TrendBadge({ value }: { value: number }) {
  if (value === 0) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="w-3 h-3" />
      </span>
    );
  }
  if (value > 0) {
    return (
      <span className="flex items-center gap-1 text-xs text-green-500">
        <TrendingUp className="w-3 h-3" />
        +{Math.round(value)}%
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-red-400">
      <TrendingDown className="w-3 h-3" />
      {Math.round(value)}%
    </span>
  );
}

function MetricRow({ 
  icon: Icon, 
  label, 
  value, 
  comparison, 
  delay,
  color = 'text-primary'
}: { 
  icon: React.ElementType; 
  label: string; 
  value: number; 
  comparison?: number; 
  delay: number;
  color?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="flex items-center justify-between bg-muted/30 rounded-xl px-4 py-3"
    >
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full bg-muted flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
        <span className="text-muted-foreground text-sm">{label}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xl font-semibold">{value.toLocaleString()}</span>
        {comparison !== undefined && <TrendBadge value={comparison} />}
      </div>
    </motion.div>
  );
}

export function RecapInputsSlide({ 
  doors, 
  pitches, 
  transitions, 
  presentations, 
  closes,
  daysWorked,
  comparison 
}: RecapInputsSlideProps) {
  return (
    <div className="flex flex-col items-center h-full px-6 pt-8 pb-4 overflow-y-auto">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', duration: 0.6 }}
        className="mb-4"
      >
        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
          <DoorOpen className="w-8 h-8 text-primary" />
        </div>
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="text-muted-foreground text-sm mb-1 uppercase tracking-wide"
      >
        Your Inputs
      </motion.p>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="text-xs text-muted-foreground mb-6"
      >
        {daysWorked} days worked
      </motion.p>

      <div className="w-full max-w-sm space-y-2">
        <MetricRow 
          icon={DoorOpen} 
          label="Doors" 
          value={doors} 
          comparison={comparison?.doors}
          delay={0.3}
          color="text-orange-400"
        />
        <MetricRow 
          icon={MessageSquare} 
          label="Pitches" 
          value={pitches} 
          comparison={comparison?.pitches}
          delay={0.35}
          color="text-blue-400"
        />
        <MetricRow 
          icon={ArrowRightLeft} 
          label="Transitions" 
          value={transitions} 
          comparison={comparison?.transitions}
          delay={0.4}
          color="text-purple-400"
        />
        <MetricRow 
          icon={Presentation} 
          label="Presentations" 
          value={presentations} 
          comparison={comparison?.presentations}
          delay={0.45}
          color="text-cyan-400"
        />
        <MetricRow 
          icon={CheckCircle} 
          label="Closes" 
          value={closes} 
          comparison={comparison?.closes}
          delay={0.5}
          color="text-green-400"
        />
      </div>
    </div>
  );
}
