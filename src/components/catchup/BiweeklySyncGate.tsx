import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ExternalLink, ChevronRight, ChevronLeft, Check, Loader2, 
  RefreshCw, Users, HelpCircle, ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useOfficialTotals } from "@/hooks/useOfficialTotals";
import { useEfpMode } from "@/hooks/useEfpMode";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import type { EffectiveFPResult } from "@/hooks/useEffectiveFP";

interface BiweeklySyncGateProps {
  seasonType: 'preseason' | 'summer';
  effectiveData: EffectiveFPResult;
  isInitialSync?: boolean;
  onComplete: () => void;
}

type SyncStep = 'intro' | 'curator' | 'fp_plus' | 'fp_sold' | 'prmr' | 'knocking_days' | 'source' | 'crm' | 'confirm';

const STEPS: SyncStep[] = ['intro', 'curator', 'fp_plus', 'fp_sold', 'prmr', 'knocking_days', 'source', 'crm', 'confirm'];

const SEASON_YEAR = 2025;
const CURATOR_PRODUCTION_URL = 'https://curator.vivint.com/dashboard/production-test-production-report';
const SOURCE_EARNINGS_URL = 'https://curator.vivint.com/dashboard/source-accountdetailsearnings';

type MetricChoice = 'tracked' | 'vivint' | null;
type KnockingChoice = 'tracked' | 'manual' | 'unknown' | null;

export const BiweeklySyncGate = ({ seasonType, effectiveData, isInitialSync = false, onComplete }: BiweeklySyncGateProps) => {
  const navigate = useNavigate();
  const { upsertTotalsAsync, isUpserting } = useOfficialTotals(seasonType);
  const { efpModeEnabled } = useEfpMode();
  const metricLabel = efpModeEnabled ? 'EFP' : 'FP+';

  const [step, setStep] = useState<SyncStep>('intro');
  const [isSavingZero, setIsSavingZero] = useState(false);
  
  // Metric choices & values
  const [fpChoice, setFpChoice] = useState<MetricChoice>(null);
  const [fpVivint, setFpVivint] = useState('');
  
  const [fpSoldChoice, setFpSoldChoice] = useState<MetricChoice>(null);
  const [fpSoldVivint, setFpSoldVivint] = useState('');
  
  const [prmrChoice, setPrmrChoice] = useState<MetricChoice>(null);
  const [prmrVivint, setPrmrVivint] = useState('');
  
  const [knockingChoice, setKnockingChoice] = useState<KnockingChoice>(null);
  const [knockingManual, setKnockingManual] = useState('');

  const stepIndex = STEPS.indexOf(step);
  
  // Tracked values for prefill display
  const trackedFp = effectiveData.effectiveFp;
  const trackedFpSold = effectiveData.totalTrackedFpSold;
  const trackedPrmr = effectiveData.effectivePrmr;
  const trackedKnockingDays = effectiveData.effectiveKnockingDays;

  // Final values based on choices
  const finalFp = fpChoice === 'tracked' ? trackedFp : (parseFloat(fpVivint) || 0);
  const finalFpSold = fpSoldChoice === 'tracked' ? trackedFpSold : (parseInt(fpSoldVivint) || 0);
  const finalPrmr = prmrChoice === 'tracked' ? trackedPrmr : (parseFloat(prmrVivint) || 0);
  const finalKnockingDays: number | null = 
    knockingChoice === 'tracked' ? trackedKnockingDays 
    : knockingChoice === 'manual' ? (parseInt(knockingManual) || 0)
    : knockingChoice === 'unknown' ? null 
    : 0;

  const handleNext = () => {
    const nextIndex = stepIndex + 1;
    if (nextIndex < STEPS.length) setStep(STEPS[nextIndex]);
  };

  const handleBack = () => {
    const prevIndex = stepIndex - 1;
    if (prevIndex >= 0) setStep(STEPS[prevIndex]);
  };

  const handleSubmit = async () => {
    try {
      await upsertTotalsAsync({
        season_year: SEASON_YEAR,
        season_type: seasonType,
        fp_plus: finalFp,
        fp_sold: finalFpSold,
        prmr: finalPrmr,
        knocking_days: finalKnockingDays,
        verified_by: 'self',
        notes: `${isInitialSync ? 'Initial' : 'Biweekly'} sync: FP+ ${fpChoice}, FP sold ${fpSoldChoice}, PRMR ${prmrChoice}, Days ${knockingChoice}`,
      });
      onComplete();
    } catch (error) {
      console.error('Failed to save sync:', error);
    }
  };

  const handleHaventSoldYet = async () => {
    setIsSavingZero(true);
    try {
      await upsertTotalsAsync({
        season_year: SEASON_YEAR,
        season_type: seasonType,
        fp_plus: 0,
        fp_sold: 0,
        prmr: 0,
        knocking_days: 0,
        verified_by: 'self',
        notes: 'Initial sync: haven\'t sold yet — zero baseline',
      });
      onComplete();
    } catch (error) {
      console.error('Failed to save zero baseline:', error);
    } finally {
      setIsSavingZero(false);
    }
  };

  const canProceed = (): boolean => {
    switch (step) {
      case 'intro':
      case 'curator':
      case 'source':
      case 'crm':
        return true;
      case 'fp_plus':
        return fpChoice !== null && (fpChoice === 'tracked' || (parseFloat(fpVivint) >= 0 && fpVivint !== ''));
      case 'fp_sold':
        return fpSoldChoice !== null && (fpSoldChoice === 'tracked' || (parseInt(fpSoldVivint) >= 0 && fpSoldVivint !== ''));
      case 'prmr':
        return prmrChoice !== null && (prmrChoice === 'tracked' || (parseFloat(prmrVivint) >= 0 && prmrVivint !== ''));
      case 'knocking_days':
        return knockingChoice !== null && (knockingChoice !== 'manual' || (parseInt(knockingManual) >= 0 && knockingManual !== ''));
      case 'confirm':
        return true;
      default:
        return false;
    }
  };

  const ChoiceChip = ({ 
    selected, label, sublabel, onSelect, variant = 'default' 
  }: { 
    selected: boolean; label: string; sublabel?: string; onSelect: () => void; variant?: 'default' | 'outline' 
  }) => (
    <button
      onClick={onSelect}
      className={cn(
        "w-full p-4 rounded-2xl text-left transition-all active:scale-[0.97]",
        selected 
          ? "bg-primary/10 border-2 border-primary" 
          : variant === 'outline'
            ? "bg-background border-2 border-border hover:border-muted-foreground/30"
            : "bg-muted/50 border-2 border-transparent hover:border-muted-foreground/20"
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className={cn("font-medium", selected && "text-primary")}>{label}</p>
          {sublabel && <p className="text-sm text-muted-foreground mt-0.5">{sublabel}</p>}
        </div>
        {selected && <Check className="h-5 w-5 text-primary flex-shrink-0" />}
      </div>
    </button>
  );

  const renderStep = () => {
    switch (step) {
      case 'intro':
        return (
          <div className="text-center space-y-6 py-8">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <RefreshCw className="h-10 w-10 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">
                {isInitialSync ? "Let's sync with Vivint" : "Time to sync your numbers"}
              </h2>
              <p className="text-muted-foreground max-w-xs mx-auto">
                {isInitialSync 
                  ? "Before we show your pace, let's make sure we're starting from the right place by checking what Vivint has on file."
                  : "Every 2 weeks we check in to keep your pace and earnings projections accurate with what Vivint has on file."
                }
              </p>
            </div>
            {isInitialSync && (
              <button
                onClick={handleHaventSoldYet}
                disabled={isSavingZero}
                className="text-sm text-muted-foreground underline underline-offset-4 active:scale-95 transition-transform disabled:opacity-50"
              >
                {isSavingZero ? 'Saving...' : "I haven't sold yet"}
              </button>
            )}
          </div>
        );

      case 'curator':
        return (
          <div className="space-y-5">
            <div className="text-center">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Step 1 of 8</p>
              <h3 className="text-lg font-semibold">Open Your Production Report</h3>
              <p className="text-sm text-muted-foreground mt-1">
                We'll compare what you've tracked with Vivint's official numbers
              </p>
            </div>

            <Button
              variant="outline"
              className="w-full h-14 justify-between rounded-2xl"
              onClick={() => window.open(CURATOR_PRODUCTION_URL, '_blank')}
            >
              <span className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                Open Curator Production Report
              </span>
              <ChevronRight className="h-4 w-4" />
            </Button>

            <Card className="border-primary/20 bg-primary/5 rounded-2xl">
              <CardContent className="pt-4 space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-primary" />
                  Quick steps:
                </p>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside pl-1">
                  <li>Find the <strong>filter button</strong>, then filter by your name under "Rep"</li>
                  <li>Change the <strong>"Funded"</strong> dropdown to <strong>"(All)"</strong></li>
                </ol>
                <p className="text-xs text-muted-foreground pt-1">
                  We want your full picture — funded AND unfunded — so we can help you sell more profitably and reduce cancels.
                </p>
              </CardContent>
            </Card>
          </div>
        );

      case 'fp_plus':
        return (
          <div className="space-y-5">
            <div className="text-center">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Step 2 of 8</p>
              <h3 className="text-lg font-semibold">Total {metricLabel}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                What's your total {metricLabel} this {seasonType}?
              </p>
            </div>

            <div className="space-y-3">
              <ChoiceChip
                selected={fpChoice === 'tracked'}
                label={`Use what I've tracked: ${trackedFp.toFixed(1)} ${metricLabel}`}
                sublabel="This matches what I see on Curator"
                onSelect={() => { setFpChoice('tracked'); }}
              />
              <ChoiceChip
                selected={fpChoice === 'vivint'}
                label="Enter Vivint's number"
                sublabel="My Curator total is different"
                onSelect={() => setFpChoice('vivint')}
              />
            </div>

            {fpChoice === 'vivint' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="pt-2"
              >
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder={`e.g., ${trackedFp.toFixed(1)}`}
                  value={fpVivint}
                  onChange={(e) => setFpVivint(e.target.value)}
                  className="text-2xl h-14 text-center rounded-2xl"
                  autoFocus
                />
                {fpVivint && Math.abs(parseFloat(fpVivint) - trackedFp) >= 0.5 && (
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    Delta: {(parseFloat(fpVivint) - trackedFp) > 0 ? '+' : ''}{(parseFloat(fpVivint) - trackedFp).toFixed(1)} {metricLabel} from tracked
                  </p>
                )}
              </motion.div>
            )}
          </div>
        );

      case 'fp_sold':
        return (
          <div className="space-y-5">
            <div className="text-center">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Step 3 of 8</p>
              <h3 className="text-lg font-semibold">Total FP Sold</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Families protected count (not upgrades)
              </p>
            </div>

            <div className="space-y-3">
              <ChoiceChip
                selected={fpSoldChoice === 'tracked'}
                label={`Use what I've tracked: ${trackedFpSold} FP sold`}
                sublabel="This matches what I see on Curator"
                onSelect={() => setFpSoldChoice('tracked')}
              />
              <ChoiceChip
                selected={fpSoldChoice === 'vivint'}
                label="Enter Vivint's number"
                sublabel="My Curator total is different"
                onSelect={() => setFpSoldChoice('vivint')}
              />
            </div>

            {fpSoldChoice === 'vivint' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="pt-2"
              >
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder={`e.g., ${trackedFpSold}`}
                  value={fpSoldVivint}
                  onChange={(e) => setFpSoldVivint(e.target.value)}
                  className="text-2xl h-14 text-center rounded-2xl"
                  autoFocus
                />
              </motion.div>
            )}
          </div>
        );

      case 'prmr':
        return (
          <div className="space-y-5">
            <div className="text-center">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Step 4 of 8</p>
              <h3 className="text-lg font-semibold">Total PRMR YTD</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Your total PRMR for this {seasonType}
              </p>
            </div>

            <div className="space-y-3">
              <ChoiceChip
                selected={prmrChoice === 'tracked'}
                label={`Use what I've tracked: $${trackedPrmr.toFixed(0)}`}
                sublabel="This matches what I see on Curator"
                onSelect={() => setPrmrChoice('tracked')}
              />
              <ChoiceChip
                selected={prmrChoice === 'vivint'}
                label="Enter Vivint's number"
                sublabel="My Curator total is different"
                onSelect={() => setPrmrChoice('vivint')}
              />
            </div>

            {prmrChoice === 'vivint' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="pt-2"
              >
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder={`e.g., ${trackedPrmr.toFixed(0)}`}
                  value={prmrVivint}
                  onChange={(e) => setPrmrVivint(e.target.value)}
                  className="text-2xl h-14 text-center rounded-2xl"
                  autoFocus
                />
                {prmrVivint && Math.abs(parseFloat(prmrVivint) - trackedPrmr) >= 42.5 && (
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    Delta: {(parseFloat(prmrVivint) - trackedPrmr) > 0 ? '+' : ''}${(parseFloat(prmrVivint) - trackedPrmr).toFixed(0)} from tracked
                  </p>
                )}
              </motion.div>
            )}
          </div>
        );

      case 'knocking_days':
        return (
          <div className="space-y-5">
            <div className="text-center">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Step 5 of 8</p>
              <h3 className="text-lg font-semibold">Days Worked</h3>
              <p className="text-sm text-muted-foreground mt-1">
                This helps us calculate your daily pace target
              </p>
            </div>

            <div className="space-y-3">
              <ChoiceChip
                selected={knockingChoice === 'tracked'}
                label={`Use what I've tracked: ${trackedKnockingDays} days`}
                sublabel="I know this is accurate"
                onSelect={() => setKnockingChoice('tracked')}
              />
              <ChoiceChip
                selected={knockingChoice === 'manual'}
                label="Enter total days worked"
                sublabel="I know the actual number"
                onSelect={() => setKnockingChoice('manual')}
              />
              <ChoiceChip
                selected={knockingChoice === 'unknown'}
                label="I'm not sure"
                sublabel="Calculate pace based on future days only"
                onSelect={() => setKnockingChoice('unknown')}
                variant="outline"
              />
            </div>

            {knockingChoice === 'manual' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="pt-2"
              >
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder={`e.g., ${trackedKnockingDays}`}
                  value={knockingManual}
                  onChange={(e) => setKnockingManual(e.target.value)}
                  className="text-2xl h-14 text-center rounded-2xl"
                  autoFocus
                />
              </motion.div>
            )}

            {knockingChoice === 'unknown' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
              >
                <Card className="border-primary/20 bg-primary/5 rounded-2xl">
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">
                      No problem — we'll calculate your pace based on the days you track going forward. The more days you log, the more accurate your pace gets.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        );

      case 'source':
        return (
          <div className="space-y-5">
            <div className="text-center">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Step 6 of 8</p>
              <h3 className="text-lg font-semibold">Check for Unfunded Accounts</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Let's make sure your funded/unfunded status is accurate
              </p>
            </div>

            <Button
              variant="outline"
              className="w-full h-14 justify-between rounded-2xl"
              onClick={() => window.open(SOURCE_EARNINGS_URL, '_blank')}
            >
              <span className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                Open Source → Earnings
              </span>
              <ChevronRight className="h-4 w-4" />
            </Button>

            <Card className="border-primary/20 bg-primary/5 rounded-2xl">
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">
                  Scroll down and look for any accounts that have gone <strong>unfunded</strong> or <strong>cancelled</strong>. We'll update those next.
                </p>
              </CardContent>
            </Card>
          </div>
        );

      case 'crm':
        return (
          <div className="space-y-5">
            <div className="text-center">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Step 7 of 8</p>
              <h3 className="text-lg font-semibold">Update Your CRM</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Mark any unfunded/cancelled accounts so your pace stays accurate
              </p>
            </div>

            <Button
              variant="outline"
              className="w-full h-14 justify-between rounded-2xl"
              onClick={() => navigate('/customers')}
            >
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Open Kaizen Customers
              </span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        );

      case 'confirm':
        return (
          <div className="space-y-5">
            <div className="text-center">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Step 8 of 8</p>
              <h3 className="text-lg font-semibold">Confirm & Sync</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Here's what we'll save as your verified {seasonType} totals
              </p>
            </div>

            <Card className="rounded-2xl">
              <CardContent className="pt-6 space-y-4">
                <SummaryRow label={`${metricLabel} Total`} value={finalFp.toFixed(1)} tracked={trackedFp} source={fpChoice} />
                <SummaryRow label="FP Sold" value={String(finalFpSold)} tracked={trackedFpSold} source={fpSoldChoice} isInt />
                <SummaryRow label="PRMR" value={`$${finalPrmr.toFixed(0)}`} tracked={trackedPrmr} source={prmrChoice} prefix="$" />
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Knocking Days</span>
                  <div className="text-right">
                    <span className="text-lg font-semibold">
                      {finalKnockingDays !== null ? finalKnockingDays : 'Unknown'}
                    </span>
                    {knockingChoice === 'unknown' && (
                      <p className="text-xs text-muted-foreground">Pace based on future days</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );
    }
  };

  return (
    <div className="p-4 pb-24 min-h-[70vh] flex flex-col">
      {/* Progress bar */}
      <div className="flex justify-center gap-1.5 mb-6">
        {STEPS.map((s, idx) => (
          <div
            key={s}
            className={cn(
              "h-1.5 rounded-full transition-all",
              idx === stepIndex 
                ? "w-8 bg-primary" 
                : idx < stepIndex 
                  ? "w-3 bg-primary/50" 
                  : "w-3 bg-muted"
            )}
          />
        ))}
      </div>

      {/* Step content */}
      <div className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex gap-3 mt-6">
        {step !== 'intro' && (
          <Button variant="outline" onClick={handleBack} className="flex-1 h-12 rounded-2xl">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        )}
        
        {step === 'confirm' ? (
          <Button 
            onClick={handleSubmit} 
            disabled={isUpserting} 
            className="flex-1 h-12 rounded-2xl"
          >
            {isUpserting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            Confirm & Sync
          </Button>
        ) : (
          <Button 
            onClick={handleNext} 
            disabled={!canProceed()} 
            className="flex-1 h-12 rounded-2xl"
          >
            {step === 'intro' ? "Let's go" : 'Next'}
            {step === 'intro' ? <ArrowRight className="h-4 w-4 ml-2" /> : <ChevronRight className="h-4 w-4 ml-1" />}
          </Button>
        )}
      </div>
    </div>
  );
};

// Summary row helper for confirmation step
const SummaryRow = ({ 
  label, value, tracked, source, prefix = '', isInt = false 
}: { 
  label: string; value: string; tracked: number; source: MetricChoice; prefix?: string; isInt?: boolean 
}) => {
  const trackedStr = isInt ? String(Math.round(tracked)) : (prefix ? `${prefix}${tracked.toFixed(prefix === '$' ? 0 : 1)}` : tracked.toFixed(1));
  const diff = source === 'vivint' ? (parseFloat(value.replace('$', '')) - tracked) : 0;
  
  return (
    <div className="flex justify-between items-center">
      <span className="text-muted-foreground">{label}</span>
      <div className="text-right">
        <span className="text-lg font-semibold">{value}</span>
        {source === 'vivint' && Math.abs(diff) >= 0.5 && (
          <p className="text-xs text-muted-foreground">
            {diff > 0 ? '+' : ''}{isInt ? Math.round(diff) : diff.toFixed(1)} from tracked
          </p>
        )}
      </div>
    </div>
  );
};
