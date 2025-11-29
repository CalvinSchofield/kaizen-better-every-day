import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Info, Trash2, Clock } from "lucide-react";
import { format, parseISO, differenceInMinutes } from "date-fns";

interface SaveEntrySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: any;
  date: Date; // The date being edited
  onSave: (data: {
    doors_knocked: number;
    decision_makers: number;
    pitches: number;
    transitions: number;
    presentations: number;
    closes: number;
    fp_plus: number;
    prmr: number;
    saveDate: string;
    work_start_time?: string;
    work_end_time?: string;
  }) => void;
  onDelete?: () => void;
  isSaving: boolean;
}

export const SaveEntrySheet = ({
  open,
  onOpenChange,
  entry,
  date,
  onSave,
  onDelete,
  isSaving,
}: SaveEntrySheetProps) => {
  const [doorsKnocked, setDoorsKnocked] = useState("");
  const [decisionMakers, setDecisionMakers] = useState("");
  const [pitches, setPitches] = useState("");
  const [transitions, setTransitions] = useState("");
  const [presentations, setPresentations] = useState("");
  const [closes, setCloses] = useState("");
  const [fpPlus, setFpPlus] = useState("");
  const [prmr, setPrmr] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  useEffect(() => {
    if (open && entry) {
      // Pre-fill with existing entry data if available, show empty for 0 values
      setDoorsKnocked(entry.doors_knocked && entry.doors_knocked > 0 ? entry.doors_knocked.toString() : "");
      setDecisionMakers(entry.decision_makers && entry.decision_makers > 0 ? entry.decision_makers.toString() : "");
      setPitches(entry.pitches && entry.pitches > 0 ? entry.pitches.toString() : "");
      setTransitions(entry.transitions && entry.transitions > 0 ? entry.transitions.toString() : "");
      setPresentations(entry.presentations && entry.presentations > 0 ? entry.presentations.toString() : "");
      setCloses(entry.closes && entry.closes > 0 ? entry.closes.toString() : "");
      setFpPlus(entry.fp_plus && entry.fp_plus > 0 ? entry.fp_plus.toString() : "");
      setPrmr(entry.prmr && entry.prmr > 0 ? entry.prmr.toString() : "");
      
      // Pre-fill time data
      if (entry.work_start_time) {
        const startDate = parseISO(entry.work_start_time);
        setStartTime(format(startDate, 'HH:mm'));
      } else {
        setStartTime("");
      }
      
      if (entry.work_end_time) {
        const endDate = parseISO(entry.work_end_time);
        setEndTime(format(endDate, 'HH:mm'));
      } else {
        setEndTime("");
      }
    }
  }, [open, entry]);

  const handleSave = () => {
    const saveDate = format(date, 'yyyy-MM-dd');
    
    // Convert times to ISO strings if provided
    let workStartTime: string | undefined;
    let workEndTime: string | undefined;
    
    if (startTime) {
      const [hours, minutes] = startTime.split(':');
      const startDate = new Date(date);
      startDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      workStartTime = startDate.toISOString();
    }
    
    if (endTime) {
      const [hours, minutes] = endTime.split(':');
      const endDate = new Date(date);
      endDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      workEndTime = endDate.toISOString();
    }
    
    onSave({
      doors_knocked: parseInt(doorsKnocked) || 0,
      decision_makers: parseInt(decisionMakers) || 0,
      pitches: parseInt(pitches) || 0,
      transitions: parseInt(transitions) || 0,
      presentations: parseInt(presentations) || 0,
      closes: parseInt(closes) || 0,
      fp_plus: parseFloat(fpPlus) || 0,
      prmr: parseFloat(prmr) || 0,
      saveDate,
      work_start_time: workStartTime,
      work_end_time: workEndTime,
    });
    onOpenChange(false);
  };
  
  // Calculate total time worked
  const calculateTotalTime = () => {
    if (!entry?.work_start_time) return "Not started";
    
    const start = parseISO(entry.work_start_time);
    const end = entry.work_end_time ? parseISO(entry.work_end_time) : new Date();
    
    let totalMinutes = differenceInMinutes(end, start);
    
    // Subtract break time
    const breakPeriods = entry.break_periods || [];
    breakPeriods.forEach((bp: any) => {
      if (bp.start) {
        const breakStart = parseISO(bp.start);
        const breakEnd = bp.end ? parseISO(bp.end) : new Date();
        totalMinutes -= differenceInMinutes(breakEnd, breakStart);
      }
    });
    
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="pb-safe">
          <SheetHeader className="mb-6">
            <SheetTitle>{format(date, 'MMM d')}</SheetTitle>
          </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* QTally Counters Grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-base">Daily Activity</Label>
              {entry?.is_finalized && onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="doors-knocked" className="text-sm">Doors Knocked</Label>
                <Input
                  id="doors-knocked"
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min="0"
                  step="1"
                  placeholder=""
                  value={doorsKnocked}
                  onChange={(e) => setDoorsKnocked(e.target.value)}
                  enterKeyHint="next"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="decision-makers" className="text-sm">Decision Makers</Label>
                <Input
                  id="decision-makers"
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min="0"
                  step="1"
                  placeholder=""
                  value={decisionMakers}
                  onChange={(e) => setDecisionMakers(e.target.value)}
                  enterKeyHint="next"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pitches" className="text-sm">Pitches</Label>
                <Input
                  id="pitches"
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min="0"
                  step="1"
                  placeholder=""
                  value={pitches}
                  onChange={(e) => setPitches(e.target.value)}
                  enterKeyHint="next"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="transitions" className="text-sm">Transitions</Label>
                <Input
                  id="transitions"
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min="0"
                  step="1"
                  placeholder=""
                  value={transitions}
                  onChange={(e) => setTransitions(e.target.value)}
                  enterKeyHint="next"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="presentations" className="text-sm">Presentations</Label>
                <Input
                  id="presentations"
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min="0"
                  step="1"
                  placeholder=""
                  value={presentations}
                  onChange={(e) => setPresentations(e.target.value)}
                  enterKeyHint="next"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="closes" className="text-sm">Closes</Label>
                <Input
                  id="closes"
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min="0"
                  step="1"
                  placeholder=""
                  value={closes}
                  onChange={(e) => setCloses(e.target.value)}
                  enterKeyHint="next"
                />
              </div>
            </div>
          </div>

          {/* Time Tracking Section */}
          <div>
            <Label className="text-base mb-3 block">Time Tracking</Label>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="start-time" className="text-sm">Start Time</Label>
                <Input
                  id="start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              
              <div className="space-y-1.5">
                <Label htmlFor="end-time" className="text-sm">End Time</Label>
                <Input
                  id="end-time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
              
              <div className="space-y-1.5">
                <Label className="text-sm">Total Time Worked</Label>
                <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md border border-border/40">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{calculateTotalTime()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Results Section */}
          <div>
            <Label className="text-base mb-3 block">Results</Label>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Label htmlFor="fp-plus" className="text-sm">FP+</Label>
                  <a
                    href="https://chatgpt.com/g/g-676a50c52d988191bdc2edf913ffbe90-vivint-gpt"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Info className="h-4 w-4" />
                  </a>
                </div>
                <Input
                  id="fp-plus"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.1"
                  placeholder=""
                  value={fpPlus}
                  onChange={(e) => setFpPlus(e.target.value)}
                  enterKeyHint="next"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prmr" className="text-sm">PRMR</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="prmr"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    placeholder=""
                    value={prmr}
                    onChange={(e) => setPrmr(e.target.value)}
                    className="pl-7"
                    enterKeyHint="done"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-6 text-lg"
            size="lg"
          >
            {isSaving ? "Saving..." : "Save Entry"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>

    <Sheet open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
      <SheetContent side="bottom" className="pb-safe">
        <SheetHeader className="mb-6">
          <SheetTitle>Delete Entry?</SheetTitle>
          <SheetDescription>
            This will permanently delete this entry. This action cannot be undone.
          </SheetDescription>
        </SheetHeader>
        
        <div className="flex flex-col gap-3 mt-6">
          <Button
            onClick={() => {
              onDelete?.();
              setShowDeleteDialog(false);
              onOpenChange(false);
            }}
            variant="destructive"
            className="w-full py-6 text-lg font-semibold"
            size="lg"
          >
            Delete Entry
          </Button>
          <Button
            onClick={() => setShowDeleteDialog(false)}
            variant="outline"
            className="w-full py-6 text-lg font-semibold"
            size="lg"
          >
            Cancel
          </Button>
        </div>
      </SheetContent>
    </Sheet>
    </>
  );
};