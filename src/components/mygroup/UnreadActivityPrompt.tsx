import { Bell, ChevronRight, X, AlertTriangle, Flame, TrendingDown, Clock } from "lucide-react";
import type { PerformanceAlert } from "@/hooks/usePerformanceAlerts";
import { cn } from "@/lib/utils";

interface UnreadActivityPromptProps {
  unreadCount: number;
  onTap: () => void;
  onDismiss: () => void;
  performanceAlerts?: PerformanceAlert[];
  onAlertTap?: (alert: PerformanceAlert) => void;
}

const alertIcon = (type: PerformanceAlert['type']) => {
  switch (type) {
    case 'effort-no-results': return <AlertTriangle className="h-3.5 w-3.5" />;
    case 'streak': case 'milestone': return <Flame className="h-3.5 w-3.5" />;
    case 'attendance': return <Clock className="h-3.5 w-3.5" />;
    case 'pace-warning': return <TrendingDown className="h-3.5 w-3.5" />;
  }
};

const alertColors = (severity: PerformanceAlert['severity']) => {
  switch (severity) {
    case 'critical': return 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300';
    case 'warning': return 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50 text-amber-700 dark:text-amber-300';
    case 'info': return 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300';
  }
};

export const UnreadActivityPrompt = ({ 
  unreadCount, 
  onTap, 
  onDismiss,
  performanceAlerts = [],
  onAlertTap,
}: UnreadActivityPromptProps) => {
  const hasAlerts = performanceAlerts.length > 0;
  const hasUnread = unreadCount > 0;
  
  if (!hasUnread && !hasAlerts) return null;

  // Show top 3 performance alerts
  const topAlerts = performanceAlerts.slice(0, 3);
  const remainingAlerts = performanceAlerts.length - topAlerts.length;
  
  return (
    <div className="space-y-2">
      {/* Unread activity updates */}
      {hasUnread && (
        <div 
          className="flex items-center justify-between bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl p-3 cursor-pointer active:opacity-80 transition-opacity"
          onClick={onTap}
        >
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
              {unreadCount} new update{unreadCount !== 1 ? 's' : ''} from your team
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-amber-600 dark:text-amber-400">View</span>
            <ChevronRight className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <button 
              onClick={(e) => { 
                e.stopPropagation(); 
                onDismiss(); 
              }}
              className="text-amber-400 hover:text-amber-600 dark:text-amber-500 dark:hover:text-amber-300 p-1 -m-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Performance alerts */}
      {topAlerts.map((alert) => (
        <div
          key={alert.id}
          className={cn(
            "flex items-center gap-2.5 border rounded-xl p-3 cursor-pointer active:opacity-80 transition-opacity",
            alertColors(alert.severity)
          )}
          onClick={() => onAlertTap?.(alert)}
        >
          <div className="shrink-0">{alertIcon(alert.type)}</div>
          <span className="text-sm font-medium flex-1 line-clamp-1">
            {alert.message}
          </span>
          {alert.detail && (
            <span className="text-xs opacity-70 shrink-0 hidden sm:inline">
              {alert.detail}
            </span>
          )}
        </div>
      ))}
      
      {remainingAlerts > 0 && (
        <button
          onClick={onTap}
          className="w-full text-center text-xs text-muted-foreground py-1 hover:text-foreground transition-colors"
        >
          +{remainingAlerts} more alert{remainingAlerts !== 1 ? 's' : ''}
        </button>
      )}
    </div>
  );
};
