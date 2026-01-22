import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { hapticLight, hapticSelection } from "@/utils/haptics";
import { Clock, ChevronRight } from "lucide-react";
import { showNativeTimePicker, hasNativeTimePicker } from "@/utils/nativeTimePicker";

interface TimePickerProps {
  value: string; // Format: "HH:MM" in 24h
  onChange: (time: string) => void;
  className?: string;
}

// Quick select times (common follow-up times)
const QUICK_TIMES = [
  { label: "9am", value: "09:00" },
  { label: "12pm", value: "12:00" },
  { label: "3pm", value: "15:00" },
  { label: "5pm", value: "17:00" },
];

export function TimePicker({ value, onChange, className }: TimePickerProps) {
  const webInputRef = React.useRef<HTMLInputElement>(null);
  
  const handleQuickSelect = (time: string) => {
    hapticSelection();
    onChange(time);
  };
  
  const handleCustomTimeTap = async () => {
    hapticLight();
    
    // Try native picker first (iOS wheel)
    if (hasNativeTimePicker()) {
      const result = await showNativeTimePicker(value);
      if (result) {
        hapticSelection();
        onChange(result);
      }
    } else {
      // Web fallback - trigger native HTML time input
      webInputRef.current?.showPicker?.();
      webInputRef.current?.click();
    }
  };
  
  const handleWebInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      hapticSelection();
      onChange(e.target.value);
    }
  };
  
  const isQuickTimeSelected = QUICK_TIMES.some(t => t.value === value);
  
  return (
    <div className={cn("space-y-3", className)}>
      {/* Quick time buttons - horizontal scroll on mobile */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {QUICK_TIMES.map((time) => (
          <Button
            key={time.value}
            type="button"
            variant={value === time.value ? "default" : "outline"}
            size="sm"
            className={cn(
              "flex-shrink-0 min-w-[60px] transition-all duration-150",
              value === time.value && "scale-[1.02]"
            )}
            onClick={() => handleQuickSelect(time.value)}
          >
            {time.label}
          </Button>
        ))}
      </div>
      
      {/* Custom time - single tappable row */}
      <button
        type="button"
        onClick={handleCustomTimeTap}
        className={cn(
          "w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-all duration-150",
          "active:scale-[0.98] touch-manipulation",
          !isQuickTimeSelected 
            ? "bg-primary/10 border-primary/30" 
            : "bg-muted/50 border-border hover:bg-muted"
        )}
      >
        <div className="flex items-center gap-3">
          <Clock className={cn(
            "h-5 w-5",
            !isQuickTimeSelected ? "text-primary" : "text-muted-foreground"
          )} />
          <span className={cn(
            "font-medium",
            !isQuickTimeSelected ? "text-foreground" : "text-muted-foreground"
          )}>
            Custom time
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-lg font-semibold tabular-nums",
            !isQuickTimeSelected ? "text-primary" : "text-foreground"
          )}>
            {formatTime12(value)}
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </button>
      
      {/* Hidden web input for fallback */}
      <input
        ref={webInputRef}
        type="time"
        value={value}
        onChange={handleWebInputChange}
        className="sr-only"
        tabIndex={-1}
      />
    </div>
  );
}

/**
 * Inline time display that's tappable
 * Use this when you want just the time displayed, tappable to change
 */
interface InlineTimePickerProps {
  value: string;
  onChange: (time: string) => void;
  className?: string;
}

export function InlineTimePicker({ value, onChange, className }: InlineTimePickerProps) {
  const webInputRef = React.useRef<HTMLInputElement>(null);
  
  const handleTap = async () => {
    hapticLight();
    
    if (hasNativeTimePicker()) {
      const result = await showNativeTimePicker(value);
      if (result) {
        hapticSelection();
        onChange(result);
      }
    } else {
      webInputRef.current?.showPicker?.();
      webInputRef.current?.click();
    }
  };
  
  const handleWebInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      hapticSelection();
      onChange(e.target.value);
    }
  };
  
  return (
    <div className={cn("relative inline-flex", className)}>
      <button
        type="button"
        onClick={handleTap}
        className="flex items-center gap-1.5 text-primary font-medium active:opacity-70 transition-opacity touch-manipulation"
      >
        <Clock className="h-4 w-4" />
        <span className="underline underline-offset-2 decoration-primary/50">
          {formatTime12(value)}
        </span>
      </button>
      <input
        ref={webInputRef}
        type="time"
        value={value}
        onChange={handleWebInputChange}
        className="sr-only"
        tabIndex={-1}
      />
    </div>
  );
}

/**
 * Format 24h time string to 12h display
 */
export function formatTime12(time24: string): string {
  const [hours, minutes] = time24.split(':').map(Number);
  const isPM = hours >= 12;
  const hours12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`;
}

/**
 * Get a reasonable default time (next hour, rounded up)
 */
export function getDefaultTime(): string {
  const now = new Date();
  let hours = now.getHours() + 1; // Next hour
  
  // If it's evening/night, default to 10am next day
  if (hours >= 21 || hours < 8) {
    hours = 10;
  }
  
  return `${hours.toString().padStart(2, '0')}:00`;
}
