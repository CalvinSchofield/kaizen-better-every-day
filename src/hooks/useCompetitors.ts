import { useState, useEffect } from 'react';
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

export const useCompetitors = () => {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load from localStorage on mount for instant offline access
  useEffect(() => {
    const cached = localStorage.getItem('competitors-cache');
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        const isRecent = Date.now() - timestamp < 60 * 60 * 1000; // 1 hour
        if (isRecent && data.length > 0) {
          setCompetitors(data);
          setLoading(false);
        }
      } catch (e) {
        console.error('Failed to parse cached competitors:', e);
      }
    }
  }, []);

  const fetchCompetitors = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('competitors')
        .select('*')
        .order('name', { ascending: true });

      if (fetchError) throw fetchError;

      const competitorData = (data || []) as Competitor[];
      setCompetitors(competitorData);
      
      // Cache the data locally for offline access
      localStorage.setItem('competitors-cache', JSON.stringify({
        data: competitorData,
        timestamp: Date.now()
      }));
    } catch (err) {
      console.error('Error fetching competitors:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch competitors');
      
      // If fetch fails and we have no data, try to load from cache
      if (competitors.length === 0) {
        const cached = localStorage.getItem('competitors-cache');
        if (cached) {
          try {
            const { data } = JSON.parse(cached);
            setCompetitors(data);
            setError('Showing cached data (offline)');
          } catch (e) {
            console.error('Failed to parse cached competitors:', e);
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const syncFromNotion = async () => {
    try {
      setLoading(true);
      setError(null);

      const { error: syncError } = await supabase.functions.invoke('sync-notion-competitors');

      if (syncError) throw syncError;

      // Refetch after sync
      await fetchCompetitors();
    } catch (err) {
      console.error('Error syncing competitors:', err);
      setError(err instanceof Error ? err.message : 'Failed to sync competitors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompetitors();
  }, []);

  return {
    competitors,
    loading,
    error,
    refetch: fetchCompetitors,
    syncFromNotion,
  };
};
