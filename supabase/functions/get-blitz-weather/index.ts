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
  sunset?: string;
  rainAt?: string | null;
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
    // Use string manipulation to avoid timezone issues with Date objects
    const toISODate = (d: Date) => d.toISOString().slice(0, 10);
    
    // Parse YYYY-MM-DD strings as UTC dates to avoid timezone shifting
    const parseAsUTC = (dateStr: string): Date => {
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(Date.UTC(year, month - 1, day));
    };

    // Get today in UTC
    const nowUTC = new Date();
    const todayUTC = new Date(Date.UTC(nowUTC.getUTCFullYear(), nowUTC.getUTCMonth(), nowUTC.getUTCDate()));

    // Open-Meteo allows up to 16 days forecast, but use 15 to be safe
    const maxForecastDate = new Date(todayUTC);
    maxForecastDate.setUTCDate(maxForecastDate.getUTCDate() + 15);

    const requestedStartDate = parseAsUTC(startDate);
    const requestedEndDate = parseAsUTC(endDate);

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

    const startDateForRequestDate = requestedStartDate < todayUTC ? todayUTC : requestedStartDate;

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

    // Clamp end date to max forecast date
    const endDateForRequestDate = requestedEndDate > maxForecastDate ? maxForecastDate : requestedEndDate;

    const startDateForRequest = toISODate(startDateForRequestDate);
    const endDateForRequest = toISODate(endDateForRequestDate);
    
    console.log(`Date clamping: requested ${startDate} to ${endDate}, using ${startDateForRequest} to ${endDateForRequest}, max=${toISODate(maxForecastDate)}`);

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
      // No location provided - try IP-based geolocation as fallback
      try {
        const ipGeoResponse = await fetch("https://ipapi.co/json/");
        const ipGeoData = await ipGeoResponse.json();
        if (ipGeoData.latitude && ipGeoData.longitude) {
          lat = ipGeoData.latitude;
          lng = ipGeoData.longitude;
          locationName = ipGeoData.city || "Your Location";
          console.log(`IP geolocation fallback: ${locationName} (${lat}, ${lng})`);
        } else {
          return new Response(
            JSON.stringify({ error: "Could not determine location" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      } catch (ipError) {
        console.error("IP geolocation failed:", ipError);
        return new Response(
          JSON.stringify({ error: "Could not determine location" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Step 2: Fetch weather forecast using Open-Meteo Weather API (including weather conditions)
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum,sunset&hourly=precipitation&start_date=${startDateForRequest}&end_date=${endDateForRequest}&temperature_unit=fahrenheit&timezone=auto`;

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
    const sunsets = weatherData.daily.sunset || [];
    const hourlyTimes = weatherData.hourly?.time || [];
    const hourlyPrecip = weatherData.hourly?.precipitation || [];

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

      // Extract sunset time (format: "2026-03-06T18:34")
      let sunsetTime: string | undefined;
      if (sunsets[i]) {
        const sunsetStr = sunsets[i] as string;
        const timePart = sunsetStr.split('T')[1];
        if (timePart) {
          const [h, m] = timePart.split(':').map(Number);
          const ampm = h >= 12 ? 'pm' : 'am';
          const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
          sunsetTime = `${h12}:${String(m).padStart(2, '0')}${ampm}`;
        }
      }

      // Find first hour with precipitation > 0 for this date
      let rainAt: string | null = null;
      const dateStr = dates[i];
      for (let h = 0; h < hourlyTimes.length; h++) {
        if (hourlyTimes[h]?.startsWith(dateStr) && hourlyPrecip[h] > 0) {
          const hourStr = hourlyTimes[h] as string;
          const hourTimePart = hourStr.split('T')[1];
          if (hourTimePart) {
            const hourNum = parseInt(hourTimePart.split(':')[0], 10);
            const ampm = hourNum >= 12 ? 'pm' : 'am';
            const h12 = hourNum > 12 ? hourNum - 12 : hourNum === 0 ? 12 : hourNum;
            rainAt = `${h12}${ampm}`;
          }
          break;
        }
      }

      forecasts.push({
        date: dates[i],
        dayName: dayNames[dayOfWeek],
        high: Math.round(maxTemps[i]),
        low: Math.round(minTemps[i]),
        weatherCode: weatherCodes[i],
        precipitation: precipitation[i],
        sunset: sunsetTime,
        rainAt,
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
