import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { situation } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const contactsMap: Record<string, { phone?: string; textPhone?: string; email?: string; name: string }> = {
      "Account Creation Front Line": { phone: "888-324-5771", textPhone: "435-466-7224", name: "Account Creation - Front Line" },
      "Account Creation Advocates": { phone: "888-324-5771", name: "Account Creation - Advocates" },
      "1Stop/Assets": { phone: "888-324-5771", textPhone: "801-509-9080", name: "1Stop/Assets" },
      "SOS": { phone: "800-236-6808", textPhone: "801-823-4406", name: "SOS" },
      "QRF": { email: "qrfInbox@vivint.com", name: "QRF" },
      "Buyouts": { textPhone: "435-222-2010", email: "buyout@vivint.com", name: "Buyouts" },
      "State Licensing": { phone: "888-324-5771", email: "employeelicensing@vivint.com", name: "State Licensing" },
      "Housing": { phone: "888-324-5771", email: "housing@vivint.com", name: "Housing" },
      "Arbitration": { email: "accountarbitration@vivint.com", name: "Arbitration" },
      "Compliance": { textPhone: "385-250-4896", email: "joshua.powell@vivint.com", name: "Compliance - Josh Powell" },
    };

    const systemPrompt = `You are a helpful assistant that recommends the right Vivint support contact based on a rep's situation. 

CRITICAL RULES:
1. ONLY recommend contacts from the list below
2. Your response must include the exact contact name in your recommendation
3. If the situation doesn't clearly match any contact below, respond with EXACTLY: "LOW_CONFIDENCE"
4. Keep responses to 1-2 sentences MAX

Available contacts:
- Account Creation Front Line (Call 888-324-5771 or text 435-466-7224): Pre-install surveys, scheduling technicians, customer pre-qualification, upgrade support, package questions before activation
- Account Creation Advocates (Call 888-324-5771): Fixing issues after activation, extending ROR, post-activation upgrades, creating ROR appointments, solar arbitration
- 1Stop/Assets (Call 888-324-5771 or text 801-509-9080): Password reset, rep promised credits, office changes, onboarding questions, account funding, commissions, iPads/equipment
- SOS (Call 800-236-6808 or text 801-823-4406): Escalated customers, billing escalations, upgrades/add-ons, downgrades, incomplete installs, extending ROR, work orders
- QRF (Email qrfInbox@vivint.com): Equipment troubleshooting, install issues, support before calling SOS
- Buyouts (Text 435-222-2010 or email buyout@vivint.com): Buyout amounts and questions, elite fulfillment
- State Licensing (Call 888-324-5771 or email employeelicensing@vivint.com): Applications, fees, renewals, fingerprints
- Housing (Call 888-324-5771 or email housing@vivint.com): Summer housing, rent questions, utility deductions
- Arbitration (Email accountarbitration@vivint.com): Arbitration questions and requests
- Compliance (Text 385-250-4896 or email joshua.powell@vivint.com): Compliance questions

Example response: "Contact Account Creation Front Line at 888-324-5771 for scheduling help."
Example low confidence: If unsure, respond with: "LOW_CONFIDENCE"`;

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
    const recommendation = data.choices?.[0]?.message?.content;
    const isLowConfidence = recommendation?.includes("LOW_CONFIDENCE");

    // Extract contact info from recommendation
    let contactInfo = null;
    if (!isLowConfidence && recommendation) {
      for (const [key, value] of Object.entries(contactsMap)) {
        if (recommendation.includes(key)) {
          contactInfo = value;
          break;
        }
      }
    }

    return new Response(JSON.stringify({ 
      recommendation: isLowConfidence ? null : recommendation,
      lowConfidence: isLowConfidence,
      contactInfo 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("recommend-contact error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
