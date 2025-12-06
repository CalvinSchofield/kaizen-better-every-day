import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, Plus, Minus, Clock, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrainingTimerProps {
  currentMinutes: number;
  onSave: (totalMinutes: number) => void;
  isSaving?: boolean;
}

export const TrainingTimer = ({ currentMinutes, onSave, isSaving }: TrainingTimerProps) => {
  const [isRunning, setIsRunning] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [manualMinutes, setManualMinutes] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Format seconds to MM:SS
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Format hours and minutes for display
  const formatTotalTime = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const startTimer = useCallback(() => {
    setIsRunning(true);
    startTimeRef.current = Date.now() - (sessionSeconds * 1000);
    
    intervalRef.current = setInterval(() => {
      if (startTimeRef.current) {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setSessionSeconds(elapsed);
      }
    }, 1000);
  }, [sessionSeconds]);

  const pauseTimer = useCallback(() => {
    setIsRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const addSessionTime = useCallback(() => {
    const sessionMinutes = Math.ceil(sessionSeconds / 60);
    if (sessionMinutes > 0) {
      setManualMinutes(prev => prev + sessionMinutes);
      setSessionSeconds(0);
    }
  }, [sessionSeconds]);

  const handleSave = () => {
    // Add any running session time
    const sessionMinutes = Math.ceil(sessionSeconds / 60);
    const totalNew = manualMinutes + sessionMinutes;
    onSave(currentMinutes + totalNew);
    
    // Reset local state
    setSessionSeconds(0);
    setManualMinutes(0);
    setIsRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const totalNewMinutes = manualMinutes + Math.ceil(sessionSeconds / 60);
  const hasNewTime = totalNewMinutes > 0;

  return (
    <div className="space-y-4">
      {/* Current total */}
      <div className="text-center">
        <p className="text-xs text-muted-foreground mb-1">Total logged</p>
        <p className="text-2xl font-bold tabular-nums">{formatTotalTime(currentMinutes)}</p>
      </div>

      {/* Timer display */}
      <div 
        className={cn(
          "rounded-xl p-4 text-center transition-all",
          isRunning ? "bg-green-500/10 ring-2 ring-green-500/50" : "bg-muted/50"
        )}
      >
        <p className="text-xs text-muted-foreground mb-2">
          {isRunning ? "Timer running..." : "Session timer"}
        </p>
        <p className={cn(
          "text-4xl font-mono font-bold tabular-nums transition-colors",
          isRunning && "text-green-600 dark:text-green-400"
        )}>
          {formatTime(sessionSeconds)}
        </p>
        
        <div className="flex justify-center gap-2 mt-4">
          {!isRunning ? (
            <Button
              variant="default"
              size="lg"
              onClick={startTimer}
              className="gap-2"
            >
              <Play className="h-4 w-4" />
              Start
            </Button>
          ) : (
            <Button
              variant="outline"
              size="lg"
              onClick={pauseTimer}
              className="gap-2"
            >
              <Pause className="h-4 w-4" />
              Pause
            </Button>
          )}
          
          {sessionSeconds > 0 && !isRunning && (
            <Button
              variant="secondary"
              size="lg"
              onClick={addSessionTime}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add {Math.ceil(sessionSeconds / 60)}m
            </Button>
          )}
        </div>
      </div>

      {/* Manual adjustment */}
      <div className="rounded-xl p-4 bg-muted/30">
        <p className="text-xs text-muted-foreground text-center mb-3">
          Or add time manually
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-full"
            onClick={() => setManualMinutes(prev => Math.max(0, prev - 15))}
            disabled={manualMinutes < 15}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <div className="text-center min-w-[80px]">
            <p className="text-2xl font-bold tabular-nums">+{manualMinutes}</p>
            <p className="text-xs text-muted-foreground">minutes</p>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-full"
            onClick={() => setManualMinutes(prev => prev + 15)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Save button */}
      {hasNewTime && (
        <Button 
          onClick={handleSave} 
          className="w-full gap-2"
          size="lg"
          disabled={isSaving}
        >
          <Check className="h-4 w-4" />
          {isSaving ? "Saving..." : `Save +${totalNewMinutes} minutes`}
        </Button>
      )}
    </div>
  );
};
