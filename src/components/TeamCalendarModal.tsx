import { Calendar, ExternalLink, AlertCircle } from "lucide-react";
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
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface TeamCalendarModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TeamCalendarModal = ({ open, onOpenChange }: TeamCalendarModalProps) => {
  const calendarUrl = "webcal://p143-caldav.icloud.com/published/2/ODM4MTQxNjQ5ODgzODE0MRrnO9QwHvwHspg2nEVoCsv5FLdG2RTizQGaaVJnHbZfV6TPTtdNYJ2MVW7qvW7RYu4PfYLf5BI9YcU9DIKXHes";
  
  const { events, loading, error } = useCalendarEvents(calendarUrl);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Team Calendar
          </DialogTitle>
          <DialogDescription>
            View upcoming blitz dates, trainings, and team meetings
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

          {/* Upcoming Events */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground">
              Upcoming Events
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
                        <Skeleton className="h-3 w-2/3" />
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
                No upcoming events scheduled
              </p>
            )}
            
            {!loading && !error && events.length > 0 && (
              <div className="space-y-2 max-h-[300px] overflow-y-auto animate-fade-in">
                {events.map((event, index) => (
                  <Card 
                    key={index} 
                    className="p-3 border-border hover:border-primary/50 transition-colors"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm mb-1">{event.title}</h4>
                        <p className="text-xs text-muted-foreground">{event.date}</p>
                        <p className="text-xs text-muted-foreground">{event.time}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TeamCalendarModal;
