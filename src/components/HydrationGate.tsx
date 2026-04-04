import { useEffect, useState } from "react";
import { useCurrentUserId } from "@/hooks/useCurrentUserId";
import { AppSplashScreen } from "./AppSplashScreen";

/** SessionStorage key set by the Refresh Data action to force a splash on reload */
export const FORCE_SPLASH_KEY = 'kaizen-force-splash';

interface HydrationGateProps {
  children: React.ReactNode;
}

/**
 * Global hydration gate that shows a branded splash on cold app launch
 * until auth is ready and persisted cache can be used.
 *
 * When a "Refresh Data" reload is triggered, a sessionStorage flag forces the
 * splash to stay visible until auth is fully re-verified (not just cached).
 */
export const HydrationGate = ({ children }: HydrationGateProps) => {
  const { userId, authVerified, canUseCachedData } = useCurrentUserId();

  // Check if this is a forced-splash reload (e.g. from "Refresh Data" button)
  const [forceSplash, setForceSplash] = useState(() => {
    try {
      return sessionStorage.getItem(FORCE_SPLASH_KEY) === '1';
    } catch {
      return false;
    }
  });

  // Clear the flag once auth is fully verified
  useEffect(() => {
    if (forceSplash && authVerified) {
      try { sessionStorage.removeItem(FORCE_SPLASH_KEY); } catch {}
      setForceSplash(false);
    }
  }, [forceSplash, authVerified]);

  // During a forced splash, only proceed once auth is truly verified
  if (forceSplash) {
    return <AppSplashScreen message="Refreshing your data…" />;
  }
  
  if (canUseCachedData || authVerified) {
    return <>{children}</>;
  }
  
  return <AppSplashScreen message="Loading…" />;
};
