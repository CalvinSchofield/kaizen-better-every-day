import { Phone, MessageSquare, CheckCircle, Clock, Ban, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CustomerSale } from '@/hooks/useCustomerData';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

interface CustomerCardProps {
  sale: CustomerSale;
  efpModeEnabled: boolean;
  onCardClick: () => void;
  onFundingToggle: (newStatus: 'installed' | 'pending' | 'cancelled') => void;
}

export const CustomerCard = ({ sale, efpModeEnabled, onCardClick, onFundingToggle }: CustomerCardProps) => {
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

  const handleFundingClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Cycle through: installed -> pending -> cancelled -> installed
    const nextStatus = sale.install_status === 'installed' 
      ? 'pending' 
      : sale.install_status === 'pending' 
        ? 'cancelled' 
        : 'installed';
    onFundingToggle(nextStatus);
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
  const isPending = sale.install_status === 'pending';
  const isInstalled = sale.install_status === 'installed';

  // Format date
  const saleDate = format(parseISO(sale.entry_date), 'MMM d');

  // Status indicator color and icon
  const getStatusIndicator = () => {
    if (isInstalled) return { color: 'bg-emerald-500', icon: CheckCircle, label: 'Funded' };
    if (isPending) return { color: 'bg-amber-500', icon: Clock, label: 'Pending' };
    return { color: 'bg-destructive', icon: Ban, label: 'Unfunded' };
  };

  const status = getStatusIndicator();
  const StatusIcon = status.icon;

  return (
    <div 
      onClick={onCardClick}
      className={cn(
        "bg-card rounded-xl p-4 border border-border shadow-sm cursor-pointer transition-all active:scale-[0.98]",
        isCancelled && "opacity-60"
      )}
    >
      {/* Header Row - Name, Type Badge, Funding Status */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <h3 className="font-semibold text-foreground truncate">
            {sale.customer_name || 'Unknown Customer'}
          </h3>
          <Badge 
            variant={sale.type === 'fp' ? 'default' : 'secondary'}
            className={cn(
              "text-xs shrink-0",
              sale.type === 'fp' 
                ? 'bg-primary/10 text-primary' 
                : 'bg-emerald-500/10 text-emerald-600'
            )}
          >
            {sale.type === 'fp' ? 'FP' : 'Upgrade'}
          </Badge>
        </div>
        
        {/* Funding Status Button */}
        <button
          onClick={handleFundingClick}
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors",
            isInstalled && "bg-emerald-500/10 text-emerald-600",
            isPending && "bg-amber-500/10 text-amber-600",
            isCancelled && "bg-destructive/10 text-destructive"
          )}
        >
          <StatusIcon className="w-3 h-3" />
          <span>{status.label}</span>
        </button>
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

      {/* Secondary Info Row */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
        {sale.account_number && (
          <span className="font-mono">A-{sale.account_number}</span>
        )}
        {sale.customer_phone && (
          <span>{sale.customer_phone}</span>
        )}
        <span className="ml-auto">{saleDate}</span>
      </div>

      {/* Action Row */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {sale.customer_phone && (
            <>
              <button
                onClick={handleCall}
                className="p-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                aria-label="Call customer"
              >
                <Phone className="w-4 h-4" />
              </button>
              <button
                onClick={handleText}
                className="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 transition-colors"
                aria-label="Text customer"
              >
                <MessageSquare className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground" />
      </div>
    </div>
  );
};
