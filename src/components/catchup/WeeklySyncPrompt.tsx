import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, AlertCircle, RefreshCw, Loader2, Edit2, ExternalLink, ChevronRight, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle,
  DrawerDescription,
  DrawerFooter
} from "@/components/ui/drawer";
import { useOfficialTotals } from "@/hooks/useOfficialTotals";
import { useEffectiveFP } from "@/hooks/useEffectiveFP";
import { useCurrentUserId } from "@/hooks/useCurrentUserId";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface WeeklySyncPromptProps {
  seasonType: 'preseason' | 'summer';
  seasonStartDate: string;
  seasonEndDate: string;
  timezone?: string | null;
}

const PROMPT_STORAGE_KEY = 'last-sync-prompt';
const MIN_DAYS_BETWEEN_PROMPTS = 5;

// Calvin's user ID for testing bypass
const TEST_USER_IDS = ['843dac61-139d-4511-a057-c3bf359a9c07'];

// External URLs
const CURATOR_PRODUCTION_URL = 'https://curator.vivint.com/dashboard/production-test-production-report';
const SOURCE_EARNINGS_URL = 'https://curator.vivint.com/dashboard/source-accountdetailsearnings?';

// Check if we should show the prompt (based on localStorage cooldown)
const shouldShowPrompt = (userId: string, seasonType: string): boolean => {
  const key = `${PROMPT_STORAGE_KEY}-${userId}-${seasonType}`;
  const lastPrompt = localStorage.getItem(key);
  
  if (!lastPrompt) return true;
  
  const lastPromptDate = new Date(lastPrompt);
  const daysSincePrompt = (Date.now() - lastPromptDate.getTime()) / (1000 * 60 * 60 * 24);
  
  return daysSincePrompt >= MIN_DAYS_BETWEEN_PROMPTS;
};

/**
 * Check if we should show the sync prompt based on rep's local time.
 * BLOCKED during knocking hours:
 * - Mon-Fri: 12 PM - 9 PM
 * - Saturday: 9 AM - 9 PM
 * ALLOWED all other times (mornings, evenings, Sunday)
 */
const isOutsideKnockingHours = (timezone: string | null | undefined): boolean => {
  try {
    const now = new Date();
    
    // Get day and hour in rep's timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'America/Los_Angeles',
      weekday: 'short',
      hour: 'numeric',
      hour12: false,
    });
    
    const parts = formatter.formatToParts(now);
    const weekday = parts.find(p => p.type === 'weekday')?.value;
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
    
    // Sunday - no knocking hours, always show
    if (weekday === 'Sun') return true;
    
    // Saturday - knocking hours 9 AM to 9 PM
    if (weekday === 'Sat') {
      return hour < 9 || hour >= 21; // Before 9 AM or 9 PM onward
    }
    
    // Mon-Fri - knocking hours noon (12) to 9 PM (21)
    return hour < 12 || hour >= 21; // Before noon or 9 PM onward
  } catch {
    // Fallback: allow prompt if timezone parsing fails
    return true;
  }
};

type SyncStep = 1 | 2 | 3 | 'adjust';

export const WeeklySyncPrompt = ({ 
  seasonType, 
  seasonStartDate, 
  seasonEndDate,
  timezone 
}: WeeklySyncPromptProps) => {
  const { userId } = useCurrentUserId();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<SyncStep>(1);
  const [adjustedFp, setAdjustedFp] = useState('');
  const [adjustedPrmr, setAdjustedPrmr] = useState('');
  
  const { data: effectiveData, isLoading: effectiveLoading } = useEffectiveFP({
    seasonType,
    seasonStartDate,
    seasonEndDate,
  });
  
  const { 
    upsertTotalsAsync, 
    verifyTotals, 
    isUpserting, 
    isVerifying 
  } = useOfficialTotals(seasonType);

  // Check if we should show the prompt
  useEffect(() => {
    if (!userId || effectiveLoading || !effectiveData) return;
    
    // Testing bypass: always show for test users
    const isTestUser = TEST_USER_IDS.includes(userId);
    
    // Show if:
    // - NORMAL users: needs verification AND outside knocking hours AND not recently shown (cooldown)
    // - TEST users (Calvin): always show (bypass time + cooldown + needsVerification) so we can validate UI quickly
    const shouldShow = isTestUser
      ? true
      : effectiveData.needsVerification &&
        isOutsideKnockingHours(timezone) &&
        shouldShowPrompt(userId, seasonType);
    
    if (shouldShow) {
      // Small delay to not interrupt page load
      const timer = setTimeout(() => setOpen(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [userId, effectiveData, effectiveLoading, seasonType, timezone]);

  const handleVerify = () => {
    verifyTotals({ seasonType });
    markPromptShown();
    setOpen(false);
  };

  const handleAdjust = async () => {
    const newFp = parseFloat(adjustedFp) || effectiveData?.effectiveFp || 0;
    const newPrmr = parseFloat(adjustedPrmr) || effectiveData?.effectivePrmr || 0;
    
    try {
      await upsertTotalsAsync({
        season_year: 2025,
        season_type: seasonType,
        fp_plus: newFp,
        prmr: newPrmr,
        knocking_days: effectiveData?.effectiveKnockingDays || 0,
        verified_by: 'self',
        notes: `Adjusted from ${effectiveData?.effectiveFp} to ${newFp} FP+`,
      });
      markPromptShown();
      setOpen(false);
    } catch (error) {
      console.error('Failed to adjust totals:', error);
    }
  };

  const handleRemindLater = () => {
    // Don't mark as shown - will show again tomorrow
    setOpen(false);
  };

  const markPromptShown = () => {
    if (userId) {
      localStorage.setItem(
        `${PROMPT_STORAGE_KEY}-${userId}-${seasonType}`, 
        new Date().toISOString()
      );
    }
  };

  const openExternalLink = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const goToCustomers = () => {
    setOpen(false);
    navigate('/customers');
  };

  if (!effectiveData || effectiveLoading) return null;

  const lastVerifiedText = effectiveData.lastVerifiedAt
    ? `Last verified ${effectiveData.daysSinceVerification} days ago`
    : 'Never verified';

  const stepIndicator = (
    <div className="flex items-center justify-center gap-2 mb-4">
      {[1, 2, 3].map((s) => (
        <div
          key={s}
          className={cn(
            "w-2 h-2 rounded-full transition-colors",
            step === s || (step === 'adjust' && s === 3)
              ? "bg-primary"
              : typeof step === 'number' && s < step
              ? "bg-primary/50"
              : "bg-muted"
          )}
        />
      ))}
    </div>
  );

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerContent className="max-h-[90dvh]">
        <DrawerHeader className="border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <RefreshCw className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <DrawerTitle>Weekly Sync Check</DrawerTitle>
              <DrawerDescription>Keep your numbers accurate</DrawerDescription>
            </div>
          </div>
        </DrawerHeader>

        <div className="p-6 overflow-y-auto">
          {stepIndicator}
          
          <AnimatePresence mode="wait">
            {/* STEP 1: Check Production Report */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div className="text-center">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Step 1 of 3
                  </p>
                  <h3 className="text-lg font-semibold">Check Your Production Report</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Open Curator to see your total FP+ sold
                  </p>
                </div>

                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Kaizen shows:</span>
                      <span className="text-lg font-bold">{effectiveData.effectiveFp.toFixed(1)} FP+</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {lastVerifiedText}
                    </p>
                  </CardContent>
                </Card>

                <Button
                  variant="outline"
                  className="w-full h-12 justify-between"
                  onClick={() => openExternalLink(CURATOR_PRODUCTION_URL)}
                >
                  <span className="flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Open Production Report
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </Button>

                <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
                  <CardContent className="pt-4 flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-amber-800 dark:text-amber-200">
                        Important: Check All Accounts
                      </p>
                      <p className="text-amber-700 dark:text-amber-300">
                        Change the <strong>"Funded"</strong> dropdown to <strong>"(All)"</strong> to see both funded AND unfunded accounts.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* STEP 2: Review Unfunded Accounts */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div className="text-center">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Step 2 of 3
                  </p>
                  <h3 className="text-lg font-semibold">Review Unfunded Accounts</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Compare Source to your Kaizen CRM
                  </p>
                </div>

                <div className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full h-12 justify-between"
                    onClick={() => openExternalLink(SOURCE_EARNINGS_URL)}
                  >
                    <span className="flex items-center gap-2">
                      <ExternalLink className="h-4 w-4" />
                      Open Account Details (Source)
                    </span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full h-12 justify-between"
                    onClick={goToCustomers}
                  >
                    <span className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Open Kaizen Customers
                    </span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20">
                  <CardContent className="pt-4 flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-blue-800 dark:text-blue-200">
                        Check for Unfunded Accounts
                      </p>
                      <p className="text-blue-700 dark:text-blue-300">
                        Make sure the unfunded accounts in Source match what you have in your Kaizen Customers page. These may need follow-up for funding.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* STEP 3: Confirm or Adjust */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div className="text-center">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Step 3 of 3
                  </p>
                  <h3 className="text-lg font-semibold">Confirm Your Totals</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Does Kaizen match what Curator shows?
                  </p>
                </div>

                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center space-y-2">
                      <p className="text-2xl font-bold">
                        {effectiveData.effectiveFp.toFixed(1)} FP+
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Your current {seasonType} total in Kaizen
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {effectiveData.hasDiscrepancy && (
                  <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
                    <CardContent className="pt-4 flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-amber-800 dark:text-amber-200">
                          Possible discrepancy detected
                        </p>
                        <p className="text-amber-700 dark:text-amber-300">
                          {effectiveData.discrepancyAmount > 0 
                            ? `You may have ~${effectiveData.discrepancyAmount.toFixed(1)} untracked FP+`
                            : `Tracked total is ${Math.abs(effectiveData.discrepancyAmount).toFixed(1)} higher than baseline`
                          }
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </motion.div>
            )}

            {/* ADJUST MODE */}
            {step === 'adjust' && (
              <motion.div
                key="adjust"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center mb-4">
                  <p className="font-medium">Update your official numbers</p>
                  <p className="text-sm text-muted-foreground">
                    Enter what Curator shows for your totals
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="adjust-fp">FP+ (from Curator)</Label>
                    <Input
                      id="adjust-fp"
                      type="number"
                      inputMode="decimal"
                      placeholder={effectiveData.effectiveFp.toFixed(1)}
                      value={adjustedFp}
                      onChange={(e) => setAdjustedFp(e.target.value)}
                      className="text-lg"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="adjust-prmr">PRMR (from Curator)</Label>
                    <Input
                      id="adjust-prmr"
                      type="number"
                      inputMode="decimal"
                      placeholder={effectiveData.effectivePrmr.toFixed(0)}
                      value={adjustedPrmr}
                      onChange={(e) => setAdjustedPrmr(e.target.value)}
                      className="text-lg"
                    />
                  </div>
                </div>

                <Button
                  variant="ghost"
                  onClick={() => setStep(3)}
                  className="w-full"
                >
                  Cancel
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <DrawerFooter className="border-t">
          {step === 1 && (
            <Button onClick={() => setStep(2)} className="w-full">
              Continue
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          )}

          {step === 2 && (
            <div className="flex gap-3 w-full">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                Back
              </Button>
              <Button onClick={() => setStep(3)} className="flex-1">
                Continue
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}

          {step === 3 && (
            <div className="flex gap-3 w-full">
              <Button
                variant="outline"
                onClick={() => setStep('adjust')}
                className="flex-1"
              >
                <Edit2 className="h-4 w-4 mr-2" />
                No, adjust
              </Button>
              <Button
                onClick={handleVerify}
                disabled={isVerifying}
                className="flex-1"
              >
                {isVerifying ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Yes, matches
              </Button>
            </div>
          )}

          {step === 'adjust' && (
            <Button
              onClick={handleAdjust}
              disabled={isUpserting}
              className="w-full"
            >
              {isUpserting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Save updated numbers
            </Button>
          )}
          
          <Button
            variant="ghost"
            onClick={handleRemindLater}
            className="w-full text-muted-foreground"
          >
            Remind me later
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

// Trigger component that can be placed in the app
export const SyncPromptTrigger = ({ 
  seasonType,
  seasonStartDate,
  seasonEndDate,
  timezone
}: WeeklySyncPromptProps) => {
  return (
    <WeeklySyncPrompt 
      seasonType={seasonType}
      seasonStartDate={seasonStartDate}
      seasonEndDate={seasonEndDate}
      timezone={timezone}
    />
  );
};
