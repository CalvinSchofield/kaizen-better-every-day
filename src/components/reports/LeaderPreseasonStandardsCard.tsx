import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { 
  BookOpen, 
  Dumbbell, 
  Phone, 
  Target, 
  Users, 
  Timer, 
  ChevronDown, 
  ChevronUp,
  MessageSquare,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";
import { useAllRepGoals, RepGoals } from "@/hooks/useRepGoals";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface LeaderPreseasonStandardsCardProps {
  accessibleReps: Array<{
    userId: string;
    name: string;
    notionPageId: string;
    phone?: string;
    year?: string;
  }>;
  excludeUserIds?: string[];
}

interface CommitmentStatus {
  key: string;
  label: string;
  current: number;
  goal: number;
  status: "ahead" | "on-track" | "behind" | "no-goal";
  unit?: string;
}

// Strip emojis from names
const getCleanName = (name: string): string => {
  return name.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FEFF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}]/gu, '').trim();
};

// Get first name only
const getFirstName = (name: string): string => {
  const cleanName = getCleanName(name);
  return cleanName.split(' ')[0];
};

// Get display name with smart last name when needed
const getDisplayName = (name: string, allNames: string[]): string => {
  const cleanName = getCleanName(name);
  const firstName = cleanName.split(' ')[0];
  const lastName = cleanName.split(' ').slice(1).join(' ');
  
  // Check if there are duplicates
  const duplicateCount = allNames.filter(n => getFirstName(n) === firstName).length;
  
  if (duplicateCount > 1 && lastName) {
    return `${firstName} ${lastName.charAt(0)}.`;
  }
  return firstName;
};

// Calculate pace status for a commitment
const getBehindStatus = (current: number, goal: number): "ahead" | "on-track" | "behind" | "no-goal" => {
  if (goal === 0) return "no-goal";
  const progress = current / goal;
  
  // Calculate based on time elapsed in preseason
  const summerStart = new Date("2026-04-12");
  const preseasonStart = new Date("2025-09-28");
  const now = new Date();
  
  const totalDays = (summerStart.getTime() - preseasonStart.getTime()) / (1000 * 60 * 60 * 24);
  const elapsedDays = Math.max(0, (now.getTime() - preseasonStart.getTime()) / (1000 * 60 * 60 * 24));
  const expectedProgress = elapsedDays / totalDays;
  
  if (progress >= 1) return "ahead";
  if (progress >= expectedProgress * 0.9) return "on-track";
  return "behind";
};

// Get commitment statuses for a rep
const getCommitmentStatuses = (goals: RepGoals, preseasonFP: number): CommitmentStatus[] => {
  return [
    {
      key: "training",
      label: "Training",
      current: Math.round((goals.training_hours_progress || 0) / 60),
      goal: goals.training_hours_goal || 0,
      status: getBehindStatus(Math.round((goals.training_hours_progress || 0) / 60), goals.training_hours_goal || 0),
      unit: "hrs/wk",
    },
    {
      key: "books",
      label: "Books",
      current: goals.books_progress || 0,
      goal: goals.books_goal || 0,
      status: getBehindStatus(goals.books_progress || 0, goals.books_goal || 0),
    },
    {
      key: "roleplays",
      label: "Role Plays",
      current: goals.role_plays_progress || 0,
      goal: goals.role_plays_goal || 0,
      status: getBehindStatus(goals.role_plays_progress || 0, goals.role_plays_goal || 0),
    },
    {
      key: "mnl",
      label: "MNL",
      current: goals.monday_night_lights_progress || 0,
      goal: goals.monday_night_lights_goal || 0,
      status: getBehindStatus(goals.monday_night_lights_progress || 0, goals.monday_night_lights_goal || 0),
    },
    {
      key: "fp",
      label: "FP+",
      current: preseasonFP,
      goal: goals.preseason_fp_goal || 0,
      status: getBehindStatus(preseasonFP, goals.preseason_fp_goal || 0),
    },
    {
      key: "recruits",
      label: "Recruits",
      current: goals.recruits_with_sale_progress || 0,
      goal: goals.recruits_with_sale_goal || 0,
      status: getBehindStatus(goals.recruits_with_sale_progress || 0, goals.recruits_with_sale_goal || 0),
    },
  ].filter(c => c.goal > 0);
};

// Generate SMS message based on behind commitments
const generateSMSMessage = (firstName: string, behindCommitments: CommitmentStatus[]): string => {
  if (behindCommitments.length === 0) {
    return `Hey ${firstName}! Great work on your preseason standards - keep it up!`;
  }
  
  if (behindCommitments.length === 1) {
    const c = behindCommitments[0];
    switch (c.key) {
      case "training":
        return `Hey ${firstName}! Just checking in on your training hours this week. How's it going? Let me know if you need any support!`;
      case "books":
        return `Hey ${firstName}! Wanted to check in on your reading progress. Which book are you working on right now?`;
      case "roleplays":
        return `Hey ${firstName}! Let's get some role plays scheduled this week. When works for you?`;
      case "mnl":
        return `Hey ${firstName}! Don't forget Monday Night Lights! Are you joining tonight?`;
      case "fp":
        return `Hey ${firstName}! Let's find a blitz or trip for you to get some sales in before summer. What are your thoughts?`;
      case "recruits":
        return `Hey ${firstName}! How's recruiting going? Any leads you're working on that I can help with?`;
      default:
        return `Hey ${firstName}! Checking in on your preseason progress. How can I help you get back on track?`;
    }
  }
  
  const areas = behindCommitments.map(c => c.label).join(", ");
  return `Hey ${firstName}! I noticed you're behind on a few preseason standards (${areas}). Let's chat about how I can help you catch up!`;
};

// Hook to fetch preseason FP for multiple users
const useAllPreseasonFP = (userIds: string[]) => {
  return useQuery({
    queryKey: ['all-preseason-fp', userIds.sort().join(',')],
    queryFn: async () => {
      if (userIds.length === 0) return {};
      
      const { data: entries, error } = await supabase
        .from('daily_entries')
        .select('user_id, fp_plus, prmr')
        .in('user_id', userIds)
        .eq('is_finalized', true)
        .lt('entry_date', '2026-04-12');
      
      if (error) {
        console.error('Error fetching preseason FP:', error);
        return {};
      }
      
      // Sum FP+ per user
      const fpByUser: Record<string, number> = {};
      entries?.forEach(entry => {
        const userId = entry.user_id;
        if (!fpByUser[userId]) fpByUser[userId] = 0;
        fpByUser[userId] += entry.fp_plus || 0;
      });
      
      return fpByUser;
    },
    staleTime: 5 * 60 * 1000,
    enabled: userIds.length > 0,
  });
};

export const LeaderPreseasonStandardsCard = ({
  accessibleReps,
  excludeUserIds = [],
}: LeaderPreseasonStandardsCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [filter, setFilter] = useState<"all" | "behind" | "on-track" | "no-goals">("all");
  
  const { data: allGoals, isLoading: goalsLoading } = useAllRepGoals();
  
  // Get preseason FP for all accessible users
  const userIds = accessibleReps
    .map(r => r.userId)
    .filter(id => !excludeUserIds.includes(id));
  
  const { data: fpByUser } = useAllPreseasonFP(userIds);

  // Build rep data with goals and status
  const repsWithGoals = useMemo(() => {
    if (!allGoals) return [];
    
    const allNames = accessibleReps.map(r => r.name);
    
    return accessibleReps
      .filter(rep => !excludeUserIds.includes(rep.userId))
      .map(rep => {
        const goals = allGoals.find(g => g.user_id === rep.userId);
        const preseasonFP = fpByUser?.[rep.userId] || 0;
        
        if (!goals || !goals.setup_complete) {
          return {
            ...rep,
            displayName: getDisplayName(rep.name, allNames),
            goals: null,
            commitments: [] as CommitmentStatus[],
            behindCount: 0,
            hasGoals: false,
          };
        }
        
        const commitments = getCommitmentStatuses(goals, preseasonFP);
        const behindCount = commitments.filter(c => c.status === "behind").length;
        
        return {
          ...rep,
          displayName: getDisplayName(rep.name, allNames),
          goals,
          commitments,
          behindCount,
          hasGoals: true,
        };
      })
      .sort((a, b) => {
        // Sort by behind count descending, then by name
        if (b.behindCount !== a.behindCount) return b.behindCount - a.behindCount;
        return a.displayName.localeCompare(b.displayName);
      });
  }, [accessibleReps, allGoals, fpByUser, excludeUserIds]);

  // Filter reps based on selected filter
  const filteredReps = useMemo(() => {
    switch (filter) {
      case "behind":
        return repsWithGoals.filter(r => r.behindCount > 0);
      case "on-track":
        return repsWithGoals.filter(r => r.hasGoals && r.behindCount === 0);
      case "no-goals":
        return repsWithGoals.filter(r => !r.hasGoals);
      default:
        return repsWithGoals;
    }
  }, [repsWithGoals, filter]);

  // Summary stats
  const stats = useMemo(() => {
    const withGoals = repsWithGoals.filter(r => r.hasGoals);
    return {
      total: repsWithGoals.length,
      behind: withGoals.filter(r => r.behindCount > 0).length,
      onTrack: withGoals.filter(r => r.behindCount === 0).length,
      noGoals: repsWithGoals.filter(r => !r.hasGoals).length,
    };
  }, [repsWithGoals]);

  // Only show during preseason
  const now = new Date();
  const summerStart = new Date("2026-04-12");
  if (now >= summerStart) return null;
  
  if (goalsLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Preseason Standards</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const visibleReps = isExpanded ? filteredReps : filteredReps.slice(0, 5);

  const handleTextRep = (rep: typeof repsWithGoals[0], e: React.MouseEvent) => {
    e.stopPropagation();
    
    const phone = rep.phone;
    if (!phone) return;
    
    const behindCommitments = rep.commitments.filter(c => c.status === "behind");
    const message = generateSMSMessage(getFirstName(rep.name), behindCommitments);
    
    window.location.href = `sms:${phone.replace(/[^0-9]/g, "")}&body=${encodeURIComponent(message)}`;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Preseason Standards</CardTitle>
          <div className="flex gap-1">
            {stats.behind > 0 && (
              <Badge variant="destructive" className="text-xs">
                {stats.behind} behind
              </Badge>
            )}
            {stats.noGoals > 0 && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                {stats.noGoals} no goals
              </Badge>
            )}
          </div>
        </div>
        
        {/* Filter pills */}
        <div className="flex gap-1 pt-2 flex-wrap">
          {(["all", "behind", "on-track", "no-goals"] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setFilter(f)}
            >
              {f === "all" && `All (${stats.total})`}
              {f === "behind" && `Behind (${stats.behind})`}
              {f === "on-track" && `On Track (${stats.onTrack})`}
              {f === "no-goals" && `No Goals (${stats.noGoals})`}
            </Button>
          ))}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {visibleReps.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No reps match this filter
          </p>
        ) : (
          visibleReps.map((rep) => (
            <div 
              key={rep.userId} 
              className={cn(
                "p-3 rounded-lg border",
                rep.behindCount > 0 && "border-destructive/30 bg-destructive/5",
                !rep.hasGoals && "border-muted bg-muted/30"
              )}
            >
              {/* Rep header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{rep.displayName}</span>
                  {rep.year && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {rep.year}
                    </Badge>
                  )}
                  {rep.behindCount > 0 && (
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                      {rep.behindCount} behind
                    </Badge>
                  )}
                  {rep.hasGoals && rep.behindCount === 0 && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  )}
                </div>
                
                {/* Text button */}
                {rep.phone && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={(e) => handleTextRep(rep, e)}
                    title="Send encouragement text"
                  >
                    <MessageSquare className="h-4 w-4 text-primary" />
                  </Button>
                )}
              </div>
              
              {/* Commitments */}
              {rep.hasGoals && rep.commitments.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {rep.commitments.map((c) => (
                    <div 
                      key={c.key}
                      className={cn(
                        "text-xs p-1.5 rounded text-center",
                        c.status === "behind" && "bg-destructive/10 text-destructive",
                        c.status === "on-track" && "bg-muted",
                        c.status === "ahead" && "bg-green-500/10 text-green-600 dark:text-green-400"
                      )}
                    >
                      <div className="font-medium truncate">{c.label}</div>
                      <div className="text-[10px] opacity-80">
                        {c.current}/{c.goal}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Goals not set up</span>
                </div>
              )}
            </div>
          ))
        )}
        
        {filteredReps.length > 5 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-8 text-muted-foreground"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                Show {filteredReps.length - 5} more
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
