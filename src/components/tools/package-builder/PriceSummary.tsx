import { useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface PriceSummaryProps {
  equipmentMonthly: number;
  serviceRate: number;
  warrantyAmount: number;
  totalMonthly: number;
}

export const PriceSummary = ({
  equipmentMonthly,
  serviceRate,
  warrantyAmount,
  totalMonthly,
}: PriceSummaryProps) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <div className="max-w-lg mx-auto">
        <div 
          className={cn(
            "bg-card/95 backdrop-blur-xl border-t border-border shadow-2xl transition-all duration-300",
            "rounded-t-3xl"
          )}
        >
          {/* Main display - always visible */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full p-4 flex items-center justify-between active:bg-accent/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                {expanded ? (
                  <ChevronDown className="w-5 h-5 text-primary" />
                ) : (
                  <ChevronUp className="w-5 h-5 text-primary" />
                )}
              </div>
              <div className="text-left">
                <p className="text-xs text-muted-foreground">Estimated Monthly</p>
                <p className="text-sm text-muted-foreground">(pre-tax)</p>
              </div>
            </div>
            <motion.div
              key={totalMonthly.toFixed(2)}
              initial={{ scale: 1.1, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="text-right"
            >
              <p className="text-3xl font-bold text-foreground">
                ${totalMonthly.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">/month</p>
            </motion.div>
          </button>

          {/* Breakdown - expandable */}
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 space-y-2 border-t border-border pt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Equipment (60 mo)</span>
                    <span className="font-medium">${equipmentMonthly.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Service</span>
                    <span className="font-medium">${serviceRate.toFixed(2)}</span>
                  </div>
                  {warrantyAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Warranty</span>
                      <span className="font-medium">${warrantyAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm pt-2 border-t border-border">
                    <span className="font-semibold">Total</span>
                    <span className="font-bold text-primary">${totalMonthly.toFixed(2)}</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
