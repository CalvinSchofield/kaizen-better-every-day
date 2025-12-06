import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Target, DollarSign, Calculator, Check } from "lucide-react";
import { 
  calculateMustDoFromExpenses, 
  calculateTakeHome, 
  formatCurrency,
  getRentTypes 
} from "@/utils/payscaleCalculator";
import { cn } from "@/lib/utils";

interface GoalSetupWizardProps {
  isRookie: boolean;
  onComplete: (goals: {
    monthlyExpenses: number;
    monthsOff: number;
    rentType: string;
    avgPrmrPerFp: number;
    weeksWorking: number;
    mustDoFpGoal: number;
    willDoFpGoal: number;
    couldDoFpGoal: number;
  }) => void;
  onCancel?: () => void;
}

export const GoalSetupWizard = ({ isRookie, onComplete, onCancel }: GoalSetupWizardProps) => {
  const [step, setStep] = useState(1);
  const totalSteps = isRookie ? 4 : 3;

  // Form state
  const [monthlyExpenses, setMonthlyExpenses] = useState(2000);
  const [monthsOff, setMonthsOff] = useState(4);
  const [rentType, setRentType] = useState('Single');
  const [avgPrmrPerFp, setAvgPrmrPerFp] = useState(85);
  const [weeksWorking, setWeeksWorking] = useState(18);
  const [willDoFpGoal, setWillDoFpGoal] = useState(100);
  const [couldDoFpGoal, setCouldDoFpGoal] = useState(150);

  // Calculated must-do for rookies
  const mustDoFpGoal = isRookie 
    ? calculateMustDoFromExpenses(monthlyExpenses, monthsOff, avgPrmrPerFp, rentType, weeksWorking)
    : 0;

  const getStepTitle = () => {
    if (isRookie) {
      switch (step) {
        case 1: return "Monthly Expenses";
        case 2: return "Work Settings";
        case 3: return "Your Goals";
        case 4: return "Review";
        default: return "";
      }
    } else {
      switch (step) {
        case 1: return "Work Settings";
        case 2: return "Your Goals";
        case 3: return "Review";
        default: return "";
      }
    }
  };

  const handleNext = () => {
    if (step < totalSteps) setStep(step + 1);
    else handleComplete();
  };

  const handleComplete = () => {
    onComplete({
      monthlyExpenses: isRookie ? monthlyExpenses : 0,
      monthsOff,
      rentType,
      avgPrmrPerFp,
      weeksWorking,
      mustDoFpGoal,
      willDoFpGoal,
      couldDoFpGoal,
    });
  };

  const renderStep = () => {
    if (isRookie) {
      switch (step) {
        case 1:
          return (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <DollarSign className="h-12 w-12 mx-auto text-primary mb-3" />
                <p className="text-muted-foreground">
                  Let's figure out your minimum goal based on your expenses
                </p>
              </div>
              
              <div>
                <Label htmlFor="expenses">Monthly Expenses ($)</Label>
                <Input
                  id="expenses"
                  type="number"
                  value={monthlyExpenses}
                  onChange={(e) => setMonthlyExpenses(Number(e.target.value))}
                  className="mt-2 text-lg"
                  placeholder="2000"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Rent, food, car payment, etc.
                </p>
              </div>

              <div>
                <Label htmlFor="monthsOff">Months Off During School</Label>
                <Input
                  id="monthsOff"
                  type="number"
                  value={monthsOff}
                  onChange={(e) => setMonthsOff(Number(e.target.value))}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  How many months you need to cover
                </p>
              </div>

              <div className="rounded-xl bg-primary/10 p-4 text-center">
                <p className="text-sm text-muted-foreground mb-1">You need to cover:</p>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(monthlyExpenses * monthsOff)}
                </p>
              </div>
            </div>
          );
        case 2:
          return renderWorkSettings();
        case 3:
          return renderGoalInputs();
        case 4:
          return renderReview();
        default:
          return null;
      }
    } else {
      switch (step) {
        case 1:
          return renderWorkSettings();
        case 2:
          return renderGoalInputs();
        case 3:
          return renderReview();
        default:
          return null;
      }
    }
  };

  const renderWorkSettings = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <Calculator className="h-12 w-12 mx-auto text-primary mb-3" />
        <p className="text-muted-foreground">
          Configure your work settings for accurate earnings
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="rentType">Rent Type</Label>
          <Select value={rentType} onValueChange={setRentType}>
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {getRentTypes().map((type) => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="weeks">Weeks Working</Label>
          <Input
            id="weeks"
            type="number"
            value={weeksWorking}
            onChange={(e) => setWeeksWorking(Number(e.target.value))}
            className="mt-2"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="avgPrmr">Expected Avg PRMR per FP</Label>
        <Input
          id="avgPrmr"
          type="number"
          value={avgPrmrPerFp}
          onChange={(e) => setAvgPrmrPerFp(Number(e.target.value))}
          className="mt-2"
        />
        <p className="text-xs text-muted-foreground mt-1">
          $85 is typical for most areas
        </p>
      </div>
    </div>
  );

  const renderGoalInputs = () => {
    const mustDoResult = calculateTakeHome({ fpGoal: mustDoFpGoal, avgPrmrPerFp, rentType, weeksWorking });
    const willDoResult = calculateTakeHome({ fpGoal: willDoFpGoal, avgPrmrPerFp, rentType, weeksWorking });
    const couldDoResult = calculateTakeHome({ fpGoal: couldDoFpGoal, avgPrmrPerFp, rentType, weeksWorking });

    return (
      <div className="space-y-6">
        <div className="text-center mb-6">
          <Target className="h-12 w-12 mx-auto text-primary mb-3" />
          <p className="text-muted-foreground">
            Set your summer FP+ goals
          </p>
        </div>

        {isRookie && (
          <div className="rounded-xl bg-amber-500/10 p-4 border border-amber-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-amber-500" />
              <span className="font-semibold text-amber-500">Must Do (Minimum)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{mustDoFpGoal} FP+</span>
              <span className="text-muted-foreground">{formatCurrency(mustDoResult.takeHomePay)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Based on your expenses
            </p>
          </div>
        )}

        <div>
          <Label htmlFor="willDo" className="flex items-center gap-2">
            <span className="text-primary font-semibold">Will Do Goal</span>
            <span className="text-xs text-muted-foreground">(Realistic target)</span>
          </Label>
          <div className="flex items-center gap-3 mt-2">
            <Input
              id="willDo"
              type="number"
              value={willDoFpGoal}
              onChange={(e) => setWillDoFpGoal(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-muted-foreground whitespace-nowrap">
              = {formatCurrency(willDoResult.takeHomePay)}
            </span>
          </div>
        </div>

        <div>
          <Label htmlFor="couldDo" className="flex items-center gap-2">
            <span className="text-green-500 font-semibold">Could Do Goal</span>
            <span className="text-xs text-muted-foreground">(Stretch target)</span>
          </Label>
          <div className="flex items-center gap-3 mt-2">
            <Input
              id="couldDo"
              type="number"
              value={couldDoFpGoal}
              onChange={(e) => setCouldDoFpGoal(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-muted-foreground whitespace-nowrap">
              = {formatCurrency(couldDoResult.takeHomePay)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const renderReview = () => {
    const mustDoResult = calculateTakeHome({ fpGoal: mustDoFpGoal, avgPrmrPerFp, rentType, weeksWorking });
    const willDoResult = calculateTakeHome({ fpGoal: willDoFpGoal, avgPrmrPerFp, rentType, weeksWorking });
    const couldDoResult = calculateTakeHome({ fpGoal: couldDoFpGoal, avgPrmrPerFp, rentType, weeksWorking });

    return (
      <div className="space-y-6">
        <div className="text-center mb-6">
          <Check className="h-12 w-12 mx-auto text-green-500 mb-3" />
          <p className="text-muted-foreground">
            Review your goals
          </p>
        </div>

        <div className="space-y-3">
          {isRookie && mustDoFpGoal > 0 && (
            <div className="rounded-xl bg-amber-500/10 p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-amber-500">Must Do</p>
                <p className="text-lg font-bold">{mustDoFpGoal} FP+</p>
              </div>
              <p className="text-lg font-bold">{formatCurrency(mustDoResult.takeHomePay)}</p>
            </div>
          )}

          <div className="rounded-xl bg-primary/10 p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold text-primary">Will Do</p>
              <p className="text-lg font-bold">{willDoFpGoal} FP+</p>
            </div>
            <p className="text-lg font-bold">{formatCurrency(willDoResult.takeHomePay)}</p>
          </div>

          <div className="rounded-xl bg-green-500/10 p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold text-green-500">Could Do</p>
              <p className="text-lg font-bold">{couldDoFpGoal} FP+</p>
            </div>
            <p className="text-lg font-bold">{formatCurrency(couldDoResult.takeHomePay)}</p>
          </div>
        </div>

        <div className="text-xs text-muted-foreground text-center">
          {rentType} housing • {weeksWorking} weeks • ${avgPrmrPerFp} avg PRMR
        </div>
      </div>
    );
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between mb-2">
          <CardTitle className="text-lg">{getStepTitle()}</CardTitle>
          <span className="text-sm text-muted-foreground">
            Step {step} of {totalSteps}
          </span>
        </div>
        {/* Progress dots */}
        <div className="flex gap-2">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                i < step ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {renderStep()}

        <div className="flex gap-3 pt-4">
          {step > 1 ? (
            <Button
              variant="outline"
              onClick={() => setStep(step - 1)}
              className="flex-1"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          ) : onCancel ? (
            <Button
              variant="outline"
              onClick={onCancel}
              className="flex-1"
            >
              Cancel
            </Button>
          ) : null}
          
          <Button onClick={handleNext} className="flex-1">
            {step === totalSteps ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Save Goals
              </>
            ) : (
              <>
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
