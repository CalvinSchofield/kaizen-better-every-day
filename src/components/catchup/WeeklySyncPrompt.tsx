import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, AlertCircle, RefreshCw, Loader2, Edit2 } from "lucide-react";
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
import { format } from "date-fns";

interface WeeklySyncPromptProps {
  seasonType: 'preseason' | 'summer';
  seasonStartDate: string;
  seasonEndDate: string;
}

const PROMPT_STORAGE_KEY = 'last-sync-prompt';
const MIN_DAYS_BETWEEN_PROMPTS = 5;

// Check if we should show the prompt
const shouldShowPrompt = (userId: string, seasonType: string): boolean => {
  const key = `${PROMPT_STORAGE_KEY}-${userId}-${seasonType}`;
  const lastPrompt = localStorage.getItem(key);
  
  if (!lastPrompt) return true;
  
  const lastPromptDate = new Date(lastPrompt);
  const daysSincePrompt = (Date.now() - lastPromptDate.getTime()) / (1000 * 60 * 60 * 24);
  
  return daysSincePrompt >= MIN_DAYS_BETWEEN_PROMPTS;
};

// Check if it's the right time to show (Sunday evening or Monday morning)
const isPromptTime = (): boolean => {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  
  // Sunday after 5pm, or Monday before noon
  return (day === 0 && hour >= 17) || (day === 1 && hour < 12);
};

export const WeeklySyncPrompt = ({ 
  seasonType, 
  seasonStartDate, 
  seasonEndDate 
}: WeeklySyncPromptProps) => {
  const { userId } = useCurrentUserId();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'verify' | 'adjust'>('verify');
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
    
    // Only show if: needs verification AND right time AND not recently shown
    const shouldShow = 
      effectiveData.needsVerification && 
      isPromptTime() && 
      shouldShowPrompt(userId, seasonType);
    
    if (shouldShow) {
      // Small delay to not interrupt page load
      const timer = setTimeout(() => setOpen(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [userId, effectiveData, effectiveLoading, seasonType]);

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

  if (!effectiveData || effectiveLoading) return null;

  const lastVerifiedText = effectiveData.lastVerifiedAt
    ? `Last verified ${effectiveData.daysSinceVerification} days ago`
    : 'Never verified';

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerContent className="max-h-[85dvh]">
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
          <AnimatePresence mode="wait">
            {mode === 'verify' ? (
              <motion.div
                key="verify"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center space-y-2">
                      <p className="text-2xl font-bold">
                        {effectiveData.effectiveFp.toFixed(1)} FP+
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Your current {seasonType} total
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {lastVerifiedText}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <div className="text-center space-y-3">
                  <p className="font-medium">
                    Does Vivint show approximately this FP+ total?
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Quick check to make sure we're in sync
                  </p>
                </div>

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
            ) : (
              <motion.div
                key="adjust"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="text-center mb-4">
                  <p className="font-medium">Update your official numbers</p>
                  <p className="text-sm text-muted-foreground">
                    Enter your current Vivint totals
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="adjust-fp">FP+ (from Vivint)</Label>
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
                    <Label htmlFor="adjust-prmr">PRMR (from Vivint)</Label>
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
                  onClick={() => setMode('verify')}
                  className="w-full"
                >
                  Cancel
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <DrawerFooter className="border-t">
          {mode === 'verify' ? (
            <div className="flex gap-3 w-full">
              <Button
                variant="outline"
                onClick={() => setMode('adjust')}
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
                Yes, looks right
              </Button>
            </div>
          ) : (
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
            Remind me tomorrow
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
  seasonEndDate 
}: WeeklySyncPromptProps) => {
  return (
    <WeeklySyncPrompt 
      seasonType={seasonType}
      seasonStartDate={seasonStartDate}
      seasonEndDate={seasonEndDate}
    />
  );
};
