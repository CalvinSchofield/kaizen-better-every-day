import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Ban, XCircle, AlertTriangle, CheckCircle } from 'lucide-react';
import { Sale } from '@/hooks/useDailyEntry';

interface CancellationConfirmDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: Sale | null;
  onConfirm: (status: 'cancelled' | 'never_installed') => void;
  isUpdating?: boolean;
}

export const CancellationConfirmDrawer = ({
  open,
  onOpenChange,
  sale,
  onConfirm,
  isUpdating = false,
}: CancellationConfirmDrawerProps) => {
  const [selectedOption, setSelectedOption] = useState<'cancelled' | 'never_installed' | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleSelectOption = (option: 'cancelled' | 'never_installed') => {
    setSelectedOption(option);
    setShowConfirmation(true);
  };

  const handleConfirm = () => {
    if (selectedOption) {
      onConfirm(selectedOption);
      handleClose();
    }
  };

  const handleClose = () => {
    setSelectedOption(null);
    setShowConfirmation(false);
    onOpenChange(false);
  };

  const handleBack = () => {
    setSelectedOption(null);
    setShowConfirmation(false);
  };

  if (!sale) return null;

  return (
    <Drawer open={open} onOpenChange={handleClose}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="text-center pb-2">
          <DrawerTitle>What happened with this sale?</DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pb-6 space-y-4">
          {!showConfirmation ? (
            <>
              {/* Sale info */}
              <div className="bg-muted/50 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                    sale.type === 'fp' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-emerald-600 text-white'
                  }`}>
                    {sale.type === 'fp' ? 'FP' : 'Upgrade'}
                  </span>
                  <span className="font-bold">${sale.prmr}</span>
                </div>
                {sale.customer_name && (
                  <span className="text-sm text-muted-foreground truncate max-w-[150px]">
                    {sale.customer_name}
                  </span>
                )}
              </div>

              {/* Option 1: Installed then cancelled */}
              <button
                onClick={() => handleSelectOption('cancelled')}
                disabled={isUpdating}
                className="w-full p-4 rounded-xl border-2 border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition-colors text-left space-y-2"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <Ban className="w-5 h-5 text-amber-500" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">Installed, then cancelled</p>
                    <p className="text-xs text-muted-foreground">
                      Customer had it installed but later cancelled
                    </p>
                  </div>
                </div>
                <div className="ml-13 pl-[52px] text-xs text-amber-600 dark:text-amber-400">
                  ✓ This sale will still count on your leaderboard and records
                </div>
              </button>

              {/* Option 2: Never installed */}
              <button
                onClick={() => handleSelectOption('never_installed')}
                disabled={isUpdating}
                className="w-full p-4 rounded-xl border-2 border-destructive/30 bg-destructive/5 hover:bg-destructive/10 transition-colors text-left space-y-2"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
                    <XCircle className="w-5 h-5 text-destructive" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">Never installed</p>
                    <p className="text-xs text-muted-foreground">
                      The installation never happened
                    </p>
                  </div>
                </div>
                <div className="ml-13 pl-[52px] text-xs text-destructive">
                  ✗ This sale will NOT count on your leaderboard or records
                </div>
              </button>

              <Button
                variant="ghost"
                onClick={handleClose}
                className="w-full mt-2"
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              {/* Confirmation step */}
              <div className={`p-4 rounded-xl border-2 ${
                selectedOption === 'cancelled' 
                  ? 'border-amber-500/30 bg-amber-500/10' 
                  : 'border-destructive/30 bg-destructive/10'
              }`}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className={`w-5 h-5 mt-0.5 ${
                    selectedOption === 'cancelled' ? 'text-amber-500' : 'text-destructive'
                  }`} />
                  <div className="space-y-2">
                    <p className="font-semibold">
                      {selectedOption === 'cancelled' 
                        ? 'Mark as installed then cancelled?' 
                        : 'Mark as never installed?'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {selectedOption === 'cancelled' 
                        ? 'This sale will be marked as unfunded but will still count toward your leaderboard position and any records set.'
                        : 'This sale will be removed from your leaderboard totals. If this was part of a record-breaking day, your records will be recalculated.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Summary of what will happen */}
              <div className="bg-muted/50 rounded-xl p-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">What will happen:</p>
                {selectedOption === 'cancelled' ? (
                  <ul className="space-y-1.5 text-sm">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      <span>Sale stays in your CRM</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      <span>Counts on leaderboard & records</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Ban className="w-4 h-4 text-amber-500" />
                      <span>Marked as unfunded/cancelled</span>
                    </li>
                  </ul>
                ) : (
                  <ul className="space-y-1.5 text-sm">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      <span>Sale stays in your CRM</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-destructive" />
                      <span>Removed from leaderboard totals</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-destructive" />
                      <span>Won't count toward any records</span>
                    </li>
                  </ul>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleBack}
                  className="flex-1"
                  disabled={isUpdating}
                >
                  Go Back
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={isUpdating}
                  className={`flex-1 ${
                    selectedOption === 'cancelled'
                      ? 'bg-amber-500 hover:bg-amber-600 text-white'
                      : 'bg-destructive hover:bg-destructive/90'
                  }`}
                >
                  {isUpdating ? 'Updating...' : 'Confirm'}
                </Button>
              </div>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
