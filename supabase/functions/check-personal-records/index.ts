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
    const { userId, entryId, fpPlus, prmr, entryDate } = await req.json();
    
    console.log(`[check-personal-records] Checking records for user ${userId}: FP+=${fpPlus}, PRMR=${prmr}`);

    if (!userId || !entryId) {
      throw new Error('userId and entryId are required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!;
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get rep info for the notification
    const { data: rep, error: repError } = await supabase
      .from('reps')
      .select('name, email')
      .eq('user_id', userId)
      .maybeSingle();

    if (repError || !rep) {
      console.error('[check-personal-records] Error fetching rep:', repError);
      throw new Error('Could not find rep');
    }

    const repName = rep.name;
    console.log(`[check-personal-records] Checking records for ${repName}`);

    // Check existing records
    const { data: existingRecords, error: recordsError } = await supabase
      .from('personal_records')
      .select('*')
      .eq('user_id', userId)
      .in('record_type', ['daily_fp', 'daily_prmr']);

    if (recordsError) {
      console.error('[check-personal-records] Error fetching existing records:', recordsError);
    }

    const existingFpRecord = existingRecords?.find(r => r.record_type === 'daily_fp');
    const existingPrmrRecord = existingRecords?.find(r => r.record_type === 'daily_prmr');

    let beatFp = false;
    let beatPrmr = false;
    let oldFpValue = existingFpRecord?.value || 0;
    let oldPrmrValue = existingPrmrRecord?.value || 0;

    // Check FP+ record (only if fpPlus > 0)
    if (fpPlus > 0 && fpPlus > oldFpValue) {
      beatFp = true;
      console.log(`[check-personal-records] NEW FP+ RECORD: ${fpPlus} beats ${oldFpValue}`);
      
      // Upsert the new record
      const { error: upsertError } = await supabase
        .from('personal_records')
        .upsert({
          user_id: userId,
          record_type: 'daily_fp',
          value: fpPlus,
          entry_date: entryDate,
          entry_id: entryId,
          achieved_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,record_type'
        });

      if (upsertError) {
        console.error('[check-personal-records] Error upserting FP record:', upsertError);
      }
    }

    // Check PRMR record (only if prmr > 0)
    if (prmr > 0 && prmr > oldPrmrValue) {
      beatPrmr = true;
      console.log(`[check-personal-records] NEW PRMR RECORD: ${prmr} beats ${oldPrmrValue}`);
      
      // Upsert the new record
      const { error: upsertError } = await supabase
        .from('personal_records')
        .upsert({
          user_id: userId,
          record_type: 'daily_prmr',
          value: prmr,
          entry_date: entryDate,
          entry_id: entryId,
          achieved_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,record_type'
        });

      if (upsertError) {
        console.error('[check-personal-records] Error upserting PRMR record:', upsertError);
      }
    }

    // If no records were beaten, we're done
    if (!beatFp && !beatPrmr) {
      console.log('[check-personal-records] No records beaten');
      return new Response(
        JSON.stringify({ success: true, recordsBroken: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build the notification message
    let notificationBody = '';
    let recordTypes: string[] = [];

    if (beatFp && beatPrmr) {
      notificationBody = `${repName} crushed it today — ${fpPlus} FP+ and $${Math.round(prmr)} PRMR! 🔥`;
      recordTypes = ['daily_fp', 'daily_prmr'];
    } else if (beatFp) {
      notificationBody = `${repName} just had their best day ever — ${fpPlus} FP+! 🎉`;
      recordTypes = ['daily_fp'];
    } else if (beatPrmr) {
      notificationBody = `${repName} hit their best PRMR — $${Math.round(prmr)}! 💰`;
      recordTypes = ['daily_prmr'];
    }

    console.log(`[check-personal-records] Notification: ${notificationBody}`);

    // Get the user's upline for notifications
    // First find if this user is a recruit
    const { data: recruit } = await supabase
      .from('recruits')
      .select('id, team_id, recruiter_user_id')
      .ilike('email', rep.email || '')
      .maybeSingle();

    const uplineUserIds: Set<string> = new Set();

    // Add direct recruiter
    if (recruit?.recruiter_user_id) {
      uplineUserIds.add(recruit.recruiter_user_id);
    }

    // Get team lead
    if (recruit?.team_id) {
      const { data: team } = await supabase
        .from('teams')
        .select('lead_user_id')
        .eq('id', recruit.team_id)
        .maybeSingle();
      
      if (team?.lead_user_id) {
        uplineUserIds.add(team.lead_user_id);
      }

      // Get mgmt group leads
      const { data: teamMgmtGroups } = await supabase
        .from('team_mgmt_groups')
        .select('mgmt_group_id')
        .eq('team_id', recruit.team_id);

      if (teamMgmtGroups?.length) {
        const { data: mgmtGroups } = await supabase
          .from('mgmt_groups')
          .select('lead_user_id')
          .in('id', teamMgmtGroups.map(t => t.mgmt_group_id));
        
        mgmtGroups?.forEach(mg => {
          if (mg.lead_user_id) uplineUserIds.add(mg.lead_user_id);
        });
      }
    }

    // Add all area directors
    const { data: areaDirectors } = await supabase
      .from('area_directors')
      .select('user_id');
    
    areaDirectors?.forEach(ad => uplineUserIds.add(ad.user_id));

    // Remove the user themselves from notifications
    uplineUserIds.delete(userId);

    console.log(`[check-personal-records] Notifying ${uplineUserIds.size} leaders`);

    if (uplineUserIds.size === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          recordsBroken: true,
          beatFp,
          beatPrmr,
          notified: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get push subscriptions
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', Array.from(uplineUserIds));

    // Send notifications
    let successCount = 0;
    const payload = {
      title: 'Personal Best! 🏆',
      body: notificationBody,
      url: `/my-group?highlight=${userId}`,
      tag: `personal-record-${userId}-${entryDate}`,
    };

    for (const sub of subscriptions || []) {
      try {
        const result = await sendWebPush(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          payload,
          vapidPublicKey,
          vapidPrivateKey
        );

        if (result.success) {
          successCount++;
          
          // Log the notification
          await supabase.from('notification_logs').insert({
            user_id: userId,
            recipient_user_id: sub.user_id,
            notification_type: 'personal_record',
            entry_date: entryDate,
            metadata: {
              record_types: recordTypes,
              fp_plus: beatFp ? fpPlus : null,
              prmr: beatPrmr ? prmr : null,
              old_fp: beatFp ? oldFpValue : null,
              old_prmr: beatPrmr ? oldPrmrValue : null,
              rep_name: repName
            }
          });
        }
      } catch (err) {
        console.error(`[check-personal-records] Error sending to ${sub.user_id}:`, err);
      }
    }

    console.log(`[check-personal-records] Sent ${successCount} notifications`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        recordsBroken: true,
        beatFp,
        beatPrmr,
        notified: successCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[check-personal-records] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
