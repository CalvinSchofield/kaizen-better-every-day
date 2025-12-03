import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

interface KnockingModeWeatherCardProps {
  repData: any;
  isOnActiveBlitz: boolean;
}

const WEATHER_CACHE_KEY = 'kaizen-weather-cache';
const WEATHER_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

interface CachedWeather {
  data: {
    high: number;
    low: number;
    weatherCode: number;
    location: string;
  };
  timestamp: number;
  date: string;
}

const getCachedWeather = (): CachedWeather | null => {
  try {
    const cached = localStorage.getItem(WEATHER_CACHE_KEY);
    if (!cached) return null;
    const parsed = JSON.parse(cached) as CachedWeather;
    const today = new Date().toISOString().split("T")[0];
    // Check if cache is valid (same day and not expired)
    if (parsed.date === today && Date.now() - parsed.timestamp < WEATHER_CACHE_DURATION) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
};

const setCachedWeather = (data: CachedWeather['data']) => {
  try {
    const cache: CachedWeather = {
      data,
      timestamp: Date.now(),
      date: new Date().toISOString().split("T")[0],
    };
    localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage errors
  }
};

export const KnockingModeWeatherCard = ({ repData, isOnActiveBlitz }: KnockingModeWeatherCardProps) => {
  const [weather, setWeather] = useState<{
    high: number;
    low: number;
    weatherCode: number;
    location: string;
  } | null>(() => {
    // Initialize from cache immediately
    const cached = getCachedWeather();
    return cached?.data || null;
  });
  const [loading, setLoading] = useState(() => !getCachedWeather());

  // Check if weather should be visible (10:30 PM to 10:00 AM local time)
  const shouldShowWeather = useMemo(() => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentMinutes = hours * 60 + minutes;
    
    // 10:30 PM = 22:30 = 1350 minutes
    // 10:00 AM = 10:00 = 600 minutes
    
    // Show if: 10:30 PM (1350) to midnight (1440) OR midnight (0) to 10:00 AM (600)
    return currentMinutes >= 1350 || currentMinutes < 600;
  }, []);

  // Determine if there's an active blitz
  const activeBlitz = useMemo(() => {
    // Only look for active blitz if prop says we're on one
    if (!isOnActiveBlitz) {
      return null;
    }
    
    if (!repData?.committed_blitzes || !Array.isArray(repData.committed_blitzes)) {
      return null;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return repData.committed_blitzes.find((blitz: any) => {
      if (!blitz?.date || !blitz?.endDate) return false;

      const startDate = new Date(blitz.date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(blitz.endDate);
      endDate.setHours(0, 0, 0, 0);

      return today >= startDate && today <= endDate;
    });
  }, [isOnActiveBlitz, repData?.committed_blitzes]);

  useEffect(() => {
    const fetchWeather = async () => {
      // Skip fetch if we have valid cached data
      const cached = getCachedWeather();
      if (cached) {
        setWeather(cached.data);
        setLoading(false);
        return;
      }

      try {
        const today = new Date().toISOString().split("T")[0];
        let requestBody: any = {
          startDate: today,
          endDate: today,
        };

        // If on active blitz, use blitz location
        if (activeBlitz?.location) {
          requestBody.location = activeBlitz.location;
        } else {
          // Use geolocation with timeout for PWA reliability
          if (!navigator.geolocation) {
            setLoading(false);
            return;
          }

          try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                timeout: 10000,
                maximumAge: 300000, // Use cached position up to 5 min old
                enableHighAccuracy: false,
              });
            });
            requestBody.latitude = position.coords.latitude;
            requestBody.longitude = position.coords.longitude;
          } catch (geoError) {
            console.warn("Geolocation failed, using default location:", geoError);
            // Fallback to blitz location from rep data if available
            if (repData?.blitz_trip_location) {
              requestBody.location = repData.blitz_trip_location;
            } else {
              setLoading(false);
              return;
            }
          }
        }

        const { data, error } = await supabase.functions.invoke("get-blitz-weather", {
          body: requestBody,
        });

        if (error) throw error;

        if (data?.forecasts && data.forecasts.length > 0) {
          const todayForecast = data.forecasts[0];
          const weatherData = {
            high: todayForecast.high,
            low: todayForecast.low,
            weatherCode: todayForecast.weatherCode,
            location: data.location || "Your Location",
          };
          setWeather(weatherData);
          setCachedWeather(weatherData);
        }
      } catch (error) {
        console.error("Error fetching weather:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
  }, [activeBlitz, isOnActiveBlitz, repData?.blitz_trip_location]);

  const getWeatherIcon = (code: number) => {
    if (code === 0) return "☀️";
    if (code <= 3) return "⛅";
    if (code <= 48) return "🌫️";
    if (code <= 57) return "🌦️";
    if (code <= 67) return "🌧️";
    if (code <= 77) return "❄️";
    if (code <= 82) return "🌧️";
    if (code <= 86) return "🌨️";
    return "⛈️";
  };

  const getWeatherCondition = (code: number) => {
    if (code === 0) return "Clear skies";
    if (code <= 3) return "Partly cloudy";
    if (code <= 48) return "Foggy";
    if (code <= 57) return "Drizzle";
    if (code <= 67) return "Rainy";
    if (code <= 77) return "Snowy";
    if (code <= 82) return "Rain showers";
    if (code <= 86) return "Snow showers";
    return "Thunderstorms";
  };

  const getWeatherSuggestion = (high: number, low: number, weatherCode: number) => {
    const dayOfWeek = new Date().getDay();
    const isSaturday = dayOfWeek === 6;
    const isRainy = weatherCode >= 51 && weatherCode <= 82;
    
    // Priority: Rain > Extreme heat > Cold > Time context
    if (isRainy) {
      return "Bring an umbrella or rain jacket";
    }
    
    if (high >= 85) {
      return "Stay hydrated — bring extra water";
    }
    
    if (low < 50) {
      return "Bring layers — cool mornings ahead";
    }
    
    if (high < 60) {
      return "Pack warm — it's chilly out there";
    }
    
    if (isSaturday) {
      return "Sunrise to sunset — pace yourself and stay strong";
    }
    
    return "Perfect weather to knock — let's get after it!";
  };

  // Check time-based visibility
  if (!shouldShowWeather) return null;

  if (loading) {
    return null;
  }

  if (!weather) return null;

  const condition = getWeatherCondition(weather.weatherCode);
  const suggestion = getWeatherSuggestion(weather.high, weather.low, weather.weatherCode);

  return (
    <div className="w-full rounded-lg bg-card border border-border mb-6 p-6">
      <div className="flex items-start gap-6">
        <span className="text-6xl flex-shrink-0">{getWeatherIcon(weather.weatherCode)}</span>
        <div className="flex-1 space-y-3">
          <div>
            <p className="text-foreground text-xl font-bold mb-1">
              {weather.location}
            </p>
            <p className="text-muted-foreground text-base">
              {condition}
            </p>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-foreground text-3xl font-semibold">{weather.high}°F</span>
            <span className="text-muted-foreground text-lg">Low: {weather.low}°F</span>
          </div>
          <p className="text-muted-foreground text-base leading-relaxed pt-2 border-t border-border">
            {suggestion}
          </p>
        </div>
      </div>
    </div>
  );
};
