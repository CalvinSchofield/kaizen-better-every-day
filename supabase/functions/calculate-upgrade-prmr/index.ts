import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VIVINT_PRODUCTS = [
  { name: "Doorbell Camera Pro (Gen 2)", aka: ["Doorbell", "DBC"], price: 249.99 },
  { name: "Outdoor Camera Pro (Gen 2)", aka: ["Outdoor Cam Pro", "Outdoor Camera"], price: 399.99 },
  { name: "Spotlight Pro", aka: ["Spotlight"], price: 249.99 },
  { name: "SmartHub", aka: ["Panel", "Hub"], price: 499.99 },
  { name: "Indoor Camera Pro", aka: ["Indoor Cam Pro", "Indoor Camera"], price: 249.99 },
  { name: "Kwikset Smart Lock", aka: ["Smart Lock Brass", "Smart Lock Silver", "Smart Lock Bronze", "Smart Lock Gold"], price: 179.99 },
  { name: "Kwikset Smart Lock (Matte Black)", aka: ["New Smart Lock Matte Black"], price: 184.99 },
  { name: "Smart Garage Door Controller", aka: ["Garage Door Controller"], price: 50 },
  { name: "Garage Door Integration Fee", aka: ["MyQ Fee"], price: 50 },
  { name: "Smart Thermostat", aka: ["Thermostat"], price: 199.99 },
  { name: "Chime Extender", aka: ["Chime"], price: 59.99 },
  { name: "Smart Sensor", aka: ["Door Sensor", "Window Sensor"], price: 50 },
  { name: "Glass Break Sensor", aka: ["Glass Sensor"], price: 100 },
  { name: "Motion Sensor", aka: ["Motion"], price: 100 },
  { name: "Smoke & CO Monitor", aka: ["Smoke CO"], price: 100 },
  { name: "Smoke & CO Combo Detector", aka: ["Smoke Combo"], price: 100 },
  { name: "Smart Water Sensor", aka: ["Water Sensor"], price: 50 },
  { name: "Tilt Sensor", aka: ["Garage Tilt"], price: 50 },
  { name: "Panic Pendant", aka: ["Panic Button"], price: 50 },
  { name: "Keyfob", aka: ["Key Remote"], price: 50 },
  { name: "Wireless Keypad", aka: ["Keypad"], price: 50 },
  { name: "Smart Plug", aka: ["Smart Plug"], price: 50 },
  { name: "Yard Sign", aka: ["Sign"], price: 14.99 },
  { name: "Yard Sign Light", aka: ["Sign Light"], price: 4.99 },
  { name: "Playback DVR", aka: ["DVR", "24/7 Playback"], price: 299.99 }
];

const CAMERA_PRODUCTS = [
  "Doorbell Camera Pro (Gen 2)",
  "Outdoor Camera Pro (Gen 2)",
  "Indoor Camera Pro"
];

const systemPrompt = `You are a Vivint PRMR calculator assistant. Help sales reps calculate their PRMR (Payable Recurring Monthly Revenue) for upgrade sales.

PRMR CALCULATION FORMULA:
1. Add total equipment price (do NOT include install fee or tax)
2. Divide total equipment by 60
3. Add $5 per NEW camera added (not replacement cameras)
4. The result is the PRMR

CAMERA PRODUCTS (only these add $5 if marked as NEW):
- Doorbell Camera Pro (Gen 2)
- Outdoor Camera Pro (Gen 2)  
- Indoor Camera Pro

EQUIPMENT PRICING:
${VIVINT_PRODUCTS.map(p => `- ${p.name}: $${p.price}`).join('\n')}

IMPORTANT:
- Ask the user what equipment they sold
- For any cameras, ASK if they were marked as "new" or "replacement" at point of sale
- New cameras add $5 PRMR each, replacement cameras add $0
- Show your calculation step by step
- Give the final PRMR amount

Be conversational and helpful. If they list equipment, calculate it. Always clarify camera status before giving final PRMR.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

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
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits depleted." }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("calculate-upgrade-prmr error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
