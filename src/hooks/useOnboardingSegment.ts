import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUserId } from "./useCurrentUserId";

export type OnboardingSegment = 
  | 'outside-org'
  | 'in-org-vet'
  | 'in-org-rookie-preseason'
  | 'in-org-rookie-summer';

const GLOBAL_SUMMER_START = '2026-04-12';

interface RepDataForSegment {
  user_id: string;
  year?: string | null;
  team_leader?: string | null;
  stage?: string | null;
}

/**
 * Determines the user's onboarding segment by checking if their team leader
 * belongs to a team assigned to the AD's office(s).
 * 
 * Segments:
 * - outside-org: not in the AD's office
 * - in-org-vet: in office, year is Vet or Sophomore
 * - in-org-rookie-preseason: in office, Rookie, summer hasn't started
 * - in-org-rookie-summer: in office, Rookie, summer has started
 */
export const useOnboardingSegment = (repData: RepDataForSegment | null) => {
  const { userId } = useCurrentUserId();
  const isRookie = repData?.year === "Rookie";
  const isVetOrSoph = repData?.year === "Vet" || repData?.year === "Sophomore";

  // Fetch office team lead names to determine if user is "in org"
  const { data: officeTeamLeads, isLoading } = useQuery({
    queryKey: ['office-team-leads'],
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      // Get all office IDs managed by area directors
      const { data: staffRows } = await supabase
        .from('office_staff')
        .select('office_id')
        .eq('role', 'area_director');

      if (!staffRows || staffRows.length === 0) return [];

      const officeIds = staffRows.map(s => s.office_id);

      // Get team lead names for teams in those offices
      const { data: teams } = await supabase
        .from('teams')
        .select('lead_user_id, office_id')
        .in('office_id', officeIds);

      if (!teams || teams.length === 0) return [];

      const leadUserIds = teams.map(t => t.lead_user_id).filter(Boolean) as string[];
      if (leadUserIds.length === 0) return [];

      // Get lead names from reps table
      const { data: leads } = await supabase
        .from('reps')
        .select('name')
        .in('user_id', leadUserIds);

      // Also get mgmt group leads for these offices
      const { data: mgmtGroups } = await supabase
        .from('mgmt_groups')
        .select('lead_user_id')
        .in('office_id', officeIds);

      const mgmtLeadIds = (mgmtGroups || []).map(m => m.lead_user_id).filter(Boolean) as string[];
      
      let mgmtLeadNames: string[] = [];
      if (mgmtLeadIds.length > 0) {
        const { data: mgmtLeads } = await supabase
          .from('reps')
          .select('name')
          .in('user_id', mgmtLeadIds);
        mgmtLeadNames = (mgmtLeads || []).map(l => l.name).filter(Boolean);
      }

      const teamLeadNames = (leads || []).map(l => l.name).filter(Boolean);
      return [...new Set([...teamLeadNames, ...mgmtLeadNames])];
    },
  });

  // Check if user is also a leader in the office (AD, mgmt lead, team lead)
  const { data: isUserOfficeLeader } = useQuery({
    queryKey: ['is-user-office-leader', userId],
    enabled: !!userId,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      if (!userId) return false;
      // Check if user is an AD
      const { data: adCheck } = await supabase
        .from('area_directors')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      if (adCheck) return true;

      // Check if user leads a team or mgmt group in an AD's office
      const { data: staffRows } = await supabase
        .from('office_staff')
        .select('office_id')
        .eq('role', 'area_director');
      if (!staffRows || staffRows.length === 0) return false;
      const officeIds = staffRows.map(s => s.office_id);

      const { data: teamLead } = await supabase
        .from('teams')
        .select('id')
        .eq('lead_user_id', userId)
        .in('office_id', officeIds)
        .maybeSingle();
      if (teamLead) return true;

      const { data: mgmtLead } = await supabase
        .from('mgmt_groups')
        .select('id')
        .eq('lead_user_id', userId)
        .in('office_id', officeIds)
        .maybeSingle();
      return !!mgmtLead;
    },
  });

  const isInMyOffice = useMemo(() => {
    if (!repData || !officeTeamLeads) return false;
    
    // If the user IS an office leader, they're in the org
    if (isUserOfficeLeader) return true;

    const teamLeader = repData.team_leader;
    if (!teamLeader) return false;

    // Clean the team leader text (remove emojis, trim)
    const cleanLeader = teamLeader
      .replace(/[\u{1F600}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]/gu, '')
      .trim();

    // Check if the rep's team leader matches any office team/mgmt lead
    return officeTeamLeads.some(leadName => {
      const cleanLead = leadName
        .replace(/[\u{1F600}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]/gu, '')
        .trim();
      // Match full name or check if one contains the other
      return cleanLeader === cleanLead || 
             cleanLeader.includes(cleanLead) || 
             cleanLead.includes(cleanLeader);
    });
  }, [repData, officeTeamLeads, isUserOfficeLeader]);

  const isSummerStarted = useMemo(() => {
    return new Date() >= new Date(GLOBAL_SUMMER_START + 'T00:00:00');
  }, []);

  const segment: OnboardingSegment = useMemo(() => {
    if (!isInMyOffice) return 'outside-org';
    if (isVetOrSoph) return 'in-org-vet';
    if (isRookie && isSummerStarted) return 'in-org-rookie-summer';
    return 'in-org-rookie-preseason';
  }, [isInMyOffice, isVetOrSoph, isRookie, isSummerStarted]);

  return {
    segment,
    isInMyOffice,
    isSummerStarted,
    isLoading,
  };
};
