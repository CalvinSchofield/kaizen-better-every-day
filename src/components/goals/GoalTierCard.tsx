import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Check, Target, Zap, Trophy, ArrowRight } from "lucide-react";
import { formatCurrency, calculateTakeHome } from "@/utils/payscaleCalculator";
import { cn } from "@/lib/utils";

export type GoalTier = 'mustDo' | 'willDo' | 'couldDo';

interface GoalTierCardProps {
  tier: GoalTier;
  fpGoal: number;
  currentFpPlus: number;
  avgPrmrPerFp?: number;
  upgradeFpGoal?: number;
  rentType?: string;
  weeksWorking?: number;
  isCurrentTarget?: boolean;
  isComplete?: boolean;
  onClick?: () => void;
}

const tierConfig: Record<GoalTier, { label: string; icon: typeof Target; color: string; bgColor: string }> = {
  mustDo: { 
    label: 'Must Do', 
    icon: Target, 
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
  },
  willDo: { 
    label: 'Will Do', 
    icon: Zap, 
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  couldDo: { 
    label: 'Could Do', 
    icon: Trophy, 
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
  },
};

export const GoalTierCard = ({
  tier,
  fpGoal,
  currentFpPlus,
  avgPrmrPerFp = 85,
  upgradeFpGoal = 0,
  rentType = 'Single',
  weeksWorking = 18,
  isCurrentTarget = false,
  isComplete = false,
  onClick,
}: GoalTierCardProps) => {
  const config = tierConfig[tier];
  const Icon = config.icon;

  const result = calculateTakeHome({
    fpGoal,
    avgPrmrPerFp,
    upgradeFpGoal,
    rentType,
    weeksWorking,
  });

  const progress = fpGoal > 0 ? Math.min((currentFpPlus / fpGoal) * 100, 100) : 0;
  const remaining = Math.max(fpGoal - currentFpPlus, 0);

  if (fpGoal === 0) return null;

  return (
    <Card 
      className={cn(
        "transition-all duration-200 cursor-pointer",
        isComplete && "opacity-60",
        isCurrentTarget && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        !isComplete && !isCurrentTarget && "hover:shadow-md"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={cn("p-2 rounded-lg", config.bgColor)}>
              {isComplete ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Icon className={cn("h-4 w-4", config.color)} />
              )}
            </div>
            <div>
              <p className={cn("font-semibold text-sm", config.color)}>
                {config.label}
              </p>
              <p className="text-xs text-muted-foreground">
                {fpGoal} FP+
              </p>
            </div>
          </div>
          
          <div className="text-right">
            <p className="font-bold text-lg">{formatCurrency(result.takeHomePay)}</p>
            <p className="text-xs text-muted-foreground">
              ${result.rate}/PRMR
            </p>
          </div>
        </div>

        {/* Progress Section */}
        {isCurrentTarget && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{currentFpPlus.toFixed(1)} FP+</span>
              {remaining > 0 ? (
                <span className="flex items-center gap-1">
                  <ArrowRight className="h-3 w-3" />
                  {remaining.toFixed(1)} to go
                </span>
              ) : (
                <span className="text-green-500 font-medium">Complete!</span>
              )}
            </div>
          </div>
        )}

        {isComplete && !isCurrentTarget && (
          <div className="flex items-center gap-1 text-xs text-green-500">
            <Check className="h-3 w-3" />
            <span>Achieved</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
