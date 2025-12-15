import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Cloud, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import TeamCalendarModal from "@/components/TeamCalendarModal";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getDaysUntilBlitz } from "@/utils/blitzDateUtils";

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
  const [showWeatherSheet, setShowWeatherSheet] = useState(false);

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

    // Use calendar-day-based calculation for accurate "tomorrow" display
    const days = getDaysUntilBlitz(tripDate);
    setDaysUntil(days);

    // Fetch weather if trip is within 14 days and in the future
    if (days !== null && days > 0 && days <= 14 && tripLocation && tripEndDate) {
      fetchWeather();
    }
  }, [tripDate, tripLocation, tripEndDate]);

  const getCompactMessage = () => {
    if (daysUntil === null || !tripName || !tripLocation) {
      return "No blitz scheduled yet";
    }
    
    const locationName = tripLocation.split(',')[0]; // Get just city name
    
    // If negative days (blitz already started but within the trip), show "this week"
    if (daysUntil < 0) return `${locationName} this week — you got this!`;
    if (daysUntil === 0) return `${locationName} starts today — you got this!`;
    if (daysUntil === 1) return `${locationName} tomorrow — prep makes perfect`;
    if (daysUntil <= 7) return `${locationName} in ${daysUntil} days — prep makes perfect`;
    return `${locationName} in ${daysUntil} days`;
  };
  
  const getWeatherTip = () => {
    if (weather.length === 0) return "";
    
    const avgHigh = weather.reduce((sum, day) => sum + day.high, 0) / weather.length;
    const avgLow = weather.reduce((sum, day) => sum + day.low, 0) / weather.length;
    
    if (avgHigh > 85) {
      return "Pack light and bring sunscreen — it's going to be hot out there!";
    } else if (avgHigh < 60) {
      return "Pack warm — it gets colder than you think when you're outside all day. Pants are probably the move not shorts.";
    } else if (avgLow < 50) {
      return "Days are nice but mornings are cold — bring layers you can adjust throughout the day.";
    }
    return "Perfect knocking weather — prep your pitch and pack smart!";
  };

  // Show weather if trip is upcoming or ongoing (daysUntil can be negative if mid-trip)
  const shouldShowWeather = weather.length > 0 && daysUntil !== null && daysUntil <= 14;
  const hasBlitz = tripName && tripDate && daysUntil !== null;

  const getEmoji = () => {
    if (!hasBlitz) return "📅";
    if (daysUntil !== null && daysUntil < 0) return "🔥"; // Ongoing blitz
    if (daysUntil === 0) return "🎯";
    if (daysUntil && daysUntil <= 3) return "🚀";
    if (daysUntil && daysUntil <= 7) return "⚡";
    return "📍";
  };

  return (
    <>
      {/* Compact Blitz Text Line */}
      <div className="py-2">
        <div 
          className={`flex items-center gap-2 ${
            !hasBlitz 
              ? 'cursor-pointer hover:opacity-80 transition-all group' 
              : ''
          }`}
          onClick={!hasBlitz ? () => setShowCalendar(true) : undefined}
        >
          <span className="text-lg">{getEmoji()}</span>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${!hasBlitz ? 'text-primary underline decoration-dashed' : 'text-primary-foreground/80'}`}>
              {getCompactMessage()}
            </p>
          </div>
          {!hasBlitz && (
            <ChevronRight className="h-4 w-4 text-primary flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
          )}
          {shouldShowWeather && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowWeatherSheet(true);
              }}
              className="text-xs text-primary hover:text-primary/80 transition-colors underline flex-shrink-0"
            >
              Weather
            </button>
          )}
        </div>
      </div>

      {/* Weather Sheet */}
      <Sheet open={showWeatherSheet} onOpenChange={setShowWeatherSheet}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Weather Forecast</SheetTitle>
            <SheetDescription>
              {weatherLocation} - {tripName}
            </SheetDescription>
          </SheetHeader>
          
          {loadingWeather && (
            <div className="text-center text-sm text-muted-foreground py-4">
              Loading weather...
            </div>
          )}
          
          {!loadingWeather && weather.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-3 mt-4">
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
              
              {/* Weather Tip */}
              <div className="mt-4 p-4 bg-muted/50 rounded-lg border border-border">
                <p className="text-sm text-muted-foreground italic text-center">
                  {getWeatherTip()}
                </p>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <TeamCalendarModal
        open={showCalendar}
        onOpenChange={setShowCalendar}
      />
    </>
  );
};
