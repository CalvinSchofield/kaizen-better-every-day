import { useCurrentUserId } from "@/hooks/useCurrentUserId";
import { Loader2 } from "lucide-react";

interface HydrationGateProps {
  children: React.ReactNode;
}

/**
 * Global hydration gate that shows a brief splash on cold app launch
 * until auth is ready and persisted cache can be used.
 * 
 * PERF FIX: If we have a cached userId, render immediately and verify
 * auth in the background. ProtectedRoute will catch truly expired sessions.
 * This prevents the 1-4s block on native/TestFlight where getUser() is slow.
 */
export const HydrationGate = ({ children }: HydrationGateProps) => {
  const { userId, authVerified, canUseCachedData } = useCurrentUserId();
  
  // PERF: Render immediately if we have a cached userId OR auth is verified.
  // On native, getUser() can take 1-4s. If we have a cached userId, render
  // optimistically - ProtectedRoute will redirect to /auth if session is truly expired.
  if (canUseCachedData || authVerified) {
    return <>{children}</>;
  }
  
  // Brief splash only when we have NO cached userId and auth hasn't resolved yet.
  // This should only happen on very first app install (no cache exists).
  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    </div>
  );
};
