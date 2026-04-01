import { useCurrentSalesStreak } from "@/hooks/useCurrentSalesStreak";
import { useStreakProtection } from "@/hooks/useStreakProtection";
import { Flame, Shield, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface StreakContextCardProps {
  userId: string | null;
}

export const StreakContextCard = ({ userId }: StreakContextCardProps) => {
  const { data: streakData } = useCurrentSalesStreak(userId);
  const { data: protectionData } = useStreakProtection(userId);

  if (!streakData || !userId) return null;

  const streak = streakData.streak;
  const shieldCount = streakData.shieldCount || 0;
  const hasActiveRecovery = protectionData?.hasActiveRecovery || false;
  const recoveryWindow = protectionData?.recoveryWindow;

  // No active streak and no recovery → don't show
  if (streak === 0 && !hasActiveRecovery) return null;

  // Determine state
  const lastProtection = protectionData?.protections?.[0];
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const shieldedYesterday = lastProtection?.entry_date === yesterday;

  // Recovery window active
  if (hasActiveRecovery && recoveryWindow) {
    const targetFp = recoveryWindow.target_fp || 0;
    const targetPrmr = recoveryWindow.target_prmr || 0;
    const targetDoors = recoveryWindow.target_doors || 0;
    const daysUsed = Array.isArray(recoveryWindow.knocking_days_used) ? recoveryWindow.knocking_days_used.length : 0;
    const daysRemaining = 2 - daysUsed;

    return (
      <div className={cn(
        "rounded-2xl border px-4 py-3.5 space-y-2",
        "bg-warning/8 border-warning/25"
      )}>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" />
          <span className="text-sm font-semibold text-foreground">
            Your streak is on the line
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {daysRemaining} knocking {daysRemaining === 1 ? "day" : "days"} to earn it back. Hit one of these targets:
        </p>
        <div className="flex gap-3 pt-0.5">
          {targetFp > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-semibold text-foreground">{targetFp.toFixed(1)}</span>
              <span className="text-muted-foreground">FP+</span>
            </div>
          )}
          {targetPrmr > 0 && (
            <>
              <span className="text-muted-foreground/40 text-xs">or</span>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="font-semibold text-foreground">${Math.round(targetPrmr)}</span>
                <span className="text-muted-foreground">PRMR</span>
              </div>
            </>
          )}
          {targetDoors > 0 && (
            <>
              <span className="text-muted-foreground/40 text-xs">or</span>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="font-semibold text-foreground">{targetDoors}</span>
                <span className="text-muted-foreground">doors</span>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Shielded yesterday
  if (shieldedYesterday && streak > 0) {
    return (
      <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-base">🔥</span>
          <Shield className="h-3.5 w-3.5 text-primary/70" />
          <span className="text-sm font-semibold text-foreground">
            Day {streak} — your effort yesterday saved your streak
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1 ml-[3.25rem]">
          Let's sell today.
        </p>
      </div>
    );
  }

  // Healthy streak
  if (streak > 0) {
    return (
      <div className="rounded-2xl border border-orange-500/15 bg-orange-500/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-base">🔥</span>
          <span className="text-sm font-semibold text-foreground">
            Day {streak} — keep it going today
          </span>
        </div>
      </div>
    );
  }

  return null;
};
