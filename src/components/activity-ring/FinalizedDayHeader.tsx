import { motion } from "framer-motion";
import { CheckCircle2, Clock, Calendar, Info, Circle, LayoutList } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { hapticLight } from "@/utils/haptics";
import { cn } from "@/lib/utils";
import { VisualizationMode } from "@/hooks/useVisualizationPreference";

interface FinalizedDayHeaderProps {
  workStart?: string | null;
  workEnd?: string | null;
  entryDate?: string;
  // New props for header controls
  showCalendar?: boolean;
  onCalendarClick?: () => void;
  onLegendClick?: () => void;
  visualizationMode?: VisualizationMode;
  onToggleVisualization?: () => void;
}

const formatTime = (isoString: string): string => {
  try {
    return format(parseISO(isoString), "h:mm a");
  } catch {
    return "--";
  }
};

export const FinalizedDayHeader = ({
  workStart,
  workEnd,
  entryDate,
  showCalendar = true,
  onCalendarClick,
  onLegendClick,
  visualizationMode = 'ring',
  onToggleVisualization,
}: FinalizedDayHeaderProps) => {
  const hasWorkTimes = workStart && workEnd;
  
  const handleCalendarClick = () => {
    hapticLight();
    onCalendarClick?.();
  };

  const handleLegendClick = () => {
    hapticLight();
    onLegendClick?.();
  };

  const handleToggleVisualization = () => {
    hapticLight();
    onToggleVisualization?.();
  };
  
  return (
    <motion.div
      className="flex-1"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20">
        {/* Left side: Status and date */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 400, delay: 0.2 }}
          >
            <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-4 h-4 text-primary" />
            </div>
          </motion.div>
          
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-foreground text-sm">Day Complete</div>
            <div className="flex items-center gap-2 flex-wrap">
              {entryDate && (
                <span className="text-xs text-muted-foreground">
                  {format(parseISO(entryDate), "EEE, MMM d")}
                </span>
              )}
              {hasWorkTimes && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span className="tabular-nums">
                    {formatTime(workStart)} – {formatTime(workEnd)}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* Right side: Control buttons */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Visualization toggle */}
          {onToggleVisualization && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleToggleVisualization}
              className="h-8 w-8"
              aria-label={visualizationMode === 'ring' ? 'Switch to timeline view' : 'Switch to ring view'}
            >
              <motion.div
                key={visualizationMode}
                initial={{ opacity: 0, rotate: -90 }}
                animate={{ opacity: 1, rotate: 0 }}
                transition={{ duration: 0.2 }}
              >
                {visualizationMode === 'ring' ? (
                  <Circle className="w-4 h-4" />
                ) : (
                  <LayoutList className="w-4 h-4" />
                )}
              </motion.div>
            </Button>
          )}

          {/* Legend button */}
          {onLegendClick && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLegendClick}
              className="h-8 w-8"
              aria-label="Show legend"
            >
              <Info className="w-4 h-4" />
            </Button>
          )}

          {/* Calendar button */}
          {showCalendar && onCalendarClick && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCalendarClick}
              className="h-8 w-8"
              aria-label="View activity history"
            >
              <Calendar className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
};
