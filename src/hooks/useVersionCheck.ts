import { useEffect, useState } from 'react';
import { APP_VERSION, CACHE_VERSION_KEY } from '@/lib/appVersion';
import { clearPersistedCache, clearCachedLayoutState } from '@/lib/queryPersister';
import { toast } from 'sonner';

export const useVersionCheck = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const storedVersion = localStorage.getItem(CACHE_VERSION_KEY);
    
    if (storedVersion !== APP_VERSION) {
      console.log(`[Version] Updating from ${storedVersion || 'none'} to ${APP_VERSION}`);
      
      // Clear React Query persisted cache
      clearPersistedCache();
      
      // Clear layout state cache
      clearCachedLayoutState();
      
      // Clear other individual caches
      const cachesToClear = [
        'rep-data-cache',
        'blitz-data-cache', 
        'team-access-cache',
        'calendar-cache',
        'insights-cache',
      ];
      
      cachesToClear.forEach(key => {
        try {
          localStorage.removeItem(key);
        } catch {
          // Ignore storage errors
        }
      });
      
      // Store new version
      localStorage.setItem(CACHE_VERSION_KEY, APP_VERSION);
      
      // Show toast only if this was an upgrade (not first install)
      if (storedVersion) {
        toast.success('App updated - loading fresh data');
      }
    }
    
    setIsReady(true);
  }, []);

  return { isReady };
};
