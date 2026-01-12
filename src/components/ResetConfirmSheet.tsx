import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface ResetConfirmSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isResetting: boolean;
  entrySummary?: {
    doors: number;
    decisionMakers: number;
    pitches: number;
    transitions: number;
    presentations: number;
    closes: number;
    salesCount: number; // Number of sales in sales_log
  };
}

export const ResetConfirmSheet = ({ 
  open, 
  onOpenChange, 
  onConfirm, 
  isResetting,
  entrySummary 
}: ResetConfirmSheetProps) => {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  const hasSales = entrySummary && entrySummary.salesCount > 0;
  
  const hasActivity = entrySummary && (
    entrySummary.doors > 0 ||
    entrySummary.decisionMakers > 0 ||
    entrySummary.pitches > 0 ||
    entrySummary.transitions > 0 ||
    entrySummary.presentations > 0 ||
    entrySummary.closes > 0 ||
    entrySummary.salesCount > 0
  );

  // Build summary text - prioritize sales!
  const summaryParts: string[] = [];
  if (entrySummary) {
    // ALWAYS show sales first - this is critical data
    if (entrySummary.salesCount > 0) summaryParts.push(`${entrySummary.salesCount} sale${entrySummary.salesCount > 1 ? 's' : ''}`);
    if (entrySummary.doors > 0) summaryParts.push(`${entrySummary.doors} doors`);
    if (entrySummary.presentations > 0) summaryParts.push(`${entrySummary.presentations} presentations`);
    if (entrySummary.closes > 0 && entrySummary.closes !== entrySummary.salesCount) summaryParts.push(`${entrySummary.closes} closes`);
    if (summaryParts.length === 0) {
      if (entrySummary.pitches > 0) summaryParts.push(`${entrySummary.pitches} pitches`);
      if (entrySummary.transitions > 0) summaryParts.push(`${entrySummary.transitions} transitions`);
      if (entrySummary.decisionMakers > 0) summaryParts.push(`${entrySummary.decisionMakers} DMs`);
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="pb-safe">
        <DrawerHeader className="mb-4">
          {(hasActivity || hasSales) && (
            <div className="flex items-center gap-2 justify-center mb-2">
              <AlertTriangle className={`h-6 w-6 ${hasSales ? 'text-destructive' : 'text-amber-500'}`} />
            </div>
          )}
          <DrawerTitle>{hasSales ? '⚠️ You Have Sales Logged!' : 'Reset All Counters?'}</DrawerTitle>
          <DrawerDescription>
            {hasSales 
              ? "WARNING: This will permanently delete your logged sales AND all counters."
              : hasActivity 
                ? "You have work logged today. Resetting will erase it permanently."
                : "This will reset all today's counters back to 0."}
          </DrawerDescription>
        </DrawerHeader>
        
        {/* Show summary of what will be lost */}
        {hasActivity && summaryParts.length > 0 && (
          <div className="px-4 mb-6">
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4">
              <p className="text-sm font-medium text-destructive mb-1">You will lose:</p>
              <p className="text-sm text-muted-foreground">{summaryParts.join(', ')}</p>
            </div>
          </div>
        )}
        
        <div className="flex flex-col gap-3 px-4">
          <Button
            onClick={() => onOpenChange(false)}
            variant="default"
            className="w-full py-6 text-lg font-semibold"
            size="lg"
          >
            Keep My Data
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isResetting}
            variant="outline"
            className="w-full py-6 text-lg font-semibold text-destructive hover:bg-destructive/10"
            size="lg"
          >
            {isResetting ? "Resetting..." : "Reset Anyway"}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
