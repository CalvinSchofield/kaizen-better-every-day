import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MessageSquare, BookOpen, Clock, Theater, Moon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface RepGoals {
  user_id: string;
  training_hours_goal: number | null;
  training_hours_progress: number | null;
  books_goal: number | null;
  books_progress: number | null;
  role_plays_goal: number | null;
  role_plays_progress: number | null;
  monday_night_lights_goal: number | null;
  monday_night_lights_progress: number | null;
}

interface RepInfo {
  userId: string;
  name: string;
  notionPageId: string;
  year?: string;
  isSelf?: boolean;
}

export const RecruitReadinessView = () => {
  const { data: teamAccess, isLoading: teamAccessLoading } = useTeamAccess();

  // Get current user's rep data
  const { data: currentUserRep } = useQuery({
    queryKey: ['current-user-rep'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data } = await supabase
        .from('reps')
        .select('user_id, name, notion_page_id, year')
        .eq('user_id', user.id)
        .single();
      
      return data;
    },
  });

  // Build list of all user IDs to fetch goals for
  const allUserIds = useMemo(() => {
    const ids: string[] = [];
    
    // Add current user
    if (currentUserRep?.user_id) {
      ids.push(currentUserRep.user_id);
    }
    
    // Add accessible reps from downline
    if (teamAccess?.accessibleReps) {
      teamAccess.accessibleReps.forEach(rep => {
        if (rep.userId && !ids.includes(rep.userId)) {
          ids.push(rep.userId);
        }
      });
    }
    
    return ids;
  }, [currentUserRep, teamAccess]);

  // Fetch rep goals for all users
  const { data: allGoals, isLoading: goalsLoading } = useQuery({
    queryKey: ['readiness-goals', allUserIds],
    queryFn: async () => {
      if (allUserIds.length === 0) return [];
      
      const { data } = await supabase
        .from('rep_goals')
        .select('user_id, training_hours_goal, training_hours_progress, books_goal, books_progress, role_plays_goal, role_plays_progress, monday_night_lights_goal, monday_night_lights_progress')
        .in('user_id', allUserIds);
      
      return (data || []) as RepGoals[];
    },
    enabled: allUserIds.length > 0,
  });

  // Fetch year info for accessible reps
  const { data: repsInfo } = useQuery({
    queryKey: ['reps-year-info', allUserIds],
    queryFn: async () => {
      if (allUserIds.length === 0) return [];
      
      const { data } = await supabase
        .from('reps')
        .select('user_id, name, year')
        .in('user_id', allUserIds);
      
      return data || [];
    },
    enabled: allUserIds.length > 0,
  });

  // Build combined list with behind scores
  const sortedPeople = useMemo(() => {
    if (!allGoals || !repsInfo) return [];

    const goalsMap = new Map(allGoals.map(g => [g.user_id, g]));
    const repsMap = new Map(repsInfo.map(r => [r.user_id, r]));

    const people: (RepInfo & { behindScore: number; goals: RepGoals | null })[] = [];

    // Add current user first
    if (currentUserRep?.user_id) {
      const rep = repsMap.get(currentUserRep.user_id);
      people.push({
        userId: currentUserRep.user_id,
        name: rep?.name || currentUserRep.name,
        notionPageId: currentUserRep.notion_page_id || '',
        year: rep?.year || currentUserRep.year,
        isSelf: true,
        behindScore: 0,
        goals: goalsMap.get(currentUserRep.user_id) || null,
      });
    }

    // Add accessible reps
    teamAccess?.accessibleReps?.forEach(accessibleRep => {
      if (accessibleRep.userId === currentUserRep?.user_id) return; // Skip self, already added
      
      const rep = repsMap.get(accessibleRep.userId);
      people.push({
        userId: accessibleRep.userId,
        name: rep?.name || accessibleRep.name,
        notionPageId: accessibleRep.notionPageId,
        year: rep?.year,
        isSelf: false,
        behindScore: 0,
        goals: goalsMap.get(accessibleRep.userId) || null,
      });
    });

    // Calculate behind scores (excluding FP+)
    people.forEach(person => {
      if (!person.goals) {
        person.behindScore = 0;
        return;
      }

      const g = person.goals;
      let score = 0;
      let count = 0;

      // Training hours
      if (g.training_hours_goal && g.training_hours_goal > 0) {
        const progress = g.training_hours_progress || 0;
        const behind = Math.max(0, (g.training_hours_goal - progress) / g.training_hours_goal);
        score += behind;
        count++;
      }

      // Books
      if (g.books_goal && g.books_goal > 0) {
        const progress = g.books_progress || 0;
        const behind = Math.max(0, (g.books_goal - progress) / g.books_goal);
        score += behind;
        count++;
      }

      // Role plays
      if (g.role_plays_goal && g.role_plays_goal > 0) {
        const progress = g.role_plays_progress || 0;
        const behind = Math.max(0, (g.role_plays_goal - progress) / g.role_plays_goal);
        score += behind;
        count++;
      }

      // MNL
      if (g.monday_night_lights_goal && g.monday_night_lights_goal > 0) {
        const progress = g.monday_night_lights_progress || 0;
        const behind = Math.max(0, (g.monday_night_lights_goal - progress) / g.monday_night_lights_goal);
        score += behind;
        count++;
      }

      person.behindScore = count > 0 ? score / count : 0;
    });

    // Sort by behind score (most behind first)
    return people.sort((a, b) => b.behindScore - a.behindScore);
  }, [allGoals, repsInfo, currentUserRep, teamAccess]);

  const isLoading = teamAccessLoading || goalsLoading;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (sortedPeople.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No team members found
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sortedPeople.map(person => (
        <PersonReadinessCard key={person.userId} person={person} />
      ))}
    </div>
  );
};

interface PersonReadinessCardProps {
  person: RepInfo & { behindScore: number; goals: RepGoals | null };
}

const PersonReadinessCard = ({ person }: PersonReadinessCardProps) => {
  const goals = person.goals;

  const getProgressStatus = (goal: number | null, progress: number | null) => {
    if (!goal || goal === 0) return 'no-goal';
    const pct = ((progress || 0) / goal) * 100;
    if (pct >= 100) return 'complete';
    if (pct >= 70) return 'on-track';
    return 'behind';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete': return 'text-green-600';
      case 'on-track': return 'text-green-500';
      case 'behind': return 'text-amber-500';
      default: return 'text-muted-foreground';
    }
  };

  const getProgressColor = (status: string) => {
    switch (status) {
      case 'complete': return 'bg-green-500';
      case 'on-track': return 'bg-green-500';
      case 'behind': return 'bg-amber-500';
      default: return 'bg-muted';
    }
  };

  const trainingStatus = getProgressStatus(goals?.training_hours_goal, goals?.training_hours_progress);
  const booksStatus = getProgressStatus(goals?.books_goal, goals?.books_progress);
  const rolePlaysStatus = getProgressStatus(goals?.role_plays_goal, goals?.role_plays_progress);
  const mnlStatus = getProgressStatus(goals?.monday_night_lights_goal, goals?.monday_night_lights_progress);

  const behindItems = [
    trainingStatus === 'behind' && 'Training',
    booksStatus === 'behind' && 'Books',
    rolePlaysStatus === 'behind' && 'Role Plays',
    mnlStatus === 'behind' && 'MNL',
  ].filter(Boolean);

  const handleText = () => {
    // Would need phone number lookup - for now just open SMS
    window.open(`sms:`, '_blank');
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium">{person.name}</span>
          {person.isSelf && (
            <Badge variant="secondary" className="text-xs">You</Badge>
          )}
          {person.year && (
            <Badge variant="outline" className="text-xs">{person.year}</Badge>
          )}
        </div>
        {behindItems.length > 0 && (
          <Badge variant="destructive" className="text-xs">
            {behindItems.length} behind
          </Badge>
        )}
      </div>

      {/* Progress rows */}
      <div className="space-y-2">
        {/* Training */}
        <ProgressRow
          icon={<Clock className="h-4 w-4" />}
          label="Training"
          progress={goals?.training_hours_progress || 0}
          goal={goals?.training_hours_goal || 0}
          unit="hrs"
          status={trainingStatus}
          getStatusColor={getStatusColor}
          getProgressColor={getProgressColor}
        />

        {/* Books */}
        <ProgressRow
          icon={<BookOpen className="h-4 w-4" />}
          label="Books"
          progress={goals?.books_progress || 0}
          goal={goals?.books_goal || 0}
          status={booksStatus}
          getStatusColor={getStatusColor}
          getProgressColor={getProgressColor}
        />

        {/* Role Plays */}
        <ProgressRow
          icon={<Theater className="h-4 w-4" />}
          label="Role Plays"
          progress={goals?.role_plays_progress || 0}
          goal={goals?.role_plays_goal || 0}
          status={rolePlaysStatus}
          getStatusColor={getStatusColor}
          getProgressColor={getProgressColor}
        />

        {/* MNL */}
        <ProgressRow
          icon={<Moon className="h-4 w-4" />}
          label="MNL"
          progress={goals?.monday_night_lights_progress || 0}
          goal={goals?.monday_night_lights_goal || 0}
          status={mnlStatus}
          getStatusColor={getStatusColor}
          getProgressColor={getProgressColor}
        />
      </div>

      {/* Action button - only show for others */}
      {!person.isSelf && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={handleText}
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          Text
        </Button>
      )}
    </div>
  );
};

interface ProgressRowProps {
  icon: React.ReactNode;
  label: string;
  progress: number;
  goal: number;
  unit?: string;
  status: string;
  getStatusColor: (status: string) => string;
  getProgressColor: (status: string) => string;
}

const ProgressRow = ({ icon, label, progress, goal, unit, status, getStatusColor, getProgressColor }: ProgressRowProps) => {
  const pct = goal > 0 ? Math.min(100, (progress / goal) * 100) : 0;
  const hasGoal = goal > 0;

  return (
    <div className="flex items-center gap-3">
      <div className={`${getStatusColor(status)}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-muted-foreground">{label}</span>
          <span className={`font-medium ${getStatusColor(status)}`}>
            {hasGoal ? `${progress}/${goal}${unit ? ` ${unit}` : ''}` : 'No goal'}
          </span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all ${getProgressColor(status)}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
};
