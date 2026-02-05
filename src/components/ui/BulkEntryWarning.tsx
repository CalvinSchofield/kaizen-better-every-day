import { useState, useEffect } from "react";
import { X, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface BulkEntryWarningProps {
  show: boolean;
  onDismiss: () => void;
}

const SESSION_STORAGE_KEY = 'bulk_entry_warning_dismissed';

export const BulkEntryWarning = ({ show, onDismiss }: BulkEntryWarningProps) => {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(SESSION_STORAGE_KEY) === 'true';
    }
    return false;
  });

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem(SESSION_STORAGE_KEY, 'true');
    onDismiss();
  };

  // Don't show if already dismissed this session
  if (dismissed || !show) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="mx-4 mb-3"
      >
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 relative">
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 p-1 rounded-full hover:bg-amber-500/20 transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4 text-amber-600" />
          </button>
          
          <div className="flex items-start gap-3 pr-6">
            <div className="flex-shrink-0 mt-0.5">
              <div className="bg-amber-500/20 rounded-full p-1.5">
                <Zap className="h-4 w-4 text-amber-600" />
              </div>
            </div>
            
            <div className="flex-1">
              <p className="text-sm text-foreground font-medium mb-1">
                Looks like you're catching up!
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Real-time logging helps you and your leaders see the full picture of your day.
              </p>
              
              <button
                onClick={handleDismiss}
                className="mt-2 text-xs font-medium text-amber-600 hover:text-amber-700 transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
