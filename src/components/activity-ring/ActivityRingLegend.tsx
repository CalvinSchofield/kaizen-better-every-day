import { cn } from "@/lib/utils";
import { Info } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { hapticLight } from "@/utils/haptics";

interface LegendItemProps {
  color: string;
  label: string;
  dashed?: boolean;
  thin?: boolean;
}

const LegendItem = ({ color, label, dashed, thin }: LegendItemProps) => (
  <div className="flex items-center gap-3">
    <div 
      className={cn(
        "rounded-sm flex-shrink-0",
        thin ? "w-1 h-5" : "w-5 h-5",
        dashed && "border-2 border-dashed bg-transparent"
      )}
      style={{ 
        backgroundColor: dashed ? 'transparent' : color,
        borderColor: dashed ? color : undefined,
      }}
    />
    <span className="text-sm font-medium">{label}</span>
  </div>
);

interface ActivityRingLegendProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ActivityRingLegend = ({ open, onOpenChange }: ActivityRingLegendProps) => {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[50vh]">
        <DrawerHeader className="border-b pb-3">
          <DrawerTitle>Activity Ring Legend</DrawerTitle>
        </DrawerHeader>
        <div className="p-4 space-y-4">
          <LegendItem color="hsl(142, 76%, 45%)" label="Sale (time in-home)" />
          <LegendItem color="hsl(45, 90%, 55%)" label="Presentation (no sale)" />
          <LegendItem color="hsl(45, 90%, 55%)" label="Transition (entered home)" thin />
          <LegendItem color="hsl(210, 80%, 55%)" label="Knocking" />
          <LegendItem color="hsl(0, 0%, 30%)" label="Gap (inactive)" />
          <LegendItem color="hsl(35, 90%, 50%)" label="Break" dashed />
        </div>
      </DrawerContent>
    </Drawer>
  );
};

// Separate trigger button component for header placement
interface LegendTriggerButtonProps {
  onClick: () => void;
  className?: string;
}

export const LegendTriggerButton = ({ onClick, className }: LegendTriggerButtonProps) => (
  <Button
    variant="ghost"
    size="icon"
    className={cn("h-8 w-8", className)}
    onClick={() => {
      hapticLight();
      onClick();
    }}
    aria-label="Show legend"
  >
    <Info className="w-4 h-4" />
  </Button>
);
