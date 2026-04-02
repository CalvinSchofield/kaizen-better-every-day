import { cn } from "@/lib/utils";
import { Flame, Trophy, AlertTriangle, Clock, TrendingUp, Zap } from "lucide-react";
import { motion } from "framer-motion";

interface CoachingRep {
  userId: string;
  name: string;
  doors?: number;
  presentations?: number;
  transitions?: number;
  pitches?: number;
  closes?: number;
  fp?: number;
  isWorking?: boolean;
  workStartTime?: string | null;
  year?: string;
}

interface CoachingAlertItem {
  type: string;
  icon: React.ReactNode;
  label: string;
  detail: string;
  userId?: string;
  borderColor: string;
  bgColor: string;
  priority: number;
}

interface CoachingAlertsProps {
  reps: CoachingRep[];
  isLiveView?: boolean;
  isLoading?: boolean;
  onRepClick?: (userId: string) => void;
  // For team comparison alerts
  groupedByTeam?: Array<{
    teamName: string;
    totals: { fp: number };
    members: Array<{ userId: string }>;
  }>;
  maxAlerts?: number;
}

const getFirstName = (name: string) => {
  const stripped = name.replace(/[\p{Emoji}\p{Emoji_Component}]/gu, '').trim();
  return stripped.split(' ')[0] || stripped;
};

export const CoachingAlerts = ({ reps, isLiveView, isLoading, onRepClick, groupedByTeam, maxAlerts = 3 }: CoachingAlertsProps) => {
  if (isLoading || reps.length === 0) return null;

  const alerts: CoachingAlertItem[] = [];

  // 1. Hot streak: multiple closes
  const hotReps = reps.filter(r => (r.closes || 0) >= 2);
  hotReps.forEach(r => {
    alerts.push({
      type: 'hot_streak',
      icon: <Flame className="w-4 h-4 text-orange-500" />,
      label: `${getFirstName(r.name)} is on fire`,
      detail: `${r.closes} closes${r.fp ? ` · ${r.fp.toFixed(1)} FP+` : ''}`,
      userId: r.userId,
      borderColor: 'border-orange-500/30',
      bgColor: 'bg-orange-500/5',
      priority: 1,
    });
  });

  // 2. Effort without skill: many doors, zero transitions
  const noSkillReps = reps.filter(r => (r.doors || 0) >= 20 && (r.transitions || 0) === 0 && (r.presentations || 0) === 0);
  noSkillReps.forEach(r => {
    alerts.push({
      type: 'no_skill',
      icon: <AlertTriangle className="w-4 h-4 text-destructive" />,
      label: `${getFirstName(r.name)}: ${r.doors} doors, 0 transitions`,
      detail: 'Pitch training may be needed',
      userId: r.userId,
      borderColor: 'border-destructive/30',
      bgColor: 'bg-destructive/5',
      priority: 3,
    });
  });

  // 3. High effort, low conversion
  const lowConversion = reps.filter(r => (r.doors || 0) >= 30 && (r.pitches || 0) >= 10 && (r.presentations || 0) === 0);
  lowConversion.filter(r => !noSkillReps.includes(r)).forEach(r => {
    alerts.push({
      type: 'low_conversion',
      icon: <TrendingUp className="w-4 h-4 text-amber-500" />,
      label: `${getFirstName(r.name)}: pitching but not transitioning`,
      detail: `${r.pitches} pitches, ${r.doors} doors — work on transition language`,
      userId: r.userId,
      borderColor: 'border-amber-500/30',
      bgColor: 'bg-amber-500/5',
      priority: 4,
    });
  });

  // 4. Team comparison (top team ahead of others)
  if (groupedByTeam && groupedByTeam.length >= 2) {
    const sorted = [...groupedByTeam].sort((a, b) => b.totals.fp - a.totals.fp);
    const top = sorted[0];
    const second = sorted[1];
    if (top.totals.fp > 0 && second.totals.fp > 0) {
      const gap = ((top.totals.fp - second.totals.fp) / second.totals.fp * 100);
      if (gap > 10) {
        alerts.push({
          type: 'team_gap',
          icon: <Trophy className="w-4 h-4 text-primary" />,
          label: `${top.teamName} leads by ${gap.toFixed(0)}%`,
          detail: `${top.totals.fp.toFixed(1)} FP+ vs ${second.teamName} at ${second.totals.fp.toFixed(1)}`,
          borderColor: 'border-primary/30',
          bgColor: 'bg-primary/5',
          priority: 5,
        });
      }
    }
  }

  // 5. Not started (live view only)
  if (isLiveView) {
    const notStarted = reps.filter(r => !r.isWorking && (r.doors || 0) === 0);
    if (notStarted.length > 0 && notStarted.length <= 5) {
      notStarted.forEach(r => {
        alerts.push({
          type: 'not_started',
          icon: <Clock className="w-4 h-4 text-muted-foreground" />,
          label: `${getFirstName(r.name)} hasn't started`,
          detail: 'No field activity recorded today',
          userId: r.userId,
          borderColor: 'border-border',
          bgColor: 'bg-muted/30',
          priority: 6,
        });
      });
    } else if (notStarted.length > 5) {
      alerts.push({
        type: 'not_started_group',
        icon: <Clock className="w-4 h-4 text-muted-foreground" />,
        label: `${notStarted.length} reps haven't started`,
        detail: 'No field activity recorded yet',
        borderColor: 'border-border',
        bgColor: 'bg-muted/30',
        priority: 6,
      });
    }
  }

  // 6. Rookie doing well (celebration)
  const goodRookies = reps.filter(r => r.year?.toLowerCase() === 'rookie' && (r.fp || 0) >= 1);
  goodRookies.forEach(r => {
    alerts.push({
      type: 'rookie_win',
      icon: <Zap className="w-4 h-4 text-primary" />,
      label: `${getFirstName(r.name)} with ${r.fp?.toFixed(1)} FP+`,
      detail: 'Rookie putting up numbers 🔥',
      userId: r.userId,
      borderColor: 'border-primary/30',
      bgColor: 'bg-primary/5',
      priority: 2,
    });
  });

  if (alerts.length === 0) return null;

  // Sort by priority and limit
  const topAlerts = alerts.sort((a, b) => a.priority - b.priority).slice(0, maxAlerts);

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Coaching Alerts</h3>
      <div className="space-y-2">
        {topAlerts.map((alert, i) => (
          <motion.div
            key={`${alert.type}-${alert.userId || i}`}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <button
              onClick={() => alert.userId && onRepClick?.(alert.userId)}
              disabled={!alert.userId}
              className={cn(
                "w-full rounded-xl border p-3 flex items-start gap-3 text-left transition-colors",
                alert.borderColor, alert.bgColor,
                alert.userId && "hover:bg-accent/10 active:scale-[0.99]"
              )}
            >
              <div className="mt-0.5 shrink-0">{alert.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold">{alert.label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{alert.detail}</p>
              </div>
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
