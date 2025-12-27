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
  weatherCode: number;
  precipitation: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { location, latitude, longitude, startDate, endDate } = await req.json();

    if (!startDate || !endDate) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters: startDate and endDate" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Open-Meteo free API only provides ~16 days of forecast.
    // Clamp requested dates to the available forecast window so we don't return 500s.
    const toISODate = (d: Date) => d.toISOString().slice(0, 10);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const maxForecastDate = new Date(today);
    maxForecastDate.setDate(maxForecastDate.getDate() + 16);

    const requestedStartDate = new Date(startDate);
    const requestedEndDate = new Date(endDate);

    if (
      Number.isNaN(requestedStartDate.getTime()) ||
      Number.isNaN(requestedEndDate.getTime())
    ) {
      return new Response(
        JSON.stringify({ error: "Invalid startDate/endDate format (expected YYYY-MM-DD)" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (requestedEndDate < requestedStartDate) {
      return new Response(
        JSON.stringify({ error: "endDate must be on/after startDate" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const startDateForRequestDate = requestedStartDate < today ? today : requestedStartDate;

    // If even the (clamped) start is beyond the forecast horizon, return a friendly empty result.
    if (startDateForRequestDate > maxForecastDate) {
      return new Response(
        JSON.stringify({
          location: location || "Unknown",
          forecasts: [],
          message: `Forecast not yet available (available through ${toISODate(maxForecastDate)})`,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const endDateForRequestDate = requestedEndDate > maxForecastDate ? maxForecastDate : requestedEndDate;

    const startDateForRequest = toISODate(startDateForRequestDate);
    const endDateForRequest = toISODate(endDateForRequestDate);

    const forecastMessage = requestedEndDate > maxForecastDate
      ? `Forecast only available through ${endDateForRequest}`
      : undefined;

    let lat: number;
    let lng: number;
    let locationName: string;

    // If latitude and longitude provided, use them directly
    if (latitude !== undefined && longitude !== undefined) {
      lat = latitude;
      lng = longitude;
      
      // Reverse geocode to get city name
      const reverseGeocodeUrl = `https://geocoding-api.open-meteo.com/v1/search?latitude=${lat}&longitude=${lng}&count=1&language=en&format=json`;
      try {
        const reverseGeocodeResponse = await fetch(reverseGeocodeUrl);
        const reverseData = await reverseGeocodeResponse.json();
        
        if (reverseData.results && reverseData.results.length > 0) {
          locationName = reverseData.results[0].name;
        } else {
          locationName = "Your Location";
        }
      } catch (error) {
        console.error("Reverse geocoding failed:", error);
        locationName = "Your Location";
      }
    } else if (location) {
      // Step 1: Geocode the location using Open-Meteo Geocoding API
      // Try multiple location formats to improve success rate
      const locationVariants = [
        location, // Original format (e.g., "Bakersfield, CA")
        location.split(',')[0].trim(), // Just city name (e.g., "Bakersfield")
        location.replace(', ', ' '), // Without comma (e.g., "Bakersfield CA")
      ];
      
      let geocodeData: any = null;
      
      for (const variant of locationVariants) {
        const geocodeUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          variant
        )}&count=1&language=en&format=json`;

        const geocodeResponse = await fetch(geocodeUrl);
        const data = await geocodeResponse.json();
        
        if (data.results && data.results.length > 0) {
          geocodeData = data;
          console.log(`Successfully geocoded with variant: ${variant}`);
          break;
        }
      }

      if (!geocodeData || !geocodeData.results || geocodeData.results.length === 0) {
        return new Response(
          JSON.stringify({ error: "Location not found" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      lat = geocodeData.results[0].latitude;
      lng = geocodeData.results[0].longitude;
      locationName = geocodeData.results[0].name;
    } else {
      return new Response(
        JSON.stringify({ error: "Either location or latitude/longitude must be provided" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Step 2: Fetch weather forecast using Open-Meteo Weather API (including weather conditions)
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum&start_date=${startDateForRequest}&end_date=${endDateForRequest}&temperature_unit=fahrenheit&timezone=auto`;

    console.log(`Fetching weather from: ${weatherUrl}`);

    const weatherResponse = await fetch(weatherUrl);
    const weatherData = await weatherResponse.json();

    console.log(`Weather API response status: ${weatherResponse.status}`);
    console.log(`Weather data keys: ${Object.keys(weatherData).join(', ')}`);

    // Never return 500 to the app for forecast availability issues.
    if (weatherData.error) {
      console.error(`Weather API error: ${JSON.stringify(weatherData)}`);
      return new Response(
        JSON.stringify({
          location: locationName,
          forecasts: [],
          message: `Weather forecast unavailable: ${weatherData.reason || weatherData.error}`,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!weatherData.daily) {
      console.error(`No daily data in response: ${JSON.stringify(weatherData)}`);
      return new Response(
        JSON.stringify({
          location: locationName,
          forecasts: [],
          message: "Weather forecast unavailable",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Step 3: Process weather data and filter out Sundays
    const forecasts: WeatherForecast[] = [];
    const dates = weatherData.daily.time;
    const maxTemps = weatherData.daily.temperature_2m_max;
    const minTemps = weatherData.daily.temperature_2m_min;
    const weatherCodes = weatherData.daily.weather_code;
    const precipitation = weatherData.daily.precipitation_sum;

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
        weatherCode: weatherCodes[i],
        precipitation: precipitation[i],
      });
    }

    return new Response(
      JSON.stringify({
        location: locationName,
        forecasts,
        ...(forecastMessage ? { message: forecastMessage } : {}),
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
