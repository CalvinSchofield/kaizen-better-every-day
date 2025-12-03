import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Trash2, HelpCircle, ExternalLink } from "lucide-react";

export interface Sale {
  id: string;
  type: 'fp' | 'upgrade';
  prmr: number;
  timestamp: string;
}

interface LogSaleSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogSale: (sale: Omit<Sale, 'id' | 'timestamp'>) => void;
  onSkip: () => void;
  editingSale?: Sale | null;
  onUpdateSale?: (sale: Sale) => void;
  onDeleteSale?: (saleId: string) => void;
  showPrmrHelper?: boolean; // Show helper for rookies or reps with <20 FP+
}

// GPT link for upgrade PRMR calculation
const UPGRADE_GPT_URL = "https://chatgpt.com/g/g-6839cccc5b3c81919ab1bc0c6f11eb72-vivint-upgrade-prmr-calculator";

export const LogSaleSheet = ({
  open,
  onOpenChange,
  onLogSale,
  onSkip,
  editingSale,
  onUpdateSale,
  onDeleteSale,
  showPrmrHelper = false,
}: LogSaleSheetProps) => {
  const [saleType, setSaleType] = useState<'fp' | 'upgrade'>('fp');
  const [prmr, setPrmr] = useState("");
  const [showHelperContent, setShowHelperContent] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset form when opening, populate when editing
  useEffect(() => {
    if (open) {
      if (editingSale) {
        setSaleType(editingSale.type);
        setPrmr(editingSale.prmr.toString());
      } else {
        setSaleType('fp');
        setPrmr("");
      }
      setShowHelperContent(false);
      // Auto-focus input after a short delay
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, editingSale]);

  const handleSubmit = () => {
    const prmrValue = parseFloat(prmr) || 0;
    
    if (editingSale && onUpdateSale) {
      onUpdateSale({
        ...editingSale,
        type: saleType,
        prmr: prmrValue,
      });
    } else {
      onLogSale({
        type: saleType,
        prmr: prmrValue,
      });
    }
    onOpenChange(false);
  };

  const handleSkip = () => {
    onSkip();
    onOpenChange(false);
  };

  const handleDelete = () => {
    if (editingSale && onDeleteSale) {
      onDeleteSale(editingSale.id);
      onOpenChange(false);
    }
  };

  const handleHelperClick = () => {
    if (saleType === 'upgrade') {
      // Open GPT with prefilled message
      const prefillMessage = encodeURIComponent("Help me calculate my PRMR on this upgrade. I'll give you a list of equipment I sold and then help me figure out the total when considering if the cameras were marked as \"new\" or \"replacements\"");
      window.open(`${UPGRADE_GPT_URL}?q=${prefillMessage}`, '_blank');
    } else {
      // Toggle FP helper content
      setShowHelperContent(!showHelperContent);
    }
  };

  const isEditing = !!editingSale;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="pb-safe">
        <DrawerHeader className="text-center pb-2">
          <DrawerTitle className="text-xl">
            {isEditing ? "Edit Sale" : "Nice! 🎉"}
          </DrawerTitle>
          {!isEditing && (
            <p className="text-sm text-muted-foreground mt-1">
              Log this sale's details
            </p>
          )}
        </DrawerHeader>

        <div className="px-4 pb-6 space-y-6">
          {/* Sale Type Toggle */}
          <div className="flex gap-2 p-1 bg-muted rounded-xl">
            <button
              type="button"
              onClick={() => {
                setSaleType('fp');
                setShowHelperContent(false);
              }}
              className={`flex-1 py-3 px-4 rounded-lg text-sm font-semibold transition-all ${
                saleType === 'fp'
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              FP (New Account)
            </button>
            <button
              type="button"
              onClick={() => {
                setSaleType('upgrade');
                setShowHelperContent(false);
              }}
              className={`flex-1 py-3 px-4 rounded-lg text-sm font-semibold transition-all ${
                saleType === 'upgrade'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Upgrade
            </button>
          </div>

          {/* PRMR Input */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-muted-foreground">
                PRMR Amount
              </label>
              {showPrmrHelper && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={handleHelperClick}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <HelpCircle className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[250px]">
                      <p className="text-xs">
                        {saleType === 'upgrade' 
                          ? "Tap to open the PRMR calculator for upgrades"
                          : "Tap for help finding your PRMR"
                        }
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            
            {/* FP Helper Content */}
            {showPrmrHelper && showHelperContent && saleType === 'fp' && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-2 border border-border">
                <p className="font-medium text-foreground">How to find PRMR on Street Genie:</p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>On the account in Street Genie, click the <span className="font-medium text-foreground">three dots</span> (top right)</li>
                  <li>Select <span className="font-medium text-foreground">PRMR Estimator</span></li>
                </ol>
                <p className="text-xs text-muted-foreground italic mt-2">
                  *Check Curator the next day to ensure accuracy—sometimes an item might be removed during install or rarely there's a glitch that should be corrected.
                </p>
              </div>
            )}
            
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-semibold text-muted-foreground">
                $
              </span>
              <Input
                ref={inputRef}
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={prmr}
                onChange={(e) => setPrmr(e.target.value)}
                className="pl-9 text-2xl font-bold h-14 text-center"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button
              onClick={handleSubmit}
              className="w-full h-12 text-base font-semibold"
              disabled={!prmr || parseFloat(prmr) <= 0}
            >
              {isEditing ? "Update Sale" : "Log Sale"}
            </Button>
            
            {!isEditing && (
              <button
                type="button"
                onClick={handleSkip}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
              >
                Skip (just count the close)
              </button>
            )}

            {isEditing && onDeleteSale && (
              <Button
                variant="ghost"
                onClick={handleDelete}
                className="w-full h-10 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Sale
              </Button>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
