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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Get the user from the auth header
    const authHeader = req.headers.get('authorization') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? supabaseServiceKey;
    
    // Create client with user's token to identify them
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    
    // Create admin client for operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { activityId, recruitId, replyText, notificationType } = await req.json();

    if (!replyText || replyText.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'Reply text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // We need a user ID — either from auth or we need to find another way
    let userId = user?.id;
    
    if (!userId) {
      console.error('[handle-notification-reply] No authenticated user');
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[handle-notification-reply] User ${userId} replying to ${notificationType}`);
    console.log(`[handle-notification-reply] activityId=${activityId}, recruitId=${recruitId}`);

    let targetActivityId = activityId;

    // If we don't have an activityId but have a recruitId, find the latest activity
    if (!targetActivityId && recruitId) {
      const { data: latestActivity } = await supabase
        .from('recruit_activities')
        .select('id')
        .eq('recruit_id', recruitId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (latestActivity) {
        targetActivityId = latestActivity.id;
      }
    }

    if (!targetActivityId) {
      return new Response(
        JSON.stringify({ error: 'No activity found to reply to' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert the comment
    const { data: comment, error: insertError } = await supabase
      .from('recruit_activity_comments')
      .insert({
        activity_id: targetActivityId,
        user_id: userId,
        content: replyText.trim(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('[handle-notification-reply] Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save reply' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[handle-notification-reply] Comment saved: ${comment.id}`);

    // Trigger the comment notification flow so others get notified
    try {
      // Get the activity to find the recruit
      const { data: activity } = await supabase
        .from('recruit_activities')
        .select('recruit_id, logged_by_user_id')
        .eq('id', targetActivityId)
        .single();

      if (activity) {
        await fetch(`${supabaseUrl}/functions/v1/send-comment-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            activityId: targetActivityId,
            commenterId: userId,
            recruitId: activity.recruit_id,
          }),
        });
      }
    } catch (e) {
      console.error('[handle-notification-reply] Failed to trigger notification:', e);
      // Non-fatal — the comment was saved
    }

    return new Response(
      JSON.stringify({ success: true, commentId: comment.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[handle-notification-reply] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
