import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Sun, AlertCircle, Calendar, MessageSquare, CalendarOff, 
  Users, Clock, Plane, ChevronRight 
} from "lucide-react";
import { format, differenceInDays, isAfter, isBefore, parseISO, isWithinInterval, addDays } from "date-fns";
import { toast } from "sonner";

// Default summer dates
const DEFAULT_SUMMER_START = '2026-04-12';
const DEFAULT_SUMMER_END = '2026-09-27';

// Parse date string as local date
const parseLocalDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

type ViewFilter = 'all' | 'missing' | 'ready' | 'off';

interface PersonSummerInfo {
  userId: string;
  name: string;
  phone?: string;
  personalSummerStart: string | null;
  personalSummerEnd: string | null;
  excludedSummerDays: string[];
  isSelf?: boolean;
  year?: string;
}

export const SummerAvailabilityView = () => {
  const [filter, setFilter] = useState<ViewFilter>('all');
  const { data: teamAccess, isLoading: teamAccessLoading } = useTeamAccess();
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  
  // Check if we're in summer season
  const summerStartDate = parseLocalDate(DEFAULT_SUMMER_START);
  const summerEndDate = parseLocalDate(DEFAULT_SUMMER_END);
  const isSummerActive = isAfter(today, summerStartDate) && isBefore(today, summerEndDate);

  // Get current user's data
  const { data: currentUserData } = useQuery({
    queryKey: ['current-user-summer'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const [repResult, configResult] = await Promise.all([
        supabase.from('reps').select('user_id, name, phone, year').eq('user_id', user.id).single(),
        supabase.from('season_config').select('personal_summer_start, personal_summer_end, excluded_summer_days').eq('user_id', user.id).single(),
      ]);
      
      return {
        rep: repResult.data,
        config: configResult.data,
      };
    },
  });

  // Get all accessible users' summer configs
  const { data: teamData, isLoading: teamLoading } = useQuery({
    queryKey: ['team-summer-availability', teamAccess?.accessibleUserIds],
    queryFn: async () => {
      if (!teamAccess?.accessibleUserIds?.length) return { reps: [], configs: [] };
      
      const [repsResult, configsResult] = await Promise.all([
        supabase.from('reps').select('user_id, name, phone, year').in('user_id', teamAccess.accessibleUserIds),
        supabase.from('season_config').select('user_id, personal_summer_start, personal_summer_end, excluded_summer_days').in('user_id', teamAccess.accessibleUserIds),
      ]);
      
      return {
        reps: repsResult.data || [],
        configs: configsResult.data || [],
      };
    },
    enabled: !!teamAccess?.accessibleUserIds?.length,
  });

  // Build combined list
  const people = useMemo(() => {
    const list: PersonSummerInfo[] = [];
    const configMap = new Map(teamData?.configs?.map(c => [c.user_id, c]) || []);
    const repsMap = new Map(teamData?.reps?.map(r => [r.user_id, r]) || []);

    // Add current user first
    if (currentUserData?.rep) {
      list.push({
        userId: currentUserData.rep.user_id,
        name: currentUserData.rep.name,
        phone: currentUserData.rep.phone || undefined,
        personalSummerStart: currentUserData.config?.personal_summer_start || null,
        personalSummerEnd: currentUserData.config?.personal_summer_end || null,
        excludedSummerDays: currentUserData.config?.excluded_summer_days || [],
        isSelf: true,
        year: currentUserData.rep.year || undefined,
      });
    }

    // Add team members
    teamAccess?.accessibleReps?.forEach(accessibleRep => {
      if (accessibleRep.userId === currentUserData?.rep?.user_id) return; // Skip self
      
      const rep = repsMap.get(accessibleRep.userId);
      const config = configMap.get(accessibleRep.userId);
      
      list.push({
        userId: accessibleRep.userId,
        name: rep?.name || accessibleRep.name,
        phone: rep?.phone || undefined,
        personalSummerStart: config?.personal_summer_start || null,
        personalSummerEnd: config?.personal_summer_end || null,
        excludedSummerDays: config?.excluded_summer_days || [],
        isSelf: false,
        year: rep?.year || undefined,
      });
    });

    return list;
  }, [currentUserData, teamData, teamAccess]);

  // Calculate stats
  const stats = useMemo(() => {
    const missingDates = people.filter(p => !p.personalSummerStart || !p.personalSummerEnd);
    const hasDatesPeople = people.filter(p => p.personalSummerStart && p.personalSummerEnd);
    const earlyStarters = hasDatesPeople.filter(p => p.personalSummerStart! < DEFAULT_SUMMER_START);
    
    // People off today (during summer)
    const offToday = hasDatesPeople.filter(p => {
      // Check if today is within their summer range
      const start = p.personalSummerStart!;
      const end = p.personalSummerEnd!;
      if (todayStr < start || todayStr > end) return true; // Outside their summer = off
      return p.excludedSummerDays.includes(todayStr);
    });

    // Upcoming off days in next 7 days
    const upcomingOffDays = hasDatesPeople.reduce((acc, p) => {
      const upcoming = p.excludedSummerDays.filter(d => {
        const dayDate = parseLocalDate(d);
        return isAfter(dayDate, today) && isBefore(dayDate, addDays(today, 7));
      });
      return acc + upcoming.length;
    }, 0);

    return {
      total: people.length,
      missing: missingDates.length,
      ready: hasDatesPeople.length,
      earlyStarters: earlyStarters.length,
      offToday: offToday.length,
      upcomingOffDays,
    };
  }, [people, todayStr, today]);

  // Filter people
  const filteredPeople = useMemo(() => {
    let filtered = [...people];
    
    switch (filter) {
      case 'missing':
        filtered = filtered.filter(p => !p.personalSummerStart || !p.personalSummerEnd);
        break;
      case 'ready':
        filtered = filtered.filter(p => p.personalSummerStart && p.personalSummerEnd);
        break;
      case 'off':
        filtered = filtered.filter(p => {
          if (!p.personalSummerStart || !p.personalSummerEnd) return false;
          // Off today or has off days scheduled
          if (todayStr < p.personalSummerStart || todayStr > p.personalSummerEnd) return true;
          return p.excludedSummerDays.length > 0;
        });
        break;
    }

    // Sort: missing dates first, then by start date (earliest first)
    return filtered.sort((a, b) => {
      const aMissing = !a.personalSummerStart || !a.personalSummerEnd;
      const bMissing = !b.personalSummerStart || !b.personalSummerEnd;
      if (aMissing && !bMissing) return -1;
      if (!aMissing && bMissing) return 1;
      return (a.personalSummerStart || '9999').localeCompare(b.personalSummerStart || '9999');
    });
  }, [people, filter, todayStr]);

  const isLoading = teamAccessLoading || teamLoading;

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-lg" />
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (people.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No team members found
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Hero summary */}
      <div className="bg-gradient-to-br from-warning/20 to-warning/5 border border-warning/20 rounded-2xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-full bg-warning/20 flex items-center justify-center">
            <Sun className="h-5 w-5 text-warning" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Summer 2026</h3>
            <p className="text-xs text-muted-foreground">
              {format(summerStartDate, 'MMM d')} – {format(summerEndDate, 'MMM d')}
            </p>
          </div>
        </div>
        
        {/* Quick stats row */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`rounded-xl p-2.5 text-center transition-all ${
              filter === 'all' 
                ? 'bg-background shadow-sm ring-1 ring-border' 
                : 'bg-background/50 hover:bg-background/80'
            }`}
          >
            <div className="flex items-center justify-center gap-1.5 mb-0.5">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-lg font-bold text-foreground">{stats.total}</span>
            </div>
            <div className="text-[10px] text-muted-foreground">Team</div>
          </button>
          
          <button
            onClick={() => setFilter('missing')}
            className={`rounded-xl p-2.5 text-center transition-all ${
              filter === 'missing'
                ? 'bg-destructive/10 shadow-sm ring-1 ring-destructive/30'
                : stats.missing > 0 
                  ? 'bg-destructive/5 hover:bg-destructive/10' 
                  : 'bg-background/50'
            }`}
          >
            <div className="flex items-center justify-center gap-1.5 mb-0.5">
              <AlertCircle className={`h-3.5 w-3.5 ${stats.missing > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
              <span className={`text-lg font-bold ${stats.missing > 0 ? 'text-destructive' : 'text-foreground'}`}>
                {stats.missing}
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground">No Dates</div>
          </button>
          
          <button
            onClick={() => setFilter('off')}
            className={`rounded-xl p-2.5 text-center transition-all ${
              filter === 'off'
                ? 'bg-primary/10 shadow-sm ring-1 ring-primary/30'
                : 'bg-background/50 hover:bg-background/80'
            }`}
          >
            <div className="flex items-center justify-center gap-1.5 mb-0.5">
              <CalendarOff className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-lg font-bold text-foreground">{stats.upcomingOffDays}</span>
            </div>
            <div className="text-[10px] text-muted-foreground">Off Days</div>
          </button>
        </div>
      </div>

      {/* Filter indicator */}
      {filter !== 'all' && (
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-muted-foreground">
            Showing {filteredPeople.length} {filter === 'missing' ? 'without dates' : filter === 'off' ? 'with time off' : 'ready'}
          </span>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 text-xs px-2"
            onClick={() => setFilter('all')}
          >
            Clear filter
          </Button>
        </div>
      )}

      {/* People list */}
      <div className="space-y-2">
        {filteredPeople.map(person => (
          <PersonSummerCard key={person.userId} person={person} todayStr={todayStr} />
        ))}
      </div>

      {filteredPeople.length === 0 && (
        <div className="text-center py-6 text-muted-foreground text-sm">
          No one matches this filter
        </div>
      )}
    </div>
  );
};

interface PersonSummerCardProps {
  person: PersonSummerInfo;
  todayStr: string;
}

const PersonSummerCard = ({ person, todayStr }: PersonSummerCardProps) => {
  const hasDates = person.personalSummerStart && person.personalSummerEnd;
  const offDaysCount = person.excludedSummerDays.length;

  // Calculate working days and status
  const { workingDays, status, daysUntilStart, isOffToday, nextOffDay } = useMemo(() => {
    if (!hasDates) {
      return { workingDays: null, status: 'missing', daysUntilStart: null, isOffToday: false, nextOffDay: null };
    }
    
    const start = parseLocalDate(person.personalSummerStart!);
    const end = parseLocalDate(person.personalSummerEnd!);
    const today = parseLocalDate(todayStr);
    const totalDays = differenceInDays(end, start) + 1;
    // Rough estimate excluding Sundays (1/7 of days)
    const workDays = Math.round(totalDays * (6/7)) - offDaysCount;
    
    // Days until they start
    const daysUntil = differenceInDays(start, today);
    
    // Check if off today
    const offToday = todayStr < person.personalSummerStart! || 
                     todayStr > person.personalSummerEnd! ||
                     person.excludedSummerDays.includes(todayStr);
    
    // Find next off day
    const sortedOffDays = [...person.excludedSummerDays].sort();
    const nextOff = sortedOffDays.find(d => d > todayStr);
    
    let statusVal: 'not-started' | 'active' | 'ended' | 'missing' = 'not-started';
    if (todayStr >= person.personalSummerStart! && todayStr <= person.personalSummerEnd!) {
      statusVal = 'active';
    } else if (todayStr > person.personalSummerEnd!) {
      statusVal = 'ended';
    }
    
    return { 
      workingDays: Math.max(0, workDays), 
      status: statusVal, 
      daysUntilStart: daysUntil,
      isOffToday: offToday,
      nextOffDay: nextOff,
    };
  }, [person, hasDates, offDaysCount, todayStr]);

  const handleText = () => {
    if (person.phone) {
      const message = !hasDates 
        ? "Hey! Can you set your summer dates in the app when you get a chance?"
        : "";
      window.open(`sms:${person.phone}${message ? `?body=${encodeURIComponent(message)}` : ''}`, '_blank');
    } else {
      toast.error('No phone number available');
    }
  };

  // Format the date range display
  const getDateDisplay = () => {
    if (!hasDates) return null;
    
    const startFormatted = format(parseLocalDate(person.personalSummerStart!), 'MMM d');
    const endFormatted = format(parseLocalDate(person.personalSummerEnd!), 'MMM d');
    
    return `${startFormatted} – ${endFormatted}`;
  };

  // Get status badge
  const getStatusBadge = () => {
    if (!hasDates) {
      return (
        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
          Needs dates
        </Badge>
      );
    }
    
    if (isOffToday && status === 'active') {
      return (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-warning text-warning">
          Off today
        </Badge>
      );
    }
    
    if (daysUntilStart !== null && daysUntilStart > 0) {
      return (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          Starts in {daysUntilStart}d
        </Badge>
      );
    }
    
    if (status === 'active') {
      return (
        <Badge className="text-[10px] px-1.5 py-0 bg-success/20 text-success border-0">
          Active
        </Badge>
      );
    }
    
    return null;
  };

  return (
    <div className={`bg-card border rounded-xl p-3 transition-all ${
      !hasDates 
        ? 'border-destructive/30 bg-destructive/5' 
        : isOffToday 
          ? 'border-warning/30 bg-warning/5'
          : 'border-border'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Name row with badges */}
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="font-medium text-sm truncate">{person.name}</span>
            {person.isSelf && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">You</Badge>
            )}
            {person.year && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{person.year}</Badge>
            )}
            {getStatusBadge()}
          </div>

          {/* Dates and details row */}
          {hasDates ? (
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>{getDateDisplay()}</span>
              </div>
              
              {offDaysCount > 0 && (
                <div className="flex items-center gap-1 text-warning">
                  <CalendarOff className="h-3 w-3" />
                  <span>{offDaysCount} day{offDaysCount !== 1 ? 's' : ''} off</span>
                </div>
              )}
              
              {workingDays !== null && (
                <span className="text-muted-foreground/70">
                  ~{workingDays} work days
                </span>
              )}
            </div>
          ) : (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              No summer dates set yet
            </p>
          )}

          {/* Upcoming off days preview */}
          {hasDates && offDaysCount > 0 && nextOffDay && (
            <div className="mt-2 text-[11px] text-muted-foreground bg-muted/30 rounded-lg px-2 py-1 inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Next off: {format(parseLocalDate(nextOffDay), 'MMM d')}
            </div>
          )}
        </div>

        {/* Text button */}
        {!person.isSelf && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 shrink-0"
            onClick={handleText}
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};
