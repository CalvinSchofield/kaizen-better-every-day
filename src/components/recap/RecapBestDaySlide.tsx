import { motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { Trophy } from 'lucide-react';

interface RecapBestDaySlideProps {
  date: string;
  doors: number;
  fpPlus: number;
}

export function RecapBestDaySlide({ date, doors, fpPlus }: RecapBestDaySlideProps) {
  const dayName = format(parseISO(date), 'EEEE');
  const formattedDate = format(parseISO(date), 'MMMM d');

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', duration: 0.6 }}
        className="mb-6"
      >
        <div className="w-20 h-20 rounded-full bg-yellow-500/20 flex items-center justify-center">
          <Trophy className="w-10 h-10 text-yellow-500" />
        </div>
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="text-muted-foreground text-lg mb-2 uppercase tracking-wide"
      >
        Your Best Day
      </motion.p>

      <motion.h2
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="text-4xl font-bold mb-1"
      >
        {dayName}
      </motion.h2>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className="text-muted-foreground mb-8"
      >
        {formattedDate}
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.4 }}
        className="flex gap-8"
      >
        <div className="text-center">
          <p className="text-4xl font-bold">{doors}</p>
          <p className="text-muted-foreground">Doors</p>
        </div>
        {fpPlus > 0 && (
          <div className="text-center">
            <p className="text-4xl font-bold text-green-500">{fpPlus}</p>
            <p className="text-muted-foreground">FP+</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
