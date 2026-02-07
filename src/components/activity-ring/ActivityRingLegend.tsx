import { cn } from "@/lib/utils";

interface LegendItemProps {
  color: string;
  label: string;
  dashed?: boolean;
  thin?: boolean;
}

const LegendItem = ({ color, label, dashed, thin }: LegendItemProps) => (
  <div className="flex items-center gap-1.5">
    <div 
      className={cn(
        "rounded-sm",
        thin ? "w-1.5 h-3" : "w-3 h-3",
        dashed && "border-2 border-dashed bg-transparent"
      )}
      style={{ 
        backgroundColor: dashed ? 'transparent' : color,
        borderColor: dashed ? color : undefined,
      }}
    />
    <span>{label}</span>
  </div>
);

export const ActivityRingLegend = () => {
  return (
    <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground px-4">
      <LegendItem color="hsl(210, 80%, 55%)" label="Knocking" />
      <LegendItem color="hsl(45, 90%, 55%)" label="Transition" thin />
      <LegendItem color="hsl(45, 90%, 55%)" label="Presenting" />
      <LegendItem color="hsl(142, 76%, 45%)" label="Sale" />
      <LegendItem color="hsl(0, 0%, 30%)" label="Gap" />
      <LegendItem color="hsl(35, 90%, 50%)" label="Break" dashed />
    </div>
  );
};
