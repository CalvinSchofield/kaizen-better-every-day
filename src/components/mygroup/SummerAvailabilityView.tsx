import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sun, AlertCircle, Calendar, MessageSquare, CalendarOff } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { toast } from "sonner";

// Default summer dates
const DEFAULT_SUMMER_START = '2026-04-12';
const DEFAULT_SUMMER_END = '2026-09-27';

// Parse date string as local date
const parseLocalDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

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
  const { data: teamAccess, isLoading: teamAccessLoading } = useTeamAccess();

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

    // Sort: missing dates first, then by start date
    return list.sort((a, b) => {
      const aMissing = !a.personalSummerStart || !a.personalSummerEnd;
      const bMissing = !b.personalSummerStart || !b.personalSummerEnd;
      if (aMissing && !bMissing) return -1;
      if (!aMissing && bMissing) return 1;
      return (a.personalSummerStart || '').localeCompare(b.personalSummerStart || '');
    });
  }, [currentUserData, teamData, teamAccess]);

  const isLoading = teamAccessLoading || teamLoading;

  // Stats
  const missingCount = people.filter(p => !p.personalSummerStart || !p.personalSummerEnd).length;
  const earlyStarters = people.filter(p => p.personalSummerStart && p.personalSummerStart < DEFAULT_SUMMER_START).length;

  if (isLoading) {
    return (
      <div className="space-y-3">
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
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-muted/30 rounded-lg p-2">
          <div className="text-lg font-bold text-foreground">{people.length}</div>
          <div className="text-[10px] text-muted-foreground leading-tight">Total</div>
        </div>
        <div className={`rounded-lg p-2 ${missingCount > 0 ? 'bg-destructive/10' : 'bg-success/10'}`}>
          <div className={`text-lg font-bold ${missingCount > 0 ? 'text-destructive' : 'text-success'}`}>
            {missingCount}
          </div>
          <div className="text-[10px] text-muted-foreground leading-tight">Missing Dates</div>
        </div>
        <div className="bg-primary/10 rounded-lg p-2">
          <div className="text-lg font-bold text-primary">{earlyStarters}</div>
          <div className="text-[10px] text-muted-foreground leading-tight">Early Start</div>
        </div>
      </div>

      {/* People list */}
      <div className="space-y-2">
        {people.map(person => (
          <PersonSummerCard key={person.userId} person={person} />
        ))}
      </div>
    </div>
  );
};

interface PersonSummerCardProps {
  person: PersonSummerInfo;
}

const PersonSummerCard = ({ person }: PersonSummerCardProps) => {
  const hasDates = person.personalSummerStart && person.personalSummerEnd;
  const offDaysCount = person.excludedSummerDays.length;

  // Calculate working days
  const workingDays = useMemo(() => {
    if (!hasDates) return null;
    const start = parseLocalDate(person.personalSummerStart!);
    const end = parseLocalDate(person.personalSummerEnd!);
    const totalDays = differenceInDays(end, start) + 1;
    // Rough estimate excluding Sundays (1/7 of days)
    const workDays = Math.round(totalDays * (6/7)) - offDaysCount;
    return Math.max(0, workDays);
  }, [person, hasDates, offDaysCount]);

  const handleText = () => {
    if (person.phone) {
      window.open(`sms:${person.phone}`, '_blank');
    } else {
      toast.error('No phone number available');
    }
  };

  return (
    <div className={`bg-card border rounded-xl p-3 ${
      hasDates ? 'border-border' : 'border-destructive/30 bg-destructive/5'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Name row */}
          <div className="flex items-center gap-2 mb-1.5">
            <Sun className={`h-4 w-4 ${hasDates ? 'text-warning' : 'text-destructive'}`} />
            <span className="font-medium text-sm truncate">{person.name}</span>
            {person.isSelf && (
              <Badge variant="secondary" className="text-xs">You</Badge>
            )}
            {person.year && (
              <Badge variant="outline" className="text-xs">{person.year}</Badge>
            )}
          </div>

          {/* Dates row */}
          {hasDates ? (
            <div className="flex items-center gap-3 text-xs text-muted-foreground ml-6">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(parseLocalDate(person.personalSummerStart!), 'MMM d')} – {format(parseLocalDate(person.personalSummerEnd!), 'MMM d')}
              </div>
              {offDaysCount > 0 && (
                <div className="flex items-center gap-1 text-warning">
                  <CalendarOff className="h-3 w-3" />
                  {offDaysCount} off
                </div>
              )}
              {workingDays !== null && (
                <span className="text-muted-foreground/70">~{workingDays} work days</span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-destructive ml-6">
              <AlertCircle className="h-3 w-3" />
              Missing summer dates
            </div>
          )}
        </div>

        {/* Text button */}
        {!person.isSelf && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={handleText}
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};
