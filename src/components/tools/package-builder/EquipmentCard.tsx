import { Plus, Minus, DoorOpen, Move, Volume2, Lightbulb, Warehouse, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticLight } from "@/utils/haptics";
import type { EquipmentItem } from "./types";

interface EquipmentCardProps {
  item: EquipmentItem;
  quantity: number;
  onQuantityChange: (delta: number) => void;
  isPanel?: boolean;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  DoorOpen,
  Move,
  Volume2,
  Lightbulb,
  Warehouse,
  Lock,
};

export const EquipmentCard = ({ 
  item, 
  quantity, 
  onQuantityChange,
  isPanel = false,
}: EquipmentCardProps) => {
  const Icon = item.icon ? iconMap[item.icon] : null;
  const hasQuantity = quantity > 0;
  const canDecrease = isPanel ? false : quantity > 0;
  const canIncrease = item.maxQuantity ? quantity < item.maxQuantity : true;

  const handleDecrease = () => {
    if (canDecrease) {
      hapticLight();
      onQuantityChange(-1);
    }
  };

  const handleIncrease = () => {
    if (canIncrease) {
      hapticLight();
      onQuantityChange(1);
    }
  };

  return (
    <div
      className={cn(
        "relative flex flex-col items-center p-3 pt-4 rounded-2xl border-2 transition-all duration-200 min-w-[100px]",
        hasQuantity
          ? "border-primary bg-primary/5"
          : "border-border bg-card"
      )}
    >
      {/* Quantity badge - positioned inside card for visibility */}
      {hasQuantity && (
        <div className="absolute top-1 right-1 min-w-[22px] h-[22px] px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
          {quantity}
        </div>
      )}

      {/* Image or Icon */}
      <div className="w-14 h-14 rounded-xl overflow-hidden bg-muted flex items-center justify-center mb-2">
        {item.image ? (
          <img 
            src={item.image} 
            alt={item.label}
            className="w-full h-full object-cover"
          />
        ) : Icon ? (
          <Icon className="w-7 h-7 text-muted-foreground" />
        ) : (
          <div className="w-7 h-7 bg-muted-foreground/20 rounded" />
        )}
      </div>

      {/* Label */}
      <p className="text-xs font-medium text-center leading-tight mb-1">
        {item.label}
      </p>

      {/* Price */}
      {!isPanel && (
        <p className="text-[10px] text-muted-foreground mb-2">
          ${item.price.toFixed(0)}
        </p>
      )}

      {/* Quantity controls */}
      {isPanel ? (
        <div className="text-[10px] text-muted-foreground bg-muted px-2 py-1 rounded-full">
          Included
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <button
            onClick={handleDecrease}
            disabled={!canDecrease}
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-95",
              canDecrease
                ? "bg-muted hover:bg-muted/80"
                : "opacity-30 cursor-not-allowed"
            )}
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={handleIncrease}
            disabled={!canIncrease}
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-95",
              canIncrease
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "opacity-30 cursor-not-allowed"
            )}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
