import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Sun } from "lucide-react";

interface EarlyEndConfirmSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onKeepWorking: () => void;
  currentTime: string; // formatted time like "3:42 PM"
}

export const EarlyEndConfirmSheet = ({ 
  open, 
  onOpenChange, 
  onConfirm, 
  onKeepWorking,
  currentTime 
}: EarlyEndConfirmSheetProps) => {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="pb-safe">
        <DrawerHeader className="mb-4">
          <div className="flex items-center gap-2 justify-center mb-2">
            <Sun className="h-6 w-6 text-amber-500" />
          </div>
          <DrawerTitle>End work already?</DrawerTitle>
          <DrawerDescription>
            It's only {currentTime} — sun's still out! Are you sure you're done for the day?
          </DrawerDescription>
        </DrawerHeader>
        
        <div className="px-4 text-sm text-muted-foreground mb-6 text-center">
          You can still track breaks and activity until you save your day.
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
