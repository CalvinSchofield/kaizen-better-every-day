import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { situation, competitors } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build competitor database context for the AI
    const competitorContext = competitors.map((c: any) => {
      const versions = c.alternate_versions?.map((v: any) => v.name).join(", ") || "";
      return `
${c.name} (Category: ${c.category || "N/A"})${versions ? ` - Versions: ${versions}` : ""}
Our Selling Points: ${c.our_selling_points?.join("; ") || "None listed"}
Their Selling Points: ${c.their_selling_points?.join("; ") || "None listed"}
Monitoring: ${c.monitoring_companies?.join(", ") || "N/A"}
Objections & Handles: ${c.objections?.map((o: any) => `${o.objection} → ${o.handle}`).join("; ") || "None"}
`;
    }).join("\n");

    const systemPrompt = `You are a quick-reference assistant for door-to-door sales reps who are actively in front of customers or about to knock. You help identify which competitor devices the customer has and provide simplified, actionable selling points.

Available Competitor Database:
${competitorContext}

CRITICAL RESPONSE RULES:
- Rep is standing at the door RIGHT NOW - be direct, fast, and simplified
- Structure response in markdown with sections:
  1. **Why would they want what I have instead?** (2-3 key benefits in bullet points)
  2. **Common objections to anticipate:** (1-2 likely objections they might raise)
- Keep language conversational and persuasive
- Focus on value differences, not technical specs
- Max 3 bullets per section
- If multiple competitors match, pick the most likely one

You MUST respond with a JSON object in this exact format:
{
  "recommendation": "Markdown-formatted response with **bold headers** and bullet points",
  "competitors": [
    {
      "name": "Exact competitor name from database",
      "notion_page_id": "The notion_page_id from the competitor record"
    }
  ]
}

If situation unclear or no match, still provide your best guess with competitors array containing 1 most likely option.`;

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
          { role: "user", content: situation },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("recommend-competitor error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
