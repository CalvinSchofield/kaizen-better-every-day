import { cn } from "@/lib/utils";

type SyncStatus = 'synced' | 'pending' | 'offline' | 'error';

interface SyncIndicatorProps {
  status: SyncStatus;
  className?: string;
  pendingCount?: number;
}

export const SyncIndicator = ({ status, className, pendingCount }: SyncIndicatorProps) => {
  const colors = {
    synced: 'bg-green-500',
    pending: 'bg-amber-500 animate-pulse',
    offline: 'bg-blue-500 animate-pulse',
    error: 'bg-red-500',
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div className={cn("h-2.5 w-2.5 rounded-full", colors[status])} />
      {pendingCount != null && pendingCount > 0 && (
        <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
          {pendingCount}
        </span>
      )}
    </div>
  );
};
