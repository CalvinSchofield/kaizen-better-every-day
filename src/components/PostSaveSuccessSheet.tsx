import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Calendar, BarChart3, Target, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRepGoals } from "@/hooks/useRepGoals";
import { usePlannedDays } from "@/hooks/usePlannedDays";
import { useEffect, useMemo } from "react";
import confetti from "canvas-confetti";

interface PostSaveSuccessSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: {
    doors: number;
    presentations: number;
    closes: number;
    fpPlus: number;
    prmr: number;
  };
  onKeepWorking: () => void;
}

export const PostSaveSuccessSheet = ({ 
  open, 
  onOpenChange, 
  summary,
  onKeepWorking,
}: PostSaveSuccessSheetProps) => {
  const navigate = useNavigate();
  const { goals } = useRepGoals();
  const { plannedDays } = usePlannedDays();
  
  // Calculate daily goal based on remaining planned days
  const dailyGoal = useMemo(() => {
    if (!goals?.setup_complete) return null;
    
    const today = new Date();
    const remainingDays = plannedDays?.filter(d => new Date(d.planned_date) >= today).length || 0;
    
    if (remainingDays === 0) return null;
    
    // Use will_do as default goal tier, fallback to must_do
    const targetGoal = goals.will_do_fp_goal || goals.must_do_fp_goal || 0;
    const currentProgress = goals.preseason_fp_goal || 0; // This should be current FP+ total
    const remaining = Math.max(0, targetGoal - currentProgress);
    
    return remaining / remainingDays;
  }, [goals, plannedDays]);

  const goalMet = dailyGoal !== null && summary.fpPlus >= dailyGoal;
  const progressPercent = dailyGoal ? Math.min(100, (summary.fpPlus / dailyGoal) * 100) : 0;

  // Trigger confetti when goal is met
  useEffect(() => {
    if (open && goalMet) {
      const timer = setTimeout(() => {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9']
        });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open, goalMet]);
  
  const handleDone = () => {
    onOpenChange(false);
  };

  const handleViewCalendar = () => {
    onOpenChange(false);
    navigate('/calendar');
  };

  const handleViewInsights = () => {
    onOpenChange(false);
    navigate('/insights');
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="pb-safe">
        <DrawerHeader className="mb-2">
          <div className="flex items-center gap-2 justify-center mb-2">
            {goalMet ? (
              <Sparkles className="h-8 w-8 text-primary animate-pulse" />
            ) : (
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            )}
          </div>
          <DrawerTitle>
            {goalMet ? "You crushed it!" : "Great work today!"}
          </DrawerTitle>
          <DrawerDescription>
            {goalMet 
              ? "You hit your daily goal!" 
              : "Your entry has been saved successfully."}
          </DrawerDescription>
        </DrawerHeader>
        
        {/* Daily Goal Progress */}
        {dailyGoal !== null && summary.fpPlus > 0 && (
          <div className="px-4 mb-4">
            <div className={`rounded-xl p-4 ${goalMet ? 'bg-primary/10 border border-primary/20' : 'bg-muted/50'}`}>
              <div className="flex items-center gap-2 mb-2">
                <Target className={`h-4 w-4 ${goalMet ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className="text-sm font-medium">Daily Goal Progress</span>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className={`text-2xl font-bold ${goalMet ? 'text-primary' : 'text-foreground'}`}>
                  {summary.fpPlus.toFixed(1)}
                </span>
                <span className="text-muted-foreground">/ {dailyGoal.toFixed(1)} FP+</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${goalMet ? 'bg-primary' : 'bg-muted-foreground/50'}`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              {goalMet && (
                <p className="text-sm text-primary mt-2 font-medium">
                  {summary.fpPlus > dailyGoal 
                    ? `+${(summary.fpPlus - dailyGoal).toFixed(1)} FP+ ahead of pace!` 
                    : "Right on target!"}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Summary Stats */}
        <div className="px-4 mb-6">
          <div className="bg-muted/50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Doors Knocked</span>
              <span className="font-medium">{summary.doors}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Presentations</span>
              <span className="font-medium">{summary.presentations}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Closes</span>
              <span className="font-medium">{summary.closes}</span>
            </div>
            {summary.fpPlus > 0 && (
              <div className="flex justify-between text-sm pt-2 border-t border-border/50">
                <span className="text-muted-foreground">FP+</span>
                <span className="font-semibold text-primary">{summary.fpPlus}</span>
              </div>
            )}
            {summary.prmr > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">PRMR</span>
                <span className="font-semibold text-green-600">${Math.round(summary.prmr)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Info about data */}
        <div className="px-4 text-sm text-muted-foreground mb-6 text-center">
          Your data is now available in Calendar, Insights, and Reports.
        </div>
        
        {/* Quick Actions */}
        <div className="flex gap-3 px-4 mb-4">
          <Button
            onClick={handleViewCalendar}
            variant="outline"
            className="flex-1 py-4"
            size="sm"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Calendar
          </Button>
          <Button
            onClick={handleViewInsights}
            variant="outline"
            className="flex-1 py-4"
            size="sm"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Insights
          </Button>
        </div>

        <div className="flex flex-col gap-3 px-4">
          <Button
            onClick={handleDone}
            variant="default"
            className="w-full py-6 text-lg font-semibold"
            size="lg"
          >
            Done for Today
          </Button>
          <Button
            onClick={() => {
              onKeepWorking();
              onOpenChange(false);
            }}
            variant="ghost"
            className="w-full py-4 text-sm"
          >
            Actually, I need to keep working
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
