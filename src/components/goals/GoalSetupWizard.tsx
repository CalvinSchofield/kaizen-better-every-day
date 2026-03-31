import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import type { OnboardingSegment } from "@/hooks/useOnboardingSegment";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ArrowRight, Target, DollarSign, Calculator, Check, HelpCircle, Calendar as CalendarIcon, MapPin, Loader2, Heart, Minus, Plus, BookOpen, Timer, Dumbbell, Phone, Clock, AlertCircle } from "lucide-react";
import { 
  calculateMustDoFromExpenses, 
  calculateTakeHome, 
  formatCurrency 
} from "@/utils/payscaleCalculator";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { differenceInDays, format, differenceInWeeks } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { formatBlitzDate, parseDateAsLocal } from "@/utils/blitzDateUtils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useBlitzes } from "@/hooks/useBlitzes";
import { Checkbox } from "@/components/ui/checkbox";
import { useEfpMode } from "@/hooks/useEfpMode";
import { PayEstimateDisclaimer } from "@/components/PayEstimateDisclaimer";
import { Slider } from "@/components/ui/slider";
import { BOOKS } from "@/components/goals/BooksSelectionDrawer";

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
  segment?: OnboardingSegment;
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
    selectedBookIds?: string[];
  }) => void;
  onCancel?: () => void;
}

// Format minutes as natural duration
const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}hr ${mins}m` : `${hours}hr`;
};

export const GoalSetupWizard = ({ 
  isRookie, 
  committedBlitzIds = [], 
  segment,
  onComplete, 
  onCancel 
}: GoalSetupWizardProps) => {
  const [step, setStep] = useState(1);
  
  const { allBlitzes, loading: blitzesLoading } = useBlitzes();
  const [selectedBlitzIds, setSelectedBlitzIds] = useState<string[]>(committedBlitzIds);

  const { efpModeEnabled } = useEfpMode();
  const metricLabel = efpModeEnabled ? 'EFP' : 'FP+';

  const isCurrentlySummer = new Date() >= SUMMER_START_MIN;
  
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
  
  // Preseason commitment goals - redesigned
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  // Training: stored as minutes per day (10-60), displayed naturally
  const [trainingMinutesPerDay, setTrainingMinutesPerDay] = useState(15);
  const [rolePlaysGoal, setRolePlaysGoal] = useState(4);
  const [mnlCommitted, setMnlCommitted] = useState(true);

  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);
  
  // Validation state
  const [validationError, setValidationError] = useState<string | null>(null);

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

  // Calculate weeks until summer for role play suggestions
  const weeksUntilSummer = useMemo(() => {
    const now = new Date();
    return Math.max(1, differenceInWeeks(SUMMER_START_MIN, now));
  }, []);

  // Calculate MNL sessions available (Mondays between now and summer start)
  const mnlSessionsAvailable = useMemo(() => {
    const now = new Date();
    let count = 0;
    const current = new Date(now);
    while (current < SUMMER_START_MIN) {
      if (current.getDay() === 1) count++;
      current.setDate(current.getDate() + 1);
    }
    return count;
  }, []);

  // Training: convert daily minutes to weekly minutes for storage
  const trainingWeeklyMinutes = trainingMinutesPerDay * 6; // 6 days/week

  // Has blitzes available
  const hasBlitzes = !blitzesLoading && allBlitzes.length > 0;

  // Build step sequence dynamically
  const stepSequence = useMemo(() => {
    if (isRookie) {
      if (isCurrentlySummer) {
        return ['why', 'expenses', 'dates', 'goals', 'blitzes', 'review'];
      } else {
        const steps = ['why', 'expenses', 'dates', 'goals', 'commitments'];
        // Always show blitzes step (shows empty state if none)
        steps.push('blitzes');
        // Only show preseason goal if blitzes are available
        if (hasBlitzes) {
          steps.push('preseason');
        }
        steps.push('review');
        return steps;
      }
    } else {
      if (isCurrentlySummer) {
        return ['dates', 'goals', 'review'];
      } else {
        return ['dates', 'goals', 'preseason', 'review'];
      }
    }
  }, [isRookie, isCurrentlySummer, hasBlitzes]);

  const totalSteps = stepSequence.length;
  const currentStepType = stepSequence[step - 1];

  const handleNumberInput = (
    value: string, 
    setter: (val: string) => void
  ) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setter(value);
      setValidationError(null);
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

  const toggleBookSelection = (bookId: string) => {
    setSelectedBookIds(prev =>
      prev.includes(bookId)
        ? prev.filter(id => id !== bookId)
        : [...prev, bookId]
    );
  };

  const getStepTitle = () => {
    switch (currentStepType) {
      case 'why': return "Your Why";
      case 'expenses': return "Monthly Expenses";
      case 'dates': return "Summer Dates";
      case 'goals': return "Summer Goals";
      case 'commitments': return "Preseason Commitments";
      case 'blitzes': return "Commit to Blitzes";
      case 'preseason': return "Preseason Goal";
      case 'review': return "Review";
      default: return "";
    }
  };

  // Validation logic
  const validateCurrentStep = (): boolean => {
    setValidationError(null);
    
    if (!isRookie) return true; // Vets don't have required fields for now

    switch (currentStepType) {
      case 'why':
        if (!purposeStatement.trim()) {
          setValidationError("Tell us your why before moving forward — this is what keeps you going when it gets tough.");
          return false;
        }
        if (purposeStatement.trim().length < 10) {
          setValidationError("Give us a little more — at least a sentence about what you're fighting for.");
          return false;
        }
        return true;
      
      case 'expenses':
        if (!monthlyExpenses || Number(monthlyExpenses) <= 0) {
          setValidationError("Enter your monthly expenses so we can calculate your Must Do goal.");
          return false;
        }
        return true;
      
      case 'goals':
        if (!willDoFpGoal || Number(willDoFpGoal) <= 0) {
          setValidationError(`Set your Will Do ${metricLabel} goal — this is your realistic target.`);
          return false;
        }
        if (!couldDoFpGoal || Number(couldDoFpGoal) <= 0) {
          setValidationError(`Set your Could Do ${metricLabel} goal — dream big!`);
          return false;
        }
        if (Number(willDoFpGoal) <= mustDoFpGoal) {
          setValidationError(`Your Will Do goal should be higher than your Must Do (${mustDoFpGoal} ${metricLabel}).`);
          return false;
        }
        if (Number(couldDoFpGoal) <= Number(willDoFpGoal)) {
          setValidationError("Your Could Do goal should be higher than your Will Do goal.");
          return false;
        }
        return true;

      case 'commitments':
        if (selectedBookIds.length === 0) {
          setValidationError("Pick at least one book to read before the summer.");
          return false;
        }
        return true;
      
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (!validateCurrentStep()) return;
    
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
      booksGoal: isRookie && !isCurrentlySummer ? selectedBookIds.length : undefined,
      trainingHoursGoal: isRookie && !isCurrentlySummer ? trainingWeeklyMinutes : undefined,
      rolePlaysGoal: isRookie && !isCurrentlySummer ? rolePlaysGoal : undefined,
      mnlGoal: isRookie && !isCurrentlySummer ? (mnlCommitted ? mnlSessionsAvailable : 0) : undefined,
      selectedBookIds: isRookie && !isCurrentlySummer ? selectedBookIds : undefined,
    });
  };

  const renderStep = () => {
    switch (currentStepType) {
      case 'why': return renderWhyStep();
      case 'expenses': return renderExpensesStep();
      case 'dates': return renderDateSettings();
      case 'goals': return renderGoalInputs();
      case 'commitments': return renderPreseasonCommitments();
      case 'blitzes': return renderBlitzCommitment();
      case 'preseason': return renderPreseasonGoal();
      case 'review': return renderReview();
      default: return null;
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
          onChange={(e) => {
            setPurposeStatement(e.target.value);
            setValidationError(null);
          }}
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

  // ===== PRESEASON COMMITMENTS (REDESIGNED) =====
  const renderPreseasonCommitments = () => {
    // Role play suggestion: one every other week
    const suggestedRolePlays = Math.max(2, Math.floor(weeksUntilSummer / 2));

    return (
      <div className="space-y-6">
        <div className="text-center mb-2">
          <Target className="h-12 w-12 mx-auto text-primary mb-3" />
          <p className="text-muted-foreground">
            Set your preseason standards
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            These commitments will prepare you to crush it this summer.
          </p>
        </div>

        {/* ===== BOOKS ===== */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-amber-500" />
            <Label className="font-semibold">Books to Read</Label>
            <span className="text-xs text-muted-foreground ml-auto">
              {selectedBookIds.length} selected
            </span>
          </div>
          <div className="space-y-1.5 max-h-[200px] overflow-y-auto rounded-xl border p-3">
            {BOOKS.map((book) => {
              const isSelected = selectedBookIds.includes(book.id);
              return (
                <button
                  key={book.id}
                  onClick={() => toggleBookSelection(book.id)}
                  className={cn(
                    "flex items-center gap-2.5 w-full p-2.5 rounded-lg text-left transition-all active:scale-[0.98]",
                    isSelected 
                      ? "bg-amber-500/10 ring-1 ring-amber-500/40" 
                      : "hover:bg-muted/50"
                  )}
                >
                  <Checkbox checked={isSelected} className="pointer-events-none" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{book.title}</p>
                    <p className="text-[11px] text-muted-foreground">{book.author}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ===== TRAINING TIME ===== */}
        <div className="space-y-3 rounded-xl border p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-500" />
            <Label className="font-semibold">Training Time</Label>
          </div>
          
          <div className="text-center">
            <p className="text-3xl font-bold text-primary">
              {formatDuration(trainingMinutesPerDay)}
              <span className="text-lg text-muted-foreground font-normal"> / day</span>
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              = {formatDuration(trainingWeeklyMinutes)} per week
            </p>
          </div>

          <Slider
            value={[trainingMinutesPerDay]}
            onValueChange={([val]) => setTrainingMinutesPerDay(val)}
            min={10}
            max={60}
            step={5}
            className="py-2"
          />
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>10m/day</span>
            <span>1hr/day</span>
          </div>

          <div className="rounded-lg bg-blue-500/5 border border-blue-500/10 p-3 mt-2">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-semibold text-blue-500">4 things to master:</span> our product, our door approach, our in-home process, and our competitors' products.
            </p>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              This includes: studying the sales process, Ramp to Blitz prep, training portal videos, product knowledge, competitor research, and sales podcasts.
            </p>
          </div>
        </div>

        {/* ===== ROLE PLAYS ===== */}
        <div className="rounded-xl border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5 text-emerald-500" />
            <Label className="font-semibold">Role Plays</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Practice the sales process with vets and leaders before the summer.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full"
              onClick={() => setRolePlaysGoal(Math.max(1, rolePlaysGoal - 1))}
              disabled={rolePlaysGoal <= 1}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="text-3xl font-bold w-12 text-center">{rolePlaysGoal}</span>
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full"
              onClick={() => setRolePlaysGoal(Math.min(30, rolePlaysGoal + 1))}
              disabled={rolePlaysGoal >= 30}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            <button
              onClick={() => setRolePlaysGoal(Math.floor(weeksUntilSummer / 4))}
              className={cn(
                "text-xs px-3 py-1.5 rounded-full border transition-all active:scale-95",
                rolePlaysGoal === Math.floor(weeksUntilSummer / 4)
                  ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-600"
                  : "border-border text-muted-foreground"
              )}
            >
              Monthly ({Math.floor(weeksUntilSummer / 4)})
            </button>
            <button
              onClick={() => setRolePlaysGoal(suggestedRolePlays)}
              className={cn(
                "text-xs px-3 py-1.5 rounded-full border transition-all active:scale-95",
                rolePlaysGoal === suggestedRolePlays
                  ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-600"
                  : "border-border text-muted-foreground"
              )}
            >
              Every other week ({suggestedRolePlays})
            </button>
            <button
              onClick={() => setRolePlaysGoal(weeksUntilSummer)}
              className={cn(
                "text-xs px-3 py-1.5 rounded-full border transition-all active:scale-95",
                rolePlaysGoal === weeksUntilSummer
                  ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-600"
                  : "border-border text-muted-foreground"
              )}
            >
              Weekly ({weeksUntilSummer})
            </button>
          </div>
        </div>

        {/* ===== MNL ===== */}
        <div className="rounded-xl border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-purple-500" />
            <Label className="font-semibold">Monday Night Lights</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Weekly online training sessions every Monday night. We want you to commit to attending 100% and taking notes.
          </p>
          <button
            onClick={() => setMnlCommitted(!mnlCommitted)}
            className={cn(
              "w-full p-4 rounded-xl border-2 text-left transition-all active:scale-[0.98]",
              mnlCommitted
                ? "border-purple-500 bg-purple-500/10"
                : "border-border"
            )}
          >
            <div className="flex items-center gap-3">
              <Checkbox checked={mnlCommitted} className="pointer-events-none" />
              <div>
                <p className="font-semibold text-sm">
                  I commit to 100% MNL attendance
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {mnlSessionsAvailable} sessions before summer starts
                </p>
              </div>
            </div>
          </button>
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
          <p>No upcoming blitzes available yet</p>
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
          {!isCurrentlySummer && preseasonFpGoal && hasBlitzes && (
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
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-amber-500" />
                <span>{selectedBookIds.length} book{selectedBookIds.length !== 1 ? 's' : ''} to read</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                <span>{formatDuration(trainingMinutesPerDay)}/day training ({formatDuration(trainingWeeklyMinutes)}/wk)</span>
              </div>
              <div className="flex items-center gap-2">
                <Dumbbell className="h-4 w-4 text-emerald-500" />
                <span>{rolePlaysGoal} role play{rolePlaysGoal !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-purple-500" />
                <span>{mnlCommitted ? `100% MNL (${mnlSessionsAvailable} sessions)` : 'MNL not committed'}</span>
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

        {/* Validation Error */}
        {validationError && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>{validationError}</p>
          </div>
        )}

        <div className="flex gap-3 pt-4">
          {step > 1 ? (
            <Button
              variant="outline"
              onClick={() => {
                setValidationError(null);
                setStep(step - 1);
              }}
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
