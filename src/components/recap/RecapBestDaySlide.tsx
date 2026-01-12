import { motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { Trophy, TrendingUp } from 'lucide-react';

interface RecapBestDaySlideProps {
  date: string;
  doors: number;
  fpPlus: number;
  prmr?: number;
  closes?: number;
  hoursWorked?: number;
  avgDoorsPerDay?: number;
  avgPrmrPerDay?: number;
  efpModeEnabled?: boolean;
}

export function RecapBestDaySlide({ 
  date, 
  doors, 
  fpPlus, 
  prmr, 
  closes,
  hoursWorked,
  avgDoorsPerDay = 0,
  avgPrmrPerDay = 0,
  efpModeEnabled 
}: RecapBestDaySlideProps) {
  const dayName = format(parseISO(date), 'EEEE');
  const formattedDate = format(parseISO(date), 'MMMM d');

  // Calculate display value based on mode
  // EFP = PRMR / 85, FP+ = raw fp_plus
  const displayValue = efpModeEnabled && prmr !== undefined
    ? (prmr / 85).toFixed(1)
    : fpPlus.toString();
  
  const displayLabel = efpModeEnabled ? 'EFP' : 'FP+';
  const hasValue = efpModeEnabled ? (prmr !== undefined && prmr > 0) : fpPlus > 0;

  // Calculate comparison to average
  const efpValue = prmr ? prmr / 85 : 0;
  const avgEfpPerDay = avgPrmrPerDay / 85;
  
  const doorsVsAvg = avgDoorsPerDay > 0 ? Math.round(((doors - avgDoorsPerDay) / avgDoorsPerDay) * 100) : 0;
  const efpVsAvg = avgEfpPerDay > 0 ? Math.round(((efpValue - avgEfpPerDay) / avgEfpPerDay) * 100) : 0;

  // Format hours worked
  const formatHours = (hours: number) => {
    const hrs = Math.floor(hours);
    const mins = Math.round((hours - hrs) * 60);
    if (mins === 0) return `${hrs}h`;
    return `${hrs}h ${mins}m`;
  };

  return (
    <div className="flex flex-col items-center h-full pt-8 pb-4 overflow-y-auto px-8">
      <div className="flex-1 flex flex-col items-center justify-center text-center">
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
          className="text-muted-foreground mb-6"
        >
          {formattedDate}
        </motion.p>

        {/* Primary metrics */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          className="flex gap-8 mb-6"
        >
          {hasValue ? (
            <>
              <div className="text-center">
                <p className="text-4xl font-bold text-green-500">{displayValue}</p>
                <p className="text-muted-foreground">{displayLabel}</p>
              </div>
              <div className="text-center">
                <p className="text-4xl font-bold">{doors}</p>
                <p className="text-muted-foreground">Doors</p>
              </div>
            </>
          ) : (
            <div className="text-center">
              <p className="text-4xl font-bold">{doors}</p>
              <p className="text-muted-foreground">Doors</p>
            </div>
          )}
        </motion.div>

        {/* Additional context */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.4 }}
          className="flex flex-wrap justify-center gap-3 mb-6"
        >
          {closes !== undefined && closes > 0 && (
            <div className="bg-muted/50 rounded-full px-4 py-2">
              <span className="text-sm font-medium">{closes} Close{closes !== 1 ? 's' : ''}</span>
            </div>
          )}
          {hoursWorked !== undefined && hoursWorked > 0 && (
            <div className="bg-muted/50 rounded-full px-4 py-2">
              <span className="text-sm font-medium">{formatHours(hoursWorked)} worked</span>
            </div>
          )}
        </motion.div>

        {/* Comparison to average */}
        {(doorsVsAvg !== 0 || (hasValue && efpVsAvg !== 0)) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0, duration: 0.4 }}
            className="bg-primary/10 rounded-xl px-5 py-3"
          >
            <div className="flex items-center gap-2 text-sm">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground">
                {hasValue && efpVsAvg > 0 ? (
                  <span><span className="font-semibold text-green-500">+{efpVsAvg}%</span> more {displayLabel} than average</span>
                ) : doorsVsAvg > 0 ? (
                  <span><span className="font-semibold text-green-500">+{doorsVsAvg}%</span> more doors than average</span>
                ) : null}
              </span>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
