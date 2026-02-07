import { cn } from "@/lib/utils";
import { Info } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface LegendItemProps {
  color: string;
  label: string;
  dashed?: boolean;
  thin?: boolean;
}

const LegendItem = ({ color, label, dashed, thin }: LegendItemProps) => (
  <div className="flex items-center gap-2">
    <div 
      className={cn(
        "rounded-sm flex-shrink-0",
        thin ? "w-1 h-4" : "w-4 h-4",
        dashed && "border-2 border-dashed bg-transparent"
      )}
      style={{ 
        backgroundColor: dashed ? 'transparent' : color,
        borderColor: dashed ? color : undefined,
      }}
    />
    <span className="text-sm">{label}</span>
  </div>
);

export const ActivityRingLegend = () => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button 
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors active:scale-95 px-2 py-1 rounded-full bg-muted/30"
          aria-label="Show legend"
        >
          <Info className="w-3.5 h-3.5" />
          <span>Legend</span>
        </button>
      </PopoverTrigger>
      <PopoverContent 
        side="top" 
        className="w-auto p-3 bg-card border-border"
        sideOffset={8}
      >
        <div className="grid gap-2">
          <LegendItem color="hsl(210, 80%, 55%)" label="Knocking" />
          <LegendItem color="hsl(45, 90%, 55%)" label="Transition" thin />
          <LegendItem color="hsl(45, 90%, 55%)" label="Presentation" />
          <LegendItem color="hsl(142, 76%, 45%)" label="Sale" />
          <LegendItem color="hsl(0, 0%, 30%)" label="Gap" />
          <LegendItem color="hsl(35, 90%, 50%)" label="Break" dashed />
        </div>
      </PopoverContent>
    </Popover>
  );
};
