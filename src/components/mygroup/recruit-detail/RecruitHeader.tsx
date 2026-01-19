import { differenceInDays, parseISO } from "date-fns";
import { Users, Clock, AlertTriangle, Sprout } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Recruit } from "@/hooks/useGroupRecruits";
import { getFirstName, stripEmojis } from "./utils";
import { RecruitRepData } from "./types";

interface RecruitHeaderProps {
  recruit: Recruit;
  isLeaderOfLeaders: boolean;
  recruitRepData?: RecruitRepData | null;
}

export const RecruitHeader = ({ recruit, isLeaderOfLeaders, recruitRepData }: RecruitHeaderProps) => {
  const isStale = recruit.lastContact 
    ? differenceInDays(new Date(), parseISO(recruit.lastContact)) >= 7 
    : true;
    
  const daysSinceContact = recruit.lastContact 
    ? differenceInDays(new Date(), parseISO(recruit.lastContact))
    : null;

  // Get year from rep data or recruit (cast to any since recruits may not have year typed yet)
  const year = recruitRepData?.year || (recruit as any).year;

  // Get stage color
  const getStageColor = () => {
    const stage = recruit.stage?.toLowerCase() || '';
    if (stage.includes('sold') && stage.includes('5+')) return 'bg-emerald-500';
    if (stage.includes('sold')) return 'bg-green-500';
    if (stage.includes('shadow')) return 'bg-blue-500';
    if (stage.includes('signed')) return 'bg-primary';
    if (stage.includes('evaluating')) return 'bg-yellow-500';
    if (stage.includes('reached')) return 'bg-orange-500';
    if (stage.includes('not interested')) return 'bg-muted';
    return 'bg-muted-foreground';
  };

  // Get year display
  const getYearBadge = () => {
    if (!year) return null;
    if (year === 'Rookie' || year === '2025' || year === '2026') {
      return { label: 'Rookie', icon: <Sprout className="h-3 w-3" />, variant: 'secondary' as const };
    }
    if (year === 'Sophomore') {
      return { label: 'Soph', variant: 'outline' as const };
    }
    if (year === 'Vet') {
      return { label: 'Vet', variant: 'outline' as const };
    }
    return null;
  };

  const yearBadge = getYearBadge();

  return (
    <div className="space-y-3">
      {/* Name and Stage */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold truncate">
              {stripEmojis(recruit.name)}
            </h2>
            {yearBadge && (
              <Badge variant={yearBadge.variant} className="text-xs shrink-0 gap-1">
                {yearBadge.icon}
                {yearBadge.label}
              </Badge>
            )}
          </div>
          {/* Team and Recruiter context for leaders of leaders */}
          {isLeaderOfLeaders && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
              {recruit.teamName && (
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {stripEmojis(recruit.teamName)}
                </span>
              )}
              {recruit.recruiterName && recruit.recruiterName !== recruit.teamName && (
                <span className="truncate">
                  via {getFirstName(recruit.recruiterName)}
                </span>
              )}
            </div>
          )}
        </div>
        
        {/* Stage Badge */}
        <div className="flex items-center gap-2 shrink-0">
          <div className={`w-2.5 h-2.5 rounded-full ${getStageColor()}`} />
          <span className="text-sm font-medium">{recruit.stage}</span>
        </div>
      </div>
      
      {/* Last Contact Warning */}
      {isStale && daysSinceContact !== null && (
        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-500/10 rounded-lg px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>
            {daysSinceContact === 0 
              ? 'No contact logged yet' 
              : `Last contacted ${daysSinceContact} days ago`}
          </span>
        </div>
      )}
    </div>
  );
};
