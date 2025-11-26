import { useState } from "react";
import { Calendar, ExternalLink, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface TeamCalendarModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TeamCalendarModal = ({ open, onOpenChange }: TeamCalendarModalProps) => {
  const calendarUrl = "webcal://p143-caldav.icloud.com/published/2/ODM4MTQxNjQ5ODgzODE0MRrnO9QwHvwHspg2nEVoCsv5FLdG2RTizQGaaVJnHbZfV6TPTtdNYJ2MVW7qvW7RYu4PfYLf5BI9YcU9DIKXHes";

  // Placeholder upcoming events - in production, you'd fetch these from the iCal feed
  const upcomingEvents = [
    {
      title: "Team Training: Objection Handling",
      date: "Monday, Dec 2",
      time: "7:00 PM - 8:30 PM",
    },
    {
      title: "Blitz Trip - Phoenix, AZ",
      date: "Friday, Dec 6 - Sunday, Dec 8",
      time: "All Day",
    },
    {
      title: "Weekly Sales Meeting",
      date: "Monday, Dec 9",
      time: "6:00 PM - 7:00 PM",
    },
    {
      title: "Product Knowledge Training",
      date: "Wednesday, Dec 11",
      time: "7:00 PM - 8:00 PM",
    },
  ];

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
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {upcomingEvents.map((event, index) => (
                <Card key={index} className="p-3 border-border">
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TeamCalendarModal;
