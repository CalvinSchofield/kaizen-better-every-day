import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TeamMember {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  blitzReady: boolean;
  committedBlitzes: string[];
  ipadAssigned: boolean;
  year: string | null;
  stage: string | null;
  onboardingStatus: string | null;
  userId?: string | null;
}

interface AttendanceData {
  teamMembers: TeamMember[];
  contactedForBlitz: { [blitzId: string]: string[] };
  accessibleUserIds: string[];
}

export const useBlitzAttendance = (
  scope: 'you' | 'team' | 'mgmt' | 'office',
  leaderId?: string | null // Optional - no longer required, auth token provides identity
) => {
  const [data, setData] = useState<AttendanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [optimisticUpdates, setOptimisticUpdates] = useState<Map<string, any>>(new Map());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load from cache immediately - stale-while-revalidate pattern
  useEffect(() => {
    const cached = localStorage.getItem('blitz-attendance-cache');
    if (cached) {
      try {
        const { data: cachedData, timestamp, scope: cachedScope } = JSON.parse(cached);
        // Use cache even if slightly stale - we'll refresh in background
        const isUsable = Date.now() - timestamp < 30 * 60 * 1000; // 30 minutes max

        const hasTeamMembers = Array.isArray(cachedData?.teamMembers) && cachedData.teamMembers.length > 0;
        const looksUnhealthy = hasTeamMembers && cachedData.teamMembers.every((m: any) => !m?.onboardingStatus);

        if (isUsable && cachedScope === scope && !looksUnhealthy) {
          setData(cachedData);
          setLoading(false); // Show cached data immediately
        }
      } catch (e) {
        console.error('Failed to parse cached attendance:', e);
      }
    }
  }, [scope]);

  const fetchAttendance = useCallback(async (isBackgroundRefresh = false) => {
    // Only show loading spinner if we don't have any data yet
    if (!isBackgroundRefresh && !data) {
      setLoading(true);
    }
    if (isBackgroundRefresh) {
      setIsRefreshing(true);
    }
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setLoading(false);
        return;
      }

      const { data: responseData, error: invokeError } = await supabase.functions.invoke('fetch-blitz-attendance', {
        body: {
          scope,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (invokeError) throw invokeError;

      if (responseData) {
        setData(responseData);
        
        // Cache the data
        localStorage.setItem('blitz-attendance-cache', JSON.stringify({
          data: responseData,
          scope,
          timestamp: Date.now()
        }));
      }
    } catch (err: any) {
      console.error('Error fetching attendance:', err);
      // Only show error if we don't have cached data to fall back on
      if (!data) {
        setError(err.message || 'Failed to load attendance data');
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [scope, data]);

  // Initial fetch - background refresh if we have cached data
  useEffect(() => {
    const hasCachedData = data !== null;
    fetchAttendance(hasCachedData);
  }, [scope]); // Don't include fetchAttendance to avoid loops

  // Apply optimistic updates on top of data
  const getOptimisticData = () => {
    if (!data) return null;
    
    let updatedData = { ...data };
    
    // Apply any optimistic updates
    optimisticUpdates.forEach((update, key) => {
      if (key.startsWith('member-')) {
        const memberId = key.replace('member-', '');
        updatedData.teamMembers = updatedData.teamMembers.map(m =>
          m.id === memberId ? { ...m, ...update } : m
        );
      }
    });
    
    return updatedData;
  };

  const optimisticData = getOptimisticData();

  return {
    teamMembers: optimisticData?.teamMembers || [],
    contactedForBlitz: optimisticData?.contactedForBlitz || {},
    accessibleUserIds: optimisticData?.accessibleUserIds || [],
    loading,
    error,
    refetch: fetchAttendance,
    setOptimisticUpdate: (key: string, update: any) => {
      setOptimisticUpdates(prev => new Map(prev).set(key, update));
    },
    clearOptimisticUpdate: (key: string) => {
      setOptimisticUpdates(prev => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
    },
  };
};
