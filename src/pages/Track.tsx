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
    <div className="h-screen bg-background flex flex-col overflow-hidden touch-none">
      {/* Header */}
      <div className="bg-background px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-bold text-foreground">Today's Progress</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleReset}
            disabled={isResetting}
            className="h-10 w-10"
          >
            <RotateCcw className="h-5 w-5" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Tap to add, swipe down to subtract
        </p>
      </div>

      {/* Counter Grid - Fills available space */}
      <div className="flex-1 px-4 pb-4 overflow-hidden">
        <QTallyGrid
          entry={entry}
          onCounterChange={handleCounterChange}
        />
      </div>

      {/* Save Button - Fixed above bottom nav */}
      <div className="flex-shrink-0 px-4 pb-24">
        <Button
          onClick={() => setIsSaveSheetOpen(true)}
          className="w-full py-6 text-lg font-semibold shadow-lg"
          size="lg"
        >
          💾 Save Today's Work
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