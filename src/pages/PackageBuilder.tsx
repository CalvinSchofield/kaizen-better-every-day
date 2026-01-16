import { useState, useMemo, useCallback } from "react";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { hapticMedium } from "@/utils/haptics";
import { motion, AnimatePresence } from "framer-motion";
import { PackageTypeSelector } from "@/components/tools/package-builder/PackageTypeSelector";
import { EquipmentConfigurator } from "@/components/tools/package-builder/EquipmentConfigurator";
import { ConfigurationOptions } from "@/components/tools/package-builder/ConfigurationOptions";
import { PriceSummary } from "@/components/tools/package-builder/PriceSummary";
import { PackagePresets, type PackagePreset } from "@/components/tools/package-builder/PackagePresets";
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

  // Handle package selection - navigate to config page
  const handlePackageSelect = useCallback((type: PackageType) => {
    if (type === 'premium' || type === 'non-premium') {
      setPackageType(type);
      setQuantities(getDefaultQuantities());
      setServiceRate(PACKAGE_CONFIGS[type].serviceDefault);
    }
  }, []);

  // Handle preset selection - go to premium with preset equipment
  const handlePresetSelect = useCallback((preset: PackagePreset) => {
    setPackageType('premium');
    setQuantities(preset.equipment);
    setInstallFee(preset.installFee);
    setServiceRate(PACKAGE_CONFIGS['premium'].serviceDefault);
  }, []);

  // Go back to package selection
  const handleBack = useCallback(() => {
    hapticMedium();
    setPackageType(null);
  }, []);

  // Update quantity with constraints
  const handleQuantityChange = useCallback((itemId: string, delta: number) => {
    setQuantities(prev => {
      const item = EQUIPMENT_LIST.find(i => i.id === itemId);
      if (!item) return prev;
      
      const currentQty = prev[itemId] || 0;
      let newQty = Math.max(0, currentQty + delta);
      
      if (item.maxQuantity && newQty > item.maxQuantity) {
        return prev;
      }

      // Constraint: Spotlights can't exceed outdoor cameras
      if (itemId === 'spotlight-pro') {
        const outdoorCount = prev['outdoor-pro'] || 0;
        if (newQty > outdoorCount) {
          newQty = outdoorCount;
        }
      }

      // Constraint: DVR requires at least one camera
      if (itemId === 'dvr' && newQty > 0) {
        const cameraIds = ['doorbell-pro', 'outdoor-pro', 'spotlight-pro', 'indoor-pro'];
        const totalCameras = cameraIds.reduce((sum, id) => sum + (prev[id] || 0), 0);
        if (totalCameras === 0) {
          return prev; // Can't add DVR without cameras
        }
      }

      // Constraint: When reducing outdoor cameras, also reduce spotlights if needed
      if (itemId === 'outdoor-pro' && delta < 0) {
        const spotlightCount = prev['spotlight-pro'] || 0;
        if (spotlightCount > newQty) {
          const updatedQuantities = { ...prev, [itemId]: newQty, 'spotlight-pro': newQty };
          if (newQty === 0) {
            delete updatedQuantities[itemId];
            if (newQty === 0) delete updatedQuantities['spotlight-pro'];
          }
          return updatedQuantities;
        }
      }

      // Constraint: When removing last camera, also remove DVR
      if (['doorbell-pro', 'outdoor-pro', 'spotlight-pro', 'indoor-pro'].includes(itemId) && delta < 0) {
        const cameraIds = ['doorbell-pro', 'outdoor-pro', 'spotlight-pro', 'indoor-pro'];
        const totalCameras = cameraIds.reduce((sum, id) => {
          if (id === itemId) return sum + newQty;
          return sum + (prev[id] || 0);
        }, 0);
        if (totalCameras === 0 && prev['dvr']) {
          const { dvr, [itemId]: _, ...rest } = prev;
          return rest;
        }
      }
      
      if (newQty === 0) {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [itemId]: newQty };
    });
  }, []);

  // Reset to defaults
  const handleReset = useCallback(() => {
    hapticMedium();
    if (packageType === 'premium' || packageType === 'non-premium') {
      setQuantities(getDefaultQuantities());
      setInstallFee(399);
      setServiceRate(PACKAGE_CONFIGS[packageType].serviceDefault);
      setWarrantyEnabled(true);
    }
  }, [packageType]);

  // Calculate prices
  const prices = useMemo(() => {
    if (!packageType || (packageType !== 'premium' && packageType !== 'non-premium')) {
      return { equipmentTotal: 0, equipmentMonthly: 0, warrantyAmount: 0, videoServiceFee: 0, cameraCount: 0, totalMonthly: 0 };
    }

    const config = PACKAGE_CONFIGS[packageType];
    
    // Calculate equipment total (including panel)
    let equipmentTotal = config.panelPrice;
    
    // Count cameras for video service fee (only doorbell, outdoor, indoor - not spotlights or DVR)
    const videoServiceCameraIds = ['doorbell-pro', 'outdoor-pro', 'indoor-pro'];
    let cameraCount = 0;
    
    EQUIPMENT_LIST.forEach(item => {
      const qty = quantities[item.id] || 0;
      equipmentTotal += item.price * qty;
      
      // Count only cameras that incur video service fee
      if (videoServiceCameraIds.includes(item.id)) {
        cameraCount += qty;
      }
    });

    // Add install fee
    equipmentTotal += installFee;

    // Equipment monthly (60 month financing)
    const equipmentMonthly = equipmentTotal / 60;

    // Video service fee ($5 per camera)
    const videoServiceFee = cameraCount * 5;

    // Warranty
    const warrantyAmount = warrantyEnabled ? config.warrantyPrice : 0;

    // Total monthly
    const totalMonthly = equipmentMonthly + serviceRate + videoServiceFee + warrantyAmount;

    return { equipmentTotal, equipmentMonthly, warrantyAmount, videoServiceFee, cameraCount, totalMonthly };
  }, [packageType, quantities, installFee, serviceRate, warrantyEnabled]);

  const isConfigurable = packageType === 'premium' || packageType === 'non-premium';
  const packageLabel = packageType === 'premium' ? 'Premium Kit' : 'Non-Premium Kit';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={packageType ? handleBack : () => navigate('/tools')}
            className="rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold">
            {packageType ? packageLabel : 'Package Builder'}
          </h1>
          {isConfigurable ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleReset}
              className="rounded-full"
            >
              <RotateCcw className="w-5 h-5" />
            </Button>
          ) : (
            <div className="w-10" /> // Spacer for centering
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!packageType ? (
          // Page 1: Package Selection
          <motion.div
            key="selection"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="max-w-lg mx-auto px-4 py-6"
          >
            <div className="mb-6">
              <h2 className="text-xl font-bold mb-1">Choose a Package</h2>
              <p className="text-sm text-muted-foreground">
                Select the financing option for your customer
              </p>
            </div>
            <PackageTypeSelector onSelect={handlePackageSelect} />
            
            {/* Preset Packages */}
            <PackagePresets onSelect={handlePresetSelect} />
          </motion.div>
        ) : isConfigurable ? (
          // Page 2: Equipment Configuration
          <motion.div
            key="config"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="max-w-lg mx-auto px-4 py-6 pb-40 space-y-6"
          >
            {/* Equipment Selection */}
            <EquipmentConfigurator
              packageType={packageType}
              quantities={quantities}
              onQuantityChange={handleQuantityChange}
            />

            {/* Configuration Options */}
            <ConfigurationOptions
              packageType={packageType}
              installFee={installFee}
              onInstallFeeChange={setInstallFee}
              serviceRate={serviceRate}
              onServiceRateChange={setServiceRate}
              warrantyEnabled={warrantyEnabled}
              onWarrantyChange={setWarrantyEnabled}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Sticky Price Summary - only on config page */}
      {isConfigurable && (
        <PriceSummary
          equipmentMonthly={prices.equipmentMonthly}
          serviceRate={serviceRate}
          warrantyAmount={prices.warrantyAmount}
          videoServiceFee={prices.videoServiceFee}
          cameraCount={prices.cameraCount}
          totalMonthly={prices.totalMonthly}
        />
      )}
    </div>
  );
};

export default PackageBuilder;
