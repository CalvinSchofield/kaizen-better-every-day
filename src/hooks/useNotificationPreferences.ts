import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';

export interface NotificationPreference {
  notification_type: string;
  enabled: boolean;
}

export function useNotificationPreferences() {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { const data = { user: session?.user ?? null };
      setUserId(data.user?.id || null);
    });
  }, []);

  const { data: preferences = [], isLoading } = useQuery({
    queryKey: ['notification-preferences', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('notification_type, enabled')
        .eq('user_id', userId);
      if (error) throw error;
      return (data || []) as NotificationPreference[];
    },
    enabled: !!userId,
  });

  // Opt-out model: absence of row = enabled (default ON)
  const isEnabled = (type: string): boolean => {
    const pref = preferences.find(p => p.notification_type === type);
    return pref ? pref.enabled : true;
  };

  const togglePreference = useMutation({
    mutationFn: async ({ type, enabled }: { type: string; enabled: boolean }) => {
      if (!userId) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('notification_preferences')
        .upsert(
          { user_id: userId, notification_type: type, enabled },
          { onConflict: 'user_id,notification_type' }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences', userId] });
    },
  });

  return {
    preferences,
    isLoading,
    isEnabled,
    togglePreference: togglePreference.mutate,
    isToggling: togglePreference.isPending,
  };
}
