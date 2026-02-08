import { motion } from "framer-motion";
import { DollarSign, Clock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sale } from "@/hooks/useDailyEntry";
import { formatPRMR } from "@/lib/formatters";
import { parseISO, format } from "date-fns";
import { hapticLight } from "@/utils/haptics";
import { calculateFromSalesLog } from "@/utils/salesLogCalculations";

interface SalesRecapCardProps {
  salesLog: Sale[];
  onEditSale?: (sale: Sale) => void;
  onViewAll?: () => void;
  className?: string;
}

export const SalesRecapCard = ({
  salesLog,
  onEditSale,
  onViewAll,
  className,
}: SalesRecapCardProps) => {
  // Filter out never-installed sales for display
  const validSales = salesLog.filter(s => s.install_status !== 'never_installed');
  
  if (validSales.length === 0) return null;

  const { fp, prmr } = calculateFromSalesLog(salesLog);
  const upgrades = validSales.filter(s => s.type === 'upgrade').length;

  const handleSaleClick = (sale: Sale) => {
    hapticLight();
    onEditSale?.(sale);
  };

  const handleViewAll = () => {
    hapticLight();
    onViewAll?.();
  };

  return (
    <motion.div
      className={cn(
        "p-4 rounded-xl border bg-muted/30 border-border/30",
        className
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.25 }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">💰</span>
          <span className="font-semibold text-foreground">Today's Deals</span>
          <span className="text-xs bg-green-500/20 text-green-500 px-2 py-0.5 rounded-full font-medium">
            {validSales.length}
          </span>
        </div>
        
        {validSales.length > 3 && onViewAll && (
          <button
            onClick={handleViewAll}
            className="flex items-center gap-1 text-xs text-primary active:scale-95 transition-transform"
          >
            <span>View all</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Summary row */}
      <div className="flex items-center gap-4 mb-3 text-sm">
        <div className="flex items-center gap-1">
          <DollarSign className="w-4 h-4 text-green-500" />
          <span className="font-semibold">${formatPRMR(prmr)}</span>
        </div>
        <div className="text-muted-foreground">
          {fp.toFixed(2)} FP+ {upgrades > 0 && <span className="text-primary/70">({upgrades} upgrade{upgrades !== 1 ? 's' : ''})</span>}
        </div>
      </div>

      {/* Sale chips - horizontal scroll */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        {validSales.slice(0, 5).map((sale, idx) => (
          <motion.button
            key={sale.id}
            onClick={() => handleSaleClick(sale)}
            className={cn(
              "flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg",
              "bg-green-500/10 border border-green-500/30",
              "active:scale-95 transition-transform"
            )}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
          >
            <div className="flex flex-col items-start">
              <span className="text-sm font-semibold text-green-500">
                ${sale.prmr?.toFixed(0)}
              </span>
              {sale.customer_name && (
                <span className="text-xs text-muted-foreground truncate max-w-[80px]">
                  {sale.customer_name}
                </span>
              )}
            </div>
            {sale.timestamp && (
              <div className="flex items-center gap-1 text-[10px] text-green-500/70">
                <Clock className="w-3 h-3" />
                {format(parseISO(sale.timestamp), 'h:mm a')}
              </div>
            )}
            {sale.type === 'upgrade' && (
              <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                UPG
              </span>
            )}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
};
