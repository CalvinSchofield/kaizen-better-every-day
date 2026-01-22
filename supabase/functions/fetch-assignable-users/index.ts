import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the user from the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get request body for recruit context
    const body = await req.json().catch(() => ({}));
    const { recruitId } = body;

    if (!recruitId) {
      console.log('No recruitId provided, returning empty list');
      return new Response(JSON.stringify({ assignableUsers: [] }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Helper function to strip emojis for searching
    const stripEmojis = (text: string | null): string => {
      if (!text) return '';
      return text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu, '').trim();
    };

    // Get current user's rep data
    const { data: currentRep } = await supabase
      .from('reps')
      .select('user_id, name, id, team_leader')
      .eq('user_id', user.id)
      .single();

    // Get all reps to build the upline chain
    const { data: allReps } = await supabase
      .from('reps')
      .select('user_id, name, id, team_leader');

    // Get all recruits to follow the recruiter chain
    const { data: allRecruits } = await supabase
      .from('recruits')
      .select('id, name, recruiter_user_id');

    if (!allReps || allReps.length === 0) {
      return new Response(JSON.stringify({ assignableUsers: [] }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const recruitsData = allRecruits || [];
    
    // Build assignable users by following the recruiter_user_id chain
    const assignableUsers: Array<{
      userId: string;
      name: string;
      role: string;
      repId: string;
    }> = [];

    const addedUserIds = new Set<string>();
    const visitedIds = new Set<string>();

    // Find the TARGET recruit record (the person being viewed)
    const targetRecruitRecord = recruitsData.find(r => r.id === recruitId);

    console.log(`Target recruit: ${targetRecruitRecord?.name || recruitId}, recruiter_user_id: ${targetRecruitRecord?.recruiter_user_id || 'none'}`);

    // Start walking up the recruiter chain FROM THE RECRUIT BEING VIEWED
    let currentRecruiterId = targetRecruitRecord?.recruiter_user_id;
    let level = 0;
    const maxLevels = 10;

    console.log(`Starting upline chain from recruit's recruiter_user_id: ${currentRecruiterId}`);

    // Helper to find a rep by name (fuzzy match)
    const findRepByName = (targetName: string | null): typeof allReps[0] | undefined => {
      if (!targetName) return undefined;
      const cleanTarget = stripEmojis(targetName).toLowerCase();
      return allReps.find(r => {
        const cleanName = stripEmojis(r.name).toLowerCase();
        return cleanName.includes(cleanTarget) || cleanTarget.includes(cleanName);
      });
    };

    while (currentRecruiterId && level < maxLevels && !visitedIds.has(currentRecruiterId)) {
      visitedIds.add(currentRecruiterId);

      // Find the rep record for this recruiter
      const recruiterRep = allReps.find(r => r.user_id === currentRecruiterId);
      
      if (!recruiterRep) {
        console.log(`Could not find rep for recruiter_user_id: ${currentRecruiterId}`);
        break;
      }

      // Don't add the current user to the list
      if (recruiterRep.user_id !== user.id && !addedUserIds.has(recruiterRep.user_id!)) {
        const role = level === 0 ? 'Recruiter' : level === 1 ? 'Upline' : 'Senior Leader';
        const cleanName = stripEmojis(recruiterRep.name) || recruiterRep.name;
        
        assignableUsers.push({
          userId: recruiterRep.user_id!,
          name: cleanName,
          role,
          repId: recruiterRep.id || '',
        });
        addedUserIds.add(recruiterRep.user_id!);
        console.log(`Added ${recruiterRep.name} as ${role} (level ${level})`);
      }

      // Find the next level up - get the recruiter's recruit record
      let nextRecruitRecord = recruitsData.find(r => r.id === recruiterRep.id);
      
      // Fallback: try matching by name
      if (!nextRecruitRecord) {
        const recruiterNameClean = stripEmojis(recruiterRep.name).toLowerCase();
        nextRecruitRecord = recruitsData.find(r => {
          const recruitNameClean = stripEmojis(r.name).toLowerCase();
          return recruitNameClean === recruiterNameClean;
        });
      }

      currentRecruiterId = nextRecruitRecord?.recruiter_user_id;
      level++;
    }

    // ENHANCED FALLBACK: If no recruiter chain found, trace via team_leader from the RECRUIT's data
    if (assignableUsers.length === 0) {
      console.log('No recruiter chain found, trying team_leader chain from recruit');
      
      // Find the recruiter's REP record by recruiter_user_id
      const recruiterUserId = targetRecruitRecord?.recruiter_user_id;
      let recruiterRepRecord = recruiterUserId ? allReps.find(r => r.user_id === recruiterUserId) : null;
      
      // If the recruiter has no user_id yet, we need to find them by name match
      // The recruiter might be in the reps table but without a user_id
      if (!recruiterRepRecord && targetRecruitRecord) {
        // We need to find WHO recruited this person - check if there's a rep with matching id
        // The recruiter_user_id might actually be the current user's id if they added the recruit
        // But the ACTUAL recruiter was selected from a dropdown and stored elsewhere
        console.log('Recruiter has no matching rep with user_id, checking team_leader chain');
      }

      // If we still don't have assignable users, walk up the team_leader chain
      // Start from the rep who matches the recruiter, or if not found, use current user
      const startRep = recruiterRepRecord || currentRep;
      
      if (startRep?.team_leader) {
        let currentTeamLeader = startRep.team_leader;
        const visitedNames = new Set<string>();
        level = 0;

        while (currentTeamLeader && level < maxLevels) {
          const cleanCurrentLeader = stripEmojis(currentTeamLeader).toLowerCase();
          
          if (visitedNames.has(cleanCurrentLeader)) {
            console.log(`Already visited ${currentTeamLeader}, stopping chain`);
            break;
          }
          visitedNames.add(cleanCurrentLeader);

          const leader = findRepByName(currentTeamLeader);
          
          if (!leader) {
            console.log(`Could not find leader matching: ${currentTeamLeader}`);
            break;
          }

          if (!leader.user_id) {
            console.log(`Leader ${leader.name} has no user_id, continuing chain`);
            currentTeamLeader = leader.team_leader;
            level++;
            continue;
          }

          if (leader.user_id !== user.id && !addedUserIds.has(leader.user_id)) {
            const role = level === 0 ? 'Team Leader' : level === 1 ? 'Upline' : 'Senior Leader';
            const cleanName = stripEmojis(leader.name) || leader.name;
            assignableUsers.push({
              userId: leader.user_id,
              name: cleanName,
              role,
              repId: leader.id || '',
            });
            addedUserIds.add(leader.user_id);
            console.log(`Added ${leader.name} as ${role} (level ${level}) via team_leader fallback`);
          }

          currentTeamLeader = leader.team_leader;
          level++;
        }
      }
    }

    // FINAL FALLBACK: If still no assignable users, the issue is the recruiter_user_id is wrong
    // It's set to the current user (Calvin) instead of Abi. We need to look up the correct recruiter.
    // Check if the recruit has a recruiter name stored differently or find via team structure
    if (assignableUsers.length === 0 && currentRep?.team_leader) {
      console.log('Still no assignable users, walking up from current user team_leader');
      
      let currentTeamLeader = currentRep.team_leader;
      const visitedNames = new Set<string>();
      visitedNames.add(stripEmojis(currentRep.name).toLowerCase()); // Don't add ourselves
      level = 0;

      while (currentTeamLeader && level < maxLevels) {
        const cleanCurrentLeader = stripEmojis(currentTeamLeader).toLowerCase();
        
        if (visitedNames.has(cleanCurrentLeader)) {
          console.log(`Already visited ${currentTeamLeader}, stopping chain`);
          break;
        }
        visitedNames.add(cleanCurrentLeader);

        const leader = findRepByName(currentTeamLeader);
        
        if (!leader) {
          console.log(`Could not find leader matching: ${currentTeamLeader}`);
          break;
        }

        if (!leader.user_id) {
          console.log(`Leader ${leader.name} has no user_id, continuing chain`);
          currentTeamLeader = leader.team_leader;
          level++;
          continue;
        }

        if (leader.user_id !== user.id && !addedUserIds.has(leader.user_id)) {
          const role = level === 0 ? 'Team Leader' : level === 1 ? 'Upline' : 'Senior Leader';
          const cleanName = stripEmojis(leader.name) || leader.name;
          assignableUsers.push({
            userId: leader.user_id,
            name: cleanName,
            role,
            repId: leader.id || '',
          });
          addedUserIds.add(leader.user_id);
          console.log(`Added ${leader.name} as ${role} (level ${level}) via current user team_leader`);
        }

        currentTeamLeader = leader.team_leader;
        level++;
      }
    }

    console.log(`Total assignable users: ${assignableUsers.length} for current user ${currentRep?.name || user.id}`);

    return new Response(JSON.stringify({ assignableUsers }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in fetch-assignable-users:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error', assignableUsers: [] }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});