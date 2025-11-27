import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Check } from "lucide-react";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface VetBlitzCommitmentsProps {
  repData: any;
}

export const VetBlitzCommitments = ({ repData }: VetBlitzCommitmentsProps) => {
  const calendarUrl = "webcal://p143-caldav.icloud.com/published/2/ODM4MTQxNjQ5ODgzODE0MRrnO9QwHvwHspg2nEVoCsv5FLdG2RTizQGaaVJnHbZfV6TPTtdNYJ2MVW7qvW7RYu4PfYLf5BI9YcU9DIKXHes";
  const { events, loading, error } = useCalendarEvents(calendarUrl);
  const { toast } = useToast();
  const [committedBlitzes, setCommittedBlitzes] = useState<string[]>([]);

  const toggleCommitment = async (eventTitle: string) => {
    const isCommitted = committedBlitzes.includes(eventTitle);
    const newCommitments = isCommitted
      ? committedBlitzes.filter(b => b !== eventTitle)
      : [...committedBlitzes, eventTitle];

    setCommittedBlitzes(newCommitments);

    // Save to database
    try {
      const { error: updateError } = await supabase
        .from('reps')
        .update({ 
          blitz_trip_name: newCommitments.length > 0 ? newCommitments[0] : null 
        })
        .eq('id', repData.id);

      if (updateError) throw updateError;

      toast({
        title: isCommitted ? "Commitment removed" : "Committed!",
        description: isCommitted 
          ? `You've removed your commitment to ${eventTitle}`
          : `You've committed to ${eventTitle}`,
      });
    } catch (error) {
      console.error("Error updating commitment:", error);
      toast({
        title: "Error",
        description: "Could not update your commitment. Please try again.",
        variant: "destructive",
      });
      // Revert on error
      setCommittedBlitzes(isCommitted ? [...committedBlitzes, eventTitle] : committedBlitzes.filter(b => b !== eventTitle));
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Upcoming Blitzes
        </CardTitle>
        <CardDescription>
          Commit to the blitzes you're planning to attend
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!loading && !error && events.length === 0 && (
          <Alert>
            <AlertDescription>No upcoming blitzes scheduled</AlertDescription>
          </Alert>
        )}

        {!loading && !error && events.length > 0 && (
          <div className="space-y-3">
            {events.map((event) => {
              const isCommitted = committedBlitzes.includes(event.title);
              return (
                <div
                  key={event.title}
                  className={`p-4 rounded-lg border transition-all ${
                    isCommitted 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border bg-card hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-sm truncate">{event.title}</h4>
                        {isCommitted && (
                          <Badge variant="default" className="text-xs">
                            <Check className="h-3 w-3 mr-1" />
                            Committed
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {event.date}
                      </p>
                      {event.location && (
                        <p className="text-xs text-muted-foreground mt-1">
                          📍 {event.location}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant={isCommitted ? "outline" : "default"}
                      onClick={() => toggleCommitment(event.title)}
                    >
                      {isCommitted ? "Remove" : "Commit"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
