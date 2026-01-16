import { useState, useMemo, useCallback } from "react";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { hapticMedium } from "@/utils/haptics";
import { PackageTypeSelector } from "@/components/tools/package-builder/PackageTypeSelector";
import { EquipmentConfigurator } from "@/components/tools/package-builder/EquipmentConfigurator";
import { ConfigurationOptions } from "@/components/tools/package-builder/ConfigurationOptions";
import { PriceSummary } from "@/components/tools/package-builder/PriceSummary";
import { 
  PACKAGE_CONFIGS, 
  EQUIPMENT_LIST, 
  getDefaultQuantities,
  type PackageType 
} from "@/components/tools/package-builder/types";

const PackageBuilder = () => {
  const navigate = useNavigate();
  
  // State
  const [packageType, setPackageType] = useState<PackageType | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>(getDefaultQuantities());
  const [installFee, setInstallFee] = useState(399);
  const [serviceRate, setServiceRate] = useState(59.99);
  const [warrantyEnabled, setWarrantyEnabled] = useState(true);

  // Reset to defaults when package type changes
  const handlePackageSelect = useCallback((type: PackageType) => {
    setPackageType(type);
    setQuantities(getDefaultQuantities());
    if (type === 'premium' || type === 'non-premium') {
      setServiceRate(PACKAGE_CONFIGS[type].serviceDefault);
    }
  }, []);

  // Update quantity
  const handleQuantityChange = useCallback((itemId: string, delta: number) => {
    setQuantities(prev => {
      const item = EQUIPMENT_LIST.find(i => i.id === itemId);
      if (!item) return prev;
      
      const currentQty = prev[itemId] || 0;
      const newQty = Math.max(0, currentQty + delta);
      
      // Respect max quantity
      if (item.maxQuantity && newQty > item.maxQuantity) {
        return prev;
      }
      
      if (newQty === 0) {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [itemId]: newQty };
    });
  }, []);

  // Reset everything
  const handleReset = useCallback(() => {
    hapticMedium();
    setPackageType(null);
    setQuantities(getDefaultQuantities());
    setInstallFee(399);
    setServiceRate(59.99);
    setWarrantyEnabled(true);
  }, []);

  // Calculate prices
  const prices = useMemo(() => {
    if (!packageType || (packageType !== 'premium' && packageType !== 'non-premium')) {
      return { equipmentTotal: 0, equipmentMonthly: 0, warrantyAmount: 0, totalMonthly: 0 };
    }

    const config = PACKAGE_CONFIGS[packageType];
    
    // Calculate equipment total
    let equipmentTotal = config.panelPrice; // Panel price based on package
    
    EQUIPMENT_LIST.forEach(item => {
      if (item.id === 'panel') return; // Panel already counted
      const qty = quantities[item.id] || 0;
      equipmentTotal += item.price * qty;
    });

    // Add install fee
    equipmentTotal += installFee;

    // Equipment monthly (60 month financing)
    const equipmentMonthly = equipmentTotal / 60;

    // Warranty
    const warrantyAmount = warrantyEnabled ? config.warrantyPrice : 0;

    // Total monthly
    const totalMonthly = equipmentMonthly + serviceRate + warrantyAmount;

    return { equipmentTotal, equipmentMonthly, warrantyAmount, totalMonthly };
  }, [packageType, quantities, installFee, serviceRate, warrantyEnabled]);

  const isConfigurable = packageType === 'premium' || packageType === 'non-premium';

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/tools')}
            className="rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold">Package Builder</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleReset}
            className="rounded-full"
          >
            <RotateCcw className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Package Type Selection */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Select Package Type
          </h2>
          <PackageTypeSelector
            selected={packageType}
            onSelect={handlePackageSelect}
          />
        </div>

        {/* Equipment & Configuration - only show for active packages */}
        {isConfigurable && (
          <>
            {/* Equipment Selection */}
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Equipment
              </h2>
              <EquipmentConfigurator
                packageType={packageType}
                quantities={quantities}
                onQuantityChange={handleQuantityChange}
              />
            </div>

            {/* Configuration Options */}
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Pricing Options
              </h2>
              <ConfigurationOptions
                packageType={packageType}
                installFee={installFee}
                onInstallFeeChange={setInstallFee}
                serviceRate={serviceRate}
                onServiceRateChange={setServiceRate}
                warrantyEnabled={warrantyEnabled}
                onWarrantyChange={setWarrantyEnabled}
              />
            </div>
          </>
        )}

        {/* Empty state for coming soon packages */}
        {packageType && !isConfigurable && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              This package type is coming soon!
            </p>
          </div>
        )}
      </div>

      {/* Sticky Price Summary */}
      {isConfigurable && (
        <PriceSummary
          equipmentMonthly={prices.equipmentMonthly}
          serviceRate={serviceRate}
          warrantyAmount={prices.warrantyAmount}
          totalMonthly={prices.totalMonthly}
        />
      )}
    </div>
  );
};

export default PackageBuilder;
