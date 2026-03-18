import { cn } from "@/lib/utils";
import { Flame, Trophy, AlertTriangle, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { RepWithEffort } from "@/hooks/useReportsV2Data";

interface AlertsHighlightsProps {
  reps: RepWithEffort[];
  isLiveView?: boolean;
  isLoading?: boolean;
  onRepClick?: (userId: string) => void;
}

interface AlertItem {
  type: 'hot_streak' | 'stuck' | 'not_started' | 'record_pace';
  icon: React.ReactNode;
  label: string;
  names: string[];
  userIds: string[];
  borderColor: string;
  bgColor: string;
}

const getFirstName = (name: string) => {
  const stripped = name.replace(/[\p{Emoji}\p{Emoji_Component}]/gu, '').trim();
  return stripped.split(' ')[0] || stripped;
};

export const AlertsHighlights = ({ reps, isLiveView, isLoading, onRepClick }: AlertsHighlightsProps) => {
  if (isLoading || reps.length === 0) return null;

  const alerts: AlertItem[] = [];

  // Hot streak: multiple closes
  const hotReps = reps.filter(r => r.closes >= 2);
  if (hotReps.length > 0) {
    alerts.push({
      type: 'hot_streak',
      icon: <Flame className="w-4 h-4 text-orange-500" />,
      label: 'On fire',
      names: hotReps.map(r => r.name),
      userIds: hotReps.map(r => r.userId),
      borderColor: 'border-orange-500/30',
      bgColor: 'bg-orange-500/5',
    });
  }

  // Stuck: many doors, zero results
  const stuckReps = reps.filter(r => r.doors >= 30 && r.closes === 0 && r.presentations === 0);
  if (stuckReps.length > 0) {
    alerts.push({
      type: 'stuck',
      icon: <AlertTriangle className="w-4 h-4 text-destructive" />,
      label: 'High effort, no results',
      names: stuckReps.map(r => r.name),
      userIds: stuckReps.map(r => r.userId),
      borderColor: 'border-destructive/30',
      bgColor: 'bg-destructive/5',
    });
  }

  // Not started (live view only)
  if (isLiveView) {
    const notStarted = reps.filter(r => !r.workStartTime && r.doors === 0);
    if (notStarted.length > 0) {
      alerts.push({
        type: 'not_started',
        icon: <Clock className="w-4 h-4 text-muted-foreground" />,
        label: "Haven't started",
        names: notStarted.map(r => r.name),
        userIds: notStarted.map(r => r.userId),
        borderColor: 'border-border',
        bgColor: 'bg-muted/30',
      });
    }
  }

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground px-1">Alerts</h3>
      <div className="space-y-2">
        {alerts.map((alert, i) => (
          <motion.div
            key={alert.type}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className={cn(
              "rounded-xl border p-3 flex items-start gap-3",
              alert.borderColor, alert.bgColor
            )}
          >
            <div className="mt-0.5">{alert.icon}</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold">{alert.label}</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {alert.names.map((name, j) => (
                  <button
                    key={j}
                    onClick={() => onRepClick?.(alert.userIds[j])}
                    className="text-xs text-muted-foreground hover:text-foreground hover:underline transition-colors"
                  >
                    {getFirstName(name)}{j < alert.names.length - 1 ? ',' : ''}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
