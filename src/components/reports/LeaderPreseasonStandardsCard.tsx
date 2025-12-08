import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { useQuery } from "@tanstack/react-query";
import { 
  ChevronDown, 
  ChevronUp,
  ChevronRight,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  ArrowUpDown,
  Users
} from "lucide-react";
import { useAllRepGoals, RepGoals } from "@/hooks/useRepGoals";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { getCommitmentPaceStatus, PaceStatus } from "@/utils/paceCalculator";

type SortOption = "year" | "behind" | "name";

interface LeaderPreseasonStandardsCardProps {
  accessibleReps: Array<{
    userId: string;
    name: string;
    notionPageId: string;
    phone?: string;
    year?: string;
    teamId?: string;
    teamName?: string;
    mgmtGroupId?: string;
    mgmtGroupName?: string;
    isTeamLead?: boolean;
  }>;
  excludeUserIds?: string[];
  accessLevel?: 'area_director' | 'mgmt_group_lead' | 'team_lead' | 'none';
}

interface CommitmentStatus {
  key: string;
  label: string;
  current: number;
  goal: number;
  status: PaceStatus;
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

// Get commitment statuses for a rep - always use FP+ for reports
// Now accepts personalSummerStart per user
const getCommitmentStatuses = (
  goals: RepGoals, 
  preseasonFP: number,
  personalSummerStart: string | null | undefined
): CommitmentStatus[] => {
  return [
    {
      key: "training",
      label: "Training",
      current: goals.training_hours_progress || 0, // Keep in minutes
      goal: (goals.training_hours_goal || 0) * 60, // Convert hours to minutes for calc
      status: getCommitmentPaceStatus("training", goals.training_hours_progress || 0, (goals.training_hours_goal || 0) * 60, personalSummerStart),
      unit: "hrs/wk",
    },
    {
      key: "books",
      label: "Books",
      current: goals.books_progress || 0,
      goal: goals.books_goal || 0,
      status: getCommitmentPaceStatus("books", goals.books_progress || 0, goals.books_goal || 0, personalSummerStart),
    },
    {
      key: "roleplays",
      label: "Role Plays",
      current: goals.role_plays_progress || 0,
      goal: goals.role_plays_goal || 0,
      status: getCommitmentPaceStatus("roleplays", goals.role_plays_progress || 0, goals.role_plays_goal || 0, personalSummerStart),
    },
    {
      key: "mnl",
      label: "MNL",
      current: goals.monday_night_lights_progress || 0,
      goal: goals.monday_night_lights_goal || 0,
      status: getCommitmentPaceStatus("mnl", goals.monday_night_lights_progress || 0, goals.monday_night_lights_goal || 0, personalSummerStart),
    },
    {
      key: "fp",
      label: "FP+",
      current: preseasonFP,
      goal: goals.preseason_fp_goal || 0,
      status: getCommitmentPaceStatus("fp", preseasonFP, goals.preseason_fp_goal || 0, personalSummerStart),
    },
    {
      key: "recruits",
      label: "Recruits",
      current: goals.recruits_with_sale_progress || 0,
      goal: goals.recruits_with_sale_goal || 0,
      status: getCommitmentPaceStatus("recruits", goals.recruits_with_sale_progress || 0, goals.recruits_with_sale_goal || 0, personalSummerStart),
    },
  ].filter(c => c.goal > 0);
};

// Helper to format display values (training is in minutes, display as hours)
const formatCommitmentValue = (key: string, value: number): string | number => {
  if (key === 'training') {
    return Math.round(value / 60);
  }
  if (key === 'fp') {
    return Math.round(value * 10) / 10;
  }
  return value;
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
  accessLevel = 'none',
}: LeaderPreseasonStandardsCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showBehindOnly, setShowBehindOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("year");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  
  const { data: allGoals, isLoading: goalsLoading } = useAllRepGoals();
  
  // Get preseason FP for all accessible users
  const userIds = accessibleReps
    .map(r => r.userId)
    .filter(id => !excludeUserIds.includes(id));
  
  const { data: fpByUser } = useAllPreseasonFP(userIds);

  // Fetch summer configs for all accessible users
  const { data: summerConfigByUser } = useQuery({
    queryKey: ['all-summer-configs', userIds.sort().join(',')],
    queryFn: async () => {
      if (userIds.length === 0) return {};
      
      const { data, error } = await supabase
        .from('season_config')
        .select('user_id, personal_summer_start')
        .in('user_id', userIds);
      
      if (error) {
        console.error('Error fetching summer configs:', error);
        return {};
      }
      
      const configByUser: Record<string, string | null> = {};
      data?.forEach(config => {
        configByUser[config.user_id] = config.personal_summer_start;
      });
      
      return configByUser;
    },
    staleTime: 5 * 60 * 1000,
    enabled: userIds.length > 0,
  });

  // Build rep data with goals and status
  const repsWithGoals = useMemo(() => {
    if (!allGoals) return [];
    
    const allNames = accessibleReps.map(r => r.name);
    
    return accessibleReps
      .filter(rep => !excludeUserIds.includes(rep.userId))
      .map(rep => {
        const goals = allGoals.find(g => g.user_id === rep.userId);
        const preseasonFP = fpByUser?.[rep.userId] || 0;
        const personalSummerStart = summerConfigByUser?.[rep.userId] || null;
        
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
        
        const commitments = getCommitmentStatuses(goals, preseasonFP, personalSummerStart);
        const behindCount = commitments.filter(c => c.status === "behind").length;
        
        return {
          ...rep,
          displayName: getDisplayName(rep.name, allNames),
          goals,
          commitments,
          behindCount,
          hasGoals: true,
        };
      });
  }, [accessibleReps, allGoals, fpByUser, summerConfigByUser, excludeUserIds]);

  // Determine if we should show grouping (MGMT or Area Director level)
  const showGrouping = accessLevel === 'area_director' || accessLevel === 'mgmt_group_lead';

  // Group reps by MGMT group and team
  const groupedReps = useMemo(() => {
    if (!showGrouping) return null;

    const groups: Map<string, {
      mgmtGroupName: string;
      mgmtGroupId: string;
      teams: Map<string, {
        teamName: string;
        teamId: string;
        reps: typeof repsWithGoals;
        behindCount: number;
      }>;
      behindCount: number;
    }> = new Map();

    repsWithGoals.forEach(rep => {
      const mgmtKey = rep.mgmtGroupId || 'ungrouped';
      const mgmtName = rep.mgmtGroupName || 'Other';
      const teamKey = rep.teamId || 'no-team';
      const teamName = rep.teamName || 'No Team';

      if (!groups.has(mgmtKey)) {
        groups.set(mgmtKey, {
          mgmtGroupName: mgmtName,
          mgmtGroupId: mgmtKey,
          teams: new Map(),
          behindCount: 0,
        });
      }

      const mgmtGroup = groups.get(mgmtKey)!;
      if (!mgmtGroup.teams.has(teamKey)) {
        mgmtGroup.teams.set(teamKey, {
          teamName,
          teamId: teamKey,
          reps: [],
          behindCount: 0,
        });
      }

      const team = mgmtGroup.teams.get(teamKey)!;
      team.reps.push(rep);
      if (rep.behindCount > 0) {
        team.behindCount++;
        mgmtGroup.behindCount++;
      }
    });

    return groups;
  }, [repsWithGoals, showGrouping]);

  // Year priority for sorting (Rookie first, then Sophomore, then Vet)
  const getYearPriority = (year?: string): number => {
    if (!year) return 99;
    const y = year.toLowerCase();
    if (y === "rookie") return 1;
    if (y === "sophomore") return 2;
    if (y === "vet") return 3;
    return 99;
  };

  // Sort reps based on selected option
  const sortedReps = useMemo(() => {
    return [...repsWithGoals].sort((a, b) => {
      if (sortBy === "year") {
        const yearDiff = getYearPriority(a.year) - getYearPriority(b.year);
        if (yearDiff !== 0) return yearDiff;
        // Secondary sort by behind count within same year
        return b.behindCount - a.behindCount;
      }
      if (sortBy === "behind") {
        if (b.behindCount !== a.behindCount) return b.behindCount - a.behindCount;
        return a.displayName.localeCompare(b.displayName);
      }
      if (sortBy === "name") {
        return a.displayName.localeCompare(b.displayName);
      }
      return 0;
    });
  }, [repsWithGoals, sortBy]);

  // Filter reps based on toggle
  const filteredReps = useMemo(() => {
    if (showBehindOnly) {
      return sortedReps.filter(r => r.behindCount > 0);
    }
    return sortedReps;
  }, [sortedReps, showBehindOnly]);

  // Filter grouped reps
  const filteredGroupedReps = useMemo(() => {
    if (!groupedReps) return null;

    const filterRep = (rep: typeof repsWithGoals[0]) => {
      if (showBehindOnly) {
        return rep.behindCount > 0;
      }
      return true;
    };

    const result: Map<string, typeof groupedReps extends Map<string, infer V> ? V : never> = new Map();

    groupedReps.forEach((mgmtGroup, mgmtKey) => {
      const filteredTeams: typeof mgmtGroup.teams = new Map();
      let groupBehindCount = 0;

      mgmtGroup.teams.forEach((team, teamKey) => {
        const filteredTeamReps = team.reps.filter(filterRep);
        if (filteredTeamReps.length > 0) {
          const teamBehindCount = filteredTeamReps.filter(r => r.behindCount > 0).length;
          filteredTeams.set(teamKey, {
            ...team,
            reps: filteredTeamReps,
            behindCount: teamBehindCount,
          });
          groupBehindCount += teamBehindCount;
        }
      });

      if (filteredTeams.size > 0) {
        result.set(mgmtKey, {
          ...mgmtGroup,
          teams: filteredTeams,
          behindCount: groupBehindCount,
        });
      }
    });

    return result;
  }, [groupedReps, showBehindOnly]);

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };
  const stats = useMemo(() => {
    const withGoals = repsWithGoals.filter(r => r.hasGoals);
    return {
      total: repsWithGoals.length,
      behind: withGoals.filter(r => r.behindCount > 0).length,
      onTrack: withGoals.filter(r => r.behindCount === 0).length,
      noGoals: repsWithGoals.filter(r => !r.hasGoals).length,
    };
  }, [repsWithGoals]);

  // Get all reps behind with phone numbers - must be before early returns
  const behindRepsWithPhone = useMemo(() => {
    return repsWithGoals.filter(r => r.behindCount > 0 && r.phone);
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


  const handleTextAllBehind = () => {
    if (behindRepsWithPhone.length === 0) return;
    
    // Clean phone numbers
    const phones = behindRepsWithPhone
      .map(r => r.phone?.replace(/[^0-9]/g, ""))
      .filter(Boolean)
      .join(",");
    
    const message = `Hey team! Just checking in on your preseason standards. Let me know if you need any help getting back on track before summer!`;
    
    window.location.href = `sms:${phones}&body=${encodeURIComponent(message)}`;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Preseason Standards</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="h-7 w-[110px] text-xs">
                <ArrowUpDown className="h-3 w-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="year">By Year</SelectItem>
                <SelectItem value="behind">By Behind</SelectItem>
                <SelectItem value="name">By Name</SelectItem>
              </SelectContent>
            </Select>
            {stats.behind > 0 && (
              <Badge variant="destructive" className="text-xs">
                {stats.behind} behind
              </Badge>
            )}
          </div>
        </div>
        
        {/* Toggle and Text All Behind button */}
        <div className="flex items-center justify-between pt-2 gap-3">
          <div className="flex items-center gap-2">
            <Switch
              checked={showBehindOnly}
              onCheckedChange={setShowBehindOnly}
              className="data-[state=checked]:bg-destructive"
            />
            <span className="text-xs text-muted-foreground">
              Behind only
            </span>
          </div>
          
          {behindRepsWithPhone.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs shrink-0 border-primary/50 text-primary"
              onClick={handleTextAllBehind}
            >
              <MessageSquare className="h-3 w-3 mr-1" />
              Text All ({behindRepsWithPhone.length})
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Grouped view for MGMT/Area Director */}
        {showGrouping && filteredGroupedReps ? (
          filteredGroupedReps.size === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No reps match this filter
            </p>
          ) : (
            Array.from(filteredGroupedReps.entries()).map(([mgmtKey, mgmtGroup]) => (
              <div key={mgmtKey} className="space-y-2">
                {/* MGMT Group Header */}
                <div 
                  className="flex items-center justify-between p-2 bg-muted/50 rounded-lg cursor-pointer"
                  onClick={() => toggleGroup(mgmtKey)}
                >
                  <div className="flex items-center gap-2">
                    <ChevronRight className={cn(
                      "h-4 w-4 transition-transform",
                      expandedGroups.has(mgmtKey) && "rotate-90"
                    )} />
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">{mgmtGroup.mgmtGroupName}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {Array.from(mgmtGroup.teams.values()).reduce((sum, t) => sum + t.reps.length, 0)} reps
                    </Badge>
                  </div>
                  {mgmtGroup.behindCount > 0 && (
                    <Badge variant="destructive" className="text-[10px]">
                      {mgmtGroup.behindCount} behind
                    </Badge>
                  )}
                </div>

                {/* Teams within MGMT Group */}
                {expandedGroups.has(mgmtKey) && (
                  <div className="ml-4 space-y-2">
                    {Array.from(mgmtGroup.teams.entries()).map(([teamKey, team]) => (
                      <Collapsible key={teamKey} defaultOpen={team.behindCount > 0}>
                        <CollapsibleTrigger className="w-full">
                          <div className="flex items-center justify-between p-2 bg-secondary/30 rounded-lg">
                            <div className="flex items-center gap-2">
                              <ChevronRight className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">{team.teamName}</span>
                              <Badge variant="outline" className="text-[10px]">
                                {team.reps.length}
                              </Badge>
                            </div>
                            {team.behindCount > 0 && (
                              <Badge variant="destructive" className="text-[10px]">
                                {team.behindCount} behind
                              </Badge>
                            )}
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="mt-2 space-y-2 ml-2">
                            {team.reps.map((rep) => (
                              <RepCard key={rep.userId} rep={rep} onTextRep={handleTextRep} />
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </div>
                )}
              </div>
            ))
          )
        ) : (
          /* Flat list view for Team Leads */
          visibleReps.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No reps match this filter
            </p>
          ) : (
            visibleReps.map((rep) => (
              <RepCard key={rep.userId} rep={rep} onTextRep={handleTextRep} />
            ))
          )
        )}
        
        {!showGrouping && filteredReps.length > 5 && (
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

// Extracted RepCard component for reuse
const RepCard = ({ 
  rep, 
  onTextRep 
}: { 
  rep: {
    userId: string;
    displayName: string;
    name: string;
    phone?: string;
    year?: string;
    behindCount: number;
    hasGoals: boolean;
    commitments: CommitmentStatus[];
  };
  onTextRep: (rep: any, e: React.MouseEvent) => void;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div 
      className={cn(
        "p-3 rounded-lg border cursor-pointer transition-colors",
        rep.behindCount > 0 && "border-destructive/30 bg-destructive/5",
        !rep.hasGoals && "border-muted bg-muted/30",
        isExpanded && "ring-1 ring-primary/20"
      )}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      {/* Rep header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <ChevronRight className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform",
            isExpanded && "rotate-90"
          )} />
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
            onClick={(e) => {
              e.stopPropagation();
              onTextRep(rep, e);
            }}
            title="Send encouragement text"
          >
            <MessageSquare className="h-4 w-4 text-primary" />
          </Button>
        )}
      </div>
      
      {/* Commitments summary (collapsed view) */}
      {!isExpanded && rep.hasGoals && rep.commitments.length > 0 && (
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
                {formatCommitmentValue(c.key, c.current)}/{formatCommitmentValue(c.key, c.goal)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Expanded detail view with progress bars */}
      {isExpanded && rep.hasGoals && rep.commitments.length > 0 && (
        <div className="space-y-3 mt-2">
          {rep.commitments.map((c) => {
            const progress = c.goal > 0 ? Math.min((c.current / c.goal) * 100, 100) : 0;
            
            return (
              <div key={c.key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className={cn(
                    "font-medium",
                    c.status === "behind" && "text-destructive",
                    c.status === "ahead" && "text-green-600 dark:text-green-400"
                  )}>
                    {c.label}
                  </span>
                  <span className={cn(
                    "font-medium",
                    c.status === "behind" && "text-destructive",
                    c.status === "ahead" && "text-green-600 dark:text-green-400"
                  )}>
                    {formatCommitmentValue(c.key, c.current)}/{formatCommitmentValue(c.key, c.goal)}
                    {c.unit && <span className="text-muted-foreground ml-0.5">{c.unit}</span>}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all",
                      c.status === "behind" && "bg-destructive",
                      c.status === "on-track" && "bg-primary",
                      c.status === "ahead" && "bg-green-500"
                    )}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>
                    {c.status === "behind" && "Behind pace"}
                    {c.status === "on-track" && "On track"}
                    {c.status === "ahead" && "Goal reached!"}
                  </span>
                  <span>{Math.round(progress)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {!rep.hasGoals && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Goals not set up</span>
        </div>
      )}
    </div>
  );
};
