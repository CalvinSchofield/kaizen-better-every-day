import { useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Challenge } from "@/hooks/useChallenges";
import { useProposeEdit } from "@/hooks/useChallengeEdits";
import { format, parseISO } from "date-fns";
import { CalendarIcon, ChevronLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface EditChallengeDrawerProps {
  challenge: Challenge;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditChallengeDrawer = ({ challenge, open, onOpenChange }: EditChallengeDrawerProps) => {
  const [stakes, setStakes] = useState(challenge.stakes || '');
  const [endDate, setEndDate] = useState<Date | undefined>(parseISO(challenge.end_date));
  const [calendarOpen, setCalendarOpen] = useState(false);

  const proposeEditMutation = useProposeEdit();

  const hasChanges = stakes !== (challenge.stakes || '') || 
    (endDate && format(endDate, 'yyyy-MM-dd') !== challenge.end_date);

  const handleSubmit = async () => {
    if (!hasChanges) {
      toast.error('No changes to propose');
      return;
    }

    const changes: { stakes?: string; end_date?: string } = {};
    
    if (stakes !== (challenge.stakes || '')) {
      changes.stakes = stakes;
    }
    
    if (endDate && format(endDate, 'yyyy-MM-dd') !== challenge.end_date) {
      changes.end_date = format(endDate, 'yyyy-MM-dd');
    }

    try {
      await proposeEditMutation.mutateAsync({
        challengeId: challenge.id,
        changes,
      });
      toast.success('Edit proposed! Waiting for all participants to approve.');
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to propose edit');
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset form on close
      setStakes(challenge.stakes || '');
      setEndDate(parseISO(challenge.end_date));
    }
    onOpenChange(newOpen);
  };

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="relative text-center">
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 top-1/2 -translate-y-1/2"
            onClick={() => onOpenChange(false)}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <DrawerTitle>Edit Challenge</DrawerTitle>
        </DrawerHeader>

        <div className="p-4 space-y-6">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-center">
            <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
              ⚠️ All participants must approve changes before they take effect
            </p>
          </div>

          {/* Stakes */}
          <div className="space-y-2">
            <Label htmlFor="stakes">Stakes (optional)</Label>
            <Input
              id="stakes"
              placeholder="Loser buys lunch, bragging rights, etc."
              value={stakes}
              onChange={(e) => setStakes(e.target.value)}
            />
            {stakes !== (challenge.stakes || '') && (
              <p className="text-xs text-muted-foreground">
                Current: {challenge.stakes || 'None'}
              </p>
            )}
          </div>

          {/* End Date */}
          <div className="space-y-2">
            <Label>End Date</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, 'PPP') : 'Select end date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={(date) => {
                    setEndDate(date);
                    setCalendarOpen(false);
                  }}
                  disabled={(date) => date < new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {endDate && format(endDate, 'yyyy-MM-dd') !== challenge.end_date && (
              <p className="text-xs text-muted-foreground">
                Current: {format(parseISO(challenge.end_date), 'PPP')}
              </p>
            )}
          </div>

          {/* Submit */}
          <Button
            className="w-full"
            size="lg"
            onClick={handleSubmit}
            disabled={!hasChanges || proposeEditMutation.isPending}
          >
            {proposeEditMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Proposing...
              </>
            ) : (
              'Propose Changes'
            )}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
