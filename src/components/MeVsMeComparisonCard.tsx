import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, Trophy, Target } from 'lucide-react';
import { ComparisonData } from '@/hooks/useHistoricalComparison';
import { cn } from '@/lib/utils';

interface MeVsMeComparisonCardProps {
  comparison: ComparisonData;
  comparisonYear: number;
  metric?: 'fpPlus' | 'all';
  compact?: boolean;
}

export const MeVsMeComparisonCard = ({
  comparison,
  comparisonYear,
  metric = 'all',
  compact = false,
}: MeVsMeComparisonCardProps) => {
  const DeltaIndicator = ({ value, label, suffix = '' }: { value: number; label: string; suffix?: string }) => {
    const isPositive = value > 0;
    const isNeutral = value === 0;
    
    return (
      <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className={cn(
          "flex items-center gap-1 font-medium text-sm",
          isPositive && "text-green-500",
          !isPositive && !isNeutral && "text-destructive",
          isNeutral && "text-muted-foreground"
        )}>
          {isPositive ? (
            <TrendingUp className="h-3 w-3" />
          ) : isNeutral ? (
            <Minus className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          <span>
            {isPositive ? '+' : ''}{typeof value === 'number' && value % 1 !== 0 
              ? value.toFixed(1) 
              : value}{suffix}
          </span>
        </div>
      </div>
    );
  };

  if (compact) {
    const fpDelta = comparison.delta.fpPlus;
    const isWinning = fpDelta > 0;
    
    return (
      <div className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg",
        isWinning ? "bg-green-500/10" : "bg-destructive/10"
      )}>
        {isWinning ? (
          <Trophy className="h-4 w-4 text-green-500" />
        ) : (
          <Target className="h-4 w-4 text-destructive" />
        )}
        <span className="text-sm font-medium">
          {isWinning ? '+' : ''}{fpDelta.toFixed(1)} FP+ vs {comparisonYear}
        </span>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          vs {comparisonYear}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {metric === 'fpPlus' ? (
          <DeltaIndicator value={comparison.delta.fpPlus} label="FP+" />
        ) : (
          <>
            <DeltaIndicator value={comparison.delta.fpPlus} label="FP+" />
            <DeltaIndicator value={comparison.delta.prmr} label="PRMR" suffix="" />
            <DeltaIndicator value={comparison.delta.doors} label="Doors" />
            <DeltaIndicator value={comparison.delta.pitches} label="Pitches" />
            <DeltaIndicator value={comparison.delta.presentations} label="Presentations" />
            <DeltaIndicator value={Math.round(comparison.delta.hours * 10) / 10} label="Hours" suffix="h" />
          </>
        )}
        
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>This year: {comparison.current.fpPlus.toFixed(1)} FP+</span>
            <span>{comparisonYear}: {comparison.historical.fpPlus.toFixed(1)} FP+</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
