import { motion } from "framer-motion";
import { ReactNode, useEffect } from "react";
import confetti from "canvas-confetti";

interface CTASlideProps {
  icon?: ReactNode;
  title: string;
  description: string;
  showConfetti?: boolean;
}

export const CTASlide = ({
  icon,
  title,
  description,
  showConfetti = false,
}: CTASlideProps) => {
  useEffect(() => {
    if (showConfetti) {
      // Delay confetti slightly for better effect
      const timer = setTimeout(() => {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#f97316', '#fb923c', '#fdba74', '#fed7aa'],
        });
      }, 400);

      return () => clearTimeout(timer);
    }
  }, [showConfetti]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center text-center px-6 py-8 pointer-events-none"
    >
      {icon && (
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.1, duration: 0.5, type: "spring" }}
          className="w-24 h-24 mb-8 rounded-2xl bg-primary/10 flex items-center justify-center"
        >
          {icon}
        </motion.div>
      )}

      <motion.h2
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-3xl font-bold mb-3"
      >
        {title}
      </motion.h2>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-muted-foreground text-lg max-w-xs leading-relaxed"
      >
        {description}
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-8 text-sm text-muted-foreground"
      >
        Tap "Get Started" below to begin →
      </motion.div>
    </motion.div>
  );
};
