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
      className="mx-4 mt-4 mb-2"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20">
        <div className="flex items-center gap-3">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 400, delay: 0.2 }}
          >
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-primary" />
            </div>
          </motion.div>
          
          <div>
            <div className="font-semibold text-foreground">Day Complete</div>
            {entryDate && (
              <div className="text-xs text-muted-foreground">
                {format(parseISO(entryDate), "EEEE, MMMM d")}
              </div>
            )}
          </div>
        </div>
        
        {hasWorkTimes && (
          <motion.div
            className="flex items-center gap-2 text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Clock className="w-4 h-4" />
            <span className="text-sm font-medium tabular-nums">
              {formatTime(workStart)} → {formatTime(workEnd)}
            </span>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};
