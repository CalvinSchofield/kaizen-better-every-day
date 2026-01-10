import { useState } from 'react';
import { Phone, MessageSquare, Copy, ChevronRight, Check, Clock, Ban, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CustomerSale } from '@/hooks/useCustomerData';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { CancellationConfirmDrawer } from './CancellationConfirmDrawer';
import { ScheduleInstallDrawer } from './ScheduleInstallDrawer';

interface CustomerCardProps {
  sale: CustomerSale;
  efpModeEnabled: boolean;
  onCardClick: () => void;
  onFundingToggle: (newStatus: 'installed' | 'pending' | 'cancelled' | 'never_installed', scheduledInstallDate?: string) => void;
}

export const CustomerCard = ({ sale, efpModeEnabled, onCardClick, onFundingToggle }: CustomerCardProps) => {
  const [showCancellationDrawer, setShowCancellationDrawer] = useState(false);
  const [showScheduleDrawer, setShowScheduleDrawer] = useState(false);

  const handleCall = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (sale.customer_phone) {
      window.location.href = `tel:${sale.customer_phone}`;
    }
  };

  const handleText = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (sale.customer_phone) {
      window.location.href = `sms:${sale.customer_phone}`;
    }
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const textToCopy = sale.customer_account_number || sale.customer_phone || '';
    if (textToCopy) {
      await navigator.clipboard.writeText(textToCopy);
      toast({
        title: "Copied",
        description: sale.customer_account_number ? `Account: ${textToCopy}` : `Phone: ${textToCopy}`,
      });
    }
  };

  const handleStatusClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    const currentStatus = sale.install_status || 'installed';
    
    // If this is a scheduled-out sale (pending) and user clicks, show the confirmation drawer
    if (currentStatus === 'pending' || sale.scheduled_install_date) {
      setShowCancellationDrawer(true);
      return;
    }
    
    // For non-scheduled sales, when going to pending, show the schedule drawer
    if (currentStatus === 'installed') {
      // Show schedule drawer to pick install date
      setShowScheduleDrawer(true);
      return;
    } 
    
    if (currentStatus === 'cancelled' || currentStatus === 'never_installed') {
      onFundingToggle('installed');
    }
  };

  const handleScheduleConfirm = (scheduledDate: string) => {
    onFundingToggle('pending', scheduledDate);
  };

  const handleScheduleCancel = () => {
    // User cancelled without picking a date - don't change status
  };

  const handleCancellationConfirm = (status: 'cancelled' | 'never_installed') => {
    onFundingToggle(status);
  };

  const formattedPrmr = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(sale.prmr);

  // Calculate EFP (PRMR / 85)
  const efp = (sale.prmr / 85).toFixed(2);
  
  // FP+ is 1.0 for FP deals
  const fpPlus = sale.type === 'fp' ? '1.0' : (sale.prmr / 85).toFixed(1);

  const isCancelled = sale.install_status === 'cancelled';
  const isNeverInstalled = sale.install_status === 'never_installed';
  const isPending = sale.install_status === 'pending';
  const isInstalled = sale.install_status === 'installed' || !sale.install_status;

  // Format date
  const saleDate = format(parseISO(sale.entry_date), 'MMM d');

  // Get status config for the clickable pill
  const getStatusConfig = () => {
    if (isInstalled) {
      return {
        label: 'Funded',
        icon: Check,
        className: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30'
      };
    }
    if (isPending) {
      return {
        label: 'Pending',
        icon: Clock,
        className: 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/30'
      };
    }
    if (isNeverInstalled) {
      return {
        label: 'Never Installed',
        icon: XCircle,
        className: 'bg-destructive/20 text-destructive border-destructive/30 hover:bg-destructive/30'
      };
    }
    return {
      label: 'Unfunded',
      icon: Ban,
      className: 'bg-destructive/20 text-destructive border-destructive/30 hover:bg-destructive/30'
    };
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  return (
    <>
    <div 
      onClick={onCardClick}
      className={cn(
        "bg-card rounded-xl p-4 border border-border shadow-sm cursor-pointer transition-all active:scale-[0.98]",
        (isCancelled || isNeverInstalled) && "opacity-60"
      )}
    >
      {/* Header Row - Name, Status Pill, Type Badge */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
          <h3 className="font-semibold text-foreground truncate">
            {sale.customer_name || 'Unknown Customer'}
          </h3>
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Clickable Funding Status Pill */}
            <button
              onClick={handleStatusClick}
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-colors cursor-pointer",
                statusConfig.className
              )}
            >
              <StatusIcon className="w-3 h-3" />
              {statusConfig.label}
            </button>
            <Badge 
              variant={sale.type === 'fp' ? 'default' : 'secondary'}
              className={cn(
                "text-xs",
                sale.type === 'fp' 
                  ? 'bg-primary/10 text-primary' 
                  : 'bg-emerald-500/10 text-emerald-600'
              )}
            >
              {sale.type === 'fp' ? 'FP' : 'Upgrade'}
            </Badge>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
      </div>

      {/* Metrics Row - EFP/FP+ and PRMR */}
      <div className="flex items-baseline gap-3 mb-3">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-foreground">
            {efpModeEnabled ? efp : fpPlus}
          </span>
          <span className="text-sm text-muted-foreground">
            {efpModeEnabled ? 'EFP' : 'FP+'}
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className={cn(
            "text-lg font-semibold",
            isCancelled ? "text-muted-foreground line-through" : "text-foreground"
          )}>
            {formattedPrmr}
          </span>
          <span className="text-sm text-muted-foreground">PRMR</span>
        </div>
      </div>

      {/* Secondary Info Row - Account # and Date */}
      <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
        {sale.customer_account_number && (
          <span className="font-mono">A-{sale.customer_account_number}</span>
        )}
        <span className="ml-auto">{saleDate}</span>
      </div>

      {/* Action Row - Gray buttons */}
      <div className="flex gap-2">
        {sale.customer_phone && (
          <>
            <button
              onClick={handleCall}
              className="p-2 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
              aria-label="Call customer"
            >
              <Phone className="w-4 h-4" />
            </button>
            <button
              onClick={handleText}
              className="p-2 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
              aria-label="Text customer"
            >
              <MessageSquare className="w-4 h-4" />
            </button>
          </>
        )}
        {(sale.customer_account_number || sale.customer_phone) && (
          <button
            onClick={handleCopy}
            className="p-2 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
            aria-label="Copy account or phone"
          >
            <Copy className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>

    {/* Cancellation Confirmation Drawer */}
    <CancellationConfirmDrawer
      open={showCancellationDrawer}
      onOpenChange={setShowCancellationDrawer}
      sale={sale}
      onConfirm={handleCancellationConfirm}
    />

    {/* Schedule Install Date Drawer */}
    <ScheduleInstallDrawer
      open={showScheduleDrawer}
      onOpenChange={setShowScheduleDrawer}
      onConfirm={handleScheduleConfirm}
      onCancel={handleScheduleCancel}
      customerName={sale.customer_name}
    />
    </>
  );
};
