import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Clock, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DailyEntry } from "@/hooks/useDailyEntry";

interface SaveDayAlertCardProps {
  entry: DailyEntry;
  onSave: () => void;
  onDiscard: () => void;
}

export const SaveDayAlertCard = ({ entry, onSave, onDiscard }: SaveDayAlertCardProps) => {
  const [discardSheetOpen, setDiscardSheetOpen] = useState(false);

  // Calculate minutes since last activity
  const minutesSinceLastTap = useMemo(() => {
    if (!entry.counter_timestamps) return 0;
    
    const timestamps = entry.counter_timestamps as Record<string, string[]>;
    const allTimestamps: Date[] = [];
    
    Object.values(timestamps).forEach((arr) => {
      if (Array.isArray(arr)) {
        arr.forEach((ts) => {
          const date = new Date(ts);
          if (!isNaN(date.getTime())) {
            allTimestamps.push(date);
          }
        });
      }
    });

    if (allTimestamps.length === 0) return 0;
    
    const latestTimestamp = Math.max(...allTimestamps.map(d => d.getTime()));
    const now = Date.now();
    return Math.floor((now - latestTimestamp) / (1000 * 60));
  }, [entry.counter_timestamps]);

  // Check if entry is likely accidental
  const isLikelyAccidental = useMemo(() => {
    const totalTaps = 
      (entry.doors_knocked ?? 0) +
      (entry.decision_makers ?? 0) +
      (entry.pitches ?? 0) +
      (entry.transitions ?? 0) +
      (entry.presentations ?? 0) +
      (entry.closes ?? 0);
    
    const hasResults = (entry.fp_plus ?? 0) > 0 || (entry.prmr ?? 0) > 0 || (entry.closes ?? 0) > 0;
    const hoursSinceLastTap = minutesSinceLastTap / 60;

    // Check if all taps are within a short window (30 min)
    const timestamps = entry.counter_timestamps as Record<string, string[]> | null;
    let allTapsInShortWindow = true;
    
    if (timestamps) {
      const allTimes: number[] = [];
      Object.values(timestamps).forEach((arr) => {
        if (Array.isArray(arr)) {
          arr.forEach((ts) => {
            const date = new Date(ts);
            if (!isNaN(date.getTime())) {
              allTimes.push(date.getTime());
            }
          });
        }
      });

      if (allTimes.length > 1) {
        const minTime = Math.min(...allTimes);
        const maxTime = Math.max(...allTimes);
        const windowMinutes = (maxTime - minTime) / (1000 * 60);
        allTapsInShortWindow = windowMinutes <= 30;
      }
    }

    return totalTaps < 5 && !hasResults && hoursSinceLastTap > 6 && allTapsInShortWindow;
  }, [entry, minutesSinceLastTap]);

  // Build summary of what will be discarded
  const discardSummary = useMemo(() => {
    const items: string[] = [];
    if ((entry.doors_knocked ?? 0) > 0) items.push(`${entry.doors_knocked} door${entry.doors_knocked === 1 ? '' : 's'} knocked`);
    if ((entry.decision_makers ?? 0) > 0) items.push(`${entry.decision_makers} decision maker${entry.decision_makers === 1 ? '' : 's'}`);
    if ((entry.pitches ?? 0) > 0) items.push(`${entry.pitches} pitch${entry.pitches === 1 ? '' : 'es'}`);
    if ((entry.transitions ?? 0) > 0) items.push(`${entry.transitions} transition${entry.transitions === 1 ? '' : 's'}`);
    if ((entry.presentations ?? 0) > 0) items.push(`${entry.presentations} presentation${entry.presentations === 1 ? '' : 's'}`);
    if ((entry.closes ?? 0) > 0) items.push(`${entry.closes} close${entry.closes === 1 ? '' : 's'}`);
    return items;
  }, [entry]);

  // Get timestamp of first activity for display
  const firstActivityTime = useMemo(() => {
    if (!entry.counter_timestamps) return null;
    
    const timestamps = entry.counter_timestamps as Record<string, string[]>;
    const allTimestamps: Date[] = [];
    
    Object.values(timestamps).forEach((arr) => {
      if (Array.isArray(arr)) {
        arr.forEach((ts) => {
          const date = new Date(ts);
          if (!isNaN(date.getTime())) {
            allTimestamps.push(date);
          }
        });
      }
    });

    if (allTimestamps.length === 0) return null;
    
    const earliest = new Date(Math.min(...allTimestamps.map(d => d.getTime())));
    return earliest.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }, [entry.counter_timestamps]);

  const handleDiscardClick = () => {
    setDiscardSheetOpen(true);
  };

  const handleConfirmDiscard = () => {
    setDiscardSheetOpen(false);
    onDiscard();
  };

  const totalTaps = 
    (entry.doors_knocked ?? 0) +
    (entry.decision_makers ?? 0) +
    (entry.pitches ?? 0) +
    (entry.transitions ?? 0) +
    (entry.presentations ?? 0) +
    (entry.closes ?? 0);

  return (
    <>
      <Card className="border-orange-500/40 bg-gradient-to-br from-orange-500/10 to-transparent animate-in fade-in slide-in-from-top-2 duration-500">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-orange-500/20">
              <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 animate-[pulse_2s_ease-in-out_infinite]" />
            </div>
            <div className="flex-1 min-w-0">
              {isLikelyAccidental ? (
                <>
                  <h3 className="font-semibold text-base">Looks like an incomplete session</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    This entry has only {totalTaps} tap{totalTaps === 1 ? '' : 's'} from earlier today
                  </p>
                  <div className="flex gap-2 mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDiscardClick}
                      className="border-destructive/50 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4 mr-1.5" />
                      Discard Entry
                    </Button>
                    <Button size="sm" onClick={onSave}>
                      Save Anyway
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="font-semibold text-base">Time to Save Your Day!</h3>
                  <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    You haven't logged activity in {minutesSinceLastTap} minute{minutesSinceLastTap === 1 ? '' : 's'}
                  </p>
                  <Button size="sm" className="mt-3" onClick={onSave}>
                    Save Now
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Discard Confirmation Sheet */}
      <Sheet open={discardSheetOpen} onOpenChange={setDiscardSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>Discard this entry?</SheetTitle>
            <SheetDescription>
              This action cannot be undone.
            </SheetDescription>
          </SheetHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-2">You're about to discard:</p>
            <ul className="space-y-1 text-sm">
              {discardSummary.map((item, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>{item}</span>
                </li>
              ))}
              {firstActivityTime && (
                <li className="flex items-center gap-2 text-muted-foreground">
                  <span>•</span>
                  <span>Logged at {firstActivityTime}</span>
                </li>
              )}
            </ul>
          </div>
          <div className="flex gap-3 mt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setDiscardSheetOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleConfirmDiscard}
            >
              Discard
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};