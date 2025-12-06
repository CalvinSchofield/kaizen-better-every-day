import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, Target, DollarSign, Calculator, Check, HelpCircle, Calendar as CalendarIcon } from "lucide-react";
import { 
  calculateMustDoFromExpenses, 
  calculateTakeHome, 
  formatCurrency 
} from "@/utils/payscaleCalculator";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { differenceInWeeks, parseISO, format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Parse date string as local date (not UTC) to avoid timezone offset issues
const parseLocalDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

// Summer date constraints - using local dates to avoid timezone issues
const SUMMER_START_MIN = parseLocalDate("2026-04-12");
const SUMMER_START_MAX = parseLocalDate("2026-06-01");
const SUMMER_END_MIN = parseLocalDate("2026-08-01");
const SUMMER_END_MAX = parseLocalDate("2026-09-27");

// Housing options with weekly costs
const HOUSING_OPTIONS = [
  { label: "Single Shared", value: 200 },
  { label: "Single Private", value: 385 },
  { label: "Married", value: 415 },
  { label: "Married+", value: 440 },
];

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
    summerStart: string;
    summerEnd: string;
  }) => void;
  onCancel?: () => void;
}

export const GoalSetupWizard = ({ isRookie, onComplete, onCancel }: GoalSetupWizardProps) => {
  const [step, setStep] = useState(1);
  const totalSteps = isRookie ? 4 : 3;

  // Form state - no prefilled values for goals
  const [monthlyExpenses, setMonthlyExpenses] = useState<string>('');
  const [monthsOff, setMonthsOff] = useState<string>('4');
  const [housingOption, setHousingOption] = useState(HOUSING_OPTIONS[0]); // Default Single Shared
  const [avgPrmrPerFp, setAvgPrmrPerFp] = useState<string>('85');
  const [summerStart, setSummerStart] = useState<Date | undefined>(SUMMER_START_MIN);
  const [summerEnd, setSummerEnd] = useState<Date | undefined>(SUMMER_END_MAX);
  const [mustDoFpGoalInput, setMustDoFpGoalInput] = useState<string>('');
  const [willDoFpGoal, setWillDoFpGoal] = useState<string>('');
  const [couldDoFpGoal, setCouldDoFpGoal] = useState<string>('');

  // Date picker states
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

  // Calculate weeks from dates
  const weeksWorking = summerStart && summerEnd 
    ? Math.max(1, differenceInWeeks(summerEnd, summerStart))
    : 18;

  // Calculated must-do for rookies (based on expenses)
  const mustDoFpGoal = isRookie 
    ? calculateMustDoFromExpenses(
        Number(monthlyExpenses) || 0, 
        Number(monthsOff) || 4, 
        Number(avgPrmrPerFp) || 85, 
        housingOption.label, 
        weeksWorking
      )
    : Number(mustDoFpGoalInput) || 0;

  // Handle number input that allows empty strings
  const handleNumberInput = (
    value: string, 
    setter: (val: string) => void
  ) => {
    // Allow empty string or valid numbers
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setter(value);
    }
  };

  // Auto-open end date picker after selecting start date
  const handleStartDateSelect = (date: Date | undefined) => {
    setSummerStart(date);
    setStartDateOpen(false);
    // Small delay for smooth animation
    setTimeout(() => {
      setEndDateOpen(true);
    }, 150);
  };

  const getStepTitle = () => {
    if (isRookie) {
      switch (step) {
        case 1: return "Monthly Expenses";
        case 2: return "Summer Dates";
        case 3: return "Your Goals";
        case 4: return "Review";
        default: return "";
      }
    } else {
      switch (step) {
        case 1: return "Summer Dates";
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
      monthlyExpenses: isRookie ? Number(monthlyExpenses) || 0 : 0,
      monthsOff: Number(monthsOff) || 4,
      rentType: housingOption.label,
      avgPrmrPerFp: Number(avgPrmrPerFp) || 85,
      weeksWorking,
      mustDoFpGoal,
      willDoFpGoal: Number(willDoFpGoal) || 0,
      couldDoFpGoal: Number(couldDoFpGoal) || 0,
      summerStart: summerStart ? format(summerStart, 'yyyy-MM-dd') : '2026-04-12',
      summerEnd: summerEnd ? format(summerEnd, 'yyyy-MM-dd') : '2026-09-27',
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
                  type="text"
                  inputMode="numeric"
                  value={monthlyExpenses}
                  onChange={(e) => handleNumberInput(e.target.value, setMonthlyExpenses)}
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
                  type="text"
                  inputMode="numeric"
                  value={monthsOff}
                  onChange={(e) => handleNumberInput(e.target.value, setMonthsOff)}
                  className="mt-2"
                  placeholder="4"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  How many months you need to cover
                </p>
              </div>

              {monthlyExpenses && (
                <div className="rounded-xl bg-primary/10 p-4 text-center">
                  <p className="text-sm text-muted-foreground mb-1">You need to cover:</p>
                  <p className="text-2xl font-bold text-primary">
                    {formatCurrency((Number(monthlyExpenses) || 0) * (Number(monthsOff) || 4))}
                  </p>
                </div>
              )}
            </div>
          );
        case 2:
          return renderDateSettings();
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
          return renderDateSettings();
        case 2:
          return renderGoalInputs();
        case 3:
          return renderReview();
        default:
          return null;
      }
    }
  };

  const renderDateSettings = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <CalendarIcon className="h-12 w-12 mx-auto text-primary mb-3" />
        <p className="text-muted-foreground">
          When will you be selling?
        </p>
      </div>

      {/* Date Pickers */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Start Date</Label>
          <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal mt-1",
                  !summerStart && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {summerStart ? format(summerStart, "MMM d") : "Select"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={summerStart}
                onSelect={handleStartDateSelect}
                disabled={(date) => date < SUMMER_START_MIN || date > SUMMER_START_MAX}
                defaultMonth={SUMMER_START_MIN}
                className="pointer-events-auto"
              />
              <p className="text-xs text-muted-foreground text-center pb-2">
                Apr 12 - Jun 1, 2026
              </p>
            </PopoverContent>
          </Popover>
        </div>

        <div>
          <Label className="text-xs">End Date</Label>
          <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal mt-1",
                  !summerEnd && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {summerEnd ? format(summerEnd, "MMM d") : "Select"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={summerEnd}
                onSelect={(date) => {
                  setSummerEnd(date);
                  setEndDateOpen(false);
                }}
                disabled={(date) => date < SUMMER_END_MIN || date > SUMMER_END_MAX}
                defaultMonth={SUMMER_END_MIN}
                className="pointer-events-auto"
              />
              <p className="text-xs text-muted-foreground text-center pb-2">
                Aug 1 - Sep 27, 2026
              </p>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="rounded-xl bg-muted/50 p-4 text-center">
        <p className="text-sm text-muted-foreground mb-1">Selling for:</p>
        <p className="text-2xl font-bold">{weeksWorking} weeks</p>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <Label>Housing</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Weekly rent + utilities cost</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {HOUSING_OPTIONS.map((option) => (
            <Button
              key={option.label}
              type="button"
              variant={housingOption.value === option.value ? "default" : "outline"}
              className={cn(
                "h-auto py-2 px-3 flex flex-col items-start",
                housingOption.value === option.value && "ring-2 ring-primary"
              )}
              onClick={() => setHousingOption(option)}
            >
              <span className="text-xs font-medium">{option.label}</span>
              <span className="text-xs opacity-70">${option.value}/wk</span>
            </Button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2">
          <Label htmlFor="avgPrmr">Expected Avg PRMR per FP</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[200px]">
                <p>$85 is typical for most areas. You can adjust this later.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Input
          id="avgPrmr"
          type="text"
          inputMode="numeric"
          value={avgPrmrPerFp}
          onChange={(e) => handleNumberInput(e.target.value, setAvgPrmrPerFp)}
          className="mt-2"
          placeholder="85"
        />
      </div>
    </div>
  );

  const renderGoalInputs = () => {
    const mustDoResult = calculateTakeHome({ 
      fpGoal: mustDoFpGoal, 
      avgPrmrPerFp: Number(avgPrmrPerFp) || 85, 
      rentType: housingOption.label, 
      weeksWorking 
    });
    const willDoResult = calculateTakeHome({ 
      fpGoal: Number(willDoFpGoal) || 0, 
      avgPrmrPerFp: Number(avgPrmrPerFp) || 85, 
      rentType: housingOption.label, 
      weeksWorking 
    });
    const couldDoResult = calculateTakeHome({ 
      fpGoal: Number(couldDoFpGoal) || 0, 
      avgPrmrPerFp: Number(avgPrmrPerFp) || 85, 
      rentType: housingOption.label, 
      weeksWorking 
    });

    return (
      <div className="space-y-6">
        <div className="text-center mb-6">
          <Target className="h-12 w-12 mx-auto text-primary mb-3" />
          <p className="text-muted-foreground">
            Set your summer FP+ goals
          </p>
        </div>

        {isRookie && mustDoFpGoal > 0 && (
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

        {!isRookie && (
          <div>
            <Label htmlFor="mustDo" className="flex items-center gap-2">
              <span className="text-amber-500 font-semibold">Must Do Goal</span>
              <span className="text-xs text-muted-foreground">(Minimum target)</span>
            </Label>
            <div className="flex items-center gap-3 mt-2">
              <Input
                id="mustDo"
                type="text"
                inputMode="numeric"
                value={mustDoFpGoalInput}
                onChange={(e) => handleNumberInput(e.target.value, setMustDoFpGoalInput)}
                className="flex-1"
                placeholder="Enter FP+ goal"
              />
              {mustDoFpGoalInput && (
                <span className="text-muted-foreground whitespace-nowrap text-sm">
                  = {formatCurrency(mustDoResult.takeHomePay)}
                </span>
              )}
            </div>
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
              type="text"
              inputMode="numeric"
              value={willDoFpGoal}
              onChange={(e) => handleNumberInput(e.target.value, setWillDoFpGoal)}
              className="flex-1"
              placeholder="Enter FP+ goal"
            />
            {willDoFpGoal && (
              <span className="text-muted-foreground whitespace-nowrap text-sm">
                = {formatCurrency(willDoResult.takeHomePay)}
              </span>
            )}
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
              type="text"
              inputMode="numeric"
              value={couldDoFpGoal}
              onChange={(e) => handleNumberInput(e.target.value, setCouldDoFpGoal)}
              className="flex-1"
              placeholder="Enter FP+ goal"
            />
            {couldDoFpGoal && (
              <span className="text-muted-foreground whitespace-nowrap text-sm">
                = {formatCurrency(couldDoResult.takeHomePay)}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderReview = () => {
    const mustDoResult = calculateTakeHome({ 
      fpGoal: mustDoFpGoal, 
      avgPrmrPerFp: Number(avgPrmrPerFp) || 85, 
      rentType: housingOption.label, 
      weeksWorking 
    });
    const willDoResult = calculateTakeHome({ 
      fpGoal: Number(willDoFpGoal) || 0, 
      avgPrmrPerFp: Number(avgPrmrPerFp) || 85, 
      rentType: housingOption.label, 
      weeksWorking 
    });
    const couldDoResult = calculateTakeHome({ 
      fpGoal: Number(couldDoFpGoal) || 0, 
      avgPrmrPerFp: Number(avgPrmrPerFp) || 85, 
      rentType: housingOption.label, 
      weeksWorking 
    });

    return (
      <div className="space-y-6">
        <div className="text-center mb-6">
          <Check className="h-12 w-12 mx-auto text-green-500 mb-3" />
          <p className="text-muted-foreground">
            Review your goals
          </p>
        </div>

        <div className="space-y-3">
          {mustDoFpGoal > 0 && (
            <div className="rounded-xl bg-amber-500/10 p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-amber-500">Must Do</p>
                <p className="text-lg font-bold">{mustDoFpGoal} FP+</p>
              </div>
              <p className="text-lg font-bold">{formatCurrency(mustDoResult.takeHomePay)}</p>
            </div>
          )}

          {willDoFpGoal && (
            <div className="rounded-xl bg-primary/10 p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-primary">Will Do</p>
                <p className="text-lg font-bold">{willDoFpGoal} FP+</p>
              </div>
              <p className="text-lg font-bold">{formatCurrency(willDoResult.takeHomePay)}</p>
            </div>
          )}

          {couldDoFpGoal && (
            <div className="rounded-xl bg-green-500/10 p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-green-500">Could Do</p>
                <p className="text-lg font-bold">{couldDoFpGoal} FP+</p>
              </div>
              <p className="text-lg font-bold">{formatCurrency(couldDoResult.takeHomePay)}</p>
            </div>
          )}
        </div>

        <div className="text-xs text-muted-foreground text-center">
          {housingOption.label} (${housingOption.value}/wk) • {weeksWorking} weeks • ${avgPrmrPerFp} avg PRMR
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