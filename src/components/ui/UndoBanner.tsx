import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Undo2, X } from "lucide-react";
import { Button } from "./button";

interface UndoBannerProps {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  duration?: number; // in ms
}

export function UndoBanner({ message, onUndo, onDismiss, duration = 5000 }: UndoBannerProps) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const interval = 50; // Update every 50ms for smooth animation
    const decrement = (interval / duration) * 100;
    
    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev - decrement;
        if (next <= 0) {
          clearInterval(timer);
          onDismiss();
          return 0;
        }
        return next;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [duration, onDismiss]);

  const handleUndo = () => {
    onUndo();
    onDismiss();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      exit={{ opacity: 0, y: -10, height: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden"
    >
      <div className="bg-muted/80 backdrop-blur-sm rounded-xl border border-border px-4 py-3 flex items-center justify-between gap-3">
        <span className="text-sm text-foreground flex-1">{message}</span>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleUndo}
            className="h-8 px-3 text-primary hover:text-primary font-medium"
          >
            <Undo2 className="h-4 w-4 mr-1.5" />
            Undo
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDismiss}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {/* Progress bar */}
      <div className="h-0.5 bg-border rounded-full overflow-hidden mt-1">
        <motion.div
          className="h-full bg-primary/50"
          initial={{ width: '100%' }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.05, ease: 'linear' }}
        />
      </div>
    </motion.div>
  );
}
