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

  // Load initial commitments from repData
  useEffect(() => {
    if (repData?.committed_blitzes) {
      const commitments = Array.isArray(repData.committed_blitzes) 
        ? repData.committed_blitzes 
        : [];
      setCommittedBlitzes(commitments);
      console.log('[VetBlitzCommitments] Loaded initial commitments:', commitments);
    }
  }, [repData]);

  // Fetch all blitzes from Preseason Trips database via edge function
  useEffect(() => {
    const fetchBlitzes = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase.functions.invoke('fetch-preseason-blitzes');
        
        if (error) throw error;
        
        if (data?.blitzes) {
          setAllBlitzes(data.blitzes);
          console.log('[VetBlitzCommitments] Loaded blitzes:', data.blitzes);
        }
      } catch (error) {
        console.error('[VetBlitzCommitments] Error fetching blitzes:', error);
        toast({
          title: "Error loading blitzes",
          description: "Could not load upcoming blitzes. Please refresh.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchBlitzes();
  }, [toast]);

  const toggleCommitment = async (blitzName: string) => {
    const isCommitted = committedBlitzes.includes(blitzName);
    const newCommitments = isCommitted
      ? committedBlitzes.filter(b => b !== blitzName)
      : [...committedBlitzes, blitzName];

    setCommittedBlitzes(newCommitments);

    // Show confetti animation when committing
    if (!isCommitted) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }

    // Save to database
    try {
      const { error: updateError } = await supabase
        .from('reps')
        .update({ 
          committed_blitzes: newCommitments
        })
        .eq('id', repData.id);

      if (updateError) throw updateError;

      toast({
        title: isCommitted ? "Commitment removed" : "Committed!",
        description: isCommitted 
          ? `You've removed your commitment to ${blitzName}`
          : `You've committed to ${blitzName}`,
      });
    } catch (error) {
      console.error("Error updating commitment:", error);
      toast({
        title: "Error",
        description: "Could not update your commitment. Please try again.",
        variant: "destructive",
      });
      // Revert on error
      setCommittedBlitzes(isCommitted ? [...committedBlitzes, blitzName] : committedBlitzes.filter(b => b !== blitzName));
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
