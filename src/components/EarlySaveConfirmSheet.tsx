import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Sun } from "lucide-react";

interface EarlySaveConfirmSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onKeepWorking: () => void;
  currentTime: string; // formatted time like "3:42 PM"
}

export const EarlySaveConfirmSheet = ({ 
  open, 
  onOpenChange, 
  onConfirm, 
  onKeepWorking,
  currentTime 
}: EarlySaveConfirmSheetProps) => {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="pb-safe">
        <DrawerHeader className="mb-4">
          <div className="flex items-center gap-2 justify-center mb-2">
            <Sun className="h-6 w-6 text-amber-500" />
          </div>
          <DrawerTitle>Still daylight out there!</DrawerTitle>
          <DrawerDescription>
            It's only {currentTime} — are you sure you're done knocking for the day?
          </DrawerDescription>
        </DrawerHeader>
        
        <div className="px-4 text-sm text-muted-foreground mb-6 text-center">
          Once you save, your counters will reset to 0 for the next day.
        </div>
        
        <div className="flex flex-col gap-3 px-4">
          <Button
            onClick={() => {
              onKeepWorking();
              onOpenChange(false);
            }}
            variant="default"
            className="w-full py-6 text-lg font-semibold"
            size="lg"
          >
            Keep Working
          </Button>
          <Button
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            variant="outline"
            className="w-full py-6 text-lg font-semibold"
            size="lg"
          >
            Yes, I'm Done
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
