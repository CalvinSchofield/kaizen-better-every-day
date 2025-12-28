import { Cloud, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { parseDateAsLocal } from "@/utils/blitzDateUtils";

interface KnockingWeatherWidgetProps {
  repData: any;
}

export const KnockingWeatherWidget = ({ repData }: KnockingWeatherWidgetProps) => {
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
      
      const startDate = parseDateAsLocal(blitz.date);
      const endDate = parseDateAsLocal(blitz.endDate);
      if (!startDate || !endDate) return false;
      startDate.setHours(0, 0, 0, 0);
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

  const getPackingTip = (high: number, low: number) => {
    if (high >= 85) return "Pack light - it's hot! 🌞";
    if (low < 50) return "Bring layers - cool mornings 🧥";
    if (high < 60) return "Pack warm - it's chilly 🧣";
    return "Perfect weather to knock! 🎯";
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!weather) return null;

  return (
    <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border-blue-200 dark:border-blue-800">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Cloud className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <CardTitle>Weather in {activeBlitz.location}</CardTitle>
        </div>
        <CardDescription>Today's conditions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-5xl">{getWeatherIcon(weather.weatherCode)}</span>
            <div>
              <p className="text-3xl font-bold">{weather.high}°F</p>
              <p className="text-sm text-muted-foreground">Low: {weather.low}°F</p>
            </div>
          </div>
        </div>
        <p className="mt-4 text-sm font-medium text-blue-700 dark:text-blue-300">
          {getPackingTip(weather.high, weather.low)}
        </p>
      </CardContent>
    </Card>
  );
};
