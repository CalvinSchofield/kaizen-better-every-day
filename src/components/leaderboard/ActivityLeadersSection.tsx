import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface Leader {
  userId: string;
  name: string;
  value: number;
}

interface ActivityLeadersSectionProps {
  mostDoors: Leader | null;
  mostDMs: Leader | null;
  mostPitches: Leader | null;
  mostTransitions: Leader | null;
  mostPresentations: Leader | null;
  currentUserId: string | null;
}

export const ActivityLeadersSection = ({
  mostDoors,
  mostDMs,
  mostPitches,
  mostTransitions,
  mostPresentations,
  currentUserId,
}: ActivityLeadersSectionProps) => {
  const activities = [
    { data: mostDoors, label: 'Most Doors', icon: '🚪' },
    { data: mostDMs, label: 'Most DMs', icon: '🗣️' },
    { data: mostPitches, label: 'Most Pitches', icon: '🎤' },
    { data: mostTransitions, label: 'Most Transitions', icon: '🏠' },
    { data: mostPresentations, label: 'Most Presentations', icon: '🪑' },
  ].filter(a => a.data);

  if (activities.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-amber-500" />
        <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Activity Leaders</h2>
      </div>
      
      <div className="space-y-2">
        {activities.map(({ data, label, icon }) => {
          if (!data) return null;
          const isCurrentUser = currentUserId === data.userId;
          
          return (
            <div 
              key={label}
              className={cn(
                "flex items-center justify-between p-3 rounded-lg transition-all",
                isCurrentUser 
                  ? "bg-primary/10 border border-primary/20" 
                  : "bg-secondary/30"
              )}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{icon}</span>
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className={cn(
                    "text-xs",
                    isCurrentUser ? "text-primary" : "text-muted-foreground"
                  )}>
                    {isCurrentUser ? 'You' : data.name}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold">{data.value}</span>
                {isCurrentUser && <span className="text-primary">⭐</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
