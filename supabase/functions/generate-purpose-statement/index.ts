import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PurposeAnswer {
  question: string;
  answer: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { answers } = await req.json() as { answers: PurposeAnswer[] };
    
    if (!answers || answers.length === 0) {
      throw new Error('No answers provided');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Build the prompt with user's answers
    const answersText = answers
      .filter(a => a.answer && a.answer.trim())
      .map((a, i) => `Q${i + 1}: ${a.question}\nA: "${a.answer}"`)
      .join('\n\n');

    if (!answersText) {
      throw new Error('No valid answers provided');
    }

    console.log('Generating purpose statement from answers:', answersText.substring(0, 200) + '...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are helping a door-to-door sales rep crystallize their core motivation into a powerful purpose statement.

Based on their answers to reflective questions, generate a 1-2 sentence purpose statement that:
- Uses first person ("I am working to..." or "I'm here to...")
- Is specific and personal (references their actual goals, people, or situations)
- Is emotionally resonant and motivating
- Captures the deeper WHY behind their summer selling goals
- Is concise but powerful (max 40 words)

Focus on the most compelling elements from their answers - the specific people they want to impact, the concrete changes they want to make, or the personal growth they seek.`
          },
          {
            role: 'user',
            content: `Based on these reflections from a door-to-door sales rep, generate their purpose statement:

${answersText}

Generate a powerful 1-2 sentence purpose statement.`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'generate_purpose',
              description: 'Generate a purpose statement based on the rep\'s reflections',
              parameters: {
                type: 'object',
                properties: {
                  purpose_statement: {
                    type: 'string',
                    description: 'A 1-2 sentence purpose statement in first person, max 40 words'
                  },
                  key_motivator: {
                    type: 'string',
                    description: 'The single most powerful motivator identified (e.g., "family", "financial freedom", "proving myself")'
                  }
                },
                required: ['purpose_statement', 'key_motivator'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'generate_purpose' } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add funds to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log('AI response received');

    // Extract the tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'generate_purpose') {
      throw new Error('Unexpected AI response format');
    }

    const result = JSON.parse(toolCall.function.arguments);
    console.log('Generated purpose statement:', result.purpose_statement?.substring(0, 50) + '...');

    return new Response(
      JSON.stringify({
        purpose_statement: result.purpose_statement,
        key_motivator: result.key_motivator
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating purpose statement:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
