import { motion } from 'framer-motion';
import { Trophy, DoorOpen, Zap, Clock, Sunrise } from 'lucide-react';
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
      className="flex items-center gap-4 p-4 rounded-xl bg-yellow-500/20 border border-yellow-500/30"
    >
      <div className="w-12 h-12 rounded-full bg-yellow-500/30 flex items-center justify-center">
        <Icon className="w-6 h-6 text-yellow-400" />
      </div>
      <div className="flex-1">
        <p className="text-sm text-yellow-200/80">{label}</p>
        <p className="text-2xl font-bold text-yellow-300">{value}</p>
        <p className="text-xs text-muted-foreground">Previous best: {previousBest}</p>
      </div>
      <Trophy className="w-8 h-8 text-yellow-400" />
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
  
  if (records.mostFpInDay.isRecord) {
    recordsList.push({
      key: 'fp',
      icon: Zap,
      label: 'Most FP+ in a Day',
      value: records.mostFpInDay.value,
      previousBest: records.mostFpInDay.previousBest || 'N/A'
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

  return (
    <div className="h-full flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        className="w-20 h-20 rounded-full bg-yellow-500/20 flex items-center justify-center mb-6"
      >
        <Trophy className="w-10 h-10 text-yellow-400" />
      </motion.div>
      
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-sm uppercase tracking-widest text-yellow-400 mb-2"
      >
        Personal Records
      </motion.h2>
      
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-xl font-semibold text-foreground mb-8 text-center"
      >
        You crushed {recordsList.length} personal {recordsList.length === 1 ? 'record' : 'records'}!
      </motion.p>
      
      <div className="w-full max-w-sm space-y-3">
        {recordsList.map((record, index) => (
          <RecordItem
            key={record.key}
            icon={record.icon}
            label={record.label}
            value={record.value}
            previousBest={record.previousBest}
            delay={0.4 + index * 0.15}
          />
        ))}
      </div>
    </div>
  );
}
