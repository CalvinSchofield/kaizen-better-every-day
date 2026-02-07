import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Clock, ChevronDown, ChevronRight, Search, Users, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { getFirstName } from "@/components/mygroup/recruit-detail/utils";
import { getInitials } from "@/utils/nameUtils";

interface RepData {
  userId: string;
  name: string;
  year?: string;
  teamName?: string | null;
  teamId?: string | null;
  workStartTime?: string;
  workEndTime?: string;
  avgStartTime?: string;
  avgEndTime?: string;
  hoursWorked: number;
  doors: number;
  transitions: number;
  presentations: number;
  fp: number;
  prmr: number;
  isWorking?: boolean;
}

interface HierarchicalRepListProps {
  reps: RepData[];
  periodLabel: string;
  isLiveView?: boolean;
  onRepClick?: (userId: string) => void;
}

// Format hours nicely
const formatHours = (hours: number): string => {
  if (hours <= 0) return '—';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

export const HierarchicalRepList = ({
  reps,
  periodLabel,
  isLiveView,
  onRepClick,
}: HierarchicalRepListProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  
  // Filter reps by search
  const filteredReps = useMemo(() => {
    if (!searchQuery.trim()) return reps;
    const query = searchQuery.toLowerCase();
    return reps.filter(rep => 
      rep.name.toLowerCase().includes(query) ||
      rep.teamName?.toLowerCase().includes(query)
    );
  }, [reps, searchQuery]);
  
  // Group reps by team
  const groupedReps = useMemo(() => {
    const groups = new Map<string, { teamName: string; teamId: string | null; reps: RepData[] }>();
    
    filteredReps.forEach(rep => {
      const teamKey = rep.teamId || 'other';
      const teamName = rep.teamName || 'Other';
      
      if (!groups.has(teamKey)) {
        groups.set(teamKey, { teamName, teamId: rep.teamId || null, reps: [] });
      }
      groups.get(teamKey)!.reps.push(rep);
    });
    
    // Sort groups: named teams first (alphabetically), then "Other" last
    const sortedGroups = Array.from(groups.entries()).sort(([keyA, a], [keyB, b]) => {
      if (keyA === 'other') return 1;
      if (keyB === 'other') return -1;
      return a.teamName.localeCompare(b.teamName);
    });
    
    return sortedGroups;
  }, [filteredReps]);
  
  // Expand all by default if searching or only one team
  const effectiveExpanded = useMemo(() => {
    if (searchQuery.trim() || groupedReps.length === 1) {
      return new Set(groupedReps.map(([key]) => key));
    }
    return expandedTeams;
  }, [searchQuery, groupedReps, expandedTeams]);
  
  const toggleTeam = (teamKey: string) => {
    setExpandedTeams(prev => {
      const next = new Set(prev);
      if (next.has(teamKey)) {
        next.delete(teamKey);
      } else {
        next.add(teamKey);
      }
      return next;
    });
  };
  
  // Calculate team stats
  const getTeamStats = (teamReps: RepData[]) => {
    const totalFP = teamReps.reduce((sum, r) => sum + r.fp, 0);
    const totalPRMR = teamReps.reduce((sum, r) => sum + r.prmr, 0);
    const workingCount = teamReps.filter(r => r.isWorking).length;
    return { totalFP, totalPRMR, workingCount };
  };

  const RepRow = ({ rep }: { rep: RepData }) => {
    const displayTime = isLiveView 
      ? (rep.workStartTime ? new Date(rep.workStartTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—')
      : (rep.avgStartTime || '—');
    const displayEndTime = isLiveView
      ? (rep.workEndTime ? new Date(rep.workEndTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : null)
      : (rep.avgEndTime || null);
    
    return (
      <div 
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg bg-muted/30 cursor-pointer",
          "hover:bg-muted/50 active:scale-[0.98] transition-all"
        )}
        onClick={() => onRepClick?.(rep.userId)}
      >
        <Avatar className="h-9 w-9">
          <AvatarFallback className="text-xs bg-primary/10 text-primary">
            {getInitials(rep.name)}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{getFirstName(rep.name)}</span>
            {rep.year && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {rep.year}
              </Badge>
            )}
            {rep.isWorking && (
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {displayTime}
              {displayEndTime && <> – {displayEndTime}</>}
            </span>
            <span className="flex items-center gap-1">
              <Timer className="w-3 h-3" />
              {formatHours(rep.hoursWorked)}
            </span>
          </div>
        </div>
      
        <div className="text-right">
          {rep.fp > 0 ? (
            <div className="flex flex-col items-end">
              <span className="font-bold text-green-600 dark:text-green-400">
                {rep.fp.toFixed(1)} FP+
              </span>
              <span className="text-[10px] text-muted-foreground">
                ${rep.prmr.toLocaleString()}
              </span>
            </div>
          ) : rep.presentations > 0 ? (
            <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/30">
              {rep.presentations} pres
            </Badge>
          ) : rep.doors > 0 ? (
            <span className="text-xs text-muted-foreground">
              {rep.doors} doors
            </span>
          ) : (
            <span className="text-xs text-muted-foreground/50">—</span>
          )}
        </div>
        
        <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search reps..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>
      
      {/* Summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
        <span>{filteredReps.length} reps</span>
        <span>{periodLabel}</span>
      </div>
      
      {/* Grouped list */}
      <div className="space-y-2">
        {groupedReps.map(([teamKey, { teamName, reps: teamReps }]) => {
          const isExpanded = effectiveExpanded.has(teamKey);
          const stats = getTeamStats(teamReps);
          
          // Sort reps: working first, then by FP desc, then by presentations
          const sortedReps = [...teamReps].sort((a, b) => {
            if (a.isWorking !== b.isWorking) return a.isWorking ? -1 : 1;
            if (a.fp !== b.fp) return b.fp - a.fp;
            if (a.presentations !== b.presentations) return b.presentations - a.presentations;
            return b.doors - a.doors;
          });
          
          return (
            <Collapsible
              key={teamKey}
              open={isExpanded}
              onOpenChange={() => toggleTeam(teamKey)}
            >
              <CollapsibleTrigger className="w-full">
                <div className={cn(
                  "flex items-center justify-between p-3 rounded-lg",
                  "bg-muted/50 hover:bg-muted/70 transition-colors"
                )}>
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{teamName}</span>
                    <Badge variant="secondary" className="text-xs">
                      {teamReps.length}
                    </Badge>
                    {stats.workingCount > 0 && isLiveView && (
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[10px] text-green-600">{stats.workingCount}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {stats.totalFP > 0 && (
                      <span className="font-semibold text-green-600 dark:text-green-400 text-sm">
                        {stats.totalFP.toFixed(1)} FP+
                      </span>
                    )}
                  </div>
                </div>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <div className="space-y-1.5 mt-1.5 ml-4">
                  {sortedReps.map(rep => (
                    <RepRow key={rep.userId} rep={rep} />
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
      
      {/* Empty state */}
      {filteredReps.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>{searchQuery ? 'No reps match your search' : 'No activity data'}</p>
        </div>
      )}
    </div>
  );
};
