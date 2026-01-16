import { Package, CreditCard, Shield, Home } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { hapticMedium } from "@/utils/haptics";
import type { PackageType } from "./types";

interface PackageTypeSelectorProps {
  selected: PackageType | null;
  onSelect: (type: PackageType) => void;
}

const packages = [
  {
    id: 'premium' as PackageType,
    label: 'Premium Kit',
    description: 'Full financing, panel $1,799',
    icon: Package,
    available: true,
  },
  {
    id: 'non-premium' as PackageType,
    label: 'Non-Premium',
    description: 'Panel $599, limited financing',
    icon: Shield,
    available: true,
  },
  {
    id: 'pay-in-four' as PackageType,
    label: 'Pay in Four',
    description: '4 equal payments',
    icon: CreditCard,
    available: false,
  },
  {
    id: 'home-protect' as PackageType,
    label: 'Home Protect',
    description: 'Protection plan',
    icon: Home,
    available: false,
  },
];

export const PackageTypeSelector = ({ selected, onSelect }: PackageTypeSelectorProps) => {
  return (
    <div className="grid grid-cols-2 gap-3">
      {packages.map((pkg) => {
        const Icon = pkg.icon;
        const isSelected = selected === pkg.id;
        const isDisabled = !pkg.available;

        return (
          <button
            key={pkg.id}
            onClick={() => {
              if (!isDisabled) {
                hapticMedium();
                onSelect(pkg.id);
              }
            }}
            disabled={isDisabled}
            className={cn(
              "relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all duration-200",
              "active:scale-[0.97]",
              isDisabled && "opacity-50 cursor-not-allowed",
              isSelected
                ? "border-primary bg-primary/10 shadow-lg shadow-primary/20"
                : "border-border bg-card hover:border-primary/50 hover:bg-accent"
            )}
          >
            {isDisabled && (
              <Badge 
                variant="secondary" 
                className="absolute -top-2 -right-2 text-[10px] px-2"
              >
                Coming Soon
              </Badge>
            )}
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
              isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
            )}>
              <Icon className="w-6 h-6" />
            </div>
            <div className="text-center">
              <p className={cn(
                "font-semibold text-sm",
                isSelected && "text-primary"
              )}>
                {pkg.label}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {pkg.description}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
};
