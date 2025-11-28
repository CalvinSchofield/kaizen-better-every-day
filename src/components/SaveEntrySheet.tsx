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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Info } from "lucide-react";
import { format } from "date-fns";

interface SaveEntrySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: any;
  onSave: (data: { fp_plus: number; prmr: number; saveDate: string }) => void;
  isSaving: boolean;
}

export const SaveEntrySheet = ({
  open,
  onOpenChange,
  entry,
  onSave,
  isSaving,
}: SaveEntrySheetProps) => {
  const [fpPlus, setFpPlus] = useState("");
  const [prmr, setPrmr] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    if (open) {
      // Always start with empty inputs
      setFpPlus("");
      setPrmr("");
      
      // Check if entry_date is before today to show date picker
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const entryDate = entry.entry_date ? new Date(entry.entry_date) : today;
      
      if (entryDate < today) {
        setShowDatePicker(true);
        setSelectedDate(entryDate);
      } else {
        setShowDatePicker(false);
        setSelectedDate(today);
      }
    }
  }, [open, entry]);

  const handleSave = () => {
    const saveDate = format(selectedDate, 'yyyy-MM-dd');
    onSave({
      fp_plus: parseFloat(fpPlus) || 0,
      prmr: parseFloat(prmr) || 0,
      saveDate,
    });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="pb-safe">
        <SheetHeader className="mb-6">
          <SheetTitle>Save Today's Work</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-6">
          {/* Date Picker (only shown if entry_date is before today) */}
          {showDatePicker && (
            <div className="space-y-2">
              <Label>Entry Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(selectedDate, 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* FP+ Input */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="fp-plus">FP+</Label>
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
              step="0.1"
              placeholder="Enter FP+"
              value={fpPlus}
              onChange={(e) => setFpPlus(e.target.value)}
            />
          </div>

          {/* PRMR Input */}
          <div className="space-y-2">
            <Label htmlFor="prmr">PRMR</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                id="prmr"
                type="number"
                step="0.01"
                placeholder="Enter PRMR"
                value={prmr}
                onChange={(e) => setPrmr(e.target.value)}
                className="pl-7"
              />
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
  );
};