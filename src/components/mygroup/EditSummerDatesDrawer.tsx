import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Calendar, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from "@/components/ui/drawer";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface EditSummerDatesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  person: {
    userId: string;
    name: string;
    personalSummerStart: string | null;
    personalSummerEnd: string | null;
  };
}

export const EditSummerDatesDrawer = ({ 
  open, 
  onOpenChange, 
  person 
}: EditSummerDatesDrawerProps) => {
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState<Date | undefined>(
    person.personalSummerStart ? parseISO(person.personalSummerStart) : undefined
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    person.personalSummerEnd ? parseISO(person.personalSummerEnd) : undefined
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!startDate && !endDate) {
      toast.error('Please set at least one date');
      return;
    }

    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { error } = await supabase.functions.invoke('update-summer-dates', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          repId: person.userId,
          startDate: startDate ? format(startDate, 'yyyy-MM-dd') : null,
          endDate: endDate ? format(endDate, 'yyyy-MM-dd') : null,
        },
      });

      if (error) throw error;

      toast.success(`Updated summer dates for ${person.name.split(' ')[0]}`);
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['team-summer-availability'] });
      queryClient.invalidateQueries({ queryKey: ['current-user-summer'] });
      
      onOpenChange(false);
    } catch (err: any) {
      console.error('Failed to update summer dates:', err);
      toast.error(err.message || 'Failed to update dates');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Edit Summer Dates</DrawerTitle>
          <p className="text-sm text-muted-foreground">{person.name}</p>
        </DrawerHeader>

        <div className="px-4 pb-6 space-y-4">
          {/* Start Date */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Start Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, 'PPP') : 'Select start date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* End Date */}
          <div className="space-y-2">
            <label className="text-sm font-medium">End Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, 'PPP') : 'Select end date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  disabled={(date) => startDate ? date < startDate : false}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <DrawerClose asChild>
              <Button variant="outline" className="flex-1" disabled={isSaving}>
                Cancel
              </Button>
            </DrawerClose>
            <Button onClick={handleSave} disabled={isSaving} className="flex-1">
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Dates
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
