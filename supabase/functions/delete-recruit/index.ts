import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to check if a user can access a recruit (via their scope)
async function canDeleteRecruit(supabase: any, userId: string, recruitId: string): Promise<boolean> {
  // Check access levels in order of privilege
  const { data: isAD } = await supabase.rpc('is_area_director', { _user_id: userId });
  if (isAD) return true;

  const { data: isMgmtLead } = await supabase.rpc('is_mgmt_group_lead', { _user_id: userId });
  const { data: isTeamLead } = await supabase.rpc('is_team_lead', { _user_id: userId });
  
  if (!isMgmtLead && !isTeamLead) {
    // Check if user is a recruiter (has recruited anyone)
    const { data: directRecruits } = await supabase
      .from('recruits')
      .select('id')
      .eq('recruiter_user_id', userId)
      .limit(1);
    
    if (!directRecruits || directRecruits.length === 0) {
      return false; // No leadership role and not a recruiter
    }
  }

  // Check if the recruit is within the user's accessible scope
  const { data: recruit } = await supabase
    .from('recruits')
    .select('recruiter_user_id, team_id, mgmt_group_id')
    .eq('id', recruitId)
    .maybeSingle();

  if (!recruit) return false;

  // Direct recruit check - if user recruited this person, they can delete
  if (recruit.recruiter_user_id === userId) return true;

  // For team leads - check if recruit is on their team
  if (isTeamLead) {
    const { data: userTeams } = await supabase
      .from('teams')
      .select('id')
      .eq('lead_user_id', userId);
    
    if (userTeams && recruit.team_id) {
      const teamIds = userTeams.map((t: any) => t.id);
      if (teamIds.includes(recruit.team_id)) return true;
    }
  }

  // For mgmt group leads - check if recruit is in their mgmt group
  if (isMgmtLead) {
    const { data: userMgmtGroups } = await supabase
      .from('mgmt_groups')
      .select('id')
      .eq('lead_user_id', userId);
    
    if (userMgmtGroups && recruit.mgmt_group_id) {
      const mgmtGroupIds = userMgmtGroups.map((g: any) => g.id);
      if (mgmtGroupIds.includes(recruit.mgmt_group_id)) return true;
    }
    
    // Also check if recruit's team is in one of their mgmt groups
    if (recruit.team_id) {
      const { data: teamMgmtGroups } = await supabase
        .from('team_mgmt_groups')
        .select('mgmt_group_id')
        .eq('team_id', recruit.team_id);
      
      if (teamMgmtGroups && userMgmtGroups) {
        const userMgmtIds = userMgmtGroups.map((g: any) => g.id);
        const recruitMgmtIds = teamMgmtGroups.map((tmg: any) => tmg.mgmt_group_id);
        if (recruitMgmtIds.some((id: string) => userMgmtIds.includes(id))) return true;
      }
    }
  }

  // Check recursive downline (recruiter tree)
  const checkDownline = async (recruiterId: string, targetRecruitId: string, depth: number = 0): Promise<boolean> => {
    if (depth > 6) return false;
    
    const { data: directRecruits } = await supabase
      .from('recruits')
      .select('id, recruiter_user_id')
      .eq('recruiter_user_id', recruiterId);
    
    if (!directRecruits) return false;
    
    for (const r of directRecruits) {
      if (r.id === targetRecruitId) return true;
      
      const { data: recruitRep } = await supabase
        .from('reps')
        .select('user_id')
        .eq('id', r.id)
        .maybeSingle();
      
      if (recruitRep?.user_id) {
        const found = await checkDownline(recruitRep.user_id, targetRecruitId, depth + 1);
        if (found) return true;
      }
    }
    
    return false;
  };

  return await checkDownline(userId, recruitId);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is authenticated
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const recruitId: string | undefined = body?.recruitId;
    const repId: string | undefined = body?.repId;

    if (!recruitId) {
      return new Response(JSON.stringify({ error: 'Missing recruitId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user has permission to delete this recruit
    const canDelete = await canDeleteRecruit(supabase, user.id, recruitId);
    
    if (!canDelete) {
      console.log(`[delete-recruit] User ${user.id} denied permission to delete recruit ${recruitId}`);
      return new Response(JSON.stringify({ error: 'Unauthorized - you can only delete recruits in your scope' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[delete-recruit] Deleting recruit ${recruitId} by user ${user.id}`);

    // Get recruit email to find linked rep
    const { data: recruit } = await supabase
      .from('recruits')
      .select('email')
      .eq('id', recruitId)
      .maybeSingle();

    // Delete in order to respect foreign key constraints
    // 1. Delete recruit_activities
    const { error: activitiesError } = await supabase
      .from('recruit_activities')
      .delete()
      .eq('recruit_id', recruitId);

    if (activitiesError) {
      console.error('[delete-recruit] Error deleting activities:', activitiesError);
    }

    // 2. Delete recruit_blitzes
    const { error: blitzesError } = await supabase
      .from('recruit_blitzes')
      .delete()
      .eq('recruit_id', recruitId);

    if (blitzesError) {
      console.error('[delete-recruit] Error deleting blitzes:', blitzesError);
    }

    // 3. Delete from recruits table (if recruitId is a recruit row)
    const { data: deletedRecruits, error: recruitDeleteError } = await supabase
      .from('recruits')
      .delete()
      .eq('id', recruitId)
      .select('id');

    if (recruitDeleteError) {
      console.error('[delete-recruit] Error deleting recruit:', recruitDeleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete recruit', details: recruitDeleteError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const deletedRecruitsCount = deletedRecruits?.length ?? 0;

    // 4. Delete from reps table by id (covers "rep-only" records where there's no recruits row)
    const deletedRepIds = new Set<string>();

    const repIdsToDelete = [repId, recruitId].filter(Boolean) as string[];
    if (repIdsToDelete.length > 0) {
      const { data: deletedRepsById, error: repDeleteByIdError } = await supabase
        .from('reps')
        .delete()
        .in('id', repIdsToDelete)
        .select('id');

      if (repDeleteByIdError) {
        console.error('[delete-recruit] Error deleting rep by id:', repDeleteByIdError);
      } else {
        for (const r of deletedRepsById ?? []) {
          deletedRepIds.add(r.id);
        }
      }
    }

    // 5. Also delete from reps table by email match (when available)
    if (recruit?.email) {
      const { data: deletedRepsByEmail, error: repDeleteByEmailError } = await supabase
        .from('reps')
        .delete()
        .ilike('email', recruit.email)
        .select('id');

      if (repDeleteByEmailError) {
        console.error('[delete-recruit] Error deleting rep by email:', repDeleteByEmailError);
      } else {
        for (const r of deletedRepsByEmail ?? []) {
          deletedRepIds.add(r.id);
        }
      }
    }

    const deletedRepsCount = deletedRepIds.size;

    console.log(
      `[delete-recruit] Deleted recruits rows: ${deletedRecruitsCount}, deleted reps rows: ${deletedRepsCount}`
    );

    if (deletedRecruitsCount === 0 && deletedRepsCount === 0) {
      return new Response(
        JSON.stringify({ error: 'Nothing to delete (already deleted or not found)' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`[delete-recruit] Successfully deleted recruit ${recruitId}`);

    return new Response(
      JSON.stringify({
        success: true,
        deleted: { recruits: deletedRecruitsCount, reps: deletedRepsCount },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[delete-recruit] Unexpected error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
