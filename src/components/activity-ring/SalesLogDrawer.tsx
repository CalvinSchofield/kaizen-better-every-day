import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Clock, 
  DollarSign, 
  Target, 
  Zap,
  Timer,
  Home,
} from "lucide-react";
import { Sale } from "@/hooks/useDailyEntry";
import { format, parseISO } from "date-fns";
import { formatPRMR } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface SalesLogDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  salesLog: Sale[];
}

const formatDuration = (minutes: number): string => {
  if (minutes < 1) return '<1 min';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

interface SaleCardProps {
  sale: Sale;
  index: number;
}

const SaleCard = ({ sale, index }: SaleCardProps) => {
  const saleAny = sale as any;
  const timeToSell = saleAny.time_to_sell_minutes;
  const wasNeverInstalled = sale.install_status === 'never_installed';
  
  return (
    <div className={cn(
      "p-4 rounded-xl border",
      wasNeverInstalled 
        ? "bg-muted/30 border-muted opacity-60" 
        : "bg-primary/5 border-primary/20"
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
            wasNeverInstalled 
              ? "bg-muted text-muted-foreground"
              : "bg-primary/20 text-primary"
          )}>
            {index + 1}
          </div>
          <div>
            <Badge variant={sale.type === 'fp' ? 'default' : 'secondary'}>
              {sale.type === 'fp' ? 'FP+' : 'Upgrade'}
            </Badge>
            {wasNeverInstalled && (
              <Badge variant="destructive" className="ml-1 text-[10px]">
                Never Installed
              </Badge>
            )}
          </div>
        </div>
        <div className={cn(
          "text-lg font-bold tabular-nums",
          wasNeverInstalled ? "text-muted-foreground line-through" : "text-primary"
        )}>
          ${formatPRMR(sale.prmr)}
        </div>
      </div>
      
      <div className="space-y-2">
        {/* Timestamp */}
        {sale.timestamp && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              <span>Time</span>
            </div>
            <span className="tabular-nums">
              {format(parseISO(sale.timestamp), 'h:mm a')}
            </span>
          </div>
        )}
        
        {/* Time to sell */}
        {timeToSell !== undefined && timeToSell > 0 && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Timer className="w-3.5 h-3.5" />
              <span>Time to Close</span>
            </div>
            <span className="tabular-nums">
              {formatDuration(timeToSell)}
            </span>
          </div>
        )}
        
        {/* Deal type */}
        {sale.deal_type && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Home className="w-3.5 h-3.5" />
              <span>Deal Type</span>
            </div>
            <Badge variant="outline" className="capitalize text-xs">
              {sale.deal_type}
            </Badge>
          </div>
        )}
        
        {/* Difficulty */}
        {sale.difficulty && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Zap className="w-3.5 h-3.5" />
              <span>Difficulty</span>
            </div>
            <Badge 
              variant="outline"
              className={cn(
                "capitalize text-xs",
                sale.difficulty === 'easy' && "border-primary text-primary",
                sale.difficulty === 'medium' && "border-warning text-warning",
                sale.difficulty === 'hard' && "border-destructive text-destructive"
              )}
            >
              {sale.difficulty}
            </Badge>
          </div>
        )}
        
        {/* Money spent */}
        {sale.money_spent !== undefined && sale.money_spent > 0 && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <DollarSign className="w-3.5 h-3.5" />
              <span>Money Spent</span>
            </div>
            <span className="tabular-nums">
              ${sale.money_spent}
            </span>
          </div>
        )}
        
        {/* Customer name */}
        {sale.customer_name && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Target className="w-3.5 h-3.5" />
              <span>Customer</span>
            </div>
            <span className="truncate max-w-[150px]">
              {sale.customer_name}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export const SalesLogDrawer = ({
  open,
  onOpenChange,
  salesLog,
}: SalesLogDrawerProps) => {
  // Sort sales by timestamp (most recent first)
  const sortedSales = [...salesLog].sort((a, b) => {
    if (!a.timestamp || !b.timestamp) return 0;
    return parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime();
  });
  
  const validSales = sortedSales.filter(s => s.install_status !== 'never_installed');
  const totalPRMR = validSales.reduce((sum, s) => sum + (s.prmr || 0), 0);
  
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="border-b pb-3">
          <div className="flex items-center justify-between">
            <DrawerTitle className="text-lg">
              Sales Details
            </DrawerTitle>
            <div className="text-right">
              <div className="text-lg font-bold text-primary tabular-nums">
                ${formatPRMR(totalPRMR)}
              </div>
              <div className="text-xs text-muted-foreground">
                {validSales.length} sale{validSales.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </DrawerHeader>

        <ScrollArea className="flex-1 max-h-[60vh]">
          <div className="p-4 space-y-3">
            {sortedSales.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No sales logged today
              </div>
            ) : (
              sortedSales.map((sale, idx) => (
                <SaleCard key={sale.id || idx} sale={sale} index={idx} />
              ))
            )}
          </div>
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
};
