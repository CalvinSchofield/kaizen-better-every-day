import type { ElementType } from "react";
import { Trophy, Calendar, CalendarDays, CalendarRange } from "lucide-react";
import { usePersonalRecords, type RecordsMetric } from "@/hooks/useRecordsTracking";
import { formatFP } from "@/lib/formatters";
import { Skeleton } from "@/components/ui/skeleton";

interface PersonalBestsSectionProps {
  userId: string | null;
  metric?: RecordsMetric;
}

const RecordCard = ({
  icon: Icon,
  label,
  value,
  sublabel,
}: {
  icon: ElementType;
  label: string;
  value: string;
  sublabel: string;
}) => (
  <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
      <Icon className="w-5 h-5 text-primary" />
    </div>
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{sublabel}</p>
    </div>
  </div>
);

export const PersonalBestsSection = ({ userId, metric = 'fp' }: PersonalBestsSectionProps) => {
  const { dayRecord, weekRecord, monthRecord, prmrDayRecord, prmrWeekRecord, prmrMonthRecord, isLoading } = usePersonalRecords(userId ?? undefined);

  if (!userId) return null;

  const isPrmr = metric === 'prmr';
  const day = isPrmr ? prmrDayRecord : dayRecord;
  const week = isPrmr ? prmrWeekRecord : weekRecord;
  const month = isPrmr ? prmrMonthRecord : monthRecord;
  const hasRecords = day > 0 || week > 0 || month > 0;
  const formatValue = (v: number) => isPrmr ? `$${Math.round(v).toLocaleString()}` : formatFP(v);
  const unit = isPrmr ? 'PRMR' : 'FP+';

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-lg">Your Personal Bests</h2>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!hasRecords) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-lg">Your Personal Bests</h2>
        </div>
        <div className="bg-card border border-border rounded-xl p-6 text-center text-muted-foreground">
          <p>Start knocking to set your first records!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Trophy className="w-5 h-5 text-primary" />
        <h2 className="font-semibold text-lg">Your Personal Bests</h2>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <RecordCard
          icon={Calendar}
          label="Best Day"
          value={formatValue(day)}
          sublabel={unit}
        />
        <RecordCard
          icon={CalendarDays}
          label="Best Week"
          value={formatValue(week)}
          sublabel={unit}
        />
        <RecordCard
          icon={CalendarRange}
          label="Best Month"
          value={formatValue(month)}
          sublabel={unit}
        />
      </div>
    </div>
  );
};
