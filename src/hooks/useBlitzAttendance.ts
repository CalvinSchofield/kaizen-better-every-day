import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TeamMember {
  notionPageId: string;
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
  leaderNotionPageId: string | null
) => {
  const [data, setData] = useState<AttendanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load from cache immediately
  useEffect(() => {
    const cached = localStorage.getItem('blitz-attendance-cache');
    if (cached) {
      try {
        const { data: cachedData, timestamp, scope: cachedScope } = JSON.parse(cached);
        const isRecent = Date.now() - timestamp < 5 * 60 * 1000; // 5 minutes
        if (isRecent && cachedScope === scope) {
          setData(cachedData);
          setLoading(false);
        }
      } catch (e) {
        console.error('Failed to parse cached attendance:', e);
      }
    }
  }, [scope]);

  const fetchAttendance = useCallback(async () => {
    if (!leaderNotionPageId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }

      const { data: responseData, error: invokeError } = await supabase.functions.invoke('fetch-blitz-attendance', {
        body: {
          scope,
          leaderNotionPageId,
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
      setError(err.message || 'Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  }, [scope, leaderNotionPageId]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  return {
    teamMembers: data?.teamMembers || [],
    contactedForBlitz: data?.contactedForBlitz || {},
    accessibleUserIds: data?.accessibleUserIds || [],
    loading,
    error,
    refetch: fetchAttendance,
  };
};
