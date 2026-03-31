import { useEffect, useState } from 'react';

export const useSetupStatus = () => {
  const [setupComplete, setSetupComplete] = useState<boolean>(false);
  const [setupTimestamp, setSetupTimestamp] = useState<number | null>(null);

  useEffect(() => {
    checkSetupStatus();
  }, []);

  const checkSetupStatus = () => {
    const complete = localStorage.getItem('kaizen-setup-complete') === 'true';
    const timestamp = localStorage.getItem('kaizen-setup-timestamp');
    
    setSetupComplete(complete);
    setSetupTimestamp(timestamp ? parseInt(timestamp) : null);
  };

  const clearSetup = () => {
    localStorage.removeItem('kaizen-setup-complete');
    localStorage.removeItem('kaizen-setup-timestamp');
    // Clear all caches
    localStorage.removeItem('rep-data-cache');
    localStorage.removeItem('competitors-cache');
    localStorage.removeItem('blitzes-cache');
    setSetupComplete(false);
    setSetupTimestamp(null);
  };

  const needsSetup = () => {
    // Setup is needed if:
    // 1. Never completed before
    // 2. Completed more than 7 days ago (stale)
    if (!setupComplete) return true;
    if (!setupTimestamp) return true;
    
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    return setupTimestamp < sevenDaysAgo;
  };

  return {
    setupComplete,
    setupTimestamp,
    needsSetup: needsSetup(),
    clearSetup,
    recheckSetup: checkSetupStatus,
  };
};
