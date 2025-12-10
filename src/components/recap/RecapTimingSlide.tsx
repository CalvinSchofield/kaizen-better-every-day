import { motion } from 'framer-motion';
import { Clock, Sunrise, Sunset, Zap } from 'lucide-react';

interface RecapTimingSlideProps {
  avgStartTime: string | null;
  avgEndTime: string | null;
  totalHours: number;
  peakHour: number | null;
}

function formatHour(hour: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour} ${period}`;
}

export function RecapTimingSlide({ avgStartTime, avgEndTime, totalHours, peakHour }: RecapTimingSlideProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', duration: 0.6 }}
        className="mb-6"
      >
        <div className="w-20 h-20 rounded-full bg-blue-500/20 flex items-center justify-center">
          <Clock className="w-10 h-10 text-blue-500" />
        </div>
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="text-muted-foreground text-lg mb-6 uppercase tracking-wide"
      >
        Your Schedule
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="space-y-6 w-full max-w-xs"
      >
        {avgStartTime && (
          <div className="flex items-center justify-between bg-muted/30 rounded-xl px-4 py-3">
            <div className="flex items-center gap-3">
              <Sunrise className="w-5 h-5 text-orange-400" />
              <span className="text-muted-foreground">Avg Start</span>
            </div>
            <span className="text-xl font-semibold">{avgStartTime}</span>
          </div>
        )}

        {avgEndTime && (
          <div className="flex items-center justify-between bg-muted/30 rounded-xl px-4 py-3">
            <div className="flex items-center gap-3">
              <Sunset className="w-5 h-5 text-purple-400" />
              <span className="text-muted-foreground">Avg End</span>
            </div>
            <span className="text-xl font-semibold">{avgEndTime}</span>
          </div>
        )}

        <div className="flex items-center justify-between bg-muted/30 rounded-xl px-4 py-3">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-blue-400" />
            <span className="text-muted-foreground">Total Hours</span>
          </div>
          <span className="text-xl font-semibold">{totalHours.toFixed(1)}h</span>
        </div>

        {peakHour !== null && (
          <div className="flex items-center justify-between bg-muted/30 rounded-xl px-4 py-3">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-yellow-400" />
              <span className="text-muted-foreground">Peak Hour</span>
            </div>
            <span className="text-xl font-semibold">{formatHour(peakHour)}</span>
          </div>
        )}
      </motion.div>
    </div>
  );
}
