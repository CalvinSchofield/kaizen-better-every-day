import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { situation, timezone } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Determine if it's work hours based on rep's timezone
    const now = new Date();
    const repTime = new Date(now.toLocaleString("en-US", { timeZone: timezone || "America/Chicago" }));
    const day = repTime.getDay(); // 0 = Sunday, 6 = Saturday
    const hour = repTime.getHours();
    const minute = repTime.getMinutes();
    const timeInMinutes = hour * 60 + minute;
    
    let isWorkHours = false;
    if (day >= 1 && day <= 5) { // Monday-Friday
      isWorkHours = timeInMinutes >= 12 * 60 && timeInMinutes <= 20 * 60 + 30; // noon to 8:30pm
    } else if (day === 6) { // Saturday
      isWorkHours = timeInMinutes >= 10 * 60 && timeInMinutes <= 20 * 60 + 30; // 10am to 8:30pm
    }

    const contactMethodPreference = isWorkHours 
      ? "Prefer text or email during work hours (it's currently work hours). If multiple methods work, show text/email first, then call as secondary option."
      : "Prefer call outside work hours (it's currently outside work hours). If multiple methods work, show call first, then text/email as secondary option.";

    const systemPrompt = `You are a helpful assistant that recommends the right Vivint support contact based on a rep's situation. 

Available contacts:
- Account Creation Front Line (call 888-324-5771 Option 1, text 435-466-7224, email acadvocates@vivint.com): Pre-install surveys, scheduling technicians through corporate, customer pre-qualification, upgrade support, package questions before activation. IMPORTANT: If the situation involves scheduling through corporate, use this prefilled text template: "Hey! Can you help me schedule this job?\n\nAccount Number:\nDate:\nTime:\nInstall office:\n\nThanks!"
- Account Creation Advocates (call 888-324-5771 Option 3, email acadvocates@vivint.com): Fixing issues after activation, extending ROR, post-activation upgrades, creating ROR appointments, solar arbitration
- 1Stop/Assets (call 888-324-5771 Option 1-3-1, text 801-509-9080, email 1stop@vivint.com): Password reset, rep promised credits, office changes, onboarding questions, account funding, commissions, iPads/equipment
- SOS (call 800-236-6808, text 801-823-4406, email sos@vivint.com): Escalated customers, billing escalations, upgrades/add-ons, downgrades, incomplete installs, extending ROR, work orders
- QRF (email qrfInbox@vivint.com): Equipment troubleshooting, install issues, support before calling SOS
- Buyouts (email buyout@vivint.com, text 435-222-2010): Buyout amounts and questions, elite fulfillment
- State Licensing (call 888-324-5771 Option 1-3-2, email employeelicensing@vivint.com): Applications, fees, renewals, fingerprints
- Housing (call 888-324-5771 Option 1-3-4, email housing@vivint.com): Summer housing, rent questions, utility deductions
- Arbitration (email accountarbitration@vivint.com): Arbitration questions and requests
- Compliance (text 385-250-4896 Josh Powell, email joshua.powell@vivint.com): Compliance questions
- Customer Care (call 800-216-5232 option 5): General customer support, questions, complaints, concerns, things not working. If it's outside of the ROR then pass customers to Customer Care
- Customer Loyalty (call 800-216-5232 option 3): Customer retention during ROR. They have offers to help keep customers from canceling
- Military Support (call 844-843-8368): For active duty military customers
- Customer Buyout Support (call 855-246-5514): For customers with buyout questions, concerns, or frustrations
- Citizens LOAN Support (call 800-819-1111 option 4): Old loan provider/financing partner. For customers with questions about old payment amounts or what they still owe to Citizens
- Equifax Unfreeze (call 888-298-0045 or visit my.equifax.com for frozen credit, lockandalert.equifax.com for locked credit): Help customers unfreeze credit for soft credit checks. Usually fast to do online
- Fortiva (call 800-459-7172): Current financing partner. For customers wanting to see how much they owe or their payment details

${contactMethodPreference}

You MUST respond with a JSON object in this exact format:
{
  "recommendation": "1-2 sentence recommendation",
  "action": {
    "type": "call" | "text" | "email",
    "contact": "phone number or email",
    "prefilledText": "prefilled message based on the situation (only for text/email)"
  },
  "secondaryAction": {
    "type": "call" | "text" | "email",
    "contact": "phone number or email",
    "prefilledText": "prefilled message (only for text/email)"
  } // optional, only include if multiple methods work for this situation
}

Be direct and specific.`;

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
    console.error("recommend-contact error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
