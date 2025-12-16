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

// Cache for 30 days - competitor data rarely changes
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const useCompetitors = () => {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load from cache and only fetch if cache is stale or empty
  useEffect(() => {
    const loadData = async () => {
      const cached = localStorage.getItem('competitors-cache');
      
      if (cached) {
        try {
          const { data, timestamp } = JSON.parse(cached);
          const isRecent = Date.now() - timestamp < CACHE_TTL_MS;
          
          if (isRecent && data.length > 0) {
            // Cache is fresh - use it and skip network
            setCompetitors(data);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.error('Failed to parse cached competitors:', e);
        }
      }
      
      // Cache is stale or empty - fetch from Supabase
      await fetchFromSupabase();
    };
    
    loadData();
  }, []);

  const fetchFromSupabase = async () => {
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
      
      // Cache the data
      localStorage.setItem('competitors-cache', JSON.stringify({
        data: competitorData,
        timestamp: Date.now()
      }));
    } catch (err) {
      console.error('Error fetching competitors:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch competitors');
      
      // Fall back to any cached data
      const cached = localStorage.getItem('competitors-cache');
      if (cached) {
        try {
          const { data } = JSON.parse(cached);
          if (data.length > 0) {
            setCompetitors(data);
          }
        } catch (e) {
          console.error('Failed to parse cached competitors:', e);
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

      // Clear cache and refetch
      localStorage.removeItem('competitors-cache');
      await fetchFromSupabase();
    } catch (err) {
      console.error('Error syncing competitors:', err);
      setError(err instanceof Error ? err.message : 'Failed to sync competitors');
    } finally {
      setLoading(false);
    }
  };

  return {
    competitors,
    loading,
    error,
    refetch: fetchFromSupabase,
    syncFromNotion,
  };
};
