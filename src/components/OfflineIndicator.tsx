import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const OfflineIndicator = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <Alert className="fixed top-4 left-4 right-4 z-50 bg-orange-500/10 border-orange-500/20 md:left-auto md:right-4 md:w-96">
      <WifiOff className="h-4 w-4 text-orange-500" />
      <AlertDescription className="text-orange-500">
        You're offline. Using cached data.
      </AlertDescription>
    </Alert>
  );
};

export default OfflineIndicator;
