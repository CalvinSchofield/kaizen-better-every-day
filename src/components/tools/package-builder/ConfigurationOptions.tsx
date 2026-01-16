import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { hapticLight, hapticSelection } from "@/utils/haptics";
import { INSTALL_OPTIONS, PACKAGE_CONFIGS } from "./types";
import type { PackageType } from "./types";

interface ConfigurationOptionsProps {
  packageType: 'premium' | 'non-premium';
  installFee: number;
  onInstallFeeChange: (fee: number) => void;
  serviceRate: number;
  onServiceRateChange: (rate: number) => void;
  warrantyEnabled: boolean;
  onWarrantyChange: (enabled: boolean) => void;
}

export const ConfigurationOptions = ({
  packageType,
  installFee,
  onInstallFeeChange,
  serviceRate,
  onServiceRateChange,
  warrantyEnabled,
  onWarrantyChange,
}: ConfigurationOptionsProps) => {
  const config = PACKAGE_CONFIGS[packageType];

  // Handle slider change - snap to .99 values
  const handleServiceRateChange = (value: number[]) => {
    hapticSelection();
    // Round to nearest .99
    const rounded = Math.round(value[0]) - 0.01;
    const clamped = Math.max(config.serviceMin, Math.min(config.serviceMax, rounded));
    onServiceRateChange(parseFloat(clamped.toFixed(2)));
  };

  return (
    <div className="space-y-4 bg-card rounded-2xl p-4 border border-border">
      {/* Install Fee */}
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Install Fee
        </Label>
        <div className="flex gap-2 mt-2">
          {INSTALL_OPTIONS.map(option => (
            <button
              key={option.value}
              onClick={() => {
                hapticLight();
                onInstallFeeChange(option.value);
              }}
              className={cn(
                "flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all active:scale-[0.97]",
                installFee === option.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Service Rate Slider */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Service Rate
          </Label>
          <span className="text-lg font-bold text-primary">
            ${serviceRate.toFixed(2)}
          </span>
        </div>
        <Slider
          value={[serviceRate + 0.01]}
          onValueChange={handleServiceRateChange}
          min={config.serviceMin + 0.01}
          max={config.serviceMax + 0.01}
          step={1}
          className="mt-2"
        />
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-muted-foreground">
            ${config.serviceMin.toFixed(2)}
          </span>
          <span className="text-[10px] text-muted-foreground">
            ${config.serviceMax.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Warranty Toggle */}
      <div className="flex items-center justify-between py-2">
        <div>
          <Label className="text-sm font-medium">Warranty</Label>
          <p className="text-xs text-muted-foreground">
            ${config.warrantyPrice}/mo protection plan
          </p>
        </div>
        <Switch
          checked={warrantyEnabled}
          onCheckedChange={(checked) => {
            hapticLight();
            onWarrantyChange(checked);
          }}
        />
      </div>
    </div>
  );
};
