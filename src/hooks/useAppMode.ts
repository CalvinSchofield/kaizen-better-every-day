import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const GLOBAL_SUMMER_START = new Date('2026-04-12');
const GLOBAL_SUMMER_END = new Date('2026-09-27');

interface SeasonConfig {
  id: string;
  user_id: string;
  knocking_mode_enabled: boolean | null;
  personal_summer_start: string | null;
  personal_summer_end: string | null;
}

export const useAppMode = (repData?: any) => {
  const queryClient = useQueryClient();

  // Determine if user is a leader (vets/sophomores who need toggle access)
  const isLeader = useMemo(() => {
    const year = repData?.year || "Rookie";
    return year === "Vet" || year === "Sophomore";
  }, [repData?.year]);

  // Check if currently on an active blitz (4pm start on start date, 10am end on end date)
  const isOnActiveBlitz = useMemo(() => {
    if (!repData?.committed_blitzes || !Array.isArray(repData.committed_blitzes)) {
      return false;
    }

    const now = new Date();

    return repData.committed_blitzes.some((blitz: any) => {
      if (!blitz?.date || !blitz?.endDate) return false;
      
      // Parse dates in local timezone by appending 'T00:00:00' to force local interpretation
      // Start: blitz date at 4pm local time
      const startDate = new Date(blitz.date + 'T00:00:00');
      startDate.setHours(16, 0, 0, 0); // 4pm
      
      // End: blitz end date at 10am local time
      const endDate = new Date(blitz.endDate + 'T00:00:00');
      endDate.setHours(10, 0, 0, 0); // 10am
      
      return now >= startDate && now <= endDate;
    });
  }, [repData?.committed_blitzes]);

  // Check if user has attended at least one blitz
  const hasAttendedBlitz = useMemo(() => {
    if (!repData?.committed_blitzes || !Array.isArray(repData.committed_blitzes)) {
      return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return repData.committed_blitzes.some((blitz: any) => {
      if (!blitz?.endDate) return false;
      const endDate = new Date(blitz.endDate);
      endDate.setHours(0, 0, 0, 0);
      return endDate < today;
    });
  }, [repData?.committed_blitzes]);

  // Determine who can access knocking toggle
  const canAccessKnockingToggle = useMemo(() => {
    const year = repData?.year || "Rookie";
    // Vets and Sophomores always have access
    if (year === "Vet" || year === "Sophomore") return true;
    // Rookies only after attending first blitz
    return hasAttendedBlitz;
  }, [repData?.year, hasAttendedBlitz]);

  // Get cached season config for instant loading
  const getCachedSeasonConfig = (): SeasonConfig | null => {
    try {
      const userId = localStorage.getItem('current-user-id');
      if (userId) {
        const cached = localStorage.getItem(`season-config-cache-${userId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.timestamp && Date.now() - parsed.timestamp < 5 * 60 * 1000) {
            return parsed.data;
          }
        }
      }
    } catch {
      // Ignore cache errors
    }
    return null;
  };

  // Fetch season config
  const { data: seasonConfig, isLoading } = useQuery({
    queryKey: ['season-config'],
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
    retry: 1,
    initialData: getCachedSeasonConfig() ?? undefined,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('season_config')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      // Update cache
      if (data) {
        localStorage.setItem(`season-config-cache-${user.id}`, JSON.stringify({
          data,
          timestamp: Date.now()
        }));
      }
      
      return data as SeasonConfig | null;
    },
  });

  // Calculate if knocking mode should be active
  const isKnockingMode = useMemo(() => {
    // Priority 1: Manual override takes precedence
    if (seasonConfig?.knocking_mode_enabled !== null && seasonConfig?.knocking_mode_enabled !== undefined) {
      return seasonConfig.knocking_mode_enabled;
    }

    // Priority 2: Auto-enable if on active blitz
    if (isOnActiveBlitz) {
      return true;
    }

    // Priority 3: Auto-enable if within personal summer dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const effectiveStart = seasonConfig?.personal_summer_start
      ? new Date(seasonConfig.personal_summer_start)
      : GLOBAL_SUMMER_START;

    const effectiveEnd = seasonConfig?.personal_summer_end
      ? new Date(seasonConfig.personal_summer_end)
      : GLOBAL_SUMMER_END;

    return today >= effectiveStart && today <= effectiveEnd;
  }, [seasonConfig, isOnActiveBlitz]);

  // Toggle knocking mode
  const toggleModeMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('season_config')
        .upsert({
          id: seasonConfig?.id,
          user_id: user.id,
          knocking_mode_enabled: enabled,
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['season-config'] });
    },
  });

  return {
    isKnockingMode,
    seasonConfig,
    isLoading,
    toggleMode: toggleModeMutation.mutate,
    isToggling: toggleModeMutation.isPending,
    canAccessKnockingToggle,
    isOnActiveBlitz,
    hasAttendedBlitz,
  };
};