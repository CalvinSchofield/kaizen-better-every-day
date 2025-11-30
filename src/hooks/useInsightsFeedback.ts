import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface FunnelData {
  doors: { total: number; conversionToNext: number };
  decisionMakers: { total: number; conversionToNext: number };
  pitches: { total: number; conversionToNext: number };
  transitions: { total: number; conversionToNext: number };
  presentations: { total: number; conversionToNext: number };
  closes: { total: number };
}

interface RatiosData {
  doorsToFp: { current: number; overall: number };
  pitchesToFp: { current: number; overall: number };
  transitionsToFp: { current: number; overall: number };
  presentationsToClose: { current: number; overall: number };
}

interface TotalsData {
  fp: number;
  doors: number;
  pitches: number;
  transitions: number;
  presentations: number;
  closes: number;
}

interface UseInsightsFeedbackParams {
  funnel: FunnelData;
  ratios: RatiosData;
  totals: TotalsData;
  timeframe: string;
  daysWorked: number;
}

export const useInsightsFeedback = (params: UseInsightsFeedbackParams | null) => {
  return useQuery({
    queryKey: ['insights-feedback', params],
    queryFn: async () => {
      if (!params) return null;

      const { data, error } = await supabase.functions.invoke('generate-insights-feedback', {
        body: params
      });

      if (error) {
        console.error('Error generating insights feedback:', error);
        throw error;
      }

      return data.feedback as string;
    },
    enabled: !!params && params.daysWorked > 0,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
  });
};
