import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface StatSlideProps {
  title: string;
  description: string;
  statValue: number;
  statPrefix?: string;
  statSuffix?: string;
  statLabel?: string;
}

export const StatSlide = ({
  title,
  description,
  statValue,
  statPrefix = "",
  statSuffix = "",
  statLabel,
}: StatSlideProps) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const duration = 1500;
    const steps = 60;
    const stepValue = statValue / steps;
    let currentStep = 0;

    const interval = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        setDisplayValue(statValue);
        clearInterval(interval);
      } else {
        setDisplayValue(Math.floor(stepValue * currentStep));
      }
    }, duration / steps);

    return () => clearInterval(interval);
  }, [statValue]);

  const formattedValue = displayValue.toLocaleString();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center text-center px-6 py-8 pointer-events-none"
    >
      {/* Large animated stat */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5, type: "spring" }}
        className="mb-6"
      >
        <div className="text-5xl sm:text-6xl font-bold text-primary mb-2">
          {statPrefix}{formattedValue}{statSuffix}
        </div>
        {statLabel && (
          <div className="text-sm text-muted-foreground uppercase tracking-wider">
            {statLabel}
          </div>
        )}
      </motion.div>

      <motion.h2
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-2xl font-bold mb-3"
      >
        {title}
      </motion.h2>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-muted-foreground text-base max-w-xs leading-relaxed"
      >
        {description}
      </motion.p>
    </motion.div>
  );
};
