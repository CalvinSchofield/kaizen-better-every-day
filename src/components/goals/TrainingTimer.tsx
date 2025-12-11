import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, Plus, Minus, Clock, Check, TrendingUp, TrendingDown, Equal, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { TrainingWeekHistory } from "@/hooks/useRepGoals";
import { TrainingStreakBadge } from "./TrainingStreakBadge";

interface TrainingTimerProps {
  currentMinutes: number;
  weeklyGoal: number;
  history: TrainingWeekHistory[];
  streak?: number;
  onSave: (totalMinutes: number) => void;
  isSaving?: boolean;
}

export const TrainingTimer = ({ 
  currentMinutes, 
  weeklyGoal,
  history,
  streak = 0,
  onSave, 
  isSaving 
}: TrainingTimerProps) => {
  const [isRunning, setIsRunning] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [manualMinutes, setManualMinutes] = useState(0);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState(0);
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
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Calculate week-over-week trend
  const weeklyTrend = useMemo(() => {
    if (history.length === 0) return null;
    
    const lastWeek = history[history.length - 1];
    const prevWeek = history.length > 1 ? history[history.length - 2] : null;
    
    if (!prevWeek) {
      return { 
        lastWeekMinutes: lastWeek.minutes, 
        change: null, 
        direction: 'neutral' as const 
      };
    }
    
    const change = lastWeek.minutes - prevWeek.minutes;
    const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';
    
    return { 
      lastWeekMinutes: lastWeek.minutes, 
      prevWeekMinutes: prevWeek.minutes,
      change, 
      direction: direction as 'up' | 'down' | 'neutral'
    };
  }, [history]);

  // Calculate average from history
  const averageMinutes = useMemo(() => {
    if (history.length === 0) return 0;
    const total = history.reduce((sum, w) => sum + w.minutes, 0);
    return Math.round(total / history.length);
  }, [history]);

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

  const handleAdjustSave = () => {
    if (adjustAmount !== 0) {
      const newTotal = Math.max(0, currentMinutes + adjustAmount);
      onSave(newTotal);
    }
    setAdjustAmount(0);
    setIsAdjusting(false);
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
  const progressPercentage = weeklyGoal > 0 ? Math.min((currentMinutes / weeklyGoal) * 100, 100) : 0;

  return (
    <div className="space-y-4">
      {/* Current week progress */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <p className="text-xs text-muted-foreground">This week</p>
          <TrainingStreakBadge streak={streak} />
        </div>
        <div className="flex items-center justify-center gap-2">
          <p className="text-2xl font-bold tabular-nums">{formatTotalTime(currentMinutes)}</p>
          {currentMinutes > 0 && !isAdjusting && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => setIsAdjusting(true)}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}
        </div>
        
        {/* Adjust mode */}
        {isAdjusting && (
          <div className="mt-3 p-3 rounded-xl bg-muted/50 space-y-3">
            <p className="text-xs text-muted-foreground">Adjust saved time</p>
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full"
                onClick={() => setAdjustAmount(prev => prev - 15)}
                disabled={currentMinutes + adjustAmount < 15}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <div className="text-center min-w-[80px]">
                <p className={cn(
                  "text-xl font-bold tabular-nums",
                  adjustAmount < 0 && "text-red-500",
                  adjustAmount > 0 && "text-green-500"
                )}>
                  {adjustAmount >= 0 ? '+' : ''}{adjustAmount}m
                </p>
                <p className="text-xs text-muted-foreground">
                  New total: {formatTotalTime(Math.max(0, currentMinutes + adjustAmount))}
                </p>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full"
                onClick={() => setAdjustAmount(prev => prev + 15)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2 justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAdjustAmount(0);
                  setIsAdjusting(false);
                }}
              >
                Cancel
              </Button>
              {adjustAmount !== 0 && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleAdjustSave}
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              )}
            </div>
          </div>
        )}
        
        {weeklyGoal > 0 && !isAdjusting && (
          <div className="mt-2">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatTotalTime(currentMinutes)} / {formatTotalTime(weeklyGoal)} goal
            </p>
          </div>
        )}
      </div>

      {/* Week over week trend */}
      {weeklyTrend && (
        <div className="rounded-xl p-3 bg-muted/30">
          <p className="text-xs text-muted-foreground text-center mb-2">Week-over-week</p>
          <div className="flex items-center justify-center gap-4">
            <div className="text-center">
              <p className="text-lg font-semibold tabular-nums">
                {formatTotalTime(weeklyTrend.lastWeekMinutes)}
              </p>
              <p className="text-xs text-muted-foreground">Last week</p>
            </div>
            
            {weeklyTrend.change !== null && (
              <div className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium",
                weeklyTrend.direction === 'up' && "bg-green-500/10 text-green-600",
                weeklyTrend.direction === 'down' && "bg-red-500/10 text-red-600",
                weeklyTrend.direction === 'neutral' && "bg-muted text-muted-foreground"
              )}>
                {weeklyTrend.direction === 'up' && <TrendingUp className="h-3 w-3" />}
                {weeklyTrend.direction === 'down' && <TrendingDown className="h-3 w-3" />}
                {weeklyTrend.direction === 'neutral' && <Equal className="h-3 w-3" />}
                <span>
                  {weeklyTrend.change > 0 ? '+' : ''}{formatTotalTime(Math.abs(weeklyTrend.change))}
                </span>
              </div>
            )}
            
            {history.length > 1 && (
              <div className="text-center">
                <p className="text-lg font-semibold tabular-nums">
                  {formatTotalTime(averageMinutes)}
                </p>
                <p className="text-xs text-muted-foreground">Avg</p>
              </div>
            )}
          </div>
        </div>
      )}

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
