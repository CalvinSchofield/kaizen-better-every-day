import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Calendar as CalendarIcon, UserCircle, MessageSquare } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useLeaderInteractions, InteractionType } from "@/hooks/useLeaderInteractions";

interface LogOneOnOneDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repUserId: string;
  repName: string;
  onSuccess?: () => void;
}

export const LogOneOnOneDrawer = ({
  open,
  onOpenChange,
  repUserId,
  repName,
  onSuccess,
}: LogOneOnOneDrawerProps) => {
  const [interactionDate, setInteractionDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [interactionType, setInteractionType] = useState<InteractionType>('check_in');
  const [notes, setNotes] = useState<string>('');
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);

  const { logInteractionAsync, isLogging } = useLeaderInteractions();

  const handleSubmit = async () => {
    try {
      await logInteractionAsync({
        repUserId,
        type: interactionType,
        notes: notes.trim() || undefined,
        date: interactionDate,
      });

      toast.success(`${interactionType === 'monthly_review' ? 'Monthly review' : 'Check-in'} logged`);
      onOpenChange(false);
      setNotes('');
      setInteractionType('check_in');
      onSuccess?.();
    } catch (error) {
      toast.error("Couldn't log interaction");
    }
  };

  const firstName = repName.split(' ')[0];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90dvh]">
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <UserCircle className="h-5 w-5" />
            Log 1-on-1 with {firstName}
          </DrawerTitle>
        </DrawerHeader>
        
        <div className="p-4 space-y-4">
          {/* Interaction Type */}
          <div>
            <Label>Type</Label>
            <RadioGroup
              value={interactionType}
              onValueChange={(v) => setInteractionType(v as InteractionType)}
              className="mt-2 grid grid-cols-2 gap-2"
            >
              <div>
                <RadioGroupItem
                  value="check_in"
                  id="check_in"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="check_in"
                  className="flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <MessageSquare className="mb-2 h-5 w-5" />
                  <span className="text-sm font-medium">Quick Check-in</span>
                </Label>
              </div>
              <div>
                <RadioGroupItem
                  value="monthly_review"
                  id="monthly_review"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="monthly_review"
                  className="flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <CalendarIcon className="mb-2 h-5 w-5" />
                  <span className="text-sm font-medium">Monthly Review</span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Date Picker */}
          <div>
            <Label>Date</Label>
            <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal mt-1",
                    !interactionDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {interactionDate ? format(parseISO(interactionDate), 'PPP') : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={interactionDate ? parseISO(interactionDate) : undefined}
                  onSelect={(date) => {
                    if (date) {
                      setInteractionDate(format(date, 'yyyy-MM-dd'));
                    }
                    setDatePopoverOpen(false);
                  }}
                  disabled={(date) => date > new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Notes */}
          <div>
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={`Key takeaways from your conversation with ${firstName}...`}
              className="mt-1"
              rows={4}
            />
          </div>

          {/* Submit */}
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={isLogging}
          >
            {isLogging ? 'Logging...' : 'Log Interaction'}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
