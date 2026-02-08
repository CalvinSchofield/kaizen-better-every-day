import { motion } from "framer-motion";
import { Circle, LayoutList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hapticLight } from "@/utils/haptics";
import { cn } from "@/lib/utils";
import { VisualizationMode } from "@/hooks/useVisualizationPreference";

interface VisualizationToggleProps {
  mode: VisualizationMode;
  onToggle: () => void;
  className?: string;
}

export const VisualizationToggle = ({
  mode,
  onToggle,
  className,
}: VisualizationToggleProps) => {
  const handleClick = () => {
    hapticLight();
    onToggle();
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      className={cn(
        "h-8 w-8 relative overflow-hidden",
        className
      )}
      aria-label={mode === 'ring' ? 'Switch to timeline view' : 'Switch to ring view'}
    >
      <motion.div
        key={mode}
        initial={{ opacity: 0, scale: 0.8, rotate: -90 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        exit={{ opacity: 0, scale: 0.8, rotate: 90 }}
        transition={{ duration: 0.2 }}
      >
        {mode === 'ring' ? (
          <Circle className="w-4 h-4" />
        ) : (
          <LayoutList className="w-4 h-4" />
        )}
      </motion.div>
    </Button>
  );
};
