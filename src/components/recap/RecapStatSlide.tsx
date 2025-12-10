import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface RecapStatSlideProps {
  icon: LucideIcon;
  label: string;
  value: number | string;
  subtitle?: string;
  isRecord?: boolean;
}

export function RecapStatSlide({ icon: Icon, label, value, subtitle, isRecord }: RecapStatSlideProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', duration: 0.6 }}
        className="mb-6"
      >
        <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center">
          <Icon className="w-10 h-10 text-primary" />
        </div>
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="text-muted-foreground text-lg mb-4 uppercase tracking-wide"
      >
        {label}
      </motion.p>

      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.4, type: 'spring', duration: 0.6 }}
        className="relative"
      >
        <span className="text-7xl font-bold">{value}</span>
        {isRecord && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.8, type: 'spring' }}
            className="absolute -top-2 -right-8 text-2xl"
          >
            🏆
          </motion.span>
        )}
      </motion.div>

      {subtitle && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          className="text-muted-foreground mt-4 text-lg"
        >
          {subtitle}
        </motion.p>
      )}
    </div>
  );
}
