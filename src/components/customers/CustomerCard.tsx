import { Phone, MessageSquare, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { CustomerSale } from '@/hooks/useCustomerData';
import { toast } from 'sonner';

interface CustomerCardProps {
  sale: CustomerSale;
}

export const CustomerCard = ({ sale }: CustomerCardProps) => {
  const [copied, setCopied] = useState(false);

  const handleCall = () => {
    if (sale.customer_phone) {
      window.location.href = `tel:${sale.customer_phone}`;
    }
  };

  const handleText = () => {
    if (sale.customer_phone) {
      window.location.href = `sms:${sale.customer_phone}`;
    }
  };

  const handleCopy = async () => {
    const textToCopy = sale.account_number 
      ? `A-${sale.account_number}`
      : sale.customer_phone || sale.customer_name || '';
    
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const formattedPrmr = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(sale.prmr);

  return (
    <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Name and Type Badge */}
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-foreground truncate">
              {sale.customer_name || 'Unknown Customer'}
            </h3>
            <Badge 
              variant={sale.type === 'fp' ? 'default' : 'secondary'}
              className={sale.type === 'fp' 
                ? 'bg-primary/10 text-primary text-xs' 
                : 'bg-emerald-500/10 text-emerald-600 text-xs'
              }
            >
              {sale.type === 'fp' ? 'FP' : 'Upgrade'}
            </Badge>
          </div>

          {/* Account Number */}
          {sale.account_number && (
            <p className="text-sm text-muted-foreground font-mono">
              A-{sale.account_number}
            </p>
          )}

          {/* Phone Number */}
          {sale.customer_phone && (
            <p className="text-sm text-muted-foreground">
              {sale.customer_phone}
            </p>
          )}

          {/* PRMR */}
          <p className="text-lg font-bold text-foreground mt-2">
            {formattedPrmr}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2">
          {sale.customer_phone && (
            <>
              <button
                onClick={handleCall}
                className="p-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                aria-label="Call customer"
              >
                <Phone className="w-5 h-5" />
              </button>
              <button
                onClick={handleText}
                className="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 transition-colors"
                aria-label="Text customer"
              >
                <MessageSquare className="w-5 h-5" />
              </button>
            </>
          )}
          <button
            onClick={handleCopy}
            className="p-2 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
            aria-label="Copy account number"
          >
            {copied ? (
              <Check className="w-5 h-5 text-emerald-500" />
            ) : (
              <Copy className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
