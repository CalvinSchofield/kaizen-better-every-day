import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify the caller
    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { targetUserId, nudgeType } = await req.json();
    if (!targetUserId || !nudgeType) {
      return new Response(JSON.stringify({ error: 'Missing targetUserId or nudgeType' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check if leader (must be at least mgmt_group_lead)
    const isLeader = await checkIsLeader(serviceClient, user.id);
    if (!isLeader) {
      return new Response(JSON.stringify({ error: 'Not authorized to send nudges' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check rate limit: max 1 nudge per rep per 24h
    const todayStr = new Date().toISOString().split('T')[0];
    const { data: existingNudge } = await serviceClient
      .from('notification_logs')
      .select('id')
      .eq('user_id', user.id)
      .eq('recipient_user_id', targetUserId)
      .eq('notification_type', `setup_nudge_${nudgeType}`)
      .eq('entry_date', todayStr)
      .maybeSingle();

    if (existingNudge) {
      return new Response(JSON.stringify({ error: 'Already nudged today' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get leader name
    const { data: leaderRep } = await serviceClient
      .from('reps')
      .select('name')
      .eq('user_id', user.id)
      .single();

    const leaderFirstName = leaderRep?.name?.split(' ')[0] || 'Your leader';

    // Build notification
    const title = 'Set Up Your Summer ☀️';
    const body = nudgeType === 'dates'
      ? `${leaderFirstName} wants you to set your summer start and end dates in the app.`
      : `${leaderFirstName} wants you to set your summer goals in the app.`;

    // Send via existing send-apns-notification function
    const apnsResponse = await fetch(`${supabaseUrl}/functions/v1/send-apns-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        targetUserId,
        title,
        body,
        url: '/track',
        type: 'setup_nudge',
      }),
    });

    const apnsResult = await apnsResponse.json();

    // Log the nudge
    await serviceClient.from('notification_logs').insert({
      user_id: user.id,
      recipient_user_id: targetUserId,
      notification_type: `setup_nudge_${nudgeType}`,
      entry_date: todayStr,
      metadata: { nudgeType, leaderName: leaderRep?.name },
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Nudge sent',
      apns: apnsResult,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function checkIsLeader(client: any, userId: string): Promise<boolean> {
  // Check area_directors
  const { data: ad } = await client.from('area_directors').select('id').eq('user_id', userId).maybeSingle();
  if (ad) return true;

  // Check mgmt_groups lead
  const { data: mg } = await client.from('mgmt_groups').select('id').eq('lead_user_id', userId).limit(1);
  if (mg && mg.length > 0) return true;

  // Check teams lead
  const { data: tl } = await client.from('teams').select('id').eq('lead_user_id', userId).limit(1);
  if (tl && tl.length > 0) return true;

  // Check office_staff
  const { data: os } = await client.from('office_staff').select('id').eq('user_id', userId).limit(1);
  if (os && os.length > 0) return true;

  return false;
}
