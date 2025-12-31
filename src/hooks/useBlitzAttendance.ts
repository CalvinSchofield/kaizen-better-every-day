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
  recruitId?: string | null;
  teamId?: string | null;
  teamName?: string | null;
}

interface AttendanceData {
  teamMembers: TeamMember[];
  contactedForBlitz: { [blitzId: string]: string[] };
  declinedForBlitz: { [blitzId: string]: string[] };
  accessibleUserIds: string[];
}

export const useBlitzAttendance = (
  scope: 'you' | 'team' | 'mgmt' | 'office',
  options?: {
    mgmtGroupId?: string | null;
    teamId?: string | null;
    enabled?: boolean;
  }
) => {
  const queryClient = useQueryClient();
  const [optimisticUpdates, setOptimisticUpdates] = useState<Map<string, any>>(new Map());
  
  const mgmtGroupId = options?.mgmtGroupId;
  const teamId = options?.teamId;
  const enabled = options?.enabled ?? true;

  // Create a stable query key that includes scope and secondary selectors
  const queryKey = ['blitz-attendance', scope, mgmtGroupId || '', teamId || ''];

  const { data, isLoading, error, isFetching, refetch: queryRefetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }

      const { data: responseData, error: invokeError } = await supabase.functions.invoke('fetch-blitz-attendance', {
        body: {
          scope,
          mgmtGroupId: scope === 'mgmt' ? mgmtGroupId : undefined,
          teamId: scope === 'team' ? teamId : undefined,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (invokeError) throw invokeError;
      return responseData as AttendanceData;
    },
    staleTime: 15 * 60 * 1000, // 15 minutes - data stays fresh
    gcTime: 60 * 60 * 1000, // 1 hour
    enabled,
    refetchOnMount: false, // Don't refetch when component remounts
    refetchOnWindowFocus: false, // Don't refetch on window focus
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
    await queryClient.invalidateQueries({ queryKey: ['blitz-attendance'] });
  };

  return {
    teamMembers: optimisticData?.teamMembers || [],
    contactedForBlitz: optimisticData?.contactedForBlitz || {},
    declinedForBlitz: optimisticData?.declinedForBlitz || {},
    accessibleUserIds: optimisticData?.accessibleUserIds || [],
    loading: isLoading && !data, // Only show loading on first load
    error: error?.message || null,
    refetch,
    isRefreshing: isFetching && !!data,
    hasData: !!data,
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
