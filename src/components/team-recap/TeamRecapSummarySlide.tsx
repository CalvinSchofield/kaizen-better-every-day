import { motion } from 'framer-motion';
import { Sparkles, Target, Clock, Users, PartyPopper } from 'lucide-react';

interface TeamRecapSummarySlideProps {
  reportType: 'weekly' | 'monthly' | 'blitz';
  totals: {
    fp: number;
    efp: number;
    prmr: number;
    doors: number;
    hours: number;
    uniqueReps: number;
  };
}

export function TeamRecapSummarySlide({ reportType, totals }: TeamRecapSummarySlideProps) {
  const getTitle = () => {
    if (reportType === 'blitz') return 'What a blitz!';
    if (reportType === 'monthly') return 'What a month!';
    return 'What a week!';
  };

  const stats = [
    { icon: Target, value: totals.fp.toFixed(1), label: 'FP+' },
    { icon: Sparkles, value: `$${totals.prmr.toLocaleString()}`, label: 'PRMR' },
    { icon: Clock, value: `${totals.hours.toFixed(0)}h`, label: 'Hours' },
    { icon: Users, value: totals.uniqueReps, label: 'Reps' },
  ];

  return (
    <div className="h-full flex flex-col items-center justify-center px-8 text-center">
      {/* Celebration icon */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', duration: 0.8 }}
        className="mb-6"
      >
        <PartyPopper className="w-16 h-16 text-primary" />
      </motion.div>

      {/* Title */}
      <motion.h1
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-4xl font-black text-foreground mb-8"
      >
        {getTitle()}
      </motion.h1>

      {/* Quick stats */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="grid grid-cols-2 gap-4 w-full max-w-xs"
      >
        {stats.map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.6 + idx * 0.1, type: 'spring' }}
            className="bg-card/50 rounded-xl p-3 text-center"
          >
            <stat.icon className="w-5 h-5 mx-auto text-primary mb-1" />
            <p className="text-xl font-bold">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
