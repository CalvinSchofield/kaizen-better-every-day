import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Competitor {
  id: string;
  notion_page_id: string;
  name: string;
  category: string | null;
  main_image_url: string | null;
  alternate_versions: Array<{
    name: string;
    image_url: string | null;
    notion_page_id: string;
  }>;
  monitoring_companies: string[];
  our_selling_points: string[];
  their_selling_points: string[];
  objections: Array<{
    objection: string;
    handle: string;
  }>;
  created_at: string;
  updated_at: string;
}

// Cache for 30 days - competitor data rarely changes
const STALE_TIME = 30 * 24 * 60 * 60 * 1000;

export const useCompetitors = () => {
  const queryClient = useQueryClient();

  const { data: competitors = [], isLoading: loading, error: queryError, refetch } = useQuery({
    queryKey: ['competitors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('competitors')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      return (data || []) as Competitor[];
    },
    staleTime: STALE_TIME,
    gcTime: STALE_TIME, // Keep in cache for 30 days
  });

  const syncFromNotion = async () => {
    const { error: syncError } = await supabase.functions.invoke('sync-notion-competitors');

    if (syncError) throw syncError;

    // Invalidate cache to force refetch
    await queryClient.invalidateQueries({ queryKey: ['competitors'] });
  };

  return {
    competitors,
    loading,
    error: queryError ? (queryError as Error).message : null,
    refetch,
    syncFromNotion,
  };
};
