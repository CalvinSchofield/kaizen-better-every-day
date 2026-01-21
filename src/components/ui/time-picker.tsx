import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { hapticLight } from "@/utils/haptics";

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

// Hours for custom picker (12-hour format display)
const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = ["00", "15", "30", "45"];

export function TimePicker({ value, onChange, className }: TimePickerProps) {
  const [showCustom, setShowCustom] = React.useState(false);
  
  // Parse current value
  const [hours24, minutes] = value.split(':').map(Number);
  const isPM = hours24 >= 12;
  const hours12 = hours24 === 0 ? 12 : hours24 > 12 ? hours24 - 12 : hours24;
  const minuteStr = minutes.toString().padStart(2, '0');
  
  const handleQuickSelect = (time: string) => {
    hapticLight();
    onChange(time);
    setShowCustom(false);
  };
  
  const handleHourChange = (hour12: number) => {
    hapticLight();
    const hour24 = isPM ? (hour12 === 12 ? 12 : hour12 + 12) : (hour12 === 12 ? 0 : hour12);
    onChange(`${hour24.toString().padStart(2, '0')}:${minuteStr}`);
  };
  
  const handleMinuteChange = (min: string) => {
    hapticLight();
    onChange(`${hours24.toString().padStart(2, '0')}:${min}`);
  };
  
  const toggleAMPM = () => {
    hapticLight();
    const newHours24 = isPM ? hours24 - 12 : hours24 + 12;
    onChange(`${newHours24.toString().padStart(2, '0')}:${minuteStr}`);
  };
  
  const isQuickTimeSelected = QUICK_TIMES.some(t => t.value === value);
  
  return (
    <div className={cn("space-y-3", className)}>
      {/* Quick time buttons */}
      <div className="flex gap-2">
        {QUICK_TIMES.map((time) => (
          <Button
            key={time.value}
            type="button"
            variant={value === time.value ? "default" : "outline"}
            size="sm"
            className="flex-1"
            onClick={() => handleQuickSelect(time.value)}
          >
            {time.label}
          </Button>
        ))}
      </div>
      
      {/* Custom time toggle */}
      <Button
        type="button"
        variant={showCustom || !isQuickTimeSelected ? "secondary" : "ghost"}
        size="sm"
        className="w-full"
        onClick={() => {
          hapticLight();
          setShowCustom(!showCustom);
        }}
      >
        {showCustom ? "Hide custom time" : `Custom time${!isQuickTimeSelected ? `: ${formatTime12(value)}` : ''}`}
      </Button>
      
      {/* Custom time picker */}
      {showCustom && (
        <div className="bg-muted/50 rounded-lg p-3 space-y-3">
          {/* Hour selector */}
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Hour</label>
            <div className="flex flex-wrap gap-1.5">
              {HOURS_12.map((hour) => (
                <Button
                  key={hour}
                  type="button"
                  variant={hours12 === hour ? "default" : "outline"}
                  size="sm"
                  className="w-10 h-10"
                  onClick={() => handleHourChange(hour)}
                >
                  {hour}
                </Button>
              ))}
            </div>
          </div>
          
          {/* Minute selector */}
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Minute</label>
            <div className="flex gap-2">
              {MINUTES.map((min) => (
                <Button
                  key={min}
                  type="button"
                  variant={minuteStr === min ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => handleMinuteChange(min)}
                >
                  :{min}
                </Button>
              ))}
            </div>
          </div>
          
          {/* AM/PM toggle */}
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Period</label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={!isPM ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => !isPM ? null : toggleAMPM()}
              >
                AM
              </Button>
              <Button
                type="button"
                variant={isPM ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => isPM ? null : toggleAMPM()}
              >
                PM
              </Button>
            </div>
          </div>
          
          {/* Current selection display */}
          <div className="text-center pt-2 border-t border-border">
            <span className="text-lg font-semibold">{formatTime12(value)}</span>
          </div>
        </div>
      )}
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
