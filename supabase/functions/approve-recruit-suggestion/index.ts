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
    const notionApiKey = Deno.env.get('NOTION_API_KEY');
    const notionRepsDbId = Deno.env.get('NOTION_REPS_DATABASE_ID');

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

    const { suggestionId, action } = await req.json();

    if (!suggestionId || !action) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the suggestion
    const { data: suggestion, error: fetchError } = await supabase
      .from('recruit_suggestions')
      .select('*')
      .eq('id', suggestionId)
      .single();

    if (fetchError || !suggestion) {
      return new Response(JSON.stringify({ error: 'Suggestion not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'reject') {
      // Simply update status to rejected
      const { error: updateError } = await supabase
        .from('recruit_suggestions')
        .update({
          status: 'rejected',
          reviewed_by_user_id: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', suggestionId);

      if (updateError) throw updateError;

      return new Response(JSON.stringify({ success: true, action: 'rejected' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'approve') {
      let notionPageId = null;

      // Get the suggester's notion page ID to use as recruiter
      const { data: suggesterRep } = await supabase
        .from('reps')
        .select('notion_page_id')
        .eq('user_id', suggestion.suggested_by_user_id)
        .maybeSingle();

      const recruiterNotionId = suggesterRep?.notion_page_id;

      // Create in Notion if API key available
      if (notionApiKey && notionRepsDbId) {
        const properties: Record<string, any> = {
          'Name': {
            title: [{ text: { content: suggestion.name } }]
          },
          'Phone': {
            phone_number: suggestion.phone
          },
          'Stage': {
            select: { name: '100 List' }
          },
          'Year': {
            select: { name: 'Rookie' }
          }
        };

        // Add recruiter relation using suggester's notion page ID
        if (recruiterNotionId) {
          properties['Recruiter'] = {
            relation: [{ id: recruiterNotionId }]
          };
          // Also set Downline to the suggester
          properties['Downline'] = {
            relation: [{ id: recruiterNotionId }]
          };
        }

        console.log(`Creating Notion page for approved suggestion: ${suggestion.name}, recruiter: ${recruiterNotionId}`);

        const notionResponse = await fetch(`https://api.notion.com/v1/pages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${notionApiKey}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            parent: { database_id: notionRepsDbId },
            properties,
          }),
        });

        if (notionResponse.ok) {
          const notionData = await notionResponse.json();
          notionPageId = notionData.id;
          console.log(`Created Notion page for ${suggestion.name}: ${notionPageId}`);
        } else {
          const errorText = await notionResponse.text();
          console.error('Notion API error:', errorText);
        }
      }

      // Update suggestion as approved
      const { error: updateError } = await supabase
        .from('recruit_suggestions')
        .update({
          status: 'approved',
          reviewed_by_user_id: user.id,
          reviewed_at: new Date().toISOString(),
          notion_page_id: notionPageId,
        })
        .eq('id', suggestionId);

      if (updateError) throw updateError;

      return new Response(JSON.stringify({ 
        success: true, 
        action: 'approved',
        notionPageId 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error processing suggestion:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
