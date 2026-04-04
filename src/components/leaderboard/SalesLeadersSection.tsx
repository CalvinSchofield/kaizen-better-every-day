import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

interface Leader {
  userId: string;
  name: string;
  value: number;
}

interface SalesLeadersSectionProps {
  mostFP: Leader | null;
  mostPRMR: Leader | null;
  mostUpgradeFP: Leader | null;
  mostCloses?: Leader | null;
  currentUserId: string | null;
}

export const SalesLeadersSection = ({
  mostFP,
  mostPRMR,
  mostUpgradeFP,
  mostCloses,
  currentUserId,
}: SalesLeadersSectionProps) => {
  const leaders = [
    { data: mostFP, label: 'Highest FP+', format: (v: number) => `${v.toFixed(1)}`, icon: '🏆' },
    { data: mostPRMR, label: 'Highest PRMR', format: (v: number) => `$${v.toFixed(0)}`, icon: '💰', isGreen: true },
    { data: mostUpgradeFP, label: 'Upgrade FP+', format: (v: number) => `${v.toFixed(1)}`, icon: '⬆️' },
    { data: mostCloses, label: 'Most Closes', format: (v: number) => `${v}`, icon: '🤝' },
  ].filter(l => l.data);

  if (leaders.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 text-primary" />
        <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Sales Leaders</h2>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        {leaders.map(({ data, label, format, icon, isGreen }) => {
          if (!data) return null;
          const isCurrentUser = currentUserId === data.userId;
          
          return (
            <div 
              key={label}
              className={cn(
                "p-4 rounded-xl transition-all",
                isCurrentUser 
                  ? "bg-primary/10 border-2 border-primary/30" 
                  : "bg-card border border-border"
              )}
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-xl">{icon}</span>
                {isCurrentUser && <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">You!</span>}
              </div>
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className={cn(
                "text-2xl font-bold",
                isGreen ? "text-green-600 dark:text-green-500" : "text-foreground"
              )}>
                {format(data.value)}
              </p>
              <p className={cn(
                "text-sm font-medium mt-1 truncate",
                isCurrentUser ? "text-primary" : "text-foreground"
              )}>
                {isCurrentUser ? 'You' : data.name}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
