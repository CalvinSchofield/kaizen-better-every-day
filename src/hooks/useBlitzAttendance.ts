import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  const queryClient = useQueryClient();
  const [optimisticUpdates, setOptimisticUpdates] = useState<Map<string, any>>(new Map());

  const { data, isLoading, error, isFetching, refetch: queryRefetch } = useQuery({
    queryKey: ['blitz-attendance', scope],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
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
      return responseData as AttendanceData;
    },
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  });

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

  const refetch = async () => {
    await queryClient.invalidateQueries({ queryKey: ['blitz-attendance', scope] });
  };

  return {
    teamMembers: optimisticData?.teamMembers || [],
    contactedForBlitz: optimisticData?.contactedForBlitz || {},
    accessibleUserIds: optimisticData?.accessibleUserIds || [],
    loading: isLoading && !data, // Only show loading on first load
    error: error?.message || null,
    refetch,
    isRefreshing: isFetching && !!data,
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
