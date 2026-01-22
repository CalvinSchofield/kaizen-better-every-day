import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { useCreateIncentive, IncentiveMetric, IncentiveTargetType } from "@/hooks/useIncentives";
import { supabase } from "@/integrations/supabase/client";
import { SmartParticipantPicker } from "./SmartParticipantPicker";
import { Trophy, DollarSign, ArrowRightLeft, Footprints, Loader2, Eye, EyeOff, Users, User, ChevronLeft, CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek } from "date-fns";

interface CreateIncentiveDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const metrics: { key: IncentiveMetric; label: string; icon: typeof Trophy }[] = [
  { key: 'fp_plus', label: 'FP+', icon: Trophy },
  { key: 'prmr', label: 'PRMR', icon: DollarSign },
  { key: 'transitions', label: 'Transitions', icon: ArrowRightLeft },
  { key: 'doors_knocked', label: 'Doors', icon: Footprints },
];

export const CreateIncentiveDrawer = ({ open, onOpenChange }: CreateIncentiveDrawerProps) => {
  const [step, setStep] = useState(1); // 1: basic info + duration, 2: participants, 3: confirm
  const [title, setTitle] = useState('');
  const [reward, setReward] = useState('');
  const [metric, setMetric] = useState<IncentiveMetric>('transitions');
  const [targetType, setTargetType] = useState<IncentiveTargetType>('first_to');
  const [targetValue, setTargetValue] = useState('1');
  const [duration, setDuration] = useState<'today' | 'week' | 'custom'>('today');
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(new Date());
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(new Date());
  const [isPublic, setIsPublic] = useState(true);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [allSelected, setAllSelected] = useState(true);

  const { data: teamAccess } = useTeamAccess();
  const createMutation = useCreateIncentive();

  // Get current user's rep data for participant picker
  const { data: currentUserRep } = useQuery({
    queryKey: ['current-user-rep-for-incentive'],
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

  // Include current user in the list (leaders should see themselves)
  const allEligibleReps = useMemo(() => {
    return teamAccess?.accessibleReps.filter(r => r.userId) || [];
  }, [teamAccess]);

  // Compute effective user IDs based on explicit all-selected state
  const effectiveUserIds = useMemo(() => {
    if (allSelected) {
      return allEligibleReps.map(r => r.userId!).filter(Boolean);
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

  const getDateRange = () => {
    const today = new Date();
    if (duration === 'today') {
      return { start: today, end: today };
    } else if (duration === 'week') {
      const weekStart = startOfWeek(today, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(today, { weekStartsOn: 0 });
      return { start: weekStart, end: weekEnd };
    } else {
      return { start: customStartDate || today, end: customEndDate || today };
    }
  };

  const handleCreate = async () => {
    if (!title.trim() || !reward.trim()) {
      toast.error('Please fill in title and reward');
      return;
    }

    if (effectiveUserIds.length === 0) {
      toast.error('Please select at least one participant');
      return;
    }

    const { start, end } = getDateRange();
    const creatorTimezone = currentUserRep?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

    try {
      await createMutation.mutateAsync({
        title,
        reward,
        metric,
        target_type: targetType,
        target_value: parseInt(targetValue) || 1,
        visibility: isPublic ? 'public' : 'private',
        start_date: format(start, 'yyyy-MM-dd'),
        end_date: format(end, 'yyyy-MM-dd'),
        creator_timezone: creatorTimezone,
        eligible_user_ids: effectiveUserIds,
      });
      toast.success('Incentive created! 🏆');
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create incentive');
    }
  };

  const resetForm = () => {
    setStep(1);
    setTitle('');
    setReward('');
    setMetric('transitions');
    setTargetType('first_to');
    setTargetValue('1');
    setDuration('today');
    setCustomStartDate(new Date());
    setCustomEndDate(new Date());
    setIsPublic(true);
    setSelectedUserIds([]);
    setAllSelected(true);
  };

  const canProceedFromStep1 = title.trim() && reward.trim();
  const canProceedFromStep2 = effectiveUserIds.length > 0;

  // Date range summary for display
  const dateRangeSummary = useMemo(() => {
    const { start, end } = getDateRange();
    if (duration === 'today') return 'Today';
    if (duration === 'week') return 'This Week';
    return `${format(start, 'MMM d')} - ${format(end, 'MMM d')}`;
  }, [duration, customStartDate, customEndDate]);

  return (
    <Drawer open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetForm(); }}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="flex items-center gap-2">
          {step > 1 && (
            <Button variant="ghost" size="icon" onClick={() => setStep(step - 1)} className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <DrawerTitle className="flex-1">
            {step === 1 && 'New Incentive'}
            {step === 2 && 'Select Participants'}
            {step === 3 && 'Confirm & Create'}
          </DrawerTitle>
          <span className="text-xs text-muted-foreground">{step}/3</span>
        </DrawerHeader>

        <div className="p-4 space-y-6 overflow-y-auto">
          {/* Step 1: Basic Info + Duration */}
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

              <div className="space-y-3">
                <Label>Metric</Label>
                <div className="grid grid-cols-2 gap-2">
                  {metrics.map(m => (
                    <button
                      key={m.key}
                      onClick={() => setMetric(m.key)}
                      className={cn(
                        "p-3 rounded-xl border-2 transition-colors text-center",
                        metric === m.key ? "border-primary bg-primary/10" : "border-border"
                      )}
                    >
                      <m.icon className="h-5 w-5 mx-auto mb-1 text-primary" />
                      <p className="text-sm font-medium">{m.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Goal Type */}
              <div className="space-y-3">
                <Label>Goal Type</Label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setTargetType('first_to')}
                    className={cn(
                      "p-3 rounded-xl border-2 transition-colors text-center",
                      targetType === 'first_to' ? "border-primary bg-primary/10" : "border-border"
                    )}
                  >
                    <User className="h-5 w-5 mx-auto mb-1 text-primary" />
                    <p className="text-sm font-medium">First To</p>
                    <p className="text-xs text-muted-foreground">Race</p>
                  </button>
                  <button
                    onClick={() => setTargetType('anyone_who')}
                    className={cn(
                      "p-3 rounded-xl border-2 transition-colors text-center",
                      targetType === 'anyone_who' ? "border-primary bg-primary/10" : "border-border"
                    )}
                  >
                    <Users className="h-5 w-5 mx-auto mb-1 text-green-500" />
                    <p className="text-sm font-medium">Anyone</p>
                    <p className="text-xs text-muted-foreground">All qualify</p>
                  </button>
                  <button
                    onClick={() => setTargetType('group_total')}
                    className={cn(
                      "p-3 rounded-xl border-2 transition-colors text-center",
                      targetType === 'group_total' ? "border-primary bg-primary/10" : "border-border"
                    )}
                  >
                    <Users className="h-5 w-5 mx-auto mb-1 text-blue-500" />
                    <p className="text-sm font-medium">Group</p>
                    <p className="text-xs text-muted-foreground">Team goal</p>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>
                  {targetType === 'group_total' ? 'Group target' : 
                   targetType === 'anyone_who' ? 'Anyone who gets' : 
                   'First to reach'}
                </Label>
                <Input
                  type="number"
                  min="1"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                />
              </div>

              {/* Duration - MOVED TO STEP 1 */}
              <div className="space-y-3">
                <Label>Duration</Label>
                <div className="flex gap-2 flex-wrap">
                  {(['today', 'week', 'custom'] as const).map(d => (
                    <button
                      key={d}
                      onClick={() => setDuration(d)}
                      className={cn(
                        "flex-1 min-w-[80px] py-2 px-3 rounded-lg text-sm font-medium transition-colors",
                        duration === d ? "bg-primary text-primary-foreground" : "bg-muted"
                      )}
                    >
                      {d === 'today' ? 'Today' : d === 'week' ? 'This Week' : 'Custom'}
                    </button>
                  ))}
                </div>

                {duration === 'custom' && (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Start Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left font-normal h-9">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {customStartDate ? format(customStartDate, 'MMM d') : 'Pick date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={customStartDate}
                            onSelect={setCustomStartDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">End Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left font-normal h-9">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {customEndDate ? format(customEndDate, 'MMM d') : 'Pick date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={customEndDate}
                            onSelect={setCustomEndDate}
                            disabled={(date) => customStartDate ? date < customStartDate : false}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                )}
              </div>

              <Button 
                onClick={() => setStep(2)} 
                className="w-full" 
                disabled={!canProceedFromStep1}
              >
                Next: Select Participants
              </Button>
            </>
          )}

          {/* Step 2: Participants */}
          {step === 2 && (
            <>
              <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm">
                <span className="text-muted-foreground">Duration:</span> <span className="font-medium">{dateRangeSummary}</span>
              </div>

              <SmartParticipantPicker
                allReps={allEligibleReps}
                selectedUserIds={selectedUserIds}
                allSelected={allSelected}
                onToggleUser={toggleUser}
                onSelectAll={selectAll}
                onClear={clearSelection}
                currentUserId={currentUserRep?.user_id}
                currentUserRep={currentUserRep}
                dateRange={getDateRange()}
                showSelfInList={true}
              />

              <Button 
                onClick={() => setStep(3)} 
                className="w-full"
                disabled={!canProceedFromStep2}
              >
                Next: Confirm
              </Button>
            </>
          )}

          {/* Step 3: Confirm & Settings */}
          {step === 3 && (
            <>
              {/* Summary */}
              <div className="space-y-3 p-4 rounded-xl bg-muted/50 border border-border">
                <h3 className="font-semibold">{title}</h3>
                <div className="text-sm space-y-1">
                  <p><span className="text-muted-foreground">Reward:</span> {reward}</p>
                  <p><span className="text-muted-foreground">Goal:</span> {targetType === 'first_to' ? 'First to' : targetType === 'anyone_who' ? 'Anyone who gets' : 'Group total of'} {targetValue} {metrics.find(m => m.key === metric)?.label}</p>
                  <p><span className="text-muted-foreground">Duration:</span> {dateRangeSummary}</p>
                  <p><span className="text-muted-foreground">Participants:</span> {allSelected ? `All (${allEligibleReps.length})` : `${effectiveUserIds.length} selected`}</p>
                </div>
              </div>

              {/* Privacy Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-border">
                <div className="flex items-center gap-2">
                  {isPublic ? <Eye className="h-4 w-4 text-muted-foreground" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                  <div>
                    <p className="text-sm font-medium">{isPublic ? 'Public' : 'Private'}</p>
                    <p className="text-xs text-muted-foreground">
                      {isPublic ? 'Everyone can see this incentive' : 'Only participants can see'}
                    </p>
                  </div>
                </div>
                <Switch checked={isPublic} onCheckedChange={setIsPublic} />
              </div>

              <Button onClick={handleCreate} className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create Incentive 🏆
              </Button>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
