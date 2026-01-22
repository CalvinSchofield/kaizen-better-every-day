import { useState } from "react";
import { ChevronUp, ChevronDown, Video, AlertTriangle, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { UPGRADE_CONFIG } from "./upgradeTypes";

interface UpgradePriceSummaryProps {
  equipmentTotal: number;
  installFee: number;
  panelIncluded: boolean;
  equipmentMonthly: number;
  videoServiceFee: number;
  newCameraCount: number;
  totalMonthly: number;
  financingMonths: number;
  amountNeededFor60Mo: number;
  prmr: number;
  onQuickAdd?: (itemId: string, count: number) => void;
}

export const UpgradePriceSummary = ({
  equipmentTotal,
  installFee,
  panelIncluded,
  equipmentMonthly,
  videoServiceFee,
  newCameraCount,
  totalMonthly,
  financingMonths,
  amountNeededFor60Mo,
  prmr,
  onQuickAdd,
}: UpgradePriceSummaryProps) => {
  const [expanded, setExpanded] = useState(false);
  const isShortFinancing = financingMonths === UPGRADE_CONFIG.shortFinancingMonths;
  
  // Cheapest equipment is Door/Window sensor at $50
  const cheapestItemId = 'door-window-sensor';
  const cheapestItemPrice = 50;
  const sensorsNeeded = Math.ceil(amountNeededFor60Mo / cheapestItemPrice);
  
  const handleQuickAdd = () => {
    if (onQuickAdd && sensorsNeeded > 0) {
      onQuickAdd(cheapestItemId, sensorsNeeded);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <div className="max-w-lg mx-auto">
        <div 
          className={cn(
            "bg-card/95 backdrop-blur-xl border-t border-border shadow-2xl transition-all duration-300",
            "rounded-t-3xl"
          )}
        >
          {/* Main display - always visible */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full p-4 flex items-center justify-between active:bg-accent/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center",
                isShortFinancing ? "bg-amber-500/10" : "bg-primary/10"
              )}>
                {expanded ? (
                  <ChevronDown className={cn("w-5 h-5", isShortFinancing ? "text-amber-500" : "text-primary")} />
                ) : (
                  <ChevronUp className={cn("w-5 h-5", isShortFinancing ? "text-amber-500" : "text-primary")} />
                )}
              </div>
              <div className="text-left">
                <p className="text-xs text-muted-foreground">Added to Monthly</p>
                <p className={cn(
                  "text-sm",
                  isShortFinancing ? "text-amber-500" : "text-muted-foreground"
                )}>
                  ({financingMonths} mo)
                </p>
              </div>
            </div>
            
            {/* Two-column display: Monthly + PRMR */}
            <div className="flex items-center gap-4">
              {/* PRMR */}
              <motion.div
                key={`prmr-${prmr.toFixed(0)}`}
                initial={{ scale: 1.1, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="text-right"
              >
                <p className="text-lg font-bold text-emerald-500">
                  ${prmr.toFixed(0)}
                </p>
                <p className="text-[10px] text-muted-foreground">PRMR</p>
              </motion.div>
              
              {/* Divider */}
              <div className="w-px h-8 bg-border" />
              
              {/* Monthly */}
              <motion.div
                key={totalMonthly.toFixed(2)}
                initial={{ scale: 1.1, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="text-right"
              >
                <p className="text-2xl font-bold text-foreground">
                  +${totalMonthly.toFixed(2)}
                </p>
                <p className="text-[10px] text-muted-foreground">/month</p>
              </motion.div>
            </div>
          </button>

          {/* Breakdown - expandable */}
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 space-y-2 border-t border-border pt-3">
                  {/* 36-month warning and recommendation */}
                  {isShortFinancing && (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div className="text-xs flex-1">
                          <p className="font-medium text-amber-500 mb-1">36-Month Financing</p>
                          <p className="text-muted-foreground mb-2">
                            Add ~${Math.ceil(amountNeededFor60Mo)} more to qualify for 60-month financing.
                          </p>
                          {onQuickAdd && sensorsNeeded > 0 && (
                            <button
                              onClick={handleQuickAdd}
                              className="w-full py-2 px-3 bg-amber-500 text-white text-xs font-medium rounded-lg active:scale-[0.98] transition-transform"
                            >
                              + Add {sensorsNeeded} Door/Window Sensor{sensorsNeeded > 1 ? 's' : ''} (+${sensorsNeeded * cheapestItemPrice})
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Equipment breakdown */}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Equipment ({financingMonths} mo)</span>
                    <span className="font-medium">${equipmentMonthly.toFixed(2)}</span>
                  </div>
                  
                  {/* Equipment total info */}
                  <div className="text-xs text-muted-foreground/70 pl-2 space-y-0.5">
                    <p>${equipmentTotal.toFixed(0)} total</p>
                    <p className="flex flex-wrap gap-x-2">
                      {panelIncluded && <span>• ${UPGRADE_CONFIG.panelPrice} panel</span>}
                      <span>• ${installFee} install</span>
                    </p>
                  </div>

                  {/* Video Service Fee */}
                  {videoServiceFee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Video className="w-3 h-3 text-emerald-500" />
                        Video Service ({newCameraCount} new cam{newCameraCount !== 1 ? 's' : ''})
                      </span>
                      <span className="font-medium text-emerald-500">${videoServiceFee.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-sm pt-2 border-t border-border">
                    <span className="font-semibold">Total Added Monthly</span>
                    <span className="font-bold text-primary">+${totalMonthly.toFixed(2)}</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
