import { motion } from "framer-motion";
import { CheckCircle2, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";

interface FinalizedDayHeaderProps {
  workStart?: string | null;
  workEnd?: string | null;
  entryDate?: string;
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
}: FinalizedDayHeaderProps) => {
  const hasWorkTimes = workStart && workEnd;
  
  return (
    <motion.div
      className="flex-1"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center p-3 rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20">
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
      </div>
    </motion.div>
  );
};
