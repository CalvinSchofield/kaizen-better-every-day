import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, ExternalLink, HelpCircle, Loader2, X, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle,
  DrawerDescription 
} from "@/components/ui/drawer";
import { useOfficialTotals } from "@/hooks/useOfficialTotals";
import { useEfpMode } from "@/hooks/useEfpMode";
import { cn } from "@/lib/utils";

interface CatchUpWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seasonType: 'preseason' | 'summer';
  onComplete?: () => void;
}

type Step = 'welcome' | 'fp' | 'prmr' | 'days' | 'confirm';

const STEPS: Step[] = ['welcome', 'fp', 'prmr', 'days', 'confirm'];

const SEASON_YEAR = 2025;

// External URLs for guidance
const CURATOR_PRODUCTION_URL = 'https://curator.vivint.com/dashboard/production-test-production-report';

export const CatchUpWizard = ({ 
  open, 
  onOpenChange, 
  seasonType,
  onComplete 
}: CatchUpWizardProps) => {
  const [currentStep, setCurrentStep] = useState<Step>('welcome');
  const [fpPlus, setFpPlus] = useState<string>('');
  const [prmr, setPrmr] = useState<string>('');
  const [knockingDays, setKnockingDays] = useState<string>('');
  const [autoCalcPrmr, setAutoCalcPrmr] = useState(false);
  
  const { upsertTotalsAsync, isUpserting } = useOfficialTotals();
  const { efpModeEnabled, calculateEfp } = useEfpMode();
  const metricLabel = efpModeEnabled ? 'EFP' : 'FP+';

  const stepIndex = STEPS.indexOf(currentStep);
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === STEPS.length - 1;

  const fpValue = parseFloat(fpPlus) || 0;
  const prmrValue = autoCalcPrmr ? fpValue * 85 : (parseFloat(prmr) || 0);
  const daysValue = parseInt(knockingDays) || 0;
  const efpValue = calculateEfp(prmrValue);

  const handleNext = () => {
    const nextIndex = stepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex]);
    }
  };

  const handleBack = () => {
    const prevIndex = stepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex]);
    }
  };

  const handleSubmit = async () => {
    try {
      await upsertTotalsAsync({
        season_year: SEASON_YEAR,
        season_type: seasonType,
        fp_plus: fpValue,
        prmr: prmrValue,
        knocking_days: daysValue,
        verified_by: 'self',
      });
      
      // Mark catch-up as complete in localStorage
      localStorage.setItem(`catchup-complete-${seasonType}-${SEASON_YEAR}`, 'true');
      
      onComplete?.();
      onOpenChange(false);
      
      // Reset state
      setCurrentStep('welcome');
      setFpPlus('');
      setPrmr('');
      setKnockingDays('');
    } catch (error) {
      console.error('Failed to save official totals:', error);
    }
  };

  const handleSkip = () => {
    localStorage.setItem(`catchup-skipped-${seasonType}-${SEASON_YEAR}`, new Date().toISOString());
    onOpenChange(false);
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'welcome':
        return (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <TrendingUp className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold">Let's sync your progress</h3>
            <p className="text-muted-foreground">
              To give you accurate goals and pace tracking, we need your current {seasonType} totals from Vivint.
            </p>
            <p className="text-sm text-muted-foreground">
              This takes about 30 seconds and helps us help you.
            </p>
          </div>
        );

      case 'fp':
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold">
                {efpModeEnabled 
                  ? "What's your total EFP sold?" 
                  : "How many FP+ have you sold?"}
              </h3>
              <p className="text-sm text-muted-foreground">
                Enter your <strong>TOTAL</strong> {seasonType} {metricLabel} — both funded AND unfunded
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fp-input">Total {metricLabel} Sold</Label>
              <Input
                id="fp-input"
                type="number"
                inputMode="decimal"
                placeholder={efpModeEnabled ? "e.g., 62.9" : "e.g., 12.5"}
                value={fpPlus}
                onChange={(e) => setFpPlus(e.target.value)}
                className="text-2xl h-14 text-center"
                autoFocus
              />
            </div>
            
            {/* Guidance card for finding the number */}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-4 space-y-3">
                <button 
                  className="flex items-center gap-2 text-sm font-medium text-primary hover:underline w-full"
                  onClick={() => window.open(CURATOR_PRODUCTION_URL, '_blank')}
                >
                  <HelpCircle className="h-4 w-4" />
                  Where do I find this?
                  <ExternalLink className="h-3 w-3 ml-auto" />
                </button>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside pl-1">
                  <li>Open the <strong>Production Report</strong> on Curator</li>
                  <li>Change "Funded" dropdown to <strong>"(All)"</strong></li>
                  <li>Find your <strong>total {metricLabel}</strong> (includes unfunded)</li>
                </ol>
              </CardContent>
            </Card>
          </div>
        );

      case 'prmr':
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold">
                {efpModeEnabled ? "Confirm your total PRMR" : "What's your total PRMR?"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {efpModeEnabled 
                  ? "We'll calculate your EFP from this (PRMR ÷ 85)"
                  : "This helps us calculate your EFP and income projections"}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="prmr-input">Total PRMR</Label>
              <Input
                id="prmr-input"
                type="number"
                inputMode="decimal"
                placeholder="e.g., 1062.5"
                value={autoCalcPrmr ? (fpValue * 85).toFixed(2) : prmr}
                onChange={(e) => {
                  setAutoCalcPrmr(false);
                  setPrmr(e.target.value);
                }}
                disabled={autoCalcPrmr}
                className="text-2xl h-14 text-center"
                autoFocus={!autoCalcPrmr}
              />
            </div>
            <button
              className={cn(
                "flex items-center gap-2 text-sm transition-colors w-full justify-center py-2 rounded-lg",
                autoCalcPrmr 
                  ? "bg-primary/10 text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setAutoCalcPrmr(!autoCalcPrmr)}
            >
              <Check className={cn("h-4 w-4", autoCalcPrmr ? "opacity-100" : "opacity-0")} />
              Auto-calculate from FP+ (× 85)
            </button>
          </div>
        );

      case 'days':
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold">How many days have you worked?</h3>
              <p className="text-sm text-muted-foreground">
                Count days where you knocked at least 4 hours
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="days-input">Knocking Days</Label>
              <Input
                id="days-input"
                type="number"
                inputMode="numeric"
                placeholder="e.g., 15"
                value={knockingDays}
                onChange={(e) => setKnockingDays(e.target.value)}
                className="text-2xl h-14 text-center"
                autoFocus
              />
            </div>
          </div>
        );

      case 'confirm':
        return (
          <div className="space-y-6">
            <div className="text-center mb-4">
              <h3 className="text-lg font-semibold">Confirm your numbers</h3>
              <p className="text-sm text-muted-foreground">
                We'll use these as your verified {seasonType} baseline
              </p>
            </div>
            
            <Card>
              <CardContent className="pt-6 space-y-4">
                {efpModeEnabled ? (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">EFP (Total Sold)</span>
                      <span className="text-xl font-semibold">{fpValue.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">PRMR</span>
                      <span className="text-xl font-semibold">${prmrValue.toFixed(0)}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">FP+ (Total Sold)</span>
                      <span className="text-xl font-semibold">{fpValue.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">PRMR</span>
                      <span className="text-xl font-semibold">${prmrValue.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">EFP</span>
                      <span className="text-xl font-semibold">{efpValue.toFixed(2)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Knocking Days</span>
                  <span className="text-xl font-semibold">{daysValue}</span>
                </div>
                {daysValue > 0 && (
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-muted-foreground">Avg per Day</span>
                    <span className="text-lg font-medium">
                      {(fpValue / daysValue).toFixed(2)} {metricLabel}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'welcome':
        return true;
      case 'fp':
        return fpValue > 0 || fpPlus === '0';
      case 'prmr':
        return prmrValue > 0 || prmr === '0' || autoCalcPrmr;
      case 'days':
        return daysValue > 0 || knockingDays === '0';
      case 'confirm':
        return true;
      default:
        return false;
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90dvh]">
        <DrawerHeader className="border-b">
          <div className="flex items-center justify-between">
            <div>
              <DrawerTitle>Quick Catch-Up</DrawerTitle>
              <DrawerDescription className="capitalize">{seasonType} Sync</DrawerDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={handleSkip}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          {/* Progress dots */}
          <div className="flex justify-center gap-2 mt-4">
            {STEPS.map((step, idx) => (
              <div
                key={step}
                className={cn(
                  "h-2 rounded-full transition-all",
                  idx === stepIndex 
                    ? "w-6 bg-primary" 
                    : idx < stepIndex 
                      ? "w-2 bg-primary" 
                      : "w-2 bg-muted"
                )}
              />
            ))}
          </div>
        </DrawerHeader>

        <div className="p-6 overflow-y-auto flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="p-4 border-t flex gap-3">
          {!isFirstStep && (
            <Button 
              variant="outline" 
              onClick={handleBack}
              className="flex-1"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          )}
          
          {isFirstStep && (
            <Button 
              variant="ghost" 
              onClick={handleSkip}
              className="flex-1"
            >
              Skip for now
            </Button>
          )}
          
          {isLastStep ? (
            <Button 
              onClick={handleSubmit}
              disabled={isUpserting}
              className="flex-1"
            >
              {isUpserting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Confirm
            </Button>
          ) : (
            <Button 
              onClick={handleNext}
              disabled={!canProceed()}
              className="flex-1"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
