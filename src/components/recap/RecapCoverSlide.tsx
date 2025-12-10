import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { RecapStats } from '@/hooks/useRecapData';
import { Sparkles } from 'lucide-react';

interface RecapCoverSlideProps {
  stats: RecapStats;
}

export function RecapCoverSlide({ stats }: RecapCoverSlideProps) {
  const periodTitle = stats.period === 'week' ? 'Your Week' : 'Your Month';
  const dateRange = `${format(stats.dateRange.start, 'MMM d')} - ${format(stats.dateRange.end, 'MMM d')}`;

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', duration: 0.8 }}
        className="mb-8"
      >
        <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center">
          <Sparkles className="w-12 h-12 text-primary" />
        </div>
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="text-4xl font-bold mb-2"
      >
        {periodTitle}
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        className="text-2xl font-medium text-primary mb-4"
      >
        In Review
      </motion.p>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7, duration: 0.5 }}
        className="text-muted-foreground text-lg"
      >
        {dateRange}
      </motion.p>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.5 }}
        className="text-sm text-muted-foreground mt-12"
      >
        Tap to continue
      </motion.p>
    </div>
  );
}
