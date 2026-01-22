import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { Incentive, IncentiveVisibility, useUpdateIncentive } from "@/hooks/useIncentives";
import { SmartParticipantPicker } from "./SmartParticipantPicker";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CalendarIcon, ChevronLeft, Eye, EyeOff } from "lucide-react";
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
  const [visibility, setVisibility] = useState<IncentiveVisibility>('private');

  const { data: teamAccess } = useTeamAccess();
  const updateMutation = useUpdateIncentive();

  // Get current user's rep record to include them in picker
  const { data: currentUserRep } = useQuery({
    queryKey: ['current-user-for-edit-incentive'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from('reps')
        .select('timezone, user_id, name')
        .eq('user_id', user.id)
        .single();
      return data;
    },
    staleTime: Infinity,
  });

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
      setVisibility(incentive.visibility);
      
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
        visibility,
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

              <div className="space-y-3">
                <Label>Visibility</Label>
                <RadioGroup
                  value={visibility}
                  onValueChange={(v) => setVisibility(v as IncentiveVisibility)}
                  className="flex gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="private" id="visibility-private" />
                    <Label htmlFor="visibility-private" className="flex items-center gap-1.5 text-sm font-normal cursor-pointer">
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                      Private
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="public" id="visibility-public" />
                    <Label htmlFor="visibility-public" className="flex items-center gap-1.5 text-sm font-normal cursor-pointer">
                      <Eye className="h-4 w-4 text-muted-foreground" />
                      Public
                    </Label>
                  </div>
                </RadioGroup>
                <p className="text-xs text-muted-foreground">
                  Public incentives are visible to everyone. Private ones are only visible to participants.
                </p>
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
              <SmartParticipantPicker
                allReps={allEligibleReps}
                selectedUserIds={selectedUserIds}
                allSelected={allSelected}
                onToggleUser={toggleUser}
                onSelectAll={selectAll}
                onClear={clearSelection}
                currentUserId={currentUserRep?.user_id}
                currentUserRep={currentUserRep}
                dateRange={endDate ? { start: parseISO(incentive.start_date), end: endDate } : undefined}
                showSelfInList={true}
              />

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
