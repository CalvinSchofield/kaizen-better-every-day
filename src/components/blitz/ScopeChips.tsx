import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Check } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";

interface ScopeOption {
  value: string;
  label: string;
}

interface ScopeChipsProps {
  options: ScopeOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  // Secondary picker props
  needsSecondaryPicker?: boolean;
  secondaryLabel?: string;
  secondaryOptions?: Array<{ id: string; name: string }>;
  secondaryValue?: string | null;
  onSecondaryChange?: (value: string) => void;
}

export const ScopeChips = ({
  options,
  value,
  onChange,
  disabled = false,
  needsSecondaryPicker = false,
  secondaryLabel = "Select",
  secondaryOptions = [],
  secondaryValue,
  onSecondaryChange,
}: ScopeChipsProps) => {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleChipClick = (optionValue: string) => {
    if (disabled) return;
    onChange(optionValue);
  };

  const handleSecondarySelect = (id: string) => {
    onSecondaryChange?.(id);
    setDrawerOpen(false);
  };

  const selectedSecondary = secondaryOptions.find(opt => opt.id === secondaryValue);

  return (
    <div className="flex flex-col gap-2">
      {/* Horizontal chip row */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-1 -mb-1">
        {options.map((option) => {
          const isActive = value === option.value;
          const needsDropdown = isActive && needsSecondaryPicker && secondaryOptions.length > 0;
          
          return (
            <button
              key={option.value}
              onClick={() => handleChipClick(option.value)}
              disabled={disabled}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200",
                "border focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
                isActive
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted hover:text-foreground",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              {option.label}
              {needsDropdown && (
                <ChevronDown 
                  className="h-3.5 w-3.5 ml-0.5 opacity-70" 
                  onClick={(e) => {
                    e.stopPropagation();
                    setDrawerOpen(true);
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Show selected secondary as a sub-chip when active */}
      {needsSecondaryPicker && secondaryOptions.length > 0 && selectedSecondary && (
        <button
          onClick={() => setDrawerOpen(true)}
          disabled={disabled}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium w-fit",
            "bg-secondary/70 text-secondary-foreground border border-border/30",
            "hover:bg-secondary transition-colors",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <span className="text-muted-foreground">{secondaryLabel}:</span>
          <span>{selectedSecondary.name}</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      )}

      {/* Bottom sheet drawer for secondary selection */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="max-h-[70dvh]">
          <DrawerHeader className="text-left pb-2">
            <DrawerTitle>Select {secondaryLabel}</DrawerTitle>
            <DrawerDescription>
              Choose which {secondaryLabel.toLowerCase()} to view
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-6 space-y-1 overflow-y-auto">
            {secondaryOptions.map((option) => {
              const isSelected = option.id === secondaryValue;
              return (
                <button
                  key={option.id}
                  onClick={() => handleSecondarySelect(option.id)}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition-all",
                    "focus:outline-none focus:ring-2 focus:ring-ring",
                    isSelected
                      ? "bg-primary/10 border border-primary/30"
                      : "hover:bg-muted border border-transparent"
                  )}
                >
                  <span className={cn(
                    "font-medium",
                    isSelected && "text-primary"
                  )}>
                    {option.name}
                  </span>
                  {isSelected && (
                    <Check className="h-5 w-5 text-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};
