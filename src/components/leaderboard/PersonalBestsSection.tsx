import { Trophy, Calendar, CalendarDays, CalendarRange } from "lucide-react";
import { usePersonalRecords } from "@/hooks/useRecordsTracking";
import { Skeleton } from "@/components/ui/skeleton";

interface PersonalBestsSectionProps {
  userId: string | null;
}

const RecordCard = ({ 
  icon: Icon, 
  label, 
  value, 
  sublabel 
}: { 
  icon: React.ElementType; 
  label: string; 
  value: number; 
  sublabel: string;
}) => (
  <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
      <Icon className="w-5 h-5 text-primary" />
    </div>
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold text-foreground">{value.toLocaleString()}</p>
      <p className="text-xs text-muted-foreground">{sublabel}</p>
    </div>
  </div>
);

export const PersonalBestsSection = ({ userId }: PersonalBestsSectionProps) => {
  const { dayRecord, weekRecord, monthRecord, isLoading } = usePersonalRecords(userId ?? undefined);

  if (!userId) return null;

  const hasRecords = dayRecord > 0 || weekRecord > 0 || monthRecord > 0;

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
          value={dayRecord}
          sublabel="FP+"
        />
        <RecordCard
          icon={CalendarDays}
          label="Best Week"
          value={weekRecord}
          sublabel="FP+"
        />
        <RecordCard
          icon={CalendarRange}
          label="Best Month"
          value={monthRecord}
          sublabel="FP+"
        />
      </div>
    </div>
  );
};
