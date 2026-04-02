import { useCurrentUserId } from "@/hooks/useCurrentUserId";
import { AppSplashScreen } from "./AppSplashScreen";

interface HydrationGateProps {
  children: React.ReactNode;
}

/**
 * Global hydration gate that shows a branded splash on cold app launch
 * until auth is ready and persisted cache can be used.
 */
export const HydrationGate = ({ children }: HydrationGateProps) => {
  const { userId, authVerified, canUseCachedData } = useCurrentUserId();
  
  if (canUseCachedData || authVerified) {
    return <>{children}</>;
  }
  
  return <AppSplashScreen message="Loading…" />;
};
