import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { hapticLight } from "@/utils/haptics";

export type GoalTimeframe = 'D' | 'W' | 'M' | 'Y';

interface GoalTimeframeToggleProps {
  selected: GoalTimeframe;
  onSelect: (timeframe: GoalTimeframe) => void;
  className?: string;
}

const timeframes: { key: GoalTimeframe; label: string }[] = [
  { key: 'D', label: 'Day' },
  { key: 'W', label: 'Week' },
  { key: 'M', label: 'Month' },
  { key: 'Y', label: 'Year' },
];

export const GoalTimeframeToggle = ({
  selected,
  onSelect,
  className,
}: GoalTimeframeToggleProps) => {
  return (
    <div 
      className={cn(
        "flex items-center justify-center gap-1 p-1 bg-muted/40 rounded-full",
        className
      )}
    >
      {timeframes.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => {
            hapticLight();
            onSelect(key);
          }}
          className={cn(
            "relative px-3.5 py-1.5 text-xs font-medium rounded-full transition-colors",
            selected === key
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground/70"
          )}
        >
          {selected === key && (
            <motion.div
              layoutId="goal-timeframe-pill"
              className="absolute inset-0 bg-background shadow-sm rounded-full"
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
          <span className="relative z-10">{label}</span>
        </button>
      ))}
    </div>
  );
};
