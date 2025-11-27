import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import confetti from "canvas-confetti";

interface VetBlitzCommitmentsProps {
  repData: any;
}

interface BlitzEvent {
  id: string;
  name: string;
  date: string;
  endDate: string | null;
  location: string | null;
}

export const VetBlitzCommitments = ({ repData }: VetBlitzCommitmentsProps) => {
  const { toast } = useToast();
  const [committedBlitzes, setCommittedBlitzes] = useState<string[]>([]);
  const [allBlitzes, setAllBlitzes] = useState<BlitzEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Load blitzes directly from repData.committed_blitzes (synced from Notion)
  useEffect(() => {
    setLoading(true);
    
    if (repData?.committed_blitzes && Array.isArray(repData.committed_blitzes)) {
      // Filter to future blitzes only
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const futureBlitzes = repData.committed_blitzes
        .filter((blitz: any) => {
          if (!blitz || !blitz.date) return false;
          const blitzEndDate = blitz.endDate ? new Date(blitz.endDate) : new Date(blitz.date);
          blitzEndDate.setHours(0, 0, 0, 0);
          return blitzEndDate >= today;
        })
        .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      setAllBlitzes(futureBlitzes);
      // Pre-populate all as committed since they're in the rep's Notion relation
      setCommittedBlitzes(futureBlitzes.map((b: any) => b.name));
      console.log('[VetBlitzCommitments] Loaded blitzes from repData:', futureBlitzes);
    } else {
      setAllBlitzes([]);
      setCommittedBlitzes([]);
    }
    
    setLoading(false);
  }, [repData]);

  const toggleCommitment = async (blitzName: string) => {
    const isCommitted = committedBlitzes.includes(blitzName);
    const newCommitmentNames = isCommitted
      ? committedBlitzes.filter(b => b !== blitzName)
      : [...committedBlitzes, blitzName];

    setCommittedBlitzes(newCommitmentNames);

    // Show confetti animation when committing
    if (!isCommitted) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }

    // Note: Commitment updates should be handled via Notion automation
    // The committed_blitzes field is synced FROM Notion, not TO Notion
    toast({
      title: isCommitted ? "Commitment removed" : "Committed!",
      description: isCommitted 
        ? `You've removed your commitment to ${blitzName}`
        : `You've committed to ${blitzName}. This will sync to Notion on next refresh.`,
    });
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

      {!loading && allBlitzes.length === 0 && (
        <Alert>
          <AlertDescription>No upcoming blitzes scheduled</AlertDescription>
        </Alert>
      )}

      {!loading && allBlitzes.length > 0 && (
        <div className="space-y-3">
          {allBlitzes.map((blitz) => {
            const isCommitted = committedBlitzes.includes(blitz.name);
            return (
              <div
                key={blitz.id}
                onClick={() => toggleCommitment(blitz.name)}
                className={`p-4 rounded-lg border transition-all cursor-pointer ${
                  isCommitted 
                    ? 'border-primary bg-primary/10 ring-2 ring-primary/20' 
                    : 'border-border bg-card hover:border-primary/50 hover:bg-primary/5'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-sm truncate">{blitz.name}</h4>
                      {isCommitted && (
                        <Badge variant="default" className="text-xs">
                          <Check className="h-3 w-3 mr-1" />
                          Committed
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {blitz.date}{blitz.endDate && ` - ${blitz.endDate}`}
                    </p>
                    {blitz.location && (
                      <p className="text-xs text-muted-foreground mt-1">
                        📍 {blitz.location}
                      </p>
                    )}
                  </div>
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
