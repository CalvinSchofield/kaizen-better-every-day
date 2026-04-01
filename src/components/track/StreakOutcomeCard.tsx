import { useCurrentSalesStreak } from "@/hooks/useCurrentSalesStreak";
import { useStreakProtection } from "@/hooks/useStreakProtection";
import { Shield, Flame, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

interface StreakOutcomeCardProps {
  userId: string | null;
  closes: number;
  entryDate?: string;
}

export const StreakOutcomeCard = ({ userId, closes, entryDate }: StreakOutcomeCardProps) => {
  const { data: streakData } = useCurrentSalesStreak(userId);
  const { data: protectionData } = useStreakProtection(userId);

  if (!userId || !streakData) return null;

  const streak = streakData.streak;
  const todayDate = entryDate || new Date().toISOString().split("T")[0];
  const todayProtection = protectionData?.protections?.find(
    (p: any) => p.entry_date === todayDate
  );
  const hasActiveRecovery = protectionData?.hasActiveRecovery;
  const recoveryWindow = protectionData?.recoveryWindow;
  const recoveryStatus = recoveryWindow?.status;

  // Recovery just achieved
  if (recoveryStatus === "recovered") {
    return (
      <div className="rounded-2xl border border-green-500/20 bg-green-500/8 px-4 py-3.5">
        <div className="flex items-center gap-2">
          <span className="text-base">🔥</span>
          <Trophy className="h-4 w-4 text-green-500" />
          <span className="text-sm font-bold text-foreground">
            Streak Restored!
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1 ml-[3.25rem]">
          Incredible effort. Your {streak}-day streak lives on.
        </p>
      </div>
    );
  }

  // Sale made, streak continues
  if (closes >= 1 && streak > 0) {
    return (
      <div className="rounded-2xl border border-orange-500/15 bg-orange-500/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-base">🔥</span>
          <span className="text-sm font-semibold text-foreground">
            {streak}-Day Streak — another one in the books
          </span>
        </div>
      </div>
    );
  }

  // No sale, protection earned today
  if (closes === 0 && todayProtection) {
    return (
      <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3.5">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-foreground">
            Streak Protected
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1 ml-[1.75rem]">
          Your effort today earned you a shield. Day {streak} continues.
        </p>
      </div>
    );
  }

  // No sale, no protection, streak broken — show recovery targets
  if (closes === 0 && streak === 0 && hasActiveRecovery && recoveryWindow) {
    const targetFp = recoveryWindow.target_fp || 0;
    const targetPrmr = recoveryWindow.target_prmr || 0;
    const targetDoors = recoveryWindow.target_doors || 0;
    const restoredStreak = recoveryWindow.restored_streak || 0;

    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3.5 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">
            Your {restoredStreak}-day streak has ended
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Put in exceptional work over the next 2 knocking days to earn it back. Hit one of these targets:
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

  return null;
};
