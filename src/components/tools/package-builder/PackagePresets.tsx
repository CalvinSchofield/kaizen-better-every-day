import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { hapticMedium } from "@/utils/haptics";
import { Camera, Home, Shield } from "lucide-react";

export interface PackagePreset {
  id: string;
  name: string;
  equipment: Record<string, number>;
  installFee: number;
  icon: 'basic' | 'standard' | 'pro';
}

export const PRESET_PACKAGES: PackagePreset[] = [
  {
    id: 'basic',
    name: 'Basic',
    equipment: {
      'doorbell-pro': 1,
      'dvr': 1,
      'door-window-sensor': 3,
      'motion-sensor': 1,
    },
    installFee: 399,
    icon: 'basic',
  },
  {
    id: 'standard',
    name: 'Standard',
    equipment: {
      'doorbell-pro': 1,
      'outdoor-pro': 2,
      'spotlight-pro': 2,
      'dvr': 1,
      'door-window-sensor': 3,
      'motion-sensor': 1,
    },
    installFee: 399,
    icon: 'standard',
  },
  {
    id: 'pro',
    name: 'Pro',
    equipment: {
      'doorbell-pro': 1,
      'outdoor-pro': 4,
      'spotlight-pro': 4,
      'dvr': 1,
      'indoor-pro': 2,
      'door-window-sensor': 3,
      'motion-sensor': 1,
    },
    installFee: 399,
    icon: 'pro',
  },
];

const IconMap = {
  basic: Camera,
  standard: Home,
  pro: Shield,
};

interface PackagePresetsProps {
  onSelect: (preset: PackagePreset) => void;
}

export const PackagePresets = ({ onSelect }: PackagePresetsProps) => {
  return (
    <div className="mt-8">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Quick Start Packages
      </h3>
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-3 pb-2">
          {PRESET_PACKAGES.map((preset) => {
            const Icon = IconMap[preset.icon];
            const itemCount = Object.values(preset.equipment).reduce((a, b) => a + b, 0);
            
            return (
              <button
                key={preset.id}
                onClick={() => {
                  hapticMedium();
                  onSelect(preset);
                }}
                className={cn(
                  "flex-shrink-0 w-28 p-3 rounded-2xl border-2 border-border",
                  "bg-card hover:border-primary hover:shadow-lg hover:shadow-primary/10",
                  "transition-all duration-200 active:scale-[0.97]"
                )}
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <p className="text-sm font-semibold text-center">{preset.name}</p>
                <p className="text-[10px] text-muted-foreground text-center mt-0.5">
                  {itemCount} items
                </p>
              </button>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
};
