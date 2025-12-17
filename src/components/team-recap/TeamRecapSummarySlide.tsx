import { motion } from 'framer-motion';
import { Sparkles, Rocket, Target, Clock, Users } from 'lucide-react';
import KaizenLogo from '@/components/KaizenLogo';

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
  const getMessage = () => {
    if (reportType === 'blitz') {
      return { title: 'What a blitz!', subtitle: 'The grind never stops' };
    }
    if (reportType === 'monthly') {
      return { title: 'What a month!', subtitle: 'One month at a time' };
    }
    return { title: 'What a week!', subtitle: "Let's keep building" };
  };

  const message = getMessage();

  const stats = [
    { icon: Target, value: totals.fp.toFixed(1), label: 'FP+' },
    { icon: Sparkles, value: `$${totals.prmr.toLocaleString()}`, label: 'PRMR' },
    { icon: Clock, value: `${totals.hours.toFixed(0)}h`, label: 'Hours' },
    { icon: Users, value: totals.uniqueReps, label: 'Reps' },
  ];

  return (
    <div className="h-full flex flex-col items-center justify-center px-8 text-center">
      {/* Animated logo */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', duration: 0.8 }}
        className="mb-6 w-20 h-20 text-primary"
      >
        <KaizenLogo />
      </motion.div>

      {/* Title */}
      <motion.h1
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-4xl font-black text-foreground mb-2"
      >
        {message.title}
      </motion.h1>

      {/* Subtitle */}
      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-lg text-muted-foreground mb-8"
      >
        {message.subtitle}
      </motion.p>

      {/* Quick stats */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="grid grid-cols-2 gap-4 w-full max-w-xs"
      >
        {stats.map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.8 + idx * 0.1, type: 'spring' }}
            className="bg-card/50 rounded-xl p-3 text-center"
          >
            <stat.icon className="w-5 h-5 mx-auto text-primary mb-1" />
            <p className="text-xl font-bold">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="absolute bottom-16 flex items-center gap-2 text-primary"
      >
        <Rocket className="w-5 h-5" />
        <span className="font-semibold">Keep pushing</span>
      </motion.div>
    </div>
  );
}
