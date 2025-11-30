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
    const { funnel, ratios, totals, timeframe, daysWorked } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Build context for the AI
    const context = `
Performance Data for ${timeframe} (${daysWorked} days worked):

FUNNEL:
- Doors: ${funnel.doors.total} (${funnel.doors.conversionToNext}% → DMs)
- Decision Makers: ${funnel.decisionMakers.total} (${funnel.decisionMakers.conversionToNext}% → Pitches)
- Pitches: ${funnel.pitches.total} (${funnel.pitches.conversionToNext}% → Transitions)
- Transitions: ${funnel.transitions.total} (${funnel.transitions.conversionToNext}% → Presentations)
- Presentations: ${funnel.presentations.total} (${funnel.presentations.conversionToNext}% → Closes)
- Closes: ${funnel.closes.total}

RATIOS (vs overall average):
- Doors to FP+: ${ratios.doorsToFp.current.toFixed(1)} (avg: ${ratios.doorsToFp.overall.toFixed(1)})
- Pitches to FP+: ${ratios.pitchesToFp.current.toFixed(1)} (avg: ${ratios.pitchesToFp.overall.toFixed(1)})
- Transitions to FP+: ${ratios.transitionsToFp.current.toFixed(1)} (avg: ${ratios.transitionsToFp.overall.toFixed(1)})
- Presentations to Close: ${ratios.presentationsToClose.current.toFixed(1)} (avg: ${ratios.presentationsToClose.overall.toFixed(1)})

TOTALS:
- Total FP+: ${totals.fp.toFixed(1)}
- Total Doors: ${totals.doors}
- Total Closes: ${totals.closes}
`;

    const systemPrompt = `You are a supportive door-to-door sales coach analyzing rep performance. Provide brief, encouraging feedback (1-2 sentences max). Focus on ONE actionable improvement.

Key coaching principles:
- If there's a gap in the funnel, the problem is usually the step BEFORE the gap
- High transitions + low presentations/close rate → presentation skills or building value
- High pitches + low transitions → qualify buyers faster
- Low doors + low closes → need more volume
- High presentations + low close rate → building value or the close
- High doors + low pitches → better prospecting

Base feedback on the user's own performance averages and ratios, not absolute standards. Be brief, encouraging, and conversational. Use "you" language.`;


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
      throw new Error('Failed to generate feedback');
    }

    const data = await response.json();
    const feedback = data.choices[0].message.content;

    return new Response(
      JSON.stringify({ feedback }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating insights feedback:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
