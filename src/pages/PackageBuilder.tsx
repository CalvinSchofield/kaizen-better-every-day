import { useState, useMemo, useCallback } from "react";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { hapticMedium } from "@/utils/haptics";
import { EdgeSwipeContainer } from "@/components/EdgeSwipeContainer";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
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
import { UpgradeEquipmentConfigurator } from "@/components/tools/package-builder/upgrade/UpgradeEquipmentConfigurator";
import { UpgradePriceSummary } from "@/components/tools/package-builder/upgrade/UpgradePriceSummary";
import { 
  UPGRADE_EQUIPMENT_LIST, 
  UPGRADE_CONFIG,
  getUpgradeDefaultQuantities,
  getUpgradeDefaultNewCameraCounts,
} from "@/components/tools/package-builder/upgrade/upgradeTypes";

const PackageBuilder = () => {
  const navigate = useNavigate();
  
  // State for regular packages
  const [packageType, setPackageType] = useState<PackageType | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>(getDefaultQuantities());
  const [installFee, setInstallFee] = useState(399);
  const [serviceRate, setServiceRate] = useState(59.99);
  const [warrantyEnabled, setWarrantyEnabled] = useState(true);
  
  // State for upgrade packages
  const [upgradeQuantities, setUpgradeQuantities] = useState<Record<string, number>>(getUpgradeDefaultQuantities());
  const [newCameraCounts, setNewCameraCounts] = useState<Record<string, number>>(getUpgradeDefaultNewCameraCounts());
  const [upgradePanelIncluded, setUpgradePanelIncluded] = useState(false);

  // Handle package selection - navigate to config page
  const handlePackageSelect = useCallback((type: PackageType) => {
    if (type === 'premium' || type === 'non-premium') {
      setPackageType(type);
      setQuantities(getDefaultQuantities());
      setServiceRate(PACKAGE_CONFIGS[type].serviceDefault);
    } else if (type === 'upgrade') {
      setPackageType(type);
      setUpgradeQuantities(getUpgradeDefaultQuantities());
      setNewCameraCounts(getUpgradeDefaultNewCameraCounts());
      setUpgradePanelIncluded(false);
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

  // Update quantity with constraints (regular packages)
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

  // Update upgrade quantity with constraints
  const handleUpgradeQuantityChange = useCallback((itemId: string, delta: number) => {
    setUpgradeQuantities(prev => {
      const item = UPGRADE_EQUIPMENT_LIST.find(i => i.id === itemId);
      if (!item) return prev;
      
      const currentQty = prev[itemId] || 0;
      const newQty = Math.max(0, currentQty + delta);
      
      if (newQty === 0) {
        const { [itemId]: _, ...rest } = prev;
        // Also remove from new camera counts
        setNewCameraCounts(prevCounts => {
          const { [itemId]: __, ...restCounts } = prevCounts;
          return restCounts;
        });
        return rest;
      }
      
      // When increasing quantity, ensure newCameraCount doesn't exceed quantity
      if (delta > 0 && item.incursVideoFee) {
        setNewCameraCounts(prevCounts => {
          const currentNewCams = prevCounts[itemId] || 0;
          // If no new cameras set yet, don't auto-add (user must opt-in)
          return prevCounts;
        });
      }
      
      // When decreasing quantity, ensure newCameraCount doesn't exceed new quantity
      if (delta < 0 && item.incursVideoFee) {
        setNewCameraCounts(prevCounts => {
          const currentNewCams = prevCounts[itemId] || 0;
          if (currentNewCams > newQty) {
            return { ...prevCounts, [itemId]: newQty };
          }
          return prevCounts;
        });
      }
      
      return { ...prev, [itemId]: newQty };
    });
  }, []);

  // Update new camera count for video fee
  const handleNewCameraCountChange = useCallback((itemId: string, delta: number) => {
    setNewCameraCounts(prev => {
      const currentCount = prev[itemId] || 0;
      const maxCount = upgradeQuantities[itemId] || 0;
      const newCount = Math.max(0, Math.min(maxCount, currentCount + delta));
      
      if (newCount === 0) {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [itemId]: newCount };
    });
  }, [upgradeQuantities]);

  // Reset to defaults
  const handleReset = useCallback(() => {
    hapticMedium();
    if (packageType === 'premium' || packageType === 'non-premium') {
      setQuantities(getDefaultQuantities());
      setInstallFee(399);
      setServiceRate(PACKAGE_CONFIGS[packageType].serviceDefault);
      setWarrantyEnabled(true);
    } else if (packageType === 'upgrade') {
      setUpgradeQuantities(getUpgradeDefaultQuantities());
      setNewCameraCounts(getUpgradeDefaultNewCameraCounts());
      setUpgradePanelIncluded(false);
    }
  }, [packageType]);

  // Calculate prices for regular packages
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

  // Calculate prices for upgrade packages
  const upgradePrices = useMemo(() => {
    if (packageType !== 'upgrade') {
      return { 
        equipmentTotal: 0, 
        installFee: UPGRADE_CONFIG.installFee,
        panelIncluded: false,
        equipmentMonthly: 0, 
        videoServiceFee: 0, 
        newCameraCount: 0, 
        totalMonthly: 0,
        financingMonths: UPGRADE_CONFIG.longFinancingMonths,
        amountNeededFor60Mo: 0,
      };
    }

    // Start with install fee
    let equipmentTotal = UPGRADE_CONFIG.installFee;
    
    // Add panel if included
    if (upgradePanelIncluded) {
      equipmentTotal += UPGRADE_CONFIG.panelPrice;
    }
    
    // Add equipment costs
    UPGRADE_EQUIPMENT_LIST.forEach(item => {
      const qty = upgradeQuantities[item.id] || 0;
      equipmentTotal += item.price * qty;
    });

    // Estimate total with tax to determine financing term
    const estimatedWithTax = equipmentTotal * (1 + UPGRADE_CONFIG.estimatedTaxRate);
    
    // Determine financing term based on threshold
    const financingMonths = estimatedWithTax >= UPGRADE_CONFIG.financingThreshold 
      ? UPGRADE_CONFIG.longFinancingMonths 
      : UPGRADE_CONFIG.shortFinancingMonths;
    
    // Calculate how much more is needed for 60-month financing
    const amountNeededFor60Mo = estimatedWithTax < UPGRADE_CONFIG.financingThreshold
      ? (UPGRADE_CONFIG.financingThreshold - estimatedWithTax) / (1 + UPGRADE_CONFIG.estimatedTaxRate)
      : 0;

    // Calculate equipment monthly
    const equipmentMonthly = equipmentTotal / financingMonths;

    // Count new cameras for video service fee
    let newCameraCount = 0;
    UPGRADE_EQUIPMENT_LIST.forEach(item => {
      if (item.incursVideoFee) {
        newCameraCount += newCameraCounts[item.id] || 0;
      }
    });

    // Video service fee ($5 per new camera only)
    const videoServiceFee = newCameraCount * UPGRADE_CONFIG.videoFeePerCamera;

    // Total monthly (equipment + video service only, no warranty or service rate)
    const totalMonthly = equipmentMonthly + videoServiceFee;

    return { 
      equipmentTotal, 
      installFee: UPGRADE_CONFIG.installFee,
      panelIncluded: upgradePanelIncluded,
      equipmentMonthly, 
      videoServiceFee, 
      newCameraCount, 
      totalMonthly,
      financingMonths,
      amountNeededFor60Mo,
    };
  }, [packageType, upgradeQuantities, newCameraCounts, upgradePanelIncluded]);

  const isConfigurable = packageType === 'premium' || packageType === 'non-premium';
  const isUpgrade = packageType === 'upgrade';
  const packageLabel = packageType === 'premium' ? 'Premium Kit' : packageType === 'non-premium' ? 'Non-Premium Kit' : packageType === 'upgrade' ? 'Upgrade' : 'Package Builder';

  // Handle swipe back - different behavior based on current page
  const handleSwipeBack = useCallback(() => {
    if (packageType) {
      handleBack();
    } else {
      navigate('/tools');
    }
  }, [packageType, handleBack, navigate]);

  return (
    <EdgeSwipeContainer onBack={handleSwipeBack}>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div 
          className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border"
          style={{ paddingTop: 'var(--effective-safe-area-top)' }}
        >
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
          {(isConfigurable || isUpgrade) ? (
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
          // Page 2: Regular Equipment Configuration
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
        ) : isUpgrade ? (
          // Page 2: Upgrade Equipment Configuration
          <motion.div
            key="upgrade-config"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="max-w-lg mx-auto px-4 py-6 pb-40 space-y-6"
          >
            {/* Upgrade info header with panel toggle */}
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Upgrade Package</p>
                  <p className="text-xs text-muted-foreground">Install $99 (fixed) • +$5/mo per new cam</p>
                </div>
              </div>
              
              {/* Panel toggle */}
              <div className="flex items-center justify-between pt-2 border-t border-emerald-500/20">
                <div>
                  <p className="text-sm font-medium">Add Panel</p>
                  <p className="text-xs text-muted-foreground">$500 (optional)</p>
                </div>
                <button
                  onClick={() => {
                    hapticMedium();
                    setUpgradePanelIncluded(!upgradePanelIncluded);
                  }}
                  className={cn(
                    "w-12 h-7 rounded-full transition-colors relative",
                    upgradePanelIncluded ? "bg-emerald-500" : "bg-muted"
                  )}
                >
                  <div className={cn(
                    "absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform",
                    upgradePanelIncluded ? "translate-x-6" : "translate-x-1"
                  )} />
                </button>
              </div>
            </div>

            {/* Upgrade Equipment Selection */}
            <UpgradeEquipmentConfigurator
              quantities={upgradeQuantities}
              newCameraCounts={newCameraCounts}
              onQuantityChange={handleUpgradeQuantityChange}
              onNewCameraCountChange={handleNewCameraCountChange}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

        {/* Sticky Price Summary - regular packages */}
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

        {/* Sticky Price Summary - upgrade packages */}
        {isUpgrade && (
          <UpgradePriceSummary
            equipmentTotal={upgradePrices.equipmentTotal}
            installFee={upgradePrices.installFee}
            panelIncluded={upgradePrices.panelIncluded}
            equipmentMonthly={upgradePrices.equipmentMonthly}
            videoServiceFee={upgradePrices.videoServiceFee}
            newCameraCount={upgradePrices.newCameraCount}
            totalMonthly={upgradePrices.totalMonthly}
            financingMonths={upgradePrices.financingMonths}
            amountNeededFor60Mo={upgradePrices.amountNeededFor60Mo}
          />
        )}
      </div>
    </EdgeSwipeContainer>
  );
};

export default PackageBuilder;
