import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { today, comparison, avgDoors, avgFp } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Build context for the AI
    const context = `
Today's Performance:
- Doors: ${today.doors} (average: ${avgDoors.toFixed(0)})
- Pitches: ${today.pitches}
- Transitions: ${today.transitions}
- Presentations: ${today.presentations}
- Closes: ${today.closes}
- FP+: ${today.fp.toFixed(1)} (average: ${avgFp.toFixed(1)})

Comparison: ${comparison.fpChange >= 0 ? '+' : ''}${comparison.fpChange.toFixed(1)} FP+ ${comparison.label}
`;

    const systemPrompt = `You are a supportive door-to-door sales coach. Based on today's performance data, provide ONE actionable focus for tomorrow in a single sentence. Keep it encouraging, specific, and conversational.

Examples of good responses:
- "Tomorrow, focus on getting into more homes — your pitch is working!"
- "Volume was great today. Tomorrow, spend more time with fewer people."
- "Get out earlier tomorrow — more doors = more opportunities."
- "Keep that momentum going — let's close more of those presentations!"

Keep it to ONE sentence. Be specific about what to do differently. Use "you" language. Keep it motivating.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: context }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error('Failed to generate daily focus');
    }

    const data = await response.json();
    const focus = data.choices[0].message.content;

    return new Response(
      JSON.stringify({ focus }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating daily focus:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
