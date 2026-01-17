import { cn } from "@/lib/utils";
import { DoorClosed, MessageSquare, ArrowRight, Home, ShoppingCart } from "lucide-react";

interface FunnelProgressIndicatorProps {
  doors: number;
  dms: number;
  pitches: number;
  transitions: number;
  presentations: number;
  closes: number;
  className?: string;
}

export const FunnelProgressIndicator = ({
  doors,
  dms,
  pitches,
  transitions,
  presentations,
  closes,
  className,
}: FunnelProgressIndicatorProps) => {
  // Determine which is the "furthest" stage with activity
  const stages = [
    { key: 'presentations', value: presentations, label: 'Presentations', icon: Home, color: 'text-orange-500 bg-orange-500/10' },
    { key: 'transitions', value: transitions, label: 'Transitions', icon: ArrowRight, color: 'text-amber-500 bg-amber-500/10' },
    { key: 'pitches', value: pitches, label: 'Pitches', icon: MessageSquare, color: 'text-blue-500 bg-blue-500/10' },
    { key: 'dms', value: dms, label: 'Decision Makers', icon: MessageSquare, color: 'text-indigo-500 bg-indigo-500/10' },
    { key: 'doors', value: doors, label: 'Doors', icon: DoorClosed, color: 'text-slate-500 bg-slate-500/10' },
  ];
  
  // Find the furthest stage with activity (presentations > transitions > pitches, etc.)
  const activeStage = stages.find(s => s.value > 0);
  
  // If no activity at all
  if (!activeStage) {
    return (
      <div className={cn("flex items-center gap-2 text-muted-foreground/60", className)}>
        <DoorClosed className="w-4 h-4" />
        <span className="text-sm">Waiting for activity...</span>
      </div>
    );
  }

  // Build the funnel summary
  const FunnelStat = ({ value, label, isHighlight }: { value: number; label: string; isHighlight?: boolean }) => (
    <div className={cn(
      "text-center px-2",
      isHighlight && "font-medium"
    )}>
      <div className={cn(
        "text-lg font-bold",
        isHighlight ? "text-primary" : "text-foreground"
      )}>
        {value}
      </div>
      <div className="text-[10px] text-muted-foreground truncate">{label}</div>
    </div>
  );

  return (
    <div className={cn("space-y-2", className)}>
      {/* Primary highlight - furthest funnel stage */}
      <div className={cn(
        "flex items-center gap-2 p-2.5 rounded-lg",
        activeStage.color
      )}>
        <activeStage.icon className="w-5 h-5" />
        <span className="font-medium">
          {activeStage.value} {activeStage.label}
        </span>
        <span className="text-xs text-muted-foreground ml-auto">
          No sales yet
        </span>
      </div>
      
      {/* Funnel breakdown row */}
      <div className="flex items-center justify-between bg-muted/30 rounded-lg p-2">
        <FunnelStat value={doors} label="Doors" />
        <ArrowRight className="w-3 h-3 text-muted-foreground/50" />
        <FunnelStat value={dms} label="DMs" />
        <ArrowRight className="w-3 h-3 text-muted-foreground/50" />
        <FunnelStat value={transitions} label="Trans" isHighlight={transitions > 0 && presentations === 0} />
        <ArrowRight className="w-3 h-3 text-muted-foreground/50" />
        <FunnelStat value={presentations} label="Pres" isHighlight={presentations > 0} />
      </div>
    </div>
  );
};
