import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Module-level cache so the token is fetched at most once per session
let cachedToken: string | null = null;
let fetchPromise: Promise<string | null> | null = null;

const fetchToken = async (): Promise<string | null> => {
  if (cachedToken) return cachedToken;
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-mapbox-token');
      if (!error && data?.token) {
        cachedToken = data.token;
        return cachedToken;
      }
      console.error('Failed to fetch Mapbox token:', error);
      return null;
    } catch (e) {
      console.error('Failed to fetch Mapbox token:', e);
      return null;
    } finally {
      fetchPromise = null;
    }
  })();

  return fetchPromise;
};

/**
 * Shared hook for fetching the Mapbox token.
 * Deduplicates requests — only one network call per session.
 */
export const useMapboxToken = () => {
  const [token, setToken] = useState<string | null>(cachedToken);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (cachedToken) {
      setToken(cachedToken);
      return;
    }
    fetchToken().then(t => {
      if (t) setToken(t);
      else setError(true);
    });
  }, []);

  return { mapboxToken: token, tokenError: error };
};
