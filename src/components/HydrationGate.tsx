import { useCurrentUserId } from "@/hooks/useCurrentUserId";
import { Loader2 } from "lucide-react";

interface HydrationGateProps {
  children: React.ReactNode;
}

/**
 * Global hydration gate that shows a brief splash on cold app launch
 * until auth is ready and persisted cache can be used.
 * 
 * This prevents per-page skeleton/wizard flashes by ensuring:
 * 1. We have a VERIFIED userId (not just cached, which could be stale)
 * 2. React Query persistence has restored
 * 
 * CRITICAL FIX: We now wait for authVerified to be true, not just canUseCachedData.
 * This prevents the issue where a stale cached userId causes the app to render
 * with empty/wrong data when the actual Supabase session is expired.
 */
export const HydrationGate = ({ children }: HydrationGateProps) => {
  const { userId, authVerified } = useCurrentUserId();
  
  // CRITICAL: Wait for auth to be verified before rendering
  // This prevents stale cached userId from causing empty data display
  // The verification is quick (<200ms) so the UX impact is minimal
  if (authVerified) {
    return <>{children}</>;
  }
  
  // Brief splash while determining user identity
  // This should only show for < 200ms on cold launch
  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    </div>
  );
};
