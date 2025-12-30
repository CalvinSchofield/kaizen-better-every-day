import { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { Calendar as CalendarIcon, Users, Check, X, BookOpen } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useLeaderInteractions } from "@/hooks/useLeaderInteractions";

interface RepForTraining {
  userId: string;
  notionPageId: string;
  name: string;
  excludedDays: string[];
}

interface TeamTrainingDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reps: RepForTraining[];
}

export const TeamTrainingDrawer = ({
  open,
  onOpenChange,
  reps,
}: TeamTrainingDrawerProps) => {
  const [trainingDate, setTrainingDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [trainingTitle, setTrainingTitle] = useState<string>('');
  const [selectedReps, setSelectedReps] = useState<Set<string>>(new Set());
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { logInteractionAsync, isLogging } = useLeaderInteractions();

  // Initialize selected reps when drawer opens (all reps except those off that day)
  useMemo(() => {
    if (open && reps.length > 0) {
      const availableReps = reps.filter(rep => !rep.excludedDays.includes(trainingDate));
      setSelectedReps(new Set(availableReps.map(r => r.userId)));
    }
  }, [open, reps, trainingDate]);

  // When date changes, update selected reps to exclude those off that day
  const handleDateChange = (date: Date | undefined) => {
    if (!date) return;
    const dateStr = format(date, 'yyyy-MM-dd');
    setTrainingDate(dateStr);
    setDatePopoverOpen(false);
    
    // Auto-uncheck reps who are off on this day
    const availableReps = reps.filter(rep => !rep.excludedDays.includes(dateStr));
    setSelectedReps(new Set(availableReps.map(r => r.userId)));
  };

  const toggleRep = (userId: string) => {
    const newSelected = new Set(selectedReps);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedReps(newSelected);
  };

  const selectAll = () => {
    const availableReps = reps.filter(rep => !rep.excludedDays.includes(trainingDate));
    setSelectedReps(new Set(availableReps.map(r => r.userId)));
  };

  const selectNone = () => {
    setSelectedReps(new Set());
  };

  const handleSubmit = async () => {
    if (selectedReps.size === 0) {
      toast.error('Select at least one rep');
      return;
    }

    setIsSubmitting(true);
    const title = trainingTitle.trim() || 'Team Training';

    try {
      // Log interaction for each selected rep
      const promises = Array.from(selectedReps).map(userId => {
        return logInteractionAsync({
          repUserId: userId,
          type: 'team_training',
          notes: title,
          date: trainingDate,
        });
      });

      await Promise.all(promises);
      
      toast.success(`Logged training for ${selectedReps.size} reps`);
      onOpenChange(false);
      setTrainingTitle('');
    } catch (error) {
      toast.error("Couldn't log training attendance");
    } finally {
      setIsSubmitting(false);
    }
  };

  const offReps = reps.filter(rep => rep.excludedDays.includes(trainingDate));
  const availableReps = reps.filter(rep => !rep.excludedDays.includes(trainingDate));

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90dvh]">
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Log Team Training
          </DrawerTitle>
        </DrawerHeader>
        
        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Date Picker */}
          <div>
            <Label>Training Date</Label>
            <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal mt-1",
                    !trainingDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {trainingDate ? format(parseISO(trainingDate), 'PPP') : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={trainingDate ? parseISO(trainingDate) : undefined}
                  onSelect={handleDateChange}
                  disabled={(date) => date > new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Training Title */}
          <div>
            <Label>Training Title (optional)</Label>
            <Input
              value={trainingTitle}
              onChange={(e) => setTrainingTitle(e.target.value)}
              placeholder="e.g., Morning Meeting, Role Play Session"
              className="mt-1"
            />
          </div>

          {/* Attendance */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Attendance ({selectedReps.size} of {availableReps.length})
              </Label>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={selectAll}>All</Button>
                <Button variant="ghost" size="sm" onClick={selectNone}>None</Button>
              </div>
            </div>

            <div className="border border-border rounded-xl divide-y divide-border max-h-[300px] overflow-y-auto">
              {availableReps.map(rep => (
                <label
                  key={rep.userId}
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    checked={selectedReps.has(rep.userId)}
                    onCheckedChange={() => toggleRep(rep.userId)}
                  />
                  <span className="flex-1">{rep.name}</span>
                  {selectedReps.has(rep.userId) && (
                    <Check className="h-4 w-4 text-emerald-500" />
                  )}
                </label>
              ))}
            </div>

            {/* Show reps who are off */}
            {offReps.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground mb-2">Off on this date:</p>
                <div className="flex flex-wrap gap-1">
                  {offReps.map(rep => (
                    <Badge key={rep.userId} variant="secondary" className="text-xs">
                      <X className="h-3 w-3 mr-1" />
                      {rep.name.split(' ')[0]}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={isSubmitting || selectedReps.size === 0}
          >
            {isSubmitting ? 'Logging...' : `Log Training (${selectedReps.size} reps)`}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
