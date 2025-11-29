import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
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
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="pb-safe">
        <DrawerHeader className="mb-6">
          <DrawerTitle>Reset All Counters?</DrawerTitle>
          <DrawerDescription>
            This will reset all today's counters back to 0. This action cannot be undone.
          </DrawerDescription>
        </DrawerHeader>
        
        <div className="flex flex-col gap-3">
          <Button
            onClick={handleConfirm}
            disabled={isResetting}
            variant="destructive"
            className="w-full py-6 text-lg font-semibold"
            size="lg"
          >
            {isResetting ? "Resetting..." : "Reset"}
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
      </DrawerContent>
    </Drawer>
  );
};
