import { Target, ChevronRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useDailyEntry } from "@/hooks/useDailyEntry";
import { useMemo } from "react";

interface DailyFocusCardProps {
  repData: any;
}

export const DailyFocusCard = ({ repData }: DailyFocusCardProps) => {
  const navigate = useNavigate();
  const { entry } = useDailyEntry();

  // Calculate today's progress
  const todayDoors = entry?.doors_knocked || 0;
  const todayFP = entry?.fp_plus || 0;
  const goalDoors = 50; // Default goal

  const progressPercent = Math.min((todayDoors / goalDoors) * 100, 100);

  // Get yesterday's data from most recent finalized entry
  const yesterdayDoors = 0; // TODO: Fetch from database

  return (
    <Card className="border-2 border-primary/20 shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <CardTitle>Today's Focus</CardTitle>
        </div>
        <CardDescription>Keep the momentum going</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Doors knocked</span>
            <span className="font-semibold text-lg">{todayDoors} / {goalDoors}</span>
          </div>
          <Progress value={progressPercent} className="h-3" />
        </div>

        {yesterdayDoors > 0 && (
          <p className="text-sm text-muted-foreground">
            You knocked {yesterdayDoors} doors yesterday 🔥
          </p>
        )}

        {todayFP > 0 && (
          <div className="bg-primary/10 rounded-lg p-3">
            <p className="text-sm font-semibold text-primary">
              {todayFP} FP+ so far today! 🎉
            </p>
          </div>
        )}

        <Button 
          className="w-full group" 
          onClick={() => navigate("/track")}
        >
          Start Tracking
          <ChevronRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
        </Button>
      </CardContent>
    </Card>
  );
};
