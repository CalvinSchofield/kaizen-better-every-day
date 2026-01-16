import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { hapticLight, hapticSelection } from "@/utils/haptics";
import { INSTALL_OPTIONS, PACKAGE_CONFIGS, getServiceRateOptions } from "./types";
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
  const serviceOptions = getServiceRateOptions(config.serviceMin, config.serviceMax);

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

      {/* Service Rate Picker */}
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Service Rate
        </Label>
        <ScrollArea className="w-full whitespace-nowrap mt-2">
          <div className="flex gap-2 pb-2">
            {serviceOptions.map(rate => (
              <button
                key={rate}
                onClick={() => {
                  hapticSelection();
                  onServiceRateChange(rate);
                }}
                className={cn(
                  "flex-shrink-0 py-2 px-3 rounded-xl text-sm font-medium transition-all active:scale-[0.97]",
                  serviceRate === rate
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80"
                )}
              >
                ${rate.toFixed(2)}
              </button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
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
