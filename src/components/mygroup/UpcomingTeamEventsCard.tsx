import { useState } from "react";
import { Calendar, Users, ChevronRight, Sparkles, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useCalendarEvents, CalendarEvent } from "@/hooks/useCalendarEvents";

interface UpcomingTeamEventsCardProps {
  teamLeaderPhone?: string;
}

const CALENDAR_URL = "webcal://p143-caldav.icloud.com/published/2/ODM4MTQxNjQ5ODgzODE0MRrnO9QwHvwHspg2nEVoCsv5FLdG2RTizQGaaVJnHbZfV6TPTtdNYJ2MVW7qvW7RYu4PfYLf5BI9YcU9DIKXHes";

const UpcomingTeamEventsCard = ({ teamLeaderPhone }: UpcomingTeamEventsCardProps) => {
  const { events, loading, error } = useCalendarEvents(CALENDAR_URL);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Get next 3 events for preview
  const previewEvents = events.slice(0, 3);
  const hasMoreEvents = events.length > 3;

  const handleTextAboutEvent = (event: CalendarEvent) => {
    const locationName = (event.location || event.title).split('\n')[0].trim();
    const message = encodeURIComponent(`Hey! I want to talk about the upcoming ${locationName} event with my group`);
    const phone = teamLeaderPhone || '4697157056';
    window.location.href = `sms:${phone}&body=${message}`;
  };

  const getDaysUntil = (date: Date): string => {
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays < 7) return `${diffDays} days`;
    if (diffDays < 14) return "Next week";
    return `${Math.ceil(diffDays / 7)} weeks`;
  };

  if (loading) {
    return (
      <Card className="border-border bg-card/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="w-5 h-5 rounded" />
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || events.length === 0) {
    return null; // Don't show card if no events
  }

  return (
    <>
      <Card className="border-border bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Calendar className="w-4 h-4 text-primary" />
              </div>
              <h3 className="font-semibold text-sm">Upcoming Team Events</h3>
            </div>
            <Badge variant="secondary" className="text-xs">
              <Users className="w-3 h-3 mr-1" />
              {events.length} events
            </Badge>
          </div>

          {/* Encouragement message */}
          <div className="flex items-start gap-2 mb-3 p-2 rounded-lg bg-accent/30">
            <Sparkles className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              Getting together regularly builds team culture and strengthens relationships.
            </p>
          </div>

          {/* Preview events */}
          <div className="space-y-2">
            {previewEvents.map((event, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2.5 rounded-lg bg-background/50 border border-border/50 cursor-pointer hover:border-primary/30 transition-colors"
                onClick={() => {
                  setSelectedEvent(event);
                  setDrawerOpen(true);
                }}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-1.5 h-8 rounded-full bg-primary/60 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{event.title}</p>
                    <p className="text-xs text-muted-foreground">{event.date}</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs flex-shrink-0">
                  {getDaysUntil(event.startDate)}
                </Badge>
              </div>
            ))}
          </div>

          {/* View all button */}
          {hasMoreEvents && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-3 text-muted-foreground"
              onClick={() => setDrawerOpen(true)}
            >
              View all {events.length} events
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Events Drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Team Events Calendar
            </DrawerTitle>
          </DrawerHeader>

          <div className="px-4 pb-6 space-y-4 overflow-y-auto">
            {/* Encouragement banner */}
            <div className="flex items-start gap-3 p-3 rounded-xl bg-primary/10 border border-primary/20">
              <Sparkles className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Build team culture!</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Strong teams are built through consistent connection. Use these events to bond and build culture!
                </p>
              </div>
            </div>

            {/* All events list */}
            <div className="space-y-2">
              {events.map((event, index) => (
                <Card 
                  key={index} 
                  className={`border-border transition-all duration-200 ${
                    selectedEvent === event ? 'border-primary/50 bg-primary/5' : ''
                  }`}
                >
                  <CardContent className="p-3">
                    <div 
                      className="flex items-start gap-3 cursor-pointer"
                      onClick={() => setSelectedEvent(selectedEvent === event ? null : event)}
                    >
                      <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-semibold text-sm">{event.title}</h4>
                          <Badge variant="secondary" className="text-xs flex-shrink-0">
                            {getDaysUntil(event.startDate)}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{event.date}</p>
                        {event.time !== "All Day" && (
                          <p className="text-xs text-muted-foreground">{event.time}</p>
                        )}
                        {event.location && (
                          <p className="text-xs text-muted-foreground mt-1">{event.location}</p>
                        )}
                      </div>
                    </div>

                    {selectedEvent === event && (
                      <div className="mt-3 pt-3 border-t border-border space-y-2">
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => handleTextAboutEvent(event)}
                        >
                          <MessageSquare className="w-4 h-4 mr-2" />
                          Text about this event
                        </Button>
                        <p className="text-xs text-center text-muted-foreground">
                          Rally your group to attend together!
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Add to calendar CTA */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                window.location.href = CALENDAR_URL;
              }}
            >
              <Calendar className="w-4 h-4 mr-2" />
              Add Calendar to iPhone
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
};

export default UpcomingTeamEventsCard;
