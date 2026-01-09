import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePendingSalesQueue } from '@/hooks/usePendingSalesQueue';
import { useQueryClient } from '@tanstack/react-query';

interface PendingSalesAlertProps {
  userId: string | null;
}

export const PendingSalesAlert = ({ userId }: PendingSalesAlertProps) => {
  const { hasPendingSales, getPendingCount, processQueue } = usePendingSalesQueue(userId);
  const [pendingCount, setPendingCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const queryClient = useQueryClient();

  // Check for pending sales on mount and periodically
  useEffect(() => {
    if (!userId) return;

    const checkPending = () => {
      setPendingCount(getPendingCount());
    };

    checkPending();
    const interval = setInterval(checkPending, 5000);

    return () => clearInterval(interval);
  }, [userId, getPendingCount]);

  const handleRetry = async () => {
    setIsRetrying(true);
    await processQueue();
    setPendingCount(getPendingCount());
    
    // Invalidate queries to refresh data
    queryClient.invalidateQueries({ queryKey: ['daily-entry'], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ['customer-sales'], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ['activity-summary'], refetchType: 'all' });
    
    setIsRetrying(false);
  };

  if (!userId || pendingCount === 0) return null;

  return (
    <div className="bg-amber-500/20 border border-amber-500/50 rounded-lg p-3 mx-4 mb-3 animate-fade-in">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-100">
            {pendingCount} unsaved sale{pendingCount > 1 ? 's' : ''} pending
          </p>
          <p className="text-xs text-amber-200/70 mt-0.5">
            Waiting for connection to sync
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRetry}
          disabled={isRetrying}
          className="text-amber-100 hover:text-amber-50 hover:bg-amber-500/30"
        >
          <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
        </Button>
      </div>
    </div>
  );
};
