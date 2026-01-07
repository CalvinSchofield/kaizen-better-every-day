import { useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { useCreateChallenge, ChallengeMetric, ChallengeType } from "@/hooks/useChallenges";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, DollarSign, ArrowRightLeft, Footprints, Users, User, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format, addDays } from "date-fns";

interface CreateChallengeDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const metrics: { key: ChallengeMetric; label: string; icon: typeof Trophy }[] = [
  { key: 'fp_plus', label: 'FP+', icon: Trophy },
  { key: 'prmr', label: 'PRMR', icon: DollarSign },
  { key: 'transitions', label: 'Transitions', icon: ArrowRightLeft },
  { key: 'doors_knocked', label: 'Doors', icon: Footprints },
];

export const CreateChallengeDrawer = ({ open, onOpenChange }: CreateChallengeDrawerProps) => {
  const [step, setStep] = useState(1);
  const [type, setType] = useState<ChallengeType>('1v1');
  const [selectedOpponent, setSelectedOpponent] = useState<string | null>(null);
  const [metric, setMetric] = useState<ChallengeMetric>('fp_plus');
  const [duration, setDuration] = useState<'today' | 'tomorrow' | 'week'>('tomorrow');
  const [stakes, setStakes] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  const { data: teamAccess } = useTeamAccess();
  const createMutation = useCreateChallenge();

  const reps = teamAccess?.accessibleReps || [];

  const handleCreate = async () => {
    if (!selectedOpponent) {
      toast.error('Please select an opponent');
      return;
    }

    const today = new Date();
    let startDate: Date;
    let endDate: Date;

    if (duration === 'today') {
      startDate = today;
      endDate = today;
    } else if (duration === 'tomorrow') {
      startDate = addDays(today, 1);
      endDate = addDays(today, 1);
    } else {
      startDate = addDays(today, 1);
      endDate = addDays(today, 7);
    }

    try {
      await createMutation.mutateAsync({
        type,
        metric,
        visibility: isPublic ? 'public' : 'private',
        stakes: stakes || undefined,
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        participants: [{ user_id: selectedOpponent, role: 'captain_b' }],
      });
      toast.success('Challenge sent! 🔥');
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create challenge');
    }
  };

  const resetForm = () => {
    setStep(1);
    setType('1v1');
    setSelectedOpponent(null);
    setMetric('fp_plus');
    setDuration('tomorrow');
    setStakes('');
    setIsPublic(true);
  };

  return (
    <Drawer open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetForm(); }}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader>
          <DrawerTitle>New Challenge</DrawerTitle>
        </DrawerHeader>

        <div className="p-4 space-y-6 overflow-y-auto">
          {/* Step 1: Type */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Who do you want to challenge?</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { setType('1v1'); setStep(2); }}
                  className="p-4 rounded-xl border-2 border-border hover:border-primary transition-colors text-center"
                >
                  <User className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <p className="font-semibold">1v1</p>
                  <p className="text-xs text-muted-foreground">Head to head</p>
                </button>
                <button
                  onClick={() => { setType('group'); setStep(2); }}
                  className="p-4 rounded-xl border-2 border-border hover:border-primary transition-colors text-center"
                >
                  <Users className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                  <p className="font-semibold">Group</p>
                  <p className="text-xs text-muted-foreground">Team vs Team</p>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Select Opponent */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Select your opponent</p>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {reps.filter(r => r.userId).map(rep => (
                  <button
                    key={rep.userId}
                    onClick={() => { setSelectedOpponent(rep.userId!); setStep(3); }}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-xl border transition-colors",
                      selectedOpponent === rep.userId ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                    )}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>{rep.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium flex-1 text-left">{rep.name}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Metric */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">What are you competing on?</p>
              <div className="grid grid-cols-2 gap-3">
                {metrics.map(m => (
                  <button
                    key={m.key}
                    onClick={() => { setMetric(m.key); setStep(4); }}
                    className={cn(
                      "p-4 rounded-xl border-2 transition-colors text-center",
                      metric === m.key ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                    )}
                  >
                    <m.icon className="h-6 w-6 mx-auto mb-2 text-primary" />
                    <p className="font-semibold">{m.label}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Duration & Stakes */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="space-y-3">
                <Label>Duration</Label>
                <div className="flex gap-2">
                  {(['tomorrow', 'week'] as const).map(d => (
                    <button
                      key={d}
                      onClick={() => setDuration(d)}
                      className={cn(
                        "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors",
                        duration === d ? "bg-primary text-primary-foreground" : "bg-muted"
                      )}
                    >
                      {d === 'tomorrow' ? 'Tomorrow' : 'This Week'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Stakes (optional)</Label>
                <Input
                  placeholder="Loser buys lunch..."
                  value={stakes}
                  onChange={(e) => setStakes(e.target.value)}
                />
              </div>

              <Button onClick={handleCreate} className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Send Challenge 🔥
              </Button>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
