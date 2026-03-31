import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RepPerformance {
  name: string;
  year: string;
  currentPeriod: {
    doors: number;
    pitches: number;
    transitions: number;
    presentations: number;
    closes: number;
    fp: number;
  };
  repAverage: {
    avgDoors: number;
    avgPitches: number;
    avgTransitions: number;
    avgPresentations: number;
    avgCloses: number;
    avgFp: number;
  };
  vsAverage: {
    doors: number;
    pitches: number;
    transitions: number;
    presentations: number;
    closes: number;
    fp: number;
  };
}

interface LeaderCoachingRequest {
  timeframe: string;
  scopeLabel: string;
  teamTotals: {
    doors: number;
    pitches: number;
    transitions: number;
    presentations: number;
    closes: number;
    fp: number;
    prmr: number;
    daysWorked: number;
    uniqueReps: number;
  };
  teamFunnel: {
    doorsToFp: number;
    pitchesToFp: number;
    transitionsToFp: number;
    presentationsToClose: number;
    overallDoorsToFp: number;
    overallPitchesToFp: number;
    overallTransitionsToFp: number;
    overallPresentationsToClose: number;
  };
  repBreakdown: RepPerformance[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const body: LeaderCoachingRequest = await req.json();
    const { timeframe, scopeLabel, teamTotals, teamFunnel, repBreakdown } = body;

    // Calculate funnel efficiency vs overall
    const funnelVsOverall = {
      doorsToFp: teamFunnel.overallDoorsToFp > 0 ? ((teamFunnel.overallDoorsToFp - teamFunnel.doorsToFp) / teamFunnel.overallDoorsToFp) * 100 : 0,
      pitchesToFp: teamFunnel.overallPitchesToFp > 0 ? ((teamFunnel.overallPitchesToFp - teamFunnel.pitchesToFp) / teamFunnel.overallPitchesToFp) * 100 : 0,
      transitionsToFp: teamFunnel.overallTransitionsToFp > 0 ? ((teamFunnel.overallTransitionsToFp - teamFunnel.transitionsToFp) / teamFunnel.overallTransitionsToFp) * 100 : 0,
      presentationsToClose: teamFunnel.overallPresentationsToClose > 0 ? ((teamFunnel.overallPresentationsToClose - teamFunnel.presentationsToClose) / teamFunnel.overallPresentationsToClose) * 100 : 0,
    };

    // Find the weakest funnel stage (highest negative vs overall = worst)
    const funnelStages = [
      { stage: 'Doors to FP+', value: funnelVsOverall.doorsToFp, ratio: teamFunnel.doorsToFp },
      { stage: 'Pitches to FP+', value: funnelVsOverall.pitchesToFp, ratio: teamFunnel.pitchesToFp },
      { stage: 'Transitions to FP+', value: funnelVsOverall.transitionsToFp, ratio: teamFunnel.transitionsToFp },
      { stage: 'Presentations to Close', value: funnelVsOverall.presentationsToClose, ratio: teamFunnel.presentationsToClose },
    ];
    
    const weakestStage = funnelStages.reduce((worst, stage) => 
      stage.value < worst.value ? stage : worst
    );
    
    const strongestStage = funnelStages.reduce((best, stage) => 
      stage.value > best.value ? stage : best
    );

    // Find reps underperforming their average significantly
    const underperformers = repBreakdown
      .filter(rep => rep.vsAverage.fp < -20) // More than 20% below their average
      .sort((a, b) => a.vsAverage.fp - b.vsAverage.fp)
      .slice(0, 3);

    // Find reps excelling above their average
    const overperformers = repBreakdown
      .filter(rep => rep.vsAverage.fp > 20) // More than 20% above their average
      .sort((a, b) => b.vsAverage.fp - a.vsAverage.fp)
      .slice(0, 2);

    const systemPrompt = `You are a direct sales leadership coach. Help leaders identify what to train on. Be brief.

CONTEXT:
- Funnel: Doors → DMs → Pitches → Transitions → Presentations → Closes
- Lower ratios = better
- Compare reps to THEIR OWN averages
- Bottlenecks reveal training needs

SCOPE: ${scopeLabel} | TIMEFRAME: ${timeframe}

Use provide_leader_coaching function. Keep everything SHORT.`;

    const repSummary = repBreakdown.map(rep => 
      `${rep.name}: ${rep.currentPeriod.fp.toFixed(1)} FP+ (${rep.vsAverage.fp >= 0 ? '+' : ''}${rep.vsAverage.fp.toFixed(0)}% vs avg)`
    ).join(', ');

    const userPrompt = `Team ${timeframe} (${teamTotals.uniqueReps} reps, ${teamTotals.daysWorked} days):

Totals: ${teamTotals.fp.toFixed(1)} FP+, $${teamTotals.prmr.toFixed(0)} PRMR, ${teamTotals.presentations} pres, ${teamTotals.closes} closes

Funnel: Doors/FP+ ${teamFunnel.doorsToFp.toFixed(1)} (${funnelVsOverall.doorsToFp >= 0 ? '+' : ''}${funnelVsOverall.doorsToFp.toFixed(0)}%), Pres/Close ${teamFunnel.presentationsToClose.toFixed(1)} (${funnelVsOverall.presentationsToClose >= 0 ? '+' : ''}${funnelVsOverall.presentationsToClose.toFixed(0)}%)

Weakest: ${weakestStage.stage} | Strongest: ${strongestStage.stage}

Reps: ${repSummary}

${underperformers.length > 0 ? `Below avg: ${underperformers.map(r => r.name).join(', ')}` : ''}

Give team strength, training focus, action item, and who to check in with.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "provide_leader_coaching",
              description: "Return brief coaching insights",
              parameters: {
                type: "object",
                properties: {
                  teamStrength: {
                    type: "string",
                    description: "What went well, ONE sentence. Reference a specific number or funnel stage."
                  },
                  bottleneck: {
                    type: "string",
                    description: "Training focus area, ONE sentence. Name the weak funnel stage."
                  },
                  trainingRecommendation: {
                    type: "string",
                    description: "Specific action to address bottleneck, ONE sentence. (e.g., 'Role-play transition handoffs at morning huddle')"
                  },
                  checkInWith: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        reason: { type: "string", description: "Brief reason, 5-8 words max" }
                      },
                      required: ["name", "reason"]
                    },
                    description: "0-2 reps to check in with"
                  }
                },
                required: ["teamStrength", "bottleneck", "trainingRecommendation", "checkInWith"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "provide_leader_coaching" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log("AI response:", JSON.stringify(data, null, 2));

    // Extract the tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "provide_leader_coaching") {
      throw new Error("Invalid AI response format");
    }

    const coaching = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ coaching }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error("Error in generate-leader-coaching:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
