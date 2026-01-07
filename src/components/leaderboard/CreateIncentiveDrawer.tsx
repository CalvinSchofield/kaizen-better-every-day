import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { useCreateIncentive, IncentiveMetric } from "@/hooks/useIncentives";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, DollarSign, ArrowRightLeft, Footprints, Loader2 } from "lucide-react";
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
  const [targetValue, setTargetValue] = useState('1');
  const [duration, setDuration] = useState<'today' | 'week'>('today');

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
        .select('timezone')
        .eq('user_id', user.id)
        .single();
      return data;
    },
    staleTime: Infinity,
  });

  const eligibleUserIds = teamAccess?.accessibleReps
    .filter(r => r.userId)
    .map(r => r.userId!) || [];

  const handleCreate = async () => {
    if (!title.trim() || !reward.trim()) {
      toast.error('Please fill in title and reward');
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
        target_type: 'first_to',
        target_value: parseInt(targetValue) || 1,
        visibility: 'public',
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        creator_timezone: creatorTimezone,
        eligible_user_ids: eligibleUserIds,
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
    setTargetValue('1');
    setDuration('today');
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

          <div className="space-y-2">
            <Label>First to reach</Label>
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

          <p className="text-sm text-muted-foreground">
            {eligibleUserIds.length} reps in your downline will be eligible
          </p>

          <Button onClick={handleCreate} className="w-full" disabled={createMutation.isPending}>
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Create Incentive 🏆
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
