import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CoachingRequest {
  timeframe: 'yesterday' | 'week' | 'month' | 'preseason';
  currentPeriod: {
    doors: number;
    dms: number;
    pitches: number;
    transitions: number;
    presentations: number;
    closes: number;
    fp: number;
    prmr: number;
    avgStartTime: string;
    avgEndTime: string;
    totalHours: number;
    daysWorked: number;
  };
  repAverages: {
    avgDoors: number;
    avgDMs: number;
    avgPitches: number;
    avgTransitions: number;
    avgPresentations: number;
    avgCloses: number;
    avgFp: number;
    avgPrmr: number;
    avgHoursWorked: number;
  };
  funnelConversions: {
    doorsToFp: number;
    pitchesToFp: number;
    transitionsToFp: number;
    presentationsToClose: number;
    overallDoorsToFp: number;
    overallPitchesToFp: number;
    overallTransitionsToFp: number;
    overallPresentationsToClose: number;
  };
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

    const body: CoachingRequest = await req.json();
    const { timeframe, currentPeriod, repAverages, funnelConversions } = body;

    // Calculate performance vs averages
    const vsAverage = {
      doors: repAverages.avgDoors > 0 ? ((currentPeriod.doors / currentPeriod.daysWorked) / repAverages.avgDoors - 1) * 100 : 0,
      dms: repAverages.avgDMs > 0 ? ((currentPeriod.dms / currentPeriod.daysWorked) / repAverages.avgDMs - 1) * 100 : 0,
      pitches: repAverages.avgPitches > 0 ? ((currentPeriod.pitches / currentPeriod.daysWorked) / repAverages.avgPitches - 1) * 100 : 0,
      transitions: repAverages.avgTransitions > 0 ? ((currentPeriod.transitions / currentPeriod.daysWorked) / repAverages.avgTransitions - 1) * 100 : 0,
      presentations: repAverages.avgPresentations > 0 ? ((currentPeriod.presentations / currentPeriod.daysWorked) / repAverages.avgPresentations - 1) * 100 : 0,
      closes: repAverages.avgCloses > 0 ? ((currentPeriod.closes / currentPeriod.daysWorked) / repAverages.avgCloses - 1) * 100 : 0,
      fp: repAverages.avgFp > 0 ? ((currentPeriod.fp / currentPeriod.daysWorked) / repAverages.avgFp - 1) * 100 : 0,
      hours: repAverages.avgHoursWorked > 0 ? ((currentPeriod.totalHours / currentPeriod.daysWorked) / repAverages.avgHoursWorked - 1) * 100 : 0,
    };

    // Calculate funnel efficiency changes
    const funnelVsOverall = {
      doorsToFp: funnelConversions.overallDoorsToFp > 0 ? ((funnelConversions.overallDoorsToFp - funnelConversions.doorsToFp) / funnelConversions.overallDoorsToFp) * 100 : 0,
      pitchesToFp: funnelConversions.overallPitchesToFp > 0 ? ((funnelConversions.overallPitchesToFp - funnelConversions.pitchesToFp) / funnelConversions.overallPitchesToFp) * 100 : 0,
      transitionsToFp: funnelConversions.overallTransitionsToFp > 0 ? ((funnelConversions.overallTransitionsToFp - funnelConversions.transitionsToFp) / funnelConversions.overallTransitionsToFp) * 100 : 0,
      presentationsToClose: funnelConversions.overallPresentationsToClose > 0 ? ((funnelConversions.overallPresentationsToClose - funnelConversions.presentationsToClose) / funnelConversions.overallPresentationsToClose) * 100 : 0,
    };

    const systemPrompt = `You are a direct, no-fluff sales coach for Vivint door-to-door reps. Be brief and specific.

CONTEXT:
- Sales funnel: Doors → DMs → Pitches → Transitions → Presentations → Closes
- Lower ratios = better (40 doors/FP+ beats 60 doors/FP+)
- Compare to THEIR averages, not absolutes
- Fewer doors + more closes = efficiency, not laziness

TIMEFRAME: ${timeframe}

Use provide_coaching function. Keep everything SHORT.`;

    const userPrompt = `${timeframe} performance (${currentPeriod.daysWorked} days):

Doors: ${currentPeriod.doors} (${vsAverage.doors >= 0 ? '+' : ''}${vsAverage.doors.toFixed(0)}% vs avg)
DMs: ${currentPeriod.dms} (${vsAverage.dms >= 0 ? '+' : ''}${vsAverage.dms.toFixed(0)}%)
Pitches: ${currentPeriod.pitches} (${vsAverage.pitches >= 0 ? '+' : ''}${vsAverage.pitches.toFixed(0)}%)
Transitions: ${currentPeriod.transitions} (${vsAverage.transitions >= 0 ? '+' : ''}${vsAverage.transitions.toFixed(0)}%)
Presentations: ${currentPeriod.presentations} (${vsAverage.presentations >= 0 ? '+' : ''}${vsAverage.presentations.toFixed(0)}%)
Closes: ${currentPeriod.closes} (${vsAverage.closes >= 0 ? '+' : ''}${vsAverage.closes.toFixed(0)}%)
FP+: ${currentPeriod.fp.toFixed(1)} (${vsAverage.fp >= 0 ? '+' : ''}${vsAverage.fp.toFixed(0)}%)
Hours: ${currentPeriod.totalHours.toFixed(1)} (${vsAverage.hours >= 0 ? '+' : ''}${vsAverage.hours.toFixed(0)}%)

Funnel ratios (lower=better):
Doors/FP+: ${funnelConversions.doorsToFp.toFixed(1)} (${funnelVsOverall.doorsToFp >= 0 ? '+' : ''}${funnelVsOverall.doorsToFp.toFixed(0)}% vs overall)
Pitches/FP+: ${funnelConversions.pitchesToFp.toFixed(1)} (${funnelVsOverall.pitchesToFp >= 0 ? '+' : ''}${funnelVsOverall.pitchesToFp.toFixed(0)}%)
Pres/Close: ${funnelConversions.presentationsToClose.toFixed(1)} (${funnelVsOverall.presentationsToClose >= 0 ? '+' : ''}${funnelVsOverall.presentationsToClose.toFixed(0)}%)

Give 2 wins, 1 focus area, 1 homework question.`;

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
              name: "provide_coaching",
              description: "Return brief coaching feedback",
              parameters: {
                type: "object",
                properties: {
                  strengths: {
                    type: "array",
                    items: { type: "string" },
                    description: "2 wins, each ONE sentence max. Reference specific numbers.",
                    minItems: 2,
                    maxItems: 2
                  },
                  improvement: {
                    type: "string",
                    description: "1 focus area in ONE sentence. Name the bottleneck and what to do."
                  },
                  homework: {
                    type: "string",
                    description: "A short reflection question + action (e.g., 'Think about your 2 best prospects who didn't close—what stopped them? Text your leader.')"
                  }
                },
                required: ["strengths", "improvement", "homework"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "provide_coaching" } }
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
    if (!toolCall || toolCall.function.name !== "provide_coaching") {
      throw new Error("Invalid AI response format");
    }

    const coaching = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ coaching }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error("Error in generate-rep-coaching:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
