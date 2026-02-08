import { motion } from "framer-motion";
import { Circle, LayoutList, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hapticLight } from "@/utils/haptics";
import { cn } from "@/lib/utils";
import { VisualizationMode } from "@/hooks/useVisualizationPreference";

interface UnifiedVisualizationToggleProps {
  mode: VisualizationMode;
  onToggle: () => void;
  onLegendClick?: () => void;
  showLive?: boolean;
  className?: string;
}

/**
 * Unified visualization toggle that matches the Reports view style.
 * Shows: [LIVE indicator] [Ring/Line toggle] [Legend button]
 * Calendar button is now in the header for Track page.
 * Used across Track (finalized), Reports drill-down, etc.
 */
export const UnifiedVisualizationToggle = ({
  mode,
  onToggle,
  onLegendClick,
  showLive = false,
  className,
}: UnifiedVisualizationToggleProps) => {
  const handleToggle = () => {
    hapticLight();
    onToggle();
  };

  const handleLegendClick = () => {
    hapticLight();
    onLegendClick?.();
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* LIVE indicator */}
      {showLive && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-500/10 border border-green-500/30">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-medium text-green-500">LIVE</span>
        </div>
      )}

      {/* Ring/Line toggle - pill style */}
      <div className="flex items-center bg-muted/50 rounded-lg p-0.5 border border-border/30">
        <button
          onClick={handleToggle}
          className={cn(
            "flex items-center justify-center w-8 h-8 rounded-md transition-all",
            mode === 'ring' 
              ? "bg-primary/20 text-primary" 
              : "text-muted-foreground hover:text-foreground"
          )}
          aria-label="Ring view"
        >
          <Circle className="w-4 h-4" />
        </button>
        <button
          onClick={handleToggle}
          className={cn(
            "flex items-center justify-center w-8 h-8 rounded-md transition-all",
            mode === 'timeline' 
              ? "bg-primary/20 text-primary" 
              : "text-muted-foreground hover:text-foreground"
          )}
          aria-label="Timeline view"
        >
          <LayoutList className="w-4 h-4" />
        </button>
      </div>

      {/* Legend button */}
      {onLegendClick && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLegendClick}
          className="h-8 w-8"
          aria-label="Show legend"
        >
          <Info className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
};
