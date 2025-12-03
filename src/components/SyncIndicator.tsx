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

  return (
    <div className={cn("h-2.5 w-2.5 rounded-full", colors[status], className)} />
  );
};
