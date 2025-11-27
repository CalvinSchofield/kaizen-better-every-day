import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface WeatherForecast {
  date: string;
  dayName: string;
  high: number;
  low: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { location, startDate, endDate } = await req.json();

    if (!location || !startDate || !endDate) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Step 1: Geocode the location using Open-Meteo Geocoding API
    const geocodeUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      location
    )}&count=1&language=en&format=json`;

    const geocodeResponse = await fetch(geocodeUrl);
    const geocodeData = await geocodeResponse.json();

    if (!geocodeData.results || geocodeData.results.length === 0) {
      return new Response(
        JSON.stringify({ error: "Location not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { latitude, longitude, name } = geocodeData.results[0];

    // Step 2: Fetch weather forecast using Open-Meteo Weather API
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min&start_date=${startDate}&end_date=${endDate}&temperature_unit=fahrenheit&timezone=auto`;

    const weatherResponse = await fetch(weatherUrl);
    const weatherData = await weatherResponse.json();

    if (!weatherData.daily) {
      return new Response(
        JSON.stringify({ error: "Weather data not available" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Step 3: Process weather data and filter out Sundays
    const forecasts: WeatherForecast[] = [];
    const dates = weatherData.daily.time;
    const maxTemps = weatherData.daily.temperature_2m_max;
    const minTemps = weatherData.daily.temperature_2m_min;

    for (let i = 0; i < dates.length; i++) {
      const date = new Date(dates[i]);
      const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday

      // Skip Sundays
      if (dayOfWeek === 0) continue;

      const dayNames = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];

      forecasts.push({
        date: dates[i],
        dayName: dayNames[dayOfWeek],
        high: Math.round(maxTemps[i]),
        low: Math.round(minTemps[i]),
      });
    }

    return new Response(
      JSON.stringify({
        location: name,
        forecasts,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in get-blitz-weather function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
