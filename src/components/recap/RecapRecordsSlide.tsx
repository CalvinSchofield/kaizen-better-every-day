import { motion } from 'framer-motion';
import { Trophy, DoorOpen, Zap, Clock, Sunrise, Sunset, MessageSquare, ArrowRightLeft, Presentation, CheckCircle, DollarSign } from 'lucide-react';
import { RecapStats } from '@/hooks/useRecapData';

interface RecapRecordsSlideProps {
  records: RecapStats['records'];
}

interface RecordItemProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  previousBest: string | number;
  delay: number;
}

function RecordItem({ icon: Icon, label, value, previousBest, delay }: RecordItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="flex items-center gap-3 p-3 rounded-xl bg-yellow-500/20 border border-yellow-500/30"
    >
      <div className="w-10 h-10 rounded-full bg-yellow-500/30 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-yellow-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-yellow-200/80 truncate">{label}</p>
        <p className="text-lg font-bold text-yellow-300">{value}</p>
        <p className="text-xs text-muted-foreground">Prev: {previousBest}</p>
      </div>
      <Trophy className="w-6 h-6 text-yellow-400 flex-shrink-0" />
    </motion.div>
  );
}

export function RecapRecordsSlide({ records }: RecapRecordsSlideProps) {
  const recordsList: { key: string; icon: React.ElementType; label: string; value: string | number; previousBest: string | number }[] = [];
  
  if (records.mostDoorsInDay.isRecord) {
    recordsList.push({
      key: 'doors',
      icon: DoorOpen,
      label: 'Most Doors in a Day',
      value: records.mostDoorsInDay.value,
      previousBest: records.mostDoorsInDay.previousBest || 'N/A'
    });
  }
  
  if (records.mostPitchesInDay?.isRecord) {
    recordsList.push({
      key: 'pitches',
      icon: MessageSquare,
      label: 'Most Pitches in a Day',
      value: records.mostPitchesInDay.value,
      previousBest: records.mostPitchesInDay.previousBest || 'N/A'
    });
  }
  
  if (records.mostTransitionsInDay?.isRecord) {
    recordsList.push({
      key: 'transitions',
      icon: ArrowRightLeft,
      label: 'Most Transitions in a Day',
      value: records.mostTransitionsInDay.value,
      previousBest: records.mostTransitionsInDay.previousBest || 'N/A'
    });
  }
  
  if (records.mostPresentationsInDay?.isRecord) {
    recordsList.push({
      key: 'presentations',
      icon: Presentation,
      label: 'Most Presentations in a Day',
      value: records.mostPresentationsInDay.value,
      previousBest: records.mostPresentationsInDay.previousBest || 'N/A'
    });
  }
  
  if (records.mostClosesInDay?.isRecord) {
    recordsList.push({
      key: 'closes',
      icon: CheckCircle,
      label: 'Most Closes in a Day',
      value: records.mostClosesInDay.value,
      previousBest: records.mostClosesInDay.previousBest || 'N/A'
    });
  }
  
  if (records.mostFpInDay.isRecord) {
    recordsList.push({
      key: 'fp',
      icon: Zap,
      label: 'Most FP+ in a Day',
      value: records.mostFpInDay.value,
      previousBest: records.mostFpInDay.previousBest || 'N/A'
    });
  }
  
  if (records.mostPrmrInDay?.isRecord) {
    recordsList.push({
      key: 'prmr',
      icon: DollarSign,
      label: 'Most PRMR in a Day',
      value: `$${records.mostPrmrInDay.value.toLocaleString()}`,
      previousBest: records.mostPrmrInDay.previousBest ? `$${records.mostPrmrInDay.previousBest.toLocaleString()}` : 'N/A'
    });
  }
  
  if (records.mostHoursInDay.isRecord) {
    recordsList.push({
      key: 'hours',
      icon: Clock,
      label: 'Longest Day Worked',
      value: `${records.mostHoursInDay.value}h`,
      previousBest: `${records.mostHoursInDay.previousBest}h`
    });
  }
  
  if (records.earliestStart.isRecord && records.earliestStart.value) {
    recordsList.push({
      key: 'start',
      icon: Sunrise,
      label: 'Earliest Start Time',
      value: records.earliestStart.value,
      previousBest: records.earliestStart.previousBest || 'N/A'
    });
  }
  
  if (records.latestEnd?.isRecord && records.latestEnd.value) {
    recordsList.push({
      key: 'end',
      icon: Sunset,
      label: 'Latest End Time',
      value: records.latestEnd.value,
      previousBest: records.latestEnd.previousBest || 'N/A'
    });
  }

  return (
    <div className="h-full flex flex-col items-center px-6 pt-8 pb-4 overflow-y-auto">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center mb-4"
      >
        <Trophy className="w-8 h-8 text-yellow-400" />
      </motion.div>
      
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-sm uppercase tracking-widest text-yellow-400 mb-1"
      >
        Personal Records
      </motion.h2>
      
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-lg font-semibold text-foreground mb-6 text-center"
      >
        You crushed {recordsList.length} {recordsList.length === 1 ? 'record' : 'records'}! 🎉
      </motion.p>
      
      <div className="w-full max-w-sm space-y-2">
        {recordsList.map((record, index) => (
          <RecordItem
            key={record.key}
            icon={record.icon}
            label={record.label}
            value={record.value}
            previousBest={record.previousBest}
            delay={0.4 + index * 0.1}
          />
        ))}
      </div>
    </div>
  );
}
