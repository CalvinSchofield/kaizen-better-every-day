import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription,
} from "@/components/ui/drawer";
import { Crown, TrendingUp, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ActiveRecord,
  formatRecordDate,
  minutesToTimeStr,
  GRANULARITY_LABELS,
} from "@/utils/teamRecordDetection";

interface RecordDetailsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  records: ActiveRecord[];
}

export const RecordDetailsDrawer = ({ open, onOpenChange, records }: RecordDetailsDrawerProps) => {
  const confirmed = records.filter(r => r.isRecord);
  const onPace = records.filter(r => r.onPace && !r.isRecord);

  const formatValue = (key: string, value: number): string => {
    if (key === 'avgStartMinutes') return minutesToTimeStr(value);
    if (key === 'activeHours') return `${value.toFixed(1)}h`;
    if (key === 'fp') return value.toFixed(1);
    if (key === 'prmr') return `$${Math.round(value).toLocaleString()}`;
    return Math.round(value).toLocaleString();
  };

  const renderRecord = (record: ActiveRecord) => {
    const granLabel = GRANULARITY_LABELS[record.granularity];
    const isTimeMetric = record.metricKey === 'avgStartMinutes';
    const improvement = isTimeMetric
      ? ((record.recordValue - record.currentValue) / record.recordValue * 100)
      : ((record.currentValue - record.recordValue) / record.recordValue * 100);

    return (
      <div
        key={`${record.metricKey}-${record.dayOfWeekLabel || 'overall'}`}
        className={cn(
          "flex items-start gap-3 p-3 rounded-xl",
          record.isRecord ? "bg-amber-500/5 border border-amber-400/20" : "bg-muted/30"
        )}
      >
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
          record.isRecord ? "bg-amber-500/15" : "bg-primary/10"
        )}>
          {record.isRecord ? (
            <Crown className="w-4 h-4 text-amber-500" />
          ) : (
            <TrendingUp className="w-4 h-4 text-primary" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {record.dayOfWeekLabel || (record.isRecord ? `Best ${granLabel} ever` : `On pace for best ${granLabel}`)}
            {' '}<span className="text-primary">{record.label}</span>
          </p>
          <div className="flex items-baseline gap-3 mt-1">
            <div>
              <span className="text-lg font-bold text-foreground">
                {formatValue(record.metricKey, record.currentValue)}
              </span>
              <span className="text-xs text-muted-foreground ml-1">now</span>
            </div>
            <div className="text-muted-foreground text-xs">
              vs <span className="font-medium">{formatValue(record.metricKey, record.recordValue)}</span>
              {' '}prev record
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-muted-foreground">
              {formatRecordDate(record.recordDate, record.granularity)} · {record.recordReps} reps
            </span>
            {record.isRecord && improvement > 0 && (
              <span className="text-[10px] font-semibold text-green-600 dark:text-green-400">
                +{improvement.toFixed(0)}% improvement
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-500" />
            Group Records
          </DrawerTitle>
          <DrawerDescription>
            Comparing current period against all-time group performance
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-6 space-y-3 overflow-y-auto max-h-[60vh]">
          {confirmed.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                🏆 Records Broken
              </h4>
              {confirmed.map(renderRecord)}
            </div>
          )}
          {onPace.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-primary uppercase tracking-wider">
                📈 On Pace
              </h4>
              {onPace.map(renderRecord)}
            </div>
          )}
          {records.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No records detected for this period
            </p>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
