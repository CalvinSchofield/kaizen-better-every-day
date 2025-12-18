import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Equipment prices - single source of truth
const EQUIPMENT_PRICES: Record<string, number> = {
  "doorbell_camera": 249.99,
  "outdoor_camera": 399.99,
  "spotlight": 249.99,
  "indoor_camera": 249.99,
  "smarthub": 499.99,
  "smart_lock": 179.99,
  "smart_lock_matte_black": 184.99,
  "garage_door_controller": 50,
  "garage_door_fee": 50,
  "thermostat": 199.99,
  "chime_extender": 59.99,
  "smart_sensor": 50,
  "glass_break_sensor": 100,
  "motion_sensor": 100,
  "smoke_co_monitor": 100,
  "smoke_co_combo": 100,
  "water_sensor": 50,
  "tilt_sensor": 50,
  "panic_pendant": 50,
  "keyfob": 50,
  "keypad": 50,
  "smart_plug": 50,
  "yard_sign": 14.99,
  "yard_sign_light": 4.99,
  "playback_dvr": 299.99,
};

// Equipment display names for output
const EQUIPMENT_NAMES: Record<string, string> = {
  "doorbell_camera": "Doorbell Camera Pro",
  "outdoor_camera": "Outdoor Camera Pro",
  "spotlight": "Spotlight Pro",
  "indoor_camera": "Indoor Camera Pro",
  "smarthub": "SmartHub",
  "smart_lock": "Smart Lock",
  "smart_lock_matte_black": "Smart Lock (Matte Black)",
  "garage_door_controller": "Garage Door Controller",
  "garage_door_fee": "Garage Door Integration Fee",
  "thermostat": "Smart Thermostat",
  "chime_extender": "Chime Extender",
  "smart_sensor": "Smart Sensor",
  "glass_break_sensor": "Glass Break Sensor",
  "motion_sensor": "Motion Sensor",
  "smoke_co_monitor": "Smoke & CO Monitor",
  "smoke_co_combo": "Smoke & CO Combo",
  "water_sensor": "Water Sensor",
  "tilt_sensor": "Tilt Sensor",
  "panic_pendant": "Panic Pendant",
  "keyfob": "Keyfob",
  "keypad": "Wireless Keypad",
  "smart_plug": "Smart Plug",
  "yard_sign": "Yard Sign",
  "yard_sign_light": "Yard Sign Light",
  "playback_dvr": "24/7 Playback DVR",
};

// Camera types that get the $5 bonus
const CAMERA_TYPES = ["doorbell_camera", "outdoor_camera", "indoor_camera"];

interface EquipmentItem {
  type: string;
  quantity: number;
  is_new_camera?: boolean; // Only relevant for cameras
}

interface CalculationResult {
  equipment_breakdown: { name: string; quantity: number; unit_price: number; total: number }[];
  equipment_total: number;
  divided_by_60: number;
  new_camera_count: number;
  camera_bonus: number;
  prmr: number;
}

function calculatePrmr(equipment: EquipmentItem[]): CalculationResult {
  const breakdown: { name: string; quantity: number; unit_price: number; total: number }[] = [];
  let equipmentTotal = 0;
  let newCameraCount = 0;

  for (const item of equipment) {
    const price = EQUIPMENT_PRICES[item.type];
    if (price === undefined) {
      console.warn(`Unknown equipment type: ${item.type}`);
      continue;
    }

    const itemTotal = price * item.quantity;
    equipmentTotal += itemTotal;

    breakdown.push({
      name: EQUIPMENT_NAMES[item.type] || item.type,
      quantity: item.quantity,
      unit_price: price,
      total: itemTotal,
    });

    // Count new cameras for bonus
    if (CAMERA_TYPES.includes(item.type)) {
      // Indoor cameras are ALWAYS counted as new
      if (item.type === "indoor_camera") {
        newCameraCount += item.quantity;
      } else if (item.is_new_camera) {
        // Outdoor and doorbell only if marked as new
        newCameraCount += item.quantity;
      }
    }
  }

  const dividedBy60 = equipmentTotal / 60;
  const cameraBonus = newCameraCount * 5;
  const prmr = dividedBy60 + cameraBonus;

  return {
    equipment_breakdown: breakdown,
    equipment_total: Math.round(equipmentTotal * 100) / 100,
    divided_by_60: Math.round(dividedBy60 * 100) / 100,
    new_camera_count: newCameraCount,
    camera_bonus: cameraBonus,
    prmr: Math.round(prmr * 100) / 100,
  };
}

const systemPrompt = `You are a Vivint equipment parser. Your job is to understand what equipment the user sold and call the calculate_prmr tool.

EQUIPMENT TYPES (use these exact IDs):
- doorbell_camera: Doorbell Camera Pro ($249.99)
- outdoor_camera: Outdoor Camera Pro ($399.99)
- spotlight: Spotlight Pro ($249.99)
- indoor_camera: Indoor Camera Pro ($249.99)
- smarthub: SmartHub/Panel ($499.99)
- smart_lock: Smart Lock ($179.99)
- smart_lock_matte_black: Smart Lock Matte Black ($184.99)
- garage_door_controller: Garage Door Controller ($50)
- garage_door_fee: Garage Door Integration Fee ($50)
- thermostat: Smart Thermostat ($199.99)
- chime_extender: Chime Extender ($59.99)
- smart_sensor: Door/Window Sensor ($50)
- glass_break_sensor: Glass Break Sensor ($100)
- motion_sensor: Motion Sensor ($100)
- smoke_co_monitor: Smoke & CO Monitor ($100)
- smoke_co_combo: Smoke & CO Combo ($100)
- water_sensor: Water Sensor ($50)
- tilt_sensor: Tilt/Garage Sensor ($50)
- panic_pendant: Panic Pendant ($50)
- keyfob: Keyfob ($50)
- keypad: Wireless Keypad ($50)
- smart_plug: Smart Plug ($50)
- yard_sign: Yard Sign ($14.99)
- yard_sign_light: Yard Sign Light ($4.99)
- playback_dvr: 24/7 Playback DVR ($299.99)

CAMERA BONUS RULES:
- Indoor cameras are ALWAYS marked as new (is_new_camera: true)
- For doorbell and outdoor cameras, you MUST ask if they are NEW or REPLACEMENTS
- New cameras get a $5 bonus each
- Spotlights are NOT cameras (no bonus)

WORKFLOW:
1. Parse the equipment list from user message
2. If outdoor or doorbell cameras are mentioned and user hasn't specified if they're new, ASK before calling the tool
3. Once you know all equipment and camera status, call calculate_prmr with the structured data
4. Do NOT do any math yourself - the tool handles all calculations

Keep responses short and conversational.`;

const tools = [
  {
    type: "function",
    function: {
      name: "calculate_prmr",
      description: "Calculate PRMR from equipment list. Call this when you have all equipment details.",
      parameters: {
        type: "object",
        properties: {
          equipment: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  description: "Equipment type ID (e.g., outdoor_camera, doorbell_camera, indoor_camera, spotlight, chime_extender, playback_dvr, etc.)"
                },
                quantity: {
                  type: "number",
                  description: "Number of this equipment type"
                },
                is_new_camera: {
                  type: "boolean",
                  description: "For cameras only: true if new installation, false if replacement. Indoor cameras are always true."
                }
              },
              required: ["type", "quantity"]
            },
            description: "List of equipment sold"
          }
        },
        required: ["equipment"]
      }
    }
  }
];

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

    console.log("Processing chat request with", messages.length, "messages");

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
        tools: tools,
        tool_choice: "auto",
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

    const data = await response.json();
    console.log("AI response:", JSON.stringify(data, null, 2));

    const choice = data.choices?.[0];
    const message = choice?.message;

    // Check if AI wants to call the calculate_prmr tool
    if (message?.tool_calls && message.tool_calls.length > 0) {
      const toolCall = message.tool_calls[0];
      if (toolCall.function?.name === "calculate_prmr") {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          console.log("Tool call arguments:", JSON.stringify(args, null, 2));
          
          // Perform deterministic calculation
          const result = calculatePrmr(args.equipment);
          console.log("Calculation result:", JSON.stringify(result, null, 2));

          // Format the response
          let responseText = "**Equipment Breakdown:**\n";
          for (const item of result.equipment_breakdown) {
            responseText += `• ${item.quantity}x ${item.name}: $${item.unit_price.toFixed(2)} × ${item.quantity} = $${item.total.toFixed(2)}\n`;
          }
          responseText += `\n**Equipment Total:** $${result.equipment_total.toFixed(2)}\n`;
          responseText += `**Divided by 60:** $${result.divided_by_60.toFixed(2)}\n`;
          responseText += `**Camera Bonus:** ${result.new_camera_count} new cameras × $5 = +$${result.camera_bonus.toFixed(2)}\n`;
          responseText += `\n**Your PRMR: $${result.prmr.toFixed(2)}**`;

          return new Response(JSON.stringify({
            type: "calculation",
            content: responseText,
            prmr: result.prmr,
            breakdown: result,
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (parseError) {
          console.error("Error parsing tool call:", parseError);
          return new Response(JSON.stringify({
            type: "message",
            content: "I had trouble parsing that. Could you list your equipment again?",
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    // Regular message (no tool call) - AI is asking a question or responding
    return new Response(JSON.stringify({
      type: "message",
      content: message?.content || "I didn't understand that. What equipment did you sell?",
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("calculate-upgrade-prmr error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
