import { Card, CardContent } from "@/components/ui/card";
import { Target } from "lucide-react";

interface SmartTargetsCardProps {
  smartGoals: {
    hasEnoughData: boolean;
    suggestedDoors: number;
    suggestedDMs: number;
    suggestedPitches: number;
    suggestedTransitions: number;
    suggestedPresentations: number;
    dataSource: string;
  };
  dailyGoal: number;
  metricLabel: string;
}

export const SmartTargetsCard = ({ smartGoals, dailyGoal, metricLabel }: SmartTargetsCardProps) => {
  if (!smartGoals.hasEnoughData) return null;

  const items = [
    { value: smartGoals.suggestedDoors, label: 'doors' },
    { value: smartGoals.suggestedDMs, label: 'DMs' },
    { value: smartGoals.suggestedPitches, label: 'pitches' },
    { value: smartGoals.suggestedTransitions, label: 'trans' },
    { value: smartGoals.suggestedPresentations, label: 'pres' },
  ].filter(i => i.value > 0);

  if (items.length === 0) return null;

  return (
    <Card className="border-primary/10 bg-primary/[0.03]">
      <CardContent className="px-4 py-3">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Target className="h-3.5 w-3.5 text-primary/60" />
          <span className="text-xs font-semibold text-foreground/80">Today's Targets</span>
        </div>
        <p className="text-sm font-medium text-foreground/70">
          {items.map((item, i) => (
            <span key={item.label}>
              {i > 0 && <span className="text-muted-foreground/40"> · </span>}
              <span className="text-foreground/90">{item.value}</span>{' '}
              <span className="text-muted-foreground/60">{item.label}</span>
            </span>
          ))}
        </p>
        <p className="text-[10px] text-muted-foreground/50 mt-1">
          Based on your averages to hit {dailyGoal} {metricLabel} today
        </p>
      </CardContent>
    </Card>
  );
};
