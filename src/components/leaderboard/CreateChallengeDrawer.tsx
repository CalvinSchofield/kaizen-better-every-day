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
import { useCreateChallenge, ChallengeMetric, ChallengeType } from "@/hooks/useChallenges";
import { useParticipantPool, filterAndSortReps, ParticipantRep, ScopeFilter, YearFilter } from "@/hooks/useParticipantPool";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Trophy, DollarSign, ArrowRightLeft, Footprints, Users, User, ChevronRight, ChevronLeft, Loader2, Eye, EyeOff, X, CalendarIcon, CalendarCheck, Search, Building2 } from "lucide-react";
import { toast } from "sonner";
import { format, addDays, startOfWeek, endOfWeek } from "date-fns";
import { getInitials } from "@/utils/nameUtils";
import { YearBadge } from "./YearBadge";

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
  
  // Picker state for enhanced UI
  const [scope, setScope] = useState<ScopeFilter>('my_recruits');
  const [yearFilters, setYearFilters] = useState<Set<YearFilter>>(new Set());
  const [workingOnly, setWorkingOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const createMutation = useCreateChallenge();

  // Get date range for participant pool
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

  // Use the new participant pool (includes current user for challenges)
  const {
    allReps,
    accessLevel,
    availableScopes,
    workingUserIds,
    isLoading: isLoadingPool,
    currentUserId,
  } = useParticipantPool({ dateRange, includeCurrentUser: true });

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

  // Scope labels for chips
  const scopeLabels: Record<ScopeFilter, { label: string; icon: typeof User }> = {
    my_recruits: { label: 'My Recruits', icon: User },
    my_team: { label: 'My Team', icon: Users },
    my_mgmt: { label: 'My MGMT', icon: Building2 },
    all_office: { label: 'All Office', icon: Users },
  };

  const yearLabels: Record<YearFilter, string> = {
    rookie: 'Rookies',
    sophomore: 'Sophs',
    vet: 'Vets',
  };

  const toggleYearFilter = (year: YearFilter) => {
    setYearFilters(prev => {
      const next = new Set(prev);
      if (next.has(year)) {
        next.delete(year);
      } else {
        next.add(year);
      }
      return next;
    });
  };

  // Filter and group reps using the helper
  const { grouped, total } = useMemo(() => {
    // Exclude self from opponent selection
    const repsWithoutSelf = allReps.filter(r => r.userId !== currentUserId);
    return filterAndSortReps(repsWithoutSelf, {
      scope,
      yearFilters,
      workingOnly,
      searchQuery,
      currentUserId,
    });
  }, [allReps, scope, yearFilters, workingOnly, searchQuery, currentUserId]);

  // For team mode, filter out already selected users
  const availableForTeamA = useMemo(() => {
    const repsWithoutSelf = allReps.filter(r => r.userId !== currentUserId);
    return repsWithoutSelf.filter(r => !teamB.includes(r.userId!));
  }, [allReps, teamB, currentUserId]);

  const availableForTeamB = useMemo(() => {
    const repsWithoutSelf = allReps.filter(r => r.userId !== currentUserId);
    return repsWithoutSelf.filter(r => !teamA.includes(r.userId!));
  }, [allReps, teamA, currentUserId]);

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
      let result;
      if (type === '1v1') {
        result = await createMutation.mutateAsync({
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

        result = await createMutation.mutateAsync({
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
      
      // Show different toast based on whether challenge was auto-started
      if (result?.autoStarted) {
        toast.success('Challenge started! 🚀');
      } else {
        toast.success('Challenge sent! 🎯');
      }
      
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
    setScope('my_recruits');
    setYearFilters(new Set());
    setWorkingOnly(false);
    setSearchQuery('');
  };

  const getSelectedTeamNames = (userIds: string[]) => {
    return userIds.map(id => {
      const rep = allReps.find(r => r.userId === id);
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
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Select your opponent</p>
              
              {/* Scope Filter Chips */}
              {availableScopes.length > 1 && (
                <div className="flex gap-1.5 flex-wrap">
                  {availableScopes.map(s => {
                    const { label, icon: Icon } = scopeLabels[s];
                    const isActive = scope === s;
                    return (
                      <button
                        key={s}
                        onClick={() => setScope(s)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                          "active:scale-[0.97]",
                          isActive 
                            ? "bg-primary text-primary-foreground" 
                            : "bg-muted hover:bg-muted/80 text-muted-foreground"
                        )}
                      >
                        <Icon className="h-3 w-3" />
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
              
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search by name or team..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-9 h-10"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              
              {/* Year + Working Filter Chips */}
              <div className="flex gap-1.5 flex-wrap">
                {(Object.entries(yearLabels) as [YearFilter, string][]).map(([year, label]) => {
                  const isActive = yearFilters.has(year);
                  return (
                    <button
                      key={year}
                      onClick={() => toggleYearFilter(year)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                        "active:scale-[0.97]",
                        isActive 
                          ? "bg-secondary text-secondary-foreground" 
                          : "bg-muted/60 hover:bg-muted text-muted-foreground"
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
                
                <button
                  onClick={() => setWorkingOnly(!workingOnly)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                    "active:scale-[0.97]",
                    workingOnly 
                      ? "bg-green-500/20 text-green-700 dark:text-green-400" 
                      : "bg-muted/60 hover:bg-muted text-muted-foreground"
                  )}
                >
                  <CalendarCheck className="h-3 w-3" />
                  Working ({workingUserIds.size})
                </button>
              </div>
              
              {/* Rep List */}
              <div className="max-h-60 overflow-y-auto space-y-1 rounded-xl border border-border p-2">
                {isLoadingPool && (
                  <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Loading...
                  </div>
                )}
                
                {!isLoadingPool && total === 0 && (
                  <div className="text-center py-6 text-sm text-muted-foreground">
                    {searchQuery ? (
                      <>
                        No reps match "{searchQuery}"
                        <button
                          onClick={() => setSearchQuery('')}
                          className="block mx-auto mt-2 text-primary hover:underline text-xs"
                        >
                          Clear search
                        </button>
                      </>
                    ) : (
                      'No eligible opponents found'
                    )}
                  </div>
                )}
                
                {!isLoadingPool && total > 0 && (
                  <>
                    {Array.from(grouped.entries()).map(([groupName, reps]) => (
                      <div key={groupName} className="space-y-0.5">
                        {/* Group header */}
                        <div className="text-xs font-semibold text-muted-foreground px-2 pt-2 pb-1 sticky top-0 bg-background/95 backdrop-blur-sm">
                          {groupName} ({reps.length})
                        </div>
                        {reps.map(rep => (
                          <button
                            key={rep.userId}
                            onClick={() => { setSelectedOpponent(rep.userId); setStep(3); }}
                            className={cn(
                              "w-full flex items-center gap-3 p-2.5 rounded-xl transition-colors text-left",
                              "active:scale-[0.98] active:bg-muted",
                              selectedOpponent === rep.userId ? "bg-primary/10" : "hover:bg-muted/50"
                            )}
                          >
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">{getInitials(rep.name)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium truncate">{rep.name}</span>
                                <YearBadge year={rep.year} />
                              </div>
                              {rep.teamName && (
                                <span className="text-xs text-muted-foreground truncate block">{rep.teamName}</span>
                              )}
                            </div>
                            {rep.isWorking && (
                              <CalendarCheck className="h-4 w-4 text-green-500 shrink-0" />
                            )}
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </button>
                        ))}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Select Teams (Group mode) */}
          {step === 2 && type === 'group' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Red Team (Your Team) */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-red-600">🔴 Your Team</Label>
                  <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 min-h-[100px]">
                    {/* Current user (auto-included) */}
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/20 mb-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">{getInitials(currentUserRep?.name)}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-medium truncate">{currentUserRep?.name || 'You'}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">Captain</span>
                    </div>
                    {/* Selected team A members */}
                    {teamA.map(userId => {
                      const rep = allReps.find(r => r.userId === userId);
                      return (
                        <div key={userId} className="flex items-center gap-2 p-2 rounded-lg bg-background mb-1">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-xs">{getInitials(rep?.name)}</AvatarFallback>
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

                {/* Blue Team (Their Team) */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-blue-600">🔵 Their Team</Label>
                  <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 min-h-[100px]">
                    {teamB.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">Select opponents below</p>
                    )}
                    {teamB.map((userId, index) => {
                      const rep = allReps.find(r => r.userId === userId);
                      return (
                        <div key={userId} className="flex items-center gap-2 p-2 rounded-lg bg-background mb-1">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-xs">{getInitials(rep?.name)}</AvatarFallback>
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
                  {availableForTeamB.map(rep => {
                    const inTeamA = teamA.includes(rep.userId!);
                    const inTeamB = teamB.includes(rep.userId!);
                    
                    return (
                      <div
                        key={rep.userId}
                        className="flex items-center gap-3 p-2 rounded-lg border border-border"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">{getInitials(rep.name)}</AvatarFallback>
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
