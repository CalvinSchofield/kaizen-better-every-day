import { useState } from "react";
import { Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { format, addDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle,
  DrawerFooter
} from "@/components/ui/drawer";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Recruit, useLogRecruitActivity } from "@/hooks/useGroupRecruits";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ScheduleFollowUpDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recruit: Recruit | null;
  onComplete?: () => void;
}

// Strip emojis from name
const stripEmojis = (text: string | null): string | null => {
  if (!text) return null;
  return text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2B50}]|[\u{1FA00}-\u{1FAFF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]/gu, '').trim();
};

export const ScheduleFollowUpDrawer = ({
  open,
  onOpenChange,
  recruit,
  onComplete,
}: ScheduleFollowUpDrawerProps) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(addDays(new Date(), 1));
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const logActivityMutation = useLogRecruitActivity();

  const quickDates = [
    { label: 'Tomorrow', date: addDays(new Date(), 1) },
    { label: 'In 3 days', date: addDays(new Date(), 3) },
    { label: 'Next week', date: addDays(new Date(), 7) },
  ];

  const handleSchedule = async () => {
    if (!recruit || !selectedDate) return;
    
    setIsLoading(true);
    try {
      await logActivityMutation.mutateAsync({
        recruitNotionId: recruit.notionPageId,
        activityType: 'next_step',
        notes: notes || `Follow up scheduled for ${format(selectedDate, 'MMM d')}`,
        nextAction: `Follow up on ${format(selectedDate, 'MMM d, yyyy')}`,
        nextActionDue: selectedDate.toISOString(),
      });
      toast.success(`Follow-up scheduled for ${format(selectedDate, 'MMM d')}`);
      onOpenChange(false);
      onComplete?.();
      setNotes('');
      setSelectedDate(addDays(new Date(), 1));
    } catch (error) {
      console.error('Failed to schedule follow-up:', error);
      toast.error('Failed to schedule follow-up');
    } finally {
      setIsLoading(false);
    }
  };

  if (!recruit) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="border-b">
          <DrawerTitle>
            Schedule Follow-up with {stripEmojis(recruit.name)}
          </DrawerTitle>
        </DrawerHeader>
        
        <div className="p-4 space-y-4">
          {/* Next steps - required */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              What's the next step?
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Call to discuss blitz dates, Follow up on signing paperwork..."
              className="resize-none"
              rows={3}
            />
          </div>

          {/* Quick date buttons */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              When will you do it?
            </label>
            <div className="flex gap-2">
              {quickDates.map(({ label, date }) => (
                <Button
                  key={label}
                  variant={selectedDate?.toDateString() === date.toDateString() ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setSelectedDate(date)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom date picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !selectedDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, 'PPP') : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={(date) => date < new Date()}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        <DrawerFooter className="border-t">
          <Button 
            onClick={handleSchedule}
            disabled={!selectedDate || isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Scheduling...
              </>
            ) : (
              <>
                <CalendarIcon className="h-4 w-4 mr-2" />
                Schedule for {selectedDate ? format(selectedDate, 'MMM d') : '...'}
              </>
            )}
          </Button>
          <Button 
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="w-full"
          >
            Cancel
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
