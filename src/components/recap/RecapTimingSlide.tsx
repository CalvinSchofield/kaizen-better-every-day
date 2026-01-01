import { motion } from 'framer-motion';
import { Clock, Sunrise, Sunset, Zap, TrendingUp, TrendingDown } from 'lucide-react';

interface TimeComparison {
  hoursWorked: number;
  avgStartTime: { earlier: boolean; diff: number } | null;
  avgEndTime: { later: boolean; diff: number } | null;
}

interface RecapTimingSlideProps {
  avgStartTime: string | null;
  avgEndTime: string | null;
  totalHours: number;
  peakHour: number | null;
  daysWorked?: number;
  timeComparison?: TimeComparison;
}

function formatHour(hour: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour} ${period}`;
}

function TimeTrendBadge({ earlier, diff }: { earlier: boolean; diff: number }) {
  const mins = Math.round(diff);
  if (mins < 1) return null;
  
  return (
    <span className={`flex items-center gap-1 text-xs ${earlier ? 'text-green-500' : 'text-orange-400'}`}>
      {earlier ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {mins}m {earlier ? 'earlier' : 'later'}
    </span>
  );
}

function HoursTrendBadge({ value }: { value: number }) {
  if (value === 0) return null;
  const isPositive = value > 0;
  
  return (
    <span className={`flex items-center gap-1 text-xs ${isPositive ? 'text-green-500' : 'text-red-400'}`}>
      {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {isPositive ? '+' : ''}{Math.round(value)}%
    </span>
  );
}

export function RecapTimingSlide({ 
  avgStartTime, 
  avgEndTime, 
  totalHours, 
  peakHour,
  daysWorked,
  timeComparison 
}: RecapTimingSlideProps) {
  return (
    <div className="flex flex-col items-center h-full px-6 pt-8 pb-4 overflow-y-auto">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', duration: 0.6 }}
        className="mb-4"
      >
        <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center">
          <Clock className="w-8 h-8 text-blue-500" />
        </div>
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="text-muted-foreground text-sm mb-1 uppercase tracking-wide"
      >
        Your Schedule
      </motion.p>

      {daysWorked !== undefined && (
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="text-xs text-muted-foreground mb-6"
        >
          {daysWorked} days worked
        </motion.p>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="space-y-3 w-full max-w-xs"
      >
        {/* Total Hours - prominent */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-blue-400" />
              <span className="text-muted-foreground">Total Hours</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{totalHours.toFixed(1)}h</span>
              {timeComparison && <HoursTrendBadge value={timeComparison.hoursWorked} />}
            </div>
          </div>
        </div>

        {avgStartTime && (
          <div className="flex items-center justify-between bg-muted/30 rounded-xl px-4 py-3">
            <div className="flex items-center gap-3">
              <Sunrise className="w-5 h-5 text-orange-400" />
              <span className="text-muted-foreground text-sm">Avg Start</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold">{avgStartTime}</span>
              {timeComparison?.avgStartTime && (
                <TimeTrendBadge earlier={timeComparison.avgStartTime.earlier} diff={timeComparison.avgStartTime.diff} />
              )}
            </div>
          </div>
        )}

        {avgEndTime && (
          <div className="flex items-center justify-between bg-muted/30 rounded-xl px-4 py-3">
            <div className="flex items-center gap-3">
              <Sunset className="w-5 h-5 text-purple-400" />
              <span className="text-muted-foreground text-sm">Avg End</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold">{avgEndTime}</span>
              {timeComparison?.avgEndTime && (
                <TimeTrendBadge earlier={!timeComparison.avgEndTime.later} diff={timeComparison.avgEndTime.diff} />
              )}
            </div>
          </div>
        )}

        {peakHour !== null && (
          <div className="flex items-center justify-between bg-muted/30 rounded-xl px-4 py-3">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-yellow-400" />
              <span className="text-muted-foreground text-sm">Peak Hour</span>
            </div>
            <span className="text-lg font-semibold">{formatHour(peakHour)}</span>
          </div>
        )}
      </motion.div>
    </div>
  );
}
