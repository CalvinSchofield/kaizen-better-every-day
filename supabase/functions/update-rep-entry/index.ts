import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADMIN_EMAIL = 'calvinjschofield@gmail.com';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Get the authorization header to verify the requesting user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's auth to verify identity
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    if (user.email !== ADMIN_EMAIL) {
      console.log('Non-admin user attempted to update rep entry:', user.email);
      return new Response(
        JSON.stringify({ error: 'Forbidden - Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { entryId, updates } = await req.json();

    if (!entryId || !updates) {
      return new Response(
        JSON.stringify({ error: 'Missing entryId or updates' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Admin ${user.email} updating entry ${entryId}:`, updates);

    // Create service role client to bypass RLS
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // First fetch the current entry to get existing timestamps
    const { data: currentEntry, error: fetchError } = await adminClient
      .from('daily_entries')
      .select('counter_timestamps, doors_knocked, decision_makers, pitches, transitions, presentations, closes')
      .eq('id', entryId)
      .single();

    if (fetchError) {
      console.error('Error fetching current entry:', fetchError);
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build the update object with only allowed fields
    const allowedFields = [
      'doors_knocked', 'decision_makers', 'pitches', 'transitions',
      'presentations', 'closes', 'fp_plus', 'prmr', 'upgrade_prmr',
      'work_start_time', 'work_end_time', 'is_finalized'
    ];

    const counterFields = ['doors_knocked', 'decision_makers', 'pitches', 'transitions', 'presentations', 'closes'];

    const sanitizedUpdates: Record<string, any> = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        sanitizedUpdates[field] = updates[field];
      }
    }

    // Handle timestamp trimming when counters are reduced
    const currentTimestamps = (currentEntry?.counter_timestamps as Record<string, string[]>) || {};
    const updatedTimestamps = { ...currentTimestamps };
    let timestampsChanged = false;

    for (const field of counterFields) {
      if (updates[field] !== undefined) {
        const newCount = updates[field];
        const timestamps = currentTimestamps[field] || [];
        
        if (timestamps.length > newCount) {
          // Trim to keep earliest N timestamps (remove most recent ones)
          updatedTimestamps[field] = timestamps.slice(0, newCount);
          timestampsChanged = true;
          console.log(`Trimmed ${field} timestamps from ${timestamps.length} to ${newCount}`);
        }
      }
    }

    if (timestampsChanged) {
      sanitizedUpdates.counter_timestamps = updatedTimestamps;
    }

    // Add updated_at timestamp
    sanitizedUpdates.updated_at = new Date().toISOString();

    const { data, error } = await adminClient
      .from('daily_entries')
      .update(sanitizedUpdates)
      .eq('id', entryId)
      .select()
      .single();

    if (error) {
      console.error('Error updating entry:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Entry updated successfully:', data.id);

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});