import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ArrowRight, Target, DollarSign, Calculator, Check, HelpCircle, Calendar as CalendarIcon, MapPin, Loader2, Heart, Minus, Plus, BookOpen, Timer, Dumbbell, Phone } from "lucide-react";
import { 
  calculateMustDoFromExpenses, 
  calculateTakeHome, 
  formatCurrency 
} from "@/utils/payscaleCalculator";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { differenceInDays, format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { formatBlitzDate, parseDateAsLocal } from "@/utils/blitzDateUtils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useBlitzes } from "@/hooks/useBlitzes";
import { Checkbox } from "@/components/ui/checkbox";
import { useEfpMode } from "@/hooks/useEfpMode";
import { PayEstimateDisclaimer } from "@/components/PayEstimateDisclaimer";

// Parse date string as local date (not UTC) to avoid timezone offset issues
const parseLocalDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const SUMMER_START_MIN = parseLocalDate("2026-04-12");
const SUMMER_START_MAX = parseLocalDate("2026-06-01");
const SUMMER_END_MIN = parseLocalDate("2026-08-01");
const SUMMER_END_MAX = parseLocalDate("2026-09-27");

const HOUSING_OPTIONS = [
  { label: "Single Shared", value: 200 },
  { label: "Single Private", value: 385 },
  { label: "Married", value: 415 },
  { label: "Married+", value: 440 },
];

interface GoalSetupWizardProps {
  isRookie: boolean;
  committedBlitzIds?: string[];
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
    preseasonFpGoal: number;
    selectedBlitzIds?: string[];
    purposeStatement?: string;
    booksGoal?: number;
    trainingHoursGoal?: number;
    rolePlaysGoal?: number;
    mnlGoal?: number;
  }) => void;
  onCancel?: () => void;
}

export const GoalSetupWizard = ({ 
  isRookie, 
  committedBlitzIds = [], 
  onComplete, 
  onCancel 
}: GoalSetupWizardProps) => {
  const [step, setStep] = useState(1);
  
  const { allBlitzes, loading: blitzesLoading } = useBlitzes();
  const [selectedBlitzIds, setSelectedBlitzIds] = useState<string[]>(committedBlitzIds);

  const { efpModeEnabled } = useEfpMode();
  const metricLabel = efpModeEnabled ? 'EFP' : 'FP+';

  const isCurrentlySummer = new Date() >= SUMMER_START_MIN;
  
  // Calculate total steps
  // Rookies pre-summer: WHY → Expenses → Dates → Goals → Preseason → Commitments → Blitzes → Review (8)
  // Rookies summer: WHY → Expenses → Dates → Goals → Blitzes → Review (6)
  // Vets: Dates → Goals → [Preseason if not summer] → Review (3 or 4)
  const totalSteps = isRookie 
    ? (isCurrentlySummer ? 6 : 8) 
    : (isCurrentlySummer ? 3 : 4);

  // Form state
  const [purposeStatement, setPurposeStatement] = useState('');
  const [monthlyExpenses, setMonthlyExpenses] = useState<string>('');
  const [monthsOff, setMonthsOff] = useState<string>('8');
  const [housingOption, setHousingOption] = useState(HOUSING_OPTIONS[0]);
  const avgPrmrPerFp = 85;
  const [summerStart, setSummerStart] = useState<Date | undefined>(SUMMER_START_MIN);
  const [summerEnd, setSummerEnd] = useState<Date | undefined>(SUMMER_END_MAX);
  const [mustDoFpGoalInput, setMustDoFpGoalInput] = useState<string>('');
  const [willDoFpGoal, setWillDoFpGoal] = useState<string>('');
  const [couldDoFpGoal, setCouldDoFpGoal] = useState<string>('');
  const [preseasonFpGoal, setPreseasonFpGoal] = useState<string>('5');
  
  // Preseason commitment goals
  const [booksGoal, setBooksGoal] = useState(2);
  const [trainingHoursGoal, setTrainingHoursGoal] = useState(3);
  const [rolePlaysGoal, setRolePlaysGoal] = useState(5);
  const [mnlGoal, setMnlGoal] = useState(4);

  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

  const weeksWorking = summerStart && summerEnd 
    ? Math.max(1, Math.ceil(differenceInDays(summerEnd, summerStart) / 7))
    : 18;

  const mustDoFpGoal = isRookie 
    ? calculateMustDoFromExpenses(
        Number(monthlyExpenses) || 0, 
        Number(monthsOff) || 4, 
        avgPrmrPerFp, 
        housingOption.label, 
        weeksWorking
      )
    : Number(mustDoFpGoalInput) || 0;

  const handleNumberInput = (
    value: string, 
    setter: (val: string) => void
  ) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setter(value);
    }
  };

  const handleStartDateSelect = (date: Date | undefined) => {
    setSummerStart(date);
    setStartDateOpen(false);
    setTimeout(() => {
      setEndDateOpen(true);
    }, 150);
  };

  const toggleBlitzSelection = (blitzId: string) => {
    setSelectedBlitzIds(prev => 
      prev.includes(blitzId) 
        ? prev.filter(id => id !== blitzId)
        : [...prev, blitzId]
    );
  };

  const getStepTitle = () => {
    if (isRookie) {
      if (isCurrentlySummer) {
        switch (step) {
          case 1: return "Your Why";
          case 2: return "Monthly Expenses";
          case 3: return "Summer Dates";
          case 4: return "Summer Goals";
          case 5: return "Commit to Blitzes";
          case 6: return "Review";
          default: return "";
        }
      } else {
        switch (step) {
          case 1: return "Your Why";
          case 2: return "Monthly Expenses";
          case 3: return "Summer Dates";
          case 4: return "Summer Goals";
          case 5: return "Preseason Goal";
          case 6: return "Preseason Commitments";
          case 7: return "Commit to Blitzes";
          case 8: return "Review";
          default: return "";
        }
      }
    } else {
      if (isCurrentlySummer) {
        switch (step) {
          case 1: return "Summer Dates";
          case 2: return "Summer Goals";
          case 3: return "Review";
          default: return "";
        }
      } else {
        switch (step) {
          case 1: return "Summer Dates";
          case 2: return "Summer Goals";
          case 3: return "Preseason Goal";
          case 4: return "Review";
          default: return "";
        }
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
      avgPrmrPerFp: avgPrmrPerFp,
      weeksWorking,
      mustDoFpGoal,
      willDoFpGoal: Number(willDoFpGoal) || 0,
      couldDoFpGoal: Number(couldDoFpGoal) || 0,
      summerStart: summerStart ? format(summerStart, 'yyyy-MM-dd') : '2026-04-12',
      summerEnd: summerEnd ? format(summerEnd, 'yyyy-MM-dd') : '2026-09-27',
      preseasonFpGoal: Number(preseasonFpGoal) || 0,
      selectedBlitzIds: isRookie ? selectedBlitzIds : undefined,
      purposeStatement: isRookie ? purposeStatement : undefined,
      booksGoal: isRookie && !isCurrentlySummer ? booksGoal : undefined,
      trainingHoursGoal: isRookie && !isCurrentlySummer ? trainingHoursGoal : undefined,
      rolePlaysGoal: isRookie && !isCurrentlySummer ? rolePlaysGoal : undefined,
      mnlGoal: isRookie && !isCurrentlySummer ? mnlGoal : undefined,
    });
  };

  const renderStep = () => {
    if (isRookie) {
      if (isCurrentlySummer) {
        switch (step) {
          case 1: return renderWhyStep();
          case 2: return renderExpensesStep();
          case 3: return renderDateSettings();
          case 4: return renderGoalInputs();
          case 5: return renderBlitzCommitment();
          case 6: return renderReview();
          default: return null;
        }
      } else {
        switch (step) {
          case 1: return renderWhyStep();
          case 2: return renderExpensesStep();
          case 3: return renderDateSettings();
          case 4: return renderGoalInputs();
          case 5: return renderPreseasonGoal();
          case 6: return renderPreseasonCommitments();
          case 7: return renderBlitzCommitment();
          case 8: return renderReview();
          default: return null;
        }
      }
    } else {
      if (isCurrentlySummer) {
        switch (step) {
          case 1: return renderDateSettings();
          case 2: return renderGoalInputs();
          case 3: return renderReview();
          default: return null;
        }
      } else {
        switch (step) {
          case 1: return renderDateSettings();
          case 2: return renderGoalInputs();
          case 3: return renderPreseasonGoal();
          case 4: return renderReview();
          default: return null;
        }
      }
    }
  };

  // ===== WHY STEP (Rookie only) =====
  const renderWhyStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-4">
        <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
          <Heart className="h-7 w-7 text-primary" />
        </div>
        <p className="text-muted-foreground">
          Before we set numbers, let's talk purpose.
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Your goals mean more when you know what you're fighting for.
        </p>
      </div>

      <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 space-y-3">
        <Label htmlFor="why" className="font-semibold">What's YOUR why?</Label>
        <Textarea
          id="why"
          value={purposeStatement}
          onChange={(e) => setPurposeStatement(e.target.value)}
          placeholder="I'm doing this because..."
          className="min-h-[100px] text-base resize-none"
        />
        <p className="text-xs text-muted-foreground">
          Why are you working this summer? What are you trying to achieve or change?
        </p>
      </div>

      <p className="text-xs text-muted-foreground text-center italic">
        This is just for you. We'll remind you of it when things get tough.
      </p>
    </div>
  );

  // ===== EXPENSES STEP =====
  const renderExpensesStep = () => (
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
        <Label htmlFor="monthsOff">Months Not Working at Vivint</Label>
        <Input
          id="monthsOff"
          type="text"
          inputMode="numeric"
          value={monthsOff}
          onChange={(e) => handleNumberInput(e.target.value, setMonthsOff)}
          className="mt-2"
          placeholder="8"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Months during the year you won't be selling (school, etc.) — defaults to 8 since this is a summer job
        </p>
      </div>

      {monthlyExpenses && (
        <div className="rounded-xl bg-primary/10 p-4 text-center">
          <p className="text-sm text-muted-foreground mb-1">You need to cover:</p>
          <p className="text-2xl font-bold text-primary">
            {formatCurrency((Number(monthlyExpenses) || 0) * (Number(monthsOff) || 4))}
          </p>
          {purposeStatement && (
            <p className="text-xs text-muted-foreground mt-2 italic">
              Remember your why: "{purposeStatement.slice(0, 60)}{purposeStatement.length > 60 ? '...' : ''}"
            </p>
          )}
        </div>
      )}
    </div>
  );

  // ===== DATE SETTINGS =====
  const renderDateSettings = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <CalendarIcon className="h-12 w-12 mx-auto text-primary mb-3" />
        <p className="text-muted-foreground">
          When will you be selling?
        </p>
      </div>

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
    </div>
  );

  // ===== GOAL INPUTS =====
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
            Set your summer {metricLabel} goals
          </p>
        </div>

        {isRookie && mustDoFpGoal > 0 && (
          <div className="rounded-xl bg-emerald-500/10 p-4 border border-emerald-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-emerald-500" />
              <span className="font-semibold text-emerald-500">Must Do (Minimum)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{mustDoFpGoal} {metricLabel}</span>
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
              <span className="text-emerald-500 font-semibold">Must Do Goal</span>
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
                placeholder={`Enter ${metricLabel} goal`}
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
            <span className="text-amber-500 font-semibold">Will Do Goal</span>
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
              placeholder={`Enter ${metricLabel} goal`}
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
            <span className="text-purple-500 font-semibold">Could Do Goal</span>
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
              placeholder={`Enter ${metricLabel} goal`}
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

  // ===== PRESEASON GOAL =====
  const renderPreseasonGoal = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <Target className="h-12 w-12 mx-auto text-blue-500 mb-3" />
        <p className="text-muted-foreground">
          How much do you want to sell before summer?
        </p>
      </div>

      <div className="rounded-xl bg-blue-500/10 p-4 border border-blue-500/20">
        <div className="flex items-center gap-2 mb-3">
          <Target className="h-4 w-4 text-blue-500" />
          <span className="font-semibold text-blue-500">Preseason {metricLabel} Goal</span>
        </div>
        <Input
          type="text"
          inputMode="numeric"
          value={preseasonFpGoal}
          onChange={(e) => handleNumberInput(e.target.value, setPreseasonFpGoal)}
          placeholder="5"
          className="bg-background/50 text-xl font-semibold text-center"
        />
        <p className="text-xs text-muted-foreground mt-3 text-center">
          We recommend at least <span className="font-semibold text-blue-500">5 {metricLabel}</span> before the summer starts
        </p>
      </div>

      <div className="text-center text-sm text-muted-foreground">
        <p>Hitting your preseason goal helps you:</p>
        <ul className="mt-2 space-y-1">
          <li>• Build confidence before summer</li>
          <li>• Practice your pitch on real doors</li>
          <li>• Get comfortable with the sales process</li>
        </ul>
      </div>
    </div>
  );

  // ===== PRESEASON COMMITMENTS (NEW) =====
  const renderPreseasonCommitments = () => {
    const CommitmentStepper = ({ 
      icon: Icon, 
      label, 
      sublabel,
      value, 
      onChange, 
      min = 0,
      max = 20,
      color = "text-primary"
    }: { 
      icon: any; 
      label: string; 
      sublabel: string;
      value: number; 
      onChange: (v: number) => void; 
      min?: number;
      max?: number;
      color?: string;
    }) => (
      <div className="rounded-xl border p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-lg bg-muted")}>
            <Icon className={cn("h-5 w-5", color)} />
          </div>
          <div>
            <p className="font-medium text-sm">{label}</p>
            <p className="text-xs text-muted-foreground">{sublabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onChange(Math.max(min, value - 1))}
            disabled={value <= min}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="w-8 text-center font-bold text-lg">{value}</span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onChange(Math.min(max, value + 1))}
            disabled={value >= max}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );

    return (
      <div className="space-y-6">
        <div className="text-center mb-4">
          <Target className="h-12 w-12 mx-auto text-primary mb-3" />
          <p className="text-muted-foreground">
            Set your preseason standards
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            These are your commitments before summer starts. We'll remind you to keep them.
          </p>
        </div>

        <div className="space-y-3">
          <CommitmentStepper
            icon={BookOpen}
            label="Books to Read"
            sublabel="Sales & personal dev books"
            value={booksGoal}
            onChange={setBooksGoal}
            color="text-amber-500"
          />
          <CommitmentStepper
            icon={Timer}
            label="Training Hours / Week"
            sublabel="Self-study & practice time"
            value={trainingHoursGoal}
            onChange={setTrainingHoursGoal}
            color="text-blue-500"
          />
          <CommitmentStepper
            icon={Dumbbell}
            label="Role Plays"
            sublabel="Practice pitches with others"
            value={rolePlaysGoal}
            onChange={setRolePlaysGoal}
            color="text-emerald-500"
          />
          <CommitmentStepper
            icon={Phone}
            label="MNL Sessions"
            sublabel="Monday Night Lights calls"
            value={mnlGoal}
            onChange={setMnlGoal}
            color="text-purple-500"
          />
        </div>
      </div>
    );
  };

  // ===== BLITZ COMMITMENT =====
  const renderBlitzCommitment = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <MapPin className="h-12 w-12 mx-auto text-primary mb-3" />
        <p className="text-muted-foreground">
          Which blitzes will you attend?
        </p>
      </div>

      {blitzesLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : allBlitzes.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No upcoming blitzes available</p>
          <p className="text-sm mt-1">You can commit to blitzes later from the Goals page</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {allBlitzes.map((blitz) => {
            const isSelected = selectedBlitzIds.includes(blitz.id);
            const startDate = parseDateAsLocal(blitz.date);
            const endDate = blitz.endDate ? parseDateAsLocal(blitz.endDate) : null;
            const startLabel = startDate ? format(startDate, "MMM d") : "";
            const endLabel = endDate ? format(endDate, "MMM d") : "";

            return (
              <button
                key={blitz.id}
                type="button"
                onClick={() => toggleBlitzSelection(blitz.id)}
                className={cn(
                  "w-full p-4 rounded-xl border text-left transition-all duration-150 active:scale-[0.98]",
                  isSelected
                    ? "border-primary bg-primary/10 ring-2 ring-primary"
                    : "border-border"
                )}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={isSelected}
                    className="mt-0.5 pointer-events-none"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{blitz.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {startLabel}
                      {blitz.endDate && endLabel && ` - ${endLabel}`}
                    </p>
                    {blitz.location && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" />
                        {blitz.location}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selectedBlitzIds.length > 0 && (
        <div className="rounded-xl bg-primary/10 p-4 text-center">
          <p className="font-semibold text-primary">
            {selectedBlitzIds.length} blitz{selectedBlitzIds.length !== 1 ? 'es' : ''} selected
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        You can change your blitz commitments anytime from the Goals page
      </p>
    </div>
  );

  // ===== REVIEW =====
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

        {/* WHY statement for rookies */}
        {isRookie && purposeStatement && (
          <div className="rounded-xl bg-primary/5 border border-primary/20 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="h-4 w-4 text-primary" />
              <span className="font-semibold text-primary text-sm">Your Why</span>
            </div>
            <p className="text-sm italic text-muted-foreground">"{purposeStatement}"</p>
          </div>
        )}

        <div className="space-y-3">
          {!isCurrentlySummer && preseasonFpGoal && (
            <div className="rounded-xl bg-blue-500/10 p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-blue-500">Preseason</p>
                <p className="text-lg font-bold">{preseasonFpGoal} {metricLabel}</p>
              </div>
              <p className="text-sm text-muted-foreground">Before summer</p>
            </div>
          )}

          {mustDoFpGoal > 0 && (
            <div className="rounded-xl bg-amber-500/10 p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-amber-500">Must Do</p>
                <p className="text-lg font-bold">{mustDoFpGoal} {metricLabel}</p>
              </div>
              <p className="text-lg font-bold">{formatCurrency(mustDoResult.takeHomePay)}</p>
            </div>
          )}

          {willDoFpGoal && (
            <div className="rounded-xl bg-primary/10 p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-primary">Will Do</p>
                <p className="text-lg font-bold">{willDoFpGoal} {metricLabel}</p>
              </div>
              <p className="text-lg font-bold">{formatCurrency(willDoResult.takeHomePay)}</p>
            </div>
          )}

          {couldDoFpGoal && (
            <div className="rounded-xl bg-green-500/10 p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-green-500">Could Do</p>
                <p className="text-lg font-bold">{couldDoFpGoal} {metricLabel}</p>
              </div>
              <p className="text-lg font-bold">{formatCurrency(couldDoResult.takeHomePay)}</p>
            </div>
          )}
        </div>

        {/* Preseason commitments summary */}
        {isRookie && !isCurrentlySummer && (
          <div className="rounded-xl bg-muted/50 p-4 border">
            <p className="font-semibold text-sm mb-3">Preseason Commitments</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-amber-500" />
                <span>{booksGoal} books</span>
              </div>
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-blue-500" />
                <span>{trainingHoursGoal} hrs/wk training</span>
              </div>
              <div className="flex items-center gap-2">
                <Dumbbell className="h-4 w-4 text-emerald-500" />
                <span>{rolePlaysGoal} role plays</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-purple-500" />
                <span>{mnlGoal} MNL sessions</span>
              </div>
            </div>
          </div>
        )}

        {/* Committed blitzes for rookies */}
        {isRookie && selectedBlitzIds.length > 0 && (
          <div className="rounded-xl bg-blue-500/10 p-4 border border-blue-500/20">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-4 w-4 text-blue-500" />
              <span className="font-semibold text-blue-500">
                {selectedBlitzIds.length} Blitz{selectedBlitzIds.length !== 1 ? 'es' : ''} Committed
              </span>
            </div>
            <div className="space-y-1">
              {allBlitzes
                .filter(b => selectedBlitzIds.includes(b.id))
                .map(blitz => (
                  <p key={blitz.id} className="text-sm text-muted-foreground">
                    • {blitz.name} ({formatBlitzDate(blitz.date, "MMM d")})
                  </p>
                ))
              }
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground text-center">
          {housingOption.label} (${housingOption.value}/wk) • {weeksWorking} weeks • ${avgPrmrPerFp} avg PRMR
        </div>

        <PayEstimateDisclaimer className="text-center mt-2" />
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
