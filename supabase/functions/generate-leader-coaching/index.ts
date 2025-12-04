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

    const systemPrompt = `You are an expert sales leadership coach for Vivint door-to-door sales teams. Your job is to help leaders identify coaching opportunities and training focus areas based on team data.

IMPORTANT CONTEXT:
- You're coaching a sales LEADER about their TEAM's performance
- The sales funnel goes: Doors Knocked → Decision Makers → Pitches → Transitions → Presentations → Closes
- Lower ratios are BETTER (e.g., 40 doors per FP+ is better than 60 doors per FP+)
- Compare reps to THEIR OWN individual averages - this accounts for different rep compositions on different days
- A rep being 30% below THEIR average is concerning, even if their absolute numbers are okay
- Bottlenecks in the funnel reveal what the team needs training on

SCOPE: ${scopeLabel}
TIMEFRAME: ${timeframe}

You must use the provide_leader_coaching function to return your analysis.`;

    // Build rep breakdown summary
    const repSummary = repBreakdown.map(rep => 
      `${rep.name} (${rep.year}): ${rep.currentPeriod.fp.toFixed(1)} FP+ (${rep.vsAverage.fp >= 0 ? '+' : ''}${rep.vsAverage.fp.toFixed(0)}% vs their avg), ${rep.currentPeriod.presentations} pres (${rep.vsAverage.presentations >= 0 ? '+' : ''}${rep.vsAverage.presentations.toFixed(0)}% vs avg)`
    ).join('\n');

    const userPrompt = `Analyze this team's ${timeframe} performance:

TEAM TOTALS (${teamTotals.uniqueReps} reps, ${teamTotals.daysWorked} total work days):
- Doors: ${teamTotals.doors}
- Pitches: ${teamTotals.pitches}
- Transitions: ${teamTotals.transitions}
- Presentations: ${teamTotals.presentations}
- Closes: ${teamTotals.closes}
- FP+: ${teamTotals.fp.toFixed(1)}
- PRMR: $${teamTotals.prmr.toFixed(0)}

TEAM FUNNEL EFFICIENCY (lower is better):
- Doors to FP+: ${teamFunnel.doorsToFp.toFixed(1)} (${funnelVsOverall.doorsToFp >= 0 ? '+' : ''}${funnelVsOverall.doorsToFp.toFixed(0)}% vs overall avg)
- Pitches to FP+: ${teamFunnel.pitchesToFp.toFixed(1)} (${funnelVsOverall.pitchesToFp >= 0 ? '+' : ''}${funnelVsOverall.pitchesToFp.toFixed(0)}% vs overall avg)
- Transitions to FP+: ${teamFunnel.transitionsToFp.toFixed(1)} (${funnelVsOverall.transitionsToFp >= 0 ? '+' : ''}${funnelVsOverall.transitionsToFp.toFixed(0)}% vs overall avg)
- Presentations to Close: ${teamFunnel.presentationsToClose.toFixed(1)} (${funnelVsOverall.presentationsToClose >= 0 ? '+' : ''}${funnelVsOverall.presentationsToClose.toFixed(0)}% vs overall avg)

BOTTLENECK ANALYSIS:
- Weakest Stage: ${weakestStage.stage} (${weakestStage.value.toFixed(0)}% vs overall, ratio: ${weakestStage.ratio.toFixed(1)})
- Strongest Stage: ${strongestStage.stage} (${strongestStage.value.toFixed(0)}% vs overall, ratio: ${strongestStage.ratio.toFixed(1)})

INDIVIDUAL REP BREAKDOWN (vs their own averages):
${repSummary}

${underperformers.length > 0 ? `UNDERPERFORMERS (significantly below their average): ${underperformers.map(r => `${r.name} (${r.vsAverage.fp.toFixed(0)}% FP+)`).join(', ')}` : ''}
${overperformers.length > 0 ? `TOP PERFORMERS (above their average): ${overperformers.map(r => `${r.name} (+${r.vsAverage.fp.toFixed(0)}% FP+)`).join(', ')}` : ''}

Provide coaching insights for this leader.`;

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
              description: "Return structured coaching insights for the sales leader",
              parameters: {
                type: "object",
                properties: {
                  teamStrength: {
                    type: "string",
                    description: "What the team collectively did well this period, 1-2 sentences. Be specific about numbers or funnel stage."
                  },
                  bottleneck: {
                    type: "string",
                    description: "The specific funnel stage to focus training on, with context about why. 2-3 sentences."
                  },
                  trainingRecommendation: {
                    type: "string",
                    description: "A specific training or coaching activity to address the bottleneck. Be actionable and specific (e.g., 'Role-play pitch-to-transition handoffs' not just 'work on transitions')."
                  },
                  checkInWith: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        reason: { type: "string", description: "Brief reason why leader should check in, 1 sentence" }
                      },
                      required: ["name", "reason"]
                    },
                    description: "0-3 reps the leader should specifically check in with, based on performance vs their average"
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
