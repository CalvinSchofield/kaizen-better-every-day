import { Card, CardContent } from "@/components/ui/card";
import { Sale } from "@/components/LogSaleSheet";
import { X, Ban } from "lucide-react";
import { format, parseISO } from "date-fns";

interface SalesLoggerCardProps {
  salesLog: Sale[];
  onEditSale: (sale: Sale) => void;
  onDeleteSale: (saleId: string) => void;
}

export const SalesLoggerCard = ({
  salesLog,
  onEditSale,
  onDeleteSale,
}: SalesLoggerCardProps) => {
  // Filter funded sales for totals
  const fundedSales = salesLog.filter(s => s.install_status !== 'cancelled');
  const cancelledSales = salesLog.filter(s => s.install_status === 'cancelled');
  
  const fpSales = fundedSales.filter(s => s.type === 'fp');
  const upgradeSales = fundedSales.filter(s => s.type === 'upgrade');
  
  const fpCount = fpSales.length;
  const upgradePrmrTotal = upgradeSales.reduce((sum, s) => sum + s.prmr, 0);
  const upgradeFP = upgradePrmrTotal / 85;
  
  const totalFPPlus = fpCount + upgradeFP;
  const totalPrmr = fundedSales.reduce((sum, s) => sum + s.prmr, 0);

  if (salesLog.length === 0) {
    return null; // Don't show card if no sales
  }

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardContent className="p-4 space-y-3">
        {/* Header with totals */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <span className="text-lg">💰</span>
            Today's Sales
          </h3>
          <div className="text-right">
            <div className="text-lg font-bold text-primary">
              ${totalPrmr.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">
              {totalFPPlus.toFixed(1)} FP+
            </div>
          </div>
        </div>

        {/* Sales chips - horizontal scroll */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          {salesLog.map((sale) => (
            <SaleChip
              key={sale.id}
              sale={sale}
              onEdit={() => onEditSale(sale)}
              onDelete={() => onDeleteSale(sale.id)}
            />
          ))}
        </div>

        {/* Breakdown */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 border-t border-border/50">
          <span>{fpCount} FP{fpCount !== 1 ? 's' : ''}</span>
          {upgradeSales.length > 0 && (
            <>
              <span>•</span>
              <span>{upgradeSales.length} Upgrade{upgradeSales.length !== 1 ? 's' : ''} (+{upgradeFP.toFixed(2)} FP)</span>
            </>
          )}
          {cancelledSales.length > 0 && (
            <>
              <span>•</span>
              <span className="text-destructive/70">{cancelledSales.length} Cancelled</span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

interface SaleChipProps {
  sale: Sale;
  onEdit: () => void;
  onDelete: () => void;
}

const SaleChip = ({ sale, onEdit, onDelete }: SaleChipProps) => {
  const isFP = sale.type === 'fp';
  const isCancelled = sale.install_status === 'cancelled';
  const timeStr = format(parseISO(sale.timestamp), 'h:mm a');
  const hasCustomerName = sale.customer_name && sale.customer_name.trim().length > 0;

  return (
    <div
      className={`relative flex-shrink-0 rounded-xl p-3 min-w-[90px] cursor-pointer transition-all active:scale-95 ${
        isCancelled
          ? 'bg-destructive/5 border border-destructive/20 opacity-60'
          : isFP
            ? 'bg-primary/10 border border-primary/20'
            : 'bg-emerald-500/10 border border-emerald-500/20'
      }`}
      onClick={onEdit}
    >
      {/* Cancelled indicator */}
      {isCancelled && (
        <div className="absolute top-1 right-1">
          <Ban className="w-3 h-3 text-destructive" />
        </div>
      )}

      {/* Delete button - only show for non-cancelled */}
      {!isCancelled && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-muted flex items-center justify-center opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity shadow-sm"
        >
          <X className="w-3 h-3 text-muted-foreground" />
        </button>
      )}

      {/* Type badge */}
      <div className={`text-[10px] font-bold mb-1 ${
        isCancelled
          ? 'text-destructive/70'
          : isFP 
            ? 'text-primary' 
            : 'text-emerald-600'
      }`}>
        {isFP ? 'FP' : 'UP'}
      </div>

      {/* Customer name (if available) or PRMR amount */}
      {hasCustomerName ? (
        <>
          <div className={`text-sm font-semibold truncate max-w-[80px] ${
            isCancelled ? 'line-through text-muted-foreground' : 'text-foreground'
          }`}>
            {sale.customer_name}
          </div>
          <div className={`text-xs ${
            isCancelled ? 'line-through text-muted-foreground' : 'text-muted-foreground'
          }`}>
            ${sale.prmr}
          </div>
        </>
      ) : (
        <div className={`text-lg font-bold ${
          isCancelled ? 'line-through text-muted-foreground' : 'text-foreground'
        }`}>
          ${sale.prmr}
        </div>
      )}

      {/* Time */}
      <div className="text-[10px] text-muted-foreground mt-1">
        {timeStr}
      </div>
    </div>
  );
};
