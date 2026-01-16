import { Package, CreditCard, Shield, Home, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { hapticMedium } from "@/utils/haptics";
import type { PackageType } from "./types";
import { PACKAGE_CONFIGS } from "./types";

interface PackageTypeSelectorProps {
  onSelect: (type: PackageType) => void;
}

const packages = [
  {
    id: 'premium' as PackageType,
    label: 'Premium Kit',
    description: 'Full financing options',
    detail: 'Panel $1,799 • Service $24.99-$59.99',
    icon: Package,
    available: true,
    accent: 'from-primary/20 to-primary/5',
  },
  {
    id: 'non-premium' as PackageType,
    label: 'Non-Premium Kit',
    description: 'Credit or equipment flexibility',
    detail: 'Panel $599 • Service $44.99-$59.99',
    icon: Shield,
    available: true,
    accent: 'from-blue-500/20 to-blue-500/5',
  },
  {
    id: 'pay-in-four' as PackageType,
    label: 'Pay in Four',
    description: '4 equal payments',
    detail: 'Split into 4 installments',
    icon: CreditCard,
    available: false,
    accent: 'from-emerald-500/20 to-emerald-500/5',
  },
  {
    id: 'home-protect' as PackageType,
    label: 'Home Protect',
    description: 'Protection plan',
    detail: 'Comprehensive coverage',
    icon: Home,
    available: false,
    accent: 'from-amber-500/20 to-amber-500/5',
  },
];

export const PackageTypeSelector = ({ onSelect }: PackageTypeSelectorProps) => {
  return (
    <div className="space-y-3">
      {packages.map((pkg) => {
        const Icon = pkg.icon;
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
              "relative w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-200",
              "active:scale-[0.98]",
              isDisabled 
                ? "opacity-50 cursor-not-allowed border-border" 
                : "border-border hover:border-primary hover:shadow-lg hover:shadow-primary/10"
            )}
          >
            {/* Icon */}
            <div className={cn(
              "w-14 h-14 rounded-xl flex items-center justify-center bg-gradient-to-br flex-shrink-0",
              pkg.accent
            )}>
              <Icon className="w-7 h-7 text-foreground" />
            </div>

            {/* Content */}
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-base">{pkg.label}</h3>
                {isDisabled && (
                  <Badge variant="secondary" className="text-[10px] px-2">
                    Coming Soon
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {pkg.description}
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                {pkg.detail}
              </p>
            </div>

            {/* Arrow */}
            {!isDisabled && (
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            )}
          </button>
        );
      })}
    </div>
  );
};
