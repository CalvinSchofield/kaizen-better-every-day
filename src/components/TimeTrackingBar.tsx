import { useState, useEffect } from "react";
import { Clock, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TimeTrackingBarProps {
  workStartTime: string | null | undefined;
  workEndTime: string | null | undefined;
  breakPeriods: Array<{ start: string; end: string }> | undefined;
  onStartWork: () => void;
  onEndWork: () => void;
  onStartBreak: () => void;
  onEndBreak: () => void;
  onUpdateTime: (field: 'start' | 'end', time: string) => void;
}

export const TimeTrackingBar = ({
  workStartTime,
  workEndTime,
  breakPeriods = [],
  onStartWork,
  onEndWork,
  onStartBreak,
  onEndBreak,
  onUpdateTime,
}: TimeTrackingBarProps) => {
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [editField, setEditField] = useState<'start' | 'end'>('start');
  const [editValue, setEditValue] = useState('');

  const currentBreak = breakPeriods.find(bp => !bp.end);
  const isOnBreak = !!currentBreak;
  const hasStarted = !!workStartTime;
  const hasEnded = !!workEndTime;

  const formatTime = (isoString: string | null | undefined) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const handleTimeClick = (field: 'start' | 'end', currentValue: string | null | undefined) => {
    if (!currentValue) return;
    setEditField(field);
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
    
    onUpdateTime(editField, now.toISOString());
    setIsEditingTime(false);
  };

  return (
    <>
      <div className="flex items-center justify-center gap-4 py-3 px-4 bg-card/50 border-b border-border/40">
        {/* Start Clock */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => hasStarted ? handleTimeClick('start', workStartTime) : onStartWork()}
          disabled={hasEnded}
          className="flex items-center gap-2 h-auto py-2 px-3"
        >
          <Clock className={`h-5 w-5 ${hasStarted ? 'text-primary' : 'text-muted-foreground'}`} />
          {hasStarted && (
            <span className="text-sm font-medium">{formatTime(workStartTime)}</span>
          )}
        </Button>

        {/* Pause/Resume Button */}
        {hasStarted && !hasEnded && (
          <Button
            variant="ghost"
            size="icon"
            onClick={isOnBreak ? onEndBreak : onStartBreak}
            className={`h-8 w-8 ${isOnBreak ? 'text-amber-500' : 'text-muted-foreground'}`}
          >
            {isOnBreak ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </Button>
        )}

        {/* End Clock */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => hasEnded ? handleTimeClick('end', workEndTime) : onEndWork()}
          disabled={!hasStarted || isOnBreak}
          className="flex items-center gap-2 h-auto py-2 px-3"
        >
          <Clock className={`h-5 w-5 ${hasEnded ? 'text-primary' : 'text-muted-foreground'}`} />
          {hasEnded && (
            <span className="text-sm font-medium">{formatTime(workEndTime)}</span>
          )}
        </Button>
      </div>

      {/* Time Edit Sheet */}
      <Sheet open={isEditingTime} onOpenChange={setIsEditingTime}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>Edit {editField === 'start' ? 'Start' : 'End'} Time</SheetTitle>
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
