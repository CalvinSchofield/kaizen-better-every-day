import { useState } from "react";
import { Calendar, ExternalLink, AlertCircle, MessageSquare } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCalendarEvents, CalendarEvent } from "@/hooks/useCalendarEvents";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface TeamCalendarModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TeamCalendarModal = ({ open, onOpenChange }: TeamCalendarModalProps) => {
  const calendarUrl = "webcal://p143-caldav.icloud.com/published/2/ODM4MTQxNjQ5ODgzODE0MRrnO9QwHvwHspg2nEVoCsv5FLdG2RTizQGaaVJnHbZfV6TPTtdNYJ2MVW7qvW7RYu4PfYLf5BI9YcU9DIKXHes";
  
  const { events, loading, error } = useCalendarEvents(calendarUrl);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const handleTextLeader = (eventTitle: string) => {
    const message = encodeURIComponent(`Tell me more about ${eventTitle}`);
    window.location.href = `sms:4697157056&body=${message}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Team Calendar
          </DialogTitle>
          <DialogDescription>
            View upcoming blitz trips and commit to your next one
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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
                    className="p-3 border-border hover:border-primary/50 transition-colors cursor-pointer"
                    style={{ animationDelay: `${index * 50}ms` }}
                    onClick={() => setSelectedEvent(event)}
                  >
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
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Event Detail Expansion */}
          {selectedEvent && (
            <Card className="p-4 border-primary/50 bg-primary/5 animate-fade-in">
              <h4 className="font-semibold mb-2">{selectedEvent.title}</h4>
              <p className="text-sm text-muted-foreground mb-1">{selectedEvent.date}</p>
              {selectedEvent.location && (
                <p className="text-sm text-muted-foreground mb-3">{selectedEvent.location}</p>
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleTextLeader(selectedEvent.title)}
                  className="flex-1"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Text Leader
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedEvent(null)}
                  className="flex-1"
                >
                  Close
                </Button>
              </div>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TeamCalendarModal;
