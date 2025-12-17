import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface WeeklyReportData {
  // Office stats
  officeTotals: {
    fp: number;
    efp: number;
    prmr: number;
    doors: number;
    pitches: number;
    transitions: number;
    presentations: number;
    closes: number;
    hours: number;
    avgStartTime: string;
    avgEndTime: string;
    daysWorked: number;
    uniqueReps: number;
  };
  growth: {
    fp: number;
    efp: number;
    prmr: number;
    doors: number;
    hours: number;
  };
  // Top 10s by class
  top10Rookies: Array<{
    userId: string;
    name: string;
    profilePhotoUrl?: string;
    fp: number;
    efp: number;
    isRecord?: boolean;
  }>;
  top10Sophomores: Array<{
    userId: string;
    name: string;
    profilePhotoUrl?: string;
    fp: number;
    efp: number;
    isRecord?: boolean;
  }>;
  top10Vets: Array<{
    userId: string;
    name: string;
    profilePhotoUrl?: string;
    fp: number;
    efp: number;
    isRecord?: boolean;
  }>;
  // Team rankings
  teamRankings: Array<{
    teamName: string;
    leadName: string;
    leadPhoto?: string;
    fp: number;
    efp: number;
    growth: number;
    isRecord?: boolean;
  }>;
  // MGMT Group rankings
  mgmtRankings: Array<{
    mgmtGroupName: string;
    leadName: string;
    leadPhoto?: string;
    fp: number;
    efp: number;
    growth: number;
    isRecord?: boolean;
  }>;
  // Superlatives
  superlatives: {
    lateNightAssassin?: { name: string; photo?: string; value: string; stat: string };
    earlyDealsBandit?: { name: string; photo?: string; value: string; stat: string };
    theHustler?: { name: string; photo?: string; value: string; stat: string };
    mostEfficient?: { name: string; photo?: string; value: string; stat: string };
    mostImproved?: { name: string; photo?: string; value: string; stat: string };
    theCloser?: { name: string; photo?: string; value: string; stat: string };
    doorDestroyer?: { name: string; photo?: string; value: string; stat: string };
  };
  // Records
  records: Array<{
    type: 'individual' | 'team' | 'mgmt' | 'office';
    category: string;
    holder: string;
    value: number | string;
    previousBest?: number | string;
    date?: string;
  }>;
}

export interface WeeklyReport {
  id: string;
  report_type: 'weekly' | 'monthly' | 'blitz';
  period_start: string;
  period_end: string;
  scope: 'office' | 'mgmt_group' | 'team';
  scope_id?: string;
  generated_by: string;
  generated_at: string;
  status: 'draft' | 'approved' | 'published';
  approved_at?: string;
  published_at?: string;
  data: WeeklyReportData;
  edits: Record<string, any>;
  created_at: string;
}

export const useWeeklyReports = (status?: 'draft' | 'approved' | 'published') => {
  return useQuery({
    queryKey: ['weekly-reports', status],
    queryFn: async () => {
      let query = supabase
        .from('weekly_reports')
        .select('*')
        .order('period_end', { ascending: false });
      
      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map(report => ({
        ...report,
        data: report.data as unknown as WeeklyReportData,
        edits: report.edits as unknown as Record<string, any>,
      })) as WeeklyReport[];
    },
    staleTime: 60 * 1000,
  });
};

export const useLatestPublishedReport = () => {
  return useQuery({
    queryKey: ['weekly-reports', 'latest-published'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weekly_reports')
        .select('*')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        ...data,
        data: data.data as unknown as WeeklyReportData,
        edits: data.edits as unknown as Record<string, any>,
      } as WeeklyReport;
    },
    staleTime: 60 * 1000,
  });
};

export const useSaveReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (report: Omit<WeeklyReport, 'id' | 'created_at'> & { id?: string }) => {
      if (report.id) {
        // Update existing
        const { data, error } = await supabase
          .from('weekly_reports')
          .update({
            data: report.data as any,
            edits: report.edits as any,
            status: report.status,
            approved_at: report.approved_at,
            published_at: report.published_at,
          })
          .eq('id', report.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Create new
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data, error } = await supabase
          .from('weekly_reports')
          .insert({
            report_type: report.report_type,
            period_start: report.period_start,
            period_end: report.period_end,
            scope: report.scope,
            scope_id: report.scope_id,
            generated_by: user.id,
            data: report.data as any,
            edits: report.edits as any,
            status: report.status,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-reports'] });
    },
  });
};

export const useDeleteReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reportId: string) => {
      const { error } = await supabase
        .from('weekly_reports')
        .delete()
        .eq('id', reportId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-reports'] });
    },
  });
};
