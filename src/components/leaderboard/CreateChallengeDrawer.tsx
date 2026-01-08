import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { useCreateChallenge, ChallengeMetric, ChallengeType } from "@/hooks/useChallenges";
import { useSmartRepSorting } from "@/hooks/useSmartRepSorting";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, DollarSign, ArrowRightLeft, Footprints, Users, User, ChevronRight, ChevronLeft, Loader2, Eye, EyeOff, X, CalendarIcon, CalendarCheck, CalendarX } from "lucide-react";
import { toast } from "sonner";
import { format, addDays, startOfWeek, endOfWeek } from "date-fns";

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
  // Team mode: multi-select for team members
  const [teamA, setTeamA] = useState<string[]>([]); // Current user's team (excluding self, added automatically)
  const [teamB, setTeamB] = useState<string[]>([]); // Opponent's team
  const [metric, setMetric] = useState<ChallengeMetric>('fp_plus');
  const [duration, setDuration] = useState<'today' | 'tomorrow' | 'week' | 'custom'>('today');
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(new Date());
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(new Date());
  const [stakes, setStakes] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  const { data: teamAccess } = useTeamAccess();
  const createMutation = useCreateChallenge();

  const reps = teamAccess?.accessibleReps || [];

  // Get current user's timezone from their rep record
  const { data: currentUserRep } = useQuery({
    queryKey: ['current-user-timezone'],
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

  // Get date range for smart sorting
  const dateRange = useMemo(() => {
    const today = new Date();
    if (duration === 'today') {
      return { start: today, end: today };
    } else if (duration === 'tomorrow') {
      const tomorrow = addDays(today, 1);
      return { start: tomorrow, end: tomorrow };
    } else if (duration === 'week') {
      const weekStart = startOfWeek(today, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(today, { weekStartsOn: 0 });
      return { start: weekStart, end: weekEnd };
    } else {
      return { start: customStartDate || today, end: customEndDate || today };
    }
  }, [duration, customStartDate, customEndDate]);

  // Use smart sorting for available reps
  const { workingReps, notWorkingReps, allSortedReps } = useSmartRepSorting(
    reps,
    dateRange,
    currentUserRep?.user_id,
    true // exclude current user
  );

  // For team mode, filter out already selected users
  const availableForTeamA = useMemo(() => {
    return allSortedReps.filter(r => !teamB.includes(r.userId!));
  }, [allSortedReps, teamB]);

  const availableForTeamB = useMemo(() => {
    return allSortedReps.filter(r => !teamA.includes(r.userId!));
  }, [allSortedReps, teamA]);

  const toggleTeamMember = (userId: string, team: 'a' | 'b') => {
    if (team === 'a') {
      setTeamA(prev => 
        prev.includes(userId) 
          ? prev.filter(id => id !== userId)
          : [...prev, userId]
      );
    } else {
      setTeamB(prev => 
        prev.includes(userId) 
          ? prev.filter(id => id !== userId)
          : [...prev, userId]
      );
    }
  };

  const getDateRange = () => {
    const today = new Date();
    if (duration === 'today') {
      return { start: today, end: today };
    } else if (duration === 'tomorrow') {
      const tomorrow = addDays(today, 1);
      return { start: tomorrow, end: tomorrow };
    } else if (duration === 'week') {
      // Sunday to Saturday in local time
      const weekStart = startOfWeek(today, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(today, { weekStartsOn: 0 });
      return { start: weekStart, end: weekEnd };
    } else {
      return { start: customStartDate || today, end: customEndDate || today };
    }
  };

  const handleCreate = async () => {
    if (type === '1v1') {
      if (!selectedOpponent) {
        toast.error('Please select an opponent');
        return;
      }
    } else {
      // Group mode
      if (teamB.length === 0) {
        toast.error('Please select at least one opponent for Team B');
        return;
      }
    }

    const { start, end } = getDateRange();

    // Use rep's timezone or fall back to browser timezone
    const creatorTimezone = currentUserRep?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

    try {
      if (type === '1v1') {
        await createMutation.mutateAsync({
          type,
          metric,
          visibility: isPublic ? 'public' : 'private',
          stakes: stakes || undefined,
          start_date: format(start, 'yyyy-MM-dd'),
          end_date: format(end, 'yyyy-MM-dd'),
          creator_timezone: creatorTimezone,
          participants: [{
            user_id: selectedOpponent!,
            role: 'captain_b',
          }],
        });
      } else {
        // Group/Team mode
        const participants = [
          // Team A members (excluding creator who is added automatically)
          ...teamA.map(userId => ({
            user_id: userId,
            team: 'a' as const,
            role: 'member' as const,
          })),
          // Team B - first person is captain_b, others are members
          ...teamB.map((userId, index) => ({
            user_id: userId,
            team: 'b' as const,
            role: index === 0 ? 'captain_b' as const : 'member' as const,
          })),
        ];

        await createMutation.mutateAsync({
          type,
          metric,
          visibility: isPublic ? 'public' : 'private',
          stakes: stakes || undefined,
          start_date: format(start, 'yyyy-MM-dd'),
          end_date: format(end, 'yyyy-MM-dd'),
          creator_timezone: creatorTimezone,
          participants,
        });
      }
      toast.success('Challenge sent! 🎯');
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
    setTeamA([]);
    setTeamB([]);
    setMetric('fp_plus');
    setDuration('today');
    setCustomStartDate(new Date());
    setCustomEndDate(new Date());
    setStakes('');
    setIsPublic(true);
  };

  const getSelectedTeamNames = (userIds: string[]) => {
    return userIds.map(id => {
      const rep = reps.find(r => r.userId === id);
      return rep?.name || 'Unknown';
    });
  };

  const getTotalSteps = () => 4;

  return (
    <Drawer open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetForm(); }}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="flex items-center gap-2">
          {step > 1 && (
            <Button variant="ghost" size="icon" onClick={() => setStep(step - 1)} className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <DrawerTitle className="flex-1">New Challenge</DrawerTitle>
          <span className="text-xs text-muted-foreground">{step}/{getTotalSteps()}</span>
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
                  <p className="font-semibold">Team</p>
                  <p className="text-xs text-muted-foreground">Team vs Team</p>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Select Opponent (1v1) */}
          {step === 2 && type === '1v1' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Select your opponent</p>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {/* Working reps */}
                {workingReps.length > 0 && (
                  <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
                    <CalendarCheck className="h-3 w-3 text-green-500" />
                    <span>Planning to work</span>
                  </div>
                )}
                {workingReps.map(rep => (
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
                    <div className="flex-1 text-left">
                      <span className="font-medium block">{rep.name}</span>
                      {rep.teamName && <span className="text-xs text-muted-foreground">{rep.teamName}</span>}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
                
                {/* Separator */}
                {workingReps.length > 0 && notWorkingReps.length > 0 && (
                  <div className="py-2">
                    <Separator className="my-1" />
                    <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
                      <CalendarX className="h-3 w-3" />
                      <span>Not planning to work</span>
                    </div>
                  </div>
                )}
                
                {/* Not working reps */}
                {notWorkingReps.map(rep => (
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
                    <div className="flex-1 text-left">
                      <span className="font-medium block">{rep.name}</span>
                      {rep.teamName && <span className="text-xs text-muted-foreground">{rep.teamName}</span>}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Select Teams (Group mode) */}
          {step === 2 && type === 'group' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Team A (Your Team) */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-green-600">Your Team</Label>
                  <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20 min-h-[100px]">
                    {/* Current user (auto-included) */}
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/20 mb-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">{currentUserRep?.name?.charAt(0) || 'Y'}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-medium truncate">{currentUserRep?.name || 'You'}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">Captain</span>
                    </div>
                    {/* Selected team A members */}
                    {teamA.map(userId => {
                      const rep = reps.find(r => r.userId === userId);
                      return (
                        <div key={userId} className="flex items-center gap-2 p-2 rounded-lg bg-background mb-1">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-xs">{rep?.name?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-medium truncate flex-1">{rep?.name}</span>
                          <button onClick={() => toggleTeamMember(userId, 'a')} className="text-muted-foreground hover:text-destructive">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Team B (Their Team) */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-orange-600">Their Team</Label>
                  <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20 min-h-[100px]">
                    {teamB.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">Select opponents below</p>
                    )}
                    {teamB.map((userId, index) => {
                      const rep = reps.find(r => r.userId === userId);
                      return (
                        <div key={userId} className="flex items-center gap-2 p-2 rounded-lg bg-background mb-1">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-xs">{rep?.name?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-medium truncate flex-1">{rep?.name}</span>
                          {index === 0 && <span className="text-[10px] text-muted-foreground">Captain</span>}
                          <button onClick={() => toggleTeamMember(userId, 'b')} className="text-muted-foreground hover:text-destructive">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Available reps to add */}
              <div className="space-y-2">
                <Label className="text-sm">Add teammates or opponents</Label>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {allSortedReps.map(rep => {
                    const inTeamA = teamA.includes(rep.userId!);
                    const inTeamB = teamB.includes(rep.userId!);
                    
                    return (
                      <div
                        key={rep.userId}
                        className="flex items-center gap-3 p-2 rounded-lg border border-border"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">{rep.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium block truncate">{rep.name}</span>
                          {rep.teamName && <span className="text-xs text-muted-foreground">{rep.teamName}</span>}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant={inTeamA ? "default" : "outline"}
                            className={cn("h-7 px-2 text-xs", inTeamA && "bg-green-600 hover:bg-green-700")}
                            onClick={() => toggleTeamMember(rep.userId!, 'a')}
                            disabled={inTeamB}
                          >
                            Your Team
                          </Button>
                          <Button
                            size="sm"
                            variant={inTeamB ? "default" : "outline"}
                            className={cn("h-7 px-2 text-xs", inTeamB && "bg-orange-600 hover:bg-orange-700")}
                            onClick={() => toggleTeamMember(rep.userId!, 'b')}
                            disabled={inTeamA}
                          >
                            Their Team
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Button 
                onClick={() => setStep(3)} 
                className="w-full"
                disabled={teamB.length === 0}
              >
                Continue
              </Button>
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

          {/* Step 4: Duration, Stakes & Privacy */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="space-y-3">
                <Label>Duration</Label>
                <div className="flex gap-2 flex-wrap">
                  {(['today', 'tomorrow', 'week', 'custom'] as const).map(d => (
                    <button
                      key={d}
                      onClick={() => setDuration(d)}
                      className={cn(
                        "flex-1 min-w-[70px] py-2 px-2 rounded-lg text-sm font-medium transition-colors",
                        duration === d ? "bg-primary text-primary-foreground" : "bg-muted"
                      )}
                    >
                      {d === 'today' ? 'Today' : d === 'tomorrow' ? 'Tomorrow' : d === 'week' ? 'This Week' : 'Custom'}
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

              <div className="space-y-2">
                <Label>Stakes (optional)</Label>
                <Input
                  placeholder="Loser buys lunch..."
                  value={stakes}
                  onChange={(e) => setStakes(e.target.value)}
                />
              </div>

              {/* Privacy Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-border">
                <div className="flex items-center gap-2">
                  {isPublic ? <Eye className="h-4 w-4 text-muted-foreground" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                  <div>
                    <p className="text-sm font-medium">{isPublic ? 'Public' : 'Private'}</p>
                    <p className="text-xs text-muted-foreground">
                      {isPublic ? 'Everyone can see this challenge' : 'Only participants can see'}
                    </p>
                  </div>
                </div>
                <Switch checked={isPublic} onCheckedChange={setIsPublic} />
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
