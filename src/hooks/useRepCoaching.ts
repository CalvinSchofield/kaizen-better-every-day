import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface RepCoachingParams {
  timeframe: 'yesterday' | 'week' | 'month' | 'preseason';
  currentPeriod: {
    doors: number;
    dms: number;
    pitches: number;
    transitions: number;
    presentations: number;
    closes: number;
    fp: number;
    prmr: number;
    avgStartTime: string;
    avgEndTime: string;
    totalHours: number;
    daysWorked: number;
  };
  repAverages: {
    avgDoors: number;
    avgDMs: number;
    avgPitches: number;
    avgTransitions: number;
    avgPresentations: number;
    avgCloses: number;
    avgFp: number;
    avgPrmr: number;
    avgHoursWorked: number;
  };
  funnelConversions: {
    doorsToFp: number;
    pitchesToFp: number;
    transitionsToFp: number;
    presentationsToClose: number;
    overallDoorsToFp: number;
    overallPitchesToFp: number;
    overallTransitionsToFp: number;
    overallPresentationsToClose: number;
  };
}

interface CoachingResponse {
  strengths: string[];
  improvement: string;
  homework: string;
}

export const useRepCoaching = (params: RepCoachingParams | null) => {
  return useQuery({
    queryKey: ['rep-coaching', params?.timeframe, params?.currentPeriod?.fp, params?.currentPeriod?.daysWorked],
    queryFn: async (): Promise<CoachingResponse | null> => {
      if (!params) return null;

      const { data, error } = await supabase.functions.invoke('generate-rep-coaching', {
        body: params
      });

      if (error) {
        console.error('Error generating rep coaching:', error);
        throw error;
      }

      return data.coaching as CoachingResponse;
    },
    enabled: !!params && params.currentPeriod.daysWorked > 0,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
  });
};
