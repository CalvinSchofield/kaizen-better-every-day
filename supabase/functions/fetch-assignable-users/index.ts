import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { recruitId } = body;

    if (!recruitId) {
      return new Response(JSON.stringify({ assignableUsers: [] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripEmojis = (text: string | null): string => {
      if (!text) return '';
      return text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu, '').trim();
    };

    // Fetch reps with profile data
    const { data: allReps } = await supabase
      .from('reps')
      .select('user_id, name, id, team_leader, profile_photo_url, year');

    const { data: allRecruits } = await supabase
      .from('recruits')
      .select('id, name, recruiter_user_id, location, team_id, mgmt_group_id');

    if (!allReps || allReps.length === 0) {
      return new Response(JSON.stringify({ assignableUsers: [] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch structural data for formal role resolution
    const [teamsRes, mgmtRes, srMgmtRes, regionsRes] = await Promise.all([
      supabase.from('teams').select('id, name, lead_user_id'),
      supabase.from('mgmt_groups').select('id, name, lead_user_id'),
      supabase.from('sr_mgmt_groups').select('id, name, lead_user_id'),
      supabase.from('regions').select('id, name, lead_user_id'),
    ]);

    const teams = teamsRes.data || [];
    const mgmtGroups = mgmtRes.data || [];
    const srMgmtGroups = srMgmtRes.data || [];
    const regions = regionsRes.data || [];

    // Build a formal role map for each user_id (highest role wins)
    const formalRoleMap = new Map<string, string>();
    for (const r of regions) {
      if (r.lead_user_id) formalRoleMap.set(r.lead_user_id, 'Regional');
    }
    for (const s of srMgmtGroups) {
      if (s.lead_user_id && !formalRoleMap.has(s.lead_user_id)) {
        formalRoleMap.set(s.lead_user_id, 'Sr. MGMT Group Leader');
      }
    }
    for (const m of mgmtGroups) {
      if (m.lead_user_id && !formalRoleMap.has(m.lead_user_id)) {
        formalRoleMap.set(m.lead_user_id, 'MGMT Group Leader');
      }
    }
    for (const t of teams) {
      if (t.lead_user_id && !formalRoleMap.has(t.lead_user_id)) {
        formalRoleMap.set(t.lead_user_id, 'Team Lead');
      }
    }

    // Get the target recruit's data
    const recruitsData = allRecruits || [];
    const targetRecruit = recruitsData.find(r => r.id === recruitId);
    const recruitLocation = targetRecruit?.location || null;

    // Identify the recruit's direct team lead and mgmt group lead
    const recruitTeamId = targetRecruit?.team_id;
    const recruitMgmtGroupId = targetRecruit?.mgmt_group_id;
    const recruitTeamLead = recruitTeamId ? teams.find(t => t.id === recruitTeamId)?.lead_user_id : null;
    const recruitMgmtLead = recruitMgmtGroupId ? mgmtGroups.find(m => m.id === recruitMgmtGroupId)?.lead_user_id : null;

    const currentRep = allReps.find(r => r.user_id === user.id);

    interface EnrichedAssignableUser {
      userId: string;
      name: string;
      role: string;
      repId: string;
      profilePhotoUrl: string | null;
      formalRole: string | null;
      year: string | null;
      location: string | null;
      sameLocation: boolean;
    }

    const assignableUsers: EnrichedAssignableUser[] = [];
    const addedUserIds = new Set<string>();
    const visitedIds = new Set<string>();

    const findRepByName = (targetName: string | null) => {
      if (!targetName) return undefined;
      const cleanTarget = stripEmojis(targetName).toLowerCase();
      return allReps.find(r => {
        const cleanName = stripEmojis(r.name).toLowerCase();
        return cleanName.includes(cleanTarget) || cleanTarget.includes(cleanName);
      });
    };

    // Resolve contextual role relative to the recruit
    const getContextualRole = (userId: string, chainLevel: number): string => {
      if (userId === recruitTeamLead) return 'Team Lead';
      if (userId === recruitMgmtLead) return 'MGMT Group Leader';
      if (chainLevel === 0) return 'Recruiter';
      return formalRoleMap.get(userId) || (chainLevel === 1 ? 'Upline' : 'Senior Leader');
    };

    // Get user's location from their recruit record
    const getUserLocation = (userId: string): string | null => {
      const rep = allReps.find(r => r.user_id === userId);
      if (!rep) return null;
      const cleanRepName = stripEmojis(rep.name).toLowerCase();
      const recruitRecord = recruitsData.find(r => stripEmojis(r.name).toLowerCase() === cleanRepName);
      return recruitRecord?.location || null;
    };

    const addUser = (rep: typeof allReps[0], level: number) => {
      if (!rep.user_id || rep.user_id === user.id || addedUserIds.has(rep.user_id)) return;
      
      const cleanName = stripEmojis(rep.name) || rep.name;
      const userLocation = getUserLocation(rep.user_id);
      const contextualRole = getContextualRole(rep.user_id, level);
      
      assignableUsers.push({
        userId: rep.user_id,
        name: cleanName,
        role: contextualRole,
        repId: rep.id || '',
        profilePhotoUrl: rep.profile_photo_url || null,
        formalRole: formalRoleMap.get(rep.user_id) || null,
        year: rep.year || null,
        location: userLocation,
        sameLocation: !!(recruitLocation && userLocation && 
          recruitLocation.toLowerCase() === userLocation.toLowerCase()),
      });
      addedUserIds.add(rep.user_id);
    };

    // Walk up the recruiter chain
    let currentRecruiterId = targetRecruit?.recruiter_user_id;
    let level = 0;
    const maxLevels = 10;

    while (currentRecruiterId && level < maxLevels && !visitedIds.has(currentRecruiterId)) {
      visitedIds.add(currentRecruiterId);
      const recruiterRep = allReps.find(r => r.user_id === currentRecruiterId);
      if (!recruiterRep) break;

      addUser(recruiterRep, level);

      let nextRecruitRecord = recruitsData.find(r => r.id === recruiterRep.id);
      if (!nextRecruitRecord) {
        const recruiterNameClean = stripEmojis(recruiterRep.name).toLowerCase();
        nextRecruitRecord = recruitsData.find(r => stripEmojis(r.name).toLowerCase() === recruiterNameClean);
      }

      currentRecruiterId = nextRecruitRecord?.recruiter_user_id;
      level++;
    }

    // Fallback: team_leader chain from recruit's recruiter
    if (assignableUsers.length === 0) {
      const recruiterUserId = targetRecruit?.recruiter_user_id;
      const recruiterRepRecord = recruiterUserId ? allReps.find(r => r.user_id === recruiterUserId) : null;
      const startRep = recruiterRepRecord || currentRep;
      
      if (startRep?.team_leader) {
        let currentTeamLeader: string | null = startRep.team_leader;
        const visitedNames = new Set<string>();
        level = 0;

        while (currentTeamLeader && level < maxLevels) {
          const cleanCurrentLeader = stripEmojis(currentTeamLeader).toLowerCase();
          if (visitedNames.has(cleanCurrentLeader)) break;
          visitedNames.add(cleanCurrentLeader);

          const leader = findRepByName(currentTeamLeader);
          if (!leader) break;
          if (!leader.user_id) { currentTeamLeader = leader.team_leader; level++; continue; }

          addUser(leader, level);
          currentTeamLeader = leader.team_leader;
          level++;
        }
      }
    }

    // Final fallback: current user's team_leader chain
    if (assignableUsers.length === 0 && currentRep?.team_leader) {
      let currentTeamLeader: string | null = currentRep.team_leader;
      const visitedNames = new Set<string>();
      visitedNames.add(stripEmojis(currentRep.name).toLowerCase());
      level = 0;

      while (currentTeamLeader && level < maxLevels) {
        const cleanCurrentLeader = stripEmojis(currentTeamLeader).toLowerCase();
        if (visitedNames.has(cleanCurrentLeader)) break;
        visitedNames.add(cleanCurrentLeader);

        const leader = findRepByName(currentTeamLeader);
        if (!leader) break;
        if (!leader.user_id) { currentTeamLeader = leader.team_leader; level++; continue; }

        addUser(leader, level);
        currentTeamLeader = leader.team_leader;
        level++;
      }
    }

    console.log(`Total assignable users: ${assignableUsers.length} for current user ${currentRep?.name || user.id}`);

    return new Response(JSON.stringify({ assignableUsers }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in fetch-assignable-users:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error', assignableUsers: [] }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
