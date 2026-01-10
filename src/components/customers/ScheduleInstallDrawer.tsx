import { useState } from 'react';
import { format, addDays } from 'date-fns';
import { Calendar, Clock } from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { hapticLight } from '@/utils/haptics';

interface ScheduleInstallDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (scheduledDate: string) => void;
  onCancel: () => void;
  customerName?: string;
}

export const ScheduleInstallDrawer = ({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  customerName,
}: ScheduleInstallDrawerProps) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(addDays(new Date(), 1));
  const [calendarOpen, setCalendarOpen] = useState(false);

  const handleConfirm = () => {
    if (selectedDate) {
      hapticLight();
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      onConfirm(dateStr);
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    hapticLight();
    onCancel();
    onOpenChange(false);
  };

  // Quick select buttons for common install dates
  const quickOptions = [
    { label: 'Tomorrow', days: 1 },
    { label: 'In 2 Days', days: 2 },
    { label: 'In 3 Days', days: 3 },
    { label: 'Next Week', days: 7 },
  ];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85svh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            Schedule Install Date
          </DrawerTitle>
        </DrawerHeader>
        
        <div className="px-4 pb-6 space-y-4">
          {customerName && (
            <p className="text-sm text-muted-foreground">
              When is <span className="font-medium text-foreground">{customerName}</span>'s install scheduled?
            </p>
          )}
          
          {!customerName && (
            <p className="text-sm text-muted-foreground">
              When is this account scheduled to be installed?
            </p>
          )}

          {/* Quick Select Buttons */}
          <div className="grid grid-cols-2 gap-2">
            {quickOptions.map((option) => {
              const optionDate = addDays(new Date(), option.days);
              const isSelected = selectedDate && format(selectedDate, 'yyyy-MM-dd') === format(optionDate, 'yyyy-MM-dd');
              
              return (
                <button
                  key={option.days}
                  onClick={() => {
                    hapticLight();
                    setSelectedDate(optionDate);
                  }}
                  className={cn(
                    "py-3 px-4 rounded-xl text-sm font-medium transition-all",
                    isSelected
                      ? "bg-amber-500 text-white shadow-md"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  <div>{option.label}</div>
                  <div className="text-xs opacity-75">{format(optionDate, 'MMM d')}</div>
                </button>
              );
            })}
          </div>

          {/* Custom Date Picker */}
          <div className="pt-2">
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal h-12",
                    !selectedDate && "text-muted-foreground"
                  )}
                  onClick={() => hapticLight()}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, 'EEEE, MMMM d, yyyy') : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-50" align="center">
                <CalendarPicker
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    setSelectedDate(date);
                    setCalendarOpen(false);
                  }}
                  disabled={(date) => date < new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={handleCancel}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!selectedDate}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
            >
              Mark as Pending
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            This account will appear in your pending installs for follow-up
          </p>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
