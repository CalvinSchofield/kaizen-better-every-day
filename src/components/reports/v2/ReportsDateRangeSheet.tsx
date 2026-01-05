import { useState } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ReportsDateRangeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startDate: Date | undefined;
  endDate: Date | undefined;
  onApply: (start: Date, end: Date) => void;
}

export const ReportsDateRangeSheet = ({
  open,
  onOpenChange,
  startDate,
  endDate,
  onApply,
}: ReportsDateRangeSheetProps) => {
  const [localStart, setLocalStart] = useState<Date | undefined>(startDate);
  const [localEnd, setLocalEnd] = useState<Date | undefined>(endDate);

  const handleApply = () => {
    if (localStart && localEnd) {
      onApply(localStart, localEnd);
      onOpenChange(false);
    }
  };

  const canApply = localStart && localEnd && localStart <= localEnd;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="px-4 pb-8">
        <DrawerHeader className="px-0">
          <DrawerTitle>Select Date Range</DrawerTitle>
        </DrawerHeader>

        <div className="space-y-4">
          {/* Start Date */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Start Date
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !localStart && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {localStart ? format(localStart, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={localStart}
                  onSelect={setLocalStart}
                  disabled={(date) => date > new Date()}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* End Date */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              End Date
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !localEnd && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {localEnd ? format(localEnd, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={localEnd}
                  onSelect={setLocalEnd}
                  disabled={(date) => 
                    date > new Date() || (localStart ? date < localStart : false)
                  }
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Apply Button */}
          <Button
            onClick={handleApply}
            disabled={!canApply}
            className="w-full"
          >
            Apply Date Range
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
