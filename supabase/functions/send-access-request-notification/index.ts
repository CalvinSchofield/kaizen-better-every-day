import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWebPush } from "../_shared/web-push.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userEmail, userName } = await req.json();
    
    console.log(`[send-access-request-notification] Processing request for: ${userName} (${userEmail})`);

    if (!userEmail || !userName) {
      throw new Error('userEmail and userName are required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!;
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Step 1: Find the recruit by email to get their team structure
    const { data: recruit, error: recruitError } = await supabase
      .from('recruits')
      .select('id, team_id, recruiter_user_id')
      .ilike('email', userEmail)
      .maybeSingle();

    if (recruitError) {
      console.error('[send-access-request-notification] Error finding recruit:', recruitError);
    }

    console.log('[send-access-request-notification] Found recruit:', recruit);

    // Step 2: Build the upline chain
    const uplineUserIds: Set<string> = new Set();

    // Add direct recruiter if exists
    if (recruit?.recruiter_user_id) {
      uplineUserIds.add(recruit.recruiter_user_id);
      console.log('[send-access-request-notification] Added recruiter:', recruit.recruiter_user_id);
    }

    // Get team lead if team_id exists
    if (recruit?.team_id) {
      const { data: team } = await supabase
        .from('teams')
        .select('lead_user_id')
        .eq('id', recruit.team_id)
        .maybeSingle();
      
      if (team?.lead_user_id) {
        uplineUserIds.add(team.lead_user_id);
        console.log('[send-access-request-notification] Added team lead:', team.lead_user_id);
      }

      // Get mgmt group lead via team_mgmt_groups
      const { data: teamMgmtGroups } = await supabase
        .from('team_mgmt_groups')
        .select('mgmt_group_id')
        .eq('team_id', recruit.team_id);

      if (teamMgmtGroups && teamMgmtGroups.length > 0) {
        const mgmtGroupIds = teamMgmtGroups.map(tmg => tmg.mgmt_group_id);
        
        const { data: mgmtGroups } = await supabase
          .from('mgmt_groups')
          .select('lead_user_id')
          .in('id', mgmtGroupIds);
        
        if (mgmtGroups) {
          for (const mg of mgmtGroups) {
            if (mg.lead_user_id) {
              uplineUserIds.add(mg.lead_user_id);
              console.log('[send-access-request-notification] Added mgmt group lead:', mg.lead_user_id);
            }
          }
        }
      }
    }

    // Always add all area directors
    const { data: areaDirectors } = await supabase
      .from('area_directors')
      .select('user_id');

    if (areaDirectors) {
      for (const ad of areaDirectors) {
        uplineUserIds.add(ad.user_id);
        console.log('[send-access-request-notification] Added area director:', ad.user_id);
      }
    }

    console.log(`[send-access-request-notification] Total upline users to notify: ${uplineUserIds.size}`);

    if (uplineUserIds.size === 0) {
      console.log('[send-access-request-notification] No upline users found to notify');
      return new Response(
        JSON.stringify({ success: true, notified: 0, message: 'No upline users found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Get push subscriptions for all upline users
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', Array.from(uplineUserIds));

    if (subError) {
      console.error('[send-access-request-notification] Error fetching subscriptions:', subError);
      throw subError;
    }

    console.log(`[send-access-request-notification] Found ${subscriptions?.length || 0} push subscriptions`);

    // Step 4: Send notifications
    let successCount = 0;
    let failCount = 0;

    const payload = {
      title: 'Access Request',
      body: `${userName} is requesting access to Kaizen`,
      url: `/my-group?action=approve&email=${encodeURIComponent(userEmail)}`,
      tag: `access-request-${userEmail}`,
    };

    for (const sub of subscriptions || []) {
      try {
        const result = await sendWebPush(
          {
            endpoint: sub.endpoint,
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
          payload,
          vapidPublicKey,
          vapidPrivateKey
        );

        if (result.success) {
          successCount++;
          console.log(`[send-access-request-notification] Sent to user ${sub.user_id}`);
          
          // Log the notification
          await supabase.from('notification_logs').insert({
            user_id: sub.user_id,
            recipient_user_id: sub.user_id,
            notification_type: 'access_request',
            entry_date: new Date().toISOString().split('T')[0],
            metadata: { 
              requester_email: userEmail, 
              requester_name: userName,
              recruit_id: recruit?.id || null
            }
          });
        } else {
          failCount++;
          console.error(`[send-access-request-notification] Failed for user ${sub.user_id}:`, result.error);
        }
      } catch (err) {
        failCount++;
        console.error(`[send-access-request-notification] Error sending to ${sub.user_id}:`, err);
      }
    }

    console.log(`[send-access-request-notification] Complete: ${successCount} sent, ${failCount} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        notified: successCount, 
        failed: failCount,
        totalUpline: uplineUserIds.size
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[send-access-request-notification] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
