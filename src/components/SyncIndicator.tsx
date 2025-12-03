import { cn } from "@/lib/utils";

type SyncStatus = 'synced' | 'pending' | 'error';

interface SyncIndicatorProps {
  status: SyncStatus;
  className?: string;
}

export const SyncIndicator = ({ status, className }: SyncIndicatorProps) => {
  const colors = {
    synced: 'bg-green-500',
    pending: 'bg-amber-500 animate-pulse',
    error: 'bg-red-500',
  };

  const labels = {
    synced: 'Saved',
    pending: 'Saving...',
    error: 'Not saved',
  };

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div className={cn("h-2 w-2 rounded-full", colors[status])} />
      <span className="text-xs text-muted-foreground">{labels[status]}</span>
    </div>
  );
};
