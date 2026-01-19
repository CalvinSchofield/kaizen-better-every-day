import { motion } from 'framer-motion';
import { TrendingUp, Sparkles } from 'lucide-react';

interface TierUpgradeCardProps {
  currentRate: number;
  projectedRate: number;
  projectedFp: number;
}

export const TierUpgradeCard = ({
  currentRate,
  projectedRate,
  projectedFp,
}: TierUpgradeCardProps) => {
  if (projectedRate <= currentRate) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ 
        type: "spring", 
        stiffness: 200, 
        damping: 20,
        delay: 0.3 
      }}
      className="relative overflow-hidden rounded-xl bg-gradient-to-r from-success/20 via-success/10 to-emerald-500/20 p-4"
    >
      {/* Subtle background sparkles */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute top-1 right-4"
        >
          <Sparkles className="w-4 h-4 text-success/50" />
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
          className="absolute bottom-2 right-12"
        >
          <Sparkles className="w-3 h-3 text-success/40" />
        </motion.div>
      </div>

      <div className="relative flex items-center gap-3">
        <motion.div
          initial={{ rotate: 0 }}
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center"
        >
          <TrendingUp className="w-5 h-5 text-success" />
        </motion.div>
        
        <div className="flex-1">
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="flex items-center gap-2"
          >
            <span className="text-sm font-semibold text-success">Tier Upgrade Projected!</span>
            <Sparkles className="w-4 h-4 text-success" />
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex items-center gap-2 mt-1"
          >
            <span className="text-lg font-bold text-muted-foreground">${currentRate}</span>
            <motion.span
              initial={{ x: -5, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-success"
            >
              →
            </motion.span>
            <motion.span
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.7, type: "spring", stiffness: 300 }}
              className="text-xl font-bold text-success"
            >
              ${projectedRate}
            </motion.span>
            <span className="text-xs text-muted-foreground">/PRMR</span>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-xs text-muted-foreground mt-0.5"
          >
            at {Math.round(projectedFp)} FP+
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};
