import { motion } from "framer-motion";
import { format, subDays, isSameDay, parseISO, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface DaySummary {
  date: string;
  doors: number;
  fp: number;
  hasSale: boolean;
  hasWork: boolean;
}

interface WeekActivityStripProps {
  daySummaries: DaySummary[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onOpenCalendar?: () => void;
  className?: string;
}

// Mini ring component for day cells
const MiniRing = ({ 
  progress, 
  hasSale, 
  isSelected,
  hasWork,
  isToday,
}: { 
  progress: number; 
  hasSale: boolean; 
  isSelected: boolean;
  hasWork: boolean;
  isToday: boolean;
}) => {
  const size = 32;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={hasWork ? "hsl(var(--muted))" : "hsl(var(--muted) / 0.3)"}
          strokeWidth={strokeWidth}
          strokeDasharray={hasWork ? undefined : "2 2"}
        />
        
        {/* Progress ring */}
        {hasWork && progress > 0 && (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={progress >= 100 ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.7)"}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        )}
      </svg>
      
      {/* Sale star overlay */}
      {hasSale && (
        <motion.span
          className="absolute text-xs"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 400 }}
        >
          ⭐
        </motion.span>
      )}
      
      {/* Selection ring */}
      {isSelected && (
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-primary"
          layoutId="selected-day"
          initial={false}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
      
      {/* Today indicator */}
      {isToday && !isSelected && (
        <div className="absolute -bottom-0.5 w-1.5 h-1.5 rounded-full bg-primary" />
      )}
    </div>
  );
};

export const WeekActivityStrip = ({
  daySummaries,
  selectedDate,
  onSelectDate,
  onOpenCalendar,
  className,
}: WeekActivityStripProps) => {
  const [weekOffset, setWeekOffset] = useState(0);
  
  const today = new Date();
  const baseDate = subDays(today, weekOffset * 7);
  const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 }); // Monday start
  const weekEnd = endOfWeek(baseDate, { weekStartsOn: 1 });
  
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  
  // Format week label
  const weekLabel = `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
  
  // Get max doors for normalization
  const maxDoors = Math.max(1, ...daySummaries.map(d => d.doors));
  
  const getDaySummary = (date: Date): DaySummary | undefined => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return daySummaries.find(s => s.date === dateStr);
  };
  
  const handlePrevWeek = () => setWeekOffset(prev => prev + 1);
  const handleNextWeek = () => setWeekOffset(prev => Math.max(0, prev - 1));
  
  return (
    <div className={cn("space-y-3", className)}>
      {/* Week navigation header */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handlePrevWeek}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        
        <span className="text-sm font-medium text-muted-foreground">
          {weekLabel}
        </span>
        
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleNextWeek}
            disabled={weekOffset === 0}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          
          {onOpenCalendar && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onOpenCalendar}
            >
              <Calendar className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
      
      {/* Day cells */}
      <div className="flex justify-between px-2">
        {weekDays.map((day) => {
          const summary = getDaySummary(day);
          const isSelected = isSameDay(day, selectedDate);
          const isToday = isSameDay(day, today);
          const isFuture = day > today;
          
          // Calculate progress (doors as percentage of max)
          const progress = summary ? (summary.doors / maxDoors) * 100 : 0;
          
          return (
            <button
              key={day.toISOString()}
              onClick={() => !isFuture && onSelectDate(day)}
              disabled={isFuture}
              className={cn(
                "flex flex-col items-center gap-1 p-1 rounded-lg transition-colors",
                isSelected && "bg-primary/10",
                !isFuture && !isSelected && "active:scale-95",
                isFuture && "opacity-40 cursor-not-allowed"
              )}
            >
              <span className={cn(
                "text-xs font-medium",
                isSelected ? "text-primary" : "text-muted-foreground"
              )}>
                {format(day, 'EEE').charAt(0)}
              </span>
              
              <MiniRing
                progress={progress}
                hasSale={summary?.hasSale || false}
                isSelected={isSelected}
                hasWork={summary?.hasWork || false}
                isToday={isToday}
              />
              
              <span className={cn(
                "text-xs tabular-nums",
                isSelected ? "text-primary font-medium" : "text-muted-foreground"
              )}>
                {format(day, 'd')}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
