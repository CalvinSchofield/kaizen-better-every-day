import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, TrendingUp, Minus, Plus } from "lucide-react";
import { useRepGoals } from "@/hooks/useRepGoals";
import { useToast } from "@/hooks/use-toast";

export const WeeklyProgressPromptCard = () => {
  const { goals, updateGoals, hasGoalsAccess, isUpdating } = useRepGoals();
  const { toast } = useToast();
  const [isDismissed, setIsDismissed] = useState(false);
  const [showCard, setShowCard] = useState(false);

  // Track updated values
  const [booksProgress, setBooksProgress] = useState(0);
  const [rolePlaysProgress, setRolePlaysProgress] = useState(0);
  const [mnlProgress, setMnlProgress] = useState(0);
  const [recruitsProgress, setRecruitsProgress] = useState(0);

  // Initialize values from goals
  useEffect(() => {
    if (goals) {
      setBooksProgress(goals.books_progress || 0);
      setRolePlaysProgress(goals.role_plays_progress || 0);
      setMnlProgress(goals.monday_night_lights_progress || 0);
      setRecruitsProgress(goals.recruits_with_sale_progress || 0);
    }
  }, [goals]);

  // Check if we should show the card (Monday evening between 5-9 PM)
  useEffect(() => {
    if (!hasGoalsAccess || !goals?.setup_complete) {
      setShowCard(false);
      return;
    }

    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday
    const hour = now.getHours();

    // Only show on Monday between 5 PM and 9 PM
    if (dayOfWeek !== 1 || hour < 17 || hour >= 21) {
      setShowCard(false);
      return;
    }

    // Check if already dismissed this week
    const lastDismissed = localStorage.getItem('weekly_progress_prompt_dismissed');
    if (lastDismissed) {
      const dismissedDate = new Date(lastDismissed);
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
      startOfWeek.setHours(0, 0, 0, 0);

      if (dismissedDate >= startOfWeek) {
        setShowCard(false);
        return;
      }
    }

    setShowCard(true);
  }, [hasGoalsAccess, goals]);

  const handleDismiss = () => {
    localStorage.setItem('weekly_progress_prompt_dismissed', new Date().toISOString());
    setIsDismissed(true);
    setShowCard(false);
  };

  const handleSave = async () => {
    try {
      await updateGoals({
        books_progress: booksProgress,
        role_plays_progress: rolePlaysProgress,
        monday_night_lights_progress: mnlProgress,
        recruits_with_sale_progress: recruitsProgress,
      });

      toast({
        title: "Progress saved!",
        description: "Keep up the great work this week.",
      });

      handleDismiss();
    } catch (error) {
      toast({
        title: "Save failed",
        description: "Could not save your progress. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (!showCard || isDismissed) return null;

  const Stepper = ({ 
    value, 
    onChange, 
    label,
    goal
  }: { 
    value: number; 
    onChange: (v: number) => void; 
    label: string;
    goal: number;
  }) => (
    <div className="flex items-center justify-between">
      <span className="text-sm">
        {label} <span className="text-muted-foreground">({value}/{goal})</span>
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onChange(Math.max(0, value - 1))}
          disabled={value <= 0}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span className="w-8 text-center font-medium">{value}</span>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onChange(value + 1)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <Card className="mb-6 border-2 border-primary/30 bg-primary/5 shadow-lg">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Weekly Check-In</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          How did last week go? Update your standards progress.
        </p>

        <div className="space-y-3">
          {(goals?.books_goal || 0) > 0 && (
            <Stepper
              label="Books Read"
              value={booksProgress}
              onChange={setBooksProgress}
              goal={goals?.books_goal || 0}
            />
          )}

          {(goals?.role_plays_goal || 0) > 0 && (
            <Stepper
              label="Role Plays"
              value={rolePlaysProgress}
              onChange={setRolePlaysProgress}
              goal={goals?.role_plays_goal || 0}
            />
          )}

          {(goals?.monday_night_lights_goal || 0) > 0 && (
            <Stepper
              label="MNL Calls"
              value={mnlProgress}
              onChange={setMnlProgress}
              goal={goals?.monday_night_lights_goal || 0}
            />
          )}

          {(goals?.recruits_with_sale_goal || 0) > 0 && (
            <Stepper
              label="Recruits w/ Sale"
              value={recruitsProgress}
              onChange={setRecruitsProgress}
              goal={goals?.recruits_with_sale_goal || 0}
            />
          )}
        </div>

        <Button 
          className="w-full" 
          onClick={handleSave}
          disabled={isUpdating}
        >
          {isUpdating ? "Saving..." : "Save & Close"}
        </Button>
      </CardContent>
    </Card>
  );
};
