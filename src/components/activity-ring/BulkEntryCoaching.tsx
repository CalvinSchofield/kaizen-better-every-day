import { motion } from "framer-motion";
import { Zap, DollarSign, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface BulkEntryCoachingProps {
  batchedEventsPercent: number;
  largestBatch: number;
  className?: string;
}

/**
 * Simple, encouraging coaching for reps who batch-logged data.
 * Focuses on how accurate tracking = more money, not data purity.
 */
export const BulkEntryCoaching = ({
  batchedEventsPercent,
  largestBatch,
  className,
}: BulkEntryCoachingProps) => {
  // Determine severity for messaging
  const isModerate = batchedEventsPercent >= 30 && batchedEventsPercent < 60;
  const isSevere = batchedEventsPercent >= 60;

  return (
    <motion.div
      className={cn(
        "mx-4 p-4 rounded-xl border space-y-3",
        isSevere 
          ? "bg-orange-500/10 border-orange-500/30" 
          : "bg-amber-500/10 border-amber-500/25",
        className
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.5 }}
    >
      <div className="flex items-center gap-2">
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center",
          isSevere ? "bg-orange-500/20" : "bg-amber-500/20"
        )}>
          <Zap className={cn(
            "w-4 h-4",
            isSevere ? "text-orange-400" : "text-amber-400"
          )} />
        </div>
        <div>
          <h4 className="font-semibold text-sm">Quick Tip to Sell More</h4>
          <p className="text-xs text-muted-foreground">
            We noticed some rapid logging today
          </p>
        </div>
      </div>

      <div className="space-y-2 text-sm text-foreground/90">
        <div className="flex items-start gap-2">
          <DollarSign className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
          <p>
            <span className="font-medium text-foreground">Real-time tracking = real insights = more closes.</span>
            {' '}When you tap doors as you knock them, we can show you exactly where you're losing money.
          </p>
        </div>
        
        <div className="flex items-start gap-2">
          <TrendingUp className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
          <p>
            {isSevere ? (
              <>
                Right now, your activity timeline can't show your true patterns because{' '}
                <span className="font-medium">{batchedEventsPercent}%</span> was logged in quick bursts.
                Tap as you go and watch your close rate data unlock!
              </>
            ) : (
              <>
                Logging in real-time helps you spot <span className="font-medium">when</span> you're at your best—then do more of that.
                That's money in your pocket. 💰
              </>
            )}
          </p>
        </div>
      </div>

      <div className="pt-1 text-xs text-muted-foreground italic">
        Try it tomorrow: tap your counter the second each door opens. Your future self (and wallet) will thank you.
      </div>
    </motion.div>
  );
};
