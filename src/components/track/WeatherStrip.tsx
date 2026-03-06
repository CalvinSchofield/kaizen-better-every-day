import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sunset, CloudRain } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface WeatherStripProps {
  repData: any;
  className?: string;
}

const WEATHER_CACHE_KEY = 'kaizen-weather-strip-cache';
const WEATHER_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

interface CachedWeather {
  data: {
    high: number;
    low: number;
    weatherCode: number;
    location: string;
    sunset?: string;
    rainAt?: string | null;
  };
  timestamp: number;
  date: string;
}

const getCachedWeather = (): CachedWeather | null => {
  try {
    const cached = localStorage.getItem(WEATHER_CACHE_KEY);
    if (!cached) return null;
    const parsed = JSON.parse(cached) as CachedWeather;
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
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
    const now = new Date();
    const cache: CachedWeather = {
      data,
      timestamp: Date.now(),
      date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
    };
    localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(cache));
  } catch {}
};

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
  if (code === 0) return "Clear";
  if (code <= 3) return "Partly cloudy";
  if (code <= 48) return "Foggy";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rainy";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Showers";
  if (code <= 86) return "Snow showers";
  return "Storms";
};

export const WeatherStrip = ({ repData, className }: WeatherStripProps) => {
  const [weather, setWeather] = useState<CachedWeather['data'] | null>(() => {
    return getCachedWeather()?.data || null;
  });
  const [loading, setLoading] = useState(() => !getCachedWeather());

  // Find active blitz location
  const activeBlitzLocation = useMemo(() => {
    if (!repData?.committed_blitzes || !Array.isArray(repData.committed_blitzes)) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const blitz = repData.committed_blitzes.find((b: any) => {
      if (!b?.date || !b?.endDate) return false;
      const start = new Date(b.date); start.setHours(0, 0, 0, 0);
      const end = new Date(b.endDate); end.setHours(0, 0, 0, 0);
      return today >= start && today <= end;
    });
    return blitz?.location || null;
  }, [repData?.committed_blitzes]);

  useEffect(() => {
    const fetchWeather = async () => {
      const cached = getCachedWeather();
      if (cached) { setWeather(cached.data); setLoading(false); return; }

      // Set a hard timeout so loading never hangs indefinitely
      const timeout = setTimeout(() => {
        setLoading(false);
      }, 12000);

      try {
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        let requestBody: any = { startDate: today, endDate: today };

        if (activeBlitzLocation) {
          requestBody.location = activeBlitzLocation;
        } else {
          // Try browser geolocation first
          let gotLocation = false;
          if (navigator.geolocation) {
            try {
              const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                  timeout: 5000, maximumAge: 300000, enableHighAccuracy: false,
                });
              });
              requestBody.latitude = position.coords.latitude;
              requestBody.longitude = position.coords.longitude;
              gotLocation = true;
            } catch {
              // Geolocation failed - will try fallbacks below
            }
          }
          
          if (!gotLocation) {
            if (repData?.blitz_trip_location) {
              requestBody.location = repData.blitz_trip_location;
            }
            // If no blitz location either, call without location - edge function will use IP fallback
          }
        }

        const { data, error } = await supabase.functions.invoke("get-blitz-weather", { body: requestBody });
        if (error) throw error;

        if (data?.forecasts && data.forecasts.length > 0) {
          const f = data.forecasts[0];
          const weatherData = {
            high: f.high,
            low: f.low,
            weatherCode: f.weatherCode,
            location: data.location || "Your Location",
            sunset: f.sunset,
            rainAt: f.rainAt,
          };
          setWeather(weatherData);
          setCachedWeather(weatherData);
        }
      } catch (error) {
        console.error("Error fetching weather:", error);
      } finally {
        clearTimeout(timeout);
        setLoading(false);
      }
    };

    fetchWeather();
  }, [activeBlitzLocation, repData?.blitz_trip_location]);

  if (loading) {
    return <Skeleton className={`h-8 w-full rounded-lg ${className}`} />;
  }

  if (!weather) return null;

  return (
    <div className={`flex items-center gap-3 text-sm text-muted-foreground flex-wrap ${className}`}>
      <span className="flex items-center gap-1">
        <span className="text-base">{getWeatherIcon(weather.weatherCode)}</span>
        <span className="font-medium text-foreground">{weather.high}°</span>
        <span>/</span>
        <span>{weather.low}°</span>
      </span>
      
      <span className="text-border/60">·</span>
      <span>{getWeatherCondition(weather.weatherCode)}</span>
      
      {weather.sunset && (
        <>
          <span className="text-border/60">·</span>
          <span className="flex items-center gap-1">
            <Sunset className="h-3.5 w-3.5 text-amber-500" />
            {weather.sunset}
          </span>
        </>
      )}
      
      {weather.rainAt && (
        <>
          <span className="text-border/60">·</span>
          <span className="flex items-center gap-1 text-blue-500 font-medium">
            <CloudRain className="h-3.5 w-3.5" />
            Rain at {weather.rainAt}
          </span>
        </>
      )}
    </div>
  );
};
