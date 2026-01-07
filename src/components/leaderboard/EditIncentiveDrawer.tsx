import { useState, useMemo, useEffect } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { Incentive, useUpdateIncentive } from "@/hooks/useIncentives";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, CalendarIcon, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

interface EditIncentiveDrawerProps {
  incentive: Incentive;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditIncentiveDrawer = ({ incentive, open, onOpenChange }: EditIncentiveDrawerProps) => {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [reward, setReward] = useState('');
  const [targetValue, setTargetValue] = useState('1');
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [allSelected, setAllSelected] = useState(false);

  const { data: teamAccess } = useTeamAccess();
  const updateMutation = useUpdateIncentive();

  const allEligibleReps = useMemo(() => {
    return teamAccess?.accessibleReps.filter(r => r.userId) || [];
  }, [teamAccess]);

  // Initialize form when incentive changes or drawer opens
  useEffect(() => {
    if (open && incentive) {
      setTitle(incentive.title);
      setReward(incentive.reward);
      setTargetValue(incentive.target_value?.toString() || '1');
      setEndDate(parseISO(incentive.end_date));
      
      // Set selected user IDs from eligible reps
      const eligibleIds = incentive.eligible_reps?.map(r => r.user_id) || [];
      setSelectedUserIds(eligibleIds);
      
      // Check if all reps are selected
      const allRepIds = allEligibleReps.map(r => r.userId!);
      setAllSelected(
        eligibleIds.length === allRepIds.length && 
        allRepIds.every(id => eligibleIds.includes(id))
      );
    }
  }, [open, incentive, allEligibleReps]);

  const effectiveUserIds = useMemo(() => {
    if (allSelected) {
      return allEligibleReps.map(r => r.userId!);
    }
    return selectedUserIds;
  }, [allSelected, selectedUserIds, allEligibleReps]);

  const toggleUser = (userId: string) => {
    if (allSelected) {
      const newSelection = allEligibleReps.map(r => r.userId!).filter(id => id !== userId);
      setSelectedUserIds(newSelection);
      setAllSelected(false);
    } else {
      setSelectedUserIds(prev => 
        prev.includes(userId) 
          ? prev.filter(id => id !== userId)
          : [...prev, userId]
      );
    }
  };

  const selectAll = () => {
    setAllSelected(true);
    setSelectedUserIds([]);
  };

  const clearSelection = () => {
    setAllSelected(false);
    setSelectedUserIds([]);
  };

  const handleUpdate = async () => {
    if (!title.trim() || !reward.trim()) {
      toast.error('Please fill in title and reward');
      return;
    }

    if (effectiveUserIds.length === 0) {
      toast.error('Please select at least one participant');
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: incentive.id,
        title,
        reward,
        target_value: parseInt(targetValue) || 1,
        end_date: endDate ? format(endDate, 'yyyy-MM-dd') : undefined,
        eligible_user_ids: effectiveUserIds,
      });
      toast.success('Incentive updated! 🏆');
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update incentive');
    }
  };

  const canProceedFromStep1 = title.trim() && reward.trim();
  const canProceedFromStep2 = effectiveUserIds.length > 0;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="flex items-center gap-2">
          {step > 1 && (
            <Button variant="ghost" size="icon" onClick={() => setStep(step - 1)} className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <DrawerTitle className="flex-1">Edit Incentive</DrawerTitle>
          <span className="text-xs text-muted-foreground">{step}/3</span>
        </DrawerHeader>

        <div className="p-4 space-y-6 overflow-y-auto">
          {/* Step 1: Basic Info */}
          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  placeholder="First to Transition!"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Reward</Label>
                <Input
                  placeholder="Dinner on me"
                  value={reward}
                  onChange={(e) => setReward(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Target Value</Label>
                <Input
                  type="number"
                  min="1"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                />
              </div>

              <div className="p-3 rounded-xl bg-muted/50 border border-border">
                <p className="text-sm text-muted-foreground">
                  <strong>Metric:</strong> {incentive.metric.replace('_', ' ').toUpperCase()} (cannot be changed)
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  <strong>Goal Type:</strong> {incentive.target_type === 'first_to' ? 'First To' : 'Group Total'} (cannot be changed)
                </p>
              </div>

              <Button 
                onClick={() => setStep(2)} 
                className="w-full" 
                disabled={!canProceedFromStep1}
              >
                Next: Update Participants
              </Button>
            </>
          )}

          {/* Step 2: Participants */}
          {step === 2 && (
            <>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Participants</Label>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={selectAll} className="h-7 text-xs">
                      Select All
                    </Button>
                    <Button variant="outline" size="sm" onClick={clearSelection} className="h-7 text-xs">
                      Clear
                    </Button>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-muted/50 border border-border mb-2">
                  <p className="text-sm font-medium">
                    {allSelected 
                      ? `All ${allEligibleReps.length} reps selected`
                      : selectedUserIds.length === 0
                        ? 'No participants selected'
                        : `${selectedUserIds.length} participant${selectedUserIds.length !== 1 ? 's' : ''} selected`
                    }
                  </p>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-1 rounded-lg border border-border p-2">
                  {allEligibleReps.map(rep => {
                    const isChecked = allSelected || selectedUserIds.includes(rep.userId!);
                    return (
                      <label
                        key={rep.userId}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleUser(rep.userId!)}
                        />
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">{rep.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">{rep.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <Button 
                onClick={() => setStep(3)} 
                className="w-full"
                disabled={!canProceedFromStep2}
              >
                Next: Update End Date
              </Button>
            </>
          )}

          {/* Step 3: End Date */}
          {step === 3 && (
            <>
              <div className="space-y-3">
                <Label>End Date</Label>
                <p className="text-sm text-muted-foreground">
                  Started on {format(parseISO(incentive.start_date), 'MMM d, yyyy')}
                </p>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, 'MMMM d, yyyy') : 'Pick date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      disabled={(date) => date < parseISO(incentive.start_date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <Button onClick={handleUpdate} className="w-full" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Changes 💾
              </Button>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
