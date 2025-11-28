import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { useDailyEntry } from "@/hooks/useDailyEntry";
import { QTallyGrid } from "@/components/QTallyGrid";
import { SaveEntrySheet } from "@/components/SaveEntrySheet";

const Track = () => {
  const { entry, updateCounter, finalizeEntry, resetEntry, isFinalizing, isResetting } = useDailyEntry();
  const [isSaveSheetOpen, setIsSaveSheetOpen] = useState(false);

  const today = new Date();
  const formattedDate = today.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });

  const handleCounterChange = (field: string, value: number) => {
    updateCounter({ [field]: Math.max(0, value) });
  };

  const handleReset = () => {
    if (confirm('Reset all counters to 0?')) {
      resetEntry();
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary/10 to-accent p-6 rounded-b-3xl shadow-md">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-foreground">Today's Progress</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">{formattedDate}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleReset}
              disabled={isResetting}
              className="h-8 w-8"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Tap to add, swipe down to subtract
        </p>
      </div>

      {/* Counter Grid */}
      <div className="p-4">
        <QTallyGrid
          entry={entry}
          onCounterChange={handleCounterChange}
        />
      </div>

      {/* Save Button */}
      <div className="fixed bottom-24 left-0 right-0 px-4">
        <Button
          onClick={() => setIsSaveSheetOpen(true)}
          className="w-full py-6 text-lg font-semibold shadow-lg"
          size="lg"
        >
          Save Today's Work →
        </Button>
      </div>

      {/* Save Entry Sheet */}
      <SaveEntrySheet
        open={isSaveSheetOpen}
        onOpenChange={setIsSaveSheetOpen}
        entry={entry}
        onSave={finalizeEntry}
        isSaving={isFinalizing}
      />
    </div>
  );
};

export default Track;