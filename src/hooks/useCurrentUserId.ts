import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to reliably get the current user ID, preventing race conditions
 * where queries might run before auth is ready.
 * 
 * Use this in any hook that needs to query user-specific data.
 */
export const useCurrentUserId = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (mounted) {
        setUserId(user?.id ?? null);
        setIsReady(true);
      }
    };
    
    getUser();
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (mounted) {
        setUserId(session?.user?.id ?? null);
        setIsReady(true);
      }
    });
    
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { userId, isReady };
};
