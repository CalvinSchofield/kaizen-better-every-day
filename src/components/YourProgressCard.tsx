import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp } from "lucide-react";
import { useRepGoals } from "@/hooks/useRepGoals";
import { usePreseasonFP } from "@/hooks/usePreseasonFP";
import { RepData } from "@/hooks/useRepData";

interface YourProgressCardProps {
  repData: RepData;
  personalFP: number;
  ytdPRMR: number;
  efpModeEnabled: boolean;
  loadingFP: boolean;
}

export const YourProgressCard = ({ 
  repData, 
  personalFP, 
  ytdPRMR, 
  efpModeEnabled,
  loadingFP 
}: YourProgressCardProps) => {
  const { goals } = useRepGoals();
  const { totalEFP } = usePreseasonFP();
  
  // Get the preseason goal from rep_goals
  const preseasonFPGoal = goals?.preseason_fp_goal ?? 0;
  
  // Display value based on EFP mode
  const displayValue = efpModeEnabled ? totalEFP : personalFP;
  const displayGoal = preseasonFPGoal;
  const displayLabel = efpModeEnabled ? 'EFP' : 'FP+';
  
  // Calculate progress
  const progress = displayGoal > 0 ? (displayValue / displayGoal) * 100 : 0;
  
  // Format display numbers - round to 1 decimal
  const formatNumber = (n: number) => {
    const rounded = Math.round(n * 10) / 10;
    return rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(1);
  };
  
  return (
    <Card className="mb-6 shadow-lg border-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle>Your Progress</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {displayGoal === 0 ? (
          <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
            <p className="text-sm text-center text-muted-foreground">
              Set your preseason {displayLabel} goal in the <strong>Goals</strong> page
            </p>
          </div>
        ) : (
          <>
            {/* Progress display */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-base font-medium">
                  Preseason {displayLabel}
                </span>
                <span className="text-lg font-bold">
                  {formatNumber(displayValue)} / {formatNumber(displayGoal)}
                </span>
              </div>
              <Progress value={Math.min(progress, 100)} className="h-3" />
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {Math.round(progress)}% of your preseason goal
                </p>
                <p className="text-xs text-muted-foreground">
                  YTD: ${ytdPRMR.toLocaleString()}
                </p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
