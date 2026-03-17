import { useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Sale } from "@/hooks/useDailyEntry";
import { format, parseISO } from "date-fns";
import { Trash2, AlertCircle, Ban, ShieldX, ArrowLeft, Info } from "lucide-react";

interface DeleteSalePickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  salesLog: Sale[];
  closesCount: number;
  onDeleteSale: (saleId: string) => void;
  onDecrementOrphanedClose?: () => void;
  onUpdateSaleStatus?: (saleId: string, status: string) => void;
}

export const DeleteSalePickerSheet = ({
  open,
  onOpenChange,
  salesLog,
  closesCount,
  onDeleteSale,
  onDecrementOrphanedClose,
  onUpdateSaleStatus,
}: DeleteSalePickerSheetProps) => {
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setSelectedSale(null);
    }
    onOpenChange(isOpen);
  };

  const handleConfirmDelete = () => {
    if (!selectedSale) return;
    onDeleteSale(selectedSale.id);
    setSelectedSale(null);
    onOpenChange(false);
  };

  const handleMarkStatus = (status: string) => {
    if (!selectedSale) return;
    onUpdateSaleStatus?.(selectedSale.id, status);
    setSelectedSale(null);
    onOpenChange(false);
  };

  const handleDecrementOrphaned = () => {
    onDecrementOrphanedClose?.();
    onOpenChange(false);
  };

  // Detect mismatch: more closes than sales logged
  const hasOrphanedClose = closesCount > salesLog.length;
  const orphanedCount = closesCount - salesLog.length;

  // Two-step flow: Step 1 = pick sale, Step 2 = confirm action
  const isConfirmStep = selectedSale !== null;

  return (
    <Drawer open={open} onOpenChange={handleClose}>
      <DrawerContent className="px-4 pb-8">
        {!isConfirmStep ? (
          // ──── STEP 1: Pick which sale to remove ────
          <>
            <DrawerHeader className="text-left">
              <DrawerTitle>Remove a Close</DrawerTitle>
              <DrawerDescription>
                {hasOrphanedClose 
                  ? `You have ${orphanedCount} close${orphanedCount > 1 ? 's' : ''} without a logged sale. You can remove ${orphanedCount === 1 ? 'it' : 'one'} or pick a sale to modify.`
                  : "Select which sale you want to remove or update."
                }
              </DrawerDescription>
            </DrawerHeader>
            
            <div className="space-y-2 mt-2">
              {/* Show option to remove orphaned close first */}
              {hasOrphanedClose && onDecrementOrphanedClose && (
                <button
                  onClick={handleDecrementOrphaned}
                  className="w-full flex items-center justify-between p-4 rounded-xl transition-colors bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20"
                >
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-500" />
                    <div className="text-left">
                      <div className="text-sm font-semibold text-foreground">
                        Remove extra close (no sale logged)
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Keeps your {salesLog.length} logged sale{salesLog.length !== 1 ? 's' : ''} intact
                      </div>
                    </div>
                  </div>
                  <Trash2 className="h-5 w-5 text-amber-600" />
                </button>
              )}

              {/* Existing sales */}
              {salesLog.map((sale) => {
                const isFP = sale.type === 'fp';
                const timeStr = format(parseISO(sale.timestamp), 'h:mm a');
                
                return (
                  <button
                    key={sale.id}
                    onClick={() => setSelectedSale(sale)}
                    className={`w-full flex items-center justify-between p-4 rounded-xl transition-colors ${
                      isFP
                        ? 'bg-primary/10 border border-primary/20 hover:bg-primary/20'
                        : 'bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`text-sm font-bold ${
                        isFP ? 'text-primary' : 'text-emerald-600'
                      }`}>
                        {isFP ? 'FP' : 'Upgrade'}
                      </div>
                      <div className="text-lg font-bold text-foreground">
                        ${sale.prmr.toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {timeStr}
                      </div>
                    </div>
                    <ArrowLeft className="h-5 w-5 text-muted-foreground rotate-180" />
                  </button>
                );
              })}
            </div>
            
            <Button
              variant="outline"
              onClick={() => handleClose(false)}
              className="mt-4 w-full"
            >
              Cancel
            </Button>
          </>
        ) : (
          // ──── STEP 2: Confirm action on selected sale ────
          <>
            <DrawerHeader className="text-left">
              <DrawerTitle>What happened to this sale?</DrawerTitle>
              <DrawerDescription>
                <span className="inline-flex items-center gap-2 mt-1">
                  <span className={`font-bold ${selectedSale.type === 'fp' ? 'text-primary' : 'text-emerald-600'}`}>
                    {selectedSale.type === 'fp' ? 'FP' : 'Upgrade'}
                  </span>
                  <span className="font-bold text-foreground">${selectedSale.prmr.toLocaleString()}</span>
                  <span className="text-muted-foreground">at {format(parseISO(selectedSale.timestamp), 'h:mm a')}</span>
                </span>
              </DrawerDescription>
            </DrawerHeader>

            {/* Education tip */}
            <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50 border border-border mb-3 mt-1">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">Pro tip:</span> If this deal was sold but later cancelled or never installed, mark it as such instead of deleting. This keeps your activity data accurate and helps track cancel rates.
              </p>
            </div>

            <div className="space-y-2">
              {/* Mark as Cancelled */}
              {onUpdateSaleStatus && selectedSale.install_status !== 'cancelled' && (
                <button
                  onClick={() => handleMarkStatus('cancelled')}
                  className="w-full flex items-center gap-3 p-4 rounded-xl transition-colors bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20"
                >
                  <Ban className="h-5 w-5 text-amber-500 flex-shrink-0" />
                  <div className="text-left">
                    <div className="text-sm font-semibold text-foreground">
                      Mark as Cancelled
                    </div>
                    <div className="text-xs text-muted-foreground">
                      The deal was sold but cancelled after. Keeps it in your log with a cancelled status.
                    </div>
                  </div>
                </button>
              )}

              {/* Mark as Never Installed */}
              {onUpdateSaleStatus && selectedSale.install_status !== 'never_installed' && (
                <button
                  onClick={() => handleMarkStatus('never_installed')}
                  className="w-full flex items-center gap-3 p-4 rounded-xl transition-colors bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/20"
                >
                  <ShieldX className="h-5 w-5 text-orange-500 flex-shrink-0" />
                  <div className="text-left">
                    <div className="text-sm font-semibold text-foreground">
                      Mark as Never Installed
                    </div>
                    <div className="text-xs text-muted-foreground">
                      The system was never installed. Removes it from your totals but keeps the record.
                    </div>
                  </div>
                </button>
              )}

              {/* Delete entirely */}
              <button
                onClick={handleConfirmDelete}
                className="w-full flex items-center gap-3 p-4 rounded-xl transition-colors bg-destructive/10 border border-destructive/20 hover:bg-destructive/20"
              >
                <Trash2 className="h-5 w-5 text-destructive flex-shrink-0" />
                <div className="text-left">
                  <div className="text-sm font-semibold text-foreground">
                    Delete Entirely
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Completely remove this sale as if it never happened. This cannot be undone.
                  </div>
                </div>
              </button>
            </div>

            {/* Back button */}
            {salesLog.length > 1 && (
              <Button
                variant="outline"
                onClick={() => setSelectedSale(null)}
                className="mt-3 w-full"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Pick a different sale
              </Button>
            )}
            
            <Button
              variant="ghost"
              onClick={() => handleClose(false)}
              className="mt-2 w-full text-muted-foreground"
            >
              Cancel
            </Button>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
};
