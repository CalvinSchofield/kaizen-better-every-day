import { useState } from "react";
import { Calendar, ExternalLink, AlertCircle, MessageSquare } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCalendarEvents, CalendarEvent } from "@/hooks/useCalendarEvents";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface TeamCalendarModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamLeaderPhone?: string;
}

const TeamCalendarModal = ({ open, onOpenChange, teamLeaderPhone }: TeamCalendarModalProps) => {
  const calendarUrl = "webcal://p143-caldav.icloud.com/published/2/ODM4MTQxNjQ5ODgzODE0MRrnO9QwHvwHspg2nEVoCsv5FLdG2RTizQGaaVJnHbZfV6TPTtdNYJ2MVW7qvW7RYu4PfYLf5BI9YcU9DIKXHes";
  
  const { events, loading, error } = useCalendarEvents(calendarUrl);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const handleTextLeader = (event: CalendarEvent) => {
    // Extract just the city/location name (first line if multiline)
    const locationName = (event.location || event.title).split('\n')[0].trim();
    const message = encodeURIComponent(`Tell me more about the ${locationName} Blitz, I'm thinking about going on that one`);
    const phone = teamLeaderPhone || '4697157056'; // Fallback to Calvin's number
    window.location.href = `sms:${phone}&body=${message}`;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Team Calendar
          </SheetTitle>
          <SheetDescription>
            View upcoming blitz trips and commit to your next one
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {/* Add to iPhone Button */}
          <Button
            className="w-full"
            size="lg"
            onClick={() => {
              window.location.href = calendarUrl;
            }}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Add Calendar to iPhone
          </Button>

          {/* Upcoming Blitz Trips */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground">
              Upcoming Blitz Trips
            </h3>
            
            {loading && (
              <div className="space-y-2 animate-fade-in">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i} className="p-3 border-border">
                    <div className="flex items-start gap-3">
                      <Skeleton className="w-2 h-2 rounded-full mt-2 flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
            
            {error && (
              <Alert variant="destructive" className="animate-fade-in">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {!loading && !error && events.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4 animate-fade-in">
                No upcoming blitz trips scheduled
              </p>
            )}
            
            {!loading && !error && events.length > 0 && (
              <div className="space-y-2 max-h-[300px] overflow-y-auto animate-fade-in">
                {events.map((event, index) => (
                  <Card 
                    key={index} 
                    className={`border-border transition-all duration-200 cursor-pointer ${
                      selectedEvent === event ? 'border-primary/50 bg-primary/5' : 'hover:border-primary/30'
                    }`}
                    style={{ animationDelay: `${index * 50}ms` }}
                    onClick={() => setSelectedEvent(selectedEvent === event ? null : event)}
                  >
                    <div className="p-3">
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm mb-1">{event.title}</h4>
                          <p className="text-xs text-muted-foreground">{event.date}</p>
                          {event.location && (
                            <p className="text-xs text-muted-foreground">{event.location}</p>
                          )}
                        </div>
                      </div>
                      
                      {selectedEvent === event && (
                        <div className="mt-3 pt-3 border-t border-border animate-fade-in">
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTextLeader(event);
                            }}
                            className="w-full"
                          >
                            <MessageSquare className="w-4 h-4 mr-2" />
                            Text Leader
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default TeamCalendarModal;
