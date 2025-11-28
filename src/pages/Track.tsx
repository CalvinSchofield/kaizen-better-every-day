import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RotateCcw, Save } from "lucide-react";
import { useDailyEntry } from "@/hooks/useDailyEntry";
import { QTallyGrid } from "@/components/QTallyGrid";
import { SaveEntrySheet } from "@/components/SaveEntrySheet";
import { ResetConfirmSheet } from "@/components/ResetConfirmSheet";

const Track = () => {
  const { entry, updateCounter, finalizeEntry, resetEntry, isFinalizing, isResetting } = useDailyEntry();
  const [isSaveSheetOpen, setIsSaveSheetOpen] = useState(false);
  const [isResetSheetOpen, setIsResetSheetOpen] = useState(false);

  const today = new Date();
  const formattedDate = today.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });

  const handleCounterChange = (field: string, value: number) => {
    updateCounter({ [field]: Math.max(0, value) });
  };

  const handleReset = () => {
    resetEntry();
  };

  return (
    <div className="bg-background flex flex-col overflow-hidden touch-none" style={{ height: 'calc(100vh - 88px)' }}>
      {/* Header */}
      <div className="bg-background px-6 py-4 flex-shrink-0 border-b border-border/40">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Today's Progress</h1>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setIsSaveSheetOpen(true)}
              disabled={isFinalizing}
              className="h-10 px-4 bg-primary hover:bg-primary-dark text-primary-foreground font-semibold shadow-md"
            >
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsResetSheetOpen(true)}
              disabled={isResetting}
              className="h-10 w-10"
            >
              <RotateCcw className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Counter Grid - Fills all available space with equal padding */}
      <div className="flex-1 px-4 pt-4 pb-20 min-h-0 overflow-hidden">
        <QTallyGrid
          entry={entry}
          onCounterChange={handleCounterChange}
        />
      </div>

      {/* Save Entry Sheet */}
      <SaveEntrySheet
        open={isSaveSheetOpen}
        onOpenChange={setIsSaveSheetOpen}
        entry={entry}
        onSave={finalizeEntry}
        isSaving={isFinalizing}
      />

      {/* Reset Confirm Sheet */}
      <ResetConfirmSheet
        open={isResetSheetOpen}
        onOpenChange={setIsResetSheetOpen}
        onConfirm={handleReset}
        isResetting={isResetting}
      />
    </div>
  );
};

export default Track;