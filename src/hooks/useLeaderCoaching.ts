import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface RepPerformance {
  name: string;
  year: string;
  currentPeriod: {
    doors: number;
    pitches: number;
    transitions: number;
    presentations: number;
    closes: number;
    fp: number;
  };
  repAverage: {
    avgDoors: number;
    avgPitches: number;
    avgTransitions: number;
    avgPresentations: number;
    avgCloses: number;
    avgFp: number;
  };
  vsAverage: {
    doors: number;
    pitches: number;
    transitions: number;
    presentations: number;
    closes: number;
    fp: number;
  };
}

interface LeaderCoachingParams {
  timeframe: string;
  scopeLabel: string;
  teamTotals: {
    doors: number;
    pitches: number;
    transitions: number;
    presentations: number;
    closes: number;
    fp: number;
    prmr: number;
    daysWorked: number;
    uniqueReps: number;
  };
  teamFunnel: {
    doorsToFp: number;
    pitchesToFp: number;
    transitionsToFp: number;
    presentationsToClose: number;
    overallDoorsToFp: number;
    overallPitchesToFp: number;
    overallTransitionsToFp: number;
    overallPresentationsToClose: number;
  };
  repBreakdown: RepPerformance[];
}

interface LeaderCoachingResponse {
  teamStrength: string;
  bottleneck: string;
  trainingRecommendation: string;
  checkInWith: Array<{
    name: string;
    reason: string;
  }>;
}

export const useLeaderCoaching = (params: LeaderCoachingParams | null) => {
  return useQuery({
    queryKey: ['leader-coaching', params?.timeframe, params?.scopeLabel, params?.teamTotals?.fp, params?.teamTotals?.daysWorked],
    queryFn: async (): Promise<LeaderCoachingResponse | null> => {
      if (!params) return null;

      const { data, error } = await supabase.functions.invoke('generate-leader-coaching', {
        body: params
      });

      if (error) {
        console.error('Error generating leader coaching:', error);
        throw error;
      }

      return data.coaching as LeaderCoachingResponse;
    },
    enabled: !!params && params.teamTotals.daysWorked >= 3 && params.repBreakdown.length > 0,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
  });
};
