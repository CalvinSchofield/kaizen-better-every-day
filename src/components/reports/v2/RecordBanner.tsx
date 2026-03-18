import { motion } from "framer-motion";
import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ActiveRecord, GRANULARITY_LABELS } from "@/utils/teamRecordDetection";

interface RecordBannerProps {
  records: ActiveRecord[];
  onClick?: () => void;
}

export const RecordBanner = ({ records, onClick }: RecordBannerProps) => {
  if (records.length === 0) return null;

  // Split into confirmed records and "on pace"
  const confirmed = records.filter(r => r.isRecord);
  const onPace = records.filter(r => r.onPace && !r.isRecord);

  // Show up to 3 items
  const displayRecords = [...confirmed, ...onPace].slice(0, 3);
  const granularity = displayRecords[0]?.granularity;
  const granLabel = granularity ? GRANULARITY_LABELS[granularity] : 'day';

  const hasConfirmed = confirmed.length > 0;

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all active:scale-[0.98]",
        hasConfirmed
          ? "bg-amber-500/10 border border-amber-400/30"
          : "bg-primary/5 border border-primary/20"
      )}
    >
      <Crown className={cn(
        "w-4 h-4 flex-shrink-0",
        hasConfirmed ? "text-amber-500" : "text-primary"
      )} />
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-xs font-semibold truncate",
          hasConfirmed ? "text-amber-700 dark:text-amber-400" : "text-primary"
        )}>
          {displayRecords.map((r, i) => {
            const prefix = r.isRecord
              ? (r.dayOfWeekLabel || `Best ${granLabel}`)
              : `On pace for best ${granLabel}`;
            return (
              <span key={r.metricKey}>
                {i > 0 && <span className="opacity-50"> · </span>}
                {prefix} {r.label}
              </span>
            );
          })}
        </p>
      </div>
      {records.length > 3 && (
        <span className={cn(
          "text-[10px] font-medium flex-shrink-0",
          hasConfirmed ? "text-amber-600/70 dark:text-amber-400/70" : "text-primary/70"
        )}>
          +{records.length - 3}
        </span>
      )}
    </motion.button>
  );
};
