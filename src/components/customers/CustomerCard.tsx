import { Phone, MessageSquare, Copy, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CustomerSale } from '@/hooks/useCustomerData';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface CustomerCardProps {
  sale: CustomerSale;
  efpModeEnabled: boolean;
  onCardClick: () => void;
  onFundingToggle: (newStatus: 'installed' | 'pending' | 'cancelled') => void;
}

export const CustomerCard = ({ sale, efpModeEnabled, onCardClick }: CustomerCardProps) => {
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
    const textToCopy = sale.account_number || sale.customer_phone || '';
    if (textToCopy) {
      await navigator.clipboard.writeText(textToCopy);
      toast({
        title: "Copied",
        description: sale.account_number ? `Account: ${textToCopy}` : `Phone: ${textToCopy}`,
      });
    }
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

  // Funding status dot color
  const getFundingDotColor = () => {
    if (isInstalled) return 'bg-emerald-500';
    if (isPending) return 'bg-amber-500';
    return 'bg-destructive';
  };

  return (
    <div 
      onClick={onCardClick}
      className={cn(
        "bg-card rounded-xl p-4 border border-border shadow-sm cursor-pointer transition-all active:scale-[0.98]",
        isCancelled && "opacity-60"
      )}
    >
      {/* Header Row - Name, Type Badge with Funding Dot */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <h3 className="font-semibold text-foreground truncate">
            {sale.customer_name || 'Unknown Customer'}
          </h3>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className={cn("w-2 h-2 rounded-full", getFundingDotColor())} />
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
        {sale.account_number && (
          <span className="font-mono">A-{sale.account_number}</span>
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
        {(sale.account_number || sale.customer_phone) && (
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
  );
};
