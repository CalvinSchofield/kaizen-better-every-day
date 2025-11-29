import { Cloud } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

interface KnockingModeWeatherCardProps {
  repData: any;
  isOnActiveBlitz: boolean;
}

export const KnockingModeWeatherCard = ({ repData, isOnActiveBlitz }: KnockingModeWeatherCardProps) => {
  const [weather, setWeather] = useState<{
    high: number;
    low: number;
    weatherCode: number;
    location: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

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
          // Otherwise, use geolocation
          if (!navigator.geolocation) {
            setLoading(false);
            return;
          }

          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject);
          });

          requestBody.latitude = position.coords.latitude;
          requestBody.longitude = position.coords.longitude;
        }

        const { data, error } = await supabase.functions.invoke("get-blitz-weather", {
          body: requestBody,
        });

        if (error) throw error;

        if (data?.forecasts && data.forecasts.length > 0) {
          const todayForecast = data.forecasts[0];
          setWeather({
            high: todayForecast.high,
            low: todayForecast.low,
            weatherCode: todayForecast.weatherCode,
            location: data.location || "Your Current Location",
          });
        }
      } catch (error) {
        console.error("Error fetching weather:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
  }, [activeBlitz, isOnActiveBlitz]);

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
    <div className="w-full px-6 py-3 rounded-lg bg-primary-foreground/10 mb-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl flex-shrink-0">{getWeatherIcon(weather.weatherCode)}</span>
        <p className="text-primary-foreground/90 text-base font-semibold">
          Weather in {weather.location}
        </p>
      </div>
      <p className="text-primary-foreground/80 text-sm mb-1">
        {weather.high}°F high, {weather.low}°F low · {condition}
      </p>
      <p className="text-primary-foreground/70 text-sm leading-snug">
        {suggestion}
      </p>
    </div>
  );
};
