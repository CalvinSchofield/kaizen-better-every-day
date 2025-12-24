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

    // Authenticate user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { includeActivities = true } = body;

    // Get current user's rep record to determine access level
    const { data: currentRep } = await supabase
      .from('reps')
      .select('notion_page_id, user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    // Get accessible team IDs for this user
    const { data: accessibleTeamIds } = await supabase
      .rpc('get_accessible_team_ids', { _user_id: user.id });

    // Check if user is area director
    const { data: isAreaDir } = await supabase
      .rpc('is_area_director', { _user_id: user.id });

    // Build query for recruits - recruiting-related stages only
    const recruitingStages = ['100 List', 'Reached Out', 'Evaluating', 'Signed', 'Shadow ✅', 'Sold 💲', 'Sold (5+) 💰'];
    
    let recruitsQuery = supabase
      .from('recruits')
      .select(`
        id,
        notion_page_id,
        name,
        phone,
        email,
        stage,
        year,
        location,
        recruitment_source,
        last_contact,
        next_action,
        next_action_due,
        created_at,
        onboarding_complete,
        trainings_complete,
        slack_joined,
        ramp_phase_1_complete,
        ramp_phase_2_complete,
        ramp_phase_3_complete,
        ramp_phase_4_complete,
        ipad_assigned,
        blitz_ready,
        recruiter_user_id,
        team_id,
        mgmt_group_id
      `)
      .in('stage', recruitingStages);

    // Apply access control
    if (isAreaDir) {
      // Area directors see all recruits
    } else if (accessibleTeamIds && accessibleTeamIds.length > 0) {
      // Team leads see recruits in their teams OR recruits they personally recruited
      recruitsQuery = recruitsQuery.or(`recruiter_user_id.eq.${user.id},team_id.in.(${accessibleTeamIds.join(',')})`);
    } else {
      // Regular users see only their own recruits
      recruitsQuery = recruitsQuery.eq('recruiter_user_id', user.id);
    }

    const { data: recruitsData, error: recruitsError } = await recruitsQuery.order('created_at', { ascending: false });

    if (recruitsError) {
      console.error('Error fetching recruits:', recruitsError);
      throw recruitsError;
    }

    // Get recruiter names for all recruits
    const recruiterUserIds = [...new Set((recruitsData || []).map(r => r.recruiter_user_id).filter(Boolean))];
    const { data: recruiters } = await supabase
      .from('reps')
      .select('user_id, notion_page_id, name')
      .in('user_id', recruiterUserIds.length > 0 ? recruiterUserIds : ['00000000-0000-0000-0000-000000000000']);

    const recruiterMap = new Map(recruiters?.map(r => [r.user_id, r]) || []);

    // Get blitz commitments for all recruits
    const recruitIds = (recruitsData || []).map(r => r.id);
    const { data: recruitBlitzes } = await supabase
      .from('recruit_blitzes')
      .select('recruit_id, blitz_id, blitzes(id, name, date, end_date, location)')
      .in('recruit_id', recruitIds.length > 0 ? recruitIds : ['00000000-0000-0000-0000-000000000000']);

    // Group blitzes by recruit
    const blitzesByRecruit = new Map<string, any[]>();
    for (const rb of recruitBlitzes || []) {
      if (!blitzesByRecruit.has(rb.recruit_id)) {
        blitzesByRecruit.set(rb.recruit_id, []);
      }
      // blitzes is a single joined object, not an array
      const blitz = rb.blitzes as any;
      if (blitz) {
        blitzesByRecruit.get(rb.recruit_id)!.push({
          id: blitz.id,
          name: blitz.name,
          date: blitz.date,
          endDate: blitz.end_date,
          location: blitz.location,
        });
      }
    }

    // Transform recruits to expected format
    const recruits = (recruitsData || []).map(r => {
      const recruiter = recruiterMap.get(r.recruiter_user_id);
      return {
        notionPageId: r.notion_page_id || r.id, // Use Supabase ID if no Notion ID
        id: r.id,
        name: r.name,
        phone: r.phone,
        email: r.email,
        stage: r.stage,
        year: r.year,
        location: r.location,
        recruitmentSource: r.recruitment_source,
        lastContact: r.last_contact,
        nextAction: r.next_action,
        nextActionDue: r.next_action_due,
        createdAt: r.created_at,
        recruiterNotionId: recruiter?.notion_page_id,
        recruiterUserId: r.recruiter_user_id,
        recruiterName: recruiter?.name,
        teamId: r.team_id,
        mgmtGroupId: r.mgmt_group_id,
        // Ramp phase data
        onboardingComplete: r.onboarding_complete ?? false,
        trainingsComplete: r.trainings_complete ?? false,
        slackJoined: r.slack_joined ?? false,
        phase1Complete: r.ramp_phase_1_complete ?? false,
        phase2Complete: r.ramp_phase_2_complete ?? false,
        phase3Complete: r.ramp_phase_3_complete ?? false,
        phase4Complete: r.ramp_phase_4_complete ?? false,
        ipadAssigned: r.ipad_assigned ?? false,
        blitzReady: r.blitz_ready ?? false,
        // Committed blitzes
        committedBlitzes: blitzesByRecruit.get(r.id) || [],
      };
    });

    // Fetch activities from Supabase if requested
    let activities: any[] = [];
    if (includeActivities && recruits.length > 0) {
      // Use both notion_page_id and Supabase id for activity lookup
      const recruitNotionIds = recruits.map(r => r.notionPageId).filter(Boolean);
      
      const { data: activityData } = await supabase
        .from('recruit_activities')
        .select('*')
        .in('rep_notion_page_id', recruitNotionIds)
        .order('created_at', { ascending: false })
        .limit(500);
      
      activities = activityData || [];
    }

    // Fetch pending suggestions for this user's team
    let pendingSuggestions: any[] = [];
    if (currentRep?.notion_page_id) {
      const { data: suggestions } = await supabase
        .from('recruit_suggestions')
        .select('*')
        .eq('team_leader_notion_id', currentRep.notion_page_id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      
      pendingSuggestions = suggestions || [];
    }

    console.log(`Fetched ${recruits.length} recruits, ${activities.length} activities, ${pendingSuggestions.length} pending suggestions from Supabase`);

    return new Response(JSON.stringify({ 
      recruits, 
      activities,
      pendingSuggestions
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching group recruits:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
