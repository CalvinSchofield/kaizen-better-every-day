import { useState, useEffect } from "react";
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
import { AlertTriangle, Ban, CheckCircle, Calendar, Trash2, User, Phone, Hash, MapPin, Clock, DollarSign, Gauge, Copy } from "lucide-react";
import { toast } from "sonner";

interface SaleDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: Sale | null;
  entryDate: string;
  onUpdateSale: (updatedSale: Sale) => void;
  onDeleteSale?: (saleId: string) => void;
  crmEnabled?: boolean;
  crmDetailedEnabled?: boolean;
}

// Helper to format minutes to readable string
const formatMinutes = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hrs} hr ${mins} min` : `${hrs} hr`;
};

export const SaleDetailSheet = ({
  open,
  onOpenChange,
  sale,
  entryDate,
  onUpdateSale,
  onDeleteSale,
  crmEnabled = false,
  crmDetailedEnabled = false,
}: SaleDetailSheetProps) => {
  const [prmr, setPrmr] = useState("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Initialize form when sale changes
  useEffect(() => {
    if (sale) {
      setPrmr(sale.prmr.toString());
    }
  }, [sale]);

  // Reset confirmation states when sheet closes
  useEffect(() => {
    if (!open) {
      setShowCancelConfirm(false);
      setShowDeleteConfirm(false);
    }
  }, [open]);

  if (!sale) return null;

  const isCancelled = sale.install_status === 'cancelled';
  const isPending = sale.install_status === 'pending';
  const isFP = sale.type === 'fp';
  const timeStr = format(parseISO(sale.timestamp), 'h:mm a');
  const dateStr = format(parseISO(entryDate), 'MMM d, yyyy');

  // Check if CRM data exists
  const hasSimpleCrmData = sale.customer_name || sale.customer_phone || sale.customer_account_number || sale.customer_location;
  const hasDetailedCrmData = sale.time_to_sell_minutes || sale.deal_type || sale.money_spent || sale.difficulty;

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

  const handleMarkUnfunded = () => {
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

  const handleDeleteSale = () => {
    if (onDeleteSale) {
      onDeleteSale(sale.id);
    }
    setShowDeleteConfirm(false);
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

        <div className="px-4 pb-6 space-y-6 max-h-[70dvh] overflow-y-auto flex-1 min-h-0">
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
                  Installed but Unfunded
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

          {/* CRM Data - Simple (Customer Info) */}
          {crmEnabled && hasSimpleCrmData && (
            <div className="space-y-3 pt-2 border-t border-border/50">
              <Label className="text-sm font-medium text-muted-foreground">
                Customer Info
              </Label>
              <div className="grid gap-2">
                {sale.customer_name && (
                  <div className="flex items-center gap-3 text-sm bg-muted/30 rounded-lg px-3 py-2">
                    <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span>{sale.customer_name}</span>
                  </div>
                )}
                {sale.customer_phone && (
                  <a 
                    href={`tel:${sale.customer_phone}`}
                    className="flex items-center justify-between text-sm bg-muted/30 rounded-lg px-3 py-2 active:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span>{sale.customer_phone}</span>
                    </div>
                    <Phone className="h-4 w-4 text-primary" />
                  </a>
                )}
                {sale.customer_account_number && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(sale.customer_account_number || '');
                      toast.success('Account number copied');
                    }}
                    className="flex items-center justify-between text-sm bg-muted/30 rounded-lg px-3 py-2 active:bg-muted/50 transition-colors w-full text-left"
                  >
                    <div className="flex items-center gap-3">
                      <Hash className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span>{sale.customer_account_number}</span>
                    </div>
                    <Copy className="h-4 w-4 text-primary" />
                  </button>
                )}
                {sale.customer_location && (
                  <div className="flex items-center gap-3 text-sm bg-muted/30 rounded-lg px-3 py-2">
                    <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">{sale.customer_location}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CRM Data - Detailed (Sale Analytics) */}
          {crmEnabled && crmDetailedEnabled && hasDetailedCrmData && (
            <div className="space-y-3 pt-2 border-t border-border/50">
              <Label className="text-sm font-medium text-muted-foreground">
                Sale Details
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {sale.time_to_sell_minutes && (
                  <div className="flex items-center gap-2 text-sm bg-muted/30 rounded-lg px-3 py-2">
                    <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span>{formatMinutes(sale.time_to_sell_minutes)}</span>
                  </div>
                )}
                {sale.deal_type && isFP && (
                  <div className="flex items-center gap-2 text-sm bg-muted/30 rounded-lg px-3 py-2">
                    <span className="text-xs font-medium uppercase text-muted-foreground">Type:</span>
                    <span className="capitalize">{sale.deal_type}</span>
                  </div>
                )}
                {sale.money_spent !== undefined && sale.money_spent !== null && (
                  <div className="flex items-center gap-2 text-sm bg-muted/30 rounded-lg px-3 py-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span>${sale.money_spent}</span>
                  </div>
                )}
                {sale.difficulty && (
                  <div className="flex items-center gap-2 text-sm bg-muted/30 rounded-lg px-3 py-2">
                    <Gauge className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="capitalize">{sale.difficulty}</span>
                  </div>
                )}
              </div>
            </div>
          )}

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
                  className="w-full h-10 text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
                >
                  <Ban className="h-4 w-4 mr-2" />
                  Installed but Later Cancelled
                </Button>
                {onDeleteSale && (
                  <Button
                    variant="ghost"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full h-10 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Never Installed - Remove Sale
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  onClick={() => setShowCancelConfirm(true)}
                  className="w-full h-10 text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
                >
                  <Ban className="h-4 w-4 mr-2" />
                  Mark as Unfunded (Cancelled After Install)
                </Button>
                {onDeleteSale && (
                  <Button
                    variant="ghost"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full h-10 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Never Installed - Remove Sale
                  </Button>
                )}
              </>
            )}
          </div>

          {/* Unfunded Confirmation */}
          {showCancelConfirm && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-foreground">
                    Mark as Unfunded?
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    This deal was installed but later cancelled. It will still count toward your total goals but won't count as funded income.
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
                  Keep as Funded
                </Button>
                <Button
                  size="sm"
                  onClick={handleMarkUnfunded}
                  className="flex-1 bg-amber-600 hover:bg-amber-700"
                >
                  Yes, Mark Unfunded
                </Button>
              </div>
            </div>
          )}

          {/* Delete Confirmation */}
          {showDeleteConfirm && (
            <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Trash2 className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-foreground">
                    Remove Sale Completely?
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    This deal never installed. Removing it will delete it from your numbers completely—as if it never happened. Your FP+ and PRMR will be recalculated.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1"
                >
                  Keep Sale
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteSale}
                  className="flex-1"
                >
                  Yes, Remove
                </Button>
              </div>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};