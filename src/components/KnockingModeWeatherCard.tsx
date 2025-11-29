import { Cloud, ChevronRight } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

interface KnockingModeWeatherCardProps {
  repData: any;
}

export const KnockingModeWeatherCard = ({ repData }: KnockingModeWeatherCardProps) => {
  const [weather, setWeather] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Check if currently on an active blitz
  const activeBlitz = useMemo(() => {
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
  }, [repData?.committed_blitzes]);

  useEffect(() => {
    const fetchWeather = async () => {
      if (!activeBlitz?.location) return;

      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("get-blitz-weather", {
          body: {
            location: activeBlitz.location,
            startDate: activeBlitz.date,
            endDate: activeBlitz.endDate,
          },
        });

        if (!error && data?.forecasts) {
          setWeather(data.forecasts[0]); // Today's weather
        }
      } catch (error) {
        console.error('Error fetching weather:', error);
      } finally {
        setLoading(false);
      }
    };

    if (activeBlitz) {
      fetchWeather();
    }
  }, [activeBlitz]);

  // Don't render if not on active blitz
  if (!activeBlitz) return null;

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

  const getWeatherSuggestion = (high: number, low: number, weatherCode: number) => {
    const hour = new Date().getHours();
    const dayOfWeek = new Date().getDay();
    const isSaturday = dayOfWeek === 6;
    
    // Check if it's rainy
    const isRainy = weatherCode >= 51 && weatherCode <= 82;
    
    // Build contextual suggestions
    let suggestions = [];
    
    // Temperature-based advice
    if (high >= 85) {
      suggestions.push("Stay hydrated — bring extra water");
      suggestions.push("Light clothing recommended");
    } else if (high >= 75) {
      suggestions.push("Bring water — it's warm");
    }
    
    if (low < 50) {
      suggestions.push("Bring layers — cool mornings");
    } else if (low < 60 && high < 70) {
      suggestions.push("Pack a light jacket");
    }
    
    // Rain advice
    if (isRainy) {
      suggestions.push("Bring an umbrella or rain jacket");
    }
    
    // Time-of-day context
    if (isSaturday) {
      suggestions.push("Sunrise to sunset — pace yourself");
    } else {
      if (hour < 14) {
        suggestions.push("Early afternoon to sunset shift");
      } else {
        suggestions.push("Afternoon to evening shift");
      }
    }
    
    return suggestions.length > 0 ? suggestions : ["Perfect weather to knock!"];
  };

  if (loading) {
    return (
      <div className="flex items-center gap-3 w-full px-6 py-3 rounded-lg bg-primary-foreground/10 mb-3">
        <Cloud className="w-6 h-6 text-primary-foreground/60 animate-pulse flex-shrink-0" />
        <p className="text-primary-foreground/70 text-base font-medium">Loading weather...</p>
      </div>
    );
  }

  if (!weather) return null;

  const suggestions = getWeatherSuggestion(weather.high, weather.low, weather.weatherCode);

  return (
    <div className="flex items-start gap-3 w-full px-6 py-3 rounded-lg bg-primary-foreground/10 mb-3">
      <span className="text-3xl flex-shrink-0 mt-0.5">{getWeatherIcon(weather.weatherCode)}</span>
      <div className="flex-1">
        <p className="text-primary-foreground/90 text-base font-semibold leading-snug">
          {weather.high}°F high, {weather.low}°F low
        </p>
        <ul className="mt-2 space-y-1">
          {suggestions.map((suggestion, idx) => (
            <li key={idx} className="text-primary-foreground/70 text-sm leading-snug">
              • {suggestion}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
