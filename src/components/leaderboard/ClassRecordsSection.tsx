import { Crown, Calendar, CalendarDays, CalendarRange, Star } from "lucide-react";
import { useClassRecords, ClassRecordHolder } from "@/hooks/useClassRecords";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ClassRecordsSectionProps {
  currentUserId: string | null;
}

const ClassBadge = ({ year }: { year: string }) => {
  const colorMap: Record<string, string> = {
    Rookie: "bg-green-500/15 text-green-600 dark:text-green-400",
    Sophomore: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    Vet: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  };
  
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", colorMap[year] || "bg-muted text-muted-foreground")}>
      {year}
    </span>
  );
};

const RecordRow = ({
  label,
  icon: Icon,
  holder,
  isCurrentUser,
}: {
  label: string;
  icon: typeof Calendar;
  holder: ClassRecordHolder | null;
  isCurrentUser: boolean;
}) => {
  if (!holder) {
    return (
      <div className="flex items-center justify-between py-2 text-muted-foreground text-sm">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" />
          <span>{label}</span>
        </div>
        <span className="text-xs">No record yet</span>
      </div>
    );
  }
  
  return (
    <div className={cn(
      "flex items-center justify-between py-2",
      isCurrentUser && "text-primary"
    )}>
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4" />
        <span className="text-sm">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {isCurrentUser && <Star className="w-3 h-3 fill-primary text-primary" />}
        <span className="font-semibold">{holder.value.toLocaleString()}</span>
        <span className="text-xs text-muted-foreground truncate max-w-[80px]">
          {isCurrentUser ? "You" : holder.name.split(' ')[0]}
        </span>
      </div>
    </div>
  );
};

const ClassCard = ({
  year,
  day,
  week,
  month,
  currentUserId,
}: {
  year: string;
  day: ClassRecordHolder | null;
  week: ClassRecordHolder | null;
  month: ClassRecordHolder | null;
  currentUserId: string | null;
}) => {
  const hasAnyRecord = day || week || month;
  
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <ClassBadge year={year} />
        <span className="text-sm font-medium">Records</span>
      </div>
      
      {!hasAnyRecord ? (
        <p className="text-sm text-muted-foreground text-center py-4">No records yet</p>
      ) : (
        <div className="divide-y divide-border">
          <RecordRow 
            label="Day" 
            icon={Calendar} 
            holder={day} 
            isCurrentUser={day?.userId === currentUserId} 
          />
          <RecordRow 
            label="Week" 
            icon={CalendarDays} 
            holder={week} 
            isCurrentUser={week?.userId === currentUserId} 
          />
          <RecordRow 
            label="Month" 
            icon={CalendarRange} 
            holder={month} 
            isCurrentUser={month?.userId === currentUserId} 
          />
        </div>
      )}
    </div>
  );
};

export const ClassRecordsSection = ({ currentUserId }: ClassRecordsSectionProps) => {
  const { classRecords, isLoading } = useClassRecords();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-lg">Class Records</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Crown className="w-5 h-5 text-primary" />
        <h2 className="font-semibold text-lg">Class Records</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <ClassCard
          year="Rookie"
          day={classRecords.Rookie.day}
          week={classRecords.Rookie.week}
          month={classRecords.Rookie.month}
          currentUserId={currentUserId}
        />
        <ClassCard
          year="Sophomore"
          day={classRecords.Sophomore.day}
          week={classRecords.Sophomore.week}
          month={classRecords.Sophomore.month}
          currentUserId={currentUserId}
        />
        <ClassCard
          year="Vet"
          day={classRecords.Vet.day}
          week={classRecords.Vet.week}
          month={classRecords.Vet.month}
          currentUserId={currentUserId}
        />
      </div>
    </div>
  );
};
