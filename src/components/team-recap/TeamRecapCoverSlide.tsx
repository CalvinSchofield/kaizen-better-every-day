import { motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { Trophy } from 'lucide-react';

interface TeamRecapCoverSlideProps {
  reportType: 'weekly' | 'monthly' | 'blitz';
  periodStart: string;
  periodEnd: string;
}

export function TeamRecapCoverSlide({ reportType, periodStart, periodEnd }: TeamRecapCoverSlideProps) {
  const startDate = parseISO(periodStart);
  const endDate = parseISO(periodEnd);

  let periodTitle = '';
  let periodSubtitle = '';

  if (reportType === 'weekly') {
    periodTitle = 'WEEK IN REVIEW';
    periodSubtitle = `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`;
  } else if (reportType === 'monthly') {
    periodTitle = format(startDate, 'MMMM yyyy').toUpperCase();
    periodSubtitle = 'Month in Review';
  } else {
    periodTitle = 'BLITZ RECAP';
    periodSubtitle = `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`;
  }

  return (
    <div className="h-full flex flex-col items-center justify-center px-8 text-center">
      {/* Trophy icon */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mb-8"
      >
        <Trophy className="w-20 h-20 text-primary" />
      </motion.div>

      {/* Period title */}
      <motion.h1
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="text-3xl font-black tracking-wider text-foreground mb-3"
      >
        {periodTitle}
      </motion.h1>

      {/* Period subtitle */}
      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.6 }}
        className="text-lg text-muted-foreground"
      >
        {periodSubtitle}
      </motion.p>

      {/* Tap prompt */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 1.0 }}
        className="absolute bottom-16 text-sm text-muted-foreground"
      >
        Tap to continue →
      </motion.p>
    </div>
  );
}
