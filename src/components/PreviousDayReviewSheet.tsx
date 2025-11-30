import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Clock, Calendar, Trash2 } from "lucide-react";
import { DailyEntry } from "@/hooks/useDailyEntry";

interface PreviousDayReviewSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: DailyEntry;
  entryDate: string;
  latestCounterTimestamp: string | null;
  onSave: (data: { 
    fp_plus: number; 
    prmr: number; 
    work_end_time: string;
    saveDate: string;
  }) => Promise<void>;
  onDiscard: () => Promise<void>;
  isSaving: boolean;
}

export const PreviousDayReviewSheet = ({
  open,
  onOpenChange,
  entry,
  entryDate,
  latestCounterTimestamp,
  onSave,
  onDiscard,
  isSaving,
}: PreviousDayReviewSheetProps) => {
  const [fpPlus, setFpPlus] = useState<string>("");
  const [prmr, setPrmr] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Format time for display
  const formatTime = (isoString: string | null) => {
    if (!isoString) return 'Not set';
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  // Auto-populate end time with latest activity when user clicks the input
  const handleEndTimeFocus = () => {
    if (latestCounterTimestamp && !endTime) {
      const date = new Date(latestCounterTimestamp);
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      setEndTime(`${hours}:${minutes}`);
    }
  };

  const handleSave = async () => {
    // Validate inputs
    const fpValue = parseFloat(fpPlus || "0");
    const prmrValue = parseFloat(prmr || "0");
    
    if (!endTime) {
      return;
    }

    // Construct end time from input
    const [hours, minutes] = endTime.split(':');
    const endDate = new Date(entryDate);
    endDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    await onSave({
      fp_plus: fpValue,
      prmr: prmrValue,
      work_end_time: endDate.toISOString(),
      saveDate: entryDate,
    });

    // Reset form
    setFpPlus("");
    setPrmr("");
    setEndTime("");
    onOpenChange(false);
  };

  const handleDiscardConfirm = async () => {
    setShowDiscardConfirm(false);
    await onDiscard();
    setFpPlus("");
    setPrmr("");
    setEndTime("");
    onOpenChange(false);
  };

  const hasActivity = entry.doors_knocked > 0 || 
                      entry.decision_makers > 0 || 
                      entry.pitches > 0 || 
                      entry.transitions > 0 || 
                      entry.presentations > 0 || 
                      entry.closes > 0;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Review Previous Day
              </SheetTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDiscardConfirm(true)}
                className="h-8 w-8"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
            <SheetDescription>
              You have unsaved work from {formatDate(entryDate)}
            </SheetDescription>
          </SheetHeader>

        <div className="space-y-6 pt-6">
          {/* Activity Summary */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="text-sm font-semibold text-foreground">Activity Summary</p>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Doors</p>
                <p className="font-semibold">{entry.doors_knocked}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Pitches</p>
                <p className="font-semibold">{entry.pitches}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Closes</p>
                <p className="font-semibold">{entry.closes}</p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>Started: {formatTime(entry.work_start_time)}</span>
              </div>
            </div>
          </div>

          {/* End Time Input */}
          <div className="space-y-2">
            <Label htmlFor="end-time">End Time *</Label>
            <Input
              id="end-time"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              onFocus={handleEndTimeFocus}
              className="text-lg w-full"
              required
            />
            {latestCounterTimestamp && (
              <p className="text-xs text-muted-foreground">
                Latest activity: {formatTime(latestCounterTimestamp)}
              </p>
            )}
          </div>

          {/* Results Inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fp-plus">FP+</Label>
              <Input
                id="fp-plus"
                type="number"
                step="0.1"
                placeholder="0.0"
                value={fpPlus}
                onChange={(e) => setFpPlus(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prmr">PRMR ($)</Label>
              <Input
                id="prmr"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={prmr}
                onChange={(e) => setPrmr(e.target.value)}
              />
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-2">
            <Button
              className="w-full"
              onClick={handleSave}
              disabled={isSaving || !endTime || !hasActivity}
            >
              {isSaving ? "Saving..." : "Save & Continue"}
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            This will save your work from {formatDate(entryDate)} and start fresh for today
          </p>
        </div>
      </SheetContent>
    </Sheet>

    <Drawer open={showDiscardConfirm} onOpenChange={setShowDiscardConfirm}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Discard Work?</DrawerTitle>
          <DrawerDescription>
            This will permanently delete your unsaved work from {formatDate(entryDate)}. This action cannot be undone.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerFooter>
          <Button
            variant="destructive"
            onClick={handleDiscardConfirm}
            disabled={isSaving}
          >
            Discard Work
          </Button>
          <DrawerClose asChild>
            <Button variant="outline">Cancel</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
    </>
  );
};
