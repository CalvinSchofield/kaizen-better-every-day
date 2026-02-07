import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TrendingUp, Clock, Target, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getInitials } from "@/utils/nameUtils";
import { getFirstName } from "@/components/mygroup/recruit-detail/utils";

interface LeaderStatsCardProps {
  name: string;
  year?: string;
  profilePhotoUrl?: string;
  fp: number;
  prmr: number;
  hoursWorked: number;
  doors: number;
  presentations: number;
  periodLabel: string;
  goalProgress?: number; // 0-100
  onClick?: () => void;
}

const formatHours = (hours: number): string => {
  if (hours <= 0) return '—';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

export const LeaderStatsCard = ({
  name,
  year,
  profilePhotoUrl,
  fp,
  prmr,
  hoursWorked,
  doors,
  presentations,
  periodLabel,
  goalProgress,
  onClick,
}: LeaderStatsCardProps) => {
  return (
    <Card 
      className={cn(
        "p-4 cursor-pointer hover:bg-muted/50 active:scale-[0.99] transition-all",
        "border-primary/20 bg-gradient-to-br from-primary/5 to-transparent"
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12 ring-2 ring-primary/20">
            {profilePhotoUrl ? (
              <AvatarImage src={profilePhotoUrl} alt={name} />
            ) : null}
            <AvatarFallback className="bg-primary/10 text-primary font-medium">
              {getInitials(name)}
            </AvatarFallback>
          </Avatar>
          
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{getFirstName(name)}</span>
              {year && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {year}
                </Badge>
              )}
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-0">
                You
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Your {periodLabel} stats
            </p>
          </div>
        </div>
        
        <ChevronRight className="w-5 h-5 text-muted-foreground/50" />
      </div>
      
      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-2 mt-4">
        <div className="text-center">
          <div className={cn(
            "text-lg font-bold",
            fp > 0 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
          )}>
            {fp > 0 ? fp.toFixed(1) : '—'}
          </div>
          <div className="text-[10px] text-muted-foreground">FP+</div>
        </div>
        
        <div className="text-center">
          <div className="text-lg font-bold">
            {prmr > 0 ? `$${prmr.toLocaleString()}` : '—'}
          </div>
          <div className="text-[10px] text-muted-foreground">PRMR</div>
        </div>
        
        <div className="text-center">
          <div className="text-lg font-bold">
            {formatHours(hoursWorked)}
          </div>
          <div className="text-[10px] text-muted-foreground">Hours</div>
        </div>
        
        <div className="text-center">
          <div className="text-lg font-bold">
            {doors > 0 ? doors : '—'}
          </div>
          <div className="text-[10px] text-muted-foreground">Doors</div>
        </div>
      </div>
      
      {/* Goal progress bar */}
      {goalProgress !== undefined && goalProgress > 0 && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Target className="w-3 h-3" />
              Goal Progress
            </span>
            <span className="font-medium">{Math.round(goalProgress)}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${Math.min(goalProgress, 100)}%` }}
            />
          </div>
        </div>
      )}
    </Card>
  );
};
