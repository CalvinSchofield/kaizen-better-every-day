import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { useCreateIncentive, IncentiveMetric, IncentiveTargetType } from "@/hooks/useIncentives";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, DollarSign, ArrowRightLeft, Footprints, Loader2, Eye, EyeOff, Users, User, X } from "lucide-react";
import { toast } from "sonner";
import { format, addDays } from "date-fns";

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
  const [title, setTitle] = useState('');
  const [reward, setReward] = useState('');
  const [metric, setMetric] = useState<IncentiveMetric>('transitions');
  const [targetType, setTargetType] = useState<IncentiveTargetType>('first_to');
  const [targetValue, setTargetValue] = useState('1');
  const [duration, setDuration] = useState<'today' | 'week'>('today');
  const [isPublic, setIsPublic] = useState(true);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [showPersonPicker, setShowPersonPicker] = useState(false);

  const { data: teamAccess } = useTeamAccess();
  const createMutation = useCreateIncentive();

  // Get current user's timezone from their rep record
  const { data: currentUserRep } = useQuery({
    queryKey: ['current-user-timezone'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from('reps')
        .select('timezone, user_id')
        .eq('user_id', user.id)
        .single();
      return data;
    },
    staleTime: Infinity,
  });

  const allEligibleReps = useMemo(() => {
    return teamAccess?.accessibleReps.filter(r => r.userId) || [];
  }, [teamAccess]);

  // If no specific selection, include all reps
  const effectiveUserIds = useMemo(() => {
    if (selectedUserIds.length === 0) {
      return allEligibleReps.map(r => r.userId!);
    }
    return selectedUserIds;
  }, [selectedUserIds, allEligibleReps]);

  const toggleUser = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const selectAll = () => {
    setSelectedUserIds(allEligibleReps.map(r => r.userId!));
  };

  const clearSelection = () => {
    setSelectedUserIds([]);
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

    const today = new Date();
    const startDate = today;
    const endDate = duration === 'today' ? today : addDays(today, 7);

    // Use rep's timezone or fall back to browser timezone
    const creatorTimezone = currentUserRep?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

    try {
      await createMutation.mutateAsync({
        title,
        reward,
        metric,
        target_type: targetType,
        target_value: parseInt(targetValue) || 1,
        visibility: isPublic ? 'public' : 'private',
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
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
    setTitle('');
    setReward('');
    setMetric('transitions');
    setTargetType('first_to');
    setTargetValue('1');
    setDuration('today');
    setIsPublic(true);
    setSelectedUserIds([]);
    setShowPersonPicker(false);
  };

  return (
    <Drawer open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetForm(); }}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader>
          <DrawerTitle>New Incentive</DrawerTitle>
        </DrawerHeader>

        <div className="p-4 space-y-6 overflow-y-auto">
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
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setTargetType('first_to')}
                className={cn(
                  "p-3 rounded-xl border-2 transition-colors text-center",
                  targetType === 'first_to' ? "border-primary bg-primary/10" : "border-border"
                )}
              >
                <User className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-sm font-medium">First To</p>
                <p className="text-xs text-muted-foreground">Individual race</p>
              </button>
              <button
                onClick={() => setTargetType('group_total')}
                className={cn(
                  "p-3 rounded-xl border-2 transition-colors text-center",
                  targetType === 'group_total' ? "border-primary bg-primary/10" : "border-border"
                )}
              >
                <Users className="h-5 w-5 mx-auto mb-1 text-blue-500" />
                <p className="text-sm font-medium">Group Total</p>
                <p className="text-xs text-muted-foreground">Team goal</p>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{targetType === 'group_total' ? 'Group target' : 'First to reach'}</Label>
            <Input
              type="number"
              min="1"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            <Label>Duration</Label>
            <div className="flex gap-2">
              {(['today', 'week'] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors",
                    duration === d ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}
                >
                  {d === 'today' ? 'Today Only' : 'This Week'}
                </button>
              ))}
            </div>
          </div>

          {/* Person Picker */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Participants</Label>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowPersonPicker(!showPersonPicker)}
                className="h-7 text-xs"
              >
                {showPersonPicker ? 'Hide' : 'Customize'}
              </Button>
            </div>
            
            {!showPersonPicker ? (
              <div className="p-3 rounded-xl bg-muted/50 border border-border">
                <p className="text-sm">
                  {selectedUserIds.length === 0 
                    ? `All ${allEligibleReps.length} reps in your downline`
                    : `${selectedUserIds.length} selected participant${selectedUserIds.length !== 1 ? 's' : ''}`
                  }
                </p>
                {selectedUserIds.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {selectedUserIds.slice(0, 5).map(userId => {
                      const rep = allEligibleReps.find(r => r.userId === userId);
                      return (
                        <span key={userId} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          {rep?.name}
                        </span>
                      );
                    })}
                    {selectedUserIds.length > 5 && (
                      <span className="text-xs text-muted-foreground">+{selectedUserIds.length - 5} more</span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAll} className="h-7 text-xs">
                    Select All
                  </Button>
                  <Button variant="outline" size="sm" onClick={clearSelection} className="h-7 text-xs">
                    Clear
                  </Button>
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg border border-border p-2">
                  {allEligibleReps.map(rep => (
                    <label
                      key={rep.userId}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedUserIds.length === 0 || selectedUserIds.includes(rep.userId!)}
                        onCheckedChange={() => {
                          if (selectedUserIds.length === 0) {
                            // First click when "all selected" - select only this one
                            setSelectedUserIds([rep.userId!]);
                          } else {
                            toggleUser(rep.userId!);
                          }
                        }}
                      />
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">{rep.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{rep.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
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
        </div>
      </DrawerContent>
    </Drawer>
  );
};
