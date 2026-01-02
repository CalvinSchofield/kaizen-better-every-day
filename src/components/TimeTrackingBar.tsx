import { useState } from "react";
import { Clock, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

interface TimeTrackingBarProps {
  workStartTime: string | null | undefined;
  workEndTime: string | null | undefined;
  breakPeriods: Array<{ start: string; end: string }> | undefined;
  counterTimestamps?: Record<string, string[]>;
  onStartWork: () => void;
  onEndWork: () => void;
  onStartBreak: () => void;
  onEndBreak: () => void;
  onUpdateTime: (field: 'start' | 'end', time: string) => void;
  onClearEndTime?: () => void;
}

export const TimeTrackingBar = ({
  workStartTime,
  workEndTime,
  breakPeriods = [],
  counterTimestamps = {},
  onStartWork,
  onEndWork,
  onStartBreak,
  onEndBreak,
  onUpdateTime,
  onClearEndTime,
}: TimeTrackingBarProps) => {
  const [isViewingTime, setIsViewingTime] = useState(false);
  const [viewField, setViewField] = useState<'start' | 'end'>('start');
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [editValue, setEditValue] = useState('');

  const currentBreak = breakPeriods.find(bp => !bp.end);
  const isOnBreak = !!currentBreak;
  const hasStarted = !!workStartTime;
  const hasEnded = !!workEndTime;

  // Calculate total break time in minutes
  const calculateTotalBreakTime = () => {
    if (!breakPeriods || breakPeriods.length === 0) return 0;
    
    let totalMs = 0;
    breakPeriods.forEach(bp => {
      const startTime = new Date(bp.start).getTime();
      const endTime = bp.end ? new Date(bp.end).getTime() : Date.now();
      totalMs += endTime - startTime;
    });
    
    return Math.floor(totalMs / 60000); // Convert to minutes
  };

  const totalBreakMinutes = calculateTotalBreakTime();
  const breakHours = Math.floor(totalBreakMinutes / 60);
  const breakMins = totalBreakMinutes % 60;

  const formatTime = (isoString: string | null | undefined) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  // Get the latest counter timestamp
  const getLatestCounterTimestamp = () => {
    if (!counterTimestamps || Object.keys(counterTimestamps).length === 0) return null;
    
    let latestTimestamp: string | null = null;
    Object.values(counterTimestamps).forEach(timestamps => {
      if (timestamps && timestamps.length > 0) {
        const latest = timestamps[timestamps.length - 1];
        if (!latestTimestamp || new Date(latest) > new Date(latestTimestamp)) {
          latestTimestamp = latest;
        }
      }
    });
    
    return latestTimestamp;
  };

  const latestCounterTimestamp = getLatestCounterTimestamp();

  const handleTimeClick = (field: 'start' | 'end') => {
    setViewField(field);
    setIsViewingTime(true);
  };

  const handleEditTimeInSheet = (currentValue: string | null | undefined) => {
    if (!currentValue) return;
    const date = new Date(currentValue);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    setEditValue(`${hours}:${minutes}`);
    setIsEditingTime(true);
  };

  const handleSaveTime = () => {
    if (!editValue) return;
    
    const [hours, minutes] = editValue.split(':');
    const now = new Date();
    now.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
    onUpdateTime(viewField, now.toISOString());
    setIsEditingTime(false);
    setIsViewingTime(false);
  };

  const currentTimeValue = viewField === 'start' ? workStartTime : workEndTime;

  return (
    <>
      <div data-tour="track-time-bar" className="flex items-center justify-center gap-4 py-3 px-4 bg-card/50 border-b border-border/40">
        {/* Start Clock */}
        <div className="flex flex-col items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => hasStarted ? handleTimeClick('start') : onStartWork()}
            disabled={hasEnded}
            className="flex items-center gap-2 h-auto py-2 px-3"
          >
            <Clock className={`h-5 w-5 ${hasStarted ? 'text-primary' : 'text-muted-foreground'}`} />
            {hasStarted && (
              <span className="text-sm font-medium">{formatTime(workStartTime)}</span>
            )}
          </Button>
          <span className="text-xs text-muted-foreground">Start</span>
        </div>

        {/* Pause/Resume Button with Break Time */}
        {hasStarted && !hasEnded && (
          <div className="flex flex-col items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={isOnBreak ? onEndBreak : onStartBreak}
              className="flex items-center gap-2 h-auto py-2 px-3"
            >
              {isOnBreak ? (
                <Play className="h-5 w-5 text-amber-500" />
              ) : (
                <Pause className="h-5 w-5 text-muted-foreground" />
              )}
              {totalBreakMinutes > 0 && (
                <span className="text-sm font-semibold">
                  {breakHours > 0 ? `${breakHours}h ${breakMins}m` : `${breakMins}m`}
                </span>
              )}
            </Button>
            <span className="text-xs text-muted-foreground">
              {isOnBreak ? "Back to it" : "Take a break"}
            </span>
          </div>
        )}

        {/* End Clock */}
        <div className="flex flex-col items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => hasEnded ? handleTimeClick('end') : onEndWork()}
            disabled={!hasStarted || isOnBreak}
            className="flex items-center gap-2 h-auto py-2 px-3"
          >
            <Clock className={`h-5 w-5 ${hasEnded ? 'text-primary' : 'text-muted-foreground'}`} />
            {hasEnded && (
              <span className="text-sm font-medium">{formatTime(workEndTime)}</span>
            )}
          </Button>
          <span className="text-xs text-muted-foreground">End</span>
          {!hasEnded && latestCounterTimestamp && (
            <span className="text-[10px] text-muted-foreground/60">
              Last: {formatTime(latestCounterTimestamp)}
            </span>
          )}
        </div>
      </div>

      {/* Time View Sheet (First step) */}
      <Sheet open={isViewingTime} onOpenChange={setIsViewingTime}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>{viewField === 'start' ? 'Start' : 'End'} Time</SheetTitle>
          </SheetHeader>
          <div className="pt-6 pb-4 space-y-4">
            <Card 
              className="p-6 cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => handleEditTimeInSheet(currentTimeValue)}
            >
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Current time</p>
                <p className="text-3xl font-bold">{formatTime(currentTimeValue)}</p>
                <p className="text-xs text-muted-foreground mt-3">Tap to edit</p>
              </div>
            </Card>
            
            {/* Continue Working button - only show for end time */}
            {viewField === 'end' && hasEnded && onClearEndTime && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  onClearEndTime();
                  setIsViewingTime(false);
                }}
              >
                Continue Working
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Time Edit Sheet (Second step - native picker) */}
      <Sheet open={isEditingTime} onOpenChange={(open) => {
        setIsEditingTime(open);
        if (!open) setIsViewingTime(true); // Go back to view sheet if dismissed
      }}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>Edit {viewField === 'start' ? 'Start' : 'End'} Time</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="time">Time</Label>
              <Input
                id="time"
                type="time"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="text-lg"
              />
            </div>
            <Button 
              onClick={handleSaveTime} 
              className="w-full"
            >
              Save
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
