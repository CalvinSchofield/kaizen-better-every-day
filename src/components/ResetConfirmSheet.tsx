import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

interface ResetConfirmSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isResetting: boolean;
}

export const ResetConfirmSheet = ({ open, onOpenChange, onConfirm, isResetting }: ResetConfirmSheetProps) => {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="pb-safe">
        <SheetHeader className="mb-6">
          <SheetTitle>Reset All Counters?</SheetTitle>
          <SheetDescription>
            This will reset all today's counters back to 0. This action cannot be undone.
          </SheetDescription>
        </SheetHeader>
        
        <div className="flex flex-col gap-3">
          <Button
            onClick={handleConfirm}
            disabled={isResetting}
            variant="destructive"
            className="w-full py-6 text-lg font-semibold"
            size="lg"
          >
            {isResetting ? "Resetting..." : "Reset to 0"}
          </Button>
          <Button
            onClick={() => onOpenChange(false)}
            variant="outline"
            className="w-full py-6 text-lg font-semibold"
            size="lg"
          >
            Cancel
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
