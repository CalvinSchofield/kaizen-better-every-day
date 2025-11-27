import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import TeamCalendarModal from "@/components/TeamCalendarModal";

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

  const getGradientClass = () => {
    if (daysUntil === null || daysUntil < 0) return "from-muted/50 to-muted";
    if (daysUntil === 0) return "from-green-500/20 to-emerald-600/20";
    if (daysUntil <= 3) return "from-red-500/20 to-orange-600/20";
    if (daysUntil <= 7) return "from-orange-500/20 to-amber-600/20";
    if (daysUntil <= 14) return "from-amber-500/20 to-yellow-600/20";
    if (daysUntil <= 30) return "from-yellow-500/20 to-orange-500/20";
    return "from-blue-500/20 to-cyan-600/20";
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

  const isPulse = daysUntil !== null && daysUntil >= 0 && daysUntil <= 7;
  const message = getMessage();
  const showWeather = weather.length > 0 && daysUntil !== null && daysUntil > 0 && daysUntil <= 14;

  return (
    <>
      <Card
        className={`bg-gradient-to-br ${getGradientClass()} border-border/50 ${
          isPulse ? "animate-pulse" : ""
        }`}
      >
        <div className="p-6 space-y-4">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-foreground">
              {message.primary}
            </h2>
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
              {tripLocation && (
                <>
                  <MapPin className="h-4 w-4" />
                  {message.subtext}
                </>
              )}
              {!tripLocation && message.subtext}
            </p>
          </div>

          {daysUntil !== null && daysUntil >= 0 && (
            <div className="flex justify-center">
              <div className="text-center">
                <div className="text-6xl font-bold text-primary">
                  {daysUntil}
                </div>
                <div className="text-sm text-muted-foreground uppercase tracking-wide">
                  {daysUntil === 1 ? "Day" : "Days"}
                </div>
              </div>
            </div>
          )}

          {showWeather && (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <span>Weather for {weatherLocation}</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {weather.map((day) => (
                  <div
                    key={day.date}
                    className="flex-shrink-0 bg-card/50 backdrop-blur-sm rounded-lg p-3 border border-border/50 min-w-[100px] text-center"
                  >
                    <div className="text-xs font-medium text-muted-foreground">
                      {day.dayName}
                    </div>
                    <div className="text-xs text-muted-foreground/70">
                      {new Date(day.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                    <div className="mt-2 space-y-1">
                      <div className="text-lg font-bold text-foreground">
                        {day.high}°
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {day.low}°
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loadingWeather && (
            <div className="text-center text-sm text-muted-foreground">
              Loading weather...
            </div>
          )}

          {(!tripDate || daysUntil === null || daysUntil < 0) && (
            <div className="flex justify-center">
              <Button
                onClick={() => setShowCalendar(true)}
                className="gap-2"
              >
                <Calendar className="h-4 w-4" />
                Open Calendar
              </Button>
            </div>
          )}
        </div>
      </Card>

      <TeamCalendarModal
        open={showCalendar}
        onOpenChange={setShowCalendar}
      />
    </>
  );
};
