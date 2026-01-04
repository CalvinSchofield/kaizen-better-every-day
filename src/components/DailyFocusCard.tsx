import { Target, ChevronRight, Edit2, Zap, Lightbulb, Settings2 } from "lucide-react";
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
import { usePreseasonFP } from "@/hooks/usePreseasonFP";
import { calculateSalesPace } from "@/utils/salesPaceCalculator";
import { useState, useEffect, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { getLearningCurvePrincipleMessage, calculatePaceContext } from "@/utils/learningCurveData";

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
  const { totalFP, totalPRMR, knockingDays } = usePreseasonFP();
  const [isEditing, setIsEditing] = useState(false);

  // Activity goals from localStorage (user-editable)
  const [transitionsGoal, setTransitionsGoal] = useState(3);
  const [presentationsGoal, setPresentationsGoal] = useState(2);
  const [transitionsInput, setTransitionsInput] = useState("3");
  const [presentationsInput, setPresentationsInput] = useState("2");

  // Calculate daily FP+ goal from pace calculator (read-only, derived from Goals setup)
  const { calculatedDailyFpGoal, paceResult } = useMemo(() => {
    if (!goals?.setup_complete || !plannedDays) return { calculatedDailyFpGoal: null, paceResult: null };
    
    const result = calculateSalesPace({
      goals,
      plannedDays,
      knockingDays,
      currentFpPlus: totalFP,
      currentPrmr: totalPRMR,
      efpModeEnabled,
      calculateEfp,
    });
    
    if (!result) return { calculatedDailyFpGoal: null, paceResult: null };
    
    return {
      calculatedDailyFpGoal: Math.round(result.dailyGoal * 10) / 10,
      paceResult: result
    };
  }, [goals, plannedDays, knockingDays, totalFP, totalPRMR, efpModeEnabled, calculateEfp]);

  // Calculate pace context for messaging
  const paceMessage = useMemo(() => {
    if (!paceResult || knockingDays < 18) {
      return "Keep building momentum — progress isn't always linear.";
    }
    
    const currentAverage = knockingDays > 0 ? paceResult.currentProgress / knockingDays : 0;
    
    const paceContext = calculatePaceContext(
      knockingDays,
      paceResult.remainingDailyNeeded,
      currentAverage,
      1,
      false
    );
    
    if (paceContext === 'building-momentum' || paceContext === 'on-track') {
      return `You're on pace for your ${paceResult.isInPreseason ? 'preseason' : 'focus'} goal!`;
    } else if (paceContext === 'stretch') {
      return `Push for your best days — you've got this!`;
    } else if (paceContext === 'very-ambitious') {
      return `Your best weeks may still be ahead. Keep pushing!`;
    }
    
    return null;
  }, [paceResult, knockingDays]);

  // Load activity goals from localStorage on mount
  useEffect(() => {
    const savedTransitions = localStorage.getItem('daily_transitions_goal');
    const savedPresentations = localStorage.getItem('daily_presentations_goal');
    
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
  }, []);

  // Calculate today's progress from sales_log
  const todayTransitions = entry?.transitions || 0;
  const todayPresentations = entry?.presentations || 0;
  
  const { todayFP, todayPRMR } = useMemo(() => {
    if (!entry) return { todayFP: 0, todayPRMR: 0 };
    
    const salesLog = entry.sales_log as Array<{ fp?: number; prmr?: number; upgrade_prmr?: number }> | null;
    if (salesLog && Array.isArray(salesLog) && salesLog.length > 0) {
      let totalFP = 0;
      let totalPRMR = 0;
      salesLog.forEach(sale => {
        totalFP += (sale.fp || 0) + ((sale.upgrade_prmr || 0) / 85);
        totalPRMR += (sale.prmr || 0) + (sale.upgrade_prmr || 0);
      });
      return { todayFP: totalFP, todayPRMR: totalPRMR };
    }
    
    const entryAny = entry as any;
    return { 
      todayFP: entry.fp_plus || 0, 
      todayPRMR: (entry.prmr || 0) + (entryAny.upgrade_prmr || 0) 
    };
  }, [entry]);
  
  const displayValue = efpModeEnabled ? calculateEfp(todayPRMR) : todayFP;
  const displayLabel = efpModeEnabled ? "EFP" : "FP+";
  const fpGoal = calculatedDailyFpGoal ?? 1;

  const transitionsProgress = transitionsGoal > 0 ? Math.min((todayTransitions / transitionsGoal) * 100, 100) : 0;
  const presentationsProgress = presentationsGoal > 0 ? Math.min((todayPresentations / presentationsGoal) * 100, 100) : 0;
  const fpProgress = fpGoal > 0 ? Math.min((displayValue / fpGoal) * 100, 100) : 0;

  const handleSaveGoals = () => {
    const transVal = parseInt(transitionsInput) || 3;
    const presVal = parseInt(presentationsInput) || 2;
    
    setTransitionsGoal(transVal);
    setPresentationsGoal(presVal);
    
    localStorage.setItem('daily_transitions_goal', String(transVal));
    localStorage.setItem('daily_presentations_goal', String(presVal));
    
    setIsEditing(false);
    toast({
      title: "Activity targets updated",
      description: "Your daily activity targets have been saved.",
    });
  };

  const handleCancelEdit = () => {
    setTransitionsInput(String(transitionsGoal));
    setPresentationsInput(String(presentationsGoal));
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
            
            {/* EFP Goal - read-only, from Goals setup */}
            {goals?.setup_complete && (
              <div className="space-y-2 pt-2 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <Label className="text-muted-foreground">{displayLabel} Goal</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/goals')}
                    className="h-6 px-2 text-xs text-primary hover:text-primary"
                  >
                    <Settings2 className="h-3 w-3 mr-1" />
                    Edit in Goals
                  </Button>
                </div>
                <div className="h-11 px-3 flex items-center bg-muted/50 rounded-md border border-input">
                  <span className="text-muted-foreground">{fpGoal.toFixed(1)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Calculated from your preseason goal ÷ planned days
                </p>
              </div>
            )}
            
            <div className="flex gap-2 pt-2">
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
                Save
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* FP+ / EFP - Primary metric (from Goals) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">{displayLabel}</span>
                  {goals?.setup_complete && (
                    <span className="text-[10px] text-muted-foreground/70 bg-muted px-1.5 py-0.5 rounded">
                      from goals
                    </span>
                  )}
                </div>
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

            {/* Pace Context Message */}
            {paceMessage && goals?.setup_complete && (
              <div className="flex items-start gap-2 pt-2 border-t border-border/50">
                <Lightbulb className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {paceMessage}
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
