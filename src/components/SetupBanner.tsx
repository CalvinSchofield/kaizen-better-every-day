import { useNavigate } from "react-router-dom";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRepGoals } from "@/hooks/useRepGoals";
import { useEffectiveFP } from "@/hooks/useEffectiveFP";
import { useState, useEffect } from "react";
import { useCurrentUserId } from "@/hooks/useCurrentUserId";

const PRESEASON_START = '2025-09-28';
const PRESEASON_END = '2026-04-11';

/**
 * Shows a persistent banner on Home when a user hasn't completed setup:
 * - No official_totals → "Sync your numbers"
 * - No goals.setup_complete → "Set your goals"
 * Dismissable per session, but comes back next app open.
 */
export const SetupBanner = () => {
  const navigate = useNavigate();
  const { goals, isLoading: goalsLoading, hasGoalsAccess } = useRepGoals();
  const { userId } = useCurrentUserId();
  const { data: effectiveFPData } = useEffectiveFP({
    seasonType: 'preseason',
    seasonStartDate: PRESEASON_START,
    seasonEndDate: PRESEASON_END,
  });
  
  const [dismissed, setDismissed] = useState(false);

  // Check session dismissal
  useEffect(() => {
    if (userId) {
      const key = `setup-banner-dismissed-${userId}`;
      if (sessionStorage.getItem(key)) {
        setDismissed(true);
      }
    }
  }, [userId]);

  if (dismissed || goalsLoading || !hasGoalsAccess) return null;

  const needsSync = effectiveFPData && !effectiveFPData.hasOfficialTotals;
  const needsGoals = !goals?.setup_complete;

  if (!needsSync && !needsGoals) return null;

  const message = needsSync
    ? "Sync your numbers with Curator to get accurate pacing."
    : "Set your goals to unlock pacing, earnings projections, and more.";

  const buttonLabel = needsSync ? "Sync Now" : "Set Goals";

  const handleDismiss = () => {
    setDismissed(true);
    if (userId) {
      sessionStorage.setItem(`setup-banner-dismissed-${userId}`, 'true');
    }
  };

  return (
    <div className="mx-4 mb-4 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center gap-3">
      <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">Finish setting up</p>
        <p className="text-xs text-muted-foreground">{message}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          variant="ghost"
          className="text-xs text-muted-foreground px-2 h-8"
          onClick={handleDismiss}
        >
          Later
        </Button>
        <Button
          size="sm"
          className="h-8 px-3 text-xs"
          onClick={() => navigate('/goals')}
        >
          {buttonLabel}
          <ChevronRight className="h-3 w-3 ml-1" />
        </Button>
      </div>
    </div>
  );
};
