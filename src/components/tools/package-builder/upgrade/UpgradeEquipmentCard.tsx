import { Plus, Minus, DoorOpen, Move, Volume2, Lightbulb, Warehouse, Lock, Video, VideoOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticLight } from "@/utils/haptics";
import type { UpgradeEquipmentItem } from "./upgradeTypes";

interface UpgradeEquipmentCardProps {
  item: UpgradeEquipmentItem;
  quantity: number;
  newCameraCount: number;
  onQuantityChange: (delta: number) => void;
  onNewCameraCountChange: (delta: number) => void;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  DoorOpen,
  Move,
  Volume2,
  Lightbulb,
  Warehouse,
  Lock,
};

export const UpgradeEquipmentCard = ({ 
  item, 
  quantity, 
  newCameraCount,
  onQuantityChange,
  onNewCameraCountChange,
}: UpgradeEquipmentCardProps) => {
  const Icon = item.icon ? iconMap[item.icon] : null;
  const hasQuantity = quantity > 0;
  const canDecrease = quantity > 0;
  // Show video fee control only for items that incur fee AND are not "always new" (like indoor)
  const showVideoFeeControl = item.incursVideoFee && quantity > 0 && !item.alwaysNewCamera;
  const showAlwaysNewBadge = item.alwaysNewCamera && quantity > 0;

  const handleDecrease = () => {
    if (canDecrease) {
      hapticLight();
      onQuantityChange(-1);
    }
  };

  const handleIncrease = () => {
    hapticLight();
    onQuantityChange(1);
  };

  const handleVideoFeeDecrease = () => {
    if (newCameraCount > 0) {
      hapticLight();
      onNewCameraCountChange(-1);
    }
  };

  const handleVideoFeeIncrease = () => {
    if (newCameraCount < quantity) {
      hapticLight();
      onNewCameraCountChange(1);
    }
  };

  return (
    <div
      className={cn(
        "relative flex flex-col items-center p-3 pt-4 rounded-2xl border-2 transition-all duration-200 min-w-[110px]",
        hasQuantity
          ? "border-primary bg-primary/5"
          : "border-border bg-card"
      )}
    >
      {/* Quantity badge */}
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
      <p className="text-[10px] text-muted-foreground mb-2">
        ${item.price.toFixed(0)}
      </p>

      {/* Quantity controls */}
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
          className="w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-95 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Video Fee Control - only for cameras that incur fee and are not always new */}
      {showVideoFeeControl && (
        <div className="mt-3 pt-2 border-t border-border/50 w-full">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Video className="w-3 h-3 text-emerald-500" />
            <span className="text-[10px] text-muted-foreground">+$5/mo</span>
          </div>
          <div className="flex items-center justify-center gap-1">
            <button
              onClick={handleVideoFeeDecrease}
              disabled={newCameraCount <= 0}
              className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center transition-all active:scale-95",
                newCameraCount > 0
                  ? "bg-muted hover:bg-muted/80"
                  : "opacity-30 cursor-not-allowed"
              )}
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className={cn(
              "text-xs font-bold min-w-[20px] text-center",
              newCameraCount > 0 ? "text-emerald-500" : "text-muted-foreground"
            )}>
              {newCameraCount}
            </span>
            <button
              onClick={handleVideoFeeIncrease}
              disabled={newCameraCount >= quantity}
              className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center transition-all active:scale-95",
                newCameraCount < quantity
                  ? "bg-emerald-500 text-white hover:bg-emerald-600"
                  : "opacity-30 cursor-not-allowed"
              )}
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
          <p className="text-[9px] text-center text-muted-foreground mt-1">
            new cams
          </p>
        </div>
      )}
      
      {/* Always-new badge for indoor cameras */}
      {showAlwaysNewBadge && (
        <div className="mt-3 pt-2 border-t border-border/50 w-full">
          <div className="flex items-center justify-center gap-1">
            <Video className="w-3 h-3 text-emerald-500" />
            <span className="text-[10px] text-emerald-500 font-medium">+$5/mo each</span>
          </div>
        </div>
      )}
    </div>
  );
};
