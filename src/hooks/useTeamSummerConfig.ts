import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeamAccess } from "./useTeamAccess";

interface RepSummerConfig {
  userId: string;
  name: string;
  notionPageId: string;
  personalSummerStart: string | null;
  personalSummerEnd: string | null;
  excludedSummerDays: string[];
}

// Default summer dates
const DEFAULT_SUMMER_START = '2026-04-12';
const DEFAULT_SUMMER_END = '2026-09-27';

export const useTeamSummerConfig = () => {
  const { data: accessData, isLoading: accessLoading } = useTeamAccess();

  return useQuery({
    queryKey: ['team-summer-config', accessData?.accessibleUserIds],
    queryFn: async () => {
      if (!accessData?.accessibleUserIds?.length) {
        return [];
      }

      // Fetch season_config for all accessible users
      const { data: configs, error } = await supabase
        .from('season_config')
        .select('user_id, personal_summer_start, personal_summer_end, excluded_summer_days')
        .in('user_id', accessData.accessibleUserIds);

      if (error) throw error;

      // Map configs to include rep names
      const configMap = new Map(
        configs?.map(c => [c.user_id, c]) || []
      );

      const result: RepSummerConfig[] = accessData.accessibleReps?.map((rep: any) => {
        const config = configMap.get(rep.userId);
        return {
          userId: rep.userId,
          name: rep.name,
          notionPageId: rep.notionPageId,
          // Return null if not set - UI can then show warning for missing dates
          personalSummerStart: config?.personal_summer_start || null,
          personalSummerEnd: config?.personal_summer_end || null,
          excludedSummerDays: config?.excluded_summer_days || [],
        };
      }) || [];

      return result;
    },
    enabled: !accessLoading && !!accessData?.accessibleUserIds?.length,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
};

// Helper to check if a date falls within a rep's summer range
export const isDateInSummerRange = (
  dateStr: string, 
  summerStart: string | null, 
  summerEnd: string | null
): boolean => {
  const start = summerStart || DEFAULT_SUMMER_START;
  const end = summerEnd || DEFAULT_SUMMER_END;
  return dateStr >= start && dateStr <= end;
};

// Helper to check if a rep is off on a specific date
export const isRepOffOnDate = (
  dateStr: string,
  config: RepSummerConfig
): boolean => {
  // Off if outside their summer range
  if (!isDateInSummerRange(dateStr, config.personalSummerStart, config.personalSummerEnd)) {
    return true;
  }
  // Off if date is in their excluded days
  if (config.excludedSummerDays.includes(dateStr)) {
    return true;
  }
  return false;
};
