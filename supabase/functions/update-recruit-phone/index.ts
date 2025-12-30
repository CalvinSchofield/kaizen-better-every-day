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

    const { recruitId, repId, phone } = await req.json();

    if (!recruitId && !repId) {
      return new Response(JSON.stringify({ error: 'recruitId or repId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!phone) {
      return new Response(JSON.stringify({ error: 'phone is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Clean the phone number - remove all non-digits
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Validate it's a proper 10-digit number
    if (cleanPhone.length !== 10) {
      return new Response(JSON.stringify({ error: 'Phone number must be 10 digits' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Updating phone to ${cleanPhone}`);

    // Update in recruits table if recruitId provided
    if (recruitId) {
      const { error: updateError } = await supabase
        .from('recruits')
        .update({ phone: cleanPhone, updated_at: new Date().toISOString() })
        .eq('id', recruitId);

      if (updateError) {
        console.error('Error updating recruit phone:', updateError);
        throw new Error(`Failed to update recruit phone: ${updateError.message}`);
      }
      console.log(`Updated recruit ${recruitId} phone`);
    }

    // Update in reps table if repId provided
    if (repId) {
      const { error: updateError } = await supabase
        .from('reps')
        .update({ phone: cleanPhone, updated_at: new Date().toISOString() })
        .eq('id', repId);

      if (updateError) {
        console.error('Error updating rep phone:', updateError);
        throw new Error(`Failed to update rep phone: ${updateError.message}`);
      }
      console.log(`Updated rep ${repId} phone`);
    }

    console.log('Phone updated successfully');

    return new Response(JSON.stringify({ success: true, phone: cleanPhone }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error updating phone:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
