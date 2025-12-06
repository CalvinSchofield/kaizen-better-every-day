import { useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Lock, Target, Settings, Calculator } from "lucide-react";
import { useRepGoals } from "@/hooks/useRepGoals";
import { useRepData } from "@/hooks/useRepData";
import { usePreseasonFP } from "@/hooks/usePreseasonFP";
import { GoalSetupWizard } from "@/components/goals/GoalSetupWizard";
import { GoalProgressLadder } from "@/components/goals/GoalProgressLadder";
import { PayscaleCalculator } from "@/components/goals/PayscaleCalculator";
import { CommitmentsTracker } from "@/components/goals/CommitmentsTracker";
import { CalendarPlanningCard } from "@/components/goals/CalendarPlanningCard";
import { GoalTier } from "@/components/goals/GoalTierCard";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";

const Goals = () => {
  const { goals, isLoading, hasGoalsAccess, isRookie, updateGoals, isUpdating } = useRepGoals();
  const { repData } = useRepData();
  const { totalFP: totalFpPlus, totalPRMR } = usePreseasonFP();
  
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [editingTier, setEditingTier] = useState<GoalTier | null>(null);

  // Locked state for pre-Phase 1 rookies
  if (!hasGoalsAccess) {
    return (
      <Layout>
        <div className="p-4 flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="p-4 rounded-full bg-muted mb-4">
            <Lock className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-bold mb-2">Goals & Plan</h2>
          <p className="text-muted-foreground max-w-xs">
            Complete Phase 1 of Ramp to Blitz to unlock goal setting and earnings planning.
          </p>
        </div>
      </Layout>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <Layout>
        <div className="p-4 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </Layout>
    );
  }

  // Setup wizard state (no goals set yet)
  if (!goals?.setup_complete || showSetupWizard) {
    return (
      <Layout>
        <div className="p-4">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Set Your Goals</h1>
            <p className="text-muted-foreground">
              Let's plan your summer success
            </p>
          </div>
          
          <GoalSetupWizard
            isRookie={isRookie}
            onComplete={async (data) => {
              try {
                // Save goals to rep_goals
                await updateGoals({
                  monthly_expenses: data.monthlyExpenses,
                  months_off: data.monthsOff,
                  rent_type: data.rentType,
                  avg_prmr_per_fp: data.avgPrmrPerFp,
                  weeks_working: data.weeksWorking,
                  must_do_fp_goal: data.mustDoFpGoal,
                  will_do_fp_goal: data.willDoFpGoal,
                  could_do_fp_goal: data.couldDoFpGoal,
                  setup_complete: true,
                });

                // Save summer dates to season_config
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                  await supabase
                    .from('season_config')
                    .upsert({
                      user_id: user.id,
                      personal_summer_start: data.summerStart,
                      personal_summer_end: data.summerEnd,
                    }, {
                      onConflict: 'user_id'
                    });
                }

                setShowSetupWizard(false);
                toast.success("Goals saved!");
              } catch (error) {
                toast.error("Failed to save goals");
              }
            }}
            onCancel={goals?.setup_complete ? () => setShowSetupWizard(false) : undefined}
          />
        </div>
      </Layout>
    );
  }

  // Active state with goals
  return (
    <Layout>
      <div className="p-4 space-y-4 pb-24">
        {/* Quick action buttons */}
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowCalculator(true)}
          >
            <Calculator className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowSetupWizard(true)}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>

        {/* Goal Progress Ladder */}
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Summer Goals
          </h2>
          <GoalProgressLadder
            goals={goals}
            currentFpPlus={totalFpPlus}
            currentPrmr={totalPRMR}
            isRookie={isRookie}
            onTierClick={(tier) => setEditingTier(tier)}
          />
        </div>

        {/* Quick Stats */}
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{goals.weeks_working}</p>
                <p className="text-xs text-muted-foreground">Weeks</p>
              </div>
              <div>
                <p className="text-2xl font-bold">${goals.avg_prmr_per_fp}</p>
                <p className="text-xs text-muted-foreground">Avg PRMR</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{goals.rent_type}</p>
                <p className="text-xs text-muted-foreground">Housing</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preseason Commitments */}
        <CommitmentsTracker
          goals={goals}
          preseasonFpProgress={totalFpPlus}
          onUpdateGoals={updateGoals}
          isUpdating={isUpdating}
        />

        {/* Calendar Planning */}
        <CalendarPlanningCard
          mustDoFpGoal={goals.must_do_fp_goal || 0}
          willDoFpGoal={goals.will_do_fp_goal || 0}
          couldDoFpGoal={goals.could_do_fp_goal || 0}
          avgPrmrPerFp={goals.avg_prmr_per_fp || 85}
          rentType={goals.rent_type || 'Single'}
          weeksWorking={goals.weeks_working || 18}
          upgradeFpGoal={goals.upgrade_fp_goal || 0}
          preseasonFpGoal={goals.preseason_fp_goal || 0}
          onPreseasonGoalChange={(goal) => updateGoals({ preseason_fp_goal: goal })}
        />
      </div>

      {/* Calculator Sheet */}
      <Sheet open={showCalculator} onOpenChange={setShowCalculator}>
        <SheetContent side="bottom" className="h-[85vh]">
          <SheetHeader>
            <SheetTitle>Payscale Calculator</SheetTitle>
          </SheetHeader>
          <div className="mt-4 overflow-y-auto">
            <PayscaleCalculator
              initialFpGoal={goals.will_do_fp_goal}
              initialAvgPrmr={goals.avg_prmr_per_fp}
              initialRentType={goals.rent_type}
              initialWeeks={goals.weeks_working}
              initialUpgradeFp={goals.upgrade_fp_goal}
            />
          </div>
        </SheetContent>
      </Sheet>
    </Layout>
  );
};

export default Goals;
