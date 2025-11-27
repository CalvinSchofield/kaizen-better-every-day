import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Cloud } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import TeamCalendarModal from "@/components/TeamCalendarModal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface WeatherForecast {
  date: string;
  dayName: string;
  high: number;
  low: number;
}

interface BlitzCountdownProps {
  tripName: string | null;
  tripDate: string | null;
  tripEndDate: string | null;
  tripLocation: string | null;
  isVet: boolean;
}

export const BlitzCountdown = ({
  tripName,
  tripDate,
  tripEndDate,
  tripLocation,
  isVet,
}: BlitzCountdownProps) => {
  const [daysUntil, setDaysUntil] = useState<number | null>(null);
  const [weather, setWeather] = useState<WeatherForecast[]>([]);
  const [weatherLocation, setWeatherLocation] = useState<string>("");
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showWeatherDialog, setShowWeatherDialog] = useState(false);

  useEffect(() => {
    const fetchWeather = async () => {
      if (!tripLocation || !tripDate || !tripEndDate) return;

      setLoadingWeather(true);
      try {
        const { data, error } = await supabase.functions.invoke(
          "get-blitz-weather",
          {
            body: {
              location: tripLocation,
              startDate: tripDate,
              endDate: tripEndDate,
            },
          }
        );

        if (error) {
          console.error("Weather fetch error:", error);
          return;
        }

        if (data) {
          setWeather(data.forecasts || []);
          setWeatherLocation(data.location || "");
        }
      } catch (error) {
        console.error("Error fetching weather:", error);
      } finally {
        setLoadingWeather(false);
      }
    };

    if (!tripDate) {
      setDaysUntil(null);
      return;
    }

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const blitzDate = new Date(tripDate);
      blitzDate.setHours(0, 0, 0, 0);
      const diffTime = blitzDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      setDaysUntil(diffDays);

      // Fetch weather if trip is within 14 days and in the future
      if (diffDays > 0 && diffDays <= 14 && tripLocation && tripEndDate) {
        fetchWeather();
      }
    } catch (error) {
      console.error("Error calculating days until blitz:", error);
      setDaysUntil(null);
    }
  }, [tripDate, tripLocation, tripEndDate]);

  const getCompactMessage = () => {
    if (daysUntil === null || daysUntil < 0 || !tripName) {
      return "No blitz scheduled yet";
    }
    
    if (daysUntil === 0) return `${tripName} starts today!`;
    if (daysUntil === 1) return `${tripName} tomorrow`;
    if (daysUntil <= 7) return `${tripName} in ${daysUntil} days`;
    return `${tripName} - ${daysUntil} days`;
  };

  const getEmoji = () => {
    if (daysUntil === null || daysUntil < 0) return "📅";
    if (daysUntil === 0) return "🎯";
    if (daysUntil <= 3) return "🚀";
    if (daysUntil <= 7) return "⚡";
    if (daysUntil <= 14) return "🔥";
    if (daysUntil <= 30) return "⏰";
    return "🗓️";
  };

  const getMessage = () => {
    if (daysUntil === null || daysUntil < 0 || !tripName) {
      return {
        primary: isVet
          ? "Time to lock in your blitz!"
          : "Ready to commit?",
        subtext: isVet
          ? "Pick a trip and start getting your recruits ready"
          : "Check the team calendar and pick your first blitz!",
      };
    }

    if (daysUntil === 0) {
      return {
        primary: `${tripName} starts TODAY!`,
        subtext: isVet
          ? "Time to get you and your recruits on the doors!"
          : `Get ready to hit the doors${tripLocation ? ` in ${tripLocation}` : ''}!`,
      };
    }

    if (daysUntil <= 3) {
      return {
        primary: isVet
          ? `${tripName} is in ${daysUntil} day${daysUntil === 1 ? "" : "s"}!`
          : `${daysUntil} day${daysUntil === 1 ? "" : "s"} until ${tripName}!`,
        subtext: isVet
          ? `Make sure you AND your recruits are ready${tripLocation ? ` for ${tripLocation}` : ''}!`
          : `Final preparations${tripLocation ? ` for ${tripLocation}` : ''}!`,
      };
    }

    if (daysUntil <= 7) {
      return {
        primary: `Almost time! ${daysUntil} days until ${tripName}!`,
        subtext: isVet
          ? `Get you and your team ready${tripLocation ? ` for ${tripLocation}` : ''}!`
          : `Get ready to hit the doors${tripLocation ? ` in ${tripLocation}` : ''}!`,
      };
    }

    if (isVet) {
      return {
        primary: `${daysUntil} days to get you AND your recruits ready!`,
        subtext: tripLocation 
          ? `${tripName} in ${tripLocation} is coming up fast!`
          : `${tripName} is coming up fast!`,
      };
    }

    return {
      primary: `${getEmoji()} ${daysUntil} days until ${tripName}!`,
      subtext: tripLocation 
        ? `Get ready to hit the doors in ${tripLocation}!`
        : 'Get ready to hit the doors!',
    };
  };

  const shouldShowWeather = weather.length > 0 && daysUntil !== null && daysUntil > 0 && daysUntil <= 14;
  const hasBlitz = tripName && tripDate && daysUntil !== null && daysUntil >= 0;

  return (
    <>
      {/* Compact Blitz Line */}
      <div className="flex items-center justify-between py-3 px-4 bg-card/50 rounded-lg border border-border">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{getCompactMessage()}</p>
            {hasBlitz && tripLocation && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {tripLocation}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-shrink-0">
          {shouldShowWeather && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowWeatherDialog(true)}
              className="h-8 px-2"
            >
              <Cloud className="h-4 w-4" />
            </Button>
          )}
          {!hasBlitz && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCalendar(true)}
              className="h-8"
            >
              Pick Blitz
            </Button>
          )}
        </div>
      </div>

      {/* Weather Dialog */}
      <Dialog open={showWeatherDialog} onOpenChange={setShowWeatherDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Weather Forecast</DialogTitle>
            <DialogDescription>
              {weatherLocation} - {tripName}
            </DialogDescription>
          </DialogHeader>
          
          {loadingWeather && (
            <div className="text-center text-sm text-muted-foreground py-4">
              Loading weather...
            </div>
          )}
          
          {!loadingWeather && weather.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {weather.map((day) => (
                <div
                  key={day.date}
                  className="bg-card rounded-lg p-4 border border-border text-center"
                >
                  <div className="text-xs font-medium text-muted-foreground mb-1">
                    {day.dayName}
                  </div>
                  <div className="text-xs text-muted-foreground/70 mb-2">
                    {new Date(day.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                  <div className="space-y-1">
                    <div className="text-2xl font-bold text-foreground">
                      {day.high}°
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Low {day.low}°
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <TeamCalendarModal
        open={showCalendar}
        onOpenChange={setShowCalendar}
      />
    </>
  );
};
