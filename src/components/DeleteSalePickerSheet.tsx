import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Sale } from "./LogSaleSheet";
import { format, parseISO } from "date-fns";
import { Trash2 } from "lucide-react";

interface DeleteSalePickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  salesLog: Sale[];
  onDeleteSale: (saleId: string) => void;
}

export const DeleteSalePickerSheet = ({
  open,
  onOpenChange,
  salesLog,
  onDeleteSale,
}: DeleteSalePickerSheetProps) => {
  const handleDelete = (saleId: string) => {
    onDeleteSale(saleId);
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="px-4 pb-8">
        <DrawerHeader className="text-left">
          <DrawerTitle>Remove a Sale</DrawerTitle>
          <DrawerDescription>
            Select which sale to remove. This will also decrement your closes count.
          </DrawerDescription>
        </DrawerHeader>
        
        <div className="space-y-2 mt-2">
          {salesLog.map((sale) => {
            const isFP = sale.type === 'fp';
            const timeStr = format(parseISO(sale.timestamp), 'h:mm a');
            
            return (
              <button
                key={sale.id}
                onClick={() => handleDelete(sale.id)}
                className={`w-full flex items-center justify-between p-4 rounded-xl transition-colors ${
                  isFP
                    ? 'bg-primary/10 border border-primary/20 hover:bg-primary/20'
                    : 'bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`text-sm font-bold ${
                    isFP ? 'text-primary' : 'text-emerald-600'
                  }`}>
                    {isFP ? 'FP' : 'Upgrade'}
                  </div>
                  <div className="text-lg font-bold text-foreground">
                    ${sale.prmr.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {timeStr}
                  </div>
                </div>
                <Trash2 className="h-5 w-5 text-destructive" />
              </button>
            );
          })}
        </div>
        
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          className="mt-4 w-full"
        >
          Cancel
        </Button>
      </DrawerContent>
    </Drawer>
  );
};
