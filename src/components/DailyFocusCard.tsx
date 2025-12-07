import { Target, ChevronRight, Edit2, Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { useDailyEntry } from "@/hooks/useDailyEntry";
import { useRepGoals } from "@/hooks/useRepGoals";
import { usePlannedDays } from "@/hooks/usePlannedDays";
import { useEfpMode } from "@/hooks/useEfpMode";
import { useState, useEffect, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";

interface DailyFocusCardProps {
  repData: any;
}

export const DailyFocusCard = ({ repData }: DailyFocusCardProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { entry } = useDailyEntry();
  const { goals, hasGoalsAccess, isLoading: goalsLoading } = useRepGoals();
  const { plannedDays } = usePlannedDays();
  const { efpModeEnabled, calculateEfp } = useEfpMode();
  const [isEditing, setIsEditing] = useState(false);

  // Get goals from localStorage with defaults (fallback if no goals set)
  const [transitionsGoal, setTransitionsGoal] = useState(3);
  const [presentationsGoal, setPresentationsGoal] = useState(2);
  const [fpGoal, setFpGoal] = useState(1);
  const [transitionsInput, setTransitionsInput] = useState("3");
  const [presentationsInput, setPresentationsInput] = useState("2");
  const [fpInput, setFpInput] = useState("1");

  // Calculate daily FP+ goal from goals & plans
  const calculatedDailyFpGoal = useMemo(() => {
    if (!goals?.setup_complete || !plannedDays) return null;
    
    // Get the active goal tier (use will_do if must_do is met, etc.)
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // Get remaining planned days from today onwards
    const remainingPlannedDays = plannedDays.filter(d => d.planned_date >= todayStr);
    
    if (remainingPlannedDays.length === 0) return null;
    
    // Calculate current FP+ from track data
    const currentFP = entry?.fp_plus || 0;
    
    // Use the "Will Do" goal as the target (middle tier)
    const targetFP = goals.will_do_fp_goal || goals.must_do_fp_goal || 0;
    
    // For now, use a simple daily target based on planned days
    // This is a simplified calculation - actual would consider current progress
    const remainingFP = Math.max(0, targetFP - currentFP);
    const dailyGoal = remainingPlannedDays.length > 0 
      ? Math.round((remainingFP / remainingPlannedDays.length) * 10) / 10
      : 0;
    
    return Math.max(dailyGoal, 0.5); // Minimum 0.5 FP+ per day
  }, [goals, plannedDays, entry]);

  // Load goals from localStorage on mount (fallback for users without goals)
  useEffect(() => {
    const savedTransitions = localStorage.getItem('daily_transitions_goal');
    const savedPresentations = localStorage.getItem('daily_presentations_goal');
    const savedFp = localStorage.getItem('daily_fp_goal');
    
    if (savedTransitions) {
      const val = parseInt(savedTransitions);
      setTransitionsGoal(val);
      setTransitionsInput(String(val));
    }
    if (savedPresentations) {
      const val = parseInt(savedPresentations);
      setPresentationsGoal(val);
      setPresentationsInput(String(val));
    }
    if (savedFp) {
      const val = parseFloat(savedFp);
      setFpGoal(val);
      setFpInput(String(val));
    }
  }, []);

  // Auto-update FP goal when calculated goal is available
  useEffect(() => {
    if (calculatedDailyFpGoal !== null) {
      setFpGoal(calculatedDailyFpGoal);
      setFpInput(String(calculatedDailyFpGoal));
    }
  }, [calculatedDailyFpGoal]);

  // Calculate today's progress
  const todayTransitions = entry?.transitions || 0;
  const todayPresentations = entry?.presentations || 0;
  const todayFP = entry?.fp_plus || 0;
  const todayPRMR = entry?.prmr || 0;
  
  // For EFP mode, show EFP instead of FP+
  const displayValue = efpModeEnabled ? calculateEfp(todayPRMR) : todayFP;
  const displayLabel = efpModeEnabled ? "EFP" : "FP+";

  const transitionsProgress = transitionsGoal > 0 ? Math.min((todayTransitions / transitionsGoal) * 100, 100) : 0;
  const presentationsProgress = presentationsGoal > 0 ? Math.min((todayPresentations / presentationsGoal) * 100, 100) : 0;
  const fpProgress = fpGoal > 0 ? Math.min((displayValue / fpGoal) * 100, 100) : 0;

  const handleSaveGoals = () => {
    const transVal = parseInt(transitionsInput) || 3;
    const presVal = parseInt(presentationsInput) || 2;
    const fpVal = parseFloat(fpInput) || 1;
    
    setTransitionsGoal(transVal);
    setPresentationsGoal(presVal);
    setFpGoal(fpVal);
    
    localStorage.setItem('daily_transitions_goal', String(transVal));
    localStorage.setItem('daily_presentations_goal', String(presVal));
    localStorage.setItem('daily_fp_goal', String(fpVal));
    
    setIsEditing(false);
    toast({
      title: "Goals updated",
      description: "Your daily goals have been saved.",
    });
  };

  const handleCancelEdit = () => {
    setTransitionsInput(String(transitionsGoal));
    setPresentationsInput(String(presentationsGoal));
    setFpInput(String(fpGoal));
    setIsEditing(false);
  };

  // Show CTA to set up goals if no goals are set
  const showGoalsCTA = hasGoalsAccess && !goals?.setup_complete && !goalsLoading;

  if (showGoalsCTA) {
    return (
      <Card className="border-2 border-primary/20 shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <CardTitle>Set Your Goals</CardTitle>
          </div>
          <CardDescription>Plan your summer with your leader</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Set up your summer goals to see personalized daily targets and track your progress toward your earnings goals.
          </p>
          <Button 
            onClick={() => navigate('/goals')} 
            className="w-full"
          >
            <Zap className="h-4 w-4 mr-2" />
            Set Up Goals
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-primary/20 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <CardTitle>Today's Focus</CardTitle>
          </div>
          {!isEditing ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="h-8 text-muted-foreground hover:text-foreground"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
        <CardDescription>
          {goals?.setup_complete 
            ? "Your daily targets based on your goals" 
            : "Simplify your mission today"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isEditing ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="transitions-goal">Transitions Goal</Label>
              <Input
                id="transitions-goal"
                type="number"
                value={transitionsInput}
                onChange={(e) => setTransitionsInput(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="presentations-goal">Presentations Goal</Label>
              <Input
                id="presentations-goal"
                type="number"
                value={presentationsInput}
                onChange={(e) => setPresentationsInput(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fp-goal">{displayLabel} Goal</Label>
              <Input
                id="fp-goal"
                type="number"
                step="0.1"
                value={fpInput}
                onChange={(e) => setFpInput(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleCancelEdit}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleSaveGoals}
              >
                Save Goals
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* FP+ / EFP - Primary metric */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{displayLabel}</span>
                <span className="font-semibold text-lg">{displayValue.toFixed(1)} / {fpGoal.toFixed(1)}</span>
              </div>
              <Progress 
                value={fpProgress} 
                className="h-3"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Transitions</span>
                <span className="font-semibold text-lg">{todayTransitions} / {transitionsGoal}</span>
              </div>
              <Progress value={transitionsProgress} className="h-3" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Presentations</span>
                <span className="font-semibold text-lg">{todayPresentations} / {presentationsGoal}</span>
              </div>
              <Progress value={presentationsProgress} className="h-3" />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
