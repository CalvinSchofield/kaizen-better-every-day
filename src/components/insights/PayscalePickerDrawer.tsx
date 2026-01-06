import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { getAllTiers, getTier } from '@/utils/payscaleCalculator';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PayscalePickerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedFp: number;
  currentFp: number;
  onSelect: (fp: number) => void;
}

export const PayscalePickerDrawer = ({
  open,
  onOpenChange,
  selectedFp,
  currentFp,
  onSelect,
}: PayscalePickerDrawerProps) => {
  const allTiers = getAllTiers();
  const currentTier = getTier(currentFp);
  
  // Only show tiers at or above user's current tier
  const availableTiers = allTiers.filter(tier => tier.min >= currentTier.min);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="select-none">
        <DrawerHeader>
          <DrawerTitle className="text-center">Select Payscale Tier</DrawerTitle>
        </DrawerHeader>
        <div className="p-4 space-y-2 pb-8 max-h-[60vh] overflow-y-auto">
          {availableTiers.map((tier) => {
            const isCurrentTier = tier.min === currentTier.min;
            const isSelected = tier.min === selectedFp || (isCurrentTier && selectedFp === 0);
            
            return (
              <button
                key={tier.min}
                onClick={() => {
                  onSelect(tier.min);
                  onOpenChange(false);
                }}
                className={cn(
                  "w-full flex items-center justify-between p-4 rounded-xl transition-colors",
                  isSelected && "bg-primary/10 border-2 border-primary",
                  !isSelected && "bg-muted/50 hover:bg-muted",
                )}
              >
                <div className="flex items-center gap-3">
                  {isSelected ? (
                    <Check className="w-4 h-4 text-primary" />
                  ) : (
                    <div className="w-4 h-4" />
                  )}
                  <div className="text-left">
                    <div className="font-semibold">
                      {tier.min === 0 ? '0' : tier.min}+ FP+
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {isCurrentTier && '(Your current tier)'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={cn(
                    "text-xl font-bold",
                    isSelected ? "text-primary" : "text-foreground"
                  )}>
                    ${tier.rate}
                  </div>
                  <div className="text-xs text-muted-foreground">per FP+</div>
                </div>
              </button>
            );
          })}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
