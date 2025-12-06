import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Sale } from "@/hooks/useDailyEntry";
import { format, parseISO } from "date-fns";
import { AlertTriangle, Ban, CheckCircle, Calendar } from "lucide-react";

interface SaleDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: Sale | null;
  entryDate: string;
  onUpdateSale: (updatedSale: Sale) => void;
}

export const SaleDetailSheet = ({
  open,
  onOpenChange,
  sale,
  entryDate,
  onUpdateSale,
}: SaleDetailSheetProps) => {
  const [prmr, setPrmr] = useState("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Initialize form when sale changes
  useState(() => {
    if (sale) {
      setPrmr(sale.prmr.toString());
    }
  });

  if (!sale) return null;

  const isCancelled = sale.install_status === 'cancelled';
  const isPending = sale.install_status === 'pending';
  const isInstalled = sale.install_status === 'installed' || !sale.install_status;
  const isFP = sale.type === 'fp';
  const timeStr = format(parseISO(sale.timestamp), 'h:mm a');
  const dateStr = format(parseISO(entryDate), 'MMM d, yyyy');

  const handleUpdatePrmr = () => {
    const newPrmr = parseFloat(prmr) || 0;
    if (newPrmr !== sale.prmr) {
      onUpdateSale({
        ...sale,
        prmr: newPrmr,
      });
    }
    onOpenChange(false);
  };

  const handleMarkCancelled = () => {
    onUpdateSale({
      ...sale,
      install_status: 'cancelled',
    });
    setShowCancelConfirm(false);
    onOpenChange(false);
  };

  const handleMarkInstalled = () => {
    onUpdateSale({
      ...sale,
      install_status: 'installed',
      install_confirmed_at: new Date().toISOString(),
    });
    onOpenChange(false);
  };

  const handleUndoCancel = () => {
    onUpdateSale({
      ...sale,
      install_status: 'installed',
    });
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="pb-safe">
        <DrawerHeader className="text-center pb-2">
          <DrawerTitle className="text-xl flex items-center justify-center gap-2">
            {isCancelled && <Ban className="h-5 w-5 text-destructive" />}
            {isFP ? 'FP Sale' : 'Upgrade'} Details
          </DrawerTitle>
          <DrawerDescription>
            {dateStr} at {timeStr}
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-6 space-y-6">
          {/* Status Badge */}
          <div className="flex justify-center">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
              isCancelled 
                ? 'bg-destructive/10 text-destructive' 
                : isPending 
                  ? 'bg-amber-500/10 text-amber-600'
                  : 'bg-emerald-500/10 text-emerald-600'
            }`}>
              {isCancelled ? (
                <>
                  <Ban className="h-4 w-4" />
                  Cancelled / Unfunded
                </>
              ) : isPending ? (
                <>
                  <Calendar className="h-4 w-4" />
                  Pending Install
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Installed / Funded
                </>
              )}
            </div>
          </div>

          {/* PRMR Input */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">
              PRMR Amount
            </Label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-semibold text-muted-foreground">
                $
              </span>
              <Input
                type="number"
                inputMode="decimal"
                value={prmr}
                onChange={(e) => setPrmr(e.target.value)}
                className={`pl-9 text-2xl font-bold h-14 text-center ${
                  isCancelled ? 'line-through text-muted-foreground' : ''
                }`}
                disabled={isCancelled}
              />
            </div>
            {!isCancelled && prmr !== sale.prmr.toString() && (
              <Button
                onClick={handleUpdatePrmr}
                className="w-full"
                size="sm"
              >
                Update PRMR
              </Button>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-3 pt-4 border-t border-border/50">
            {isCancelled ? (
              <Button
                variant="outline"
                onClick={handleUndoCancel}
                className="w-full h-12"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark as Funded
              </Button>
            ) : isPending ? (
              <>
                <Button
                  variant="outline"
                  onClick={handleMarkInstalled}
                  className="w-full h-12 border-emerald-500/50 text-emerald-600 hover:bg-emerald-500/10"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirm Installed
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setShowCancelConfirm(true)}
                  className="w-full h-10 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Ban className="h-4 w-4 mr-2" />
                  Mark as Cancelled
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                onClick={() => setShowCancelConfirm(true)}
                className="w-full h-10 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Ban className="h-4 w-4 mr-2" />
                Mark as Cancelled / Unfunded
              </Button>
            )}
          </div>

          {/* Cancel Confirmation */}
          {showCancelConfirm && (
            <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-foreground">
                    Mark as Cancelled?
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    This will remove ${sale.prmr} from your funded totals. 
                    You can undo this later if needed.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1"
                >
                  Keep Sale
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleMarkCancelled}
                  className="flex-1"
                >
                  Yes, Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
