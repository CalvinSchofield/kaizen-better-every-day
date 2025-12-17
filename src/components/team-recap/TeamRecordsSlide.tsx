import { motion } from 'framer-motion';
import { Trophy, Sparkles } from 'lucide-react';

interface RecordItem {
  type: 'individual' | 'team' | 'mgmt' | 'office';
  category: string;
  holder: string;
  value: number | string;
  previousBest?: number | string;
  date?: string;
}

interface TeamRecordsSlideProps {
  records: RecordItem[];
}

const typeLabels: { [key: string]: { label: string; color: string } } = {
  individual: { label: 'Personal Record', color: 'text-yellow-400' },
  team: { label: 'Team Record', color: 'text-blue-400' },
  mgmt: { label: 'MGMT Group Record', color: 'text-purple-400' },
  office: { label: 'Office Record', color: 'text-green-400' },
};

export function TeamRecordsSlide({ records }: TeamRecordsSlideProps) {
  return (
    <div className="h-full flex flex-col px-4 pt-4 overflow-y-auto pb-8">
      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex flex-col items-center justify-center mb-6"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.2 }}
          className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center mb-3"
        >
          <Trophy className="w-10 h-10 text-yellow-500" />
        </motion.div>
        <h2 className="text-2xl font-black text-yellow-400">RECORDS BROKEN</h2>
        <p className="text-sm text-muted-foreground">This period's record-setters</p>
      </motion.div>

      {/* Records list */}
      <div className="space-y-3">
        {records.map((record, idx) => {
          const typeConfig = typeLabels[record.type] || { label: 'Record', color: 'text-primary' };

          return (
            <motion.div
              key={`${record.type}-${record.category}-${idx}`}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.1 * idx }}
              className="bg-gradient-to-r from-yellow-500/10 to-yellow-500/5 rounded-xl p-4 border border-yellow-500/20"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className={`text-xs font-bold uppercase tracking-wide ${typeConfig.color}`}>
                    {typeConfig.label}
                  </p>
                  <p className="font-semibold mt-1">{record.holder}</p>
                  <p className="text-sm text-muted-foreground">{record.category}</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1">
                    <Sparkles className="w-4 h-4 text-yellow-400" />
                    <p className="text-2xl font-black text-yellow-400">
                      {typeof record.value === 'number' ? record.value.toFixed(1) : record.value}
                    </p>
                  </div>
                  {record.previousBest && (
                    <p className="text-xs text-muted-foreground">
                      Previous: {typeof record.previousBest === 'number' ? record.previousBest.toFixed(1) : record.previousBest}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {records.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <Trophy className="w-12 h-12 text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">No records broken this period</p>
          <p className="text-sm text-muted-foreground">Keep pushing!</p>
        </div>
      )}
    </div>
  );
}
