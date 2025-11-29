import { Target, ChevronRight, Edit2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { useDailyEntry } from "@/hooks/useDailyEntry";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

interface DailyFocusCardProps {
  repData: any;
}

export const DailyFocusCard = ({ repData }: DailyFocusCardProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { entry } = useDailyEntry();
  const [isEditing, setIsEditing] = useState(false);

  // Get goals from localStorage with defaults
  const [transitionsGoal, setTransitionsGoal] = useState(15);
  const [presentationsGoal, setPresentationsGoal] = useState(5);
  const [transitionsInput, setTransitionsInput] = useState("15");
  const [presentationsInput, setPresentationsInput] = useState("5");

  // Load goals from localStorage on mount
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

  // Calculate today's progress
  const todayTransitions = entry?.transitions || 0;
  const todayPresentations = entry?.presentations || 0;

  const transitionsProgress = transitionsGoal > 0 ? Math.min((todayTransitions / transitionsGoal) * 100, 100) : 0;
  const presentationsProgress = presentationsGoal > 0 ? Math.min((todayPresentations / presentationsGoal) * 100, 100) : 0;

  const handleSaveGoals = () => {
    const transVal = parseInt(transitionsInput) || 15;
    const presVal = parseInt(presentationsInput) || 5;
    
    setTransitionsGoal(transVal);
    setPresentationsGoal(presVal);
    
    localStorage.setItem('daily_transitions_goal', String(transVal));
    localStorage.setItem('daily_presentations_goal', String(presVal));
    
    setIsEditing(false);
    toast({
      title: "Goals updated",
      description: "Your daily goals have been saved.",
    });
  };

  const handleCancelEdit = () => {
    setTransitionsInput(String(transitionsGoal));
    setPresentationsInput(String(presentationsGoal));
    setIsEditing(false);
  };

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
        <CardDescription>Keep the momentum going</CardDescription>
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

            <Button 
              className="w-full group" 
              onClick={() => navigate("/track")}
            >
              Start Tracking
              <ChevronRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};
