import { useState } from "react";
import { cn } from "@/lib/utils";
import { Settings2, Clock, Target, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useEffortThresholds } from "@/hooks/useEffortThresholds";
import { DEFAULT_EFFORT_THRESHOLDS, formatMinutesToTime } from "@/utils/effortScore";
import { toast } from "sonner";

interface EffortThresholdSettingsProps {
  teamId?: string;
  mgmtGroupId?: string;
  className?: string;
}

export const EffortThresholdSettings = ({ 
  teamId, 
  mgmtGroupId, 
  className 
}: EffortThresholdSettingsProps) => {
  const [open, setOpen] = useState(false);
  const { 
    thresholds, 
    isCustomized, 
    updateThresholds, 
    resetToDefaults, 
    isUpdating 
  } = useEffortThresholds({ teamId, mgmtGroupId });

  const [localThresholds, setLocalThresholds] = useState(thresholds);

  // Convert minutes to HH:MM format
  const minutesToTimeInput = (mins: number) => {
    const hours = Math.floor(mins / 60);
    const minutes = mins % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  // Convert HH:MM format to minutes
  const timeInputToMinutes = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + (minutes || 0);
  };

  const handleSave = async () => {
    try {
      await updateThresholds(localThresholds);
      toast.success("Effort thresholds updated");
      setOpen(false);
    } catch (error) {
      toast.error("Failed to save thresholds");
    }
  };

  const handleReset = async () => {
    try {
      await resetToDefaults();
      setLocalThresholds(DEFAULT_EFFORT_THRESHOLDS);
      toast.success("Reset to default thresholds");
    } catch (error) {
      toast.error("Failed to reset thresholds");
    }
  };

  // Sync local state when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setLocalThresholds(thresholds);
    }
    setOpen(isOpen);
  };

  if (!teamId && !mgmtGroupId) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className={cn("gap-1.5 text-muted-foreground", className)}
        >
          <Settings2 className="w-4 h-4" />
          {isCustomized && <span className="text-xs">Custom</span>}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            Effort Thresholds
          </DialogTitle>
          <DialogDescription>
            Customize effort scoring benchmarks for your team
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Doors Per Hour */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Target className="w-4 h-4 text-muted-foreground" />
              Doors Per Hour Benchmarks
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="rookie-doors" className="text-xs text-muted-foreground">
                  Rookie
                </Label>
                <Input
                  id="rookie-doors"
                  type="number"
                  min={1}
                  max={30}
                  value={localThresholds.doorsPerHourRookie}
                  onChange={(e) => setLocalThresholds(prev => ({
                    ...prev,
                    doorsPerHourRookie: Number(e.target.value)
                  }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vet-doors" className="text-xs text-muted-foreground">
                  Veteran
                </Label>
                <Input
                  id="vet-doors"
                  type="number"
                  min={1}
                  max={30}
                  value={localThresholds.doorsPerHourVet}
                  onChange={(e) => setLocalThresholds(prev => ({
                    ...prev,
                    doorsPerHourVet: Number(e.target.value)
                  }))}
                />
              </div>
            </div>
          </div>

          {/* Time Thresholds */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Clock className="w-4 h-4 text-muted-foreground" />
              Time Thresholds
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="late-start" className="text-xs text-muted-foreground">
                  Late Start After
                </Label>
                <Input
                  id="late-start"
                  type="time"
                  value={minutesToTimeInput(localThresholds.lateStartMinutes)}
                  onChange={(e) => setLocalThresholds(prev => ({
                    ...prev,
                    lateStartMinutes: timeInputToMinutes(e.target.value)
                  }))}
                />
                <p className="text-[10px] text-muted-foreground">
                  Currently: {formatMinutesToTime(localThresholds.lateStartMinutes)}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="early-end" className="text-xs text-muted-foreground">
                  Early End Before
                </Label>
                <Input
                  id="early-end"
                  type="time"
                  value={minutesToTimeInput(localThresholds.earlyEndMinutes)}
                  onChange={(e) => setLocalThresholds(prev => ({
                    ...prev,
                    earlyEndMinutes: timeInputToMinutes(e.target.value)
                  }))}
                />
                <p className="text-[10px] text-muted-foreground">
                  Currently: {formatMinutesToTime(localThresholds.earlyEndMinutes)}
                </p>
              </div>
            </div>
          </div>

          {/* Min Hours */}
          <div className="space-y-1.5">
            <Label htmlFor="min-hours" className="text-xs text-muted-foreground">
              Minimum Hours for Full Day
            </Label>
            <Input
              id="min-hours"
              type="number"
              min={0.5}
              max={8}
              step={0.5}
              value={localThresholds.minHoursWorked}
              onChange={(e) => setLocalThresholds(prev => ({
                ...prev,
                minHoursWorked: Number(e.target.value)
              }))}
              className="w-24"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          {isCustomized ? (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleReset}
              disabled={isUpdating}
              className="gap-1.5 text-muted-foreground"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset to Defaults
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">Using default thresholds</p>
          )}
          <Button onClick={handleSave} disabled={isUpdating}>
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
